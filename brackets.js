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
    arrayUnion
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
        const q = query(bracketsRef, where("tournamentId", "==", tournamentId));
        const bracketsSnapshot = await getDocs(q);
        
        if (!bracketsSnapshot.empty) {
            // Bracket already exists
            console.log("Bracket already exists for this tournament");
            return bracketsSnapshot.docs[0].id;
        }
        
        // Usar participantes con check-in si es posible
        let participantsToUse = [];
        
        if (tournamentData.checkedInParticipants && tournamentData.checkedInParticipants.length >= 2) {
            // Si hay participantes con check-in, usar esos
            participantsToUse = tournamentData.checkedInParticipants;
            console.log(`Using ${participantsToUse.length} checked-in participants for bracket generation`);
        } else if (tournamentData.participants && tournamentData.participants.length >= 2) {
            // Si no hay participantes con check-in o son menos de 2, usar todos los participantes
            console.log("Not enough checked-in participants, using all participants");
            participantsToUse = tournamentData.participants || [];
        } else {
            throw new Error("Se necesitan al menos 2 participantes para generar un bracket");
        }
        
        if (participantsToUse.length < 2) {
            throw new Error("Se necesitan al menos 2 participantes para generar un bracket");
        }
        
        // Get participant info with names
        const participantsInfo = await getTournamentParticipantsInfo(tournamentId);
        
        // Shuffle participants for random seeding
        const shuffledParticipants = shuffleArray([...participantsToUse]);
        
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
    
    // Create rounds array
    const rounds = [];
    for (let i = 1; i <= numRounds; i++) {
        rounds.push({
            round: i,
            name: getRoundName(i, numRounds),
            matchCount: perfectBracketSize / Math.pow(2, i)
        });
    }
    
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

