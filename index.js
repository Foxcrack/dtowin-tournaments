// index.js - Script principal que coordina todos los módulos
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
        
        // Inicializar componentes específicos
        initBadgesManagement();
        initTournamentsManagement();
        initParticipantsManagement();
        initResultsManagement();
        initConfigManagement();
        
        // Configurar navegación global
        setupGlobalNavigation();
        
        // Ocultar pantalla de carga
        hideLoading();
        
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
            
            // Mostrar sección
            showSection(sectionId);
            
            // Cargar datos específicos de la sección si es necesario
            switch(sectionId) {
                case 'badges':
                    loadBadges();
                    break;
                case 'torneos':
                    loadTournaments();
                    break;
                case 'participantes':
                    loadParticipants();
                    break;
            }
        });
    });
    
    // Cerrar sesión
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            try {
                await auth.signOut();
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                showNotification("Error al cerrar sesión", "error");
            }
        });
    }
    
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
