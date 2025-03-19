// banners-controller.js - Versión simplificada sin conflictos
import { showNotification } from './utils.js';

// DOM elements
const bannersContainer = document.getElementById('bannersContainer');
const bannerFormSection = document.getElementById('bannerFormSection');
const createBannerForm = document.getElementById('createBannerForm');
const headerCreateBannerBtn = document.getElementById('headerCreateBannerBtn');
const bannerFormTitle = document.getElementById('bannerFormTitle');
const cancelBannerButton = document.getElementById('cancelBannerButton');
const submitBannerButton = document.getElementById('submitBannerButton');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    console.log("Cargando gestión de banners...");
    
    // Verificar autenticación
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            initBannersManagement(user);
        } else {
            console.log("No hay usuario autenticado");
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }
    });
});

// Función simple para verificar si es administrador
async function checkIfUserIsAdmin(user) {
    if (!user) return false;
    
    // Verificación directa para el admin principal
    if (user.uid === "dvblFee1ZnVKJNWBOR22tSAsNet2") {
        console.log("Usuario es administrador principal");
        return true;
    }
    
    // Verificar en la BD
    try {
        const userDoc = await firebase.firestore()
            .collection("usuarios")
            .where("uid", "==", user.uid)
            .where("isHost", "==", true)
            .get();
            
        return !userDoc.empty;
    } catch (error) {
        console.error("Error al verificar permisos:", error);
        return false;
    }
}

// Inicializar gestión de banners
async function initBannersManagement(user) {
    try {
        // Verificar permisos
        const isAdmin = await checkIfUserIsAdmin(user);
        
        if (!isAdmin) {
            showNotification("No tienes permisos de administrador", "error");
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }
        
        console.log("Usuario validado como administrador");
        
        // Configurar listeners
        setupUI();
        
        // Cargar banners
        loadBanners();
        
    } catch (error) {
        console.error("Error:", error);
        if (bannersContainer) {
            bannersContainer.innerHTML = `<p class="text-center text-red-500 p-4">Error: ${error.message}</p>`;
        }
    }
}

// Configurar interfaz de usuario y event listeners
function setupUI() {
    console.log("Configurando interfaz...");
    
    // Botón Crear Banner
    if (headerCreateBannerBtn) {
        headerCreateBannerBtn.addEventListener('click', () => {
            console.log("Click en Crear Banner");
            resetForm();
            showForm();
        });
    }
    
    // Botón Cancelar
    if (cancelBannerButton) {
        cancelBannerButton.addEventListener('click', () => {
            console.log("Click en Cancelar");
            hideForm();
        });
    }
    
    // Formulario
    if (createBannerForm) {
        createBannerForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Preview de imagen
    const bannerImagen = document.getElementById('bannerImagen');
    if (bannerImagen) {
        bannerImagen.addEventListener('change', handleImagePreview);
    }
}

// Funciones para el formulario
function showForm() {
    if (bannerFormSection) {
        bannerFormSection.classList.remove('hidden');
        bannerFormSection.scrollIntoView({ behavior: 'smooth' });
    }
}

function hideForm() {
    if (bannerFormSection) {
        bannerFormSection.classList.add('hidden');
    }
}

function resetForm() {
    if (createBannerForm) {
        createBannerForm.reset();
        
        // Resetear título
        if (bannerFormTitle) {
            bannerFormTitle.textContent = 'Crear Nuevo Banner';
        }
        
        // Resetear botón submit
        if (submitBannerButton) {
            submitBannerButton.textContent = 'Crear Banner';
            submitBannerButton.dataset.editMode = 'false';
            delete submitBannerButton.dataset.bannerId;
        }
        
        // Limpiar previews
        const previews = createBannerForm.querySelectorAll('.image-preview');
        previews.forEach(preview => preview.remove());
    }
}

// Manejar preview de imagen
function handleImagePreview(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Verificar que sea imagen
    if (!file.type.startsWith('image/')) {
        showNotification("El archivo debe ser una imagen", "error");
        event.target.value = '';
        return;
    }
    
    // Verificar tamaño
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
        showNotification("La imagen es demasiado grande. Máximo 5MB", "warning");
    }
    
    // Eliminar preview existente
    const container = event.target.parentElement;
    const existingPreview = container.querySelector('.image-preview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // Crear nuevo preview
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
        showNotification("Error al generar vista previa", "error");
    };
    
    reader.readAsDataURL(file);
}

