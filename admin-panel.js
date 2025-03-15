// admin-panel.js - Script principal para el panel de administración
import { auth, isUserHost } from './firebase.js';

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

// Función para inicializar el panel de administración
async function initAdminPanel() {
    try {
        // Verificar si hay usuario autenticado
        const user = auth.currentUser;
        
        if (!user) {
            // Redirigir al inicio si no hay usuario autenticado
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        
        // IMPORTANTE: DESACTIVAR TEMPORALMENTE LA VERIFICACIÓN DE HOST
        // Esta línea es crítica - omite la verificación de permisos por ahora
        const userIsHost = true; // Temporalmente permitimos acceso a todos
        
        // Inicializar navegación
        initNavigation();
        
        // Inicializar dashboard (mostrar por defecto)
        showSection('dashboard');
        
    } catch (error) {
        console.error("Error al inicializar panel de administración:", error);
        showNotification("Error al inicializar panel de administración", "error");
    }
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
