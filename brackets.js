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
        
        // También verificar en la colección participant_info
        if (participantsToUse.length === tournamentData.participants.length) {
            // Si estamos usando todos los participantes, verifiquemos si hay info de check-in en participant_info
            const participantInfoRef = collection(db, "participant_info");
            const checkedInQuery = query(
                participantInfoRef,
                where("tournamentId", "==", tournamentId),
                where("checkedIn", "==", true)
            );
            
            try {
                const checkedInSnapshot = await getDocs(checkedInQuery);
                
                if (checkedInSnapshot.size >= 2) {
                    // Si hay suficientes con check-in en participant_info, usar esos
                    const checkedInParticipantsIds = [];
                    checkedInSnapshot.forEach(doc => {
                        checkedInParticipantsIds.push(doc.data().userId);
                    });
                    
                    participantsToUse = checkedInParticipantsIds;
                    console.log(`Found ${participantsToUse.length} checked-in participants in participant_info`);
                    
                    // Actualizar el documento del torneo también
                    await updateDoc(tournamentRef, {
                        checkedInParticipants: checkedInParticipantsIds
                    });
                }
            } catch (indexError) {
                console.warn("Error al consultar participantes con check-in. Probablemente falta un índice:", indexError);
                // Continuamos con todos los participantes si hay un error de índice
            }
        }
        
        // Get participant info with names
        const participantsInfo = await getTournamentParticipantsInfo(tournamentId);
        
        // Shuffle participants for random seeding (opcional, puede comentarse para mantener el orden original)
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
    
    // Determine byes and create the bracket structure using improved algorithm
    return determineByesAndCreateMatches(participants, participantsInfo, numParticipants, perfectBracketSize, numRounds);
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
        } else {
            return `Ronda ${roundNumber}`;
        }
    }
}

// Determine byes and create matches for balanced bracket (IMPROVED)
function determineByesAndCreateMatches(participants, participantsInfo, numParticipants, perfectBracketSize, numRounds) {
    const matches = [];
    const numByes = perfectBracketSize - numParticipants;
    
    // Create seeds and positions using improved algorithm (similar to Challonge)
    const seeds = createBalancedSeeds(numParticipants, perfectBracketSize);
    
    // First round matches with proper seeding
    let matchId = 1;
    const firstRoundMatchCount = perfectBracketSize / 2;
    
    // Create all first round matches (including empty ones for byes)
    for (let i = 0; i < firstRoundMatchCount; i++) {
        // Determine players for this match
        const seedIndex1 = i * 2;
        const seedIndex2 = i * 2 + 1;
        
        // Get participant indexes based on seed positions
        const participantIndex1 = seedIndex1 < seeds.length ? seeds[seedIndex1].participantIndex : null;
        const participantIndex2 = seedIndex2 < seeds.length ? seeds[seedIndex2].participantIndex : null;
        
        // Create player objects or null for byes
        let player1 = null;
        let player2 = null;
        
        if (participantIndex1 !== null && participantIndex1 < participants.length) {
            player1 = {
                id: participants[participantIndex1],
                name: participantsInfo[participants[participantIndex1]]?.playerName || "TBD",
                discord: participantsInfo[participants[participantIndex1]]?.discordUsername || null,
                seed: seedIndex1 + 1
            };
        }
        
        if (participantIndex2 !== null && participantIndex2 < participants.length) {
            player2 = {
                id: participants[participantIndex2],
                name: participantsInfo[participants[participantIndex2]]?.playerName || "TBD",
                discord: participantsInfo[participants[participantIndex2]]?.discordUsername || null,
                seed: seedIndex2 + 1
            };
        }
        
        // Create the match
        const matchPosition = i + 1;
        const nextMatchPosition = Math.ceil(matchPosition / 2);
        const nextMatchId = numRounds > 1 ? `2-${nextMatchPosition}` : null;
        
        matches.push({
            id: `1-${matchPosition}`,
            round: 1,
            position: matchPosition,
            player1: player1,
            player2: player2,
            winner: null,
            scores: {},
            status: "pending",
            nextMatchId: nextMatchId
        });
    }
    
    // Handle automatic advancement for byes
    const matchesWithByes = matches.filter(match => 
        (match.player1 && !match.player2) || (!match.player1 && match.player2)
    );
    
    // Process all matches with byes to advance players automatically
    const advancedPlayers = {};
    
    matchesWithByes.forEach(match => {
        // Determine the winner (the only player in the match)
        const winner = match.player1 || match.player2;
        
        // Mark match as completed with the sole player as winner
        match.winner = winner;
        match.status = "completed";
        match.scores = {
            player1: match.player1 ? 1 : 0,
            player2: match.player2 ? 1 : 0
        };
        
        // Track this player for next round
        if (match.nextMatchId) {
            if (!advancedPlayers[match.nextMatchId]) {
                advancedPlayers[match.nextMatchId] = [];
            }
            advancedPlayers[match.nextMatchId].push(winner);
        }
    });
    
    // Create the rest of the rounds
    for (let round = 2; round <= numRounds; round++) {
        const matchesInRound = perfectBracketSize / Math.pow(2, round);
        
        for (let i = 0; i < matchesInRound; i++) {
            const matchPosition = i + 1;
            const matchId = `${round}-${matchPosition}`;
            const nextRound = round < numRounds ? round + 1 : null;
            const nextMatchPosition = nextRound ? Math.ceil(matchPosition / 2) : null;
            const nextMatchId = nextRound ? `${nextRound}-${nextMatchPosition}` : null;
            
            // Check if we have pre-advanced players for this match
            const preAdvancedPlayers = advancedPlayers[matchId] || [];
            
            // Create the match with any pre-advanced players
            matches.push({
                id: matchId,
                round: round,
                position: matchPosition,
                player1: preAdvancedPlayers[0] || null,
                player2: preAdvancedPlayers[1] || null,
                winner: null,
                scores: {},
                status: "pending",
                nextMatchId: nextMatchId
            });
        }
    }
    
    // Process second level of byes - matches where both players have been pre-advanced
    const autoAdvanceMatches = matches.filter(match => 
        match.round > 1 && match.player1 && match.player2 && match.status === "pending"
    );
    
    // Note: We'd generally let these run normally, but if you want to auto-advance a certain scenario,
    // you can add that logic here
    
    // Sort matches by round and position
    matches.sort((a, b) => {
        if (a.round !== b.round) {
            return a.round - b.round;
        }
        return a.position - b.position;
    });
    
    return {
        rounds: rounds,
        matches: matches
    };
}

