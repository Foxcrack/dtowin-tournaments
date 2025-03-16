// gestion-badges.js - Sistema completo para la gestión de badges
import { auth, db, storage, isUserHost } from './firebase.js';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, 
         query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

// Elementos del DOM
const badgesContainer = document.getElementById('badgesContainer');
const createBadgeForm = document.getElementById('createBadgeForm');
const formSection = createBadgeForm ? createBadgeForm.closest('.bg-gray-50') : null;
const headerCreateBadgeBtn = document.getElementById('headerCreateBadgeBtn');
const nombreBadgeInput = document.getElementById('nombreBadge');
const descripcionBadgeInput = document.getElementById('descripcionBadge');
const colorBadgeInput = document.getElementById('colorBadge');
const iconoBadgeInput = document.getElementById('iconoBadge');
const imagenBadgeInput = document.getElementById('imagenBadge');
const badgePreviewContainer = document.getElementById('badgePreviewContainer');
const submitButton = createBadgeForm ? createBadgeForm.querySelector('button[type="submit"]') : null;
const cancelButton = createBadgeForm ? createBadgeForm.querySelector('#cancelButton') : null;
const formTitle = document.getElementById('formTitle');

// Inicializar gestión de badges
export async function inicializarGestionBadges() {
    try {
        console.log("Inicializando gestión de badges...");
        
        // Verificar si el usuario es administrador
        const userIsHost = await isUserHost();
        if (!userIsHost) {
            mostrarNotificacion("No tienes permisos para gestionar badges", "error");
            return;
        }
        
        // Ocultar formulario por defecto
        ocultarFormulario();
        
        // Configurar listeners de eventos
        configurarEventListeners();
        
        // Cargar badges existentes
        await cargarBadges();
        
        console.log("Gestión de badges inicializada correctamente");
    } catch (error) {
        console.error("Error al inicializar gestión de badges:", error);
        mostrarNotificacion("Error al inicializar la gestión de badges", "error");
    }
}

// Configurar todos los listeners de eventos
function configurarEventListeners() {
    // Botón de crear badge
    if (headerCreateBadgeBtn) {
        headerCreateBadgeBtn.addEventListener('click', () => {
            resetearFormulario();
            mostrarFormulario();
        });
    }
    
    // Botón de cancelar
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            ocultarFormulario();
        });
    }
    
    // Envío del formulario
    if (createBadgeForm) {
        createBadgeForm.addEventListener('submit', manejarEnvioFormulario);
    }
    
    // Vista previa de imagen
    if (imagenBadgeInput) {
        imagenBadgeInput.addEventListener('change', manejarVistaPrevia);
    }
}

// Manejar envío del formulario (para crear y editar)
async function manejarEnvioFormulario(event) {
    event.preventDefault();
    
    // Validación
    if (!nombreBadgeInput || !nombreBadgeInput.value.trim()) {
        mostrarNotificacion("El nombre del badge es obligatorio", "error");
        return;
    }
    
    // Preparar datos del badge
    const badgeData = {
        nombre: nombreBadgeInput.value.trim(),
        descripcion: descripcionBadgeInput ? descripcionBadgeInput.value.trim() : "",
        color: colorBadgeInput ? colorBadgeInput.value : "#ff6b1a",
        icono: iconoBadgeInput ? iconoBadgeInput.value : "trophy"
    };
    
    // Obtener archivo de imagen si se seleccionó
    const imageFile = imagenBadgeInput && imagenBadgeInput.files.length > 0 ? 
                    imagenBadgeInput.files[0] : null;
    
    // Verificar si estamos en modo edición
    const isEditMode = submitButton.dataset.editMode === 'true';
    const badgeId = submitButton.dataset.badgeId;
    
    // Mostrar estado de carga
    const textoOriginalBoton = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Procesando...';
    
    try {
        if (isEditMode && badgeId) {
            // Editar badge existente
            await editarBadge(badgeId, badgeData, imageFile);
            mostrarNotificacion("Badge actualizado correctamente", "success");
        } else {
            // Crear nuevo badge
            await crearBadge(badgeData, imageFile);
            mostrarNotificacion("Badge creado correctamente", "success");
        }
        
        // Ocultar formulario y resetear
        ocultarFormulario();
        resetearFormulario();
        
        // Recargar badges para mostrar la lista actualizada
        await cargarBadges();
    } catch (error) {
        console.error("Error al procesar badge:", error);
        mostrarNotificacion(error.message || "Error al procesar el badge", "error");
    } finally {
        // Restaurar estado del botón
        submitButton.disabled = false;
        submitButton.textContent = textoOriginalBoton;
    }
}

