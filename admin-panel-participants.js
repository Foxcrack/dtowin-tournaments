// admin-panel-participants.js - Script para la gestión de participantes
import { auth, isUserHost, db } from './firebase.js';
import { getUserBadges, assignBadgeToUser } from './badges.js';
import { showNotification } from './admin-panel.js';
import { collection, query, where, orderBy, limit, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Elementos DOM
const participantesContainer = document.getElementById('participantesContainer');
const searchInput = document.getElementById('searchParticipante');
const filterSelect = document.getElementById('filterParticipantes');
const asignarBadgeModal = document.getElementById('asignarBadgeModal');
const closeAsignarBadgeModal = document.getElementById('closeAsignarBadgeModal');

// Variables globales
let currentUserId = null;
let allBadges = [];

// Inicializar gestión de participantes
export async function initParticipantsManagement() {
    try {
        // Verificar si el usuario es host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            showNotification("No tienes permisos para gestionar participantes", "error");
            return;
        }
        
        // Cargar participantes
        await loadParticipants();
        
        // Configurar búsqueda y filtros
        setupSearch();
        
        // Configurar modal de asignación de badges
        setupBadgeModal();
        
    } catch (error) {
        console.error("Error al inicializar gestión de participantes:", error);
        showNotification("Error al cargar la gestión de participantes. Inténtalo de nuevo.", "error");
    }
}

