// admin-panel-badges.js - Versión mejorada
import { auth, isUserHost } from './firebase.js';
import { getAllBadges, deleteBadge, editBadge } from './badges.js';
import { showNotification } from './admin-panel.js';

// Elementos DOM para la gestión de badges
const badgesContainer = document.getElementById('badgesContainer');
const createBadgeForm = document.getElementById('createBadgeForm');
const headerCreateBadgeButton = document.querySelector('button.dtowin-primary');
const formSection = createBadgeForm ? createBadgeForm.closest('.bg-gray-50') : null;

// Inicializar la gestión de badges
export async function initBadgesManagement() {
  try {
    // Verificar si el usuario es host
    const userIsHost = await isUserHost();
    
    if (!userIsHost) {
      showNotification("No tienes permisos para gestionar badges", "error");
      return;
    }
    
    // Ocultar el formulario por defecto
    if (formSection) {
      formSection.classList.add('hidden');
    }

    // Añadir listener al botón de crear en la cabecera
    if (headerCreateBadgeButton) {
      headerCreateBadgeButton.addEventListener('click', function() {
        // Mostrar formulario de creación de badge
        if (formSection && formSection.classList.contains('hidden')) {
          formSection.classList.remove('hidden');
        }
        
        // Resetear el formulario y configurar modo creación
        if (createBadgeForm) {
          createBadgeForm.reset();
          const submitButton = createBadgeForm.querySelector('button[type="submit"]');
          if (submitButton) {
            submitButton.textContent = 'Crear Badge';
            submitButton.dataset.editMode = 'false';
            delete submitButton.dataset.badgeId;
          }
          
          // Limpiar vista previa
          const badgePreviewContainer = document.getElementById('badgePreviewContainer');
          if (badgePreviewContainer) {
            badgePreviewContainer.innerHTML = '<i class="fas fa-image text-4xl text-gray-400"></i>';
          }
        }
        
        // Hacer scroll al formulario
        createBadgeForm.scrollIntoView({ behavior: 'smooth' });
      });
    }
    
    // Cargar badges existentes
    loadBadges();

  } catch (error) {
    console.error("Error al inicializar gestión de badges:", error);
    showNotification("Error al cargar la gestión de badges. Inténtalo de nuevo.", "error");
  }
}

