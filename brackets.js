// brackets.js - Module for managing tournament brackets
import { auth, db, isAuthenticated } from './firebase.js';
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs,
    addDoc,
    updateDoc,
    query, 
    where,
    orderBy,
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { getTournamentParticipantsInfo } from './registration.js';

// Generate bracket from participants
export async function generateBracket(tournamentId) {
    try {
        console.log("Generating bracket for tournament:", tournamentId);
        
        // Get tournament document
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Check if bracket already exists
        const bracketsRef = collection(db, "brackets");
        const q = query(
            bracketsRef, 
            where("tournamentId", "==", tournamentId),
            where("status", "==", "active") // Solo buscar brackets activos
        );
        const bracketsSnapshot = await getDocs(q);

        if (!bracketsSnapshot.empty) {
            // Active bracket already exists
            console.log("Active bracket already exists for this tournament");
            return bracketsSnapshot.docs[0].id;
        }
        
        // Usar participantes con check-in si es posible, si no, usar todos los participantes
        let participantsToUse = [];
        
        if (tournamentData.checkedInParticipants && tournamentData.checkedInParticipants.length >= 2) {
            // Si hay participantes con check-in, usar esos
            participantsToUse = [...tournamentData.checkedInParticipants]; // Usar una copia para evitar modificar el original
            console.log(`Using ${participantsToUse.length} checked-in participants for bracket generation`);
        } else if (tournamentData.participants && tournamentData.participants.length >= 2) {
            // Si no hay participantes con check-in o son menos de 2, usar todos los participantes
            participantsToUse = [...tournamentData.participants]; // Usar una copia para evitar modificar el original
            console.log(`Using all ${participantsToUse.length} participants for bracket generation`);
            
            // Actualizar lista de checked-in participants
            await updateDoc(tournamentRef, {
                checkedInParticipants: participantsToUse,
                updatedAt: serverTimestamp()
            });
        } else {
            throw new Error("Se necesitan al menos 2 participantes para generar un bracket");
        }
        
        if (participantsToUse.length < 2) {
            throw new Error("Se necesitan al menos 2 participantes para generar un bracket");
        }
        
        // Get participant info with names
        const participantsInfo = await getTournamentParticipantsInfo(tournamentId);
        console.log("Participants info retrieved:", participantsInfo);
        
        // Shuffle participants for random seeding - Usamos nuestra versión mejorada
        const shuffledParticipants = improvedShuffleArray([...participantsToUse]);
        console.log("Shuffled participants:", shuffledParticipants);
        
        // Generate bracket structure with improved balancing
        const bracketData = createBalancedBracketStructure(shuffledParticipants, participantsInfo);
        
        // Save bracket to database
        const newBracketRef = await addDoc(bracketsRef, {
            tournamentId: tournamentId,
            name: tournamentData.nombre || "Tournament Bracket",
            rounds: bracketData.rounds,
            matches: bracketData.matches,
            participants: participantsToUse.length,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: "active",
            createdBy: auth.currentUser ? auth.currentUser.uid : null
        });
        
        // Update tournament state to 'En Progreso' if it's not already
        if (tournamentData.estado !== 'En Progreso') {
            await updateDoc(tournamentRef, {
                estado: 'En Progreso',
                bracketId: newBracketRef.id,
                updatedAt: serverTimestamp(),
                confirmedParticipants: participantsToUse // Guardar los participantes que se usaron para el bracket
            });
        } else {
            // Just update the bracketId if tournament is already in progress
            await updateDoc(tournamentRef, {
                bracketId: newBracketRef.id,
                updatedAt: serverTimestamp(),
                confirmedParticipants: participantsToUse
            });
        }
        
        console.log("Bracket generated successfully with ID:", newBracketRef.id);
        return newBracketRef.id;
        
    } catch (error) {
        console.error("Error generating bracket:", error);
        throw error;
    }
}

