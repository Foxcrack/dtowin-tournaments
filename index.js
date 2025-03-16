// index.js - Script principal que coordina todos los módulos (versión corregida)
import { auth } from './firebase.js';
import { initAdminPanel, showSection, showNotification } from './admin-panel.js';
import { initBadgesManagement, loadBadges } from './admin-panel-badges.js';
import { initTournamentsManagement, loadTournaments } from './admin-panel-tournaments.js';
import { initParticipantsManagement, loadParticipants } from './admin-panel-participants.js';
import { initResultsManagement } from './admin-panel-results.js';
import { initConfigManagement } from './admin-panel-config.js';

// Cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log("Inicializando panel de administración...");
    
    // Mostrar pantalla de carga
    showLoading();
    
    // Verificar autenticación
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            // Inicializar componentes
            initializeComponents();
        } else {
            console.log("No hay usuario autenticado, redirigiendo...");
            hideLoading();
            window.location.href = 'index.html';
        }
    });
});

// Función para mostrar pantalla de carga
function showLoading() {
    // Verificar si ya existe
    let loadingOverlay = document.getElementById('loadingOverlay');
    
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.className = 'fixed inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50';
        loadingOverlay.innerHTML = `
            <div class="text-center">
                <div class="spinner w-12 h-12 border-4 border-t-4 border-gray-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                <p class="text-gray-700">Cargando panel de administración...</p>
            </div>
        `;
        
        document.body.appendChild(loadingOverlay);
    }
}

// Función para ocultar pantalla de carga
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

// Inicializar todos los componentes
function initializeComponents() {
    try {
        console.log("Inicializando componentes del panel de administración...");
        
        // Inicializar panel principal
        initAdminPanel();
        
        // Exponer la función de navegación globalmente
        window.showSection = showSection;
        
        // Inicializar componentes específicos
        try { initBadgesManagement(); } catch (e) { console.warn("Error en initBadgesManagement:", e); }
        try { initTournamentsManagement(); } catch (e) { console.warn("Error en initTournamentsManagement:", e); }
        try { initParticipantsManagement(); } catch (e) { console.warn("Error en initParticipantsManagement:", e); }
        try { initResultsManagement(); } catch (e) { console.warn("Error en initResultsManagement:", e); }
        try { initConfigManagement(); } catch (e) { console.warn("Error en initConfigManagement:", e); }
        
        // Configurar navegación global
        setupGlobalNavigation();
        
        // Ocultar pantalla de carga
        hideLoading();
        
        // Si hay un hash en la URL, navegar a esa sección
        if (window.location.hash) {
            const sectionId = window.location.hash.substring(1);
            setTimeout(() => {
                showSection(sectionId);
            }, 300);
        }
        
        console.log("Panel de administración inicializado correctamente");
        
    } catch (error) {
        console.error("Error al inicializar componentes:", error);
        hideLoading();
        showNotification("Error al inicializar el panel de administración", "error");
    }
}

// Configurar navegación global
function setupGlobalNavigation() {
    // Event listeners para manejar cambios de sección
    document.querySelectorAll('nav a, a[href^="#"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Obtener ID de sección
            const href = this.getAttribute('href');
            if (!href || !href.startsWith('#')) return;
            
            const sectionId = href.substring(1);
            if (!sectionId) return;
            
            console.log("Click detectado en enlace a:", sectionId);
            
            // Mostrar sección
            showSection(sectionId);
            
            // Actualizar URL sin recargar página
            window.history.pushState(null, '', `#${sectionId}`);
            
            // Cargar datos específicos de la sección si es necesario
            switch(sectionId) {
                case 'badges':
                    try { loadBadges(); } catch (e) { console.warn("Error al cargar badges:", e); }
                    break;
                case 'torneos':
                    try { loadTournaments(); } catch (e) { console.warn("Error al cargar torneos:", e); }
                    break;
                case 'participantes':
                    try { loadParticipants(); } catch (e) { console.warn("Error al cargar participantes:", e); }
                    break;
            }
        });
    });
    
    // Toggle menú móvil
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', function() {
            if (mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.remove('hidden');
                mobileMenuBtn.innerHTML = '<i class="fas fa-times"></i>';
            } else {
                mobileMenu.classList.add('hidden');
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            }
        });
    }
}

// También exponer funciones útiles globalmente
window.adminTools = {
    showSection,
    showNotification,
    loadBadges,
    loadTournaments,
    loadParticipants
};
