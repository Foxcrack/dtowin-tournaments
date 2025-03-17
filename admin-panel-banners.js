// admin-panel-banners.js - Script para la gestión de banners
import { auth, isUserHost, db, storage } from './firebase.js';
import { showNotification } from './admin-panel.js';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

// DOM elements
const bannersContainer = document.getElementById('bannersContainer');
const bannerFormSection = document.getElementById('bannerFormSection');
const createBannerForm = document.getElementById('createBannerForm');
const headerCreateBannerBtn = document.getElementById('headerCreateBannerBtn');
const bannerFormTitle = document.getElementById('bannerFormTitle');
const cancelBannerButton = document.getElementById('cancelBannerButton');
const submitBannerButton = document.getElementById('submitBannerButton');

// Initialize banner management
export async function initBannersManagement() {
    try {
        console.log("Inicializando gestión de banners...");
        
        // Check if user is host/admin
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            showNotification("No tienes permisos para gestionar banners", "error");
            return;
        }
        
        // Set up event listeners
        setupEventListeners();
        
        // Load existing banners
        await loadBanners();
        
    } catch (error) {
        console.error("Error al inicializar gestión de banners:", error);
        showNotification("Error al cargar la gestión de banners. Inténtalo de nuevo.", "error");
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
    
    // Cancel button
    if (cancelBannerButton) {
        console.log("Configurando botón Cancelar");
        cancelBannerButton.addEventListener('click', hideBannerForm);
    } else {
        console.warn("No se encontró el botón Cancelar");
    }
    
    // Form submission
    if (createBannerForm) {
        console.log("Configurando evento submit del formulario");
        
        // Eliminar event listeners anteriores para evitar duplicados
        createBannerForm.removeEventListener('submit', handleBannerFormSubmit);
        
        // Añadir event listener
        createBannerForm.addEventListener('submit', handleBannerFormSubmit);
        
        // Asegurarse de que el botón de submit tiene type="submit"
        if (submitBannerButton && submitBannerButton.type !== 'submit') {
            console.log("Corrigiendo tipo de botón submit");
            submitBannerButton.type = 'submit';
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
    if (createBannerForm) {
        createBannerForm.reset();
        
        // Reset button text and mode
        if (submitBannerButton) {
            submitBannerButton.textContent = 'Crear Banner';
            submitBannerButton.dataset.editMode = 'false';
            delete submitBannerButton.dataset.bannerId;
        }
        
        // Reset form title
        if (bannerFormTitle) {
            bannerFormTitle.textContent = 'Crear Nuevo Banner';
        }
        
        // Clear image preview
        const previews = createBannerForm.querySelectorAll('.image-preview');
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
    if (!imageFile && submitBannerButton.dataset.editMode !== 'true') {
        showNotification("Debes seleccionar una imagen para el banner", "error");
        return;
    }
    
    if (imageFile && !imageFile.type.startsWith('image/')) {
        showNotification("El archivo debe ser una imagen válida", "error");
        return;
    }
    
    // Check if we're in edit mode
    const isEditMode = submitBannerButton.dataset.editMode === 'true';
    const bannerId = submitBannerButton.dataset.bannerId;
    
    console.log("Modo:", isEditMode ? "Edición" : "Creación", "ID:", bannerId);
    
    // Show loading state
    submitBannerButton.disabled = true;
    const originalButtonText = submitBannerButton.textContent;
    submitBannerButton.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Procesando...';
    
    try {
        // Prepare banner data
        const bannerData = {
            nombre,
            descripcion,
            url,
            orden,
            visible
        };
        
        let result;
        
        if (isEditMode && bannerId) {
            // Update existing banner
            console.log("Actualizando banner existente:", bannerId);
            result = await updateBanner(bannerId, bannerData, imageFile);
            showNotification("Banner actualizado correctamente", "success");
        } else {
            // Create new banner
            console.log("Creando nuevo banner");
            result = await createBanner(bannerData, imageFile);
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
        submitBannerButton.disabled = false;
        submitBannerButton.textContent = isEditMode ? 'Actualizar Banner' : 'Crear Banner';
    }
}

// Create a new banner
async function createBanner(bannerData, imageFile) {
    try {
        console.log("Creando banner con datos:", bannerData);
        
        const user = auth.currentUser;
        
        if (!user) {
            throw new Error("Debes iniciar sesión para crear un banner");
        }
        
        // Check if user is host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            throw new Error("Solo el host puede crear banners");
        }
        
        if (!imageFile) {
            throw new Error("La imagen es obligatoria para crear un banner");
        }
        
        // Upload image first
        console.log("Subiendo imagen a Storage...");
        const fileName = `banners_${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const storageRef = ref(storage, `banners/${fileName}`);
        
        // Create blob to avoid CORS issues
        const arrayBuffer = await imageFile.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: imageFile.type });
        
        // Upload to Firebase Storage
        await uploadBytes(storageRef, blob);
        const imageUrl = await getDownloadURL(storageRef);
        
        console.log("Imagen subida, URL:", imageUrl);
        
        // Add banner to Firestore
        const bannerWithMetadata = {
            ...bannerData,
            imageUrl,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        console.log("Guardando banner en Firestore...");
        const bannerRef = await addDoc(collection(db, "banners"), bannerWithMetadata);
        
        return {
            id: bannerRef.id,
            success: true
        };
    } catch (error) {
        console.error("Error al crear banner:", error);
        throw error;
    }
}

// Update an existing banner
async function updateBanner(bannerId, bannerData, imageFile) {
    try {
        console.log("Actualizando banner:", bannerId, "con datos:", bannerData);
        
        const user = auth.currentUser;
        
        if (!user) {
            throw new Error("Debes iniciar sesión para actualizar un banner");
        }
        
        // Check if user is host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            throw new Error("Solo el host puede actualizar banners");
        }
        
        // Get banner reference
        const bannerRef = doc(db, "banners", bannerId);
        const bannerSnap = await getDoc(bannerRef);
        
        if (!bannerSnap.exists()) {
            throw new Error("El banner no existe");
        }
        
        const currentBanner = bannerSnap.data();
        
        // Preparar datos para actualización
        const updateData = {
            ...bannerData,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
        };
        
        // Mantener la URL de imagen actual si no se proporciona una nueva
        if (!imageFile) {
            updateData.imageUrl = currentBanner.imageUrl;
        } else {
            // Subir nueva imagen
            console.log("Subiendo nueva imagen...");
            
            // Eliminar imagen anterior si existe
            if (currentBanner.imageUrl) {
                try {
                    console.log("Eliminando imagen anterior...");
                    const urlPath = currentBanner.imageUrl.split('?')[0];
                    const fileName = urlPath.split('/').pop();
                    if (fileName) {
                        const storagePath = `banners/${fileName}`;
                        const oldImageRef = ref(storage, storagePath);
                        await deleteObject(oldImageRef).catch(error => {
                            console.warn("Error al eliminar imagen anterior, posiblemente ya no existe:", error);
                        });
                    }
                } catch (error) {
                    console.warn("Error al procesar la URL de la imagen anterior:", error);
                    // Continuar con la actualización aunque falle la eliminación
                }
            }
            
            // Subir nueva imagen
            const fileName = `banners_${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const storageRef = ref(storage, `banners/${fileName}`);
            
            // Create blob to avoid CORS issues
            const arrayBuffer = await imageFile.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: imageFile.type });
            
            // Upload to Firebase Storage
            await uploadBytes(storageRef, blob);
            const imageUrl = await getDownloadURL(storageRef);
            
            updateData.imageUrl = imageUrl;
            console.log("Nueva imagen subida, URL:", imageUrl);
        }
        
        // Update document
        await updateDoc(bannerRef, updateData);
        
        return {
            id: bannerId,
            success: true
        };
    } catch (error) {
        console.error("Error al actualizar banner:", error);
        throw error;
    }
}

// Load and display banners
export async function loadBanners() {
    try {
        if (!bannersContainer) {
            console.log("No se encontró el contenedor de banners");
            return;
        }
        
        console.log("Cargando banners...");
        
        // Show loading spinner
        bannersContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
        
        // Get banners from Firestore
        const bannersCollection = collection(db, "banners");
        const bannersQuery = query(bannersCollection, orderBy("orden", "asc"));
        const bannersSnapshot = await getDocs(bannersQuery);
        
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
            
            html += `
                <div class="bg-white rounded-lg shadow overflow-hidden" data-banner-id="${banner.id}">
                    <div class="relative">
                        <img src="${banner.imageUrl}" alt="${banner.nombre}" class="w-full h-48 object-cover">
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
                const bannerRef = doc(db, "banners", bannerId);
                const bannerSnap = await getDoc(bannerRef);
                
                if (!bannerSnap.exists()) {
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
                await updateDoc(bannerRef, {
                    visible: newVisibility,
                    updatedAt: serverTimestamp()
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
                    
                    await deleteBanner(bannerId);
                    
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
        const bannerRef = doc(db, "banners", bannerId);
        const bannerSnap = await getDoc(bannerRef);
        
        if (!bannerSnap.exists()) {
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
        
        // Show current image
        if (banner.imageUrl) {
            const container = document.getElementById('bannerImagen').parentElement;
            const previewDiv = document.createElement('div');
            previewDiv.className = 'image-preview mt-2';
            previewDiv.innerHTML = `
                <p class="text-sm text-gray-600">Imagen actual:</p>
                <img src="${banner.imageUrl}" alt="Imagen actual" class="h-32 object-cover rounded mt-1">
                <p class="text-xs text-gray-500">Cargar nueva imagen para reemplazar (opcional)</p>
            `;
            container.appendChild(previewDiv);
        }
        
        // Update form title and button
        if (bannerFormTitle) bannerFormTitle.textContent = 'Editar Banner';
        if (submitBannerButton) {
            submitBannerButton.textContent = 'Actualizar Banner';
            submitBannerButton.dataset.editMode = 'true';
            submitBannerButton.dataset.bannerId = bannerId;
        }
        
        // Show form
        showBannerForm();
        
        console.log("Banner cargado para edición correctamente");
        
    } catch (error) {
        console.error("Error al cargar banner para editar:", error);
        throw error;
    }
}

// Delete a banner
async function deleteBanner(bannerId) {
    try {
        console.log("Eliminando banner:", bannerId);
        
        const user = auth.currentUser;
        
        if (!user) {
            throw new Error("Debes iniciar sesión para eliminar un banner");
        }
        
        // Check if user is host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            throw new Error("Solo el host puede eliminar banners");
        }
        
        // Get banner data for image deletion
        const bannerRef = doc(db, "banners", bannerId);
        const bannerSnap = await getDoc(bannerRef);
        
        if (!bannerSnap.exists()) {
            throw new Error("El banner no existe");
        }
        
        const bannerData = bannerSnap.data();
        
        // Delete image from storage if exists
        if (bannerData.imageUrl) {
            try {
                console.log("Eliminando imagen del banner...");
                const urlPath = bannerData.imageUrl.split('?')[0];
                const fileName = urlPath.split('/').pop();
                if (fileName) {
                    const storagePath = `banners/${fileName}`;
                    const imageRef = ref(storage, storagePath);
                    await deleteObject(imageRef).catch(error => {
                        console.warn("Error al eliminar imagen, posiblemente ya no existe:", error);
                    });
                }
            } catch (error) {
                console.warn("Error al eliminar imagen:", error);
                // Continue with deletion anyway
            }
        }
        
        // Delete banner document
        await deleteDoc(bannerRef);
        
        console.log("Banner eliminado correctamente");
        
        return {
            success: true
        };
    } catch (error) {
        console.error("Error al eliminar banner:", error);
        throw error;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initBannersManagement);

// Export functions
export {
    loadBanners,
    initBannersManagement
};
