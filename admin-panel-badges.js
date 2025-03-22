// admin-panel-badges.js - Script para la gestión de badges
import { 
    auth, 
    db, 
    storage, 
    isUserHost,
    badgesCollection
} from './firebase.js';

// Variables globales
let currentBadgeId = null;
let isEditMode = false;
let isInitialized = false;

// Agregar un temporizador para evitar bucles infinitos
let loadingTimeout;

// Exportar funciones para que puedan ser usadas por otros módulos
export function initBadgesManagement() {
    console.log("Inicializando sistema de badges...");
    
    // Establecer un temporizador para evitar espera infinita
    loadingTimeout = setTimeout(() => {
        console.error("Tiempo de espera agotado al cargar badges");
        const badgesContainer = document.getElementById('badgesContainer');
        if (badgesContainer) {
            badgesContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar badges: Tiempo de espera agotado. <button class="text-blue-500 underline" onclick="window.location.reload()">Reintentar</button></p>';
        }
    }, 15000); // 15 segundos de tiempo máximo
    
    // Verificar si el usuario ya está autenticado
    if (auth.currentUser) {
        console.log("Usuario ya autenticado:", auth.currentUser.uid);
        initializeSystem();
    } else {
        console.log("Esperando autenticación...");
        
        // Configurar listener para cambios en el estado de autenticación
        auth.onAuthStateChanged(user => {
            if (user) {
                console.log("Usuario autenticado:", user.uid);
                initializeSystem();
            } else {
                console.log("No hay usuario autenticado, redirigiendo...");
                clearTimeout(loadingTimeout);
                window.location.href = 'index.html';
            }
        });
    }
}