// Leer archivo como base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// Manejar envío del formulario
async function handleFormSubmit(event) {
    event.preventDefault();
    
    // Obtener datos
    const nombre = document.getElementById('bannerNombre').value.trim();
    const descripcion = document.getElementById('bannerDescripcion').value.trim();
    const url = document.getElementById('bannerUrl').value.trim();
    const orden = parseInt(document.getElementById('bannerOrden').value) || 1;
    const visible = document.getElementById('bannerVisible').checked;
    const bannerImagen = document.getElementById('bannerImagen');
    
    // Validación
    if (!nombre) {
        showNotification("El nombre es obligatorio", "error");
        return;
    }
    
    // Verificar imagen
    const imageFile = bannerImagen && bannerImagen.files.length > 0 ? bannerImagen.files[0] : null;
    const isEditMode = submitBannerButton && submitBannerButton.dataset.editMode === 'true';
    const bannerId = isEditMode ? submitBannerButton.dataset.bannerId : null;
    
    if (!imageFile && !isEditMode) {
        showNotification("Debes seleccionar una imagen", "error");
        return;
    }
    
    if (imageFile && !imageFile.type.startsWith('image/')) {
        showNotification("El archivo debe ser una imagen válida", "error");
        return;
    }
    
    // Mostrar estado de carga
    if (submitBannerButton) {
        submitBannerButton.disabled = true;
        submitBannerButton.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Procesando...';
    }
    
    try {
        // Datos del banner
        const bannerData = {
            nombre,
            descripcion,
            url,
            orden,
            visible
        };
        
        // Convertir imagen a base64
        if (imageFile) {
            const base64Image = await readFileAsBase64(imageFile);
            bannerData.imageData = base64Image;
        }
        
        // Editar o crear banner
        if (isEditMode && bannerId) {
            await updateBanner(bannerId, bannerData);
            showNotification("Banner actualizado correctamente", "success");
        } else {
            await createBanner(bannerData);
            showNotification("Banner creado correctamente", "success");
        }
        
        // Reiniciar formulario
        resetForm();
        hideForm();
        
        // Recargar lista
        await loadBanners();
        
    } catch (error) {
        console.error("Error al procesar banner:", error);
        showNotification(error.message || "Error al procesar el banner", "error");
    } finally {
        // Restaurar botón
        if (submitBannerButton) {
            submitBannerButton.disabled = false;
            submitBannerButton.textContent = isEditMode ? 'Actualizar Banner' : 'Crear Banner';
        }
    }
}

// Crear nuevo banner
async function createBanner(bannerData) {
    const user = firebase.auth().currentUser;
    
    // Añadir metadatos
    bannerData.createdBy = user.uid;
    bannerData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    bannerData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    
    // Guardar en Firestore
    const bannerRef = await firebase.firestore().collection("banners").add(bannerData);
    return { id: bannerRef.id, success: true };
}

// Actualizar banner existente
async function updateBanner(bannerId, bannerData) {
    const user = firebase.auth().currentUser;
    
    // Añadir metadatos de actualización
    const updateData = {
        ...bannerData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user.uid
    };
    
    // Si no hay nueva imagen, no sobrescribir la existente
    if (!bannerData.imageData) {
        delete updateData.imageData;
    }
    
    // Actualizar en Firestore
    const bannerRef = firebase.firestore().collection("banners").doc(bannerId);
    await bannerRef.update(updateData);
    
    return { id: bannerId, success: true };
}

