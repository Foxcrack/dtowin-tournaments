// admin-panel-badge-create.js - Script para la creación específica de badges
import { createBadge } from './badges.js';
import { auth, isUserHost } from './firebase.js';
import { showNotification } from './admin-panel.js';
import { loadBadges } from './admin-panel-badges.js';

document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const createBadgeForm = document.getElementById('createBadgeForm');
    const createBadgeButton = document.querySelector('button[type="submit"]');
    const headerCreateBadgeButton = document.querySelector('button.dtowin-primary');
    const nombreBadgeInput = document.getElementById('nombreBadge');
    const descripcionBadgeInput = document.getElementById('descripcionBadge');
    const colorBadgeInput = document.getElementById('colorBadge');
    const iconoBadgeInput = document.getElementById('iconoBadge');
    const imagenBadgeInput = document.getElementById('imagenBadge');
    const badgePreviewContainer = document.getElementById('badgePreviewContainer');

    // Verificar que estamos en la página de administración y los elementos existen
    if (createBadgeForm && nombreBadgeInput) {
        console.log("Script de creación de badges inicializado correctamente");
        
        // Event listener para el formulario de creación de badges
        createBadgeForm.addEventListener('submit', handleCreateBadge);
        
        // Event listener para la vista previa de imagen
        if (imagenBadgeInput) {
            imagenBadgeInput.addEventListener('change', handleBadgeImagePreview);
        }
        
        // Si existe un botón de "crear badge" en el encabezado, añadir event listener
        if (headerCreateBadgeButton) {
            headerCreateBadgeButton.addEventListener('click', function() {
                // Mostrar formulario si está oculto
                const formSection = createBadgeForm.closest('.bg-gray-50');
                if (formSection && formSection.classList.contains('hidden')) {
                    formSection.classList.remove('hidden');
                }
                // Hacer scroll al formulario
                createBadgeForm.scrollIntoView({ behavior: 'smooth' });
            });
        }
    } else {
        console.warn("No se encontraron elementos necesarios para la creación de badges");
    }
});

// Función para manejar la creación de badges
async function handleCreateBadge(event) {
    event.preventDefault();
    
    // Referencias a elementos del DOM
    const createBadgeForm = document.getElementById('createBadgeForm');
    const nombreBadgeInput = document.getElementById('nombreBadge');
    const descripcionBadgeInput = document.getElementById('descripcionBadge');
    const colorBadgeInput = document.getElementById('colorBadge');
    const iconoBadgeInput = document.getElementById('iconoBadge');
    const imagenBadgeInput = document.getElementById('imagenBadge');
    
    // Mostrar indicador de carga
    const submitButton = createBadgeForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Creando...';
    
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
        
        // Crear badge
        const result = await createBadge(badgeData, imageFile);
        
        if (result.success) {
            // Limpiar formulario
            createBadgeForm.reset();
            
            // Limpiar vista previa
            const badgePreviewContainer = document.getElementById('badgePreviewContainer');
            if (badgePreviewContainer) {
                badgePreviewContainer.innerHTML = '<i class="fas fa-image text-4xl text-gray-400"></i>';
            }
            
            // Recargar badges
            if (typeof loadBadges === 'function') {
                loadBadges();
            }
            
            // Mostrar notificación
            showNotification("Badge creado correctamente", "success");
        }
    } catch (error) {
        console.error("Error al crear badge:", error);
        showNotification(error.message || "Error al crear badge. Inténtalo de nuevo.", "error");
    } finally {
        // Restaurar botón
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText || 'Crear Badge';
        }
    }
}

// Función para manejar la vista previa de la imagen del badge
function handleBadgeImagePreview(event) {
    const file = event.target.files[0];
    const badgePreviewContainer = document.getElementById('badgePreviewContainer');
    
    if (!badgePreviewContainer) {
        console.warn("No se encontró el contenedor de vista previa de badges");
        return;
    }
    
    if (file) {
        // Validar que sea una imagen
        if (!file.type.startsWith('image/')) {
            showNotification("El archivo debe ser una imagen", "error");
            event.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            // Limpiar contenedor
            badgePreviewContainer.innerHTML = '';
            
            // Crear imagen
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'w-full h-full object-contain';
            img.alt = 'Vista previa del badge';
            
            // Añadir imagen al contenedor
            badgePreviewContainer.appendChild(img);
        };
        
        reader.readAsDataURL(file);
    }
}