// Cargar listado de participantes
export async function loadParticipants(searchTerm = '', filter = 'all') {
    try {
        if (!participantesContainer) {
            console.log("No se encontró el contenedor de participantes");
            return;
        }
        
        // Mostrar indicador de carga
        participantesContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
        
        // Crear consulta base
        const usersCollection = collection(db, "usuarios");
        let q = query(usersCollection);
        
        // Aplicar filtros
        switch (filter) {
            case 'top10':
                q = query(usersCollection, orderBy("puntos", "desc"), limit(10));
                break;
            case 'new':
                q = query(usersCollection, orderBy("fechaRegistro", "desc"), limit(20));
                break;
            default:
                q = query(usersCollection, orderBy("nombre"));
        }
        
        const querySnapshot = await getDocs(q);
        
        // Filtrar por término de búsqueda si es necesario
        let users = querySnapshot.docs.map(doc => {
            return { id: doc.id, ...doc.data() };
        });
        
        if (searchTerm) {
            searchTerm = searchTerm.toLowerCase();
            users = users.filter(user => 
                (user.nombre && user.nombre.toLowerCase().includes(searchTerm)) || 
                (user.email && user.email.toLowerCase().includes(searchTerm))
            );
        }
        
        // Si no hay usuarios
        if (users.length === 0) {
            participantesContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No se encontraron participantes.</p>';
            return;
        }
        
        // Cargar badges para cada usuario
        for (const user of users) {
            user.badges = await getUserBadges(user.uid);
        }
        
        // Crear tabla de participantes
        let participantesHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead>
                        <tr class="bg-gray-100 text-gray-600 uppercase text-sm">
                            <th class="py-3 px-4 text-left">Usuario</th>
                            <th class="py-3 px-4 text-left">Email</th>
                            <th class="py-3 px-4 text-left">Torneos</th>
                            <th class="py-3 px-4 text-left">Puntos</th>
                            <th class="py-3 px-4 text-left">Badges</th>
                            <th class="py-3 px-4 text-left">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="text-gray-600">
        `;
        
        // Añadir filas para cada usuario
        for (const user of users) {
            // Contar torneos (TO DO: implementar cuando se tenga la colección de participaciones)
            const numTorneos = 0; // Por implementar
            
            // Crear HTML para badges
            let badgesHTML = '';
            if (user.badges && user.badges.length > 0) {
                badgesHTML = '<div class="flex">';
                user.badges.slice(0, 3).forEach(badge => {
                    const style = badge.imageUrl ? 
                        `background-image: url(${badge.imageUrl}); background-size: contain; background-position: center; background-repeat: no-repeat;` : 
                        `background-color: ${badge.color || '#ff6b1a'}`;
                    
                    badgesHTML += `
                        <span class="badge" title="${badge.nombre}" style="${style}">
                            ${!badge.imageUrl ? `<i class="fas fa-${badge.icono || 'trophy'}"></i>` : ''}
                        </span>
                    `;
                });
                
                // Si hay más badges, mostrar contador
                if (user.badges.length > 3) {
                    badgesHTML += `<span class="badge bg-gray-400" title="Ver todos los badges">+${user.badges.length - 3}</span>`;
                }
                
                badgesHTML += '</div>';
            } else {
                badgesHTML = '<span class="text-gray-400">-</span>';
            }
            
            // Añadir fila a la tabla
            participantesHTML += `
                <tr class="border-b hover:bg-gray-50" data-user-id="${user.uid}">
                    <td class="py-3 px-4">
                        <div class="flex items-center">
                            <img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="User" class="w-8 h-8 rounded-full mr-3">
                            <span>${user.nombre || 'Usuario'}</span>
                        </div>
                    </td>
                    <td class="py-3 px-4">${user.email || '-'}</td>
                    <td class="py-3 px-4">${numTorneos}</td>
                    <td class="py-3 px-4">${user.puntos || 0}</td>
                    <td class="py-3 px-4">
                        ${badgesHTML}
                    </td>
                    <td class="py-3 px-4">
                        <button class="text-blue-500 hover:text-blue-700 mr-2 view-profile-btn">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="text-orange-500 hover:text-orange-700 assign-badge-btn" data-user-id="${user.uid}" data-user-name="${user.nombre || 'Usuario'}">
                            <i class="fas fa-award"></i>
                        </button>
                    </td>
                </tr>
            `;
        }
        
        participantesHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        participantesContainer.innerHTML = participantesHTML;
        
        // Añadir event listeners para botones de acciones
        setupActionButtons();
        
    } catch (error) {
        console.error("Error al cargar participantes:", error);
        participantesContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar participantes. Inténtalo de nuevo.</p>';
    }
}

// Configurar búsqueda y filtros
function setupSearch() {
    // Búsqueda
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            const searchTerm = this.value.trim();
            const filter = filterSelect ? filterSelect.value : 'all';
            loadParticipants(searchTerm, filter);
        }, 300));
    }
    
    // Filtro
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            const searchTerm = searchInput ? searchInput.value.trim() : '';
            const filter = this.value;
            loadParticipants(searchTerm, filter);
        });
    }
}

// Configurar botones de acciones
function setupActionButtons() {
    // Botones de ver perfil
    document.querySelectorAll('.view-profile-btn').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.closest('tr').dataset.userId;
            viewUserProfile(userId);
        });
    });
    
    // Botones de asignar badge
    document.querySelectorAll('.assign-badge-btn').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.dataset.userId;
            const userName = this.dataset.userName;
            openAssignBadgeModal(userId, userName);
        });
    });
}

// Ver perfil de usuario
async function viewUserProfile(userId) {
    // Abrir perfil en nueva ventana o implementar modal de detalles
    alert("Ver perfil del usuario " + userId + " (función por implementar)");
}

// Abrir modal para asignar badges
async function openAssignBadgeModal(userId, userName) {
    if (!asignarBadgeModal) {
        console.log("No se encontró el modal de asignar badge");
        return;
    }
    
    try {
        // Guardar ID de usuario para uso posterior
        currentUserId = userId;
        
        // Actualizar título del modal
        const userNameElement = asignarBadgeModal.querySelector('p.text-gray-600 span');
        if (userNameElement) {
            userNameElement.textContent = userName;
        }
        
        // Cargar todos los badges disponibles
        const badgesList = asignarBadgeModal.querySelector('.grid');
        if (badgesList) {
            badgesList.innerHTML = '<div class="col-span-2 flex justify-center py-4"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
            
            // Obtener badges
            const badgesCollection = collection(db, "badges");
            const badgesSnapshot = await getDocs(badgesCollection);
            
            // Obtener badges ya asignados al usuario
            const userBadges = await getUserBadges(userId);
            const userBadgeIds = userBadges.map(badge => badge.id);
            
            // Guardar todos los badges para uso posterior
            allBadges = badgesSnapshot.docs.map(doc => {
                return { id: doc.id, ...doc.data() };
            });
            
            // Si no hay badges
            if (allBadges.length === 0) {
                badgesList.innerHTML = '<p class="col-span-2 text-center text-gray-500 py-4">No hay badges disponibles para asignar.</p>';
                return;
            }
            
            // Crear grid de badges
            let badgesHTML = '';
            
            allBadges.forEach(badge => {
                const isAssigned = userBadgeIds.includes(badge.id);
                
                badgesHTML += `
                    <div class="border rounded-lg p-3 flex flex-col items-center cursor-pointer hover:bg-gray-50 ${isAssigned ? 'bg-gray-100' : ''}" data-badge-id="${badge.id}">
                        <div class="h-16 w-16 mb-2 rounded-full overflow-hidden flex items-center justify-center bg-gray-50">
                            ${badge.imageUrl ? 
                                `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-full h-full object-contain">` : 
                                `<div class="badge" style="background-color: ${badge.color}"><i class="fas fa-${badge.icono || 'trophy'}"></i></div>`
                            }
                        </div>
                        <p class="font-semibold">${badge.nombre}</p>
                        ${isAssigned ? '<span class="text-xs text-green-500 mt-1"><i class="fas fa-check-circle"></i> Ya asignado</span>' : ''}
                    </div>
                `;
            });
            
            badgesList.innerHTML = badgesHTML;
            
            // Añadir event listeners a los badges
            setupBadgeSelection();
        }
        
        // Mostrar modal
        asignarBadgeModal.classList.remove('hidden');
        asignarBadgeModal.classList.add('flex');
        
    } catch (error) {
        console.error("Error al abrir modal de asignar badge:", error);
        showNotification("Error al cargar badges disponibles", "error");
    }
}

// Configurar modal de asignación de badges
function setupBadgeModal() {
    if (!asignarBadgeModal || !closeAsignarBadgeModal) return;
    
    // Cerrar modal
    closeAsignarBadgeModal.addEventListener('click', function() {
        asignarBadgeModal.classList.add('hidden');
        asignarBadgeModal.classList.remove('flex');
        currentUserId = null;
    });
    
    // Botón de asignar badge
    const assignBadgeButton = asignarBadgeModal.querySelector('button.dtowin-primary');
    if (assignBadgeButton) {
        assignBadgeButton.addEventListener('click', assignSelectedBadge);
    }
}

// Configurar selección de badges en el modal
function setupBadgeSelection() {
    let selectedBadgeId = null;
    
    document.querySelectorAll('.grid [data-badge-id]').forEach(badgeElement => {
        // No permitir seleccionar badges ya asignados
        if (badgeElement.classList.contains('bg-gray-100')) return;
        
        badgeElement.addEventListener('click', function() {
            // Deseleccionar badge anterior
            document.querySelectorAll('.grid [data-badge-id]').forEach(el => {
                el.classList.remove('ring-2', 'ring-orange-500');
            });
            
            // Seleccionar este badge
            this.classList.add('ring-2', 'ring-orange-500');
            selectedBadgeId = this.dataset.badgeId;
            
            // Habilitar botón
            const assignButton = asignarBadgeModal.querySelector('button.dtowin-primary');
            if (assignButton) {
                assignButton.disabled = false;
            }
        });
    });
}

// Asignar badge seleccionado
async function assignSelectedBadge() {
    try {
        // Obtener badge seleccionado
        const selectedBadge = document.querySelector('.grid [data-badge-id].ring-2');
        
        if (!selectedBadge || !currentUserId) {
            showNotification("Selecciona un badge primero", "warning");
            return;
        }
        
        const badgeId = selectedBadge.dataset.badgeId;
        
        // Deshabilitar botón y mostrar carga
        const assignButton = asignarBadgeModal.querySelector('button.dtowin-primary');
        if (assignButton) {
            const originalText = assignButton.textContent;
            assignButton.disabled = true;
            assignButton.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Asignando...';
            
            try {
                // Asignar badge al usuario
                const result = await assignBadgeToUser(badgeId, currentUserId);
                
                if (result.success) {
                    // Marcar como asignado en el modal
                    selectedBadge.classList.add('bg-gray-100');
                    selectedBadge.classList.remove('ring-2', 'ring-orange-500');
                    
                    const badgeName = selectedBadge.querySelector('p.font-semibold').textContent;
                    selectedBadge.innerHTML += '<span class="text-xs text-green-500 mt-1"><i class="fas fa-check-circle"></i> Ya asignado</span>';
                    
                    showNotification(`Badge "${badgeName}" asignado correctamente`, "success");
                    
                    // Actualizar tabla de participantes
                    const searchTerm = searchInput ? searchInput.value.trim() : '';
                    const filter = filterSelect ? filterSelect.value : 'all';
                    await loadParticipants(searchTerm, filter);
                    
                    // Cerrar modal
                    setTimeout(() => {
                        asignarBadgeModal.classList.add('hidden');
                        asignarBadgeModal.classList.remove('flex');
                        currentUserId = null;
                    }, 2000);
                }
            } finally {
                // Restaurar botón
                assignButton.disabled = false;
                assignButton.textContent = originalText;
            }
        }
    } catch (error) {
        console.error("Error al asignar badge:", error);
        showNotification(error.message || "Error al asignar badge", "error");
    }
}

// Función debounce para búsqueda
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initParticipantsManagement);

// Exportar funciones
export {
    loadParticipants,
    initParticipantsManagement
};
