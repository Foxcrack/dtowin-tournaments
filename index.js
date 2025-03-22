// tournament-system.js - Sistema de torneos para Dtowin

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Firebase
    initializeFirebase();
    
    // Cargar torneos
    loadTournaments();
    
    // Cargar leaderboard
    loadLeaderboard();
    
    // Configurar listeners para modales
    setupModalListeners();
});

// Inicialización de Firebase si no está ya inicializado
function initializeFirebase() {
    if (typeof firebase === 'undefined') {
        console.error("Firebase no está disponible");
        return;
    }
    
    try {
        // Verificar si Firebase ya está inicializado
        if (!firebase.apps.length) {
            const firebaseConfig = {
                apiKey: "AIzaSyBHW2HsP2T6DOwLaOYloqZFerFmU_UA4kE",
                authDomain: "dtowin-tournament.firebaseapp.com",
                projectId: "dtowin-tournament",
                storageBucket: "dtowin-tournament.appspot.com",
                messagingSenderId: "991226820083",
                appId: "1:991226820083:web:6387773cf8c76a0f6ace86",
                measurementId: "G-R4Q5YKZXGY"
            };
            
            firebase.initializeApp(firebaseConfig);
        }
        
        console.log("Firebase inicializado correctamente");
    } catch (error) {
        console.error("Error al inicializar Firebase:", error);
    }
}

// Carga los torneos desde Firestore y los organiza por estado
async function loadTournaments() {
    try {
        // Obtener referencia a Firestore
        const db = firebase.firestore();
        
        // Obtener todos los torneos
        const torneosSnapshot = await db.collection("torneos").get();
        
        if (torneosSnapshot.empty) {
            console.log("No hay torneos disponibles");
            showEmptyState('torneosEnProcesoGrid', 'No hay torneos en proceso actualmente');
            showEmptyState('torneosAbiertosGrid', 'No hay torneos abiertos para inscripción');
            showEmptyState('torneosProximosGrid', 'No hay próximos torneos anunciados');
            return;
        }
        
        // Clasificar torneos por estado
        const torneosEnProceso = [];
        const torneosAbiertos = [];
        const torneosProximos = [];
        
        torneosSnapshot.forEach(doc => {
            const torneo = { id: doc.id, ...doc.data() };
            
            // Determinar estado actual del torneo
            if (torneo.estado === 'en_proceso') {
                torneosEnProceso.push(torneo);
            } else if (torneo.estado === 'abierto') {
                torneosAbiertos.push(torneo);
            } else if (torneo.estado === 'proximo') {
                torneosProximos.push(torneo);
            }
        });
        
        // Renderizar cada sección
        renderTorneos(torneosEnProceso, 'torneosEnProcesoGrid', 'en_proceso');
        renderTorneos(torneosAbiertos, 'torneosAbiertosGrid', 'abierto');
        renderTorneos(torneosProximos, 'torneosProximosGrid', 'proximo');
        
        // Ocultar secciones vacías
        if (torneosEnProceso.length === 0) {
            document.getElementById('torneosEnProceso').style.display = 'none';
        }
        
        if (torneosAbiertos.length === 0) {
            document.getElementById('torneosAbiertos').style.display = 'none';
        }
        
        if (torneosProximos.length === 0) {
            document.getElementById('torneosProximos').style.display = 'none';
        }
        
        // Configurar listeners para botones de inscripción
        setupRegistrationButtons();
        
    } catch (error) {
        console.error("Error al cargar torneos:", error);
        showNotification("Error al cargar torneos. Por favor, intenta de nuevo más tarde.", "error");
    }
}

