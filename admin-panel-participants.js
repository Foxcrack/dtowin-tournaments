// admin-panel-participants.js - Módulo para gestión de participantes

// Referencias a elementos del DOM
const participantesContainer = document.getElementById('participantesContainer');
const searchParticipant = document.getElementById('searchParticipant');
const filterTorneo = document.getElementById('filterTorneo');
const totalParticipantesCounter = document.getElementById('totalParticipantesCounter');
const participantesActivosCounter = document.getElementById('participantesActivosCounter');
const badgesOtorgadosCounter = document.getElementById('badgesOtorgadosCounter');

// Referencias para los modales
const participantDetailsModal = document.getElementById('participantDetailsModal');
const closeParticipantModal = document.getElementById('closeParticipantModal');
const userTournamentsContainer = document.getElementById('userTournamentsContainer');
const userBadgesContainer = document.getElementById('userBadgesContainer');
const addBadgeBtn = document.getElementById('addBadgeBtn');
const saveUserRoleBtn = document.getElementById('saveUserRoleBtn');
const cancelUserRoleBtn = document.getElementById('cancelUserRoleBtn');
const isHostCheckbox = document.getElementById('isHostCheckbox');
const addPointsBtn = document.getElementById('addPointsBtn');
const subtractPointsBtn = document.getElementById('subtractPointsBtn');
const pointsAdjustInput = document.getElementById('pointsAdjustInput');

// Modal de badges
const badgeSelectionModal = document.getElementById('badgeSelectionModal');
const closeBadgeModal = document.getElementById('closeBadgeModal');
const badgesList = document.getElementById('badgesList');
const badgeReason = document.getElementById('badgeReason');
const assignBadgeButton = document.getElementById('assignBadgeButton');

// Modal para confirmar eliminación de participante
const confirmRemoveModal = document.getElementById('confirmRemoveModal');
const cancelRemoveBtn = document.getElementById('cancelRemoveBtn');
const confirmRemoveBtn = document.getElementById('confirmRemoveBtn');
const removeParticipantTournamentName = document.getElementById('removeParticipantTournamentName');

// Variables de estado
let currentUser = null;
let selectedParticipant = null;
let selectedBadgeId = null;
let selectedTournamentForRemoval = null;
let allParticipants = [];
let allTorneos = [];
let isInitialized = false;

// Temporizador para evitar bucles infinitos
let loadingTimeout;

// Inicializar panel de participantes
export async function initParticipantsPanel() {
    // Evitar inicialización múltiple
    if (isInitialized) {
        console.log("El panel de participantes ya está inicializado");
        return;
    }
    
    try {
        console.log("Inicializando panel de participantes...");
        isInitialized = true;
        
        // Obtener el usuario autenticado actual
        currentUser = firebase.auth().currentUser;
        
        // Configurar event listeners
        setupEventListeners();
        
        // Cargar datos iniciales
        await Promise.all([
            loadAllTorneos(),
            loadParticipantes()
        ]);
        
        // Cargar estadísticas
        loadStatsCounters();
        
    } catch (error) {
        console.error("Error al inicializar panel de participantes:", error);
        mostrarNotificacion("Error al inicializar. Inténtalo de nuevo.", "error");
        
        if (participantesContainer) {
            participantesContainer.innerHTML = `<p class="text-center text-red-500 py-4">
                Error al cargar participantes: ${error.message || "Error desconocido"}. 
                <button class="text-blue-500 underline" onclick="window.location.reload()">
                    Reintentar
                </button>
            </p>`;
        }
    }
}