// Crear un nuevo badge
async function crearBadge(badgeData, imageFile) {
    try {
        if (!auth.currentUser) {
            throw new Error("Debes iniciar sesión para crear un badge");
        }
        
        // Verificar que el usuario es administrador
        const userIsHost = await isUserHost();
        if (!userIsHost) {
            throw new Error("Solo los administradores pueden crear badges");
        }
        
        // Subir imagen si se proporcionó
        let imageUrl = null;
        if (imageFile) {
            if (!imageFile.type.startsWith('image/')) {
                throw new Error("El archivo debe ser una imagen");
            }
            
            const storageRef = ref(storage, `badges/${Date.now()}_${imageFile.name}`);
            await uploadBytes(storageRef, imageFile);
            imageUrl = await getDownloadURL(storageRef);
        }
        
        // Crear documento de badge en Firestore
        await addDoc(collection(db, "badges"), {
            nombre: badgeData.nombre,
            descripcion: badgeData.descripcion || "",
            color: badgeData.color || "#ff6b1a",
            icono: badgeData.icono || "trophy",
            imageUrl: imageUrl,
            createdBy: auth.currentUser.uid,
            createdAt: serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error("Error al crear badge:", error);
        throw error;
    }
}

// Editar un badge existente
async function editarBadge(badgeId, badgeData, imageFile) {
    try {
        if (!auth.currentUser) {
            throw new Error("Debes iniciar sesión para editar un badge");
        }
        
        // Obtener referencia del badge
        const badgeRef = doc(db, "badges", badgeId);
        const badgeSnap = await getDoc(badgeRef);
        
        if (!badgeSnap.exists()) {
            throw new Error("El badge no existe");
        }
        
        const datosActuales = badgeSnap.data();
        
        // Manejar actualización de imagen
        let imageUrl = datosActuales.imageUrl;
        
        if (imageFile) {
            // Eliminar imagen anterior si existe
            if (datosActuales.imageUrl) {
                try {
                    const urlPath = datosActuales.imageUrl.split('?')[0];
                    const fileName = urlPath.split('/').pop();
                    const storagePath = `badges/${fileName}`;
                    const oldImageRef = ref(storage, storagePath);
                    await deleteObject(oldImageRef);
                } catch (e) {
                    console.warn("No se pudo eliminar la imagen anterior:", e);
                }
            }
            
            // Subir nueva imagen
            const storageRef = ref(storage, `badges/${Date.now()}_${imageFile.name}`);
            await uploadBytes(storageRef, imageFile);
            imageUrl = await getDownloadURL(storageRef);
        }
        
        // Actualizar documento
        await updateDoc(badgeRef, {
            nombre: badgeData.nombre,
            descripcion: badgeData.descripcion || "",
            color: badgeData.color || "#ff6b1a",
            icono: badgeData.icono || "trophy",
            imageUrl: imageUrl,
            updatedBy: auth.currentUser.uid,
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error("Error al editar badge:", error);
        throw error;
    }
}

// Eliminar un badge
async function eliminarBadge(badgeId) {
    try {
        if (!auth.currentUser) {
            throw new Error("Debes iniciar sesión para eliminar un badge");
        }
        
        // Obtener datos del badge para acceder a la URL de la imagen
        const badgeRef = doc(db, "badges", badgeId);
        const badgeSnap = await getDoc(badgeRef);
        
        if (!badgeSnap.exists()) {
            throw new Error("El badge no existe");
        }
        
        const badgeData = badgeSnap.data();
        
        // Eliminar imagen del storage si existe
        if (badgeData.imageUrl) {
            try {
                const urlPath = badgeData.imageUrl.split('?')[0];
                const fileName = urlPath.split('/').pop();
                const storagePath = `badges/${fileName}`;
                const imageRef = ref(storage, storagePath);
                await deleteObject(imageRef);
            } catch (e) {
                console.warn("No se pudo eliminar la imagen:", e);
                // Continuar con la eliminación del badge incluso si falla la eliminación de la imagen
            }
        }
        
        // Eliminar badge de la colección de badges
        await deleteDoc(badgeRef);
        
        // Verificar asignaciones de badge en otras colecciones y eliminar si es necesario
        try {
            // Verificar badges de torneos
            const tournamentBadgesRef = collection(db, "tournament_badges");
            const tournamentBadgesQuery = query(tournamentBadgesRef, where("badgeId", "==", badgeId));
            const tournamentBadgesSnap = await getDocs(tournamentBadgesQuery);
            
            if (!tournamentBadgesSnap.empty) {
                for (const doc of tournamentBadgesSnap.docs) {
                    await deleteDoc(doc.ref);
                }
                console.log(`Eliminadas ${tournamentBadgesSnap.size} asignaciones de badges a torneos`);
            }
            
            // Verificar badges de usuarios
            const userBadgesRef = collection(db, "user_badges");
            const userBadgesQuery = query(userBadgesRef, where("badgeId", "==", badgeId));
            const userBadgesSnap = await getDocs(userBadgesQuery);
            
            if (!userBadgesSnap.empty) {
                for (const doc of userBadgesSnap.docs) {
                    await deleteDoc(doc.ref);
                }
                console.log(`Eliminadas ${userBadgesSnap.size} asignaciones de badges a usuarios`);
            }
        } catch (e) {
            console.warn("Error al limpiar referencias de badges:", e);
        }
        
        return { success: true };
    } catch (error) {
        console.error("Error al eliminar badge:", error);
        throw error;
    }
}

// Cargar y mostrar badges
async function cargarBadges() {
    if (!badgesContainer) {
        console.warn("No se encontró el contenedor de badges");
        return;
    }
    
    try {
        // Mostrar spinner de carga
        badgesContainer.innerHTML = `
            <div class="flex justify-center py-8">
                <div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
            </div>
        `;
        
        // Obtener badges de Firestore
        const badgesRef = collection(db, "badges");
        const badgesSnapshot = await getDocs(badgesRef);
        
        // Verificar si tenemos badges
        if (badgesSnapshot.empty) {
            badgesContainer.innerHTML = `
                <p class="text-center text-gray-600 py-4">
                    No hay badges disponibles. Crea el primer badge.
                </p>
            `;
            return;
        }
        
        // Procesar badges y generar HTML
        const badges = badgesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        let badgesHTML = '<div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">';
        
        badges.forEach(badge => {
            badgesHTML += `
                <div class="bg-white rounded-lg shadow p-4 flex items-center" data-badge-id="${badge.id}">
                    <div class="h-12 w-12 mr-3 rounded-full overflow-hidden flex items-center justify-center bg-gray-50">
                        ${badge.imageUrl ? 
                            `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-full h-full object-contain">` : 
                            `<div class="badge" style="background-color: ${badge.color}">
                                <i class="fas fa-${badge.icono || 'trophy'} text-white"></i>
                            </div>`
                        }
                    </div>
                    <div class="flex-grow">
                        <h4 class="font-semibold">${badge.nombre}</h4>
                        <p class="text-sm text-gray-600 truncate">${badge.descripcion || ''}</p>
                    </div>
                    <div class="flex flex-col space-y-2">
                        <button class="text-blue-500 hover:text-blue-700 edit-badge-btn" title="Editar badge">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="text-red-500 hover:text-red-700 delete-badge-btn" title="Eliminar badge">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        badgesHTML += '</div>';
        badgesContainer.innerHTML = badgesHTML;
        
        // Añadir event listeners a los botones de editar y eliminar
        configurarBotonesAccion();
        
    } catch (error) {
        console.error("Error al cargar badges:", error);
        badgesContainer.innerHTML = `
            <p class="text-center text-red-500 py-4">
                Error al cargar badges. Inténtalo de nuevo.
            </p>
        `;
    }
}

// Configurar botones de acción (editar/eliminar) en las tarjetas de badges
function configurarBotonesAccion() {
    // Botones de editar
    document.querySelectorAll('.edit-badge-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const badgeCard = this.closest('[data-badge-id]');
            const badgeId = badgeCard.dataset.badgeId;
            
            try {
                // Obtener datos del badge
                const badgeRef = doc(db, "badges", badgeId);
                const badgeSnap = await getDoc(badgeRef);
                
                if (!badgeSnap.exists()) {
                    throw new Error("Badge no encontrado");
                }
                
                const badge = badgeSnap.data();
                
                // Configurar formulario para edición
                if (formTitle) formTitle.textContent = 'Editar Badge';
                
                // Llenar campos del formulario
                if (nombreBadgeInput) nombreBadgeInput.value = badge.nombre || '';
                if (descripcionBadgeInput) descripcionBadgeInput.value = badge.descripcion || '';
                if (colorBadgeInput) colorBadgeInput.value = badge.color || '#ff6b1a';
                if (iconoBadgeInput) iconoBadgeInput.value = badge.icono || 'trophy';
                
                // Mostrar vista previa de imagen si existe
                if (badgePreviewContainer) {
                    if (badge.imageUrl) {
                        badgePreviewContainer.innerHTML = `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-full h-full object-contain">`;
                    } else {
                        badgePreviewContainer.innerHTML = `<i class="fas fa-image text-4xl text-gray-400"></i>`;
                    }
                }
                
                // Configurar botón para modo edición
                if (submitButton) {
                    submitButton.textContent = 'Confirmar Cambios';
                    submitButton.dataset.editMode = 'true';
                    submitButton.dataset.badgeId = badgeId;
                }
                
                // Mostrar formulario
                mostrarFormulario();
                
                // Hacer scroll al formulario
                if (formSection) {
                    formSection.scrollIntoView({ behavior: 'smooth' });
                }
                
            } catch (error) {
                console.error("Error al cargar badge para editar:", error);
                mostrarNotificacion("Error al cargar datos del badge", "error");
            }
        });
    });
    
    // Botones de eliminar
    document.querySelectorAll('.delete-badge-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const badgeCard = this.closest('[data-badge-id]');
            const badgeId = badgeCard.dataset.badgeId;
            const badgeName = badgeCard.querySelector('h4').textContent;
            
            // Mostrar confirmación
            if (confirm(`¿Estás seguro que deseas eliminar el badge "${badgeName}"?`)) {
                try {
                    await eliminarBadge(badgeId);
                    
                    // Eliminar la tarjeta del DOM
                    badgeCard.remove();
                    
                    mostrarNotificacion("Badge eliminado correctamente", "success");
                    
                    // Si no quedan badges, actualizar mensaje
                    if (document.querySelectorAll('[data-badge-id]').length === 0) {
                        badgesContainer.innerHTML = `
                            <p class="text-center text-gray-600 py-4">
                                No hay badges disponibles. Crea el primer badge.
                            </p>
                        `;
                    }
                    
                } catch (error) {
                    console.error("Error al eliminar badge:", error);
                    mostrarNotificacion("Error al eliminar badge", "error");
                }
            }
        });
    });
}

