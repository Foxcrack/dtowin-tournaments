// admin-panel-badges.js - Script específico para la gestión de badges en el panel de administración
import { auth, isUserHost } from './firebase.js';
import { createBadge, getAllBadges, deleteBadge } from './badges.js';

// Elementos DOM para la gestión de badges
const createBadgeForm = document.getElementById('createBadgeForm');
const nombreBadge = document.getElementById('nombreBadge');
const descripcionBadge = document.getElementById('descripcionBadge');
const colorBadge = document.getElementById('colorBadge');
const iconoBadge = document.getElementById('iconoBadge');
const imagenBadge = document.getElementById('imagenBadge');
const badgePreviewContainer = document.getElementById('badgePreviewContainer');
const badgesContainer = document.getElementById('badgesContainer'); // Contenedor donde se muestran todos los badges

// Inicializar la gestión de badges
export async function initBadgesManagement() {
  try {
    // Verificar si el usuario es host
    const userIsHost = await isUserHost();
    if (!userIsHost) {
      // Si no es host, mostrar mensaje
      const badgesSection = document.getElementById('badges');
      if (badgesSection) {
        badgesSection.innerHTML = `
          <div class="bg-white rounded-lg shadow p-6 mb-6">
            <h2 class="text-2xl font-bold mb-6 text-center">Acceso Restringido</h2>
            <p class="text-center text-gray-600">Solo los administradores pueden gestionar los badges.</p>
            <div class="flex justify-center mt-4">
              <a href="index.html" class="dtowin-primary text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition">
                Volver al inicio
              </a>
            </div>
          </div>
        `;
        return;
      }
    }

    // Cargar badges existentes
    loadBadges();

    // Event listeners
    if (createBadgeForm) {
      createBadgeForm.addEventListener('submit', handleCreateBadge);
    }

    if (imagenBadge) {
      imagenBadge.addEventListener('change', handleBadgeImagePreview);
    }

    // También podemos agregar event listeners para editar o eliminar badges
    // Estos se agregarán dinámicamente cuando se carguen los badges
  } catch (error) {
    console.error("Error al inicializar gestión de badges:", error);
    showNotification("Error al cargar la gestión de badges. Inténtalo de nuevo.", "error");
  }
}

// Función para manejar la creación de badges
async function handleCreateBadge(event) {
  event.preventDefault();
  
  // Mostrar indicador de carga
  const submitButton = createBadgeForm.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Creando...';
  
  try {
    // Validar que tenga nombre
    if (!nombreBadge.value.trim()) {
      throw new Error("El nombre del badge es obligatorio");
    }
    
    // Preparar datos
    const badgeData = {
      nombre: nombreBadge.value.trim(),
      descripcion: descripcionBadge.value.trim(),
      color: colorBadge.value,
      icono: iconoBadge.value
    };
    
    // Obtener archivo de imagen si existe
    const imageFile = imagenBadge.files[0];
    
    // Crear badge
    const result = await createBadge(badgeData, imageFile);
    
    if (result.success) {
      // Limpiar formulario
      createBadgeForm.reset();
      badgePreviewContainer.innerHTML = '<i class="fas fa-image text-4xl text-gray-400"></i>';
      
      // Recargar badges
      loadBadges();
      
      // Mostrar notificación
      showNotification("Badge creado correctamente", "success");
    }
  } catch (error) {
    console.error("Error al crear badge:", error);
    showNotification(error.message || "Error al crear badge. Inténtalo de nuevo.", "error");
  } finally {
    // Restaurar botón
    submitButton.disabled = false;
    submitButton.innerHTML = originalButtonText;
  }
}

// Función para manejar la vista previa de la imagen del badge
function handleBadgeImagePreview(event) {
  const file = event.target.files[0];
  
  if (file) {
    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      showNotification("El archivo debe ser una imagen", "error");
      imagenBadge.value = '';
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

// Función para cargar todos los badges
async function loadBadges() {
  try {
    if (!badgesContainer) {
      console.error("No se encontró el contenedor de badges");
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
        <div class="bg-white border rounded-lg p-4 shadow-sm flex flex-col items-center text-center" data-badge-id="${badge.id}">
          <div class="h-16 w-16 mb-2 rounded-full overflow-hidden flex items-center justify-center bg-gray-50">
            ${badge.imageUrl ? 
              `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-full h-full object-contain">` : 
              `<div class="badge" style="background-color: ${badge.color}"><i class="fas fa-${badge.icono || 'trophy'}"></i></div>`
            }
          </div>
          <h4 class="font-semibold">${badge.nombre}</h4>
          <p class="text-sm text-gray-600">${badge.descripcion || ''}</p>
          <div class="mt-2 flex space-x-2">
            <button class="text-blue-500 hover:text-blue-700 edit-badge-btn"><i class="fas fa-edit"></i></button>
            <button class="text-red-500 hover:text-red-700 delete-badge-btn"><i class="fas fa-trash"></i></button>
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
    button.addEventListener('click', async function() {
      const badgeCard = this.closest('[data-badge-id]');
      const badgeId = badgeCard.dataset.badgeId;
      const badgeName = badgeCard.querySelector('h4').textContent;
      
      if (confirm(`¿Estás seguro que deseas eliminar el badge "${badgeName}"?`)) {
        try {
          await deleteBadge(badgeId);
          badgeCard.remove();
          showNotification("Badge eliminado correctamente", "success");
        } catch (error) {
          console.error("Error al eliminar badge:", error);
          showNotification(error.message || "Error al eliminar badge", "error");
        }
      }
    });
  });
  
  // Botones de editar (si se implementa la edición)
  document.querySelectorAll('.edit-badge-btn').forEach(button => {
    button.addEventListener('click', function() {
      const badgeId = this.closest('[data-badge-id]').dataset.badgeId;
      showNotification("La edición de badges estará disponible próximamente", "info");
      // Aquí se implementaría la lógica para editar un badge
    });
  });
}

// Función para mostrar notificaciones
function showNotification(message, type = "info") {
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
  notification.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center`;
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
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}
