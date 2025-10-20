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

/**
 * Obtiene la zona horaria del usuario
 * @returns {string} - Zona horaria del usuario (ej: "America/Bogota")
 */
export function getUserTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Convierte una fecha y hora local a UTC para guardar en Firestore
 * @param {string} dateStr - Fecha en formato YYYY-MM-DD
 * @param {string} timeStr - Hora en formato HH:MM
 * @param {string} timeZone - Zona horaria (opcional, usa la del usuario por defecto)
 * @returns {Date} - Fecha en UTC
 */
export function convertLocalToUTC(dateStr, timeStr, timeZone = null) {
    const userTimeZone = timeZone || getUserTimeZone();
    
    // Crear fecha en la zona horaria específica
    const localDateTime = new Date(`${dateStr}T${timeStr}:00`);
    
    // Obtener el offset de la zona horaria
    const tempDate = new Date(localDateTime.toLocaleString("en-US", { timeZone: userTimeZone }));
    const tempUTC = new Date(localDateTime.toLocaleString("en-US", { timeZone: "UTC" }));
    const offset = tempUTC.getTime() - tempDate.getTime();
    
    // Aplicar el offset para obtener UTC correcto
    return new Date(localDateTime.getTime() + offset);
}

/**
 * Convierte una fecha UTC a la zona horaria local del usuario
 * @param {Date|any} utcDate - Fecha en UTC (puede ser Timestamp de Firebase)
 * @param {string} timeZone - Zona horaria (opcional, usa la del usuario por defecto)
 * @returns {Date} - Fecha en la zona horaria local
 */
export function convertUTCToLocal(utcDate, timeZone = null) {
    const userTimeZone = timeZone || getUserTimeZone();
    
    // Convertir Timestamp de Firebase a Date si es necesario
    let date = utcDate;
    if (utcDate && typeof utcDate.toDate === 'function') {
        date = utcDate.toDate();
    } else if (typeof utcDate === 'string') {
        date = new Date(utcDate);
    }
    
    // Crear nueva fecha en la zona horaria local
    return new Date(date.toLocaleString("en-US", { timeZone: userTimeZone }));
}

/**
 * Formatea una fecha para mostrar en la zona horaria local
 * @param {Date|any} utcDate - Fecha en UTC
 * @param {Object} options - Opciones de formato
 * @returns {string} - Fecha formateada
 */
export function formatDateTimeInLocalZone(utcDate, options = {}) {
    const userTimeZone = getUserTimeZone();
    
    // Convertir Timestamp de Firebase a Date si es necesario
    let date = utcDate;
    if (utcDate && typeof utcDate.toDate === 'function') {
        date = utcDate.toDate();
    } else if (typeof utcDate === 'string') {
        date = new Date(utcDate);
    }
    
    const defaultOptions = {
        timeZone: userTimeZone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    const formatOptions = { ...defaultOptions, ...options };
    
    return date.toLocaleString('es-ES', formatOptions);
}

/**
 * Obtiene el nombre de la zona horaria en español
 * @param {string} timeZone - Zona horaria (opcional, usa la del usuario por defecto)
 * @returns {string} - Nombre de la zona horaria
 */
export function getTimeZoneName(timeZone = null) {
    const userTimeZone = timeZone || getUserTimeZone();
    
    const timeZoneNames = {
        'America/Bogota': 'COT (Colombia)',
        'America/Mexico_City': 'CST (México)',
        'America/Argentina/Buenos_Aires': 'ART (Argentina)',
        'America/Santiago': 'CLT (Chile)',
        'America/Lima': 'PET (Perú)',
        'America/Caracas': 'VET (Venezuela)',
        'Europe/Madrid': 'CET (España)',
        'America/New_York': 'EST (Estados Unidos - Este)',
        'America/Los_Angeles': 'PST (Estados Unidos - Oeste)',
        'Europe/London': 'GMT (Reino Unido)'
    };
    
    return timeZoneNames[userTimeZone] || userTimeZone;
}

// Otras funciones de utilidad que puedan ser necesarias
