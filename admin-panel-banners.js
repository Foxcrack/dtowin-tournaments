// admin-panel-banners.js - Script para gestión de banners en Dtowin
import { auth, isUserHost, db, storage } from './firebase.js';
import { showNotification } from './admin-panel.js';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

// Variable para controlar si ya se ha inicializado
let initialized = false;

// Elementos del DOM
const bannersContainer = document.getElementById('bannersContainer');
const bannerFormSection = document.getElementById('bannerFormSection');
const createBannerForm = document.getElementById('createBannerForm');
const headerCreateBannerBtn = document.getElementById('headerCreateBannerBtn');
const bannerFormTitle = document.getElementById('bannerFormTitle');
const cancelBannerButton = document.getElementById('cancelBannerButton');
const submitBannerButton = document.getElementById('submitBannerButton');

// Inicializar gestión de banners
async function initBannersManagement() {
    try {
        console.log("Inicializando gestión de banners...");
        
        // Verificar si el usuario está autenticado
        if (!auth.currentUser) {
            console.error("No hay usuario autenticado");
            window.location.href = "index.html";
            return;
        }
        
        // Verificar si el usuario es host/admin
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            showNotification("No tienes permisos para gestionar banners", "error");
            setTimeout(() => {
                window.location.href = "index.html";
            }, 3000);
            return;
        }
        
        // Configurar event listeners
        setupEventListeners();
        
        // Cargar banners existentes
        await loadBanners();
        
    } catch (error) {
        console.error("Error al inicializar gestión de banners:", error);
        showNotification("Error al cargar la gestión de banners. Inténtalo de nuevo.", "error");
    }
}

// Configurar event listeners
function setupEventListeners() {
    console.log("Configurando event listeners...");
    
    // Botón de crear banner
    if (headerCreateBannerBtn) {
        headerCreateBannerBtn.addEventListener('click', () => {
            resetBannerForm();
            showBannerForm();
        });
    } else {
        console.warn("No se encontró el botón 'Crear Banner'");
    }
    
    // Botón de cancelar
    if (cancelBannerButton) {
        cancelBannerButton.addEventListener('click', hideBannerForm);
    } else {
        console.warn("No se encontró el botón Cancelar");
    }
    
    // Envío del formulario - Usando técnica de clonación para prevenir listeners duplicados
    if (createBannerForm) {
        const clonedForm = createBannerForm.cloneNode(true);
        createBannerForm.parentNode.replaceChild(clonedForm, createBannerForm);
        
        // Actualizar referencia al formulario clonado
        const updatedForm = document.getElementById('createBannerForm');
        updatedForm.addEventListener('submit', handleBannerFormSubmit);
        
        // Asegurar que el botón de envío tenga type="submit"
        const submitBtn = document.getElementById('submitBannerButton');
        if (submitBtn && submitBtn.type !== 'submit') {
            submitBtn.type = 'submit';
        }
    } else {
        console.warn("No se encontró el formulario createBannerForm");
    }
    
    // Vista previa de imagen
    const bannerImagen = document.getElementById('bannerImagen');
    if (bannerImagen) {
        bannerImagen.addEventListener('change', handleBannerImagePreview);
    } else {
        console.warn("No se encontró el input de imagen");
    }
}

// Resetear el formulario de banner a su estado inicial
function resetBannerForm() {
    console.log("Reseteando formulario");
    const form = document.getElementById('createBannerForm');
    if (form) {
        form.reset();
        
        // Resetear texto del botón y modo
        const submitBtn = document.getElementById('submitBannerButton');
        if (submitBtn) {
            submitBtn.textContent = 'Crear Banner';
            submitBtn.dataset.editMode = 'false';
            delete submitBtn.dataset.bannerId;
        }
        
        // Resetear título del formulario
        if (bannerFormTitle) {
            bannerFormTitle.textContent = 'Crear Nuevo Banner';
        }
        
        // Limpiar vista previa de imagen
        const previews = form.querySelectorAll('.image-preview');
        previews.forEach(preview => preview.remove());
    } else {
        console.warn("No se pudo resetear el formulario porque no existe");
    }
}

// Mostrar el formulario de banner
function showBannerForm() {
    console.log("Mostrando formulario");
    if (bannerFormSection) {
        bannerFormSection.classList.remove('hidden');
        // Scroll al formulario
        bannerFormSection.scrollIntoView({ behavior: 'smooth' });
    } else {
        console.warn("No se encontró la sección del formulario");
    }
}

// Ocultar el formulario de banner
function hideBannerForm() {
    console.log("Ocultando formulario");
    if (bannerFormSection) {
        bannerFormSection.classList.add('hidden');
    } else {
        console.warn("No se encontró la sección del formulario para ocultar");
    }
}