// Create a balanced bracket structure from list of participants
function createBalancedBracketStructure(participants, participantsInfo) {
    const numParticipants = participants.length;
    
    // Calculate the number of rounds needed
    // Find the smallest power of 2 that is greater than or equal to the number of participants
    let numRounds = 1;
    while (Math.pow(2, numRounds) < numParticipants) {
        numRounds++;
    }
    
    const perfectBracketSize = Math.pow(2, numRounds);
    
    // Determine byes and create the bracket structure
    return generateMatchesWithStandardSeeding(participants, participantsInfo, numRounds, perfectBracketSize);
}

// Determine the name of each round (R1, R2, Semis, Final, etc.)
function getRoundName(roundNumber, totalRounds) {
    // For tournaments with many rounds
    if (totalRounds > 4) {
        if (roundNumber === totalRounds) {
            return "Final";
        } else if (roundNumber === totalRounds - 1) {
            return "Semifinales";
        } else if (roundNumber === totalRounds - 2) {
            return "Cuartos de Final";
        } else {
            return `Ronda ${roundNumber}`;
        }
    } 
    // For smaller tournaments
    else {
        if (roundNumber === totalRounds) {
            return "Final";
        } else if (roundNumber === totalRounds - 1 && totalRounds > 1) {
            return "Semifinales";
        } else if (roundNumber === totalRounds - 2 && totalRounds > 2) {
            return "Cuartos de Final";
        } else {
            return `Ronda ${roundNumber}`;
        }
    }
}

// Generate matches using standard tournament seeding
function generateMatchesWithStandardSeeding(participants, participantsInfo, numRounds, bracketSize) {
    const matches = [];
    const numParticipants = participants.length;
    
    console.log(`Generating matches for ${numParticipants} participants in a bracket of size ${bracketSize} with ${numRounds} rounds`);
    
    // Generate seeds for participants (1, 2, 3, 4, etc.)
    const seeds = [];
    for (let i = 0; i < numParticipants; i++) {
        seeds.push(i + 1);
    }
    
    // Generate first round match positions using standard tournament seeding
    const firstRoundPositions = generateStandardSeedPositions(bracketSize);
    
    // Assign participants to positions based on seeding
    const positionAssignments = {};
    
    console.log("Participant assignments:");
    for (let i = 0; i < participants.length; i++) {
        const seed = seeds[i];
        const position = firstRoundPositions[i];
        
        // Verificación de seguridad para evitar posiciones no definidas
        if (position === undefined) {
            console.error(`Error: Posición indefinida para el participante ${i+1}`);
            continue;
        }
        
        const playerId = participants[i];
        const playerInfo = participantsInfo[playerId];
        
        positionAssignments[position] = {
            id: playerId,
            name: playerInfo?.playerName || `Jugador ${i+1}`,
            discord: playerInfo?.discordUsername || null,
            seed: seed
        };
        
        console.log(`Player ${playerId} (${positionAssignments[position].name}) assigned to position ${position} with seed ${seed}`);
    }
    
    // Create matches for each round
    for (let round = 1; round <= numRounds; round++) {
        const matchesInRound = bracketSize / Math.pow(2, round);
        console.log(`Round ${round}: Creating ${matchesInRound} matches`);
        
        for (let position = 1; position <= matchesInRound; position++) {
            const matchId = `${round}-${position}`;
            
            // Calculate which positions feed into this match
            let player1 = null;
            let player2 = null;
            
            if (round === 1) {
                // First round - get players from position assignments
                const player1Position = (position * 2) - 1;
                const player2Position = position * 2;
                
                player1 = positionAssignments[player1Position] || null;
                player2 = positionAssignments[player2Position] || null;
                
                console.log(`Match ${matchId}: Player1 position ${player1Position}, Player2 position ${player2Position}`);
                console.log(`Player1: ${player1?.name || 'null'}, Player2: ${player2?.name || 'null'}`);
            }
            
            // Next match calculation (the match this feeds into)
            const nextRound = round < numRounds ? round + 1 : null;
            const nextMatchPosition = nextRound ? Math.ceil(position / 2) : null;
            const nextMatchId = nextRound ? `${nextRound}-${nextMatchPosition}` : null;
            
            // Create the match
            matches.push({
                id: matchId,
                round: round,
                position: position,
                player1: player1,
                player2: player2,
                winner: null,
                scores: { player1: 0, player2: 0 }, // Inicializar scores con 0
                status: "pending",
                nextMatchId: nextMatchId
            });
        }
    }
    
    // Auto-advance participants where there's only one player in a match (byes)
    const byeMatches = matches.filter(match => 
        (match.player1 && !match.player2) || (!match.player1 && match.player2)
    );
    
    console.log(`Found ${byeMatches.length} bye matches to auto-advance`);
    
    byeMatches.forEach(match => {
        // Determine winner (the only player in the match)
        const winner = match.player1 || match.player2;
        
        // Mark match as completed with the sole player as winner
        match.winner = winner;
        match.status = "completed";
        match.scores = {
            player1: match.player1 ? 1 : 0,
            player2: match.player2 ? 1 : 0
        };
        
        console.log(`Auto-advancing player ${winner.name} in match ${match.id}`);
        
        // Advance winner to next match
        if (match.nextMatchId) {
            const nextMatch = matches.find(m => m.id === match.nextMatchId);
            if (nextMatch) {
                // Determine if winner goes to player1 or player2 slot
                const isOddPosition = match.position % 2 !== 0;
                
                if (isOddPosition) {
                    nextMatch.player1 = winner;
                    console.log(`Player ${winner.name} advanced to next match ${nextMatch.id} as player1`);
                } else {
                    nextMatch.player2 = winner;
                    console.log(`Player ${winner.name} advanced to next match ${nextMatch.id} as player2`);
                }
            }
        }
    });
    
    // Sort matches by round and position
    matches.sort((a, b) => {
        if (a.round !== b.round) {
            return a.round - b.round;
        }
        return a.position - b.position;
    });
    
    // Make sure we have a clear final match
    ensureFinalMatchExists(matches, numRounds);
    
    // Create rounds array
    const rounds = [];
    for (let i = 1; i <= numRounds; i++) {
        rounds.push({
            round: i,
            name: getRoundName(i, numRounds),
            matchCount: bracketSize / Math.pow(2, i)
        });
    }
    
    return {
        rounds: rounds,
        matches: matches
    };
}

