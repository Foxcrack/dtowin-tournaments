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
        
        // Get participants
        const participants = tournamentData.participants || [];
        
        if (participants.length < 2) {
            throw new Error("Se necesitan al menos 2 participantes para generar un bracket");
        }
        
        // Check if bracket already exists
        const bracketsRef = collection(db, "brackets");
        const q = query(bracketsRef, where("tournamentId", "==", tournamentId));
        const bracketsSnapshot = await getDocs(q);
        
        if (!bracketsSnapshot.empty) {
            // Bracket already exists
            console.log("Bracket already exists for this tournament");
            return bracketsSnapshot.docs[0].id;
        }
        
        // Get participant info with names
        const participantsInfo = await getTournamentParticipantsInfo(tournamentId);
        
        // Shuffle participants for random seeding
        const shuffledParticipants = shuffleArray([...participants]);
        
        // Generate bracket structure
        const bracketData = createBracketStructure(shuffledParticipants, participantsInfo);
        
        // Save bracket to database
        const newBracketRef = await addDoc(bracketsRef, {
            tournamentId: tournamentId,
            name: tournamentData.nombre || "Tournament Bracket",
            rounds: bracketData.rounds,
            matches: bracketData.matches,
            participants: participants.length,
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
                updatedAt: serverTimestamp()
            });
        } else {
            // Just update the bracketId if tournament is already in progress
            await updateDoc(tournamentRef, {
                bracketId: newBracketRef.id,
                updatedAt: serverTimestamp()
            });
        }
        
        console.log("Bracket generated successfully with ID:", newBracketRef.id);
        return newBracketRef.id;
        
    } catch (error) {
        console.error("Error generating bracket:", error);
        throw error;
    }
}

// Create bracket structure from list of participants
function createBracketStructure(participants, participantsInfo) {
    const numParticipants = participants.length;
    
    // Calculate the number of rounds needed
    const numRounds = Math.ceil(Math.log2(numParticipants));
    const perfectBracketSize = Math.pow(2, numRounds);
    
    // Create rounds array
    const rounds = [];
    for (let i = 1; i <= numRounds; i++) {
        rounds.push({
            round: i,
            name: `Round ${i}`,
            matchCount: perfectBracketSize / Math.pow(2, i)
        });
    }
    
    // Create matches array
    const matches = [];
    
    // First round matches
    const firstRoundMatchCount = Math.ceil(numParticipants / 2);
    const byeCount = firstRoundMatchCount * 2 - numParticipants;
    
    // Determine which players get byes (usually the top seeds)
    // For simplicity, we'll give byes to the last players in our shuffled array
    const playersWithMatches = participants.slice(0, participants.length - byeCount);
    const playersWithByes = participants.slice(participants.length - byeCount);
    
    // Create first round matches
    for (let i = 0; i < playersWithMatches.length; i += 2) {
        if (i + 1 < playersWithMatches.length) {
            // Regular match with two players
            matches.push({
                id: `1-${i/2 + 1}`,
                round: 1,
                position: i/2 + 1,
                player1: {
                    id: playersWithMatches[i],
                    name: participantsInfo[playersWithMatches[i]]?.playerName || "TBD",
                    discord: participantsInfo[playersWithMatches[i]]?.discordUsername || null,
                    seed: i + 1
                },
                player2: {
                    id: playersWithMatches[i + 1],
                    name: participantsInfo[playersWithMatches[i + 1]]?.playerName || "TBD",
                    discord: participantsInfo[playersWithMatches[i + 1]]?.discordUsername || null,
                    seed: i + 2
                },
                winner: null,
                scores: {},
                status: "pending",
                nextMatchId: calculateNextMatchId(1, i/2 + 1, firstRoundMatchCount)
            });
        }
    }
    
    // Create subsequent round matches (empty until winners advance)
    let matchesInCurrentRound = firstRoundMatchCount;
    
    for (let round = 2; round <= numRounds; round++) {
        matchesInCurrentRound = Math.ceil(matchesInCurrentRound / 2);
        
        for (let position = 1; position <= matchesInCurrentRound; position++) {
            // Check if any players have byes and should be placed directly into this round
            // (only applies to round 2)
            let player1 = null;
            let player2 = null;
            
            if (round === 2 && playersWithByes.length > 0) {
                // For each match in round 2, check if we should place a bye player
                const byeIndex = position - 1;
                if (byeIndex < playersWithByes.length) {
                    // Place bye player in position 1 of the match
                    const byePlayer = playersWithByes[byeIndex];
                    player1 = {
                        id: byePlayer,
                        name: participantsInfo[byePlayer]?.playerName || "TBD",
                        discord: participantsInfo[byePlayer]?.discordUsername || null,
                        seed: numParticipants - byeIndex
                    };
                }
            }
            
            matches.push({
                id: `${round}-${position}`,
                round: round,
                position: position,
                player1: player1, // Will be null or a player with a bye
                player2: player2, // Will be null or a player with a bye
                winner: null,
                scores: {},
                status: "pending",
                nextMatchId: round < numRounds ? calculateNextMatchId(round, position, matchesInCurrentRound) : null
            });
        }
    }
    
    return {
        rounds: rounds,
        matches: matches
    };
}

// Calculate the ID of the next match in the bracket
function calculateNextMatchId(currentRound, currentPosition, matchesInCurrentRound) {
    const nextRound = currentRound + 1;
    const nextPosition = Math.ceil(currentPosition / 2);
    
    return `${nextRound}-${nextPosition}`;
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
        const winnerId = player1Score > player2Score ? match.player1.id : match.player2.id;
        const winnerName = player1Score > player2Score ? match.player1.name : match.player2.name;
        const winnerDiscord = player1Score > player2Score ? match.player1.discord : match.player2.discord;
        const winnerSeed = player1Score > player2Score ? match.player1.seed : match.player2.seed;
        
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
                
                // For even positions, winner goes to player2 slot
                // For odd positions, winner goes to player1 slot
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
                    // Award to semifinalists (need to find semifinals matches)
                    // This is more complex and would require tracking all semifinalists
                    // For simplicity, we'll skip this for now
                    break;
                    
                case "all":
                    // Award to all participants
                    const tournamentRef = doc(db, "torneos", tournamentId);
                    const tournamentSnap = await getDoc(tournamentRef);
                    
                    if (tournamentSnap.exists()) {
                        recipientIds = tournamentSnap.data().participants || [];
                    }
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
