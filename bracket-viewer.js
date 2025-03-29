// bracket-viewer.js - Script para visualizar brackets de torneos

// Referencias a elementos DOM
const tournamentNameEl = document.getElementById('tournament-name');
const tournamentStatusEl = document.getElementById('tournament-status');
const bracketContainer = document.getElementById('bracket-container');
const badgesContainer = document.getElementById('badges-container');
const staffControls = document.getElementById('staff-controls');
const scoreModal = document.getElementById('score-modal');
const closeScoreModalBtn = document.getElementById('close-score-modal');
const cancelScoreBtn = document.getElementById('cancel-score-btn');
const scoreUpdateForm = document.getElementById('score-update-form');

// Variables globales
let bracketData = null;
let currentMatchId = null;
let isUserStaff = false;

// Obtener ID del torneo de la URL
const urlParams = new URLSearchParams(window.location.search);
const tournamentId = urlParams.get('id');

// Inicializar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Inicializando visor de brackets...");
    
    if (!tournamentId) {
        showError("No se ha especificado un ID de torneo válido");
        return;
    }
    
    // Verificar autenticación
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            
            // Actualizar UI con info del usuario
            updateUserProfileUI(user);
            
            // Verificar si el usuario es staff
            isUserStaff = await checkUserIsStaff(user.uid, tournamentId);
            
            if (isUserStaff) {
                staffControls.classList.remove('hidden');
            }
        }
        
        // Cargar datos del bracket (con o sin usuario autenticado)
        await loadBracketData();
        
        // Configurar event listeners
        setupEventListeners();
    });
});

// Actualizar UI con info del usuario
function updateUserProfileUI(user) {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.innerHTML = `
            <div class="flex items-center bg-white rounded-lg px-3 py-1">
                <img src="${user.photoURL || 'dtowin.png'}" alt="${user.displayName || 'Usuario'}" class="w-8 h-8 rounded-full mr-2">
                <span class="text-gray-800 font-medium">${user.displayName || 'Usuario'}</span>
            </div>
        `;
    }
}

// Verificar si el usuario es staff del torneo
async function checkUserIsStaff(uid, tournamentId) {
    try {
        // Lista de administradores fijos
        const adminUIDs = ["dvblFee1ZnVKJNWBOR22tSAsNet2"];
        
        // Si el UID está en la lista de administradores
        if (adminUIDs.includes(uid)) {
            return true;
        }
        
        // Verificar en la base de datos
        const tournamentRef = await db.collection("torneos").doc(tournamentId).get();
        
        if (!tournamentRef.exists) {
            return false;
        }
        
        const tournamentData = tournamentRef.data();
        
        // Si el usuario es el creador del torneo
        if (tournamentData.createdBy === uid) {
            return true;
        }
        
        // Verificar en lista de staff del torneo
        if (tournamentData.staff && tournamentData.staff.includes(uid)) {
            return true;
        }
        
        // Verificar si es un usuario con rol host
        const userQuery = await db.collection("usuarios")
            .where("uid", "==", uid)
            .where("isHost", "==", true)
            .get();
        
        return !userQuery.empty;
    } catch (error) {
        console.error("Error al verificar si el usuario es staff:", error);
        return false;
    }
}

// Cargar datos del bracket
async function loadBracketData() {
    try {
        // Mostrar estado de carga
        bracketContainer.innerHTML = `
            <div class="py-12 flex justify-center">
                <div class="spinner w-12 h-12 border-t-4 border-b-4 border-blue-500 rounded-full"></div>
            </div>
        `;
        
        // Obtener datos del torneo
        const tournamentRef = await db.collection("torneos").doc(tournamentId).get();
        
        if (!tournamentRef.exists) {
            showError("El torneo no existe");
            return;
        }
        
        const tournamentData = tournamentRef.data();
        
        // Actualizar nombre y estado del torneo
        tournamentNameEl.textContent = tournamentData.nombre || "Torneo sin nombre";
        tournamentStatusEl.textContent = tournamentData.estado || "";
        
        // Verificar si el torneo tiene un bracket
        if (!tournamentData.bracketId) {
            // Mostrar mensaje de que no hay bracket
            bracketContainer.innerHTML = `
                <div class="p-8 text-center">
                    <p class="text-gray-600 mb-4">Este torneo aún no tiene un bracket generado.</p>
                    ${isUserStaff ? `
                        <button id="generate-bracket-btn" class="dtowin-blue text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition">
                            Generar Bracket
                        </button>
                    ` : `
                        <p class="text-sm text-gray-500">El bracket se generará cuando el torneo comience.</p>
                    `}
                </div>
            `;
            
            // Configurar botón para generar bracket si el usuario es staff
            if (isUserStaff) {
                const generateBracketBtn = document.getElementById('generate-bracket-btn');
                if (generateBracketBtn) {
                    generateBracketBtn.addEventListener('click', () => generateBracket(tournamentId));
                }
            }
            
            return;
        }
        
        // Obtener datos del bracket
        const bracketRef = await db.collection("brackets").doc(tournamentData.bracketId).get();
        
        if (!bracketRef.exists) {
            showError("El bracket no existe");
            return;
        }
        
        bracketData = {
            id: bracketRef.id,
            ...bracketRef.data()
        };
        
        // Renderizar bracket
        renderBracket(bracketData);
        
        // Cargar badges del torneo
        loadTournamentBadges(tournamentId);
        
    } catch (error) {
        console.error("Error al cargar datos del bracket:", error);
        showError("Error al cargar datos del bracket: " + error.message);
    }
}