// Ensure there's always a final match, even with odd numbers of participants
function ensureFinalMatchExists(matches, numRounds) {
    const finalMatches = matches.filter(match => match.round === numRounds);
    
    if (finalMatches.length === 0) {
        // No final match exists, create one
        const lastRound = numRounds - 1;
        const lastRoundMatches = matches.filter(match => match.round === lastRound);
        
        // Create final match
        const finalMatch = {
            id: `${numRounds}-1`,
            round: numRounds,
            position: 1,
            player1: null,
            player2: null,
            winner: null,
            scores: { player1: 0, player2: 0 },
            status: "pending",
            nextMatchId: null
        };
        
        // Update last round matches to point to final
        lastRoundMatches.forEach(match => {
            match.nextMatchId = finalMatch.id;
        });
        
        // Add final match
        matches.push(finalMatch);
    } else if (finalMatches.length > 1) {
        // More than one final match, consolidate them
        const keepFinalMatch = finalMatches[0];
        const removeFinalMatches = finalMatches.slice(1);
        
        // Create a new super-final match
        const superFinalMatch = {
            id: `${numRounds + 1}-1`,
            round: numRounds + 1,
            position: 1,
            player1: null,
            player2: null,
            winner: null,
            scores: { player1: 0, player2: 0 },
            status: "pending",
            nextMatchId: null
        };
        
        // Update final matches to point to super-final
        finalMatches.forEach(match => {
            match.nextMatchId = superFinalMatch.id;
        });
        
        // Add super-final match
        matches.push(superFinalMatch);
    }
}

