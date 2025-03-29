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

// Renderizar bracket con mejoras en la visualización
function renderBracket(data) {
    if (!data || !data.rounds || !data.matches) {
        bracketContainer.innerHTML = `
            <div class="p-8 text-center">
                <p class="text-gray-600">El bracket no tiene datos válidos</p>
            </div>
        `;
        return;
    }
    
    // Crear un contenedor para el bracket con scroll horizontal
    let html = '<div class="bracket-wrapper">';
    html += '<div class="bracket">';
    
    // Organizar partidos por ronda
    const matchesByRound = {};
    data.rounds.forEach(round => {
        matchesByRound[round.round] = data.matches.filter(match => match.round === round.round)
            .sort((a, b) => a.position - b.position);
    });
    
    // Calcular la altura máxima necesaria para cada ronda
    const totalRounds = data.rounds.length;
    
    // Generar rondas
    data.rounds.forEach(round => {
        const roundMatches = matchesByRound[round.round];
        
        html += `
            <div class="round">
                <div class="round-title">${round.name}</div>
                <div class="matches">
        `;
        
        // Calcular espacio necesario entre partidos para esta ronda
        const matchGap = Math.pow(2, round.round - 1);
        
        // Generar partidos para esta ronda
        roundMatches.forEach((match, index) => {
            const player1 = match.player1 || { name: "TBD", id: null };
            const player2 = match.player2 || { name: "TBD", id: null };
            
            const matchCompleted = match.status === 'completed';
            const player1Winner = matchCompleted && match.winner && player1.id === match.winner.id;
            const player2Winner = matchCompleted && match.winner && player2.id === match.winner.id;
            
            // Crear contenedor para este partido
            html += `<div class="match" data-match-id="${match.id}" data-position="${match.position}" data-round="${match.round}">`;
            
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
            
            // Añadir conector con siguiente partido si existe
            if (match.nextMatchId) {
                html += '<div class="match-connector"></div>';
            }
            
            html += '</div>';
            
            // Añadir espaciadores entre partidos según la ronda
            if (index < roundMatches.length - 1) {
                for (let i = 0; i < matchGap - 1; i++) {
                    html += '<div class="match-spacer"></div>';
                }
            }
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    html += '</div>'; // Cierre de bracket
    html += '</div>'; // Cierre de bracket-wrapper
    
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
    
    // Añadir líneas conectoras entre rondas
    addConnectorLines();
}

// Función para añadir líneas conectoras entre partidos
function addConnectorLines() {
    if (!bracketData || !bracketData.matches) return;
    
    // Para cada partido excepto los de la última ronda
    bracketData.matches.forEach(match => {
        if (match.nextMatchId) {
            // Buscar elementos DOM
            const currentMatchEl = document.querySelector(`.match[data-match-id="${match.id}"]`);
            const nextMatchEl = document.querySelector(`.match[data-match-id="${match.nextMatchId}"]`);
            
            if (currentMatchEl && nextMatchEl) {
                // Crear línea conectora
                const connector = document.createElement('div');
                connector.className = 'bracket-connector';
                
                // Determinar posición de la línea
                const currentRect = currentMatchEl.getBoundingClientRect();
                const nextRect = nextMatchEl.getBoundingClientRect();
                const bracketRect = document.querySelector('.bracket').getBoundingClientRect();
                
                // Calcular posiciones relativas al contenedor del bracket
                const startX = currentRect.right - bracketRect.left;
                const startY = currentRect.top + (currentRect.height / 2) - bracketRect.top;
                const endX = nextRect.left - bracketRect.left;
                const endY = nextRect.top + (nextRect.height / 2) - bracketRect.top;
                
                // Determinar si este partido va a la entrada superior o inferior del siguiente
                const isOddPosition = match.position % 2 !== 0;
                const connectorClass = isOddPosition ? 'connector-top' : 'connector-bottom';
                
                // Aplicar clase para estilo
                connector.classList.add(connectorClass);
                
                // Establecer posición y tamaño
                connector.style.left = `${startX}px`;
                connector.style.top = `${startY}px`;
                connector.style.width = `${endX - startX}px`;
                connector.style.height = `${Math.abs(endY - startY)}px`;
                
                // Añadir conector al DOM
                document.querySelector('.bracket').appendChild(connector);
            }
        }
    });
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
    
    // Añadir listener para redimensionamiento de ventana
    window.addEventListener('resize', debounce(addConnectorLines, 100));
}

// Función debounce para optimizar eventos frecuentes
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
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
        const isPlayer1Winner = player1Score > player2Score;
        const winnerId = isPlayer1Winner ? match.player1.id : match.player2.id;
        const winnerName = isPlayer1Winner ? match.player1.name : match.player2.name;
        const winnerInfo = isPlayer1Winner ? match.player1 : match.player2;
        
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
                // Este cálculo depende de si la posición es par o impar
                const isOddPosition = match.position % 2 !== 0;
                
                if (isOddPosition) {
                    // Las posiciones impares van al jugador 1 del siguiente partido
                    nextMatch.player1 = {
                        ...winnerInfo
                    };
                } else {
                    // Las posiciones pares van al jugador 2 del siguiente partido
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
                name: getRoundName(i, numRounds)
            });
        }
        
        // Mezclar participantes para seeding aleatorio
        const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
        
        // Llamar a las funciones de brackets.js para generar el bracket balanceado
        const bracketData = createBalancedBracketStructure(shuffledParticipants, numParticipants, numRounds, participantsInfo);
        
        // Guardar bracket en la base de datos
        const bracketsRef = await db.collection("brackets").add({
            tournamentId: tournamentId,
            name: tournamentData.nombre || "Tournament Bracket",
            rounds: bracketData.rounds,
            matches: bracketData.matches,
            participants: participants.length,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: "active",
            createdBy: auth.currentUser ? auth.currentUser.uid : null
        });
        
        // Actualizar torneo con referencia al bracket
        await db.collection("torneos").doc(tournamentId).update({
            bracketId: bracketsRef.id,
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

// Función auxiliar para crear una estructura balanceada de bracket
function createBalancedBracketStructure(participants, numParticipants, numRounds, participantsInfo) {
    // Calcular el número perfecto de participantes (siguiente potencia de 2)
    const perfectSize = Math.pow(2, numRounds);
    
    // Crear rondas
    const rounds = [];
    for (let i = 1; i <= numRounds; i++) {
        rounds.push({
            round: i,
            name: getRoundName(i, numRounds),
            matchCount: perfectSize / Math.pow(2, i)
        });
    }
    
    // Crear matches utilizando el algoritmo mejorado
    const matches = [];
    
    // Calcular byes
    const numByes = perfectSize - numParticipants;
    
    // Crear seeding balanceado
    const seeds = [];
    for (let i = 0; i < perfectSize; i++) {
        seeds.push(i < numParticipants ? i : null);
    }
    
    // Distribuir byes de manera óptima
    seeds.sort((a, b) => {
        if (a === null && b === null) return 0;
        if (a === null) return 1;
        if (b === null) return -1;
        return a - b;
    });
    
    // Crear matches de primera ronda
    for (let i = 0; i < perfectSize / 2; i++) {
        const player1Index = seeds[i * 2];
        const player2Index = seeds[i * 2 + 1];
        
        let player1 = null;
        let player2 = null;
        
        if (player1Index !== null) {
            player1 = {
                id: participants[player1Index],
                name: participantsInfo[participants[player1Index]]?.playerName || "TBD",
                discord: participantsInfo[participants[player1Index]]?.discordUsername || null,
                seed: player1Index + 1
            };
        }
        
        if (player2Index !== null) {
            player2 = {
                id: participants[player2Index],
                name: participantsInfo[participants[player2Index]]?.playerName || "TBD",
                discord: participantsInfo[participants[player2Index]]?.discordUsername || null,
                seed: player2Index + 1
            };
        }
        
        const position = i + 1;
        const nextMatchPosition = Math.ceil(position / 2);
        
        matches.push({
            id: `1-${position}`,
            round: 1,
            position: position,
            player1: player1,
            player2: player2,
            winner: null,
            scores: {},
            status: "pending",
            nextMatchId: numRounds > 1 ? `2-${nextMatchPosition}` : null
        });
    }
    
    // Crear matches para las demás rondas
    for (let round = 2; round <= numRounds; round++) {
        const matchesInRound = perfectSize / Math.pow(2, round);
        
        for (let i = 0; i < matchesInRound; i++) {
            const position = i + 1;
            const nextMatchPosition = Math.ceil(position / 2);
            
            matches.push({
                id: `${round}-${position}`,
                round: round,
                position: position,
                player1: null,
                player2: null,
                winner: null,
                scores: {},
                status: "pending",
                nextMatchId: round < numRounds ? `${round + 1}-${nextMatchPosition}` : null
            });
        }
    }
    
    // Auto-avanzar byes
    const byeMatches = matches.filter(match => 
        (match.player1 && !match.player2) || (!match.player1 && match.player2)
    );
    
    // Procesar matches con bye
    byeMatches.forEach(match => {
        const winner = match.player1 || match.player2;
        
        // Marcar match como completado
        match.winner = winner;
        match.status = "completed";
        match.scores = {
            player1: match.player1 ? 1 : 0,
            player2: match.player2 ? 1 : 0
        };
        
        // Avanzar jugador al siguiente match
        if (match.nextMatchId) {
            const nextMatch = matches.find(m => m.id === match.nextMatchId);
            
            if (nextMatch) {
                const isOddPosition = match.position % 2 !== 0;
                
                if (isOddPosition) {
                    nextMatch.player1 = winner;
                } else {
                    nextMatch.player2 = winner;
                }
            }
        }
    });
    
    // Ordenar matches por ronda y posición
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

// Helper function for round names
function getRoundName(roundNumber, totalRounds) {
    if (roundNumber === totalRounds) {
        return "Final";
    } else if (roundNumber === totalRounds - 1) {
        return "Semifinales";
    } else if (roundNumber === totalRounds - 2 && totalRounds > 2) {
        return "Cuartos de Final";
    } else {
        return `Ronda ${roundNumber}`;
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