// Renderizar bracket
function renderBracket(data) {
    if (!data || !data.rounds || !data.matches) {
        bracketContainer.innerHTML = `
            <div class="p-8 text-center">
                <p class="text-gray-600">El bracket no tiene datos válidos</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="bracket">';
    
    // Generar rondas
    data.rounds.forEach(round => {
        // Filtrar partidos para esta ronda
        const roundMatches = data.matches.filter(match => match.round === round.round);
        
        html += `
            <div class="round">
                <div class="round-title">${round.name}</div>
                <div class="matches">
        `;
        
        // Generar partidos
        roundMatches.forEach((match, index) => {
            const player1 = match.player1 || { name: "TBD", id: null };
            const player2 = match.player2 || { name: "TBD", id: null };
            
            const matchCompleted = match.status === 'completed';
            const player1Winner = matchCompleted && match.winner && player1.id === match.winner.id;
            const player2Winner = matchCompleted && match.winner && player2.id === match.winner.id;
            
            // Crear elemento de partido
            html += `<div class="match" data-match-id="${match.id}">`;
            
            // Jugador 1
            html += `
                <div class="player ${player1Winner ? 'winner' : player1Winner === false && matchCompleted ? 'loser' : ''}">
                    <div class="player-name">${player1.name}</div>
                    <div class="player-score ${player1Winner ? 'winner' : player1Winner === false && matchCompleted ? 'loser' : ''}">
                        ${matchCompleted && match.scores ? match.scores.player1 || 0 : ''}
                    </div>
                    ${player1.discord ? `<div class="discord-tooltip">Discord: ${player1.discord}</div>` : ''}
                </div>
            `;
            
            // Jugador 2
            html += `
                <div class="player ${player2Winner ? 'winner' : player2Winner === false && matchCompleted ? 'loser' : ''}">
                    <div class="player-name">${player2.name}</div>
                    <div class="player-score ${player2Winner ? 'winner' : player2Winner === false && matchCompleted ? 'loser' : ''}">
                        ${matchCompleted && match.scores ? match.scores.player2 || 0 : ''}
                    </div>
                    ${player2.discord ? `<div class="discord-tooltip">Discord: ${player2.discord}</div>` : ''}
                </div>
            `;
            
            // Conector con siguiente partido
            if (match.nextMatchId) {
                html += '<div class="match-connector"></div>';
            }
            
            html += '</div>';
            
            // Añadir espaciadores entre partidos si es necesario
            if (index < roundMatches.length - 1) {
                const spacersNeeded = Math.pow(2, round.round - 1) - 1;
                for (let i = 0; i < spacersNeeded; i++) {
                    html += '<div class="match-spacer"></div>';
                }
            }
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    bracketContainer.innerHTML = html;
    
    // Añadir event listeners para actualizar resultados si el usuario es staff
    if (isUserStaff) {
        document.querySelectorAll('.match').forEach(matchEl => {
            matchEl.addEventListener('click', (e) => {
                const matchId = matchEl.dataset.matchId;
                const match = data.matches.find(m => m.id === matchId);
                
                if (match && match.player1 && match.player2) {
                    openScoreModal(match);
                } else {
                    window.mostrarNotificacion("No se puede actualizar este partido todavía", "warning");
                }
            });
        });
    }
}

// Abrir modal para actualizar puntaje
function openScoreModal(match) {
    currentMatchId = match.id;
    
    // Actualizar info en el modal
    document.getElementById('match-id').value = match.id;
    document.getElementById('match-info').textContent = `${match.player1.name} vs ${match.player2.name}`;
    document.getElementById('player1-label').textContent = match.player1.name;
    document.getElementById('player2-label').textContent = match.player2.name;
    
    // Pre-llenar puntajes si ya existen
    const player1ScoreInput = document.getElementById('player1-score');
    const player2ScoreInput = document.getElementById('player2-score');
    
    if (match.scores && match.scores.player1 !== undefined) {
        player1ScoreInput.value = match.scores.player1;
    } else {
        player1ScoreInput.value = '';
    }
    
    if (match.scores && match.scores.player2 !== undefined) {
        player2ScoreInput.value = match.scores.player2;
    } else {
        player2ScoreInput.value = '';
    }
    
    // Limpiar mensaje de error
    document.getElementById('score-error-msg').textContent = '';
    
    // Mostrar modal
    scoreModal.classList.remove('hidden');
    scoreModal.classList.add('flex');
}

// Cerrar modal de puntaje
function closeScoreModal() {
    scoreModal.classList.add('hidden');
    scoreModal.classList.remove('flex');
    currentMatchId = null;
}

// Configurar event listeners
function setupEventListeners() {
    // Botones del modal de puntaje
    closeScoreModalBtn.addEventListener('click', closeScoreModal);
    cancelScoreBtn.addEventListener('click', closeScoreModal);
    
    // Formulario de actualización de puntaje
    scoreUpdateForm.addEventListener('submit', handleScoreUpdate);
    
    // Botón de actualizar bracket
    const updateBracketBtn = document.getElementById('update-bracket-btn');
    if (updateBracketBtn) {
        updateBracketBtn.addEventListener('click', loadBracketData);
    }
    
    // Menú móvil
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            if (mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.remove('hidden');
                mobileMenuBtn.innerHTML = '<i class="fas fa-times"></i>';
            } else {
                mobileMenu.classList.add('hidden');
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            }
        });
    }
}

// Manejar actualización de puntaje
async function handleScoreUpdate(e) {
    e.preventDefault();
    
    try {
        if (!currentMatchId || !bracketData) {
            throw new Error("No hay partido seleccionado");
        }
        
        // Obtener puntajes
        const player1Score = parseInt(document.getElementById('player1-score').value);
        const player2Score = parseInt(document.getElementById('player2-score').value);
        
        // Validar puntajes
        if (isNaN(player1Score) || isNaN(player2Score)) {
            throw new Error("Los puntajes deben ser números válidos");
        }
        
        if (player1Score < 0 || player2Score < 0) {
            throw new Error("Los puntajes no pueden ser negativos");
        }
        
        if (player1Score === player2Score) {
            throw new Error("Los puntajes no pueden ser iguales, debe haber un ganador");
        }
        
        // Mostrar estado de carga
        const submitBtn = document.getElementById('submit-score-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
        
        // Encontrar el partido a actualizar
        const match = bracketData.matches.find(m => m.id === currentMatchId);
        
        // Determinar ganador
        const winnerId = player1Score > player2Score ? match.player1.id : match.player2.id;
        const winnerName = player1Score > player2Score ? match.player1.name : match.player2.name;
        const winnerInfo = player1Score > player2Score ? match.player1 : match.player2;
        
        // Actualizar partido
        match.status = 'completed';
        match.scores = {
            player1: player1Score,
            player2: player2Score
        };
        match.winner = winnerInfo;
        
        // Actualizar partido siguiente si existe
        if (match.nextMatchId) {
            const nextMatch = bracketData.matches.find(m => m.id === match.nextMatchId);
            
            if (nextMatch) {
                // Determinar si el ganador va a la posición 1 o 2 del siguiente partido
                const isPlayer1Slot = match.position % 2 !== 0;
                
                if (isPlayer1Slot) {
                    nextMatch.player1 = {
                        ...winnerInfo
                    };
                } else {
                    nextMatch.player2 = {
                        ...winnerInfo
                    };
                }
            }
        }
        
        // Guardar cambios en la base de datos
        await db.collection("brackets").doc(bracketData.id).update({
            matches: bracketData.matches,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Si es el partido final, actualizar el ganador del torneo
        const isFinalMatch = !match.nextMatchId;
        if (isFinalMatch) {
            await db.collection("torneos").doc(tournamentId).update({
                ganador: winnerId,
                estado: 'Finalizado',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Cerrar modal
        closeScoreModal();
        
        // Mostrar mensaje de éxito
        window.mostrarNotificacion("Resultado actualizado correctamente", "success");
        
        // Volver a cargar datos
        await loadBracketData();
        
    } catch (error) {
        console.error("Error al actualizar puntaje:", error);
        document.getElementById('score-error-msg').textContent = error.message;
    } finally {
        // Restaurar botón
        const submitBtn = document.getElementById('submit-score-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Guardar Resultado";
        }
    }
}

// Cargar badges del torneo
async function loadTournamentBadges(tournamentId) {
    try {
        badgesContainer.innerHTML = '<div class="spinner w-6 h-6 border-t-2 border-b-2 border-blue-500 rounded-full"></div>';
        
        // Obtener badges asignados al torneo
        const badgesQuery = await db.collection("tournament_badges")
            .where("tournamentId", "==", tournamentId)
            .get();
        
        if (badgesQuery.empty) {
            badgesContainer.innerHTML = '<p class="text-gray-500">No hay badges asignados a este torneo</p>';
            return;
        }
        
        // Almacenar promesas para cargar detalles de cada badge
        const badgePromises = [];
        const badges = [];
        
        badgesQuery.forEach(badgeDoc => {
            const badgeData = badgeDoc.data();
            
            // Obtener detalles del badge
            badgePromises.push(
                db.collection("badges").doc(badgeData.badgeId).get()
                    .then(badgeRef => {
                        if (badgeRef.exists) {
                            badges.push({
                                position: badgeData.position,
                                badge: {
                                    id: badgeRef.id,
                                    ...badgeRef.data()
                                }
                            });
                        }
                    })
            );
        });
        
        // Esperar a que se carguen todos los badges
        await Promise.all(badgePromises);
        
        // Renderizar badges
        renderBadges(badges);
        
    } catch (error) {
        console.error("Error al cargar badges del torneo:", error);
        badgesContainer.innerHTML = '<p class="text-red-500">Error al cargar badges</p>';
    }
}

// Renderizar badges
function renderBadges(badges) {
    if (!badges || badges.length === 0) {
        badgesContainer.innerHTML = '<p class="text-gray-500">No hay badges asignados a este torneo</p>';
        return;
    }
    
    let html = '';
    
    badges.forEach(badgeItem => {
        const badge = badgeItem.badge;
        let positionText = '';
        
        switch (badgeItem.position) {
            case 'first':
                positionText = 'Primer lugar';
                break;
            case 'second':
                positionText = 'Segundo lugar';
                break;
            case 'top3':
                positionText = 'Top 3';
                break;
            case 'all':
                positionText = 'Todos los participantes';
                break;
            default:
                positionText = 'Premio';
        }
        
        html += `
            <div class="flex flex-col items-center p-3 border rounded-lg">
                <div class="mb-2">
                    ${badge.imageUrl ? 
                        `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-16 h-16 object-contain">` : 
                        `<div class="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl" style="background-color: ${badge.color || '#ff6b1a'}">
                            <i class="fas fa-${badge.icono || 'trophy'}"></i>
                        </div>`
                    }
                </div>
                <div class="text-center">
                    <p class="font-semibold">${badge.nombre}</p>
                    <p class="text-xs text-gray-600">${positionText}</p>
                </div>
            </div>
        `;
    });
    
    badgesContainer.innerHTML = html;
}

// Generar bracket para un torneo
async function generateBracket(tournamentId) {
    try {
        if (!confirm("¿Estás seguro de generar un nuevo bracket para este torneo? Esta acción no se puede deshacer.")) {
            return;
        }
        
        // Mostrar estado de carga
        bracketContainer.innerHTML = `
            <div class="py-12 flex justify-center">
                <div class="spinner w-12 h-12 border-t-4 border-b-4 border-blue-500 rounded-full"></div>
                <p class="text-gray-600 ml-4">Generando bracket...</p>
            </div>
        `;
        
        // Obtener datos del torneo
        const tournamentRef = await db.collection("torneos").doc(tournamentId).get();
        
        if (!tournamentRef.exists) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentRef.data();
        
        // Verificar que el torneo tenga participantes
        const participants = tournamentData.participants || [];
        
        if (participants.length < 2) {
            throw new Error("Se necesitan al menos 2 participantes para generar un bracket");
        }
        
        // Obtener información de participantes
        const participantInfoRef = await db.collection("participant_info")
            .where("tournamentId", "==", tournamentId)
            .get();
        
        // Mapear información de participantes
        const participantsInfo = {};
        participantInfoRef.forEach(doc => {
            const data = doc.data();
            participantsInfo[data.userId] = {
                playerName: data.playerName,
                discordUsername: data.discordUsername
            };
        });
        
        // Crear estructura del bracket
        const rounds = [];
        const numParticipants = participants.length;
        const numRounds = Math.ceil(Math.log2(numParticipants));
        
        // Definir rondas
        for (let i = 1; i <= numRounds; i++) {
            rounds.push({
                round: i,
                name: `Ronda ${i}`
            });
        }
        
        // Mezclar participantes para seeding aleatorio
        const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
        
        // Crear partidos de primera ronda y determinar byes
        const matches = [];
        const firstRoundMatchCount = Math.ceil(numParticipants / 2);
        const byeCount = firstRoundMatchCount * 2 - numParticipants;
        
        // Participantes con partidos en primera ronda
        const playersWithMatches = shuffledParticipants.slice(0, numParticipants - byeCount);
        
        // Participantes con bye (pasan directamente a segunda ronda)
        const playersWithByes = shuffledParticipants.slice(numParticipants - byeCount);
        
        // Crear partidos de primera ronda
        for (let i = 0; i < playersWithMatches.length; i += 2) {
            if (i + 1 < playersWithMatches.length) {
                matches.push({
                    id: `1-${i/2 + 1}`,
                    round: 1,
                    position: i/2 + 1,
                    player1: {
                        id: playersWithMatches[i],
                        name: participantsInfo[playersWithMatches[i]]?.playerName || "Jugador",
                        discord: participantsInfo[playersWithMatches[i]]?.discordUsername
                    },
                    player2: {
                        id: playersWithMatches[i + 1],
                        name: participantsInfo[playersWithMatches[i + 1]]?.playerName || "Jugador",
                        discord: participantsInfo[playersWithMatches[i + 1]]?.discordUsername
                    },
                    status: "pending",
                    nextMatchId: `2-${Math.ceil((i/2 + 1) / 2)}`
                });
            }
        }
        
        // Crear partidos de rondas subsiguientes
        let matchesInCurrentRound = firstRoundMatchCount;
        
        for (let round = 2; round <= numRounds; round++) {
            matchesInCurrentRound = Math.ceil(matchesInCurrentRound / 2);
            
            for (let position = 1; position <= matchesInCurrentRound; position++) {
                // Determinar si hay un jugador con bye para esta posición en ronda 2
                let player1 = null;
                
                if (round === 2 && position <= playersWithByes.length) {
                    const byePlayer = playersWithByes[position - 1];
                    player1 = {
                        id: byePlayer,
                        name: participantsInfo[byePlayer]?.playerName || "Jugador",
                        discord: participantsInfo[byePlayer]?.discordUsername
                    };
                }
                
                matches.push({
                    id: `${round}-${position}`,
                    round: round,
                    position: position,
                    player1: player1,
                    player2: null,
                    status: "pending",
                    nextMatchId: round < numRounds ? `${round+1}-${Math.ceil(position/2)}` : null
                });
            }
        }
        
        // Crear documento del bracket
        const bracketRef = await db.collection("brackets").add({
            tournamentId: tournamentId,
            name: tournamentData.nombre,
            rounds: rounds,
            matches: matches,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: "active"
        });
        
        // Actualizar torneo con referencia al bracket y cambiar estado a "En Progreso"
        await db.collection("torneos").doc(tournamentId).update({
            bracketId: bracketRef.id,
            estado: "En Progreso",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Mostrar mensaje de éxito
        window.mostrarNotificacion("Bracket generado correctamente", "success");
        
        // Recargar datos
        await loadBracketData();
        
    } catch (error) {
        console.error("Error al generar bracket:", error);
        showError("Error al generar bracket: " + error.message);
    }
}

// Mostrar mensaje de error
function showError(message) {
    bracketContainer.innerHTML = `
        <div class="p-8 text-center">
            <p class="text-red-500 mb-4">${message}</p>
            <button class="dtowin-blue text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition" onclick="window.location.reload()">
                Reintentar
            </button>
        </div>
    `;
    
    window.mostrarNotificacion(message, "error");
}