// Función para mostrar el formulario
function mostrarFormulario() {
    if (formSection) {
        formSection.classList.remove('hidden');
    }
}

// Función para ocultar el formulario
function ocultarFormulario() {
    if (formSection) {
        formSection.classList.add('hidden');
    }
}

// Función para resetear el formulario
function resetearFormulario() {
    if (createBadgeForm) {
        createBadgeForm.reset();
        
        // Restaurar texto del botón y título
        if (formTitle) formTitle.textContent = 'Crear Nuevo Badge';
        if (submitButton) {
            submitButton.textContent = 'Crear Badge';
            submitButton.dataset.editMode = 'false';
            delete submitButton.dataset.badgeId;
        }
        
        // Limpiar vista previa de imagen
        if (badgePreviewContainer) {
            badgePreviewContainer.innerHTML = '<i class="fas fa-image text-4xl text-gray-400"></i>';
        }
    }
}

// Manejar vista previa de imagen
function manejarVistaPrevia() {
    if (!imagenBadgeInput || !badgePreviewContainer) return;
    
    const file = imagenBadgeInput.files[0];
    if (file) {
        // Verificar que sea una imagen
        if (!file.type.startsWith('image/')) {
            mostrarNotificacion("El archivo debe ser una imagen", "error");
            imagenBadgeInput.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            badgePreviewContainer.innerHTML = `
                <img src="${e.target.result}" alt="Vista previa" class="w-full h-full object-contain">
            `;
        };
        reader.readAsDataURL(file);
    } else {
        badgePreviewContainer.innerHTML = '<i class="fas fa-image text-4xl text-gray-400"></i>';
    }
}

// Mostrar notificación
function mostrarNotificacion(mensaje, tipo = 'info') {
    // Verificar si ya existe una notificación
    const notificacionExistente = document.querySelector('.notification');
    if (notificacionExistente) {
        notificacionExistente.remove();
    }
    
    // Crear elemento de notificación
    const notificacion = document.createElement('div');
    
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
    notificacion.className = `notification fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center`;
    notificacion.innerHTML = `
        <i class="fas fa-${icon} mr-2"></i>
        <span>${mensaje}</span>
    `;
    
    // Añadir al DOM
    document.body.appendChild(notificacion);
    
    // Eliminar después de 3 segundos
    setTimeout(() => {
        notificacion.classList.add('opacity-0');
        notificacion.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            notificacion.remove();
        }, 500);
    }, 3000);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando gestión de badges...");
    inicializarGestionBadges();
});

// Exportar funciones
export {
    inicializarGestionBadges,
    cargarBadges,
    mostrarNotificacion
};