// Mostrar estado vacío para una sección
function showEmptyState(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="col-span-full py-8 text-center text-gray-500">
                <i class="fas fa-calendar-times text-4xl mb-2"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

// Renderizar torneos en su contenedor correspondiente
function renderTorneos(torneos, containerId, estado) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (torneos.length === 0) {
        showEmptyState(containerId, estado === 'en_proceso' ? 'No hay torneos en proceso actualmente' : 
                              estado === 'abierto' ? 'No hay torneos abiertos para inscripción' : 
                              'No hay próximos torneos anunciados');
        return;
    }
    
    let html = '';
    
    torneos.forEach(torneo => {
        // Formato de fecha
        const fechaInicio = torneo.fechaInicio ? new Date(torneo.fechaInicio.seconds * 1000) : new Date();
        const fechaFormateada = fechaInicio.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        
        // Horario
        const horaInicio = torneo.horaInicio || '12:00';
        const horaFin = torneo.horaFin || '18:00';
        
        // Estado visualizado
        let estadoLabel = '';
        let estadoClass = '';
        
        if (estado === 'en_proceso') {
            estadoLabel = 'En Proceso';
            estadoClass = 'bg-blue-500';
        } else if (estado === 'abierto') {
            estadoLabel = 'Inscripciones Abiertas';
            estadoClass = 'bg-green-500';
        } else {
            estadoLabel = 'Próximamente';
            estadoClass = 'bg-yellow-500';
        }
        
        // Determinar estado del botón de inscripción
        let buttonHtml = '';
        
        if (estado === 'en_proceso') {
            buttonHtml = `
                <button class="w-full bg-blue-600 text-white py-2 rounded-lg cursor-not-allowed font-semibold opacity-70">
                    En Desarrollo
                </button>
            `;
        } else if (estado === 'abierto') {
            buttonHtml = `
                <div class="flex space-x-2">
                    <button class="flex-1 dtowin-blue text-white py-2 rounded-lg hover:opacity-90 transition font-semibold tournament-register-btn" data-tournament-id="${torneo.id}">
                        Inscribirse
                    </button>
                    <button class="w-10 h-10 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg flex items-center justify-center transition view-participants-btn" data-tournament-id="${torneo.id}" title="Ver participantes">
                        <i class="fas fa-users"></i>
                    </button>
                </div>
            `;
        } else {
            buttonHtml = `
                <button class="w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed font-semibold">
                    Próximamente
                </button>
            `;
        }
        
        // Generar tarjeta de torneo
        html += `
            <div class="bg-white rounded-xl shadow-lg overflow-hidden tournament-card transition duration-300" data-tournament-id="${torneo.id}">
                <img src="${torneo.imagen || 'https://via.placeholder.com/400x200?text=Torneo+Dtowin'}" alt="${torneo.nombre}" class="w-full h-48 object-cover">
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <h3 class="text-xl font-bold text-gray-800">${torneo.nombre}</h3>
                        <span class="${estadoClass} text-white text-xs px-2 py-1 rounded-full">${estadoLabel}</span>
                    </div>
                    <p class="text-gray-600 mb-4">${torneo.descripcion}</p>
                    <div class="flex items-center text-gray-500 text-sm mb-4">
                        <i class="far fa-calendar-alt mr-2"></i>
                        <span>${fechaFormateada}</span>
                        <i class="far fa-clock ml-4 mr-2"></i>
                        <span>${horaInicio} - ${horaFin}</span>
                    </div>
                    <div class="bg-gray-100 rounded-lg p-3 mb-4">
                        <h4 class="font-semibold text-gray-700 mb-2">Puntos por posición:</h4>
                        <div class="flex flex-wrap gap-2">
                            ${renderPuntos(torneo.puntosPosicion)}
                        </div>
                    </div>
                    ${buttonHtml}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Renderizar la lista de puntos por posición
function renderPuntos(puntosPosicion) {
    if (!puntosPosicion || typeof puntosPosicion !== 'object') {
        return '<span class="bg-gray-400 text-white rounded-full px-3 py-1 text-xs">Puntos no disponibles</span>';
    }
    
    let html = '';
    const posiciones = ['1°', '2°', '3°', '4°', '5°'];
    const colores = ['bg-yellow-500', 'bg-gray-400', 'bg-orange-400', 'bg-blue-400', 'bg-purple-400'];
    
    // Iterar posiciones
    for (let i = 0; i < posiciones.length; i++) {
        const posicion = (i + 1).toString();
        const puntos = puntosPosicion[posicion] || 0;
        
        if (puntos > 0) {
            html += `<span class="${colores[i]} text-white rounded-full px-3 py-1 text-xs">${posiciones[i]} - ${puntos} pts</span>`;
        }
    }
    
    if (html === '') {
        html = '<span class="bg-gray-400 text-white rounded-full px-3 py-1 text-xs">Sin puntos</span>';
    }
    
    return html;
}

// Configurar listeners para botones de inscripción
function setupRegistrationButtons() {
    // Botones de inscripción
    document.querySelectorAll('.tournament-register-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const tournamentId = btn.getAttribute('data-tournament-id');
            
            if (!tournamentId) {
                showNotification('Error: ID de torneo no disponible', 'error');
                return;
            }
            
            // Verificar si el usuario está autenticado
            const user = firebase.auth().currentUser;
            if (!user) {
                showNotification('Debes iniciar sesión para inscribirte a un torneo', 'warning');
                // Mostrar modal de login
                const loginModal = document.getElementById('loginModal');
                if (loginModal) {
                    loginModal.classList.remove('hidden');
                    loginModal.classList.add('flex');
                }
                return;
            }
            
            // Verificar si el usuario ya está inscrito
            const isRegistered = await checkUserRegistration(user.uid, tournamentId);
            
            if (isRegistered) {
                // Si está inscrito, desincribir
                await unregisterFromTournament(user.uid, tournamentId, btn);
            } else {
                // Si no está inscrito, inscribir
                await registerForTournament(user.uid, tournamentId, btn);
            }
        });
    });
    
    // Botones para ver participantes
    document.querySelectorAll('.view-participants-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const tournamentId = btn.getAttribute('data-tournament-id');
            
            if (!tournamentId) {
                showNotification('Error: ID de torneo no disponible', 'error');
                return;
            }
            
            // Mostrar modal con participantes
            showParticipantsModal(tournamentId);
        });
    });
}

// Verificar si un usuario está registrado en un torneo
async function checkUserRegistration(userId, tournamentId) {
    try {
        const db = firebase.firestore();
        const tournamentRef = db.collection('torneos').doc(tournamentId);
        const doc = await tournamentRef.get();
        
        if (!doc.exists) {
            throw new Error('El torneo no existe');
        }
        
        const tournamentData = doc.data();
        const participants = tournamentData.participants || [];
        
        return participants.includes(userId);
    } catch (error) {
        console.error('Error al verificar inscripción:', error);
        return false;
    }
}

// Inscribir usuario a un torneo
async function registerForTournament(userId, tournamentId, buttonElement) {
    try {
        // Mostrar estado de carga
        const originalText = buttonElement.innerHTML;
        buttonElement.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-white mr-2 inline-block"></div> Inscribiendo...';
        buttonElement.disabled = true;
        
        const db = firebase.firestore();
        const tournamentRef = db.collection('torneos').doc(tournamentId);
        
        // Obtener datos actuales del torneo
        const doc = await tournamentRef.get();
        
        if (!doc.exists) {
            throw new Error('El torneo no existe');
        }
        
        const tournamentData = doc.data();
        
        // Verificar cupo máximo
        const currentParticipants = tournamentData.participants || [];
        const maxParticipants = tournamentData.cuposMaximos || Infinity;
        
        if (currentParticipants.length >= maxParticipants) {
            throw new Error('El torneo ha alcanzado el cupo máximo de participantes');
        }
        
        // Verificar que el torneo esté abierto
        if (tournamentData.estado !== 'abierto') {
            throw new Error('Las inscripciones para este torneo no están abiertas');
        }
        
        // Verificar que el usuario no esté ya inscrito
        if (currentParticipants.includes(userId)) {
            throw new Error('Ya estás inscrito en este torneo');
        }
        
        // Añadir al usuario a la lista de participantes
        const updatedParticipants = [...currentParticipants, userId];
        
        // Actualizar documento
        await tournamentRef.update({
            participants: updatedParticipants,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Obtener información del usuario
        const userDoc = await db.collection('usuarios')
            .where('uid', '==', userId)
            .limit(1)
            .get();
        
        let userName = 'Usuario';
        
        if (!userDoc.empty) {
            userName = userDoc.docs[0].data().nombre || userDoc.docs[0].data().displayName || 'Usuario';
        }
        
        // Actualizar UI
        buttonElement.innerHTML = '<i class="fas fa-check mr-2"></i> Inscrito';
        buttonElement.classList.remove('dtowin-blue');
        buttonElement.classList.add('bg-green-600');
        
        // Añadir opción de desinscribirse
        setTimeout(() => {
            buttonElement.innerHTML = 'Desinscribirse';
            buttonElement.classList.remove('bg-green-600');
            buttonElement.classList.add('bg-red-500');
            buttonElement.disabled = false;
        }, 1500);
        
        showNotification(`¡Te has inscrito exitosamente al torneo "${tournamentData.nombre}"!`, 'success');
        
    } catch (error) {
        console.error('Error al inscribir al torneo:', error);
        showNotification(error.message || 'Error al inscribir al torneo', 'error');
        
        // Restaurar botón
        if (buttonElement) {
            buttonElement.innerHTML = 'Inscribirse';
            buttonElement.disabled = false;
        }
    }
}

// Desinscribir usuario de un torneo
async function unregisterFromTournament(userId, tournamentId, buttonElement) {
    try {
        // Mostrar estado de carga
        const originalText = buttonElement.innerHTML;
        buttonElement.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-white mr-2 inline-block"></div> Procesando...';
        buttonElement.disabled = true;
        
        const db = firebase.firestore();
        const tournamentRef = db.collection('torneos').doc(tournamentId);
        
        // Obtener datos actuales del torneo
        const doc = await tournamentRef.get();
        
        if (!doc.exists) {
            throw new Error('El torneo no existe');
        }
        
        const tournamentData = doc.data();
        
        // Verificar que el torneo esté abierto
        if (tournamentData.estado !== 'abierto') {
            throw new Error('No es posible desinscribirse de este torneo en este momento');
        }
        
        // Verificar que el usuario esté inscrito
        const currentParticipants = tournamentData.participants || [];
        
        if (!currentParticipants.includes(userId)) {
            throw new Error('No estás inscrito en este torneo');
        }
        
        // Quitar al usuario de la lista de participantes
        const updatedParticipants = currentParticipants.filter(id => id !== userId);
        
        // Actualizar documento
        await tournamentRef.update({
            participants: updatedParticipants,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Actualizar UI
        buttonElement.innerHTML = '<i class="fas fa-check mr-2"></i> Desinscrito';
        buttonElement.classList.remove('bg-red-500');
        buttonElement.classList.add('bg-gray-600');
        
        // Restaurar botón original
        setTimeout(() => {
            buttonElement.innerHTML = 'Inscribirse';
            buttonElement.classList.remove('bg-gray-600');
            buttonElement.classList.add('dtowin-blue');
            buttonElement.disabled = false;
        }, 1500);
        
        showNotification(`Te has desinscrito del torneo "${tournamentData.nombre}"`, 'info');
        
    } catch (error) {
        console.error('Error al desinscribir del torneo:', error);
        showNotification(error.message || 'Error al desinscribir del torneo', 'error');
        
        // Restaurar botón
        if (buttonElement) {
            buttonElement.innerHTML = 'Desinscribirse';
            buttonElement.classList.remove('bg-gray-600');
            buttonElement.classList.add('bg-red-500');
            buttonElement.disabled = false;
        }
    }
}

// Mostrar modal con lista de participantes
async function showParticipantsModal(tournamentId) {
    try {
        const modal = document.getElementById('participantesModal');
        const participantesContainer = document.getElementById('participantesContainer');
        const modalTitle = document.getElementById('participantesModalTitle');
        const modalSubtitle = document.getElementById('participantesModalSubtitle');
        const cuposInfo = document.getElementById('cuposInfo');
        
        if (!modal || !participantesContainer) {
            console.error('Modal o contenedor de participantes no encontrado');
            return;
        }
        
        // Mostrar modal con estado de carga
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        participantesContainer.innerHTML = `
            <div class="flex justify-center py-8">
                <div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
            </div>
        `;
        
        // Obtener datos del torneo
        const db = firebase.firestore();
        const tournamentRef = db.collection('torneos').doc(tournamentId);
        const tournamentDoc = await tournamentRef.get();
        
        if (!tournamentDoc.exists) {
            throw new Error('Torneo no encontrado');
        }
        
        const tournament = tournamentDoc.data();
        
        // Actualizar título del modal
        modalTitle.textContent = tournament.nombre || 'Participantes';
        modalSubtitle.textContent = `Usuarios registrados en este torneo`;
        
        // Obtener lista de participantes
        const participants = tournament.participants || [];
        const maxParticipants = tournament.cuposMaximos || '∞';
        
        cuposInfo.textContent = `Cupos: ${participants.length}/${maxParticipants}`;
        
        if (participants.length === 0) {
            participantesContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-users-slash text-4xl mb-2"></i>
                    <p>No hay participantes inscritos en este torneo</p>
                </div>
            `;
            return;
        }
        
        // Cargar información de cada participante
        let participantsHtml = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
        
        // Procesar participantes por lotes para evitar demasiadas consultas simultáneas
        const batchSize = 10;
        
        for (let i = 0; i < participants.length; i += batchSize) {
            const batch = participants.slice(i, i + batchSize);
            
            // Consultar todos los participantes del lote
            const participantsData = await Promise.all(
                batch.map(async (userId) => {
                    try {
                        const userQuery = await db.collection('usuarios')
                            .where('uid', '==', userId)
                            .limit(1)
                            .get();
                        
                        if (userQuery.empty) {
                            return {
                                uid: userId,
                                nombre: 'Usuario',
                                photoURL: null
                            };
                        }
                        
                        const userData = userQuery.docs[0].data();
                        
                        return {
                            uid: userId,
                            nombre: userData.nombre || userData.displayName || 'Usuario',
                            photoURL: userData.photoURL
                        };
                    } catch (error) {
                        console.error(`Error al obtener usuario ${userId}:`, error);
                        return {
                            uid: userId,
                            nombre: 'Usuario',
                            photoURL: null
                        };
                    }
                })
            );
            
            // Agregar participantes al HTML
            participantsData.forEach(user => {
                participantsHtml += `
                    <div class="flex items-center bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition">
                        <img src="${user.photoURL || 'https://via.placeholder.com/40?text=U'}" 
                             alt="${user.nombre}" 
                             class="w-10 h-10 rounded-full mr-3 participant-avatar">
                        <div>
                            <p class="font-medium text-gray-800">${user.nombre}</p>
                            <p class="text-xs text-gray-500">${user.uid.substring(0, 8)}...</p>
                        </div>
                    </div>
                `;
            });
        }
        
        participantsHtml += '</div>';
        participantesContainer.innerHTML = participantsHtml;
        
    } catch (error) {
        console.error('Error al mostrar participantes:', error);
        showNotification('Error al cargar participantes', 'error');
        
        // Cerrar modal en caso de error
        const modal = document.getElementById('participantesModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }
}

// Configurar listeners para modales
function setupModalListeners() {
    // Botón para cerrar modal de participantes
    const closeParticipantesBtn = document.getElementById('closeParticipantesBtn');
    const closeParticipantesModal = document.getElementById('closeParticipantesModal');
    const participantesModal = document.getElementById('participantesModal');
    
    if (closeParticipantesBtn && participantesModal) {
        closeParticipantesBtn.addEventListener('click', () => {
            participantesModal.classList.add('hidden');
            participantesModal.classList.remove('flex');
        });
    }
    
    if (closeParticipantesModal && participantesModal) {
        closeParticipantesModal.addEventListener('click', () => {
            participantesModal.classList.add('hidden');
            participantesModal.classList.remove('flex');
        });
    }
}

// Cargar leaderboard global
async function loadLeaderboard(limit = 5) {
    try {
        const db = firebase.firestore();
        const leaderboardContainer = document.getElementById('leaderboardContainer');
        
        if (!leaderboardContainer) return;
        
        // Mostrar carga
        leaderboardContainer.innerHTML = `
            <div class="flex justify-center py-8">
                <div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
            </div>
        `;
        
        // Obtener usuarios ordenados por puntos
        const usersRef = db.collection('usuarios');
        const usersSnapshot = await usersRef.orderBy('puntos', 'desc').limit(limit).get();
        
        if (usersSnapshot.empty) {
            leaderboardContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p>No hay usuarios con puntos registrados</p>
                </div>
            `;
            return;
        }
        
        // Procesar y mostrar usuarios
        let leaderboardHtml = '';
        
        // Colores para los primeros lugares
        const bgColors = [
            'bg-yellow-50', // 1er lugar
            'bg-gray-50',   // 2do lugar
            'bg-orange-50', // 3er lugar
            '',             // demás lugares
            ''
        ];
        
        const rankColors = [
            'text-yellow-500', // 1er lugar
            'text-gray-500',   // 2do lugar
            'text-orange-500', // 3er lugar
            '',                // demás lugares
            ''
        ];
        
        let position = 1;
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const userName = userData.nombre || userData.displayName || 'Usuario';
            const userAvatar = userData.photoURL || 'https://via.placeholder.com/50?text=U';
            const userPoints = userData.puntos || 0;
            const tournaments = userData.tournamentsParticipated || [];
            const tournamentCount = Array.isArray(tournaments) ? tournaments.length : 0;
            
            // Determinar color según posición
            const bgColor = position <= 3 ? bgColors[position - 1] : '';
            const rankColor = position <= 3 ? rankColors[position - 1] : '';
            
            // Obtener badges del usuario
            const badges = userData.badges || {};
            const badgesHtml = renderUserBadges(badges);
            
            leaderboardHtml += `
                <div class="grid grid-cols-12 p-4 items-center ${bgColor}">
                    <div class="col-span-1 text-center font-bold text-xl ${rankColor}">${position}</div>
                    <div class="col-span-6 flex items-center">
                        <img src="${userAvatar}" alt="Player" class="w-10 h-10 rounded-full mr-3">
                        <div>
                            <h3 class="font-semibold">${userName}</h3>
                            <div class="flex">
                                ${badgesHtml}
                            </div>
                        </div>
                    </div>
                    <div class="col-span-2 text-center">${tournamentCount}</div>
                    <div class="col-span-3 text-center font-bold ${position <= 3 ? 'text-lg' : ''}">${userPoints}</div>
                </div>
            `;
            
            position++;
        });
        
        leaderboardContainer.innerHTML = leaderboardHtml;
        
        // Configurar botón para ver más
        const loadMoreBtn = document.getElementById('loadMoreLeaderboard');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                loadLeaderboard(20); // Cargar más usuarios al hacer clic
                loadMoreBtn.style.display = 'none';
            });
        }
        
    } catch (error) {
        console.error('Error al cargar leaderboard:', error);
        
        const leaderboardContainer = document.getElementById('leaderboardContainer');
        if (leaderboardContainer) {
            leaderboardContainer.innerHTML = `
                <div class="text-center py-4 text-red-500">
                    <p>Error al cargar leaderboard. Inténtalo de nuevo más tarde.</p>
                </div>
            `;
        }
    }
}

// Renderizar badges de usuario en el leaderboard
function renderUserBadges(badges) {
    if (!badges || typeof badges !== 'object' || Object.keys(badges).length === 0) {
        return '';
    }
    
    // Colores de badges basados en sus propiedades
    const badgeColors = {
        'oro': 'bg-yellow-500',
        'plata': 'bg-gray-500',
        'bronce': 'bg-orange-500',
        'especial': 'bg-purple-500',
        'evento': 'bg-blue-500',
        'temporada': 'bg-green-500',
        'desafio': 'bg-red-500'
    };
    
    // Iconos de badges basados en sus propiedades
    const badgeIcons = {
        'oro': 'trophy',
        'plata': 'medal',
        'bronce': 'award',
        'especial': 'star',
        'evento': 'certificate',
        'temporada': 'calendar',
        'desafio': 'fire'
    };
    
    let html = '';
    let count = 0;
    
    // Solo mostrar hasta 3 badges
    for (const badgeId in badges) {
        if (count >= 3) break;
        
        const badge = badges[badgeId];
        
        // Determinar color e icono
        let bgColor = 'bg-gray-500';
        let icon = 'certificate';
        
        // Intentar determinar el tipo de badge
        for (const type in badgeColors) {
            if (badgeId.toLowerCase().includes(type) || (badge.tipo && badge.tipo.toLowerCase().includes(type))) {
                bgColor = badgeColors[type];
                icon = badgeIcons[type];
                break;
            }
        }
        
        // Título del badge
        const title = badge.nombre || 'Badge Dtowin';
        
        html += `
            <span class="badge ${bgColor}" title="${title}">
                <i class="fas fa-${icon}"></i>
            </span>
        `;
        
        count++;
    }
    
    // Si hay más badges, mostrar un indicador
    if (Object.keys(badges).length > 3) {
        html += `
            <span class="badge bg-gray-400" title="Y ${Object.keys(badges).length - 3} más">
                +${Object.keys(badges).length - 3}
            </span>
        `;
    }
    
    return html;
}

// Función para mostrar notificaciones (definida globalmente en index.html)
function showNotification(message, type = "info") {
    // Verificar si la función ya existe en el ámbito global
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
        return;
    }
    
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    // Definir color según tipo
    let bgColor = 'bg-blue-500';
    
    if (type === 'success') {
        bgColor = 'bg-green-500';
    } else if (type === 'error') {
        bgColor = 'bg-red-500';
    } else if (type === 'warning') {
        bgColor = 'bg-yellow-500';
    }
    
    // Configurar notificación
    notification.className = `fixed bottom-4 right-4 ${bgColor} text-white rounded-lg shadow-lg px-4 py-3 z-50`;
    notification.innerHTML = message;
    
    // Mostrar con animación
    notification.classList.remove('hidden', 'opacity-0', 'translate-y-2');
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
        notification.classList.add('opacity-0', 'translate-y-2');
        notification.style.transition = 'opacity 0.5s, transform 0.5s';
        
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 500);
    }, 3000);
}
