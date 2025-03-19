// admin-panel-banners.js - Script para la gestión de banners
import { showNotification } from './utils.js';
import { isUserHost } from './firebase.js';  // Importar la función desde firebase.js

// DOM elements
const bannersContainer = document.getElementById('bannersContainer');
const bannerFormSection = document.getElementById('bannerFormSection');
const createBannerForm = document.getElementById('createBannerForm');
const headerCreateBannerBtn = document.getElementById('headerCreateBannerBtn');
const bannerFormTitle = document.getElementById('bannerFormTitle');
const cancelBannerButton = document.getElementById('cancelBannerButton');
const submitBannerButton = document.getElementById('submitBannerButton');

// Variable para controlar el estado de inicialización
let isInitialized = false;

// Agregar un temporizador para evitar bucles infinitos
let loadingTimeout;

// Verificar autenticación antes de inicializar
document.addEventListener('DOMContentLoaded', () => {
    console.log("Verificando autenticación...");
    
    // Establecer un temporizador para evitar espera infinita
    loadingTimeout = setTimeout(() => {
        console.error("Tiempo de espera agotado al cargar banners");
        if (bannersContainer) {
            bannersContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar banners: Tiempo de espera agotado. <button class="text-blue-500 underline" onclick="window.location.reload()">Reintentar</button></p>';
        }
    }, 15000); // 15 segundos de tiempo máximo
    
    // Verificar si el usuario ya está autenticado
    if (firebase.auth().currentUser) {
        console.log("Usuario ya autenticado:", firebase.auth().currentUser.uid);
        initBannersManagement();
    } else {
        console.log("Esperando autenticación...");
        
        // Configurar listener para cambios en el estado de autenticación
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                console.log("Usuario autenticado:", user.uid);
                initBannersManagement();
            } else {
                console.log("No hay usuario autenticado, redirigiendo...");
                // Esperar un momento antes de redireccionar
                setTimeout(() => {
                    if (!firebase.auth().currentUser) {
                        clearTimeout(loadingTimeout);
                        window.location.href = 'index.html';
                    }
                }, 5000);
            }
        });
    }
});

// Initialize banner management
async function initBannersManagement() {
    // Evitar inicialización múltiple
    if (isInitialized) {
        console.log("La gestión de banners ya está inicializada");
        return;
    }
    
    try {
        console.log("Inicializando gestión de banners...");
        isInitialized = true;
        
        // Check if user is host/admin
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            clearTimeout(loadingTimeout);
            showNotification("No tienes permisos para gestionar banners", "error");
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
            return;
        }
        
        // Set up event listeners
        setupEventListeners();
        
        // Load existing banners
        await loadBanners();
        
        // Limpiar el temporizador si todo ha ido bien
        clearTimeout(loadingTimeout);
        
    } catch (error) {
        clearTimeout(loadingTimeout);
        console.error("Error al inicializar gestión de banners:", error);
        showNotification("Error al cargar la gestión de banners. Inténtalo de nuevo.", "error");
        
        if (bannersContainer) {
            bannersContainer.innerHTML = `<p class="text-center text-red-500 py-4">
                Error al cargar banners: ${error.message || "Error desconocido"}. 
                <button class="text-blue-500 underline" onclick="window.location.reload()">
                    Reintentar
                </button>
            </p>`;
        }
    }
}

// Set up event listeners
function setupEventListeners() {
    console.log("Configurando event listeners...");
    
    // Create banner button in header
    if (headerCreateBannerBtn) {
        console.log("Configurando botón 'Crear Banner'");
        headerCreateBannerBtn.addEventListener('click', () => {
            console.log("Botón headerCreateBannerBtn clickeado");
            resetBannerForm();
            showBannerForm();
        });
    } else {
        console.warn("No se encontró el botón 'Crear Banner'");
    }
    
    // Cancel button - configuración simple y directa
    if (cancelBannerButton) {
        console.log("Configurando botón Cancelar");
        cancelBannerButton.addEventListener('click', () => {
            console.log("Botón cancelar clickeado");
            hideBannerForm();
        });
    } else {
        console.warn("No se encontró el botón Cancelar");
    }
    
    // Form submission - sin clonar para evitar problemas
    if (createBannerForm) {
        console.log("Configurando evento submit del formulario");
        createBannerForm.addEventListener('submit', handleBannerFormSubmit);
        
        // Asegurarse de que el botón de submit tiene type="submit"
        const submitBtn = document.getElementById('submitBannerButton');
        if (submitBtn && submitBtn.type !== 'submit') {
            console.log("Corrigiendo tipo de botón submit");
            submitBtn.type = 'submit';
        }
    } else {
        console.warn("No se encontró el formulario createBannerForm");
    }
    
    // Image preview
    const bannerImagen = document.getElementById('bannerImagen');
    if (bannerImagen) {
        console.log("Configurando preview de imagen");
        bannerImagen.addEventListener('change', handleBannerImagePreview);
    } else {
        console.warn("No se encontró el input de imagen");
    }
}

