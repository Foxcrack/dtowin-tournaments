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
            
            <button id="manage-participants-btn" class="w-full bg-yellow-500 text-white px-3 py-2 rounded-lg font-semibold hover:bg-yellow-600 transition">
                <i class="fas fa-users-cog mr-2"></i> Administrar Participantes
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
    const manageParticipantsBtn = document.getElementById('manage-participants-btn');
    
    if (addParticipantBtn) {
        addParticipantBtn.addEventListener('click', showAddParticipantModal);
    }
    
    if (resetBracketBtn) {
        resetBracketBtn.addEventListener('click', confirmResetBracket);
    }
    
    if (manageParticipantsBtn) {
        manageParticipantsBtn.addEventListener('click', showParticipantManager);
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

// Crear modal para gestionar participantes
function createParticipantManagerModal() {
    const modalHTML = `
        <div id="participant-manager-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center p-4 z-50">
            <div class="bg-white rounded-xl max-w-2xl w-full p-6 relative max-h-screen overflow-hidden flex flex-col">
                <button id="close-participant-manager" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
                <div class="text-center mb-4">
                    <h3 class="text-2xl font-bold text-gray-800">Administrar Participantes</h3>
                    <p class="text-gray-600">Añade o elimina participantes del torneo</p>
                    <p id="participant-manager-error" class="text-red-500 mt-2 text-sm"></p>
                </div>
                
                <div class="flex justify-end mb-4">
                    <button id="add-new-participant-btn" class="dtowin-blue text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition">
                        <i class="fas fa-user-plus mr-2"></i> Añadir Participante
                    </button>
                </div>
                
                <div class="flex-1 overflow-y-auto" id="participants-list">
                    <!-- Participants will be listed here -->
                </div>
            </div>
        </div>
    `;
    
    // Añadir al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Configurar event listeners
    const modal = document.getElementById('participant-manager-modal');
    const closeBtn = document.getElementById('close-participant-manager');
    const addBtn = document.getElementById('add-new-participant-btn');
    
    // Cerrar modal
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
    
    // Mostrar modal para añadir participante
    addBtn.addEventListener('click', () => {
        modal.classList.add('hidden'); 
        modal.classList.remove('flex');
        showAddParticipantModal();
    });
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
        console.log("Iniciando adición de participante:", playerName, playerEmail);
        
        // Verificar autenticación
        if (!auth.currentUser) {
            throw new Error("Debes iniciar sesión para añadir participantes");
        }
        
        // Verificar si el usuario es staff (usando la función local para depuración)
        const isStaff = await checkUserIsStaff(auth.currentUser.uid, tournamentId);
        console.log("¿El usuario actual es staff?", isStaff);
        
        if (!isStaff) {
            throw new Error("No tienes permiso para añadir participantes (verificación local)");
        }
        
        // Importar función desde módulo de brackets
        const { addParticipantManually } = await import('./brackets.js');
        
        // Añadir participante
        await addParticipantManually(tournamentId, playerName, discordUsername, playerEmail);
        
        // Cerrar modal
        const modal = document.getElementById('add-participant-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        
        // Si el modal de participantes estaba abierto, actualizarlo
        const participantManagerModal = document.getElementById('participant-manager-modal');
        if (participantManagerModal && !participantManagerModal.classList.contains('hidden')) {
            await loadTournamentParticipants();
            participantManagerModal.classList.remove('hidden');
            participantManagerModal.classList.add('flex');
        }
        
        // Mostrar mensaje de éxito
        window.mostrarNotificacion("Participante añadido correctamente", "success");
        
        // Recargar datos del bracket
        await loadBracketData();
        
    } catch (error) {
        console.error("Error al añadir participante:", error);
        
        // Mostrar mensaje de error más detallado para depuración
        if (error.code) {
            errorMsg.textContent = `${error.message} (${error.code})`;
        } else {
            errorMsg.textContent = error.message || "Error al añadir participante";
        }
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

// Cargar datos del bracket - VERSIÓN ACTUALIZADA
async function loadBracketData() {
    try {
        // Mostrar estado de carga
        bracketContainer.innerHTML = `
            <div class="py-12 flex justify-center items-center">
                <div class="spinner w-12 h-12 border-t-4 border-b-4 border-blue-500 rounded-full mr-4"></div>
                <span class="text-gray-600">Cargando bracket...</span>
            </div>
        `;
        
        // Obtener datos del torneo
        const tournamentRef = await db.collection("torneos").doc(tournamentId).get();
        
        if (!tournamentRef.exists) {
            showError("El torneo no existe");
            return;
        }
        
        const tournamentData = tournamentRef.data();
        console.log("Datos del torneo cargados:", tournamentData.nombre);
        
        // Actualizar nombre y estado del torneo
        tournamentNameEl.textContent = tournamentData.nombre || "Torneo sin nombre";
        tournamentStatusEl.textContent = tournamentData.estado || "";
        
        // Verificar si el torneo tiene un bracket
        if (!tournamentData.bracketId) {
            bracketContainer.innerHTML = `
                <div class="p-8 text-center">
                    <div class="mb-4">
                        <i class="fas fa-sitemap text-gray-300 text-6xl mb-4"></i>
                        <p class="text-gray-600 mb-4">Este torneo aún no tiene un bracket generado.</p>
                    </div>
                    ${isUserStaff ? `
                        <button id="generate-bracket-btn" class="dtowin-blue text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition">
                            <i class="fas fa-plus mr-2"></i>Generar Bracket
                        </button>
                    ` : `
                        <p class="text-sm text-gray-500">El bracket se generará cuando el torneo inicie.</p>
                    `}
                </div>
            `;
            
            // Configurar botón para generar bracket si el usuario es staff
            if (isUserStaff) {
                const generateBracketBtn = document.getElementById('generate-bracket-btn');
                if (generateBracketBtn) {
                    generateBracketBtn.addEventListener('click', async () => {
                        try {
                            if (confirm("¿Quieres generar un nuevo bracket? Esto eliminará participantes no confirmados y creará el bracket con los participantes confirmados.")) {
                                generateBracketBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generando...';
                                generateBracketBtn.disabled = true;
                                
                                const { generateTournamentBracket } = await import('./brackets-new.js');
                                await generateTournamentBracket(tournamentId);
                                
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
            
            return;
        }
        
        // Si llegamos aquí, el torneo tiene un bracket
        const bracketRef = await db.collection("brackets").doc(tournamentData.bracketId).get();
        
        if (!bracketRef.exists) {
            showError("El bracket no existe");
            return;
        }
        
        bracketData = {
            id: bracketRef.id,
            ...bracketRef.data()
        };
        
        console.log("Bracket datos cargados:", bracketData.id);
        console.log("Número de partidos:", bracketData.partidos?.length || 0);
        console.log("Número de rondas:", bracketData.rondas?.length || 0);
        
        // Renderizar bracket
        renderNewBracket(bracketData);
        
        // Cargar badges del torneo
        loadTournamentBadges(tournamentId);
        
    } catch (error) {
        console.error("Error al cargar datos del bracket:", error);
        showError("Error al cargar datos del bracket: " + error.message);
    }
}

// Nueva función para renderizar el bracket mejorado
function renderNewBracket(data) {
    if (!data || !data.rondas || !data.partidos) {
        bracketContainer.innerHTML = `
            <div class="p-8 text-center">
                <p class="text-gray-600">El bracket no tiene datos válidos</p>
            </div>
        `;
        return;
    }
    
    console.log("Renderizando bracket con datos:", data);
    
    // Mostrar información si es un bracket de prueba
    let html = '';
    if (data.esPrueba) {
        html += `
            <div class="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
                <div class="flex items-center">
                    <i class="fas fa-info-circle text-yellow-500 mr-2"></i>
                    <div>
                        <p class="text-yellow-800 font-semibold">Bracket de Prueba</p>
                        <p class="text-yellow-700 text-sm">Este bracket incluye jugadores bot para testing. Los resultados se pueden actualizar haciendo clic en los partidos.</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Crear contenedor principal del bracket
    html += '<div class="bracket-wrapper overflow-x-auto">';
    html += '<div class="bracket flex gap-8 p-4 min-w-max">';
    
    // Organizar partidos por ronda
    const partidosPorRonda = {};
    data.rondas.forEach(ronda => {
        partidosPorRonda[ronda.numero] = data.partidos.filter(partido => 
            partido.ronda === ronda.numero
        ).sort((a, b) => a.posicion - b.posicion);
    });
    
    // Generar cada ronda
    data.rondas.forEach(ronda => {
        const partidosRonda = partidosPorRonda[ronda.numero];
        
        html += `
            <div class="round flex flex-col">
                <div class="round-header mb-4">
                    <h3 class="text-lg font-bold text-gray-800 text-center">${ronda.nombre}</h3>
                    <p class="text-sm text-gray-500 text-center">Ronda ${ronda.numero}</p>
                </div>
                <div class="matches flex flex-col gap-4 justify-center min-h-0">
        `;
        
        // Calcular espaciado entre partidos
        const espaciado = Math.pow(2, ronda.numero - 1) * 20;
        
        partidosRonda.forEach((partido, index) => {
            const jugador1 = partido.jugador1 || { userName: "TBD", gameUsername: "TBD" };
            const jugador2 = partido.jugador2 || { userName: "TBD", gameUsername: "TBD" };
            
            const esGanadorJ1 = partido.ganador && partido.ganador.userId === jugador1.userId;
            const esGanadorJ2 = partido.ganador && partido.ganador.userId === jugador2.userId;
            
            // Determinar si es un bot
            const esBot1 = jugador1.userId && (jugador1.userId.startsWith('bot_') || jugador1.esBot);
            const esBot2 = jugador2.userId && (jugador2.userId.startsWith('bot_') || jugador2.esBot);
            
            // Clases de estado del partido
            let estadoClase = "";
            if (partido.estado === "completado") {
                estadoClase = "border-green-500";
            } else if (partido.estado === "pendiente") {
                estadoClase = "border-blue-500";
            } else {
                estadoClase = "border-gray-300";
            }
            
            html += `
                <div class="match bg-white border-2 ${estadoClase} rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow min-w-[250px] ${isUserStaff && partido.estado === 'pendiente' ? 'cursor-pointer' : ''}"
                     data-match-id="${partido.id}" data-match-state="${partido.estado}">
                    
                    <!-- Jugador 1 -->
                    <div class="player p-3 border-b border-gray-200 ${esGanadorJ1 ? 'bg-green-50 border-l-4 border-l-green-500' : esGanadorJ2 ? 'bg-red-50' : ''}">
                        <div class="flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                <img src="${jugador1.userPhoto || 'dtowin.png'}" alt="${jugador1.userName}" 
                                     class="w-8 h-8 rounded-full object-cover border">
                                <div>
                                    <div class="flex items-center gap-1">
                                        <p class="font-semibold text-sm ${esGanadorJ1 ? 'text-green-700' : ''}">${jugador1.gameUsername || jugador1.userName}</p>
                                        ${esBot1 ? '<span class="text-xs bg-blue-100 text-blue-600 px-1 rounded">BOT</span>' : ''}
                                    </div>
                                    ${jugador1.discordUsername ? `<p class="text-xs text-gray-500">${jugador1.discordUsername}</p>` : ''}
                                </div>
                            </div>
                            <div class="score ${esGanadorJ1 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'} px-2 py-1 rounded font-bold">
                                ${partido.puntuacionJugador1}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Jugador 2 -->
                    <div class="player p-3 ${esGanadorJ2 ? 'bg-green-50 border-l-4 border-l-green-500' : esGanadorJ1 ? 'bg-red-50' : ''}">
                        <div class="flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                <img src="${jugador2.userPhoto || 'dtowin.png'}" alt="${jugador2.userName}" 
                                     class="w-8 h-8 rounded-full object-cover border">
                                <div>
                                    <div class="flex items-center gap-1">
                                        <p class="font-semibold text-sm ${esGanadorJ2 ? 'text-green-700' : ''}">${jugador2.gameUsername || jugador2.userName}</p>
                                        ${esBot2 ? '<span class="text-xs bg-blue-100 text-blue-600 px-1 rounded">BOT</span>' : ''}
                                    </div>
                                    ${jugador2.discordUsername ? `<p class="text-xs text-gray-500">${jugador2.discordUsername}</p>` : ''}
                                </div>
                            </div>
                            <div class="score ${esGanadorJ2 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'} px-2 py-1 rounded font-bold">
                                ${partido.puntuacionJugador2}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Estado del partido -->
                    <div class="match-status p-2 text-center text-xs ${
                        partido.estado === 'completado' ? 'bg-green-100 text-green-700' :
                        partido.estado === 'pendiente' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                    }">
                        ${
                            partido.estado === 'completado' ? 'Completado' :
                            partido.estado === 'pendiente' ? 'En progreso' :
                            partido.estado === 'walkover' ? 'Walkover' :
                            'Esperando'
                        }
                        ${isUserStaff && partido.estado === 'pendiente' ? ' - Clic para actualizar' : ''}
                    </div>
                </div>
            `;
            
            // Añadir espaciado entre partidos si no es el último
            if (index < partidosRonda.length - 1) {
                html += `<div style="height: ${espaciado}px;"></div>`;
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
        document.querySelectorAll('.match[data-match-state="pendiente"]').forEach(matchEl => {
            matchEl.addEventListener('click', (e) => {
                const matchId = matchEl.dataset.matchId;
                const match = data.partidos.find(m => m.id === matchId);
                
                if (match && match.jugador1 && match.jugador2) {
                    openNewScoreModal(match);
                } else {
                    window.mostrarNotificacion("Este partido aún no está listo para jugar", "info");
                }
            });
        });
    }
}

// Nueva función para abrir modal de actualización de puntaje
function openNewScoreModal(match) {
    currentMatchId = match.id;
    
    console.log("Abriendo modal para partido:", match);
    
    // Actualizar información en el modal
    document.getElementById('match-id').value = match.id;
    document.getElementById('match-info').textContent = 
        `${match.jugador1.gameUsername || match.jugador1.userName} vs ${match.jugador2.gameUsername || match.jugador2.userName}`;
    document.getElementById('player1-label').textContent = match.jugador1.gameUsername || match.jugador1.userName;
    document.getElementById('player2-label').textContent = match.jugador2.gameUsername || match.jugador2.userName;
    
    // Limpiar puntajes
    document.getElementById('player1-score').value = '0';
    document.getElementById('player2-score').value = '0';
    document.getElementById('score-error-msg').textContent = '';
    
    // Mostrar modal
    scoreModal.classList.remove('hidden');
    scoreModal.classList.add('flex');
}

// Actualizar función para manejar envío de puntajes
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
        const { updateMatchResult } = await import('./brackets-new.js');
        
        // Actualizar resultados
        await updateMatchResult(bracketData.id, currentMatchId, player1Score, player2Score);
        
        // Cerrar modal
        closeScoreModal();
        
        // Mostrar mensaje de éxito
        window.mostrarNotificacion("Resultado actualizado correctamente", "success");
        
        // Recargar datos
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

// FUNCIONES PARA GESTIONAR PARTICIPANTES

// Función para mostrar el gestor de participantes
async function showParticipantManager() {
    try {
        // Crear modal si no existe
        if (!document.getElementById('participant-manager-modal')) {
            createParticipantManagerModal();
        }
        
        const modal = document.getElementById('participant-manager-modal');
        const participantsList = document.getElementById('participants-list');
        
        // Mostrar spinner de carga
        participantsList.innerHTML = `
            <div class="py-4 flex justify-center">
                <div class="spinner w-8 h-8 border-t-4 border-b-4 border-blue-500 rounded-full"></div>
            </div>
        `;
        
        // Mostrar modal
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // Cargar datos de participantes
        await loadTournamentParticipants();
    } catch (error) {
        console.error("Error al mostrar gestor de participantes:", error);
        window.mostrarNotificacion("Error al cargar participantes", "error");
    }
}

// Cargar participantes del torneo
async function loadTournamentParticipants() {
    try {
        // Obtener datos del torneo
        const tournamentRef = await db.collection("torneos").doc(tournamentId).get();
        const tournamentData = tournamentRef.data();
        
        if (!tournamentData) {
            throw new Error("No se pudo cargar la información del torneo");
        }
        
        // Obtener participantes
        const participants = tournamentData.participants || [];
        const checkedInParticipants = tournamentData.checkedInParticipants || [];
        
        // Obtener elemento de la lista de participantes
        const participantsListEl = document.getElementById('participants-list');
        
        if (participants.length === 0) {
            participantsListEl.innerHTML = `
                <div class="text-center py-4">
                    <p class="text-gray-500">No hay participantes registrados en este torneo</p>
                </div>
            `;
            return;
        }
        
        // Obtener información de cada participante
        const participantInfoPromises = participants.map(async (participantId) => {
            // Buscar en la colección participant_info
            const participantInfoQuery = await db.collection("participant_info")
                .where("userId", "==", participantId)
                .where("tournamentId", "==", tournamentId)
                .get();
            
            if (!participantInfoQuery.empty) {
                return {
                    id: participantId,
                    ...participantInfoQuery.docs[0].data(),
                    isCheckedIn: checkedInParticipants.includes(participantId)
                };
            }
            
            // Si no se encuentra en participant_info, buscar en usuarios
            const userQuery = await db.collection("usuarios")
                .where("uid", "==", participantId)
                .get();
            
            if (!userQuery.empty) {
                const userData = userQuery.docs[0].data();
                return {
                    id: participantId,
                    playerName: userData.nombre || "Usuario sin nombre",
                    discordUsername: userData.discordUsername || null,
                    email: userData.email || null,
                    isCheckedIn: checkedInParticipants.includes(participantId)
                };
            }
            
            // Si no se encuentra en ninguna colección
            return {
                id: participantId,
                playerName: "Participante #" + participantId.substring(0, 6),
                email: null,
                discordUsername: null,
                isCheckedIn: checkedInParticipants.includes(participantId)
            };
        });
        
        const participantsInfo = await Promise.all(participantInfoPromises);
        
        // Renderizar lista de participantes
        let html = `
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="border-b">
                            <th class="px-4 py-2 text-left">Nombre</th>
                            <th class="px-4 py-2 text-left">Discord</th>
                            <th class="px-4 py-2 text-left">Check-in</th>
                            <th class="px-4 py-2 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        participantsInfo.forEach(participant => {
            html += `
                <tr class="border-b hover:bg-gray-50" data-participant-id="${participant.id}">
                    <td class="px-4 py-3">
                        <div>
                            <div class="font-medium">${participant.playerName}</div>
                            <div class="text-xs text-gray-500">${participant.email || ''}</div>
                        </div>
                    </td>
                    <td class="px-4 py-3">${participant.discordUsername || '-'}</td>
                    <td class="px-4 py-3">
                        <span class="inline-block px-2 py-1 text-xs rounded-full ${participant.isCheckedIn ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${participant.isCheckedIn ? 'Sí' : 'No'}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <button class="remove-participant-btn text-red-500 hover:text-red-700 px-2" 
                                data-participant-id="${participant.id}"
                                data-participant-name="${participant.playerName}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        participantsListEl.innerHTML = html;
        
        // Añadir event listeners para botones de eliminar
        document.querySelectorAll('.remove-participant-btn').forEach(btn => {
            btn.addEventListener('click', handleRemoveParticipant);
        });
        
    } catch (error) {
        console.error("Error loading tournament participants:", error);
        document.getElementById('participants-list').innerHTML = `
            <div class="text-center py-4">
                <p class="text-red-500">Error al cargar participantes: ${error.message}</p>
            </div>
        `;
    }
}

// Manejar clic en botón de eliminar participante
async function handleRemoveParticipant(e) {
    const participantId = e.currentTarget.dataset.participantId;
    const participantName = e.currentTarget.dataset.participantName;
    
    if (!participantId) return;
    
    if (!confirm(`¿Estás seguro de eliminar a ${participantName} del torneo? Esta acción no se puede deshacer.`)) {
        return;
    }
    
    try {
        // Mostrar estado de carga
        e.currentTarget.innerHTML = '<div class="spinner w-4 h-4 border-t-2 border-b-2 border-red-500 rounded-full"></div>';
        e.currentTarget.disabled = true;
        
        console.log("Iniciando proceso de eliminar participante", participantId);
        
        // Importar función desde módulo de brackets
        const { removeParticipant } = await import('./brackets.js');
        
        // Eliminar participante
        const result = await removeParticipant(tournamentId, participantId);
        console.log("Resultado de eliminar participante:", result);
        
        // Mostrar mensaje de éxito
        window.mostrarNotificacion("Participante eliminado correctamente", "success");
        
        // Recargar participantes
        await loadTournamentParticipants();
        
        // Recargar datos del bracket si hay cambios en los participantes
        await loadBracketData();
        
    } catch (error) {
        console.error("Error al eliminar participante:", error);
        window.mostrarNotificacion("Error al eliminar participante: " + error.message, "error");
        
        // Restaurar botón
        e.currentTarget.innerHTML = '<i class="fas fa-trash-alt"></i>';
        e.currentTarget.disabled = false;
    }
}
