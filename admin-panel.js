// admin-panel.js - Script principal para el panel de administración (versión corregida)
import { auth, isUserHost } from './firebase.js';
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
export async function initAdminPanel() {
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
            console.log("Navegando a sección:", sectionId);
        });
    });
}

// Función para mostrar una sección y ocultar las demás
export function showSection(sectionId) {
    console.log("Llamando a showSection con:", sectionId);
    
    // Ocultar todas las secciones
    Object.values(sections).forEach(section => {
        if (section) {
            section.classList.add('hidden');
            console.log("Ocultando sección:", section.id);
        }
    });
    
    // Mostrar la sección seleccionada
    if (sections[sectionId]) {
        sections[sectionId].classList.remove('hidden');
        console.log("Mostrando sección:", sectionId);
    } else {
        console.warn("Sección no encontrada:", sectionId);
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
}

// Cargar estadísticas para el dashboard
async function loadDashboardStats() {
    try {
        // Referencias a elementos del dashboard
        const usuariosCounter = document.querySelector('.bg-blue-500 .text-2xl');
        const torneosCounter = document.querySelector('.bg-green-500 .text-2xl');
        const badgesCounter = document.querySelector('.dtowin-primary .text-2xl');
        const proximosTorneosTable = document.querySelector('#dashboard table tbody');
        
        // Cargar contadores desde Firestore (simulado para ejemplo)
        if (usuariosCounter) {
            usuariosCounter.textContent = "254"; // Valor por defecto
            
            try {
                // Intentar contar usuarios reales
                const usersRef = collection(auth.app.firestore(), "usuarios");
                const usersSnapshot = await getDocs(usersRef);
                if (usersSnapshot.size > 0) {
                    usuariosCounter.textContent = usersSnapshot.size.toString();
                }
            } catch (e) {
                console.warn("Error al contar usuarios:", e);
            }
        }
        
        if (torneosCounter) {
            torneosCounter.textContent = "3"; // Valor por defecto
            
            try {
                // Intentar contar torneos activos
                const torneosRef = collection(auth.app.firestore(), "torneos");
                const q = query(torneosRef, where("estado", "in", ["Abierto", "En Progreso"]));
                const torneosSnapshot = await getDocs(q);
                if (torneosSnapshot.size >= 0) {
                    torneosCounter.textContent = torneosSnapshot.size.toString();
                }
            } catch (e) {
                console.warn("Error al contar torneos:", e);
            }
        }
        
        if (badgesCounter) {
            badgesCounter.textContent = "128"; // Valor por defecto
            
            try {
                // Intentar contar badges otorgados
                const userBadgesRef = collection(auth.app.firestore(), "user_badges");
                const userBadgesSnapshot = await getDocs(userBadgesRef);
                if (userBadgesSnapshot.size >= 0) {
                    badgesCounter.textContent = userBadgesSnapshot.size.toString();
                }
            } catch (e) {
                console.warn("Error al contar badges:", e);
            }
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
    
    // Configurar navegación con clicks en el menú
    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('href').substring(1);
            showSection(sectionId);
        });
    });
});

// Exponer globalmente la función showSection para que pueda ser llamada desde el HTML
window.showSection = showSection;

// Exportar funciones que puedan ser necesarias en otros scripts
export {
    showSection,
    showNotification
};