// Reset the banner form to its initial state
function resetBannerForm() {
    console.log("Reseteando formulario");
    const form = document.getElementById('createBannerForm');
    if (form) {
        form.reset();
        
        // Reset button text and mode
        const submitBtn = document.getElementById('submitBannerButton');
        if (submitBtn) {
            submitBtn.textContent = 'Crear Banner';
            submitBtn.dataset.editMode = 'false';
            delete submitBtn.dataset.bannerId;
        }
        
        // Reset form title
        if (bannerFormTitle) {
            bannerFormTitle.textContent = 'Crear Nuevo Banner';
        }
        
        // Clear image preview
        const previews = form.querySelectorAll('.image-preview');
        previews.forEach(preview => preview.remove());
    } else {
        console.warn("No se pudo resetear el formulario porque no existe");
    }
}

// Show the banner form
function showBannerForm() {
    console.log("Mostrando formulario");
    if (bannerFormSection) {
        bannerFormSection.classList.remove('hidden');
        // Scroll to form
        bannerFormSection.scrollIntoView({ behavior: 'smooth' });
    } else {
        console.warn("No se encontró la sección del formulario");
    }
}

// Hide the banner form
function hideBannerForm() {
    console.log("Ocultando formulario");
    if (bannerFormSection) {
        bannerFormSection.classList.add('hidden');
    } else {
        console.warn("No se encontró la sección del formulario para ocultar");
    }
}

// Handle banner image preview
function handleBannerImagePreview(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log("Procesando vista previa de imagen:", file.name);
    
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
        showNotification("El archivo debe ser una imagen", "error");
        event.target.value = '';
        return;
    }
    
    // Verificar tamaño de archivo (máximo 5MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
        showNotification("La imagen es demasiado grande. El tamaño máximo es 5MB", "warning");
    }
    
    // Remove any existing preview
    const container = event.target.parentElement;
    const existingPreview = container.querySelector('.image-preview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // Create preview element
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview mt-2';
        previewDiv.innerHTML = `
            <p class="text-sm text-gray-600">Vista previa:</p>
            <img src="${e.target.result}" alt="Vista previa" class="h-32 object-cover rounded mt-1">
            <p class="text-xs text-gray-500">${file.name} (${(file.size / 1024).toFixed(1)} KB)</p>
        `;
        container.appendChild(previewDiv);
    };
    
    reader.onerror = function() {
        showNotification("Error al generar la vista previa", "error");
    };
    
    reader.readAsDataURL(file);
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