// Manejar vista previa de imagen de banner
function handleBannerImagePreview(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log("Procesando vista previa de imagen:", file.name);
    
    // Verificar que es una imagen
    if (!file.type.startsWith('image/')) {
        showNotification("El archivo debe ser una imagen", "error");
        event.target.value = '';
        return;
    }
    
    // Verificar tamaño del archivo (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
        showNotification("La imagen es demasiado grande. El tamaño máximo es 5MB", "warning");
    }
    
    // Eliminar vista previa existente
    const container = event.target.parentElement;
    const existingPreview = container.querySelector('.image-preview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // Crear elemento de vista previa
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

// Manejar envío del formulario de banner
async function handleBannerFormSubmit(event) {
    event.preventDefault();
    console.log("Manejando envío de formulario de banner");
    
    // Obtener datos del formulario
    const nombre = document.getElementById('bannerNombre').value.trim();
    const descripcion = document.getElementById('bannerDescripcion').value.trim();
    const url = document.getElementById('bannerUrl').value.trim();
    const orden = parseInt(document.getElementById('bannerOrden').value) || 1;
    const visible = document.getElementById('bannerVisible').checked;
    const bannerImagen = document.getElementById('bannerImagen');
    
    console.log("Datos del formulario:", { nombre, url, orden, visible });
    
    // Validación del formulario
    if (!nombre) {
        showNotification("El nombre del banner es obligatorio", "error");
        return;
    }
    
    // Verificar que la imagen es válida
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
    
    // Verificar si estamos en modo edición
    const bannerId = submitBtn ? submitBtn.dataset.bannerId : null;
    
    console.log("Modo:", isEditMode ? "Edición" : "Creación", "ID:", bannerId);
    
    // Mostrar estado de carga
    if (submitBtn) {
        submitBtn.disabled = true;
        const originalButtonText = submitBtn.textContent;
        submitBtn.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Procesando...';
    }
    
    try {
        // Preparar datos del banner
        const bannerData = {
            nombre,
            descripcion,
            url,
            orden,
            visible
        };
        
        let result;
        
        if (isEditMode && bannerId) {
            // Actualizar banner existente
            console.log("Actualizando banner existente:", bannerId);
            result = await updateBanner(bannerId, bannerData, imageFile);
            showNotification("Banner actualizado correctamente", "success");
        } else {
            // Crear nuevo banner
            console.log("Creando nuevo banner");
            result = await createBanner(bannerData, imageFile);
            showNotification("Banner creado correctamente", "success");
        }
        
        console.log("Operación completada:", result);
        
        // Resetear formulario y ocultar
        resetBannerForm();
        hideBannerForm();
        
        // Recargar lista de banners
        await loadBanners();
        
    } catch (error) {
        console.error("Error al procesar banner:", error);
        showNotification(error.message || "Error al procesar el banner", "error");
    } finally {
        // Restaurar botón
        const submitButton = document.getElementById('submitBannerButton');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = isEditMode ? 'Actualizar Banner' : 'Crear Banner';
        }
    }
}

