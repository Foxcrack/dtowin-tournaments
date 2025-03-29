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
    
    // Determine byes and create the bracket structure
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

// Determine byes and create matches for balanced bracket
function determineByesAndCreateMatches(participants, participantsInfo, numParticipants, perfectBracketSize, numRounds) {
    const matches = [];
    const numByes = perfectBracketSize - numParticipants;
    
    // Distribute byes optimally by calculating positions
    // This creates a better balanced bracket
    const positions = createBalancedPositions(perfectBracketSize, numByes);
    
    // Sort positions
    positions.sort((a, b) => a.seed - b.seed);
    
    // First round matches with proper seeding
    const firstRoundMatches = positions.filter(p => p.round === 1);
    for (let i = 0; i < firstRoundMatches.length; i += 2) {
        if (i + 1 < firstRoundMatches.length) {
            const pos1 = firstRoundMatches[i];
            const pos2 = firstRoundMatches[i + 1];
            
            if (pos1.participantIndex < participants.length && pos2.participantIndex < participants.length) {
                // Both positions have participants (normal match)
                matches.push({
                    id: `1-${(i/2) + 1}`,
                    round: 1,
                    position: (i/2) + 1,
                    player1: {
                        id: participants[pos1.participantIndex],
                        name: participantsInfo[participants[pos1.participantIndex]]?.playerName || "TBD",
                        discord: participantsInfo[participants[pos1.participantIndex]]?.discordUsername || null,
                        seed: pos1.seed
                    },
                    player2: {
                        id: participants[pos2.participantIndex],
                        name: participantsInfo[participants[pos2.participantIndex]]?.playerName || "TBD",
                        discord: participantsInfo[participants[pos2.participantIndex]]?.discordUsername || null,
                        seed: pos2.seed
                    },
                    winner: null,
                    scores: {},
                    status: "pending",
                    nextMatchId: `2-${Math.ceil((i/2 + 1)/2)}`
                });
            }
        }
    }
    
    // Create matches for rounds with byes (participants that don't play first round)
    const advancingPlayers = positions.filter(p => p.round > 1);
    for (let round = 2; round <= numRounds; round++) {
        const roundMatches = Math.pow(2, numRounds - round);
        
        // Matches that are created due to byes
        const byeMatchesThisRound = advancingPlayers.filter(p => p.round === round);
        
        // Create matches from bye entries
        for (let i = 0; i < byeMatchesThisRound.length; i += 2) {
            const pos1 = byeMatchesThisRound[i];
            let pos2 = null;
            
            if (i + 1 < byeMatchesThisRound.length) {
                pos2 = byeMatchesThisRound[i + 1];
            }
            
            const matchId = `${round}-${Math.ceil((pos1.position)/2)}`;
            const nextMatchId = round < numRounds ? `${round+1}-${Math.ceil(pos1.position/4)}` : null;
            
            if (pos2) {
                // Both players from byes
                matches.push({
                    id: matchId,
                    round: round,
                    position: Math.ceil(pos1.position/2),
                    player1: {
                        id: participants[pos1.participantIndex],
                        name: participantsInfo[participants[pos1.participantIndex]]?.playerName || "TBD",
                        discord: participantsInfo[participants[pos1.participantIndex]]?.discordUsername || null,
                        seed: pos1.seed
                    },
                    player2: {
                        id: participants[pos2.participantIndex],
                        name: participantsInfo[participants[pos2.participantIndex]]?.playerName || "TBD",
                        discord: participantsInfo[participants[pos2.participantIndex]]?.discordUsername || null,
                        seed: pos2.seed
                    },
                    winner: null,
                    scores: {},
                    status: "pending",
                    nextMatchId: nextMatchId
                });
            } else {
                // Single player from bye
                matches.push({
                    id: matchId,
                    round: round,
                    position: Math.ceil(pos1.position/2),
                    player1: {
                        id: participants[pos1.participantIndex],
                        name: participantsInfo[participants[pos1.participantIndex]]?.playerName || "TBD",
                        discord: participantsInfo[participants[pos1.participantIndex]]?.discordUsername || null,
                        seed: pos1.seed
                    },
                    player2: null, // Will be determined by previous round
                    winner: null,
                    scores: {},
                    status: "pending",
                    nextMatchId: nextMatchId
                });
            }
        }
        
        // Create additional empty matches for this round if needed
        const byeMatchesCreated = byeMatchesThisRound.length / 2;
        const totalMatchesNeeded = roundMatches;
        const emptyMatchesNeeded = totalMatchesNeeded - byeMatchesCreated;
        
        for (let i = 0; i < emptyMatchesNeeded; i++) {
            const position = byeMatchesCreated + i + 1;
            const matchId = `${round}-${position}`;
            const nextMatchId = round < numRounds ? `${round+1}-${Math.ceil(position/2)}` : null;
            
            matches.push({
                id: matchId,
                round: round,
                position: position,
                player1: null, // Will be determined by previous round
                player2: null, // Will be determined by previous round
                winner: null,
                scores: {},
                status: "pending",
                nextMatchId: nextMatchId
            });
        }
    }
    
    return {
        rounds: rounds,
        matches: matches
    };
}

// Create balanced positions for bracket
function createBalancedPositions(bracketSize, numByes) {
    const positions = [];
    const totalParticipants = bracketSize - numByes;
    
    // Create a position for each seed
    for (let seed = 1; seed <= bracketSize; seed++) {
        // Calculate the initial position in first round (1-indexed)
        let position;
        
        // Use standard bracket positioning (1 vs last, 2 vs second-to-last, etc.)
        if (seed % 2 === 1) {
            position = Math.ceil(seed / 2);
        } else {
            position = bracketSize / 2 + Math.ceil(seed / 2);
        }
        
        // Determine if this position gets a bye
        let round = 1;
        let participantIndex = seed - 1;
        
        // If this seed is beyond our actual participants, it's a bye
        if (seed > totalParticipants) {
            participantIndex = null; // No participant
        }
        
        // Create the position object
        positions.push({
            seed,
            position,
            round,
            participantIndex
        });
    }
    
    // Return sorted by position
    return positions.sort((a, b) => a.position - b.position);
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

// Update match results
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
export {
    generateBracket,
    getTournamentBracket,
    isUserTournamentStaff,
    updateMatchResults
};