// Handle banner form submission
async function handleBannerFormSubmit(event) {
    event.preventDefault();
    console.log("Manejando envío de formulario de banner");
    
    // Get form data
    const nombre = document.getElementById('bannerNombre').value.trim();
    const descripcion = document.getElementById('bannerDescripcion').value.trim();
    const url = document.getElementById('bannerUrl').value.trim();
    const orden = parseInt(document.getElementById('bannerOrden').value) || 1;
    const visible = document.getElementById('bannerVisible').checked;
    const bannerImagen = document.getElementById('bannerImagen');
    
    console.log("Datos del formulario:", { nombre, url, orden, visible });
    
    // Form validation
    if (!nombre) {
        showNotification("El nombre del banner es obligatorio", "error");
        return;
    }
    
    // Verificar que la imagen sea válida
    const imageFile = bannerImagen && bannerImagen.files.length > 0 ? bannerImagen.files[0] : null;
    const submitBtn = document.getElementById('submitBannerButton');
    const isEditMode = submitBtn && submitBtn.dataset.editMode === 'true';
    
    if (!imageFile && !isEditMode) {
        showNotification("Debes seleccionar una imagen para el banner", "error");
        return;
    }
    
    if (imageFile && !imageFile.type.startsWith('image/')) {
        showNotification("El archivo debe ser una imagen válida", "error");
        return;
    }
    
    // Check if we're in edit mode
    const bannerId = submitBtn ? submitBtn.dataset.bannerId : null;
    
    console.log("Modo:", isEditMode ? "Edición" : "Creación", "ID:", bannerId);
    
    // Show loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Procesando...';
    }
    
    try {
        // Prepare banner data
        const bannerData = {
            nombre,
            descripcion,
            url,
            orden,
            visible
        };
        
        // Convertir imagen a base64 para guardarla directamente
        if (imageFile) {
            // Leer la imagen como base64
            const base64Image = await readFileAsBase64(imageFile);
            bannerData.imageData = base64Image;
        }
        
        let result;
        
        if (isEditMode && bannerId) {
            // Update existing banner
            console.log("Actualizando banner existente:", bannerId);
            
            const bannerRef = firebase.firestore().collection("banners").doc(bannerId);
            
            // Actualizar datos
            const updateData = {
                ...bannerData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: firebase.auth().currentUser.uid
            };
            
            // Si no hay nueva imagen, mantener la imageData existente
            if (!imageFile) {
                delete updateData.imageData;
            }
            
            await bannerRef.update(updateData);
            
            result = { id: bannerId, success: true };
            showNotification("Banner actualizado correctamente", "success");
        } else {
            // Create new banner
            console.log("Creando nuevo banner");
            
            // Añadir metadatos
            bannerData.createdBy = firebase.auth().currentUser.uid;
            bannerData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            bannerData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            
            // Guardar en Firestore
            const bannerRef = await firebase.firestore().collection("banners").add(bannerData);
            
            result = { id: bannerRef.id, success: true };
            showNotification("Banner creado correctamente", "success");
        }
        
        console.log("Operación completada:", result);
        
        // Reset form and hide
        resetBannerForm();
        hideBannerForm();
        
        // Reload banners list
        await loadBanners();
        
    } catch (error) {
        console.error("Error al procesar banner:", error);
        showNotification(error.message || "Error al procesar el banner", "error");
    } finally {
        // Restore button
        const submitButton = document.getElementById('submitBannerButton');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = isEditMode ? 'Actualizar Banner' : 'Crear Banner';
        }
    }
}