// Crear un nuevo banner
async function createBanner(bannerData, imageFile) {
    try {
        console.log("Creando banner con datos:", bannerData);
        
        const user = auth.currentUser;
        
        if (!user) {
            throw new Error("Debes iniciar sesión para crear un banner");
        }
        
        // Verificar si el usuario es host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            throw new Error("Solo el host puede crear banners");
        }
        
        if (!imageFile) {
            throw new Error("La imagen es obligatoria para crear un banner");
        }
        
        // Subir imagen primero
        console.log("Subiendo imagen a Storage...");
        const fileName = `banners_${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const storageRef = ref(storage, `banners/${fileName}`);
        
        // Crear blob para evitar problemas de CORS
        const arrayBuffer = await imageFile.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: imageFile.type });
        
        // Subir a Firebase Storage
        await uploadBytes(storageRef, blob);
        const imageUrl = await getDownloadURL(storageRef);
        
        console.log("Imagen subida, URL:", imageUrl);
        
        // Añadir banner a Firestore
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

// Actualizar un banner existente
async function updateBanner(bannerId, bannerData, imageFile) {
    try {
        console.log("Actualizando banner:", bannerId, "con datos:", bannerData);
        
        const user = auth.currentUser;
        
        if (!user) {
            throw new Error("Debes iniciar sesión para actualizar un banner");
        }
        
        // Verificar si el usuario es host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            throw new Error("Solo el host puede actualizar banners");
        }
        
        // Obtener referencia del banner
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
        
        // Mantener URL de imagen actual si no se proporciona una nueva
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
            
            // Crear blob para evitar problemas de CORS
            const arrayBuffer = await imageFile.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: imageFile.type });
            
            // Subir a Firebase Storage
            await uploadBytes(storageRef, blob);
            const imageUrl = await getDownloadURL(storageRef);
            
            updateData.imageUrl = imageUrl;
            console.log("Nueva imagen subida, URL:", imageUrl);
        }
        
        // Actualizar documento
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

// Cargar y mostrar banners
async function loadBanners() {
    try {
        if (!bannersContainer) {
            console.log("No se encontró el contenedor de banners");
            return;
        }
        
        console.log("Cargando banners...");
        
        // Mostrar spinner de carga
        bannersContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
        
        // Obtener banners de Firestore
        const bannersCollection = collection(db, "banners");
        const bannersQuery = query(bannersCollection, orderBy("orden", "asc"));
        const bannersSnapshot = await getDocs(bannersQuery);
        
        // Verificar si tenemos banners
        if (bannersSnapshot.empty) {
            console.log("No hay banners disponibles");
            bannersContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No hay banners disponibles. Crea el primer banner.</p>';
            return;
        }
        
        console.log(`Encontrados ${bannersSnapshot.size} banners`);
        
        // Convertir a array
        const banners = [];
        bannersSnapshot.forEach(doc => {
            banners.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Crear cuadrícula de tarjetas de banner
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
        
        // Añadir event listeners a los botones de acción
        addBannerEventListeners();
        
        console.log("Banners cargados correctamente");
        
    } catch (error) {
        console.error("Error al cargar banners:", error);
        bannersContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar banners. Inténtalo de nuevo.</p>';
    }
}

// Añadir event listeners a las tarjetas de banner
function addBannerEventListeners() {
    // Botones de alternar visibilidad
    document.querySelectorAll('.toggle-banner-visibility-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const bannerCard = this.closest('[data-banner-id]');
            const bannerId = bannerCard.dataset.bannerId;
            
            try {
                // Obtener datos actuales
                const bannerRef = doc(db, "banners", bannerId);
                const bannerSnap = await getDoc(bannerRef);
                
                if (!bannerSnap.exists()) {
                    showNotification("No se encontró el banner", "error");
                    return;
                }
                
                const bannerData = bannerSnap.data();
                const newVisibility = bannerData.visible === false ? true : false;
                
                // Mostrar carga
                const originalHtml = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                this.disabled = true;
                
                // Actualizar visibilidad
                await updateDoc(bannerRef, {
                    visible: newVisibility,
                    updatedAt: serverTimestamp()
                });
                
                // Actualizar UI
                const icon = this.querySelector('i');
                if (newVisibility) {
                    icon.className = 'fas fa-eye';
                    // Actualizar etiqueta de estado
                    const statusLabel = bannerCard.querySelector('.absolute > span:last-child');
                    if (statusLabel) {
                        statusLabel.className = 'bg-green-100 text-green-600 py-1 px-2 rounded text-xs';
                        statusLabel.textContent = 'Visible';
                    }
                } else {
                    icon.className = 'fas fa-eye-slash';
                    // Actualizar etiqueta de estado
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
                showNotification("Error al cambiar visibilidad del banner", "error");
                
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
                    // Mostrar carga
                    const originalHtml = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    this.disabled = true;
                    
                    await deleteBanner(bannerId);
                    
                    // Eliminar tarjeta de la UI
                    bannerCard.remove();
                    
                    showNotification("Banner eliminado correctamente", "success");
                    
                    // Si no quedan banners, mostrar mensaje
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

// Cargar datos de banner para edición
async function loadBannerForEdit(bannerId) {
    try {
        console.log("Cargando banner para editar:", bannerId);
        
        // Obtener datos del banner
        const bannerRef = doc(db, "banners", bannerId);
        const bannerSnap = await getDoc(bannerRef);
        
        if (!bannerSnap.exists()) {
            throw new Error("No se encontró el banner para editar");
        }
        
        const banner = bannerSnap.data();
        console.log("Datos del banner:", banner);
        
        // Llenar formulario con datos del banner
        document.getElementById('bannerNombre').value = banner.nombre || '';
        document.getElementById('bannerDescripcion').value = banner.descripcion || '';
        document.getElementById('bannerUrl').value = banner.url || '';
        document.getElementById('bannerOrden').value = banner.orden || 1;
        document.getElementById('bannerVisible').checked = banner.visible !== false;
        
        // Mostrar imagen actual
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
        
        // Actualizar título del formulario y botón
        const formTitleEl = document.getElementById('bannerFormTitle');
        if (formTitleEl) formTitleEl.textContent = 'Editar Banner';
        
        const submitBtn = document.getElementById('submitBannerButton');
        if (submitBtn) {
            submitBtn.textContent = 'Actualizar Banner';
            submitBtn.dataset.editMode = 'true';
            submitBtn.dataset.bannerId = bannerId;
        }
        
        // Mostrar formulario
        showBannerForm();
        
        console.log("Banner cargado para edición correctamente");
        
    } catch (error) {
        console.error("Error al cargar banner para editar:", error);
        throw error;
    }
}

// Eliminar un banner
async function deleteBanner(bannerId) {
    try {
        console.log("Eliminando banner:", bannerId);
        
        const user = auth.currentUser;
        
        if (!user) {
            throw new Error("Debes iniciar sesión para eliminar un banner");
        }
        
        // Verificar si el usuario es host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            throw new Error("Solo el host puede eliminar banners");
        }
        
        // Obtener datos del banner para eliminación de imagen
        const bannerRef = doc(db, "banners", bannerId);
        const bannerSnap = await getDoc(bannerRef);
        
        if (!bannerSnap.exists()) {
            throw new Error("El banner no existe");
        }
        
        const bannerData = bannerSnap.data();
        
        // Eliminar imagen de storage si existe
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
                // Continuar con la eliminación de todos modos
            }
        }
        
        // Eliminar documento del banner
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