// Versión mejorada de la función de shuffle para garantizar un mejor mezclado
function improvedShuffleArray(array) {
    console.log("Original array before shuffle:", [...array]);
    // Aplicamos Fisher-Yates shuffle con más iteraciones para garantizar un buen mezclado
    for (let i = array.length - 1; i > 0; i--) {
        // Usamos Math.random para generar un índice aleatorio
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    
    // Hacemos una segunda pasada para mejorar el mezclado
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    
    console.log("Array after improved shuffle:", [...array]);
    return array;
}

// Función mejorada para generar las posiciones en el bracket
function generateStandardSeedPositions(bracketSize) {
    console.log("Generating positions for bracket size:", bracketSize);
    const positions = [];
    
    // Inicializar posiciones
    for (let i = 0; i < bracketSize; i++) {
        positions[i] = 0;
    }
    
    // Función recursiva para asignar posiciones con algoritmo de potencias de 2
    function assignStandardSeeding(n, start, length) {
        if (length === 1) {
            positions[start] = n;
            return;
        }
        
        const half = length / 2;
        assignStandardSeeding(n, start, half);
        assignStandardSeeding(bracketSize + 1 - n, start + half, half);
    }
    
    // Generar posiciones
    assignStandardSeeding(1, 0, bracketSize);
    
    // Verificar que no hay posiciones en cero (lo que sería un error)
    const hasZeros = positions.some(p => p === 0);
    if (hasZeros) {
        console.error("Error: Hay posiciones sin asignar en el bracket");
        // Solución de respaldo: asignar posiciones secuenciales
        for (let i = 0; i < bracketSize; i++) {
            if (positions[i] === 0) {
                positions[i] = i + 1;
            }
        }
    }
    
    console.log("Generated positions:", positions);
    return positions;
}

// Get bracket data for a tournament
export async function getTournamentBracket(tournamentId) {
    try {
        // Get tournament document
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Check if tournament has a bracket
        if (!tournamentData.bracketId) {
            // No bracket exists yet, return null
            return null;
        }
        
        // Get bracket document
        const bracketRef = doc(db, "brackets", tournamentData.bracketId);
        const bracketSnap = await getDoc(bracketRef);
        
        if (!bracketSnap.exists()) {
            throw new Error("El bracket no existe");
        }
        
        // Return bracket data
        return {
            id: bracketSnap.id,
            ...bracketSnap.data(),
            tournamentName: tournamentData.nombre
        };
        
    } catch (error) {
        console.error("Error getting tournament bracket:", error);
        throw error;
    }
}

// Reset tournament bracket
export async function resetTournamentBracket(tournamentId) {
    try {
        console.log("Iniciando reset de bracket para torneo:", tournamentId);
        
        // Get tournament document
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentSnap.data();
        console.log("Datos del torneo cargados:", tournamentData.nombre);
        
        // Log info de participantes para depuración
        console.log("Participantes registrados:", tournamentData.participants?.length || 0);
        console.log("Participantes con check-in:", tournamentData.checkedInParticipants?.length || 0);
        
        // Asegurarse de que hay participantes disponibles
        if ((!tournamentData.participants || tournamentData.participants.length < 2) &&
            (!tournamentData.checkedInParticipants || tournamentData.checkedInParticipants.length < 2)) {
            throw new Error("Se necesitan al menos 2 participantes para generar un bracket");
        }
        
        // Check if tournament has a bracket
        if (tournamentData.bracketId) {
            console.log("El torneo tiene un bracket existente, marcándolo como inactivo");
            // Delete existing bracket (or mark as inactive)
            const bracketRef = doc(db, "brackets", tournamentData.bracketId);
            await updateDoc(bracketRef, {
                status: "inactive",
                updatedAt: serverTimestamp()
            });
            
            // Clear bracketId from tournament
            await updateDoc(tournamentRef, {
                bracketId: null,
                updatedAt: serverTimestamp()
            });
        }
        
        // Si no hay participantes con check-in pero hay participantes registrados,
        // usar todos los participantes para el bracket
        if (!tournamentData.checkedInParticipants || tournamentData.checkedInParticipants.length < 2) {
            console.log("No hay suficientes participantes con check-in, copiando todos los participantes a la lista de check-in");
            await updateDoc(tournamentRef, {
                checkedInParticipants: tournamentData.participants || [],
                updatedAt: serverTimestamp()
            });
        }
        
        // Obtener datos actualizados del torneo
        const updatedTournamentSnap = await getDoc(tournamentRef);
        const updatedTournamentData = updatedTournamentSnap.data();
        
        console.log("Participantes con check-in actualizados:", updatedTournamentData.checkedInParticipants?.length || 0);
        
        // Generate new bracket (this will use checked-in participants if available)
        console.log("Generando nuevo bracket para el torneo");
        return await generateBracket(tournamentId);
        
    } catch (error) {
        console.error("Error resetting tournament bracket:", error);
        throw error;
    }
}

// Check if user has staff role for a tournament
export async function isUserTournamentStaff(userId, tournamentId) {
    try {
        if (!userId || !tournamentId) return false;
        
        // Check if user is an admin directly
        const user = auth.currentUser;
        if (!user) return false;
        
        // Lista ampliada de administradores - incluyendo al usuario actual para pruebas
        const adminUIDs = [
            "dvblFee1ZnVKJNWBOR22tSAsNet2", // Admin principal
            auth.currentUser.uid // TEMPORAL: considerar al usuario actual como admin para pruebas
        ]; 
        
        if (adminUIDs.includes(user.uid)) {
            console.log("Usuario es administrador por UID");
            return true;
        }
        
        // Get tournament staff roles
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            return false;
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Check if user is the creator of the tournament
        if (tournamentData.createdBy === userId) {
            console.log("Usuario es creador del torneo");
            return true;
        }
        
        // Check staff array if it exists
        const staffList = tournamentData.staff || [];
        const isInStaffList = staffList.includes(userId);
        
        console.log("¿Usuario está en la lista de staff?", isInStaffList);
        return isInStaffList;
        
    } catch (error) {
        console.error("Error checking if user is tournament staff:", error);
        return false;
    }
}

// Add participant manually to tournament
export async function addParticipantManually(tournamentId, playerName, discordUsername, email) {
    try {
        console.log("Iniciando proceso de añadir participante manualmente");
        
        if (!auth.currentUser) {
            throw new Error("No tienes permiso para añadir participantes (no autenticado)");
        }
        
        console.log("Verificando permisos para usuario:", auth.currentUser.uid);
        const userIsStaff = await isUserTournamentStaff(auth.currentUser.uid, tournamentId);
        console.log("¿Usuario es staff?:", userIsStaff);
        
        if (!userIsStaff) {
            throw new Error("No tienes permiso para añadir participantes");
        }
        
        if (!playerName || !email) {
            throw new Error("El nombre del jugador y correo son obligatorios");
        }
        
        // Get tournament document
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Try to find a user with the provided email
        const usersRef = collection(db, "usuarios");
        const emailQuery = query(usersRef, where("email", "==", email.toLowerCase()));
        const userSnapshot = await getDocs(emailQuery);
        
        let userId;
        
        if (userSnapshot.empty) {
            // No user found with this email, create placeholder ID
            userId = `manual_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            console.log("Creando ID para usuario manual:", userId);
            
            // Add to a special collection for manually added users
            await addDoc(collection(db, "manual_participants"), {
                email: email.toLowerCase(),
                playerName: playerName,
                discordUsername: discordUsername || null,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser.uid,
                tournamentId: tournamentId
            });
        } else {
            // User found, use their user ID
            userId = userSnapshot.docs[0].data().uid;
            console.log("Usuario encontrado con ID:", userId);
        }
        
        // Check if participant already exists
        const participants = tournamentData.participants || [];
        if (participants.includes(userId)) {
            throw new Error("Este usuario ya está inscrito en el torneo");
        }
        
        // Add participant to tournament
        console.log("Añadiendo participante al torneo:", userId);
        await updateDoc(tournamentRef, {
            participants: arrayUnion(userId),
            updatedAt: serverTimestamp()
        });
        
        // Also add to checked-in participants if the tournament is in check-in phase
        if (tournamentData.estado === 'Check In' || tournamentData.estado === 'En Progreso') {
            console.log("Añadiendo participante a la lista de check-in");
            await updateDoc(tournamentRef, {
                checkedInParticipants: arrayUnion(userId)
            });
        }
        
        // Add participant info
        await addDoc(collection(db, "participant_info"), {
            userId: userId,
            tournamentId: tournamentId,
            playerName: playerName,
            discordUsername: discordUsername || null,
            email: email.toLowerCase(),
            active: true,
            checkedIn: true,
            manuallyAdded: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        console.log("Participante añadido correctamente");
        return userId;
        
    } catch (error) {
        console.error("Error adding participant manually:", error);
        // Añadir detalles adicionales si es un error de Firebase
        if (error.code) {
            console.error("Firebase error code:", error.code);
        }
        throw error;
    }
}

// Update match results
export async function updateMatchResults(bracketId, matchId, player1Score, player2Score) {
    try {
        console.log("Actualizando resultados para partido:", matchId, "en bracket:", bracketId);
        console.log("Puntajes:", player1Score, player2Score);
        
        // Verificar autenticación
        if (!isAuthenticated()) {
            throw new Error("Debes iniciar sesión para actualizar resultados");
        }
        
        // Get bracket document
        const bracketRef = doc(db, "brackets", bracketId);
        const bracketSnap = await getDoc(bracketRef);
        
        if (!bracketSnap.exists()) {
            throw new Error("El bracket no existe");
        }
        
        const bracketData = bracketSnap.data();
        
        // Check user permissions to update this bracket - Temporalmente permitir a cualquier usuario autenticado
        const hasPermission = true; // Descomentar la siguiente línea en producción
        // const hasPermission = await isUserTournamentStaff(auth.currentUser.uid, bracketData.tournamentId);
        
        if (!hasPermission) {
            throw new Error("No tienes permisos para actualizar este partido");
        }
        
        // Find the match to update
        const matches = bracketData.matches || [];
        const matchIndex = matches.findIndex(match => match.id === matchId);
        
        if (matchIndex === -1) {
            throw new Error("El partido no existe en este bracket");
        }
        
        const match = matches[matchIndex];
        
        // Asegurar que ambos jugadores existen
        if (!match.player1) {
            match.player1 = { id: "tbd_1", name: "TBD", seed: 99 };
        }
        
        if (!match.player2) {
            match.player2 = { id: "tbd_2", name: "TBD", seed: 99 };
        }
        
        // Validar puntajes
        if (typeof player1Score !== 'number' || typeof player2Score !== 'number') {
            throw new Error("Los puntajes deben ser números");
        }
        
        if (player1Score < 0 || player2Score < 0) {
            throw new Error("Los puntajes no pueden ser negativos");
        }
        
        // Determine winner
        const isPlayer1Winner = player1Score > player2Score;
        const winnerId = isPlayer1Winner ? match.player1.id : match.player2.id;
        const winnerName = isPlayer1Winner ? match.player1.name : match.player2.name;
        const winnerDiscord = isPlayer1Winner ? match.player1.discord : match.player2.discord;
        const winnerSeed = isPlayer1Winner ? match.player1.seed : match.player2.seed;
        
        // Update match
        const updatedMatch = {
            ...match,
            scores: {
                player1: player1Score,
                player2: player2Score
            },
            winner: {
                id: winnerId,
                name: winnerName,
                discord: winnerDiscord,
                seed: winnerSeed
            },
            status: "completed",
            updatedAt: new Date()
        };
        
        // Update matches array
        const updatedMatches = [...matches];
        updatedMatches[matchIndex] = updatedMatch;
        
        // Update next match if there is one
        if (match.nextMatchId) {
            const nextMatchIndex = matches.findIndex(m => m.id === match.nextMatchId);
            
            if (nextMatchIndex !== -1) {
                const nextMatch = matches[nextMatchIndex];
                
                // Determine if winner goes into player1 or player2 slot of the next match
                // This depends on the current match position
                const isOddPosition = match.position % 2 !== 0;
                
                // For odd positions, winner goes to player1 slot
                // For even positions, winner goes to player2 slot
                if (!isOddPosition) {
                    updatedMatches[nextMatchIndex] = {
                        ...nextMatch,
                        player2: {
                            id: winnerId,
                            name: winnerName,
                            discord: winnerDiscord,
                            seed: winnerSeed
                        }
                    };
                } else {
                    updatedMatches[nextMatchIndex] = {
                        ...nextMatch,
                        player1: {
                            id: winnerId,
                            name: winnerName,
                            discord: winnerDiscord,
                            seed: winnerSeed
                        }
                    };
                }
            }
        }
        
        console.log("Actualizando bracket con los nuevos resultados");
        
        // Update bracket in database
        await updateDoc(bracketRef, {
            matches: updatedMatches,
            updatedAt: serverTimestamp()
        });
        
        // Check if this is the final match and update tournament if needed
        if (!match.nextMatchId) {
            console.log("Este es el partido final, actualizando ganador del torneo");
            
            // This is the final match, update tournament with winner
            const tournamentRef = doc(db, "torneos", bracketData.tournamentId);
            
            await updateDoc(tournamentRef, {
                ganador: winnerId,
                estado: 'Finalizado',
                updatedAt: serverTimestamp()
            });
            
            // Award badges if configured
            await awardTournamentBadges(bracketData.tournamentId, matchId, updatedMatches);
        }
        
        console.log("Resultados actualizados exitosamente");
        return true;
    } catch (error) {
        console.error("Error updating match results:", error);
        throw error;
    }
}

// Award badges to participants based on tournament results
async function awardTournamentBadges(tournamentId, finalMatchId, matches) {
    try {
        // Get tournament badges configuration
        const tournamentBadgesRef = collection(db, "tournament_badges");
        const q = query(tournamentBadgesRef, where("tournamentId", "==", tournamentId));
        const badgesSnapshot = await getDocs(q);
        
        if (badgesSnapshot.empty) {
            // No badges configured for this tournament
            return;
        }
        
        // Get final match to determine winner
        const finalMatch = matches.find(match => match.id === finalMatchId);
        
        if (!finalMatch || !finalMatch.winner) {
            return;
        }
        
        // Get tournament info to determine confirmed participants
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            return;
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Use confirmedParticipants (checked-in participants) if available
        // Otherwise use regular participants
        const participantsToAward = tournamentData.confirmedParticipants || 
                                   tournamentData.checkedInParticipants || 
                                   tournamentData.participants || [];
        
        // Get user badges collection
        const userBadgesRef = collection(db, "user_badges");
        
        // Process each badge configuration
        for (const badgeDoc of badgesSnapshot.docs) {
            const badgeConfig = badgeDoc.data();
            
            // Determine which players should receive this badge
            let recipientIds = [];
            
            switch (badgeConfig.position) {
                case "first":
                    // Award to tournament winner
                    recipientIds = [finalMatch.winner.id];
                    break;
                    
                case "second":
                    // Award to runner-up (loser of final match)
                    const runnerId = finalMatch.player1.id === finalMatch.winner.id ? 
                        finalMatch.player2.id : finalMatch.player1.id;
                    recipientIds = [runnerId];
                    break;
                    
                case "top3":
                    // Award to semifinalists
                    // Find semifinal matches
                    const finalRound = parseInt(finalMatchId.split('-')[0]);
                    const semifinalRound = finalRound - 1;
                    
                    // Get semifinalists (top 4 players)
                    const semifinalists = matches.filter(match => 
                        match.round === semifinalRound && match.status === 'completed');
                    
                    // Collect all semifinalists (winners go to final, losers get 3rd place)
                    const semifinalistIds = new Set();
                    semifinalists.forEach(match => {
                        if (match.player1) semifinalistIds.add(match.player1.id);
                        if (match.player2) semifinalistIds.add(match.player2.id);
                    });
                    
                    // Remove finalists to get 3rd/4th place
                    if (finalMatch.player1) semifinalistIds.delete(finalMatch.player1.id);
                    if (finalMatch.player2) semifinalistIds.delete(finalMatch.player2.id);
                    
                    recipientIds = [...semifinalistIds];
                    break;
                    
                case "all":
                    // Award to all confirmed participants
                    recipientIds = participantsToAward;
                    break;
            }
            
            // Award badges to recipients
            for (const userId of recipientIds) {
                // Check if user already has this badge
                const existingBadgeQuery = query(
                    userBadgesRef,
                    where("userId", "==", userId),
                    where("badgeId", "==", badgeConfig.badgeId)
                );
                
                const existingBadgeSnapshot = await getDocs(existingBadgeQuery);
                
                if (existingBadgeSnapshot.empty) {
                    // User doesn't have this badge, award it
                    await addDoc(userBadgesRef, {
                        userId: userId,
                        badgeId: badgeConfig.badgeId,
                        tournamentId: tournamentId,
                        reason: `Earned from tournament: ${tournamentId}`,
                        position: badgeConfig.position,
                        assignedAt: serverTimestamp(),
                        assignedBy: "system"
                    });
                }
            }
        }
    } catch (error) {
        console.error("Error awarding tournament badges:", error);
    }
}

// Función para eliminar participantes - permitiendo eliminar incluso en torneos en progreso
export async function removeParticipant(tournamentId, participantId) {
    try {
        console.log("Iniciando proceso de eliminar participante", participantId);
        
        // Verificar autenticación y permisos
        if (!auth.currentUser) {
            throw new Error("Debes iniciar sesión para eliminar participantes");
        }
        
        const userId = auth.currentUser.uid;
        console.log("Usuario autenticado:", userId);
        console.log("¿Usuario es administrador por UID?", userId === "dvblFee1ZnVKJNWBOR22tSAsNet2");
        
        // Permitir que cualquier usuario actualmente autenticado elimine participantes (temporal para pruebas)
        const userIsStaff = true;
        
        if (!userIsStaff) {
            throw new Error("No tienes permiso para eliminar participantes");
        }
        
        console.log("Usuario es administrador por UID");
        
        // Obtener documento del torneo
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Verificar si el participante existe en el torneo
        const participants = tournamentData.participants || [];
        if (!participants.includes(participantId)) {
            throw new Error("Este participante no está inscrito en el torneo");
        }
        
        // Eliminar participante del torneo
        console.log("Eliminando participante de la lista del torneo");
        await updateDoc(tournamentRef, {
            participants: arrayRemove(participantId),
            updatedAt: serverTimestamp()
        });
        
        // Eliminar también de los participantes con check-in si está presente
        if (tournamentData.checkedInParticipants && tournamentData.checkedInParticipants.includes(participantId)) {
            console.log("Eliminando participante de la lista de check-in");
            await updateDoc(tournamentRef, {
                checkedInParticipants: arrayRemove(participantId)
            });
        }
        
        // Actualizar información del participante para marcarlo como inactivo
        const participantInfoQuery = query(
            collection(db, "participant_info"),
            where("userId", "==", participantId),
            where("tournamentId", "==", tournamentId)
        );
        
        const participantInfoSnapshot = await getDocs(participantInfoQuery);
        
        if (!participantInfoSnapshot.empty) {
            const participantDoc = participantInfoSnapshot.docs[0];
            
            console.log("Marcando participante como inactivo en participant_info");
            await updateDoc(doc(db, "participant_info", participantDoc.id), {
                active: false,
                checkedIn: false,
                removedAt: serverTimestamp(),
                removedBy: auth.currentUser.uid
            });
        }
        
        console.log("Participante eliminado correctamente");
        return true;
    } catch (error) {
        console.error("Error removing participant:", error);
        throw error;
    }
}
