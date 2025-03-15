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
        
        // Verificar si el usuario es host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            // Mostrar mensaje de acceso denegado y redirigir
            document.body.innerHTML = `
                <div class="flex flex-col items-center justify-center h-screen bg-gray-100">
                    <div class="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
                        <i class="fas fa-lock text-4xl text-red-500 mb-4"></i>
                        <h1 class="text-2xl font-bold mb-4">Acceso Denegado</h1>
                        <p class="text-gray-600 mb-6">No tienes permisos para acceder al panel de administración.</p>
                        <a href="index.html" class="dtowin-primary text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition">
                            Volver al inicio
                        </a>
                    </div>
                </div>
            `;
            return;
        }
        
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

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Verificar estado de autenticación
    auth.onAuthStateChanged(user => {
        if (user) {
            initAdminPanel();
        } else {
            window.location.href = 'index.html';
        }
    });
});
