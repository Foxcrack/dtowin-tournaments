// tournaments.js - Script para la gestión de torneos en el panel de administración

// Referencias a elementos DOM
const torneosTable = document.getElementById('torneosTable');
const createTournamentForm = document.getElementById('createTournamentForm');
const tournamentFormSection = document.getElementById('tournamentFormSection');
const headerCreateTournamentBtn = document.getElementById('headerCreateTournamentBtn');
const cancelButton = document.getElementById('cancelButton');
const submitButton = document.getElementById('submitButton');
const formTitle = document.getElementById('formTitle');

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
        if (!torneosTable) return;
        
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
        
        // Consultar torneos en Firestore
        const torneosSnapshot = await db.collection("torneos").get();
        
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
        // Formatear fecha - manejar tanto Timestamp como Date
        let fechaFormateada = 'Fecha no disponible';
        const fechaField = torneo.fechaHora || torneo.fecha;
        if (fechaField) {
            let fecha;
            // Si es un string con formato "20 de diciembre de 2025 a las 3:00:00 p.m. UTC-5"
            if (typeof fechaField === 'string') {
                // Extraer la fecha en formato "20 de diciembre de 2025"
                const match = fechaField.match(/(\d+)\s+de\s+(\w+)\s+de\s+(\d+)/);
                if (match) {
                    const dia = match[1];
                    const mesNombre = match[2];
                    const año = match[3];
                    
                    const meses = {
                        'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
                        'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
                        'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
                    };
                    
                    const mes = meses[mesNombre.toLowerCase()];
                    if (mes) {
                        fecha = new Date(`${año}-${mes}-${dia.padStart(2, '0')}`);
                    }
                } else {
                    // Intentar parsear como fecha normal
                    fecha = new Date(fechaField);
                }
            }
            // Si es un Timestamp de Firestore (tiene .seconds)
            else if (fechaField.seconds) {
                fecha = new Date(fechaField.seconds * 1000);
            } 
            // Si es un objeto serializado de Firestore (tiene _seconds)
            else if (fechaField._seconds) {
                fecha = new Date(fechaField._seconds * 1000);
            }
            // Si es un string de fecha
            else if (typeof fechaField === 'string') {
                fecha = new Date(fechaField);
            }
            // Si es un Date de JavaScript
            else if (fechaField instanceof Date) {
                fecha = fechaField;
            }
            
            if (fecha && !isNaN(fecha.getTime())) {
                fechaFormateada = fecha.toLocaleDateString('es-ES');
            }
        }
        
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
                    <div class="text-sm font-medium text-gray-900">${torneo.nombre || 'Sin nombre'}</div>
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
                    ${torneo.estado === 'En Progreso' ? `
                        <a href="bracket.html?id=${torneo.id}" target="_blank" class="text-yellow-600 hover:text-yellow-900" title="Ver bracket">
                            <i class="fas fa-trophy"></i>
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

// Llenar formulario con datos de un torneo
function fillFormWithTournamentData(tournamentData) {
    // Campos básicos
    document.getElementById('nombreTorneo').value = tournamentData.nombre || '';
    document.getElementById('descripcionTorneo').value = tournamentData.descripcion || '';
    
    // Fecha (formato YYYY-MM-DD)
    if (tournamentData.fecha) {
        let date;
        // Si es un Timestamp de Firestore (tiene .seconds)
        if (tournamentData.fecha.seconds) {
            date = new Date(tournamentData.fecha.seconds * 1000);
        }
        // Si es un objeto serializado de Firestore (tiene _seconds)
        else if (tournamentData.fecha._seconds) {
            date = new Date(tournamentData.fecha._seconds * 1000);
        }
        // Si es un string de fecha
        else if (typeof tournamentData.fecha === 'string') {
            date = new Date(tournamentData.fecha);
        }
        // Si es un Date de JavaScript
        else if (tournamentData.fecha instanceof Date) {
            date = tournamentData.fecha;
        }
        
        if (date && !isNaN(date.getTime())) {
            const formattedDate = date.toISOString().split('T')[0];
            document.getElementById('fechaTorneo').value = formattedDate;
        }
    }
    
    // Hora
    document.getElementById('horaTorneo').value = tournamentData.hora || '';
    
    // Capacidad
    document.getElementById('capacidadTorneo').value = tournamentData.capacidad || '';
    
    // Estado
    document.getElementById('estadoTorneo').value = tournamentData.estado || 'Próximamente';
    
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

// Manejar envío del formulario de torneo
async function handleTournamentFormSubmit(e) {
    e.preventDefault();
    
    try {
        // Deshabilitar botón para evitar doble envío
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<div class="spinner inline-block w-5 h-5 border-t-2 border-b-2 border-white rounded-full mr-2"></div> Procesando...';
        }
        
        // Obtener la fecha del input y convertirla a Timestamp de Firestore
        const fechaInput = document.getElementById('fechaTorneo').value;
        const horaInput = document.getElementById('horaTorneo').value;
        
        let fechaTimestamp = null;
        if (fechaInput) {
            // Crear la fecha a partir del input de fecha (formato YYYY-MM-DD)
            // Construir un string ISO que represente la medianoche en la zona local
            const fechaDate = new Date(fechaInput + 'T00:00:00');
            
            // Ajustar por la zona horaria local para que Firestore guarde la fecha correcta
            const offset = fechaDate.getTimezoneOffset() * 60000; // convertir a milisegundos
            const fechaAjustada = new Date(fechaDate.getTime() - offset);
            
            // Convertir a Timestamp de Firestore
            fechaTimestamp = firebase.firestore.Timestamp.fromDate(fechaAjustada);
        }
        
        // Recopilar datos del formulario
        const tournamentData = {
            nombre: document.getElementById('nombreTorneo').value.trim(),
            descripcion: document.getElementById('descripcionTorneo').value.trim(),
            fecha: fechaTimestamp,
            hora: horaInput, // Guardar solo como string HH:MM
            capacidad: parseInt(document.getElementById('capacidadTorneo').value) || null,
            estado: document.getElementById('estadoTorneo').value,
            puntosPosicion: {
                1: parseInt(document.getElementById('puntos1').value) || 0,
                2: parseInt(document.getElementById('puntos2').value) || 0,
                3: parseInt(document.getElementById('puntos3').value) || 0
            },
            visible: document.getElementById('torneoVisible').checked,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
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
