// badges-fix.js - Solución para corregir el sistema de badges
// Importar solo desde el archivo original badges.js
import { createBadge, editBadge, deleteBadge, getAllBadges } from './badges.js';
import { auth, isUserHost } from './firebase.js';
import { showNotification } from './admin-panel.js';

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log("Inicializando gestor de badges mejorado...");
    
    // Referencias a elementos del DOM
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
    const submitButton = document.getElementById('submitButton');
    const cancelButton = document.getElementById('cancelButton');
    const formTitle = document.getElementById('formTitle');

    // Verificar autenticación
    auth.onAuthStateChanged(async function(user) {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            // Verificar si el usuario es host/admin
            const userIsHost = await isUserHost();
            
            if (!userIsHost) {
                console.log("No tienes permisos para gestionar badges");
                window.location.href = 'index.html';
                return;
            }
            
            // Inicializar gestión de badges
            inicializarGestionBadges();
        } else {
            console.log("No hay usuario autenticado, redirigiendo...");
            window.location.href = 'index.html';
        }
    });

    // Función principal de inicialización
    async function inicializarGestionBadges() {
        // Ocultar formulario por defecto
        if (formSection) {
            formSection.classList.add('hidden');
        }
        
        // Configurar event listeners
        configurarEventListeners();
        
        // Cargar badges existentes
        await cargarBadges();
    }

    // Configurar listeners de eventos
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

    // Manejar envío del formulario
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
                await editBadge(badgeId, badgeData, imageFile);
                mostrarNotificacion("Badge actualizado correctamente", "success");
            } else {
                // Crear nuevo badge
                await createBadge(badgeData, imageFile);
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
            
            // Obtener badges
            const badges = await getAllBadges();
            
            // Si no hay badges
            if (!badges || badges.length === 0) {
                badgesContainer.innerHTML = `
                    <p class="text-center text-gray-600 py-4">
                        No hay badges disponibles. Crea el primer badge.
                    </p>
                `;
                return;
            }
            
            // Crear grid de badges
            let badgesHTML = '<div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">';
            
            badges.forEach(badge => {
                badgesHTML += `
                    <div class="bg-white rounded-lg shadow p-4 flex items-center" data-badge-id="${badge.id}">
                        <div class="h-12 w-12 mr-3 rounded-full overflow-hidden flex items-center justify-center bg-gray-50">
                            ${badge.imageUrl ? 
                                `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-full h-full object-contain">` : 
                                `<div class="badge w-full h-full flex items-center justify-center" style="background-color: ${badge.color || '#ff6b1a'}">
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
                    const badges = await getAllBadges();
                    const badge = badges.find(b => b.id === badgeId);
                    
                    if (!badge) {
                        throw new Error("Badge no encontrado");
                    }
                    
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
                        await deleteBadge(badgeId);
                        
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
        // Utilizar la función global si está disponible
        if (typeof showNotification === 'function') {
            showNotification(mensaje, tipo);
            return;
        }
        
        // Implementación de respaldo si la función global no está disponible
        const notificacionExistente = document.querySelector('.notification');
        if (notificacionExistente) {
            notificacionExistente.remove();
        }
        
        const notificacion = document.createElement('div');
        
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
        
        notificacion.className = `notification fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center`;
        notificacion.innerHTML = `
            <i class="fas fa-${icon} mr-2"></i>
            <span>${mensaje}</span>
        `;
        
        document.body.appendChild(notificacion);
        
        setTimeout(() => {
            notificacion.classList.add('opacity-0');
            notificacion.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                notificacion.remove();
            }, 500);
        }, 3000);
    }
});