// Configurar event listeners
function setupEventListeners() {
    console.log("Configurando event listeners...");
    
    // Búsqueda de participantes
    if (searchParticipant) {
        searchParticipant.addEventListener('input', handleSearch);
    }
    
    // Filtro por torneo
    if (filterTorneo) {
        filterTorneo.addEventListener('change', handleFilterChange);
    }
    
    // Modal de detalles
    if (closeParticipantModal) {
        closeParticipantModal.addEventListener('click', () => {
            participantDetailsModal.classList.add('hidden');
        });
    }
    
    // Modal de badges
    if (closeBadgeModal) {
        closeBadgeModal.addEventListener('click', () => {
            badgeSelectionModal.classList.add('hidden');
        });
    }
    
    // Botón para asignar badge
    if (addBadgeBtn) {
        addBadgeBtn.addEventListener('click', showBadgeSelectionModal);
    }
    
    // Botón para asignar badge seleccionado
    if (assignBadgeButton) {
        assignBadgeButton.addEventListener('click', assignBadgeToParticipant);
    }
    
    // Botones para ajustar puntos
    if (addPointsBtn) {
        addPointsBtn.addEventListener('click', () => adjustPoints(true));
    }
    
    if (subtractPointsBtn) {
        subtractPointsBtn.addEventListener('click', () => adjustPoints(false));
    }
    
    // Botón para guardar cambios de rol
    if (saveUserRoleBtn) {
        saveUserRoleBtn.addEventListener('click', saveUserRole);
    }
    
    // Botón para cancelar cambios de rol
    if (cancelUserRoleBtn) {
        cancelUserRoleBtn.addEventListener('click', () => {
            // Restaurar estado original del checkbox según el participante seleccionado
            if (selectedParticipant && isHostCheckbox) {
                isHostCheckbox.checked = selectedParticipant.isHost === true;
            }
            mostrarNotificacion("Cambios cancelados", "info");
        });
    }
    
    // Modal de confirmación para eliminar participante
    if (cancelRemoveBtn) {
        cancelRemoveBtn.addEventListener('click', () => {
            confirmRemoveModal.classList.add('hidden');
        });
    }
    
    if (confirmRemoveBtn) {
        confirmRemoveBtn.addEventListener('click', removeParticipantFromTournament);
    }
}

// Cargar lista de torneos para el filtro
async function loadAllTorneos() {
    try {
        console.log("Cargando torneos para filtro...");
        
        // Obtener torneos de Firestore
        const torneosSnapshot = await firebase.firestore().collection('torneos').get();
        
        if (torneosSnapshot.empty) {
            console.log("No hay torneos disponibles");
            return;
        }
        
        // Limpiar opciones existentes excepto la primera (Todos los torneos)
        if (filterTorneo) {
            // Mantener solo la primera opción
            while (filterTorneo.options.length > 1) {
                filterTorneo.remove(1);
            }
            
            // Añadir torneos al dropdown
            torneosSnapshot.forEach(doc => {
                const torneo = {
                    id: doc.id,
                    ...doc.data()
                };
                
                allTorneos.push(torneo);
                
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = torneo.nombre || 'Torneo sin nombre';
                filterTorneo.appendChild(option);
            });
        }
        
        console.log(`Se cargaron ${allTorneos.length} torneos para el filtro`);
        
    } catch (error) {
        console.error("Error al cargar torneos:", error);
        mostrarNotificacion("Error al cargar lista de torneos", "error");
    }
}

