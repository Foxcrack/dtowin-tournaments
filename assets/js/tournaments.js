// tournaments.js - Script para la gestión de torneos en el panel de administración

// Variables globales de Firebase (disponibles después de la inicialización)
let db, auth, storage;

// Funciones de utilidad para zonas horarias (inline para evitar imports)
function getUserTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function getTimeZoneName(timeZone = null) {
    const userTimeZone = timeZone || getUserTimeZone();
    
    const timeZoneNames = {
        'America/Bogota': 'COT (Colombia)',
        'America/Mexico_City': 'CST (México)',
        'America/Argentina/Buenos_Aires': 'ART (Argentina)',
        'America/Santiago': 'CLT (Chile)',
        'America/Lima': 'PET (Perú)',
        'America/Caracas': 'VET (Venezuela)',
        'Europe/Madrid': 'CET (España)',
        'America/New_York': 'EST (Estados Unidos - Este)',
        'America/Los_Angeles': 'PST (Estados Unidos - Oeste)',
        'Europe/London': 'GMT (Reino Unido)'
    };
    
    return timeZoneNames[userTimeZone] || userTimeZone;
}

function convertLocalToUTC(dateStr, timeStr, timeZone = null) {
    const userTimeZone = timeZone || getUserTimeZone();
    
    console.log("Convirtiendo a UTC:", dateStr, timeStr, "Zona:", userTimeZone);
    
    // Crear fecha en la zona horaria local del usuario
    const localDateTime = `${dateStr}T${timeStr}:00`;
    console.log("DateTime string:", localDateTime);
    
    // Crear Date object que interprete la fecha como local
    const localDate = new Date(localDateTime);
    console.log("Fecha local interpretada:", localDate);
    
    // Obtener offset de zona horaria en minutos
    const offsetMinutes = localDate.getTimezoneOffset();
    console.log("Offset en minutos:", offsetMinutes);
    
    // Convertir a UTC sumando el offset
    const utcDate = new Date(localDate.getTime() - (offsetMinutes * 60000));
    console.log("Fecha UTC final:", utcDate);
    
    return utcDate;
}

// Variables para elementos DOM (se inicializarán cuando el DOM esté listo)
let torneosTable, createTournamentForm, tournamentFormSection, headerCreateTournamentBtn;
let cancelButton, submitButton, formTitle;
let challongeUrl, challongeUsername, linkChallongeBtn, challongeStatus;

// Modal de selección de badges
const badgeSelectModal = document.getElementById('badgeSelectModal');
const closeBadgeModal = document.getElementById('closeBadgeModal');
const badgesList = document.getElementById('badgesList');
const currentBadgeTarget = document.getElementById('currentBadgeTarget');

// Variables de estado
let currentTournamentId = null;
let isEditMode = false;
let allBadges = [];
let allBanners = [];

// Inicializar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Inicializando admin-torneos.js...");
    
    // Inicializar elementos DOM
    console.log("Buscando elementos DOM...");
    torneosTable = document.getElementById('torneosTable');
    createTournamentForm = document.getElementById('createTournamentForm');
    tournamentFormSection = document.getElementById('tournamentFormSection');
    headerCreateTournamentBtn = document.getElementById('headerCreateTournamentBtn');
    cancelButton = document.getElementById('cancelButton');
    submitButton = document.getElementById('submitButton');
    formTitle = document.getElementById('formTitle');
    challongeUrl = document.getElementById('challongeUrl');
    challongeUsername = document.getElementById('challongeUsername');
    linkChallongeBtn = document.getElementById('linkChallongeBtn');
    challongeStatus = document.getElementById('challongeStatus');
    
    console.log("Elementos encontrados:", {
        torneosTable: !!torneosTable,
        createTournamentForm: !!createTournamentForm,
        tournamentFormSection: !!tournamentFormSection,
        headerCreateTournamentBtn: !!headerCreateTournamentBtn,
        cancelButton: !!cancelButton,
        submitButton: !!submitButton,
        formTitle: !!formTitle,
        linkChallongeBtn: !!linkChallongeBtn
    });
    
    // Verificar que Firebase esté disponible
    if (typeof firebase === 'undefined') {
        console.error("Firebase no está disponible");
        return;
    }
    
    console.log("Firebase disponible, inicializando variables...");
    
    // Inicializar variables globales de Firebase
    db = window.db || firebase.firestore();
    auth = window.auth || firebase.auth();
    storage = window.storage || firebase.storage();
    
    console.log("Variables de Firebase inicializadas:", { db: !!db, auth: !!auth, storage: !!storage });
    
    // Verificar autenticación
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            
            // Verificar si el usuario es administrador
            const isAdmin = await checkUserIsAdmin(user.uid);
            
            if (isAdmin) {
                // Actualizar UI con info del usuario
                updateUserProfileUI(user);
                
                // Inicializar la página
                initializePage();
            } else {
                console.log("Usuario no es administrador");
                alert("No tienes permisos para acceder a esta página");
                window.location.href = "index.html";
            }
        } else {
            console.log("No hay usuario autenticado, redirigiendo...");
            window.location.href = "index.html";
        }
    });
});