// Generate matches using standard tournament seeding (similar to Challonge)
function generateMatchesWithStandardSeeding(participants, participantsInfo, numRounds, bracketSize) {
    const matches = [];
    const numParticipants = participants.length;
    
    // Generate seeds for participants (1, 2, 3, 4, etc.)
    const seeds = [];
    for (let i = 0; i < numParticipants; i++) {
        seeds.push(i + 1);
    }
    
    // Generate first round match positions using standard tournament seeding
    const firstRoundPositions = generateStandardSeedPositions(bracketSize);
    
    // Assign participants to positions based on seeding
    const positionAssignments = {};
    for (let i = 0; i < seeds.length; i++) {
        const seed = seeds[i];
        const position = firstRoundPositions[i];
        positionAssignments[position] = {
            id: participants[i],
            name: participantsInfo[participants[i]]?.playerName || "TBD",
            discord: participantsInfo[participants[i]]?.discordUsername || null,
            seed: seed
        };
    }
    
    // Create matches for each round
    for (let round = 1; round <= numRounds; round++) {
        const matchesInRound = bracketSize / Math.pow(2, round);
        
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
                scores: {},
                status: "pending",
                nextMatchId: nextMatchId
            });
        }
    }
    
    // Auto-advance participants where there's only one player in a match (byes)
    const byeMatches = matches.filter(match => 
        (match.player1 && !match.player2) || (!match.player1 && match.player2)
    );
    
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
        
        // Advance winner to next match
        if (match.nextMatchId) {
            const nextMatch = matches.find(m => m.id === match.nextMatchId);
            if (nextMatch) {
                // Determine if winner goes to player1 or player2 slot
                const isOddPosition = match.position % 2 !== 0;
                
                if (isOddPosition) {
                    nextMatch.player1 = winner;
                } else {
                    nextMatch.player2 = winner;
                }
            }
        }
    });
    
    // Add empty matches for rounds with odd number of participants
    const roundsWithOddParticipants = {};
    matches.forEach(match => {
        if (match.round > 1 && 
            ((match.player1 && !match.player2) || (!match.player1 && match.player2))) {
            roundsWithOddParticipants[match.round] = true;
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
            scores: {},
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
            scores: {},
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

// Generate standard tournament seed positions
function generateStandardSeedPositions(bracketSize) {
    const positions = [];
    
    // Standard bracket positions using powers of 2
    function assign(n, start, length) {
        if (length === 1) {
            positions[start] = n;
            return;
        }
        
        const half = length / 2;
        assign(n, start, half);
        assign(bracketSize + 1 - n, start + half, half);
    }
    
    // Initialize positions array
    for (let i = 0; i < bracketSize; i++) {
        positions[i] = 0;
    }
    
    // Generate positions
    assign(1, 0, bracketSize);
    
    return positions;
}

// Shuffle array randomly (Fisher-Yates algorithm)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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
        // Get tournament document
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Check if tournament has a bracket
        if (tournamentData.bracketId) {
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
        
        // Generate new bracket (this will use checked-in participants if available)
        return await generateBracket(tournamentId);
        
    } catch (error) {
        console.error("Error resetting tournament bracket:", error);
        throw error;
    }
}

// Add participant manually to tournament
export async function addParticipantManually(tournamentId, playerName, discordUsername, email) {
    try {
        if (!isAuthenticated() || !isUserTournamentStaff(auth.currentUser.uid, tournamentId)) {
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
        }
        
        // Check if participant already exists
        const participants = tournamentData.participants || [];
        if (participants.includes(userId)) {
            throw new Error("Este usuario ya está inscrito en el torneo");
        }
        
        // Add participant to tournament
        await updateDoc(tournamentRef, {
            participants: [...participants, userId],
            updatedAt: serverTimestamp()
        });
        
        // Also add to checked-in participants if the tournament is in check-in phase
        if (tournamentData.estado === 'Check In' || tournamentData.estado === 'En Progreso') {
            const checkedInParticipants = tournamentData.checkedInParticipants || [];
            if (!checkedInParticipants.includes(userId)) {
                await updateDoc(tournamentRef, {
                    checkedInParticipants: [...checkedInParticipants, userId]
                });
            }
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
        
        return userId;
        
    } catch (error) {
        console.error("Error adding participant manually:", error);
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
        
        // List of administrator UIDs
        const adminUIDs = ["dvblFee1ZnVKJNWBOR22tSAsNet2"]; // Main admin UID
        if (adminUIDs.includes(user.uid)) {
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
            return true;
        }
        
        // Check staff array if it exists
        const staffList = tournamentData.staff || [];
        return staffList.includes(userId);
        
    } catch (error) {
        console.error("Error checking if user is tournament staff:", error);
        return false;
    }
}

// Update match results
async function updateMatchResults(bracketId, matchId, player1Score, player2Score) {
    try {
        // Verify user is authenticated and has permission
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
        
        // Check user permissions to update this bracket
        const hasPermission = await isUserTournamentStaff(auth.currentUser.uid, bracketData.tournamentId);
        
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
        
        // Validate both players exist
        if (!match.player1 || !match.player2) {
            throw new Error("Este partido no tiene dos jugadores asignados");
        }
        
        // Validate scores
        if (typeof player1Score !== 'number' || typeof player2Score !== 'number') {
            throw new Error("Los puntajes deben ser números");
        }
        
        if (player1Score < 0 || player2Score < 0) {
            throw new Error("Los puntajes no pueden ser negativos");
        }
        
        if (player1Score === player2Score) {
            throw new Error("Debe haber un ganador, los puntajes no pueden ser iguales");
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
                const isEvenPosition = match.position % 2 === 0;
                
                // For odd positions, winner goes to player1 slot
                // For even positions, winner goes to player2 slot
                if (isEvenPosition) {
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
        
        // Update bracket in database
        await updateDoc(bracketRef, {
            matches: updatedMatches,
            updatedAt: serverTimestamp()
        });
        
        // Check if this is the final match and update tournament if needed
        if (!match.nextMatchId) {
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

// Export necessary functions
