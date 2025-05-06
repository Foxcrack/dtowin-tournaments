// auth-admin.js - Script dedicado para la autenticación en el panel de administración
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBHW2HsP2T6DOwLaOYloqZFerFmU_UA4kE",
  authDomain: "dtowin-tournament.firebaseapp.com",
  projectId: "dtowin-tournament",
  storageBucket: "dtowin-tournament.appspot.com",
  messagingSenderId: "991226820083",
  appId: "1:991226820083:web:6387773cf8c76a0f6ace86",
  measurementId: "G-R4Q5YKZXGY"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Configurar persistencia de sesión
setPersistence(auth, browserLocalPersistence);

// Función para simplificar el manejo del estado de autenticación
function handleAuthentication() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Usuario está autenticado
      console.log("Usuario autenticado:", user.uid);
      document.querySelector('body').classList.add('authenticated');
      
      // Mostrar nombre de usuario en panel
      const userDisplayDiv = document.createElement('div');
      userDisplayDiv.className = 'user-info fixed top-4 right-4 bg-white text-gray-800 px-3 py-1 rounded-lg shadow';
      userDisplayDiv.innerHTML = `
        <div class="flex items-center">
          <img src="${user.photoURL || 'dtowin.png'}" alt="Usuario" class="w-8 h-8 rounded-full mr-2">
          <span class="font-medium">${user.displayName || 'Usuario'}</span>
        </div>
      `;
      document.body.appendChild(userDisplayDiv);
      
      // Inicializar las secciones del panel
      initializeAdminSections();
    } else {
      // No hay usuario autenticado, redirigir a la página de inicio
      console.log("Usuario no autenticado. Redirigiendo...");
      window.location.href = 'index.html';
    }
  });
}

// Inicializar las secciones del panel de administración
function initializeAdminSections() {
  const sections = {
    dashboard: document.getElementById('dashboard'),
    torneos: document.getElementById('torneos'),
    participantes: document.getElementById('participantes'),
    badges: document.getElementById('badges'),
    resultados: document.getElementById('resultados'),
    configuracion: document.getElementById('configuracion')
  };
  
  // Función para mostrar una sección y ocultar las demás
  function showSection(sectionId) {
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
  
  // Añadir event listeners a los enlaces de navegación
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const sectionId = this.getAttribute('href').substring(1);
      showSection(sectionId);
    });
  });
  
  // Mostrar la sección dashboard por defecto
  showSection('dashboard');
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', handleAuthentication);

export { auth };