// Inicializar el sistema
async function initializeSystem() {
    // Evitar inicialización múltiple
    if (isInitialized) {
        console.log("La gestión de badges ya está inicializada");
        return;
    }
    
    try {
        console.log("Inicializando gestión de badges...");
        isInitialized = true;
        
        // Check if user is host/admin
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            clearTimeout(loadingTimeout);
            showNotification("No tienes permisos para gestionar badges", "error");
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
            return;
        }
        
        // Set up event listeners
        setupEventListeners();
        
        // Load existing badges
        await loadBadges();
        
        // Configurar búsqueda
        setupSearch();
        
        // Limpiar el temporizador si todo ha ido bien
        clearTimeout(loadingTimeout);
        
    } catch (error) {
        clearTimeout(loadingTimeout);
        console.error("Error al inicializar gestión de badges:", error);
        showNotification("Error al cargar la gestión de badges. Inténtalo de nuevo.", "error");
        
        const badgesContainer = document.getElementById('badgesContainer');
        if (badgesContainer) {
            badgesContainer.innerHTML = `<p class="text-center text-red-500 py-4">
                Error al cargar badges: ${error.message || "Error desconocido"}. 
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
    
    // Referencias a elementos del DOM
    const headerCreateBadgeBtn = document.getElementById('headerCreateBadgeBtn');
    const cancelButton = document.getElementById('cancelButton');
    const imagenBadgeInput = document.getElementById('imagenBadge');
    const createBadgeForm = document.getElementById('createBadgeForm');
    
    // Botón de crear badge
    if (headerCreateBadgeBtn) {
        console.log("Configurando botón 'Crear Badge'");
        headerCreateBadgeBtn.addEventListener('click', () => {
            console.log("Botón headerCreateBadgeBtn clickeado");
            resetBadgeForm();
            showBadgeForm();
        });
    } else {
        console.warn("No se encontró el botón 'Crear Badge'");
    }
    
    // Botón cancelar
    if (cancelButton) {
        console.log("Configurando botón Cancelar");
        cancelButton.addEventListener('click', () => {
            console.log("Botón cancelar clickeado");
            hideBadgeForm();
        });
    } else {
        console.warn("No se encontró el botón Cancelar");
    }
    
    // Vista previa de imagen
    if (imagenBadgeInput) {
        console.log("Configurando preview de imagen");
        imagenBadgeInput.addEventListener('change', handleBadgeImagePreview);
    } else {
        console.warn("No se encontró el input de imagen");
    }
    
    // Form submission
    if (createBadgeForm) {
        console.log("Configurando evento submit del formulario");
        createBadgeForm.addEventListener('submit', handleBadgeFormSubmit);
        
        // Asegurarse de que el botón de submit tiene type="submit"
        const submitButton = document.getElementById('submitButton');
        if (submitButton && submitButton.type !== 'submit') {
            console.log("Corrigiendo tipo de botón submit");
            submitButton.type = 'submit';
        }
    } else {
        console.warn("No se encontró el formulario createBadgeForm");
    }
}

// Configurar la búsqueda de badges
function setupSearch() {
    const searchInput = document.getElementById('searchBadges');
    if (!searchInput) {
        console.warn("No se encontró el campo de búsqueda");
        return;
    }
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const badgeCards = document.querySelectorAll('[data-badge-id]');
        
        if (badgeCards.length === 0) return;
        
        badgeCards.forEach(card => {
            const badgeName = card.querySelector('h4').textContent.toLowerCase();
            const badgeDesc = card.querySelector('p').textContent.toLowerCase();
            
            // Verificar si el nombre o la descripción contienen el término de búsqueda
            if (badgeName.includes(searchTerm) || badgeDesc.includes(searchTerm)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
        
        // Mostrar mensaje si no hay resultados
        const visibleCards = document.querySelectorAll('[data-badge-id]:not([style*="display: none"])');
        const badgesContainer = document.getElementById('badgesContainer');
        
        if (visibleCards.length === 0 && badgesContainer) {
            // Verificar si ya existe el mensaje de no resultados
            if (!document.getElementById('noResultsMessage')) {
                const noResults = document.createElement('p');
                noResults.id = 'noResultsMessage';
                noResults.className = 'text-center text-gray-500 py-4';
                noResults.textContent = `No se encontraron badges que coincidan con "${searchTerm}"`;
                
                // Insertar después del grid de badges
                const badgesGrid = badgesContainer.querySelector('.grid');
                if (badgesGrid) {
                    badgesGrid.after(noResults);
                } else {
                    badgesContainer.appendChild(noResults);
                }
            }
        } else {
            // Eliminar mensaje de no resultados si existe
            const noResultsMessage = document.getElementById('noResultsMessage');
            if (noResultsMessage) {
                noResultsMessage.remove();
            }
        }
    });
}

// Resetear el formulario de badge
function resetBadgeForm() {
    console.log("Reseteando formulario");
    const form = document.getElementById('createBadgeForm');
    if (form) {
        form.reset();
        
        // Reset button text and mode
        const submitBtn = document.getElementById('submitButton');
        if (submitBtn) {
            submitBtn.textContent = 'Crear Badge';
            submitBtn.dataset.editMode = 'false';
            delete submitBtn.dataset.badgeId;
        }
        
        // Reset form title
        const formTitle = document.getElementById('formTitle');
        if (formTitle) {
            formTitle.textContent = 'Crear Nuevo Badge';
        }
        
        // Clear image preview
        const badgePreviewContainer = document.getElementById('badgePreviewContainer');
        if (badgePreviewContainer) {
            badgePreviewContainer.innerHTML = '<i class="fas fa-image text-4xl text-gray-400"></i>';
        }
        
        // Reset variables
        isEditMode = false;
        currentBadgeId = null;
    } else {
        console.warn("No se pudo resetear el formulario porque no existe");
    }
}

// Mostrar el formulario de badge
function showBadgeForm() {
    console.log("Mostrando formulario");
    const formSection = document.getElementById('badgeFormSection');
    if (formSection) {
        formSection.classList.remove('hidden');
        // Scroll to form
        formSection.scrollIntoView({ behavior: 'smooth' });
    } else {
        console.warn("No se encontró la sección del formulario");
    }
}

// Ocultar el formulario de badge
function hideBadgeForm() {
    console.log("Ocultando formulario");
    const formSection = document.getElementById('badgeFormSection');
    if (formSection) {
        formSection.classList.add('hidden');
    } else {
        console.warn("No se encontró la sección del formulario para ocultar");
    }
}

// Manejar la vista previa de imagen de badge
function handleBadgeImagePreview(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log("Procesando vista previa de imagen:", file.name);
    
    // Verificar que sea una imagen
    if (!file.type.startsWith('image/')) {
        showNotification("El archivo debe ser una imagen", "error");
        event.target.value = '';
        return;
    }
    
    // Verificar tamaño de archivo (máximo 2MB)
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
        showNotification("La imagen es demasiado grande. El tamaño máximo es 2MB", "warning");
    }
    
    // Mostrar vista previa
    const badgePreviewContainer = document.getElementById('badgePreviewContainer');
    if (badgePreviewContainer) {
        const reader = new FileReader();
        reader.onload = function(e) {
            badgePreviewContainer.innerHTML = `
                <img src="${e.target.result}" alt="Vista previa" class="h-full w-full object-cover">
            `;
        };
        
        reader.onerror = function() {
            showNotification("Error al generar la vista previa", "error");
        };
        
        reader.readAsDataURL(file);
    }
}

// Manejar envío del formulario de badge
async function handleBadgeFormSubmit(event) {
    event.preventDefault();
    console.log("Manejando envío de formulario de badge");
    
    // Get form data
    const nombre = document.getElementById('nombreBadge').value.trim();
    const descripcion = document.getElementById('descripcionBadge').value.trim();
    const color = document.getElementById('colorBadge').value;
    const icono = document.getElementById('iconoBadge').value;
    const imagenBadge = document.getElementById('imagenBadge');
    
    console.log("Datos del formulario:", { nombre, icono });
    
    // Validación básica
    if (!nombre) {
        showNotification("El nombre del badge es obligatorio", "error");
        return;
    }
    
    if (!descripcion) {
        showNotification("La descripción del badge es obligatoria", "error");
        return;
    }
    
    // Verificar si estamos en modo edición
    const submitBtn = document.getElementById('submitButton');
    isEditMode = submitBtn && submitBtn.dataset.editMode === 'true';
    currentBadgeId = submitBtn ? submitBtn.dataset.badgeId : null;
    
    // Verificar imagen cuando es creación
    const imageFile = imagenBadge && imagenBadge.files.length > 0 ? imagenBadge.files[0] : null;
    
    // En modo de creación, verificar que hay imagen o se seleccionó un ícono
    if (!isEditMode && !imageFile && !icono) {
        showNotification("Debes seleccionar una imagen o un ícono para el badge", "error");
        return;
    }
    
    if (imageFile && !imageFile.type.startsWith('image/')) {
        showNotification("El archivo debe ser una imagen válida", "error");
        return;
    }
    
    console.log("Modo:", isEditMode ? "Edición" : "Creación", "ID:", currentBadgeId);
    
    // Mostrar estado de carga
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Procesando...';
    }
    
    try {
        // Preparar datos del badge
        const badgeData = {
            nombre,
            descripcion,
            color,
            icono
        };
        
        if (isEditMode && currentBadgeId) {
            // Actualizar badge existente
            await updateBadge(currentBadgeId, badgeData, imageFile);
            showNotification("Badge actualizado correctamente", "success");
        } else {
            // Crear nuevo badge
            await createBadge(badgeData, imageFile);
            showNotification("Badge creado correctamente", "success");
        }
        
        // Resetear y ocultar formulario
        resetBadgeForm();
        hideBadgeForm();
        
        // Recargar lista de badges
        await loadBadges();
        
    } catch (error) {
        console.error("Error al procesar badge:", error);
        showNotification(error.message || "Error al procesar el badge", "error");
    } finally {
        // Restaurar botón
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = isEditMode ? 'Actualizar Badge' : 'Crear Badge';
        }
    }
}

// Función para leer archivo como Base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// Crear nuevo badge
async function createBadge(badgeData, imageFile) {
    console.log("Creando nuevo badge");
    const user = auth.currentUser;
    
    try {
        // Añadir metadatos
        badgeData.createdBy = user.uid;
        badgeData.createdAt = new Date();
        badgeData.updatedAt = new Date();
        
        // Si hay imagen, procesarla
        if (imageFile) {
            try {
                // Opción 1: Guardar como base64 directamente en Firestore
                const base64Image = await readFileAsBase64(imageFile);
                badgeData.imageData = base64Image;
                
                // Opción 2: Subir a Storage y guardar URL
                // Descomentar si prefieres usar Storage en lugar de base64
                /*
                const imageUrl = await uploadImageToStorage(imageFile);
                badgeData.imageUrl = imageUrl;
                */
            } catch (imageError) {
                console.error("Error al procesar imagen:", imageError);
                throw new Error("Error al procesar la imagen: " + imageError.message);
            }
        }
        
        // Guardar en Firestore
        const docRef = await db.collection("badges").add(badgeData);
        return { id: docRef.id, success: true };
    } catch (error) {
        console.error("Error al crear badge:", error);
        throw error;
    }
}

// Actualizar badge existente
async function updateBadge(badgeId, badgeData, imageFile) {
    console.log("Actualizando badge:", badgeId);
    const user = auth.currentUser;
    
    try {
        // Añadir metadatos de actualización
        const updateData = {
            ...badgeData,
            updatedAt: new Date(),
            updatedBy: user.uid
        };
        
        // Si hay nueva imagen, procesarla
        if (imageFile) {
            try {
                // Opción 1: Guardar como base64 directamente en Firestore
                const base64Image = await readFileAsBase64(imageFile);
                updateData.imageData = base64Image;
                
                // Opción 2: Subir a Storage y guardar URL
                // Descomentar si prefieres usar Storage en lugar de base64
                /*
                const imageUrl = await uploadImageToStorage(imageFile);
                updateData.imageUrl = imageUrl;
                */
            } catch (imageError) {
                console.error("Error al procesar imagen:", imageError);
                throw new Error("Error al procesar la imagen: " + imageError.message);
            }
        }
        
        // Actualizar en Firestore
        await db.collection("badges").doc(badgeId).update(updateData);
        return { id: badgeId, success: true };
    } catch (error) {
        console.error("Error al actualizar badge:", error);
        throw error;
    }
}

// Subir imagen a Firebase Storage (alternativa al base64)
async function uploadImageToStorage(imageFile) {
    return new Promise((resolve, reject) => {
        // Crear referencia con nombre único
        const timestamp = new Date().getTime();
        const filename = `badges/badge_${timestamp}_${imageFile.name}`;
        const storageRef = storage.ref(filename);
        
        // Iniciar la subida
        const uploadTask = storageRef.put(imageFile);
        
        // Manejar eventos de la subida
        uploadTask.on('state_changed', 
            // Progress function
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`Subida ${progress.toFixed(2)}% completada`);
            },
            // Error function
            (error) => {
                console.error('Error durante la subida:', error);
                reject(error);
            },
            // Complete function
            async () => {
                try {
                    // Obtener URL de descarga
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    resolve(downloadURL);
                } catch (error) {
                    console.error('Error al obtener URL:', error);
                    reject(error);
                }
            }
        );
    });
}

// Cargar badge para edición
export async function loadBadgeForEdit(badgeId) {
    try {
        console.log("Cargando badge para editar:", badgeId);
        
        // Obtener datos del badge
        const badgeDoc = await db.collection("badges").doc(badgeId).get();
        
        if (!badgeDoc.exists) {
            throw new Error("No se encontró el badge para editar");
        }
        
        const badge = badgeDoc.data();
        console.log("Datos del badge:", badge);
        
        // Llenar formulario con datos existentes
        document.getElementById('nombreBadge').value = badge.nombre || '';
        document.getElementById('descripcionBadge').value = badge.descripcion || '';
        document.getElementById('colorBadge').value = badge.color || '#ff6b1a';
        
        const iconoSelect = document.getElementById('iconoBadge');
        if (iconoSelect && badge.icono) {
            // Seleccionar el icono correcto si existe
            const optionExists = Array.from(iconoSelect.options).some(option => option.value === badge.icono);
            if (optionExists) {
                iconoSelect.value = badge.icono;
            }
        }
        
        // Mostrar imagen actual si existe
        const badgePreviewContainer = document.getElementById('badgePreviewContainer');
        const imageSource = badge.imageUrl || badge.imageData;
        if (imageSource && badgePreviewContainer) {
            badgePreviewContainer.innerHTML = `
                <img src="${imageSource}" alt="Imagen actual" class="h-full w-full object-cover">
            `;
        } else if (badgePreviewContainer) {
            // Mostrar icono por defecto si no hay imagen
            badgePreviewContainer.innerHTML = `
                <div class="h-full w-full flex items-center justify-center" style="background-color: ${badge.color || '#ff6b1a'}">
                    <i class="fas fa-${badge.icono || 'trophy'} text-white text-4xl"></i>
                </div>
            `;
        }
        
        // Actualizar título del formulario y botón
        const formTitle = document.getElementById('formTitle');
        if (formTitle) formTitle.textContent = 'Editar Badge';
        
        const submitBtn = document.getElementById('submitButton');
        if (submitBtn) {
            submitBtn.textContent = 'Actualizar Badge';
            submitBtn.dataset.editMode = 'true';
            submitBtn.dataset.badgeId = badgeId;
        }
        
        // Mostrar formulario
        showBadgeForm();
        
        console.log("Badge cargado para edición correctamente");
        
        // Actualizar variables globales
        isEditMode = true;
        currentBadgeId = badgeId;
        
    } catch (error) {
        console.error("Error al cargar badge para editar:", error);
        showNotification("Error al cargar datos del badge", "error");
        throw error;
    }
}

// Eliminar badge
async function deleteBadge(badgeId) {
    try {
        console.log("Eliminando badge:", badgeId);
        
        // Confirmar eliminación
        if (!confirm('¿Estás seguro de que quieres eliminar este badge?')) {
            return false;
        }
        
        // Obtener datos del badge
        const badgeDoc = await db.collection("badges").doc(badgeId).get();
        
        if (!badgeDoc.exists) {
            throw new Error("No se encontró el badge para eliminar");
        }
        
        const badge = badgeDoc.data();
        
        // Si hay imageUrl, intentar eliminar de Storage
        if (badge.imageUrl) {
            try {
                const storageRef = storage.refFromURL(badge.imageUrl);
                await storageRef.delete();
                console.log("Imagen eliminada de Storage");
            } catch (storageError) {
                console.error("Error al eliminar imagen de Storage:", storageError);
                // Continuar con la eliminación del badge aunque falle la eliminación de la imagen
            }
        }
        
        // Eliminar de Firestore
        await db.collection("badges").doc(badgeId).delete();
        console.log("Badge eliminado correctamente");
        
        showNotification("Badge eliminado correctamente", "success");
        return true;
        
    } catch (error) {
        console.error("Error al eliminar badge:", error);
        showNotification("Error al eliminar badge: " + error.message, "error");
        return false;
    }
}

// Cargar y mostrar badges
export async function loadBadges() {
    const badgesContainer = document.getElementById('badgesContainer');
    if (!badgesContainer) {
        console.warn("No se encontró el contenedor de badges");
        return;
    }
    
    try {
        console.log("Cargando badges...");
        
        // Mostrar spinner de carga
        badgesContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
        
        // Obtener badges de Firestore
        const badgesSnapshot = await db.collection("badges").orderBy("createdAt", "desc").get();
        
        // Verificar si hay badges
        if (badgesSnapshot.empty) {
            console.log("No hay badges disponibles");
            badgesContainer.innerHTML = '<p class="text-center text-gray-500 py-4">No hay badges disponibles. Crea el primer badge.</p>';
            return;
        }
        
        console.log(`Encontrados ${badgesSnapshot.size} badges`);
        
        // Convertir a array y crear grid
        let html = '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';
        
        badgesSnapshot.forEach(doc => {
            const badge = doc.data();
            const badgeId = doc.id;
            
            // Calcular fecha
            const fecha = badge.createdAt ? new Date(badge.createdAt.seconds * 1000) : new Date();
            const fechaFormateada = fecha.toLocaleDateString('es-ES');
            
            // Estado (visible/oculto) si existe esa propiedad
            let estadoHtml = '';
            if (badge.hasOwnProperty('visible')) {
                estadoHtml = badge.visible !== false ? 
                    '<span class="bg-green-100 text-green-600 py-1 px-2 rounded text-xs ml-2">Activo</span>' : 
                    '<span class="bg-red-100 text-red-600 py-1 px-2 rounded text-xs ml-2">Inactivo</span>';
            }
            
            // Determinar fuente de imagen (imageUrl, imageData o icono)
            let badgeVisual;
            if (badge.imageUrl || badge.imageData) {
                const imageSource = badge.imageUrl || badge.imageData;
                badgeVisual = `<img src="${imageSource}" alt="${badge.nombre}" class="h-12 w-12 mr-3 rounded-full object-cover">`;
            } else {
                badgeVisual = `
                    <div class="h-12 w-12 mr-3 rounded-full flex items-center justify-center" style="background-color: ${badge.color || '#ff6b1a'}">
                        <i class="fas fa-${badge.icono || 'trophy'} text-white"></i>
                    </div>
                `;
            }
            
            html += `
                <div class="bg-white rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow" data-badge-id="${badgeId}">
                    <div class="flex items-center mb-3">
                        ${badgeVisual}
                        <div>
                            <h4 class="font-semibold">${badge.nombre || 'Sin nombre'}</h4>
                            <div class="flex items-center text-xs text-gray-500">
                                <span>Creado: ${fechaFormateada}</span>
                                ${estadoHtml}
                            </div>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600 mb-3">${badge.descripcion || ''}</p>
                    <div class="flex justify-end space-x-2 pt-2 border-t border-gray-100">
                        <button class="text-blue-500 hover:text-blue-700 edit-badge-btn" title="Editar badge" data-badge-id="${badgeId}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="text-red-500 hover:text-red-700 delete-badge-btn" title="Eliminar badge" data-badge-id="${badgeId}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Mostrar badges en el contenedor
        badgesContainer.innerHTML = html;
        
        // Añadir event listeners a los botones
        addBadgeEventListeners();
        
        console.log("Badges cargados correctamente");
        
    } catch (error) {
        console.error("Error al cargar badges:", error);
        badgesContainer.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <p class="font-bold">Error al cargar badges</p>
                <p>${error.message || "Inténtalo de nuevo"}</p>
                <button onclick="window.location.reload()" class="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded">
                    Reintentar
                </button>
            </div>
        `;
    }
}

// Añadir event listeners a las tarjetas de badges
function addBadgeEventListeners() {
    // Botones de editar
    document.querySelectorAll('.edit-badge-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const badgeId = this.getAttribute('data-badge-id');
            
            try {
                // Mostrar estado de carga
                const originalHtml = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                this.disabled = true;
                
                await loadBadgeForEdit(badgeId);
                
                // Restaurar botón
                this.innerHTML = originalHtml;
                this.disabled = false;
            } catch (error) {
                console.error("Error al editar badge:", error);
                showNotification("Error al cargar badge para editar", "error");
                
                // Restaurar botón
                this.innerHTML = '<i class="fas fa-edit"></i>';
                this.disabled = false;
            }
        });
    });
    
    // Botones de eliminar
    document.querySelectorAll('.delete-badge-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const badgeId = this.getAttribute('data-badge-id');
            const badgeCard = this.closest('[data-badge-id]');
            
            try {
                // Mostrar estado de carga
                const originalHtml = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                this.disabled = true;
                
                const success = await deleteBadge(badgeId);
                
                if (success && badgeCard) {
                    // Eliminar tarjeta del DOM
                    badgeCard.remove();
                    
                    // Si no quedan badges, mostrar mensaje
                    if (document.querySelectorAll('[data-badge-id]').length === 0) {
                        const badgesContainer = document.getElementById('badgesContainer');
                        if (badgesContainer) {
                            badgesContainer.innerHTML = '<p class="text-center text-gray-500 py-4">No hay badges disponibles. Crea el primer badge.</p>';
                        }
                    }
                } else {
                    // Restaurar botón
                    this.innerHTML = originalHtml;
                    this.disabled = false;
                }
            } catch (error) {
                console.error("Error al eliminar badge:", error);
                showNotification("Error al eliminar badge", "error");
                
                // Restaurar botón
                this.innerHTML = '<i class="fas fa-trash"></i>';
                this.disabled = false;
            }
        });
    });
}

// Función para mostrar notificaciones
export function showNotification(mensaje, tipo = "info") {
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

// Hacer disponible la función de notificación globalmente
window.showNotification = showNotification;