// Load and display banners
async function loadBanners() {
    try {
        if (!bannersContainer) {
            console.log("No se encontró el contenedor de banners");
            return;
        }
        
        console.log("Cargando banners...");
        
        // Show loading spinner
        bannersContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
        
        try {
            // Get banners from Firestore
            const bannersRef = firebase.firestore().collection("banners");
            const bannersSnapshot = await bannersRef.orderBy("orden", "asc").get();
            
            // Check if we have banners
            if (bannersSnapshot.empty) {
                console.log("No hay banners disponibles");
                bannersContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No hay banners disponibles. Crea el primer banner.</p>';
                return;
            }
            
            console.log(`Encontrados ${bannersSnapshot.size} banners`);
            
            // Convert to array
            const banners = [];
            bannersSnapshot.forEach(doc => {
                banners.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Create grid of banner cards
            let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">';
            
            banners.forEach(banner => {
                // Calcular fecha
                const fecha = banner.createdAt ? new Date(banner.createdAt.seconds * 1000) : new Date();
                const fechaFormateada = fecha.toLocaleDateString('es-ES');
                
                // Estado (visible/oculto)
                const estado = banner.visible !== false ? 
                    '<span class="bg-green-100 text-green-600 py-1 px-2 rounded text-xs">Visible</span>' : 
                    '<span class="bg-red-100 text-red-600 py-1 px-2 rounded text-xs">Oculto</span>';
                
                // Determinar fuente de imagen (imageUrl o imageData)
                const imageSource = banner.imageUrl || banner.imageData || '';
                
                html += `
                    <div class="bg-white rounded-lg shadow overflow-hidden" data-banner-id="${banner.id}">
                        <div class="relative">
                            <img src="${imageSource}" alt="${banner.nombre}" class="w-full h-48 object-cover">
                            <div class="absolute top-2 right-2 flex space-x-1">
                                <span class="bg-gray-800 bg-opacity-75 text-white py-1 px-2 rounded text-xs">Orden: ${banner.orden}</span>
                                ${estado}
                            </div>
                        </div>
                        <div class="p-4">
                            <h3 class="font-bold text-lg mb-1">${banner.nombre}</h3>
                            <p class="text-gray-600 text-sm mb-2">${banner.descripcion || 'Sin descripción'}</p>
                            
                            <div class="flex justify-between items-center text-sm text-gray-500 mt-3">
                                <div class="truncate mr-2">
                                    <span class="text-blue-500 font-medium">URL:</span> 
                                    <a href="${banner.url}" target="_blank" class="hover:underline truncate">${banner.url || '#'}</a>
                                </div>
                                <span>Creado: ${fechaFormateada}</span>
                            </div>
                            
                            <div class="mt-4 flex justify-end space-x-2 border-t pt-3">
                                <button class="text-blue-500 hover:text-blue-700 toggle-banner-visibility-btn" title="${banner.visible !== false ? 'Ocultar banner' : 'Mostrar banner'}">
                                    <i class="fas fa-eye${banner.visible !== false ? '' : '-slash'}"></i>
                                </button>
                                <button class="text-orange-500 hover:text-orange-700 edit-banner-btn" title="Editar banner">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="text-red-500 hover:text-red-700 delete-banner-btn" title="Eliminar banner">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            
            bannersContainer.innerHTML = html;
            
            // Add event listeners to action buttons
            addBannerEventListeners();
            
            console.log("Banners cargados correctamente");
            
        } catch (permissionError) {
            console.error("Error de permisos:", permissionError);
            
            // Mostrar mensaje amigable y botón para crear banner de prueba
            bannersContainer.innerHTML = `
                <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h3 class="text-yellow-800 font-bold mb-2">Problema de permisos</h3>
                    <p class="text-yellow-700 mb-3">No se pudieron cargar los banners debido a un problema de permisos en la base de datos.</p>
                    <p class="text-sm text-yellow-600 mb-4">Esto puede suceder si las reglas de seguridad de Firestore no están correctamente configuradas para la colección "banners".</p>
                    
                    <div class="flex justify-end">
                        <button id="createDummyBannerBtn" class="dtowin-primary text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition">
                            <i class="fas fa-plus mr-2"></i>Crear Banner de Prueba
                        </button>
                    </div>
                </div>
            `;
            
            // Agregar listener para crear un banner de prueba (que probablemente también fallará, pero es una forma de probar)
            const createDummyBtn = document.getElementById('createDummyBannerBtn');
            if (createDummyBtn) {
                createDummyBtn.addEventListener('click', () => {
                    headerCreateBannerBtn.click();
                });
            }
        }
        
    } catch (error) {
        console.error("Error al cargar banners:", error);
        bannersContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar banners. Inténtalo de nuevo.</p>';
    }
}

// Add event listeners to banner cards
function addBannerEventListeners() {
    // Visibility toggle buttons
    document.querySelectorAll('.toggle-banner-visibility-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const bannerCard = this.closest('[data-banner-id]');
            const bannerId = bannerCard.dataset.bannerId;
            
            try {
                // Get current data
                const bannerRef = firebase.firestore().collection("banners").doc(bannerId);
                const bannerSnap = await bannerRef.get();
                
                if (!bannerSnap.exists) {
                    showNotification("No se encontró el banner", "error");
                    return;
                }
                
                const bannerData = bannerSnap.data();
                const newVisibility = bannerData.visible === false ? true : false;
                
                // Show loading
                const originalHtml = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                this.disabled = true;
                
                // Update visibility
                await bannerRef.update({
                    visible: newVisibility,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Update UI
                const icon = this.querySelector('i');
                if (newVisibility) {
                    icon.className = 'fas fa-eye';
                    // Actualizar etiqueta de estado
                    const estadoLabel = bannerCard.querySelector('.absolute > span:last-child');
                    if (estadoLabel) {
                        estadoLabel.className = 'bg-green-100 text-green-600 py-1 px-2 rounded text-xs';
                        estadoLabel.textContent = 'Visible';
                    }
                } else {
                    icon.className = 'fas fa-eye-slash';
                    // Actualizar etiqueta de estado
                    const estadoLabel = bannerCard.querySelector('.absolute > span:last-child');
                    if (estadoLabel) {
                        estadoLabel.className = 'bg-red-100 text-red-600 py-1 px-2 rounded text-xs';
                        estadoLabel.textContent = 'Oculto';
                    }
                }
                
                this.title = newVisibility ? 'Ocultar banner' : 'Mostrar banner';
                this.disabled = false;
                
                showNotification(`Banner ${newVisibility ? 'visible' : 'oculto'} correctamente`, "success");
                
            } catch (error) {
                console.error("Error al cambiar visibilidad:", error);
                showNotification("Error al cambiar visibilidad del banner", "error");
                
                // Restaurar botón
                this.innerHTML = originalHtml;
                this.disabled = false;
            }
        });
    });
    
    // Edit buttons
    document.querySelectorAll('.edit-banner-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const bannerId = this.closest('[data-banner-id]').dataset.bannerId;
            
            try {
                await loadBannerForEdit(bannerId);
            } catch (error) {
                console.error("Error al cargar banner para editar:", error);
                showNotification("Error al cargar banner para editar", "error");
            }
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-banner-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const bannerCard = this.closest('[data-banner-id]');
            const bannerId = bannerCard.dataset.bannerId;
            const bannerName = bannerCard.querySelector('h3').textContent;
            
            if (confirm(`¿Estás seguro que deseas eliminar el banner "${bannerName}"?`)) {
                try {
                    // Show loading
                    const originalHtml = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    this.disabled = true;
                    
                    // Eliminar banner
                    const bannerRef = firebase.firestore().collection("banners").doc(bannerId);
                    await bannerRef.delete();
                    console.log("Banner eliminado correctamente");
                    
                    // Remove card from UI
                    bannerCard.remove();
                    
                    showNotification("Banner eliminado correctamente", "success");
                    
                    // If no banners left, show message
                    if (document.querySelectorAll('[data-banner-id]').length === 0) {
                        bannersContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No hay banners disponibles. Crea el primer banner.</p>';
                    }
                    
                } catch (error) {
                    console.error("Error al eliminar banner:", error);
                    showNotification(error.message || "Error al eliminar banner", "error");
                    
                    // Restore button
                    this.innerHTML = originalHtml;
                    this.disabled = false;
                }
            }
        });
    });
}

// Load banner data for editing
async function loadBannerForEdit(bannerId) {
    try {
        console.log("Cargando banner para editar:", bannerId);
        
        // Get banner data
        const bannerRef = firebase.firestore().collection("banners").doc(bannerId);
        const bannerSnap = await bannerRef.get();
        
        if (!bannerSnap.exists) {
            throw new Error("No se encontró el banner para editar");
        }
        
        const banner = bannerSnap.data();
        console.log("Datos del banner:", banner);
        
        // Fill form with banner data
        document.getElementById('bannerNombre').value = banner.nombre || '';
        document.getElementById('bannerDescripcion').value = banner.descripcion || '';
        document.getElementById('bannerUrl').value = banner.url || '';
        document.getElementById('bannerOrden').value = banner.orden || 1;
        document.getElementById('bannerVisible').checked = banner.visible !== false;
        
        // Mostrar la imagen actual (de imageUrl o imageData)
        const imageSource = banner.imageUrl || banner.imageData;
        if (imageSource) {
            const container = document.getElementById('bannerImagen').parentElement;
            
            // Eliminar vista previa existente si hay
            const existingPreview = container.querySelector('.image-preview');
            if (existingPreview) {
                existingPreview.remove();
            }
            
            const previewDiv = document.createElement('div');
            previewDiv.className = 'image-preview mt-2';
            previewDiv.innerHTML = `
                <p class="text-sm text-gray-600">Imagen actual:</p>
                <img src="${imageSource}" alt="Imagen actual" class="h-32 object-cover rounded mt-1">
                <p class="text-xs text-gray-500">Cargar nueva imagen para reemplazar (opcional)</p>
            `;
            container.appendChild(previewDiv);
        }
        
        // Update form title and button
        const formTitleEl = document.getElementById('bannerFormTitle');
        if (formTitleEl) formTitleEl.textContent = 'Editar Banner';
        
        const submitBtn = document.getElementById('submitBannerButton');
        if (submitBtn) {
            submitBtn.textContent = 'Actualizar Banner';
            submitBtn.dataset.editMode = 'true';
            submitBtn.dataset.bannerId = bannerId;
        }
        
        // Show form
        showBannerForm();
        
        console.log("Banner cargado para edición correctamente");
        
    } catch (error) {
        console.error("Error al cargar banner para editar:", error);
        throw error;
    }
}

// Exportar funciones
export {
    initBannersManagement,
    loadBanners
};