// Cargar y mostrar banners
async function loadBanners() {
    if (!bannersContainer) {
        console.warn("No se encontró el contenedor de banners");
        return;
    }
    
    // Mostrar spinner de carga
    bannersContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
    
    try {
        // Obtener banners
        const bannersRef = firebase.firestore().collection("banners");
        const bannersSnapshot = await bannersRef.orderBy("orden", "asc").get();
        
        // Si no hay banners
        if (bannersSnapshot.empty) {
            bannersContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No hay banners disponibles. Crea el primer banner.</p>';
            return;
        }
        
        // Procesar banners
        const banners = [];
        bannersSnapshot.forEach(doc => {
            banners.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Crear grid
        let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">';
        
        banners.forEach(banner => {
            // Fecha
            const fecha = banner.createdAt ? new Date(banner.createdAt.seconds * 1000) : new Date();
            const fechaFormateada = fecha.toLocaleDateString('es-ES');
            
            // Estado
            const estado = banner.visible !== false ? 
                '<span class="bg-green-100 text-green-600 py-1 px-2 rounded text-xs">Visible</span>' : 
                '<span class="bg-red-100 text-red-600 py-1 px-2 rounded text-xs">Oculto</span>';
            
            // Imagen
            const imageSource = banner.imageUrl || banner.imageData || '';
            
            // Tarjeta
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
                            <button class="text-blue-500 hover:text-blue-700 toggle-visibility-btn" title="${banner.visible !== false ? 'Ocultar banner' : 'Mostrar banner'}">
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
        
        // Insertar en el DOM
        bannersContainer.innerHTML = html;
        
        // Añadir event listeners
        addBannerCardListeners();
        
    } catch (error) {
        console.error("Error al cargar banners:", error);
        bannersContainer.innerHTML = `
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <p class="font-bold">Error al cargar banners</p>
                <p>${error.message || "Inténtalo de nuevo"}</p>
                <button onclick="window.location.reload()" class="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded">
                    Reintentar
                </button>
            </div>
        `;
    }
}

// Añadir event listeners a las tarjetas de banners
function addBannerCardListeners() {
    // Botones de visibilidad
    document.querySelectorAll('.toggle-visibility-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const bannerCard = this.closest('[data-banner-id]');
            const bannerId = bannerCard.dataset.bannerId;
            
            try {
                // Obtener datos actuales
                const bannerRef = firebase.firestore().collection("banners").doc(bannerId);
                const bannerSnap = await bannerRef.get();
                
                if (!bannerSnap.exists) {
                    showNotification("No se encontró el banner", "error");
                    return;
                }
                
                const bannerData = bannerSnap.data();
                const newVisibility = bannerData.visible === false ? true : false;
                
                // Mostrar estado de carga
                const originalHtml = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                this.disabled = true;
                
                // Actualizar visibilidad
                await bannerRef.update({
                    visible: newVisibility,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Actualizar UI
                const icon = this.querySelector('i');
                if (newVisibility) {
                    icon.className = 'fas fa-eye';
                    // Cambiar etiqueta
                    const statusLabel = bannerCard.querySelector('.absolute > span:last-child');
                    if (statusLabel) {
                        statusLabel.className = 'bg-green-100 text-green-600 py-1 px-2 rounded text-xs';
                        statusLabel.textContent = 'Visible';
                    }
                } else {
                    icon.className = 'fas fa-eye-slash';
                    // Cambiar etiqueta
                    const statusLabel = bannerCard.querySelector('.absolute > span:last-child');
                    if (statusLabel) {
                        statusLabel.className = 'bg-red-100 text-red-600 py-1 px-2 rounded text-xs';
                        statusLabel.textContent = 'Oculto';
                    }
                }
                
                this.title = newVisibility ? 'Ocultar banner' : 'Mostrar banner';
                this.disabled = false;
                
                showNotification(`Banner ${newVisibility ? 'visible' : 'oculto'} correctamente`, "success");
                
            } catch (error) {
                console.error("Error al cambiar visibilidad:", error);
                showNotification("Error al cambiar visibilidad", "error");
                
                // Restaurar botón
                this.innerHTML = originalHtml;
                this.disabled = false;
            }
        });
    });
    
    // Botones de editar
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
    
    // Botones de eliminar
    document.querySelectorAll('.delete-banner-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const bannerCard = this.closest('[data-banner-id]');
            const bannerId = bannerCard.dataset.bannerId;
            const bannerName = bannerCard.querySelector('h3').textContent;
            
            if (confirm(`¿Estás seguro que deseas eliminar el banner "${bannerName}"?`)) {
                try {
                    // Mostrar estado de carga
                    const originalHtml = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    this.disabled = true;
                    
                    // Eliminar banner
                    const bannerRef = firebase.firestore().collection("banners").doc(bannerId);
                    await bannerRef.delete();
                    
                    // Eliminar de la UI
                    bannerCard.remove();
                    
                    showNotification("Banner eliminado correctamente", "success");
                    
                    // Si no quedan banners
                    if (document.querySelectorAll('[data-banner-id]').length === 0) {
                        bannersContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No hay banners disponibles. Crea el primer banner.</p>';
                    }
                    
                } catch (error) {
                    console.error("Error al eliminar banner:", error);
                    showNotification(error.message || "Error al eliminar banner", "error");
                    
                    // Restaurar botón
                    this.innerHTML = originalHtml;
                    this.disabled = false;
                }
            }
        });
    });
}