// Actualizar UI con info del usuario
function updateUserProfileUI(user) {
    const userProfile = document.getElementById('userProfile');
    if (userProfile) {
        userProfile.innerHTML = `
            <img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="${user.displayName || 'Admin'}" class="w-8 h-8 rounded-full">
            <span class="hidden md:inline">${user.displayName || 'Admin'}</span>
        `;
    }
}

// Verificar si el usuario es administrador
async function checkUserIsAdmin(uid) {
    try {
        // Lista de administradores fijos
        const adminUIDs = ["dvblFee1ZnVKJNWBOR22tSAsNet2"];
        
        // Si el UID está en la lista de administradores
        if (adminUIDs.includes(uid)) {
            return true;
        }
        
        // Verificar en la base de datos
        const usersSnapshot = await db.collection("usuarios")
            .where("uid", "==", uid)
            .where("isHost", "==", true)
            .get();
        
        return !usersSnapshot.empty;
    } catch (error) {
        console.error("Error al verificar si el usuario es administrador:", error);
        return false;
    }
}

// Inicializar la página
async function initializePage() {
    try {
        // Configurar event listeners
        setupEventListeners();
        
        // Mostrar zona horaria del admin
        updateAdminTimeZoneDisplay();
        
        // Cargar torneos para la tabla
        await loadTorneos();
        
        // Cargar banners y badges para los selectores
        await Promise.all([
            loadBanners(),
            loadBadges()
        ]);
        
    } catch (error) {
        console.error("Error al inicializar la página:", error);
        showError("Error al cargar la página. Por favor, recarga.");
    }
}