// Cargar participantes desde Firestore
async function loadParticipantes() {
    if (!participantesContainer) return;
    
    try {
        console.log("Cargando participantes...");
        
        // Mostrar carga
        participantesContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
        
        // Obtener usuarios de Firestore
        const usuariosSnapshot = await firebase.firestore().collection('usuarios').get();
        
        if (usuariosSnapshot.empty) {
            participantesContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No hay participantes registrados.</p>';
            return;
        }
        
        // Procesar participantes
        allParticipants = [];
        usuariosSnapshot.forEach(doc => {
            allParticipants.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log(`Se cargaron ${allParticipants.length} participantes`);
        
        // Mostrar participantes
        displayParticipants(allParticipants);
        
    } catch (error) {
        console.error("Error al cargar participantes:", error);
        participantesContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar participantes. <button class="text-blue-500 underline" onclick="window.location.reload()">Reintentar</button></p>';
    }
}

// Mostrar participantes en la tabla
function displayParticipants(participants) {
    if (!participantesContainer) return;
    
    if (participants.length === 0) {
        participantesContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No se encontraron participantes con los filtros aplicados.</p>';
        return;
    }
    
    // HTML para la tabla
    let html = `
        <table class="min-w-full bg-white">
            <thead>
                <tr class="bg-gray-100 text-gray-600 uppercase text-sm">
                    <th class="py-3 px-4 text-left">Participante</th>
                    <th class="py-3 px-4 text-left">Email</th>
                    <th class="py-3 px-4 text-left">Torneos</th>
                    <th class="py-3 px-4 text-left">Puntos</th>
                    <th class="py-3 px-4 text-left">Badges</th>
                    <th class="py-3 px-4 text-left">Último login</th>
                    <th class="py-3 px-4 text-left">Acciones</th>
                </tr>
            </thead>
            <tbody class="text-gray-600">
    `;
    
    // Añadir filas
    participants.forEach(participant => {
        // Formatear fecha de último login
        const lastLogin = participant.ultimoLogin 
            ? new Date(participant.ultimoLogin.seconds * 1000).toLocaleDateString('es-ES')
            : 'Nunca';
        
        // Contar torneos
        const torneosCount = participant.torneos ? Object.keys(participant.torneos).length : 0;
        
        // Contar badges
        const badgesCount = participant.badges ? Object.keys(participant.badges).length : 0;
        
        // Agregar fila
        html += `
            <tr class="border-b hover:bg-gray-50" data-participant-id="${participant.id}">
                <td class="py-3 px-4 flex items-center">
                    <img src="${participant.photoURL || 'https://via.placeholder.com/32'}" alt="${participant.nombre || participant.email}" class="w-8 h-8 rounded-full mr-2">
                    <div>
                        <p class="font-medium">${participant.nombre || 'Sin nombre'}</p>
                        <p class="text-xs text-gray-500">${participant.isHost ? '<span class="text-orange-500">Host</span>' : 'Participante'}</p>
                    </div>
                </td>
                <td class="py-3 px-4">${participant.email || 'Sin email'}</td>
                <td class="py-3 px-4">${torneosCount}</td>
                <td class="py-3 px-4 font-medium">${participant.puntos || 0}</td>
                <td class="py-3 px-4">
                    <span class="bg-orange-100 text-orange-600 py-1 px-2 rounded text-xs">
                        ${badgesCount} badges
                    </span>
                </td>
                <td class="py-3 px-4">${lastLogin}</td>
                <td class="py-3 px-4">
                    <button class="text-blue-500 hover:text-blue-700 view-participant-btn" title="Ver detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    // Mostrar tabla
    participantesContainer.innerHTML = html;
    
    // Añadir event listeners a botones de acción
    document.querySelectorAll('.view-participant-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const participantId = this.closest('tr').dataset.participantId;
            openParticipantDetails(participantId);
        });
    });
}

// Manejar búsqueda de participante
function handleSearch() {
    const searchText = searchParticipant.value.toLowerCase();
    
    if (!searchText) {
        // Si no hay texto de búsqueda, aplicar solo filtro de torneo
        handleFilterChange();
        return;
    }
    
    // Filtrar por nombre o email
    const filteredParticipants = allParticipants.filter(participant => {
        const matchesSearch = 
            (participant.nombre && participant.nombre.toLowerCase().includes(searchText)) ||
            (participant.email && participant.email.toLowerCase().includes(searchText));
        
        // Si hay filtro de torneo activo, aplicarlo también
        if (filterTorneo && filterTorneo.value) {
            return matchesSearch && participantInTorneo(participant, filterTorneo.value);
        }
        
        return matchesSearch;
    });
    
    // Mostrar resultados
    displayParticipants(filteredParticipants);
}

// Manejar cambio en filtro de torneo
function handleFilterChange() {
    const torneoId = filterTorneo.value;
    const searchText = searchParticipant.value.toLowerCase();
    
    if (!torneoId) {
        // Si no hay filtro de torneo, aplicar solo búsqueda
        if (searchText) {
            handleSearch();
        } else {
            // Si no hay búsqueda ni filtro, mostrar todos
            displayParticipants(allParticipants);
        }
        return;
    }
    
    // Filtrar por torneo
    const filteredParticipants = allParticipants.filter(participant => {
        const matchesTorneo = participantInTorneo(participant, torneoId);
        
        // Si hay búsqueda activa, aplicarla también
        if (searchText) {
            return matchesTorneo && (
                (participant.nombre && participant.nombre.toLowerCase().includes(searchText)) ||
                (participant.email && participant.email.toLowerCase().includes(searchText))
            );
        }
        
        return matchesTorneo;
    });
    
    // Mostrar resultados
    displayParticipants(filteredParticipants);
}

// Verificar si un participante está en un torneo
function participantInTorneo(participant, torneoId) {
    // Si el participante tiene propiedad torneos, verificar si contiene el ID
    if (participant.torneos && participant.torneos[torneoId]) {
        return true;
    }
    
    // Verificar en los participants del torneo
    const torneo = allTorneos.find(t => t.id === torneoId);
    if (torneo && torneo.participants && torneo.participants.includes(participant.uid)) {
        return true;
    }
    
    return false;
}

// Abrir modal de detalles del participante
async function openParticipantDetails(participantId) {
    try {
        console.log("Abriendo detalles del participante:", participantId);
        
        // Buscar participante en el array local
        const participant = allParticipants.find(p => p.id === participantId);
        
        if (!participant) {
            mostrarNotificacion("No se encontró el participante", "error");
            return;
        }
        
        // Guardar referencia al participante seleccionado
        selectedParticipant = participant;
        
        // Llenar datos básicos en el modal
        document.getElementById('participantName').textContent = participant.nombre || 'Sin nombre';
        document.getElementById('participantEmail').textContent = participant.email || 'Sin email';
        document.getElementById('participantId').textContent = participant.uid || 'UID no disponible';
        
        // Formatear fechas
        const registerDate = participant.fechaRegistro 
            ? new Date(participant.fechaRegistro.seconds * 1000).toLocaleDateString('es-ES')
            : 'No disponible';
        
        const lastLogin = participant.ultimoLogin 
            ? new Date(participant.ultimoLogin.seconds * 1000).toLocaleDateString('es-ES')
            : 'Nunca';
        
        document.getElementById('participantRegisterDate').textContent = registerDate;
        document.getElementById('participantLastLogin').textContent = lastLogin;
        document.getElementById('participantPoints').textContent = participant.puntos || 0;
        
        // Configurar checkbox de host
        if (isHostCheckbox) {
            isHostCheckbox.checked = participant.isHost === true;
        }
        
        // Actualizar badge de rol
        const userRoleBadge = document.getElementById('userRoleBadge');
        if (userRoleBadge) {
            if (participant.isHost) {
                userRoleBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800';
                userRoleBadge.textContent = 'Host';
            } else {
                userRoleBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800';
                userRoleBadge.textContent = 'Participante';
            }
        }
        
        // Cargar torneos del participante
        await loadParticipantTournaments(participant);
        
        // Cargar badges del participante
        await loadParticipantBadges(participant);
        
        // Mostrar modal
        participantDetailsModal.classList.remove('hidden');
        
    } catch (error) {
        console.error("Error al abrir detalles del participante:", error);
        mostrarNotificacion("Error al cargar detalles del participante", "error");
    }
}

// Cargar torneos del participante
async function loadParticipantTournaments(participant) {
    if (!userTournamentsContainer) return;
    
    // Mostrar carga
    userTournamentsContainer.innerHTML = '<div class="flex justify-center"><div class="spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-orange-500"></div></div>';
    
    try {
        // Torneos en los que ha participado
        const participantTournaments = [];
        
        // Buscar torneos donde el participante esté en la lista de participants
        for (const torneo of allTorneos) {
            if (torneo.participants && torneo.participants.includes(participant.uid)) {
                participantTournaments.push(torneo);
            }
        }
        
        if (participantTournaments.length === 0) {
            userTournamentsContainer.innerHTML = '<p class="text-gray-500 text-sm">Este participante no ha participado en ningún torneo.</p>';
            return;
        }
        
        // Crear lista de torneos
        let tournamentsHTML = '<div class="space-y-2">';
        
        participantTournaments.forEach(torneo => {
            // Formatear fecha
            const fecha = torneo.fecha 
                ? new Date(torneo.fecha.seconds * 1000).toLocaleDateString('es-ES')
                : 'Fecha no disponible';
            
            // Determinar clase según estado
            let statusClass = 'bg-gray-100 text-gray-600';
            switch(torneo.estado) {
                case 'Abierto':
                    statusClass = 'bg-green-100 text-green-600';
                    break;
                case 'En Progreso':
                    statusClass = 'bg-blue-100 text-blue-600';
                    break;
                case 'Finalizado':
                    statusClass = 'bg-gray-100 text-gray-600';
                    break;
                case 'Próximamente':
                    statusClass = 'bg-yellow-100 text-yellow-600';
                    break;
            }
            
            tournamentsHTML += `
                <div class="flex justify-between items-center p-2 bg-white rounded border">
                    <div>
                        <p class="font-medium">${torneo.nombre || 'Torneo sin nombre'}</p>
                        <p class="text-xs text-gray-500">${fecha}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="px-2 py-1 rounded text-xs ${statusClass}">${torneo.estado || 'Sin estado'}</span>
                        <button class="text-red-500 hover:text-red-700 remove-from-tournament-btn" 
                                data-tournament-id="${torneo.id}" 
                                data-tournament-name="${torneo.nombre || 'Torneo sin nombre'}"
                                title="Eliminar de torneo">
                            <i class="fas fa-user-minus"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        tournamentsHTML += '</div>';
        
        // Mostrar torneos
        userTournamentsContainer.innerHTML = tournamentsHTML;
        
        // Añadir event listeners para eliminar de torneo
        document.querySelectorAll('.remove-from-tournament-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const tournamentId = this.dataset.tournamentId;
                const tournamentName = this.dataset.tournamentName;
                showRemoveParticipantConfirmation(tournamentId, tournamentName);
            });
        });
        
    } catch (error) {
        console.error("Error al cargar torneos del participante:", error);
        userTournamentsContainer.innerHTML = '<p class="text-red-500 text-sm">Error al cargar torneos.</p>';
    }
}

