// admin-panel-badges.js - Script específico para la gestión de badges en el panel de administración
import { auth, isUserHost } from './firebase.js';
import { getAllBadges, deleteBadge } from './badges.js';
import { showNotification } from './admin-panel.js';

// Elementos DOM para la gestión de badges
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

  } catch (error) {
    console.error("Error al inicializar gestión de badges:", error);
    showNotification("Error al cargar la gestión de badges. Inténtalo de nuevo.", "error");
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
    });
  });
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initBadgesManagement);

// Exportar funciones que puedan ser necesarias en otros scripts
export {
  loadBadges
};