// Actualizar display de zona horaria del admin
function updateAdminTimeZoneDisplay() {
    const adminTimeZoneElement = document.getElementById('adminTimeZone');
    if (adminTimeZoneElement) {
        const timeZoneName = getTimeZoneName();
        adminTimeZoneElement.textContent = timeZoneName;
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Botón para mostrar formulario de creación
    if (headerCreateTournamentBtn) {
        headerCreateTournamentBtn.addEventListener('click', () => {
            showTournamentForm(false);
        });
    }
    
    // Botón para cancelar formulario
    if (cancelButton) {
        cancelButton.addEventListener('click', hideTournamentForm);
    }
    
    // Formulario de creación/edición
    if (createTournamentForm) {
        createTournamentForm.addEventListener('submit', handleTournamentFormSubmit);
    }
    
    // Botón de vinculación con Challonge
    if (linkChallongeBtn) {
        linkChallongeBtn.addEventListener('click', handleLinkChallonge);
    }
    
    // Modal de badges
    if (closeBadgeModal) {
        closeBadgeModal.addEventListener('click', () => {
            badgeSelectModal.classList.add('hidden');
        });
    }
    
    // Configurar selectores de badges
    setupBadgeSelectors();
}

// Configurar selectores de badges
function setupBadgeSelectors() {
    const badgeSelectors = [
        'badge1Preview',
        'badge2Preview',
        'badge3Preview',
        'badgeParticipationPreview'
    ];
    
    badgeSelectors.forEach(selectorId => {
        const element = document.getElementById(selectorId);
        if (element) {
            element.addEventListener('click', () => {
                currentBadgeTarget.value = selectorId;
                showBadgeSelectModal(selectorId);
            });
        }
    });
}

// Mostrar modal de selección de badges
function showBadgeSelectModal(targetId) {
    // Configurar título según el target
    const badgeModalTitle = document.getElementById('badgeModalTitle');
    const badgeModalDescription = document.getElementById('badgeModalDescription');
    
    let title = "Seleccionar Badge";
    let position = "";
    
    switch (targetId) {
        case 'badge1Preview':
            title = "Badge para Primer Lugar";
            position = "first";
            break;
        case 'badge2Preview':
            title = "Badge para Segundo Lugar";
            position = "second";
            break;
        case 'badge3Preview':
            title = "Badge para Tercer Lugar";
            position = "top3";
            break;
        case 'badgeParticipationPreview':
            title = "Badge de Participación";
            position = "all";
            break;
    }
    
    if (badgeModalTitle) badgeModalTitle.textContent = title;
    if (badgeModalDescription) badgeModalDescription.textContent = "Selecciona una badge para asignar a esta posición";
    
    // Renderizar listado de badges
    renderBadgesList(position);
    
    // Mostrar modal
    badgeSelectModal.classList.remove('hidden');
    badgeSelectModal.classList.add('flex');
}

// Renderizar listado de badges en el modal
function renderBadgesList(position) {
    if (!badgesList) return;
    
    if (allBadges.length === 0) {
        badgesList.innerHTML = '<p class="text-center text-gray-500 p-4">No hay badges disponibles</p>';
        return;
    }
    
    let html = '<div class="grid grid-cols-1 gap-2">';
    
    // Opción para no seleccionar ninguna badge
    html += `
        <div class="badge-item border rounded p-2 hover:bg-gray-50 cursor-pointer" data-badge-id="">
            <div class="flex items-center">
                <div class="badge-preview bg-gray-300 flex items-center justify-center">
                    <i class="fas fa-times"></i>
                </div>
                <div class="flex-grow ml-2">
                    <p class="font-medium">Ninguna</p>
                    <p class="text-xs text-gray-500">No asignar badge</p>
                </div>
            </div>
        </div>
    `;
    
    // Listado de badges
    allBadges.forEach(badge => {
        html += `
            <div class="badge-item border rounded p-2 hover:bg-gray-50 cursor-pointer" data-badge-id="${badge.id}">
                <div class="flex items-center">
                    ${badge.imageUrl ? 
                        `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="badge-preview object-cover">` : 
                        `<div class="badge-preview" style="background-color: ${badge.color || '#ff6b1a'}">
                            <i class="fas fa-${badge.icono || 'trophy'}"></i>
                        </div>`
                    }
                    <div class="flex-grow ml-2">
                        <p class="font-medium">${badge.nombre}</p>
                        <p class="text-xs text-gray-500">${badge.descripcion || 'Sin descripción'}</p>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    badgesList.innerHTML = html;
    
    // Agregar event listeners a los items
    document.querySelectorAll('.badge-item').forEach(item => {
        item.addEventListener('click', () => {
            selectBadge(item.dataset.badgeId);
        });
    });
}

// Seleccionar una badge
function selectBadge(badgeId) {
    const targetId = currentBadgeTarget.value;
    const targetElement = document.getElementById(targetId);
    const inputId = targetId.replace('Preview', 'Id');
    const hiddenInput = document.getElementById(inputId);
    
    if (!targetElement || !hiddenInput) return;
    
    // Si no se seleccionó ninguna badge
    if (!badgeId) {
        targetElement.innerHTML = '<span class="text-gray-500 text-sm">Seleccionar badge...</span>';
        hiddenInput.value = '';
        badgeSelectModal.classList.add('hidden');
        return;
    }
    
    // Buscar la badge seleccionada
    const badge = allBadges.find(b => b.id === badgeId);
    if (!badge) return;
    
    // Actualizar la vista previa
    targetElement.innerHTML = `
        ${badge.imageUrl ? 
            `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-8 h-8 object-cover rounded-full mr-2">` : 
            `<div class="w-8 h-8 rounded-full flex items-center justify-center text-white mr-2" style="background-color: ${badge.color || '#ff6b1a'}">
                <i class="fas fa-${badge.icono || 'trophy'}"></i>
            </div>`
        }
        <span class="font-medium">${badge.nombre}</span>
    `;
    
    // Actualizar el valor del input hidden
    hiddenInput.value = badgeId;
    
    // Cerrar modal
    badgeSelectModal.classList.add('hidden');
}

// Cargar torneos para la tabla
async function loadTorneos() {
    try {
        console.log("Iniciando loadTorneos...");
        console.log("torneosTable element:", torneosTable);
        
        if (!torneosTable) {
            console.error("Elemento torneosTable no encontrado");
            return;
        }
        
        console.log("Mostrando estado de carga...");
        // Mostrar estado de carga
        torneosTable.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center">
                    <div class="flex justify-center">
                        <div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
                    </div>
                    <p class="text-sm text-gray-500 mt-2">Cargando torneos...</p>
                </td>
            </tr>
        `;
        
        console.log("Consultando Firestore...");
        // Consultar torneos en Firestore
        const torneosSnapshot = await db.collection("torneos").get();
        console.log("Resultado de consulta:", torneosSnapshot.size, "torneos encontrados");
        
        // Verificar si hay torneos
        if (torneosSnapshot.empty) {
            torneosTable.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                        No hay torneos disponibles
                    </td>
                </tr>
            `;
            return;
        }
        
        // Construir array de torneos
        const torneos = [];
        torneosSnapshot.forEach(doc => {
            torneos.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Ordenar por fecha (más recientes primero)
        torneos.sort((a, b) => {
            const dateA = a.fecha ? new Date(a.fecha.seconds * 1000) : new Date(0);
            const dateB = b.fecha ? new Date(b.fecha.seconds * 1000) : new Date(0);
            return dateB - dateA;
        });
        
        // Renderizar torneos en la tabla
        renderTorneosTable(torneos);
        
    } catch (error) {
        console.error("Error al cargar torneos:", error);
        torneosTable.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-red-500">
                    Error al cargar torneos: ${error.message}
                    <button class="block mx-auto mt-2 text-blue-500 underline" onclick="window.location.reload()">
                        Reintentar
                    </button>
                </td>
            </tr>
        `;
    }
}

// Renderizar torneos en la tabla
function renderTorneosTable(torneos) {
    if (!torneosTable) return;
    
    let html = '';
    
    torneos.forEach(torneo => {
        // Formatear fecha
        const fecha = torneo.fecha ? new Date(torneo.fecha.seconds * 1000) : new Date();
        const fechaFormateada = fecha.toLocaleDateString('es-ES');
        
        // Calcular inscritos
        const inscritos = torneo.participants ? torneo.participants.length : 0;
        
        // Estado con color
        let estadoClass = '';
        switch (torneo.estado) {
            case 'Abierto':
                estadoClass = 'bg-green-100 text-green-800';
                break;
            case 'En Progreso':
                estadoClass = 'bg-yellow-100 text-yellow-800';
                break;
            case 'Próximamente':
                estadoClass = 'bg-blue-100 text-blue-800';
                break;
            case 'Finalizado':
                estadoClass = 'bg-gray-100 text-gray-800';
                break;
            default:
                estadoClass = 'bg-gray-100 text-gray-800';
        }
        
        // Visibilidad
        const visibleClass = torneo.visible !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        const visibleText = torneo.visible !== false ? 'Visible' : 'Oculto';
        
        html += `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                        ${torneo.nombre || 'Sin nombre'}
                        ${torneo.bracketsLink ? `<span class="inline-block ml-2 text-green-600 text-xs" title="Tiene brackets"><i class="fas fa-check-circle"></i> Brackets</span>` : ''}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">${fechaFormateada}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="text-sm text-gray-500">${inscritos}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${estadoClass}">
                        ${torneo.estado || 'Desconocido'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${visibleClass}">
                        ${visibleText}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-blue-600 hover:text-blue-900 mr-3 edit-tournament-btn" data-id="${torneo.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-600 hover:text-red-900 mr-3 delete-tournament-btn" data-id="${torneo.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                    ${torneo.estado === 'En Progreso' && torneo.bracketsLink ? `
                        <a href="${torneo.bracketsLink}" target="_blank" class="text-green-600 hover:text-green-900 ml-2" title="Ver brackets">
                            <i class="fas fa-bracket-square"></i>
                        </a>
                    ` : ''}
                </td>
            </tr>
        `;
    });
    
    torneosTable.innerHTML = html;
    
    // Agregar event listeners a los botones
    document.querySelectorAll('.edit-tournament-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tournamentId = btn.dataset.id;
            editTournament(tournamentId);
        });
    });
    
    document.querySelectorAll('.delete-tournament-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tournamentId = btn.dataset.id;
            deleteTournament(tournamentId);
        });
    });
}

