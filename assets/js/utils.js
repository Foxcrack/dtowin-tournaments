// utils.js - Funciones de utilidad compartidas
import { auth } from './firebase.js';

/**
 * Muestra una notificación al usuario
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de notificación (info, success, error, warning)
 */
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

/**
 * Función para mostrar una sección y ocultar las demás
 * @param {string} sectionId - ID de la sección a mostrar
 */
export function showSection(sectionId) {
    console.log("Mostrando sección:", sectionId);
    
    // Obtener todas las secciones
    const sections = document.querySelectorAll('.section-container > div');
    
    // Ocultar todas las secciones
    sections.forEach(section => {
        section.classList.add('hidden');
    });
    
    // Mostrar la sección seleccionada
    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
        selectedSection.classList.remove('hidden');
    }
    
    // Actualizar estilos de navegación
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('text-orange-500', 'font-semibold', 'bg-gray-100');
    });
    
    // Resaltar enlace activo
    const activeLink = document.querySelector(`a[href="${sectionId}.html"], a[href="admin-${sectionId}.html"]`);
    if (activeLink) {
        activeLink.classList.add('text-orange-500', 'font-semibold', 'bg-gray-100');
    }
}

// Otras funciones de utilidad que puedan ser necesarias