// Función para cargar todos los badges
export async function loadBadges() {
  try {
    if (!badgesContainer) {
      console.log("No se encontró el contenedor de badges");
      return;
    }
    
    // Mostrar indicador de carga
    badgesContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
    
    // Obtener badges
    const badges = await getAllBadges();
    
    // Si no hay badges
    if (!badges || badges.length === 0) {
      badgesContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No hay badges disponibles. Crea el primer badge.</p>';
      return;
    }
    
    // Crear grid de badges
    let badgesHTML = '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">';
    
    badges.forEach(badge => {
      badgesHTML += `
        <div class="bg-white border rounded-lg p-4 shadow-sm flex items-center" data-badge-id="${badge.id}">
          <div class="h-12 w-12 mr-3 rounded-full overflow-hidden flex items-center justify-center bg-gray-50">
            ${badge.imageUrl ? 
              `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-full h-full object-contain">` : 
              `<div class="badge w-full h-full flex items-center justify-center" style="background-color: ${badge.color}">
                <i class="fas fa-${badge.icono || 'trophy'} text-white"></i>
              </div>`
            }
          </div>
          <div class="flex-grow">
            <h4 class="font-semibold">${badge.nombre}</h4>
            <p class="text-sm text-gray-600 truncate">${badge.descripcion || ''}</p>
          </div>
          <div class="flex space-x-2 ml-2">
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
    
    // Añadir event listeners para botones de editar y eliminar
    addBadgeCardEventListeners();
    
  } catch (error) {
    console.error("Error al cargar badges:", error);
    badgesContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar badges. Inténtalo de nuevo.</p>';
  }
}

// Añadir event listeners a las tarjetas de badges
function addBadgeCardEventListeners() {
  // Botones de eliminar
  document.querySelectorAll('.delete-badge-btn').forEach(button => {
    button.addEventListener('click', async function(e) {
      e.stopPropagation();
      const badgeCard = this.closest('[data-badge-id]');
      const badgeId = badgeCard.dataset.badgeId;
      const badgeName = badgeCard.querySelector('h4').textContent;
      
      if (confirm(`¿Estás seguro que deseas eliminar el badge "${badgeName}"?`)) {
        try {
          const result = await deleteBadge(badgeId);
          if (result.success) {
            badgeCard.remove();
            showNotification("Badge eliminado correctamente", "success");
          } else {
            throw new Error("Error al eliminar badge");
          }
        } catch (error) {
          console.error("Error al eliminar badge:", error);
          showNotification(error.message || "Error al eliminar badge", "error");
        }
      }
    });
  });
  
  // Botones de editar
  document.querySelectorAll('.edit-badge-btn').forEach(button => {
    button.addEventListener('click', async function(e) {
      e.stopPropagation();
      const badgeCard = this.closest('[data-badge-id]');
      const badgeId = badgeCard.dataset.badgeId;
      
      try {
        // Obtener los datos del badge seleccionado
        const badges = await getAllBadges();
        const badgeToEdit = badges.find(b => b.id === badgeId);
        
        if (!badgeToEdit) {
          throw new Error("No se encontró el badge para editar");
        }
        
        // Mostrar el formulario si está oculto
        const formSection = createBadgeForm.closest('.bg-gray-50');
        if (formSection && formSection.classList.contains('hidden')) {
          formSection.classList.remove('hidden');
        }
        
        // Llenar el formulario con los datos del badge
        const nombreBadgeInput = document.getElementById('nombreBadge');
        const descripcionBadgeInput = document.getElementById('descripcionBadge');
        const colorBadgeInput = document.getElementById('colorBadge');
        const iconoBadgeInput = document.getElementById('iconoBadge');
        const badgePreviewContainer = document.getElementById('badgePreviewContainer');
        
        if (nombreBadgeInput) nombreBadgeInput.value = badgeToEdit.nombre || '';
        if (descripcionBadgeInput) descripcionBadgeInput.value = badgeToEdit.descripcion || '';
        if (colorBadgeInput) colorBadgeInput.value = badgeToEdit.color || '#ff6b1a';
        if (iconoBadgeInput) iconoBadgeInput.value = badgeToEdit.icono || 'trophy';
        
        // Mostrar preview si hay imagen
        if (badgePreviewContainer && badgeToEdit.imageUrl) {
          badgePreviewContainer.innerHTML = `<img src="${badgeToEdit.imageUrl}" alt="Vista previa" class="w-full h-full object-contain">`;
        }
        
        // Cambiar el botón de "Crear Badge" a "Confirmar Cambios"
        const submitButton = createBadgeForm.querySelector('button[type="submit"]');
        if (submitButton) {
          submitButton.textContent = 'Confirmar Cambios';
          submitButton.dataset.editMode = 'true';
          submitButton.dataset.badgeId = badgeId;
        }
        
        // Hacer scroll al formulario
        createBadgeForm.scrollIntoView({ behavior: 'smooth' });
        
      } catch (error) {
        console.error("Error al preparar edición de badge:", error);
        showNotification("Error al preparar la edición del badge", "error");
      }
    });
  });
}

// Modificar el handler del formulario para soportar edición
export function setupCreateBadgeForm() {
  if (!createBadgeForm) return;
  
  createBadgeForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    
    // Referencias a elementos del formulario
    const nombreBadgeInput = document.getElementById('nombreBadge');
    const descripcionBadgeInput = document.getElementById('descripcionBadge');
    const colorBadgeInput = document.getElementById('colorBadge');
    const iconoBadgeInput = document.getElementById('iconoBadge');
    const imagenBadgeInput = document.getElementById('imagenBadge');
    const submitButton = createBadgeForm.querySelector('button[type="submit"]');
    
    // Verificar si estamos en modo edición
    const isEditMode = submitButton.dataset.editMode === 'true';
    const badgeId = isEditMode ? submitButton.dataset.badgeId : null;
    
    // Validaciones básicas
    if (!nombreBadgeInput.value.trim()) {
      showNotification("El nombre del badge es obligatorio", "error");
      return;
    }
    
    // Preparar datos del badge
    const badgeData = {
      nombre: nombreBadgeInput.value.trim(),
      descripcion: descripcionBadgeInput.value.trim(),
      color: colorBadgeInput.value,
      icono: iconoBadgeInput.value
    };
    
    // Obtener archivo de imagen si existe
    const imageFile = imagenBadgeInput.files.length > 0 ? imagenBadgeInput.files[0] : null;
    
    try {
      let result;
      submitButton.disabled = true;
      
      if (isEditMode) {
        // Llamar a la función para editar badge
        result = await editBadge(badgeId, badgeData, imageFile);
        showNotification("Badge actualizado correctamente", "success");
      } else {
        // Llamar a la función para crear nuevo badge
        result = await createBadge(badgeData, imageFile);
        showNotification("Badge creado correctamente", "success");
      }
      
      // Limpiar formulario y resetear estado
      createBadgeForm.reset();
      
      // Ocultar el formulario
      const formSection = createBadgeForm.closest('.bg-gray-50');
      if (formSection) {
        formSection.classList.add('hidden');
      }
      
      // Resetear el botón
      submitButton.textContent = 'Crear Badge';
      submitButton.dataset.editMode = 'false';
      delete submitButton.dataset.badgeId;
      
      // Limpiar vista previa
      const badgePreviewContainer = document.getElementById('badgePreviewContainer');
      if (badgePreviewContainer) {
        badgePreviewContainer.innerHTML = '<i class="fas fa-image text-4xl text-gray-400"></i>';
      }
      
      // Recargar la lista de badges
      await loadBadges();
      
    } catch (error) {
      console.error("Error al procesar badge:", error);
      showNotification(error.message || "Error al procesar el badge", "error");
    } finally {
      submitButton.disabled = false;
    }
  });
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  initBadgesManagement();
  setupCreateBadgeForm();
});

// Exportar funciones necesarias
export {
  loadBadges,
  initBadgesManagement
};
