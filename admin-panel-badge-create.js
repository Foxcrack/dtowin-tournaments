// Script específico para manejar la creación de badges en el panel de administración

import { createBadge } from './badges.js';
import { auth, isUserHost } from './firebase.js';

document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const createBadgeButton = document.querySelector('.crear-badge-btn, button[type="submit"]');
    const nombreBadgeInput = document.getElementById('nombreBadge');
    const descripcionBadgeInput = document.getElementById('descripcionBadge');
    const colorBadgeInput = document.getElementById('colorBadge');
    const iconoBadgeInput = document.getElementById('iconoBadge');
    const imagenBadgeInput = document.getElementById('imagenBadge');

    // Verificar que estamos en la página de administración y los elementos existen
    if (createBadgeButton && nombreBadgeInput) {
        console.log("Script de creación de badges inicializado correctamente");
        
        // Manejar el evento de clic en el botón "Crear Badge"
        createBadgeButton.addEventListener('click', async function(event) {
            event.preventDefault();
            console.log("Botón Crear Badge clickeado");
            
            try {
                // Verificar si el usuario está autenticado
                if (!auth.currentUser) {
                    showNotification("Debes iniciar sesión para crear un badge", "error");
                    return;
                }
                
                // Verificar si el usuario es host
                const userIsHost = await isUserHost();
                if (!userIsHost) {
                    showNotification("No tienes permisos para crear badges", "error");
                    return;
                }
                
                // Validar nombre del badge
                const nombre = nombreBadgeInput.value.trim();
                if (!nombre) {
                    showNotification("El nombre del badge es obligatorio", "error");
                    return;
                }
                
                // Preparar datos del badge
                const badgeData = {
                    nombre: nombre,
                    descripcion: descripcionBadgeInput.value.trim(),
                    color: colorBadgeInput.value,
                    icono: iconoBadgeInput.value
                };
                
                // Obtener archivo de imagen
                const imageFile = imagenBadgeInput.files[0];
                
                // Mostrar indicador de carga
                createBadgeButton.disabled = true;
                createBadgeButton.innerHTML = '<div class="spinner"></div> Creando...';
                showNotification("Creando badge...", "info");
                
                // Crear badge
                const result = await createBadge(badgeData, imageFile);
                
                if (result.success) {
                    showNotification("Badge creado correctamente", "success");
                    
                    // Limpiar formulario
                    document.getElementById('createBadgeForm').reset();
                    
                    // Recargar la página para mostrar el nuevo badge
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                }
            } catch (error) {
                console.error("Error al crear badge:", error);
                showNotification(error.message || "Error al crear badge. Inténtalo de nuevo.", "error");
            } finally {
                // Restaurar botón
                createBadgeButton.disabled = false;
                createBadgeButton.innerHTML = 'Crear Badge';
            }
        });
    } else {
        console.warn("No se encontraron elementos necesarios para la creación de badges");
    }
});

// Función para mostrar notificaciones
function showNotification(message, type = "info") {
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
    
    if (type === 'success') {
        bgColor = 'bg-green-500';
        icon = 'check-circle';
    } else if (type === 'error') {
        bgColor = 'bg-red-500';
        icon = 'exclamation-circle';
    } else if (type === 'warning') {
        bgColor = 'bg-yellow-500';
        icon = 'exclamation-triangle';
    }
    
    // Estilos de la notificación
    notification.className = `notification fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center`;
    notification.innerHTML = `
        <i class="fas fa-${icon} mr-2"></i>
        <span>${message}</span>
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