// Create balanced seeds for the bracket (improved algorithm)
function createBalancedSeeds(numParticipants, bracketSize) {
    const seeds = [];
    
    // Create seed positions
    for (let i = 0; i < bracketSize; i++) {
        // For each seed position, determine its actual position in the bracket
        // This uses a standard bracket seeding algorithm similar to what Challonge uses
        let actualPosition;
        
        if (i < numParticipants) {
            // This is a real participant
            actualPosition = getBalancedPosition(i + 1, bracketSize);
        } else {
            // This is a bye
            actualPosition = null;
        }
        
        seeds.push({
            seed: i + 1,
            participantIndex: i < numParticipants ? i : null,
            position: actualPosition
        });
    }
    
    return seeds;
}

// Get balanced position for a seed in the bracket
function getBalancedPosition(seed, bracketSize) {
    // Implementation of standard tournament seeding algorithm
    // Maps seeds to positions in a way that balances the bracket
    
    // Start with position 1
    let position = 1;
    let power = 1;
    
    // Find the largest power of 2 less than or equal to the bracket size
    while (power * 2 <= bracketSize) {
        power *= 2;
    }
    
    // Calculate position based on seed using bitwise operations
    // This ensures proper distribution of seeds in the bracket
    for (let i = 1; i < seed; i++) {
        position = (position + power) % (bracketSize + 1);
        if (position === 0) position = bracketSize;
        
        // After each power of 2 seeds, halve the increment
        if (((i + 1) & i) === 0) {
            power /= 2;
        }
    }
    
    return position;
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

// Update match results (IMPROVED)
export async function updateMatchResults(bracketId, matchId, player1Score, player2Score) {
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
                // This depends on whether the current match position is odd or even
                const isEvenPosition = match.position % 2 === 0;
                
                if (isEvenPosition) {
                    // For even positions, winner goes to player2 slot
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
                    // For odd positions, winner goes to player1 slot
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
export {
    generateBracket,
    getTournamentBracket,
    isUserTournamentStaff,
    updateMatchResults
};
