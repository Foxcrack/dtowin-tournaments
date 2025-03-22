// tournaments.js - Script para la gestión de torneos

// Variables para gestionar el estado
let isEditMode = false;
let currentTournamentId = null;
let selectedBadges = [];
let selectedBannerId = null;
let availableBadges = [];
let availableBanners = [];

// Referencias DOM
const tournamentFormSection = document.getElementById('tournamentFormSection');
const createTournamentForm = document.getElementById('createTournamentForm');
const headerCreateTournamentBtn = document.getElementById('headerCreateTournamentBtn');
const formTitle = document.getElementById('formTitle');
const cancelButton = document.getElementById('cancelButton');
const submitButton = document.getElementById('submitButton');
const bannerSelector = document.getElementById('bannerSelector');
const badgesContainer = document.getElementById('badgesContainer');
const badgeSelectModal = document.getElementById('badgeSelectModal');
const badgesList = document.getElementById('badgesList');
const addBadgeBtn = document.getElementById('addBadgeBtn');
const closeBadgeModal = document.getElementById('closeBadgeModal');
const torneosTable = document.getElementById('torneosTable');

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticación
    firebase.auth().onAuthStateChanged(async function(user) {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            // Verificar si es administrador
            const isAdmin = await esUsuarioAdmin(user.uid);
            
            if (!isAdmin) {
                mostrarNotificacion("No tienes permisos para gestionar torneos", "error");
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 3000);
                return;
            }
            
            console.log("Usuario validado como administrador");
            
            // Inicializar
            init();
            
        } else {
            console.log("No hay usuario autenticado");
            window.location.href = "index.html";
        }
    });
});

// Función para verificar si el usuario es administrador
async function esUsuarioAdmin(userId) {
    try {
        // Lista de IDs de administradores
        const adminUIDs = ["dvblFee1ZnVKJNWBOR22tSAsNet2"];
        
        // Si está en la lista directamente
        if (adminUIDs.includes(userId)) {
            return true;
        }
        
        // Verificar en base de datos
        const snapshot = await firebase.firestore().collection("usuarios")
            .where("uid", "==", userId)
            .where("isHost", "==", true)
            .get();
        
        return !snapshot.empty;
    } catch (error) {
        console.error("Error al verificar si es administrador:", error);
        return false;
    }
}

