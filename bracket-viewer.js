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

// Modal de añadir participante
const addParticipantModal = document.getElementById('add-participant-modal');
const closeAddParticipantModalBtn = document.getElementById('close-add-participant-modal');
const addParticipantForm = document.getElementById('add-participant-form');

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
                
                // Añadir controles adicionales para staff
                await addStaffControls();
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

// Añadir controles adicionales para staff
async function addStaffControls() {
    if (!staffControls) return;
    
    // Obtener referencias a funciones desde module
    const { resetTournamentBracket, addParticipantManually } = await import('./brackets.js');
    
    // Verificar estado del torneo
    const tournamentRef = await db.collection("torneos").doc(tournamentId).get();
    const tournamentData = tournamentRef.data();
    const tournamentState = tournamentData?.estado || '';
    
    // Añadir controles para administradores
    staffControls.innerHTML += `
        <div class="space-y-3 mt-4">
            <button id="add-participant-btn" class="w-full bg-blue-500 text-white px-3 py-2 rounded-lg font-semibold hover:bg-blue-600 transition">
                <i class="fas fa-user-plus mr-2"></i> Añadir Participante
            </button>
            
            <button id="reset-bracket-btn" class="w-full bg-red-500 text-white px-3 py-2 rounded-lg font-semibold hover:bg-red-600 transition">
                <i class="fas fa-redo-alt mr-2"></i> Reiniciar Bracket
            </button>
        </div>
    `;
    
    // Configurar listeners para los nuevos botones
    setupStaffControlListeners();
}

// Configurar listeners para controles de staff
function setupStaffControlListeners() {
    const addParticipantBtn = document.getElementById('add-participant-btn');
    const resetBracketBtn = document.getElementById('reset-bracket-btn');
    
    if (addParticipantBtn) {
        addParticipantBtn.addEventListener('click', showAddParticipantModal);
    }
    
    if (resetBracketBtn) {
        resetBracketBtn.addEventListener('click', confirmResetBracket);
    }
}