// Cargar banner para edición
async function loadBannerForEdit(bannerId) {
    try {
        // Obtener datos del banner
        const bannerRef = firebase.firestore().collection("banners").doc(bannerId);
        const bannerSnap = await bannerRef.get();
        
        if (!bannerSnap.exists) {
            throw new Error("No se encontró el banner para editar");
        }
        
        const banner = bannerSnap.data();
        
        // Llenar formulario
        document.getElementById('bannerNombre').value = banner.nombre || '';
        document.getElementById('bannerDescripcion').value = banner.descripcion || '';
        document.getElementById('bannerUrl').value = banner.url || '';
        document.getElementById('bannerOrden').value = banner.orden || 1;
        document.getElementById('bannerVisible').checked = banner.visible !== false;
        
        // Mostrar imagen actual
        const imageSource = banner.imageUrl || banner.imageData;
        if (imageSource) {
            const container = document.getElementById('bannerImagen').parentElement;
            
            // Eliminar preview existente
            const existingPreview = container.querySelector('.image-preview');
            if (existingPreview) {
                existingPreview.remove();
            }
            
            // Crear preview
            const previewDiv = document.createElement('div');
            previewDiv.className = 'image-preview mt-2';
            previewDiv.innerHTML = `
                <p class="text-sm text-gray-600">Imagen actual:</p>
                <img src="${imageSource}" alt="Imagen actual" class="h-32 object-cover rounded mt-1">
                <p class="text-xs text-gray-500">Cargar nueva imagen para reemplazar (opcional)</p>
            `;
            container.appendChild(previewDiv);
        }
        
        // Actualizar título y botón
        if (bannerFormTitle) {
            bannerFormTitle.textContent = 'Editar Banner';
        }
        
        if (submitBannerButton) {
            submitBannerButton.textContent = 'Actualizar Banner';
            submitBannerButton.dataset.editMode = 'true';
            submitBannerButton.dataset.bannerId = bannerId;
        }
        
        // Mostrar formulario
        showForm();
        
    } catch (error) {
        console.error("Error al cargar banner para editar:", error);
        throw error;
    }
}

// Exportar solo lo necesario
export {
    loadBanners,
    initBannersManagement
};
