// admin-panel.js - Script principal para el panel de administración
import { auth, isUserHost } from './firebase.js';
import { showNotification, showSection } from './utils.js';
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

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
        const db = firebase.firestore();
        const usersRef = collection(db, "usuarios");
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

// Cargar estadísticas para el dashboard
async function loadDashboardStats() {
    try {
        // Referencias a elementos del dashboard
        const usuariosCounter = document.querySelector('.bg-blue-500 .text-2xl');
        const torneosCounter = document.querySelector('.bg-green-500 .text-2xl');
        const badgesCounter = document.querySelector('.dtowin-primary .text-2xl');
        
        // Cargar contadores desde Firestore
        if (usuariosCounter) {
            usuariosCounter.textContent = "254"; // Valor por defecto
            
            try {
                // Intentar contar usuarios reales
                const db = firebase.firestore();
                const usersRef = collection(db, "usuarios");
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
                const db = firebase.firestore();
                const torneosRef = collection(db, "torneos");
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
                const db = firebase.firestore();
                const userBadgesRef = collection(db, "user_badges");
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

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM cargado, inicializando panel de administración");
    
    // Verificar estado de autenticación
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("Usuario ya autenticado:", user.uid);
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
            const href = this.getAttribute('href');
            
            // Si es un enlace a otra página
            if (href.endsWith('.html')) {
                window.location.href = href;
                return;
            }
            
            // Si es un enlace dentro de la página
            const sectionId = href.substring(1);
            showSection(sectionId);
        });
    });
});

// Exponer lo que sea necesario para scripts HTML inline
window.showSection = showSection;