// Inicializar gestión de torneos
async function init() {
    try {
        console.log("Inicializando gestión de torneos...");
        
        // Configurar listeners
        setupEventListeners();
        
        // Cargar datos necesarios
        await Promise.all([
            loadBanners(),
            loadBadges(),
            loadTournaments()
        ]);
        
    } catch (error) {
        console.error("Error al inicializar gestión de torneos:", error);
        mostrarNotificacion("Error al cargar la gestión de torneos", "error");
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Botón crear torneo
    if (headerCreateTournamentBtn) {
        headerCreateTournamentBtn.addEventListener('click', function() {
            resetForm();
            showForm();
        });
    }
    
    // Botón cancelar
    if (cancelButton) {
        cancelButton.addEventListener('click', function() {
            hideForm();
        });
    }
    
    // Formulario
    if (createTournamentForm) {
        createTournamentForm.addEventListener('submit', handleTournamentSubmit);
    }
    
    // Botón añadir badge
    if (addBadgeBtn) {
        addBadgeBtn.addEventListener('click', function() {
            showBadgeModal();
        });
    }
    
    // Cerrar modal de badges
    if (closeBadgeModal) {
        closeBadgeModal.addEventListener('click', function() {
            hideBadgeModal();
        });
    }
}

// Mostrar formulario
function showForm() {
    if (tournamentFormSection) {
        tournamentFormSection.classList.remove('hidden');
        tournamentFormSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Ocultar formulario
function hideForm() {
    if (tournamentFormSection) {
        tournamentFormSection.classList.add('hidden');
    }
}

// Resetear formulario
function resetForm() {
    console.log("Reseteando formulario");
    
    // Limpiar valores del formulario
    if (createTournamentForm) {
        createTournamentForm.reset();
        
        // Establecer fecha por defecto (hoy)
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('fechaTorneo').value = today;
        
        // Resetear modo edición
        isEditMode = false;
        currentTournamentId = null;
        
        // Resetear badges seleccionados
        selectedBadges = [];
        updateSelectedBadgesUI();
        
        // Resetear banner seleccionado
        selectedBannerId = null;
        updateSelectedBannerUI();
        
        // Actualizar título y botón
        if (formTitle) {
            formTitle.textContent = 'Crear Nuevo Torneo';
        }
        
        if (submitButton) {
            submitButton.textContent = 'Crear Torneo';
        }
    }
}

// Cargar banners disponibles
async function loadBanners() {
    try {
        if (bannerSelector) {
            bannerSelector.innerHTML = '<div class="flex justify-center"><div class="spinner rounded-full h-6 w-6 border-t-2 border-b-2 border-orange-500"></div></div>';
            
            // Obtener banners desde Firestore
            const bannersSnapshot = await firebase.firestore().collection("banners").get();
            
            if (bannersSnapshot.empty) {
                bannerSelector.innerHTML = '<p class="text-center text-gray-500">No hay banners disponibles</p>';
                availableBanners = [];
                return;
            }
            
            // Procesar banners
            availableBanners = [];
            let html = '';
            
            bannersSnapshot.forEach(doc => {
                const banner = {
                    id: doc.id,
                    ...doc.data()
                };
                
                availableBanners.push(banner);
                
                // Crear tarjeta para selección
                html += `
                    <div class="banner-option cursor-pointer border rounded overflow-hidden hover:border-blue-500" data-banner-id="${banner.id}">
                        <img src="${banner.imageUrl || banner.imageData}" alt="${banner.nombre}" class="w-full h-20 object-cover">
                        <div class="text-xs p-1 truncate bg-gray-100">${banner.nombre}</div>
                    </div>
                `;
            });
            
            bannerSelector.innerHTML = html;
            
            // Añadir event listeners
            document.querySelectorAll('.banner-option').forEach(option => {
                option.addEventListener('click', function() {
                    const bannerId = this.dataset.bannerId;
                    selectBanner(bannerId);
                });
            });
            
        }
    } catch (error) {
        console.error("Error al cargar banners:", error);
        if (bannerSelector) {
            bannerSelector.innerHTML = '<p class="text-center text-red-500">Error al cargar banners</p>';
        }
    }
}

// Cargar badges disponibles
async function loadBadges() {
    try {
        // Obtener badges desde Firestore
        const badgesSnapshot = await firebase.firestore().collection("badges").get();
        
        if (badgesSnapshot.empty) {
            availableBadges = [];
            return;
        }
        
        // Procesar badges
        availableBadges = [];
        
        badgesSnapshot.forEach(doc => {
            availableBadges.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
    } catch (error) {
        console.error("Error al cargar badges:", error);
        mostrarNotificacion("Error al cargar badges", "error");
    }
}

// Seleccionar banner
function selectBanner(bannerId) {
    selectedBannerId = bannerId;
    updateSelectedBannerUI();
}

// Actualizar UI de banner seleccionado
function updateSelectedBannerUI() {
    document.querySelectorAll('.banner-option').forEach(option => {
        if (option.dataset.bannerId === selectedBannerId) {
            option.classList.add('border-2', 'border-blue-500');
        } else {
            option.classList.remove('border-2', 'border-blue-500');
        }
    });
}

// Mostrar modal de selección de badges
function showBadgeModal() {
    if (badgeSelectModal && badgesList) {
        // Actualizar lista de badges disponibles
        updateBadgesListUI();
        
        // Mostrar modal
        badgeSelectModal.classList.remove('hidden');
        badgeSelectModal.classList.add('flex');
    }
}

// Ocultar modal de selección de badges
function hideBadgeModal() {
    if (badgeSelectModal) {
        badgeSelectModal.classList.add('hidden');
        badgeSelectModal.classList.remove('flex');
    }
}

// Actualizar lista de badges en el modal
function updateBadgesListUI() {
    if (!badgesList || availableBadges.length === 0) {
        badgesList.innerHTML = '<p class="text-center text-gray-500">No hay badges disponibles</p>';
        return;
    }
    
    let html = '';
    
    availableBadges.forEach(badge => {
        // Verificar si ya está seleccionado
        const isSelected = selectedBadges.some(selected => selected.id === badge.id);
        
        html += `
            <div class="badge-option flex items-center p-2 border-b ${isSelected ? 'bg-blue-50' : ''}" data-badge-id="${badge.id}">
                <div class="h-10 w-10 mr-3 rounded-full flex items-center justify-center" style="background-color: ${badge.color || '#ff6b1a'}">
                    <i class="fas fa-${badge.icono || 'trophy'} text-white"></i>
                </div>
                <div class="flex-grow">
                    <h4 class="font-semibold">${badge.nombre}</h4>
                    <p class="text-xs text-gray-600">${badge.descripcion || ''}</p>
                </div>
                <button type="button" class="text-blue-500 hover:text-blue-700 select-badge-btn p-2">
                    ${isSelected ? '<i class="fas fa-check-circle"></i>' : '<i class="far fa-circle"></i>'}
                </button>
            </div>
        `;
    });
    
    badgesList.innerHTML = html;
    
    // Añadir event listeners
    document.querySelectorAll('.select-badge-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const badgeId = this.closest('.badge-option').dataset.badgeId;
            toggleBadgeSelection(badgeId);
        });
    });
}

// Alternar selección de badge
function toggleBadgeSelection(badgeId) {
    const isSelected = selectedBadges.some(badge => badge.id === badgeId);
    
    if (isSelected) {
        // Si ya está seleccionado, quitarlo
        selectedBadges = selectedBadges.filter(badge => badge.id !== badgeId);
    } else {
        // Si no está seleccionado, añadirlo
        const badge = availableBadges.find(b => b.id === badgeId);
        if (badge) {
            selectedBadges.push(badge);
        }
    }
    
    // Actualizar UIs
    updateBadgesListUI();
    updateSelectedBadgesUI();
}

// Actualizar badges seleccionados en el formulario
function updateSelectedBadgesUI() {
    if (!badgesContainer) return;
    
    if (selectedBadges.length === 0) {
        badgesContainer.innerHTML = '<p class="text-sm text-gray-500">No hay badges asignados a este torneo.</p>';
        return;
    }
    
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-2">';
    
    selectedBadges.forEach(badge => {
        html += `
            <div class="badge-item flex items-center bg-gray-50 p-2 rounded">
                <div class="h-8 w-8 mr-2 rounded-full flex items-center justify-center" style="background-color: ${badge.color || '#ff6b1a'}">
                    <i class="fas fa-${badge.icono || 'trophy'} text-white text-sm"></i>
                </div>
                <div class="flex-grow">
                    <h5 class="font-medium text-sm">${badge.nombre}</h5>
                </div>
                <button type="button" class="text-red-500 hover:text-red-700 remove-badge-btn p-1" data-badge-id="${badge.id}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    badgesContainer.innerHTML = html;
    
    // Añadir event listeners para eliminar badges
    document.querySelectorAll('.remove-badge-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const badgeId = this.dataset.badgeId;
            selectedBadges = selectedBadges.filter(badge => badge.id !== badgeId);
            updateSelectedBadgesUI();
            updateBadgesListUI();
        });
    });
}

// Manejar envío del formulario de torneo
async function handleTournamentSubmit(event) {
    event.preventDefault();
    
    // Obtener valores del formulario
    const nombre = document.getElementById('nombreTorneo').value.trim();
    const descripcion = document.getElementById('descripcionTorneo').value.trim();
    const fecha = document.getElementById('fechaTorneo').value;
    const hora = document.getElementById('horaTorneo').value;
    const capacidad = parseInt(document.getElementById('capacidadTorneo').value) || 10;
    const estado = document.getElementById('estadoTorneo').value;
    const visible = document.getElementById('torneoVisible').checked;
    const puntos = {
        primero: parseInt(document.getElementById('puntos1').value) || 0,
        segundo: parseInt(document.getElementById('puntos2').value) || 0,
        tercero: parseInt(document.getElementById('puntos3').value) || 0
    };
    
    // Validar campos requeridos
    if (!nombre) {
        mostrarNotificacion("El nombre del torneo es obligatorio", "error");
        return;
    }
    
    if (!fecha) {
        mostrarNotificacion("La fecha del torneo es obligatoria", "error");
        return;
    }
    
    if (!selectedBannerId) {
        mostrarNotificacion("Debes seleccionar un banner para el torneo", "error");
        return;
    }
    
    try {
        // Deshabilitar botón para evitar múltiples envíos
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Procesando...';
        }
        
        // Crear objeto de fecha completa
        const fechaHora = new Date(`${fecha}T${hora || '00:00'}`);
        
        // Preparar datos del torneo
        const torneoData = {
            nombre,
            descripcion,
            fecha: firebase.firestore.Timestamp.fromDate(fechaHora),
            capacidad,
            estado,
            visible,
            puntos,
            bannerId: selectedBannerId,
            badgesIds: selectedBadges.map(badge => badge.id),
            participants: []
        };
        
        if (isEditMode && currentTournamentId) {
            // Actualizar torneo existente
            await updateTournament(currentTournamentId, torneoData);
            mostrarNotificacion("Torneo actualizado correctamente", "success");
        } else {
            // Crear nuevo torneo
            await createTournament(torneoData);
            mostrarNotificacion("Torneo creado correctamente", "success");
        }
        
        // Resetear y ocultar formulario
        resetForm();
        hideForm();
        
        // Recargar lista de torneos
        await loadTournaments();
        
    } catch (error) {
        console.error("Error al procesar torneo:", error);
        mostrarNotificacion(error.message || "Error al procesar el torneo", "error");
    } finally {
        // Restaurar botón
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = isEditMode ? 'Actualizar Torneo' : 'Crear Torneo';
        }
    }
}

// Función para crear nuevo torneo
async function createTournament(torneoData) {
    // Añadir campos adicionales
    torneoData.createdBy = firebase.auth().currentUser.uid;
    torneoData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    torneoData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    
    // Guardar en Firestore
    const torneoRef = await firebase.firestore().collection("torneos").add(torneoData);
    
    return {
        id: torneoRef.id,
        success: true
    };
}

// Función para actualizar torneo existente
async function updateTournament(torneoId, torneoData) {
    // Añadir campos de actualización
    torneoData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    torneoData.updatedBy = firebase.auth().currentUser.uid;
    
    // Actualizar documento
    await firebase.firestore().collection("torneos").doc(torneoId).update(torneoData);
    
    return {
        id: torneoId,
        success: true
    };
}

// Función para cargar torneo para edición
async function loadTournamentForEdit(torneoId) {
    try {
        // Obtener datos del torneo
        const torneoDoc = await firebase.firestore().collection("torneos").doc(torneoId).get();
        
        if (!torneoDoc.exists) {
            throw new Error("No se encontró el torneo para editar");
        }
        
        const torneo = torneoDoc.data();
        console.log("Datos del torneo:", torneo);
        
        // Activar modo edición
        isEditMode = true;
        currentTournamentId = torneoId;
        
        // Llenar formulario con datos del torneo
        document.getElementById('nombreTorneo').value = torneo.nombre || '';
        document.getElementById('descripcionTorneo').value = torneo.descripcion || '';
        
        // Formatear fecha y hora
        if (torneo.fecha) {
            const fechaObj = torneo.fecha.toDate();
            document.getElementById('fechaTorneo').value = fechaObj.toISOString().split('T')[0];
            
            const horas = fechaObj.getHours().toString().padStart(2, '0');
            const minutos = fechaObj.getMinutes().toString().padStart(2, '0');
            document.getElementById('horaTorneo').value = `${horas}:${minutos}`;
        }
        
        document.getElementById('capacidadTorneo').value = torneo.capacidad || 10;
        document.getElementById('estadoTorneo').value = torneo.estado || 'Próximamente';
        document.getElementById('torneoVisible').checked = torneo.visible !== false;
        
        // Puntos
        if (torneo.puntos) {
            document.getElementById('puntos1').value = torneo.puntos.primero || 0;
            document.getElementById('puntos2').value = torneo.puntos.segundo || 0;
            document.getElementById('puntos3').value = torneo.puntos.tercero || 0;
        }
        
        // Banner
        selectedBannerId = torneo.bannerId;
        updateSelectedBannerUI();
        
        // Cargar badges
        selectedBadges = [];
        if (torneo.badgesIds && torneo.badgesIds.length > 0) {
            // Para cada ID de badge, buscar y añadir el objeto completo
            for (const badgeId of torneo.badgesIds) {
                const badge = availableBadges.find(b => b.id === badgeId);
                if (badge) {
                    selectedBadges.push(badge);
                }
            }
        }
        updateSelectedBadgesUI();
        
        // Actualizar título y botón
        if (formTitle) {
            formTitle.textContent = 'Editar Torneo';
        }
        
        if (submitButton) {
            submitButton.textContent = 'Actualizar Torneo';
        }
        
        // Mostrar formulario
        showForm();
        
    } catch (error) {
        console.error("Error al cargar torneo para editar:", error);
        mostrarNotificacion("Error al cargar torneo para editar", "error");
    }
}

// Cargar lista de torneos
async function loadTournaments() {
    try {
        if (!torneosTable) return;
        
        // Mostrar loader
        torneosTable.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">
                    <div class="flex justify-center">
                        <div class="spinner rounded-full h-6 w-6 border-t-2 border-b-2 border-orange-500"></div>
                    </div>
                </td>
            </tr>
        `;
        
        // Obtener torneos ordenados por fecha
        const torneosSnapshot = await firebase.firestore().collection("torneos")
            .orderBy("fecha", "desc")
            .get();
        
        if (torneosSnapshot.empty) {
            torneosTable.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">
                        No hay torneos disponibles
                    </td>
                </tr>
            `;
            return;
        }
        
        // Procesar torneos
        let html = '';
        
        torneosSnapshot.forEach(doc => {
            const torneo = {
                id: doc.id,
                ...doc.data()
            };
            
            // Formatear fecha
            const fechaStr = torneo.fecha ? formatDate(torneo.fecha.toDate()) : 'Sin fecha';
            
            // Determinar estado
            let estadoClass = 'bg-gray-100 text-gray-800';
            switch (torneo.estado) {
                case 'Próximamente':
                    estadoClass = 'bg-yellow-100 text-yellow-800';
                    break;
                case 'Abierto':
                    estadoClass = 'bg-green-100 text-green-800';
                    break;
                case 'En Progreso':
                    estadoClass = 'bg-blue-100 text-blue-800';
                    break;
                case 'Finalizado':
                    estadoClass = 'bg-gray-100 text-gray-800';
                    break;
            }
            
            // Determinar visibilidad
            const visibilidad = torneo.visible !== false;
            const visibilidadClass = visibilidad ? 
                'text-green-500' : 'text-gray-400';
            const visibilidadIcon = visibilidad ? 
                'fa-eye' : 'fa-eye-slash';
            
            // Crear fila de la tabla
            html += `
                <tr data-torneo-id="${torneo.id}">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="font-medium text-gray-900">${torneo.nombre || 'Sin nombre'}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${fechaStr}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${torneo.participants ? torneo.participants.length : 0} / ${torneo.capacidad || '∞'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${estadoClass}">
                            ${torneo.estado || 'Desconocido'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <button class="toggle-visibility-btn text-xl ${visibilidadClass}" title="${visibilidad ? 'Torneo visible' : 'Torneo oculto'}">
                            <i class="fas ${visibilidadIcon}"></i>
                        </button>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="text-blue-600 hover:text-blue-900 edit-torneo-btn mr-2" title="Editar torneo">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="text-red-600 hover:text-red-900 delete-torneo-btn" title="Eliminar torneo">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        torneosTable.innerHTML = html;
        
        // Añadir event listeners
        addTournamentRowListeners();
        
    } catch (error) {
        console.error("Error al cargar torneos:", error);
        
        if (torneosTable) {
            torneosTable.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-sm text-red-500">
                        Error al cargar torneos: ${error.message || "Error desconocido"}. 
                        <button class="text-blue-500 underline" onclick="location.reload()">Reintentar</button>
                    </td>
                </tr>
            `;
        }
    }
}

// Añadir event listeners a filas de torneos
function addTournamentRowListeners() {
    // Botones de edición
    document.querySelectorAll('.edit-torneo-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const torneoId = this.closest('tr').dataset.torneoId;
            loadTournamentForEdit(torneoId);
        });
    });
    
    // Botones de eliminación
    document.querySelectorAll('.delete-torneo-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const row = this.closest('tr');
            const torneoId = row.dataset.torneoId;
            const torneoNombre = row.querySelector('.font-medium').textContent;
            
            if (confirm(`¿Estás seguro que deseas eliminar el torneo "${torneoNombre}"?`)) {
                try {
                    // Mostrar estado de carga
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    this.disabled = true;
                    
                    await firebase.firestore().collection("torneos").doc(torneoId).delete();
                    
                    mostrarNotificacion("Torneo eliminado correctamente", "success");
                    
                    // Eliminar fila de la tabla
                    row.remove();
                    
                    // Si no quedan torneos, mostrar mensaje
                    if (torneosTable.querySelectorAll('tr').length === 0) {
                        torneosTable.innerHTML = `
                            <tr>
                                <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">
                                    No hay torneos disponibles
                                </td>
                            </tr>
                        `;
                    }
                    
                } catch (error) {
                    console.error("Error al eliminar torneo:", error);
                    mostrarNotificacion("Error al eliminar torneo", "error");
                    
                    // Restaurar botón
                    this.innerHTML = '<i class="fas fa-trash"></i>';
                    this.disabled = false;
                }
            }
        });
    });
    
    // Botones de visibilidad
    document.querySelectorAll('.toggle-visibility-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const row = this.closest('tr');
            const torneoId = row.dataset.torneoId;
            const isVisible = this.querySelector('i').classList.contains('fa-eye');
            
            try {
                // Mostrar estado de carga
                const originalHtml = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                this.disabled = true;
                
                // Actualizar visibilidad
                await firebase.firestore().collection("torneos").doc(torneoId).update({
                    visible: !isVisible,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Actualizar UI
                if (isVisible) {
                    this.innerHTML = '<i class="fas fa-eye-slash"></i>';
                    this.classList.remove('text-green-500');
                    this.classList.add('text-gray-400');
                    this.title = 'Torneo oculto';
                } else {
                    this.innerHTML = '<i class="fas fa-eye"></i>';
                    this.classList.remove('text-gray-400');
                    this.classList.add('text-green-500');
                    this.title = 'Torneo visible';
                }
                
                this.disabled = false;
                
                mostrarNotificacion(`Torneo ${isVisible ? 'ocultado' : 'visible'} correctamente`, "success");
                
            } catch (error) {
                console.error("Error al cambiar visibilidad:", error);
                mostrarNotificacion("Error al cambiar visibilidad", "error");
                
                // Restaurar botón
                this.innerHTML = originalHtml;
                this.disabled = false;
            }
        });
    });
}

// Formatear fecha para mostrar
function formatDate(date) {
    const day = date.getDate();
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} de ${month}, ${year}`;
}

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = "info") {
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

// Exportar funciones relevantes
export {
    loadTournaments,
    loadTournamentForEdit,
    createTournament,
    updateTournament
};
