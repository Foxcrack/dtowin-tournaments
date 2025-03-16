// admin-panel.js - Script principal para el panel de administración (versión mejorada)
import { auth, isUserHost } from './firebase.js';
import { initBadgesManagement, loadBadges } from './admin-panel-badges.js';
import { initTournamentsManagement, loadTournaments } from './admin-panel-tournaments.js';
import { initResultsManagement } from './admin-panel-results.js';
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Elementos DOM
const sections = {
    dashboard: document.getElementById('dashboard'),
    torneos: document.getElementById('torneos'),
    participantes: document.getElementById('participantes'),
    badges: document.getElementById('badges'),
    resultados: document.getElementById('resultados'),
    configuracion: document.getElementById('configuracion')
};

// Variable para el usuario actual
let currentUser = null;
let userProfile = null;

// Función para inicializar el panel de administración
async function initAdminPanel() {
    try {
        console.log("Iniciando panel de administración...");
        
        // Verificar si hay usuario autenticado
        const user = auth.currentUser;
        
        if (!user) {
            console.log("No hay usuario autenticado. Redirigiendo...");
            // Esperar un momento más por si la autenticación está en proceso
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (!auth.currentUser) {
                window.location.href = 'index.html';
                return;
            }
        }
        
        currentUser = auth.currentUser;
        console.log("Usuario autenticado:", currentUser.uid);
        
        // Verificar si el usuario es host
        const userIsHost = await isUserHost();
        console.log("¿Es host?", userIsHost);
        
        if (!userIsHost) {
            showAccessDenied();
            return;
        }
        
        // Cargar perfil de usuario
        await loadUserProfile();
        
        // Inicializar navegación
        initNavigation();
        
        // Inicializar componentes específicos
        initBadgesManagement();
        initTournamentsManagement();
        initResultsManagement();
        
        // Inicializar dashboard (mostrar por defecto)
        showSection('dashboard');
        
        // Cargar estadísticas para el dashboard
        loadDashboardStats();
        
    } catch (error) {
        console.error("Error al inicializar panel de administración:", error);
        showNotification("Error al inicializar panel de administración", "error");
    }
}

// Cargar perfil del usuario
async function loadUserProfile() {
    try {
        if (!currentUser) return;
        
        // Obtener datos del usuario desde Firestore
        const usersRef = collection(auth.app.firestore(), "usuarios");
        const q = query(usersRef, where("uid", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            userProfile = querySnapshot.docs[0].data();
            
            // Actualizar UI con información del usuario
            const userInfoElement = document.getElementById('userProfile');
            if (userInfoElement) {
                const photoURL = userProfile.photoURL || currentUser.photoURL || 'https://via.placeholder.com/40';
                const displayName = userProfile.nombre || currentUser.displayName || 'Administrador';
                
                userInfoElement.innerHTML = `
                    <img src="${photoURL}" alt="Admin" class="w-8 h-8 rounded-full">
                    <span class="hidden md:inline">${displayName}</span>
                `;
            }
        }
    } catch (error) {
        console.error("Error al cargar perfil de usuario:", error);
    }
}

// Función para mostrar mensaje de acceso denegado
function showAccessDenied() {
    document.body.innerHTML = `
        <div class="flex flex-col items-center justify-center h-screen bg-gray-100">
            <div class="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
                <i class="fas fa-lock text-4xl text-red-500 mb-4"></i>
                <h1 class="text-2xl font-bold mb-4">Acceso Denegado</h1>
                <p class="text-gray-600 mb-6">No tienes permisos para acceder al panel de administración.</p>
                <a href="index.html" class="dtowin-primary text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition inline-block">
                    Volver al inicio
                </a>
            </div>
        </div>
    `;
}

// Función para inicializar la navegación
function initNavigation() {
    // Añadir event listeners a los enlaces de navegación
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('href').substring(1);
            showSection(sectionId);
        });
    });
}

// Función para mostrar una sección y ocultar las demás
export function showSection(sectionId) {
    // Ocultar todas las secciones
    Object.values(sections).forEach(section => {
        if (section) section.classList.add('hidden');
    });
    
    // Mostrar la sección seleccionada
    if (sections[sectionId]) {
        sections[sectionId].classList.remove('hidden');
    }
    
    // Actualizar estilos de navegación
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('text-orange-500', 'font-semibold');
        link.classList.add('hover:bg-gray-100');
    });
    
    // Resaltar enlace activo
    const activeLink = document.querySelector(`a[href="#${sectionId}"]`);
    if (activeLink) {
        activeLink.classList.add('text-orange-500', 'font-semibold');
    }
    
    // Cargar datos específicos de la sección si es necesario
    switch(sectionId) {
        case 'badges':
            loadBadges();
            break;
        case 'torneos':
            loadTournaments();
            break;
    }
}