// Cargar banners para el selector
async function loadBanners() {
    try {
        const bannerSelector = document.getElementById('bannerSelector');
        if (!bannerSelector) return;
        
        // Mostrar estado de carga
        bannerSelector.innerHTML = `
            <div class="flex justify-center items-center col-span-3 py-4">
                <div class="spinner rounded-full h-6 w-6 border-t-2 border-b-2 border-orange-500"></div>
                <p class="ml-2 text-sm text-gray-500">Cargando banners...</p>
            </div>
        `;
        
        // Consultar banners en Firestore
        const bannersSnapshot = await db.collection("banners").get();
        
        // Verificar si hay banners
        if (bannersSnapshot.empty) {
            bannerSelector.innerHTML = `
                <div class="col-span-3 text-center py-4">
                    <p class="text-gray-500">No hay banners disponibles</p>
                </div>
            `;
            return;
        }
        
        // Construir array de banners
        allBanners = [];
        bannersSnapshot.forEach(doc => {
            allBanners.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Renderizar banners en el selector
        renderBannerSelector(allBanners);
        
    } catch (error) {
        console.error("Error al cargar banners:", error);
        const bannerSelector = document.getElementById('bannerSelector');
        if (bannerSelector) {
            bannerSelector.innerHTML = `
                <div class="col-span-3 text-center py-4">
                    <p class="text-red-500">Error al cargar banners: ${error.message}</p>
                </div>
            `;
        }
    }
}

// Renderizar banners en el selector
function renderBannerSelector(banners) {
    const bannerSelector = document.getElementById('bannerSelector');
    if (!bannerSelector) return;
    
    let html = '';
    
    banners.forEach(banner => {
        const imageSource = banner.imageData || banner.imageUrl || 'https://via.placeholder.com/300x150';
        html += `
            <div class="banner-item border rounded overflow-hidden cursor-pointer hover:border-blue-500" data-banner-id="${banner.id}">
                <img src="${imageSource}" alt="${banner.nombre}" class="w-full h-24 object-cover">
                <div class="p-1 text-xs text-center truncate">${banner.nombre}</div>
            </div>
        `;
    });
    
    bannerSelector.innerHTML = html;
    
    // Agregar event listeners para seleccionar banner
    document.querySelectorAll('.banner-item').forEach(item => {
        item.addEventListener('click', () => {
            // Quitar selección anterior
            document.querySelectorAll('.banner-item').forEach(i => i.classList.remove('ring-2', 'ring-blue-500'));
            // Marcar como seleccionado
            item.classList.add('ring-2', 'ring-blue-500');
        });
    });
}

// Cargar badges para los selectores
async function loadBadges() {
    try {
        // Consultar badges en Firestore
        const badgesSnapshot = await db.collection("badges").get();
        
        // Construir array de badges
        allBadges = [];
        badgesSnapshot.forEach(doc => {
            allBadges.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
    } catch (error) {
        console.error("Error al cargar badges:", error);
        showError("Error al cargar badges. Algunas funciones pueden no estar disponibles.");
    }
}

// Mostrar formulario de torneo (crear o editar)
function showTournamentForm(isEditing, tournamentData = null) {
    if (!tournamentFormSection) return;
    
    // Actualizar estado
    isEditMode = isEditing;
    currentTournamentId = isEditing ? tournamentData.id : null;
    
    // Actualizar título del formulario
    if (formTitle) {
        formTitle.textContent = isEditing ? 'Editar Torneo' : 'Crear Nuevo Torneo';
    }
    
    // Actualizar texto del botón
    if (submitButton) {
        submitButton.textContent = isEditing ? 'Actualizar Torneo' : 'Crear Torneo';
    }
    
    // Restablecer formulario
    if (createTournamentForm) {
        createTournamentForm.reset();
    }
    
    // Si estamos editando, llenar el formulario con los datos
    if (isEditing && tournamentData) {
        fillFormWithTournamentData(tournamentData);
    }
    
    // Mostrar sección del formulario
    tournamentFormSection.classList.remove('hidden');
    
    // Desplazarse al formulario
    tournamentFormSection.scrollIntoView({ behavior: 'smooth' });
}

// Actualizar el estado de Challonge en la UI
function updateChallongeStatus(isLinked, challongeData = null) {
    const statusDiv = document.getElementById('challongeStatus');
    if (!statusDiv) return;
    
    if (isLinked && challongeData) {
        statusDiv.className = 'p-3 rounded bg-green-50 border border-green-200 text-sm text-green-700';
        statusDiv.innerHTML = `
            <i class="fas fa-check-circle mr-2"></i>
            <strong>Vinculado:</strong> ${challongeData.slug || 'Sin slug'}
            <br>
            <small>Username: ${challongeData.username || 'N/A'}</small>
        `;
        // Actualizar estado del botón
        if (linkChallongeBtn) {
            linkChallongeBtn.disabled = true;
            linkChallongeBtn.innerHTML = '<i class="fas fa-check-circle mr-2"></i>✓ Vinculado';
            linkChallongeBtn.classList.remove('bg-purple-600', 'hover:bg-purple-700');
            linkChallongeBtn.classList.add('bg-green-600', 'cursor-not-allowed');
        }
    } else {
        statusDiv.className = 'p-3 rounded bg-gray-50 border border-gray-200 text-sm text-gray-600';
        statusDiv.innerHTML = '<i class="fas fa-unlink mr-2"></i>Sin vincular';
        // Restablecer estado del botón
        if (linkChallongeBtn) {
            linkChallongeBtn.disabled = false;
            linkChallongeBtn.innerHTML = '<i class="fas fa-link mr-2"></i>Vincular con Challonge';
            linkChallongeBtn.classList.remove('bg-green-600', 'cursor-not-allowed');
            linkChallongeBtn.classList.add('bg-purple-600', 'hover:bg-purple-700');
        }
    }
}

// Llenar formulario con datos de un torneo
function fillFormWithTournamentData(tournamentData) {
    console.log("Llenando formulario con datos:", tournamentData);
    
    // Campos básicos
    document.getElementById('nombreTorneo').value = tournamentData.nombre || '';
    document.getElementById('descripcionTorneo').value = tournamentData.descripcion || '';
    
    // Manejar fecha y hora
    if (tournamentData.fechaHora) {
        // Nuevo formato: fechaHora en UTC, convertir a zona local del admin
        console.log("Usando fechaHora:", tournamentData.fechaHora);
        
        let fechaLocal;
        if (tournamentData.fechaHora.toDate) {
            // Es un Timestamp de Firebase
            fechaLocal = tournamentData.fechaHora.toDate();
        } else {
            // Es una fecha normal
            fechaLocal = new Date(tournamentData.fechaHora);
        }
        
        // Convertir a zona horaria local del admin
        const adminTimeZone = getUserTimeZone();
        const fechaEnZonaAdmin = new Date(fechaLocal.toLocaleString("en-US", { timeZone: adminTimeZone }));
        
        // Formatear para los inputs
        const year = fechaEnZonaAdmin.getFullYear();
        const month = String(fechaEnZonaAdmin.getMonth() + 1).padStart(2, '0');
        const day = String(fechaEnZonaAdmin.getDate()).padStart(2, '0');
        const hours = String(fechaEnZonaAdmin.getHours()).padStart(2, '0');
        const minutes = String(fechaEnZonaAdmin.getMinutes()).padStart(2, '0');
        
        document.getElementById('fechaTorneo').value = `${year}-${month}-${day}`;
        document.getElementById('horaTorneo').value = `${hours}:${minutes}`;
        
        console.log("Fecha local para el admin:", `${year}-${month}-${day} ${hours}:${minutes}`);
        
    } else if (tournamentData.fecha) {
        // Formato anterior: fecha y hora separadas (compatibilidad hacia atrás)
        console.log("Usando formato anterior - fecha:", tournamentData.fecha, "hora:", tournamentData.hora);
        
        const date = new Date(tournamentData.fecha.seconds * 1000);
        const formattedDate = date.toISOString().split('T')[0];
        document.getElementById('fechaTorneo').value = formattedDate;
        document.getElementById('horaTorneo').value = tournamentData.hora || '';
    }
    
    // Capacidad
    document.getElementById('capacidadTorneo').value = tournamentData.capacidad || '';
    
    // Estado
    document.getElementById('estadoTorneo').value = tournamentData.estado || 'Próximamente';
    
    // Brackets Link
    document.getElementById('bracketsLink').value = tournamentData.bracketsLink || '';
    
    // Datos de Challonge
    if (tournamentData.challonge) {
        document.getElementById('challongeUrl').value = tournamentData.challonge.url || '';
        document.getElementById('challongeUsername').value = tournamentData.challonge.username || '';
        updateChallongeStatus(true, tournamentData.challonge);
    } else {
        document.getElementById('challongeUrl').value = '';
        document.getElementById('challongeUsername').value = '';
        updateChallongeStatus(false);
    }
    
    // Puntos por posición
    if (tournamentData.puntosPosicion) {
        document.getElementById('puntos1').value = tournamentData.puntosPosicion[1] || '';
        document.getElementById('puntos2').value = tournamentData.puntosPosicion[2] || '';
        document.getElementById('puntos3').value = tournamentData.puntosPosicion[3] || '';
    }
    
    // Visibilidad
    document.getElementById('torneoVisible').checked = tournamentData.visible !== false;
    
    // Seleccionar banner si existe
    if (tournamentData.bannerId) {
        setTimeout(() => {
            const bannerItem = document.querySelector(`.banner-item[data-banner-id="${tournamentData.bannerId}"]`);
            if (bannerItem) {
                bannerItem.click();
            }
        }, 500);
    }
    
    // Cargar badges asignados si existen
    loadTournamentBadges(tournamentData.id);
}

// Cargar badges asignados a un torneo
async function loadTournamentBadges(tournamentId) {
    try {
        const badgesSnapshot = await db.collection("tournament_badges")
            .where("tournamentId", "==", tournamentId)
            .get();
        
        if (badgesSnapshot.empty) return;
        
        badgesSnapshot.forEach(doc => {
            const badgeData = doc.data();
            let targetId = '';
            
            // Determinar el target según la posición
            switch (badgeData.position) {
                case 'first':
                    targetId = 'badge1Id';
                    break;
                case 'second':
                    targetId = 'badge2Id';
                    break;
                case 'top3':
                    targetId = 'badge3Id';
                    break;
                case 'all':
                    targetId = 'badgeParticipationId';
                    break;
            }
            
            if (targetId) {
                // Establecer el ID de la badge
                const hiddenInput = document.getElementById(targetId);
                if (hiddenInput) {
                    hiddenInput.value = badgeData.badgeId;
                    
                    // Actualizar la vista previa
                    updateBadgePreview(targetId.replace('Id', 'Preview'), badgeData.badgeId);
                }
            }
        });
        
    } catch (error) {
        console.error("Error al cargar badges del torneo:", error);
    }
}

// Actualizar vista previa de badge
function updateBadgePreview(previewId, badgeId) {
    const previewElement = document.getElementById(previewId);
    if (!previewElement) return;
    
    const badge = allBadges.find(b => b.id === badgeId);
    if (!badge) return;
    
    previewElement.innerHTML = `
        ${badge.imageUrl ? 
            `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-8 h-8 object-cover rounded-full mr-2">` : 
            `<div class="w-8 h-8 rounded-full flex items-center justify-center text-white mr-2" style="background-color: ${badge.color || '#ff6b1a'}">
                <i class="fas fa-${badge.icono || 'trophy'}"></i>
            </div>`
        }
        <span class="font-medium">${badge.nombre}</span>
    `;
}

// Ocultar formulario de torneo
function hideTournamentForm() {
    if (tournamentFormSection) {
        tournamentFormSection.classList.add('hidden');
    }
    
    // Resetear estado
    isEditMode = false;
    currentTournamentId = null;
    
    // Limpiar selecciones
    document.querySelectorAll('.banner-item').forEach(item => {
        item.classList.remove('ring-2', 'ring-blue-500');
    });
}

// Manejar vinculación con Challonge (sin formulario)
async function handleLinkChallonge(e) {
    e.preventDefault();
    
    if (!currentTournamentId) {
        alert('Por favor, primero guarda el torneo antes de vincular con Challonge');
        return;
    }
    
    const url = challongeUrl?.value?.trim();
    const username = challongeUsername?.value?.trim();
    
    if (!url || !username) {
        alert('Por favor completa la URL y nombre de usuario de Challonge');
        return;
    }
    
    // Validar formato de URL
    const urlMatch = url.match(/challonge\.com\/(?:es\/)?([a-zA-Z0-9_-]+)/);
    if (!urlMatch) {
        alert('URL de Challonge inválida. Debe ser similar a: https://challonge.com/es/a5xuji6s');
        return;
    }
    
    const slug = urlMatch[1];
    
    try {
        // Cambiar estado del botón
        linkChallongeBtn.disabled = true;
        linkChallongeBtn.innerHTML = '<div class="spinner inline-block w-4 h-4 border-t-2 border-b-2 border-white rounded-full mr-2"></div> Vinculando...';
        
        // Guardar datos en Firestore
        const torneoRef = db.collection('torneos').doc(currentTournamentId);
        
        await torneoRef.update({
            'challonge.url': url,
            'challonge.slug': slug,
            'challonge.username': username,
            'challonge.apiKey': 'c6782be4d1c6b70d5eaeef76180a8f724ea743674e805da2',
            'challonge.linkedAt': firebase.firestore.FieldValue.serverTimestamp(),
            'challonge.status': 'pending_validation',
            'linkedToChallonge': true
        });
        
        // Actualizar interfaz
        if (challongeStatus) {
            challongeStatus.innerHTML = '<i class="fas fa-check-circle mr-2"></i><strong>Vinculado:</strong> ' + slug;
            challongeStatus.className = 'p-3 rounded bg-green-50 border border-green-200 text-sm text-green-700';
        }
        
        linkChallongeBtn.disabled = true;
        linkChallongeBtn.innerHTML = '<i class="fas fa-check-circle mr-2"></i>✓ Vinculado';
        linkChallongeBtn.classList.remove('bg-purple-600', 'hover:bg-purple-700');
        linkChallongeBtn.classList.add('bg-green-600', 'cursor-not-allowed');
        
        console.log('✓ Torneo vinculado exitosamente con Challonge:', slug);
        
    } catch (error) {
        console.error('Error al vincular con Challonge:', error);
        alert('Error al vincular con Challonge: ' + error.message);
        linkChallongeBtn.disabled = false;
        linkChallongeBtn.innerHTML = '<i class="fas fa-link mr-2"></i>Vincular con Challonge';
    }
}

// Manejar envío del formulario de torneo
async function handleTournamentFormSubmit(e) {
    e.preventDefault();
    
    try {
        // Deshabilitar botón para evitar doble envío
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<div class="spinner inline-block w-5 h-5 border-t-2 border-b-2 border-white rounded-full mr-2"></div> Procesando...';
        }
        
        // Recopilar datos del formulario
        const fechaInput = document.getElementById('fechaTorneo').value;
        const horaInput = document.getElementById('horaTorneo').value;
        
        // Convertir fecha y hora local a UTC
        let fechaHoraUTC;
        if (fechaInput && horaInput) {
            fechaHoraUTC = convertLocalToUTC(fechaInput, horaInput);
        } else {
            fechaHoraUTC = new Date(); // Fecha actual si no se especifica
        }
        
        const tournamentData = {
            nombre: document.getElementById('nombreTorneo').value.trim(),
            descripcion: document.getElementById('descripcionTorneo').value.trim(),
            fechaHora: fechaHoraUTC, // Guardamos fecha y hora juntas en UTC
            capacidad: parseInt(document.getElementById('capacidadTorneo').value) || null,
            estado: document.getElementById('estadoTorneo').value,
            puntosPosicion: {
                1: parseInt(document.getElementById('puntos1').value) || 0,
                2: parseInt(document.getElementById('puntos2').value) || 0,
                3: parseInt(document.getElementById('puntos3').value) || 0
            },
            visible: document.getElementById('torneoVisible').checked,
            bracketsLink: document.getElementById('bracketsLink').value.trim() || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            // Guardamos la zona horaria del creador para referencia
            timeZoneCreador: getUserTimeZone()
        };
        
        // Agregar datos de Challonge si están especificados
        const challongeUrl = document.getElementById('challongeUrl').value.trim();
        const challongeUsername = document.getElementById('challongeUsername').value.trim();
        
        if (challongeUrl && challongeUsername) {
            // Validar y extraer slug del URL
            const urlMatch = challongeUrl.match(/challonge\.com\/([^\/]+\/)?([\w-]+)/);
            if (urlMatch) {
                const slug = urlMatch[2]; // Captura el slug
                tournamentData.challonge = {
                    url: challongeUrl,
                    slug: slug,
                    username: challongeUsername,
                    apiKey: 'c6782be4d1c6b70d5eaeef76180a8f724ea743674e805da2', // API Key
                    linkedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'pending_validation'
                };
                tournamentData.linkedToChallonge = true;
            } else {
                throw new Error("URL de Challonge inválida. Verifica que sea una URL de Challonge válida");
            }
        } else {
            // Si no hay datos de Challonge, asegurarse de limpiar la vinculación
            if (isEditMode) {
                tournamentData.linkedToChallonge = false;
                tournamentData.challonge = null;
            }
        }
        
        // Validar campos obligatorios
        if (!tournamentData.nombre) {
            throw new Error("El nombre del torneo es obligatorio");
        }
        
        // Obtener banner seleccionado
        const selectedBanner = document.querySelector('.banner-item.ring-2.ring-blue-500');
        if (selectedBanner) {
            tournamentData.bannerId = selectedBanner.dataset.bannerId;
        }
        
        // Si es creación, añadir campos adicionales
        if (!isEditMode) {
            tournamentData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            tournamentData.createdBy = auth.currentUser ? auth.currentUser.uid : null;
            tournamentData.participants = [];
        }
        
        // Guardar torneo en Firestore
        let tournamentId;
        if (isEditMode && currentTournamentId) {
            // Actualizar torneo existente
            await db.collection("torneos").doc(currentTournamentId).update(tournamentData);
            tournamentId = currentTournamentId;
        } else {
            // Crear nuevo torneo
            const docRef = await db.collection("torneos").add(tournamentData);
            tournamentId = docRef.id;
        }
        
        // Procesar badges asignadas al torneo
        await processTournamentBadges(tournamentId);
        
        // Mostrar mensaje de éxito
        alert(isEditMode ? "Torneo actualizado correctamente" : "Torneo creado correctamente");
        
        // Ocultar formulario
        hideTournamentForm();
        
        // Recargar lista de torneos
        await loadTorneos();
        
    } catch (error) {
        console.error("Error al guardar torneo:", error);
        alert("Error: " + error.message);
    } finally {
        // Restaurar botón
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = isEditMode ? 'Actualizar Torneo' : 'Crear Torneo';
        }
    }
}

// Procesar badges asignadas a un torneo
async function processTournamentBadges(tournamentId) {
    try {
        // Eliminar asignaciones existentes
        const existingBadgesSnapshot = await db.collection("tournament_badges")
            .where("tournamentId", "==", tournamentId)
            .get();
        
        const deletePromises = [];
        existingBadgesSnapshot.forEach(doc => {
            deletePromises.push(doc.ref.delete());
        });
        
        await Promise.all(deletePromises);
        
        // Crear nuevas asignaciones
        const badgeAssignments = [
            { id: document.getElementById('badge1Id').value, position: 'first' },
            { id: document.getElementById('badge2Id').value, position: 'second' },
            { id: document.getElementById('badge3Id').value, position: 'top3' },
            { id: document.getElementById('badgeParticipationId').value, position: 'all' }
        ];
        
        const createPromises = [];
        
        badgeAssignments.forEach(assignment => {
            if (assignment.id) {
                createPromises.push(
                    db.collection("tournament_badges").add({
                        tournamentId: tournamentId,
                        badgeId: assignment.id,
                        position: assignment.position,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        createdBy: auth.currentUser ? auth.currentUser.uid : null
                    })
                );
            }
        });
        
        await Promise.all(createPromises);
        
    } catch (error) {
        console.error("Error al procesar badges del torneo:", error);
        throw error;
    }
}

// Editar un torneo existente
async function editTournament(tournamentId) {
    try {
        // Obtener datos del torneo
        const tournamentDoc = await db.collection("torneos").doc(tournamentId).get();
        
        if (!tournamentDoc.exists) {
            alert("El torneo no existe");
            return;
        }
        
        // Mostrar formulario en modo edición
        showTournamentForm(true, {
            id: tournamentId,
            ...tournamentDoc.data()
        });
        
    } catch (error) {
        console.error("Error al cargar torneo para editar:", error);
        alert("Error al cargar torneo: " + error.message);
    }
}

// Eliminar un torneo
async function deleteTournament(tournamentId) {
    try {
        // Confirmar eliminación
        if (!confirm("¿Estás seguro de eliminar este torneo? Esta acción no se puede deshacer.")) {
            return;
        }
        
        // Eliminar torneo
        await db.collection("torneos").doc(tournamentId).delete();
        
        // Eliminar badges asociadas al torneo
        const badgesSnapshot = await db.collection("tournament_badges")
            .where("tournamentId", "==", tournamentId)
            .get();
        
        const deletePromises = [];
        badgesSnapshot.forEach(doc => {
            deletePromises.push(doc.ref.delete());
        });
        
        await Promise.all(deletePromises);
        
        // Mostrar mensaje de éxito
        alert("Torneo eliminado correctamente");
        
        // Recargar lista de torneos
        await loadTorneos();
        
    } catch (error) {
        console.error("Error al eliminar torneo:", error);
        alert("Error al eliminar torneo: " + error.message);
    }
}

// Mostrar mensaje de error
function showError(message) {
    alert(message);
}
