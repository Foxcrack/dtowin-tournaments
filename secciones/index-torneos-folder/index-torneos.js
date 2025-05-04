// main.js - Script principal para la plataforma Dtowin
import { auth, db } from '../../firebase.js';
import { loadTournaments } from '../../torneos.js';
import { loadLeaderboard } from '../../leaderboard.js';
import { initRegistrationModule } from '../../registration.js';

// Inicializar la aplicación
export async function initApp() {
    try {
        console.log("Inicializando aplicación Dtowin...");
        
        // Inicializar módulo de registro
        initRegistrationModule();
        
        // Cargar componentes principales
        await Promise.all([
            loadTournaments(),
            loadLeaderboard()
        ]);
        
        // Mostrar mensaje de bienvenida
        console.log("Aplicación inicializada correctamente");
        
        return true;
    } catch (error) {
        console.error("Error al inicializar la aplicación:", error);
        return false;
    }
}

// Comprobar si el usuario actual es administrador
export async function isUserAdmin(uid) {
    try {
        // Lista de administradores fijos
        const adminUIDs = ["dvblFee1ZnVKJNWBOR22tSAsNet2"];
        
        // Si el UID está en la lista de administradores
        if (adminUIDs.includes(uid)) {
            return true;
        }
        
        // Verificar en la base de datos
        const usersRef = collection(db, "usuarios");
        const q = query(usersRef, where("uid", "==", uid), where("isHost", "==", true));
        const querySnapshot = await getDocs(q);
        
        return !querySnapshot.empty;
    } catch (error) {
        console.error("Error al verificar si el usuario es administrador:", error);
        return false;
    }
}

// Función genérica para mostrar notificaciones
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

// Exponer función de notificación en el objeto window para acceso global
window.mostrarNotificacion = showNotification;

// Exportar funciones principales
export {
    initApp,
    isUserAdmin,
    showNotification
};

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', initApp);