// Mostrar modal para añadir participante
function showAddParticipantModal() {
    // Crear modal si no existe
    if (!document.getElementById('add-participant-modal')) {
        createAddParticipantModal();
    }
    
    // Mostrar modal
    const modal = document.getElementById('add-participant-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Limpiar formulario
    const form = document.getElementById('add-participant-form');
    if (form) form.reset();
    
    // Limpiar mensajes de error
    const errorMsg = document.getElementById('add-participant-error');
    if (errorMsg) errorMsg.textContent = '';
}

// Crear modal para añadir participante
function createAddParticipantModal() {
    const modalHTML = `
        <div id="add-participant-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center p-4 z-50">
            <div class="bg-white rounded-xl max-w-md w-full p-6 relative">
                <button id="close-add-participant-modal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
                <div class="text-center mb-6">
                    <h3 class="text-2xl font-bold text-gray-800">Añadir Participante</h3>
                    <p class="text-gray-600">Añade un nuevo participante al torneo</p>
                    <p id="add-participant-error" class="text-red-500 mt-2 text-sm"></p>
                </div>
                
                <form id="add-participant-form">
                    <div class="mb-4">
                        <label for="manual-player-name" class="block text-gray-700 text-sm font-bold mb-2">Nombre de Jugador *</label>
                        <input type="text" id="manual-player-name" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Nombre que usará en el torneo" required>
                    </div>
                    
                    <div class="mb-4">
                        <label for="manual-player-email" class="block text-gray-700 text-sm font-bold mb-2">Correo Electrónico *</label>
                        <input type="email" id="manual-player-email" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="ejemplo@gmail.com" required>
                        <p class="text-xs text-gray-500 mt-1">Necesario para vincularlo con una cuenta</p>
                    </div>
                    
                    <div class="mb-6">
                        <label for="manual-discord-username" class="block text-gray-700 text-sm font-bold mb-2">Discord (opcional)</label>
                        <input type="text" id="manual-discord-username" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Usuario de Discord">
                    </div>
                    
                    <div class="flex items-center justify-end">
                        <button type="button" id="cancel-add-participant-btn" class="text-gray-600 mr-4 hover:text-gray-800">
                            Cancelar
                        </button>
                        <button type="submit" id="submit-add-participant-btn" class="dtowin-blue text-white py-2 px-6 rounded-lg hover:opacity-90 transition font-semibold">
                            Añadir Participante
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Añadir al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Configurar event listeners
    const modal = document.getElementById('add-participant-modal');
    const closeBtn = document.getElementById('close-add-participant-modal');
    const cancelBtn = document.getElementById('cancel-add-participant-btn');
    const form = document.getElementById('add-participant-form');
    
    // Cerrar modal
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
    
    cancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
    
    // Manejar envío del formulario
    form.addEventListener('submit', handleAddParticipant);
}

// Manejar envío del formulario de añadir participante
async function handleAddParticipant(e) {
    e.preventDefault();
    
    // Obtener valores del formulario
    const playerName = document.getElementById('manual-player-name').value.trim();
    const playerEmail = document.getElementById('manual-player-email').value.trim();
    const discordUsername = document.getElementById('manual-discord-username').value.trim();
    const errorMsg = document.getElementById('add-participant-error');
    const submitBtn = document.getElementById('submit-add-participant-btn');
    
    // Validar campos
    if (!playerName || !playerEmail) {
        errorMsg.textContent = "El nombre y correo electrónico son obligatorios";
        return;
    }
    
    // Mostrar estado de carga
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
    
    try {
        // Importar función desde módulo de brackets
        const { addParticipantManually } = await import('./brackets.js');
        
        // Añadir participante
        await addParticipantManually(tournamentId, playerName, discordUsername, playerEmail);
        
        // Cerrar modal
        const modal = document.getElementById('add-participant-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        
        // Mostrar mensaje de éxito
        window.mostrarNotificacion("Participante añadido correctamente", "success");
        
        // Recargar datos del bracket
        await loadBracketData();
        
    } catch (error) {
        console.error("Error al añadir participante:", error);
        errorMsg.textContent = error.message || "Error al añadir participante";
    } finally {
        // Restaurar botón
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Añadir Participante';
    }
}

// Confirmar reinicio del bracket
function confirmResetBracket() {
    if (confirm("¿Estás seguro de reiniciar el bracket? Esta acción generará un nuevo bracket con los participantes que hicieron check-in. Los resultados actuales se perderán.")) {
        resetBracket();
    }
}

// Reiniciar bracket
async function resetBracket() {
    try {
        // Mostrar estado de carga
        bracketContainer.innerHTML = `
            <div class="py-12 flex justify-center">
                <div class="spinner w-12 h-12 border-t-4 border-b-4 border-blue-500 rounded-full mr-3"></div>
                <p class="text-gray-600">Reiniciando bracket...</p>
            </div>
        `;
        
        // Importar función desde módulo de brackets
        const { resetTournamentBracket } = await import('./brackets.js');
        
        // Reiniciar bracket
        await resetTournamentBracket(tournamentId);
        
        // Mostrar mensaje de éxito
        window.mostrarNotificacion("Bracket reiniciado correctamente", "success");
        
        // Recargar datos del bracket
        await loadBracketData();
        
    } catch (error) {
        console.error("Error al reiniciar bracket:", error);
        showError("Error al reiniciar bracket: " + error.message);
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
            // Configurar botón para generar bracket si el usuario es staff
            if (isUserStaff) {
                const generateBracketBtn = document.getElementById('generate-bracket-btn');
                if (generateBracketBtn) {
                    generateBracketBtn.addEventListener('click', async () => {
                        try {
                            const { resetTournamentBracket } = await import('./brackets.js');
                            if (confirm("¿Quieres generar un nuevo bracket? Esto reemplazará cualquier bracket existente.")) {
                                await resetTournamentBracket(tournamentId);
                                window.mostrarNotificacion("Bracket generado correctamente", "success");
                                await loadBracketData();
                            }
                        } catch (error) {
                            console.error("Error al generar bracket:", error);
                            showError("Error al generar bracket: " + error.message);
                        }
                    });
                }
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
                
                // Si el partido es ganador, destacar el conector
                if (match.winner) {
                    connector.classList.add('winner-path');
                }
                
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
        
        // Importar función de actualización
        const { updateMatchResults } = await import('./brackets.js');
        
        // Actualizar resultados
        await updateMatchResults(bracketData.id, currentMatchId, player1Score, player2Score);
        
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
        
        // Importar función para generar bracket
        const { generateBracket } = await import('./brackets.js');
        
        // Generar bracket
        await generateBracket(tournamentId);
        
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