// Cargar badges del participante
async function loadParticipantBadges(participant) {
    if (!userBadgesContainer) return;
    
    // Mostrar carga
    userBadgesContainer.innerHTML = '<div class="flex justify-center"><div class="spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-orange-500"></div></div>';
    
    try {
        // Verificar si el participante tiene badges
        if (!participant.badges || Object.keys(participant.badges).length === 0) {
            userBadgesContainer.innerHTML = '<p class="text-gray-500 text-sm col-span-4">Este participante no tiene badges.</p>';
            return;
        }
        
        // Obtener todos los badges para mostrar detalles
        const badgesSnapshot = await firebase.firestore().collection('badges').get();
        const allBadges = {};
        
        badgesSnapshot.forEach(doc => {
            allBadges[doc.id] = {
                id: doc.id,
                ...doc.data()
            };
        });
        
        // Crear grid de badges
        let badgesHTML = '';
        
        // Convertir el objeto de badges a array
        const participantBadges = Object.entries(participant.badges).map(([badgeId, badgeData]) => ({
            id: badgeId,
            ...badgeData,
            details: allBadges[badgeId] || {}
        }));
        
        participantBadges.forEach(badge => {
            const badgeDetails = badge.details;
            const dateAwarded = badge.dateAwarded 
                ? new Date(badge.dateAwarded.seconds * 1000).toLocaleDateString('es-ES')
                : 'Fecha desconocida';
            
            badgesHTML += `
                <div class="bg-white p-2 rounded border flex flex-col items-center justify-center text-center">
                    <div class="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center mb-1" 
                         style="background-color: ${badgeDetails.color || '#ff6b1a'}">
                        ${badgeDetails.imageUrl 
                            ? `<img src="${badgeDetails.imageUrl}" alt="${badgeDetails.nombre}" class="w-full h-full object-contain">` 
                            : `<i class="fas fa-${badgeDetails.icono || 'trophy'} text-white"></i>`
                        }
                    </div>
                    <p class="text-xs font-medium">${badgeDetails.nombre || 'Badge'}</p>
                    <p class="text-xs text-gray-500">${dateAwarded}</p>
                    <button class="text-red-500 hover:text-red-700 text-xs mt-1 remove-badge-btn" 
                            data-badge-id="${badge.id}" title="Eliminar badge">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });
        
        // Mostrar badges
        userBadgesContainer.innerHTML = badgesHTML;
        
        // Añadir event listeners para eliminar badges
        document.querySelectorAll('.remove-badge-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const badgeId = this.dataset.badgeId;
                if (confirm('¿Estás seguro de que quieres quitar este badge al participante?')) {
                    removeBadgeFromParticipant(badgeId);
                }
            });
        });
        
    } catch (error) {
        console.error("Error al cargar badges del participante:", error);
        userBadgesContainer.innerHTML = '<p class="text-red-500 text-sm col-span-4">Error al cargar badges.</p>';
    }
}

// Mostrar modal de selección de badges
async function showBadgeSelectionModal() {
    if (!selectedParticipant) {
        mostrarNotificacion("No se ha seleccionado un participante", "error");
        return;
    }
    
    try {
        // Mostrar modal
        badgeSelectionModal.classList.remove('hidden');
        
        // Cargar lista de badges
        badgesList.innerHTML = '<div class="flex justify-center col-span-2"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
        
        // Resetear badge seleccionado
        selectedBadgeId = null;
        assignBadgeButton.disabled = true;
        
        // Obtener badges disponibles
        const badgesSnapshot = await firebase.firestore().collection('badges').get();
        
        if (badgesSnapshot.empty) {
            badgesList.innerHTML = '<p class="col-span-2 text-center text-gray-500">No hay badges disponibles. Crea un badge primero.</p>';
            return;
        }
        
        // Crear grid de badges
        let badgesHTML = '';
        
        badgesSnapshot.forEach(doc => {
            const badge = doc.data();
            
            badgesHTML += `
                <div class="border rounded-lg p-3 flex flex-col items-center cursor-pointer hover:bg-gray-50 badge-option" data-badge-id="${doc.id}">
                    <div class="h-16 w-16 mb-2 rounded-full overflow-hidden flex items-center justify-center bg-gray-50">
                        ${badge.imageUrl 
                            ? `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-full h-full object-contain">` 
                            : `<div class="badge w-full h-full flex items-center justify-center" style="background-color: ${badge.color || '#ff6b1a'}">
                                <i class="fas fa-${badge.icono || 'trophy'} text-white"></i>
                            </div>`
                        }
                    </div>
                    <p class="font-semibold text-center">${badge.nombre || 'Badge'}</p>
                    ${badge.descripcion ? `<p class="text-xs text-gray-500 text-center">${badge.descripcion}</p>` : ''}
                </div>
            `;
        });
        
        badgesList.innerHTML = badgesHTML;
        
        // Configurar selección de badge
        document.querySelectorAll('.badge-option').forEach(badgeElement => {
            badgeElement.addEventListener('click', function() {
                // Quitar selección anterior
                document.querySelectorAll('.badge-option').forEach(el => {
                    el.classList.remove('ring-2', 'ring-orange-500');
                });
                
                // Añadir selección
                this.classList.add('ring-2', 'ring-orange-500');
                
                // Guardar ID del badge seleccionado
                selectedBadgeId = this.dataset.badgeId;
                
                // Habilitar botón de asignar
                assignBadgeButton.disabled = false;
            });
        });
        
    } catch (error) {
        console.error("Error al mostrar modal de badges:", error);
        mostrarNotificacion("Error al cargar badges disponibles", "error");
    }
}

// Asignar badge a participante
async function assignBadgeToParticipant() {
    if (!selectedParticipant || !selectedBadgeId) {
        mostrarNotificacion("Selecciona un badge primero", "warning");
        return;
    }
    
    try {
        // Mostrar estado de carga
        const originalText = assignBadgeButton.textContent;
        assignBadgeButton.disabled = true;
        assignBadgeButton.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Asignando...';
        
        // Referencia al documento del participante
        const participantRef = firebase.firestore().collection('usuarios').doc(selectedParticipant.id);
        
        // Verificar si ya tiene el badge
        if (selectedParticipant.badges && selectedParticipant.badges[selectedBadgeId]) {
            mostrarNotificacion("Este participante ya tiene este badge", "warning");
            assignBadgeButton.disabled = false;
            assignBadgeButton.textContent = originalText;
            return;
        }
        
        // Preparar datos para la actualización
        const reason = badgeReason.value.trim();
        const badgeData = {
            dateAwarded: firebase.firestore.FieldValue.serverTimestamp(),
            awardedBy: firebase.auth().currentUser.uid
        };
        
        if (reason) {
            badgeData.reason = reason;
        }
        
        // Actualizar el documento del participante
        await participantRef.update({
            [`badges.${selectedBadgeId}`]: badgeData
        });
        
        // Actualizar también el objeto local
        if (!selectedParticipant.badges) {
            selectedParticipant.badges = {};
        }
        
        selectedParticipant.badges[selectedBadgeId] = badgeData;
        
        // Cerrar modal y recargar badges
        badgeSelectionModal.classList.add('hidden');
        
        // Limpiar campo de razón
        badgeReason.value = '';
        
        // Recargar badges del participante
        await loadParticipantBadges(selectedParticipant);
        
        // Actualizar contador de badges
        await loadStatsCounters();
        
        mostrarNotificacion("Badge asignado correctamente", "success");
        
    } catch (error) {
        console.error("Error al asignar badge:", error);
        mostrarNotificacion("Error al asignar badge", "error");
    } finally {
        // Restaurar botón
        assignBadgeButton.disabled = false;
        assignBadgeButton.textContent = 'Asignar Badge';
    }
}

// Eliminar badge de participante
async function removeBadgeFromParticipant(badgeId) {
    if (!selectedParticipant) {
        mostrarNotificacion("No se ha seleccionado un participante", "error");
        return;
    }
    
    try {
        // Referencia al documento del participante
        const participantRef = firebase.firestore().collection('usuarios').doc(selectedParticipant.id);
        
        // Actualizar el documento del participante (eliminar el badge)
        const fieldPath = `badges.${badgeId}`;
        const updateData = {};
        updateData[fieldPath] = firebase.firestore.FieldValue.delete();
        
        await participantRef.update(updateData);
        
        // Actualizar también el objeto local
        if (selectedParticipant.badges && selectedParticipant.badges[badgeId]) {
            delete selectedParticipant.badges[badgeId];
        }
        
        // Recargar badges del participante
        await loadParticipantBadges(selectedParticipant);
        
        // Actualizar contador de badges
        await loadStatsCounters();
        
        mostrarNotificacion("Badge eliminado correctamente", "success");
        
    } catch (error) {
        console.error("Error al eliminar badge:", error);
        mostrarNotificacion("Error al eliminar badge", "error");
    }
}

// Ajustar puntos del participante
async function adjustPoints(isAdd) {
    if (!selectedParticipant) {
        mostrarNotificacion("No se ha seleccionado un participante", "error");
        return;
    }
    
    // Obtener valor de puntos a ajustar
    const pointsValue = parseInt(pointsAdjustInput.value);
    
    if (isNaN(pointsValue) || pointsValue <= 0) {
        mostrarNotificacion("Ingresa un valor válido de puntos", "warning");
        return;
    }
    
    try {
        // Calcular nuevos puntos
        const currentPoints = selectedParticipant.puntos || 0;
        const newPoints = isAdd ? currentPoints + pointsValue : Math.max(0, currentPoints - pointsValue);
        
        // Referencia al documento del participante
        const participantRef = firebase.firestore().collection('usuarios').doc(selectedParticipant.id);
        
        // Actualizar puntos en Firestore
        await participantRef.update({
            puntos: newPoints,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Actualizar el objeto local
        selectedParticipant.puntos = newPoints;
        
        // Actualizar la UI
        document.getElementById('participantPoints').textContent = newPoints;
        
        // Limpiar campo de puntos
        pointsAdjustInput.value = '';
        
        // Actualizar la tabla
        const participantRow = document.querySelector(`tr[data-participant-id="${selectedParticipant.id}"]`);
        if (participantRow) {
            const pointsCell = participantRow.querySelector('td:nth-child(4)');
            if (pointsCell) {
                pointsCell.textContent = newPoints;
            }
        }
        
        mostrarNotificacion(`${isAdd ? 'Añadidos' : 'Restados'} ${pointsValue} puntos correctamente`, "success");
        
    } catch (error) {
        console.error("Error al ajustar puntos:", error);
        mostrarNotificacion("Error al ajustar puntos", "error");
    }
}

// Guardar cambios en el rol de usuario
async function saveUserRole() {
    if (!selectedParticipant) {
        mostrarNotificacion("No se ha seleccionado un participante", "error");
        return;
    }
    
    // Obtener valor del checkbox
    const isHost = isHostCheckbox.checked;
    
    try {
        // Mostrar estado de carga
        const originalText = saveUserRoleBtn.textContent;
        saveUserRoleBtn.disabled = true;
        saveUserRoleBtn.innerHTML = '<div class="inline-block spinner rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div> Guardando...';
        
        // Referencia al documento del participante
        const participantRef = firebase.firestore().collection('usuarios').doc(selectedParticipant.id);
        
        // Actualizar rol en Firestore
        await participantRef.update({
            isHost: isHost,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Actualizar el objeto local
        selectedParticipant.isHost = isHost;
        
        // Actualizar la UI
        const userRoleBadge = document.getElementById('userRoleBadge');
        if (userRoleBadge) {
            if (isHost) {
                userRoleBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800';
                userRoleBadge.textContent = 'Host';
            } else {
                userRoleBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800';
                userRoleBadge.textContent = 'Participante';
            }
        }
        
        // Actualizar fila en la tabla
        const participantRow = document.querySelector(`tr[data-participant-id="${selectedParticipant.id}"]`);
        if (participantRow) {
            const roleText = participantRow.querySelector('td:first-child p.text-xs');
            if (roleText) {
                roleText.innerHTML = isHost ? '<span class="text-orange-500">Host</span>' : 'Participante';
            }
        }
        
        mostrarNotificacion(`Rol de usuario ${isHost ? 'actualizado a Host' : 'actualizado a Participante'}`, "success");
        
    } catch (error) {
        console.error("Error al guardar rol de usuario:", error);
        mostrarNotificacion("Error al guardar rol de usuario", "error");
    } finally {
        // Restaurar botón
        saveUserRoleBtn.disabled = false;
        saveUserRoleBtn.textContent = originalText;
    }
}

// Mostrar confirmación para eliminar participante de torneo
function showRemoveParticipantConfirmation(tournamentId, tournamentName) {
    // Guardar referencias para usar en la confirmación
    selectedTournamentForRemoval = tournamentId;
    
    // Actualizar texto del modal
    removeParticipantTournamentName.textContent = tournamentName;
    
    // Mostrar modal
    confirmRemoveModal.classList.remove('hidden');
}

// Eliminar participante de torneo
async function removeParticipantFromTournament() {
    if (!selectedParticipant || !selectedTournamentForRemoval) {
        mostrarNotificacion("No se ha seleccionado un participante o torneo", "error");
        confirmRemoveModal.classList.add('hidden');
        return;
    }
    
    try {
        // Mostrar estado de carga
        const originalText = confirmRemoveBtn.textContent;
        confirmRemoveBtn.disabled = true;
        confirmRemoveBtn.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Eliminando...';
        
        // Referencia al documento del torneo
        const tournamentRef = firebase.firestore().collection('torneos').doc(selectedTournamentForRemoval);
        
        // Obtener torneo actual
        const tournamentSnapshot = await tournamentRef.get();
        
        if (!tournamentSnapshot.exists) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentSnapshot.data();
        
        // Verificar que el participante está en el torneo
        if (tournamentData.participants && tournamentData.participants.includes(selectedParticipant.uid)) {
            // Eliminar participante del array
            const newParticipants = tournamentData.participants.filter(uid => uid !== selectedParticipant.uid);
            
            // Actualizar documento del torneo
            await tournamentRef.update({
                participants: newParticipants,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Actualizar también el objeto local del torneo
            const torneo = allTorneos.find(t => t.id === selectedTournamentForRemoval);
            if (torneo && torneo.participants) {
                torneo.participants = newParticipants;
            }
            
            // Recargar torneos del participante
            await loadParticipantTournaments(selectedParticipant);
            
            mostrarNotificacion("Participante eliminado del torneo", "success");
        } else {
            mostrarNotificacion("El participante no está registrado en este torneo", "warning");
        }
        
        // Cerrar modal
        confirmRemoveModal.classList.add('hidden');
        
    } catch (error) {
        console.error("Error al eliminar participante del torneo:", error);
        mostrarNotificacion("Error al eliminar participante del torneo", "error");
    } finally {
        // Restaurar botón
        confirmRemoveBtn.disabled = false;
        confirmRemoveBtn.textContent = originalText;
    }
}

// Cargar contadores de estadísticas
async function loadStatsCounters() {
    try {
        // Total de participantes
        if (totalParticipantesCounter) {
            totalParticipantesCounter.textContent = allParticipants.length;
        }
        
        // Participantes activos (último login en los últimos 30 días)
        if (participantesActivosCounter) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const activosCount = allParticipants.filter(participant => {
                if (!participant.ultimoLogin) return false;
                
                const lastLogin = new Date(participant.ultimoLogin.seconds * 1000);
                return lastLogin >= thirtyDaysAgo;
            }).length;
            
            participantesActivosCounter.textContent = activosCount;
        }
        
        // Badges otorgados
        if (badgesOtorgadosCounter) {
            let totalBadges = 0;
            
            allParticipants.forEach(participant => {
                if (participant.badges) {
                    totalBadges += Object.keys(participant.badges).length;
                }
            });
            
            badgesOtorgadosCounter.textContent = totalBadges;
        }
        
    } catch (error) {
        console.error("Error al cargar contadores de estadísticas:", error);
    }
}

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = "info") {
    if (window.mostrarNotificacion) {
        // Usar la función global si está disponible
        window.mostrarNotificacion(mensaje, tipo);
    } else {
        // Implementación de respaldo por si la función global no está disponible
        console.log(`Notificación (${tipo}): ${mensaje}`);
        
        // Verificar si ya existe una notificación
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Crear elemento de notificación
        const notification = document.createElement('div');
        
        // Clases según el tipo de notificación
        let bgColor = 'bg-blue-500';
        let icon = 'info-circle';
        
        if (tipo === 'success') {
            bgColor = 'bg-green-500';
            icon = 'check-circle';
        } else if (tipo === 'error') {
            bgColor = 'bg-red-500';
            icon = 'exclamation-circle';
        } else if (tipo === 'warning') {
            bgColor = 'bg-yellow-500';
            icon = 'exclamation-triangle';
        }
        
        // Estilos de la notificación
        notification.className = `notification fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center`;
        notification.innerHTML = `
            <i class="fas fa-${icon} mr-2"></i>
            <span>${mensaje}</span>
        `;
        
        // Añadir al DOM
        document.body.appendChild(notification);
        
        // Eliminar después de 3 segundos
        setTimeout(() => {
            notification.classList.add('opacity-0');
            notification.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 3000);
    }
}

// Exportar funciones necesarias
export {
    initParticipantsPanel,
    loadParticipantes,
    displayParticipants
};