// Cargar estadísticas para el dashboard
async function loadDashboardStats() {
    try {
        // Referencias a elementos del dashboard
        const usuariosCounter = document.querySelector('.bg-blue-500 .text-2xl');
        const torneosCounter = document.querySelector('.bg-green-500 .text-2xl');
        const badgesCounter = document.querySelector('.dtowin-primary .text-2xl');
        const proximosTorneosTable = document.querySelector('#dashboard table tbody');
        
        // Cargar contadores desde Firestore
        if (usuariosCounter) {
            // Contar usuarios
            const usersRef = collection(auth.app.firestore(), "usuarios");
            const usersSnapshot = await getDocs(usersRef);
            usuariosCounter.textContent = usersSnapshot.size;
        }
        
        if (torneosCounter) {
            // Contar torneos activos
            const torneosRef = collection(auth.app.firestore(), "torneos");
            const q = query(torneosRef, where("estado", "in", ["Abierto", "En Progreso"]));
            const torneosSnapshot = await getDocs(q);
            torneosCounter.textContent = torneosSnapshot.size;
        }
        
        if (badgesCounter) {
            // Contar badges otorgados
            const userBadgesRef = collection(auth.app.firestore(), "user_badges");
            const userBadgesSnapshot = await getDocs(userBadgesRef);
            badgesCounter.textContent = userBadgesSnapshot.size;
        }
        
        // Cargar próximos torneos
        if (proximosTorneosTable) {
            const torneosRef = collection(auth.app.firestore(), "torneos");
            const torneosSnapshot = await getDocs(torneosRef);
            
            // Filtrar y ordenar torneos
            const torneos = torneosSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(torneo => torneo.fecha && new Date(torneo.fecha.seconds * 1000) >= new Date())
                .sort((a, b) => {
                    const dateA = new Date(a.fecha.seconds * 1000);
                    const dateB = new Date(b.fecha.seconds * 1000);
                    return dateA - dateB;
                })
                .slice(0, 3); // Mostrar los 3 próximos
            
            // Crear filas para cada torneo
            let torneosHTML = '';
            
            torneos.forEach(torneo => {
                // Formatear fecha
                const fecha = new Date(torneo.fecha.seconds * 1000);
                const fechaFormateada = `${fecha.getDate()} de ${getMonthName(fecha.getMonth())}, ${fecha.getFullYear()}`;
                
                // Formatear estado con colores
                let estadoHTML = '';
                switch(torneo.estado) {
                    case 'Abierto':
                        estadoHTML = '<span class="bg-green-100 text-green-600 py-1 px-2 rounded text-xs">Abierto</span>';
                        break;
                    case 'Próximo':
                    case 'Próximamente':
                        estadoHTML = '<span class="bg-yellow-100 text-yellow-600 py-1 px-2 rounded text-xs">Próximo</span>';
                        break;
                    case 'Badge Especial':
                        estadoHTML = '<span class="bg-purple-100 text-purple-600 py-1 px-2 rounded text-xs">Badge Especial</span>';
                        break;
                    default:
                        estadoHTML = `<span class="bg-gray-100 text-gray-600 py-1 px-2 rounded text-xs">${torneo.estado || 'N/A'}</span>`;
                }
                
                // Calcular inscritos
                const inscritos = torneo.participants ? torneo.participants.length : 0;
                const capacidad = torneo.capacidad || '∞';
                
                torneosHTML += `
                    <tr class="border-b hover:bg-gray-50">
                        <td class="py-3 px-4">${torneo.nombre || 'Sin nombre'}</td>
                        <td class="py-3 px-4">${fechaFormateada}</td>
                        <td class="py-3 px-4">${inscritos} / ${capacidad}</td>
                        <td class="py-3 px-4">${estadoHTML}</td>
                        <td class="py-3 px-4">
                            <button class="text-blue-500 hover:text-blue-700 mr-2" onclick="showSection('torneos')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="text-orange-500 hover:text-orange-700">
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            proximosTorneosTable.innerHTML = torneosHTML || `
                <tr>
                    <td colspan="5" class="py-4 text-center text-gray-500">No hay torneos próximos</td>
                </tr>
            `;
        }
        
    } catch (error) {
        console.error("Error al cargar estadísticas del dashboard:", error);
    }
}

// Función para mostrar notificaciones
export function showNotification(message, type = "info") {
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

// Función para obtener nombre del mes
function getMonthName(month) {
    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[month];
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM cargado, inicializando panel de administración");
    
    // Verificar estado de autenticación
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            initAdminPanel();
        } else {
            console.log("No hay usuario autenticado, redirigiendo...");
            window.location.href = 'index.html';
        }
    });
});

// Exportar funciones que puedan ser necesarias en otros scripts
export {
    showSection,
    showNotification
};
