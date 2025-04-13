// auth.js - Manejo completo de autenticación con Google

// Importar funciones y objetos necesarios de Firebase
import { 
    initializeApp 
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { 
    getAuth, 
    signOut, 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { 
    getStorage 
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

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
const db = getFirestore(app);
const storage = getStorage(app);

// Configurar proveedor de Google
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// Referencias a elementos del DOM
let loginBtn, registerBtn, loginModal, registroModal, closeLoginModal, closeRegisterModal;
let showRegisterLink, googleLoginBtn, googleRegisterBtn, mobileMenuBtn, mobileMenu;

// Funciones de autenticación
async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        console.log("Usuario autenticado con Google:", result.user);
        
        // Verificar si el usuario existe en la base de datos
        await ensureUserProfileExists(result.user);
        
        return result.user;
    } catch (error) {
        console.error("Error al iniciar sesión con Google:", error);
        
        // Traducir mensajes de error
        let errorMessage;
        
        switch (error.code) {
            case 'auth/account-exists-with-different-credential':
                errorMessage = "Ya existe una cuenta con este correo electrónico pero con otro método de inicio de sesión.";
                break;
            case 'auth/popup-closed-by-user':
                errorMessage = "El proceso de inicio de sesión fue cancelado.";
                break;
            case 'auth/cancelled-popup-request':
                errorMessage = "La solicitud de inicio de sesión fue cancelada.";
                break;
            case 'auth/popup-blocked':
                errorMessage = "La ventana emergente fue bloqueada por el navegador.";
                break;
            default:
                errorMessage = error.message;
                break;
        }
        
        throw new Error(errorMessage);
    }
}

async function logoutUser() {
    try {
        await signOut(auth);
        console.log("Sesión cerrada correctamente");
        return true;
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        throw error;
    }
}

// Crear perfil de usuario en la base de datos
async function createUserProfile(user, username = null) {
    try {
        // Referenciar la colección de usuarios
        const userRef = doc(db, "usuarios", user.uid);
        
        // Datos básicos del usuario
        const userData = {
            uid: user.uid,
            email: user.email,
            nombre: username || user.displayName || "Usuario",
            photoURL: user.photoURL || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            puntos: 0,
            victorias: 0,
            torneos: [],
            badges: {}
        };
        
        // Guardar los datos del usuario
        await setDoc(userRef, userData);
        console.log("Perfil de usuario creado correctamente");
        
        return userData;
    } catch (error) {
        console.error("Error al crear perfil de usuario:", error);
        throw error;
    }
}

// Verificar si el perfil del usuario existe, y crearlo si no
async function ensureUserProfileExists(user) {
    try {
        // Buscar el usuario por uid
        const usersRef = collection(db, "usuarios");
        const q = query(usersRef, where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        
        // Si no existe, crear el perfil
        if (querySnapshot.empty) {
            console.log("El usuario no existe en la base de datos, creando perfil...");
            return await createUserProfile(user);
        } else {
            console.log("Usuario encontrado en la base de datos");
            
            // Verificar si se necesita actualizar algún campo
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            
            // Actualizar campos si es necesario
            const updates = {};
            let needsUpdate = false;
            
            // Actualizar nombre si está vacío
            if (!userData.nombre && user.displayName) {
                updates.nombre = user.displayName;
                needsUpdate = true;
            }
            
            // Actualizar foto si está vacía
            if (!userData.photoURL && user.photoURL) {
                updates.photoURL = user.photoURL;
                needsUpdate = true;
            }
            
            // Aplicar actualizaciones si es necesario
            if (needsUpdate) {
                updates.updatedAt = serverTimestamp();
                await updateDoc(doc(db, "usuarios", userDoc.id), updates);
                console.log("Perfil de usuario actualizado");
            }
            
            return userData;
        }
    } catch (error) {
        console.error("Error al verificar/crear perfil de usuario:", error);
        throw error;
    }
}

// Funciones de utilidad
function isAuthenticated() {
    return auth.currentUser !== null;
}

function mostrarNotificacion(mensaje, tipo = "info") {
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
    
    if (tipo === 'success') {
        bgColor = 'bg-green-500';
        icon = 'check-circle';
    } else if (tipo === 'error') {
        bgColor = 'bg-red-500';
        icon = 'exclamation-circle';
    } else if (tipo === 'warning') {
        bgColor = 'bg-yellow-500';
        icon = 'exclamation-triangle';
    }
    
    // Estilos de la notificación
    notification.className = `notification fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center`;
    notification.innerHTML = `
        <i class="fas fa-${icon} mr-2"></i>
        <span>${mensaje}</span>
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

// Función para mostrar el modal de login
function showLoginModal() {
    console.log("Mostrando modal de login");
    if (loginModal) {
        loginModal.classList.remove('hidden');
        loginModal.classList.add('flex');
    } else {
        console.error("Modal de login no encontrado");
    }
}

// Función para mostrar el modal de registro
function showRegisterModal() {
    console.log("Mostrando modal de registro");
    if (registroModal) {
        registroModal.classList.remove('hidden');
        registroModal.classList.add('flex');
    } else {
        console.error("Modal de registro no encontrado");
    }
}

// Función para actualizar UI basado en estado de autenticación
function updateUIBasedOnAuth() {
    const currentUser = auth.currentUser;
    console.log("Actualizando UI basado en autenticación:", currentUser ? "Autenticado" : "No autenticado");
    
    if (currentUser) {
        // Usuario autenticado
        if (loginBtn) {
            loginBtn.innerHTML = `
                <div class="flex items-center bg-white rounded-lg px-3 py-1">
                    <img src="${currentUser.photoURL || 'dtowin.png'}" alt="Profile" class="w-8 h-8 rounded-full mr-2">
                    <span class="text-gray-800 font-medium">${currentUser.displayName || 'Usuario'}</span>
                </div>
            `;
            
            loginBtn.removeEventListener('click', showLoginModal);
            loginBtn.addEventListener('click', () => {
                window.location.href = 'perfil.html';
            });
        }
    } else {
        // Usuario no autenticado
        if (loginBtn) {
            loginBtn.textContent = "Iniciar Sesión";
            loginBtn.className = "bg-white text-orange-500 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition";
            
            // Asegurar que tiene el event listener correcto
            loginBtn.addEventListener('click', showLoginModal);
        }
    }
}

// Inicializar la aplicación
function initAuth() {
    // Obtener referencias a elementos DOM cuando el documento esté listo
    loginBtn = document.getElementById('loginBtn');
    registerBtn = document.getElementById('registerBtn');
    loginModal = document.getElementById('loginModal');
    registroModal = document.getElementById('registroModal');
    closeLoginModal = document.getElementById('closeLoginModal');
    closeRegisterModal = document.getElementById('closeRegisterModal');
    showRegisterLink = document.getElementById('showRegisterLink');
    googleLoginBtn = document.getElementById('googleLoginBtn');
    googleRegisterBtn = document.querySelector('.google-register-btn');
    mobileMenuBtn = document.getElementById('mobileMenuBtn');
    mobileMenu = document.getElementById('mobileMenu');
    
    // Configurar event listeners
    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            if (auth.currentUser) {
                window.location.href = 'perfil.html';
            } else {
                showLoginModal();
            }
        });
    }
    
    if (registerBtn) {
        registerBtn.addEventListener('click', function() {
            showRegisterModal();
        });
    }
    
    if (closeLoginModal) {
        closeLoginModal.addEventListener('click', () => {
            loginModal.classList.add('hidden');
            loginModal.classList.remove('flex');
        });
    }
    
    if (closeRegisterModal) {
        closeRegisterModal.addEventListener('click', () => {
            registroModal.classList.add('hidden');
            registroModal.classList.remove('flex');
        });
    }
    
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginModal.classList.add('hidden');
            loginModal.classList.remove('flex');
            registroModal.classList.remove('hidden');
            registroModal.classList.add('flex');
        });
    }
    
    // Configurar login con Google
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            try {
                // Mostrar carga
                googleLoginBtn.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-gray-700 mr-2"></div> Conectando...';
                googleLoginBtn.disabled = true;
                
                // Intentar login
                const user = await loginWithGoogle();
                console.log("Login exitoso:", user);
                
                // Cerrar modal
                loginModal.classList.add('hidden');
                loginModal.classList.remove('flex');
                
                // Mostrar mensaje y actualizar UI
                mostrarNotificacion("¡Bienvenido! Has iniciado sesión correctamente.", "success");
                updateUIBasedOnAuth();
                
                // Recargar la página después de un breve retraso
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                
            } catch (error) {
                console.error("Error en inicio de sesión:", error);
                mostrarNotificacion("Error al iniciar sesión: " + (error.message || "Error desconocido"), "error");
            } finally {
                // Restaurar botón
                googleLoginBtn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="w-5 h-5 mr-2"> Continuar con Google';
                googleLoginBtn.disabled = false;
            }
        });
    }
    
    // Lo mismo para registro con Google
    if (googleRegisterBtn) {
        googleRegisterBtn.addEventListener('click', async () => {
            try {
                // Mostrar carga
                googleRegisterBtn.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-gray-700 mr-2"></div> Conectando...';
                googleRegisterBtn.disabled = true;
                
                // Usar mismo método que login
                const user = await loginWithGoogle();
                console.log("Registro exitoso:", user);
                
                // Cerrar modal
                registroModal.classList.add('hidden');
                registroModal.classList.remove('flex');
                
                // Mostrar mensaje y actualizar UI
                mostrarNotificacion("¡Bienvenido! Tu cuenta ha sido creada correctamente.", "success");
                updateUIBasedOnAuth();
                
                // Recargar la página después de un breve retraso
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                
            } catch (error) {
                console.error("Error en registro:", error);
                mostrarNotificacion("Error al registrarse: " + (error.message || "Error desconocido"), "error");
            } finally {
                // Restaurar botón
                googleRegisterBtn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="w-5 h-5 mr-2"> Continuar con Google';
                googleRegisterBtn.disabled = false;
            }
        });
    }
    
    // Configurar menú móvil
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

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    console.log("Inicializando sistema de autenticación...");
    
    // Inicializar componentes
    initAuth();
    
    // Verificar autenticación actual
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
        } else {
            console.log("No hay usuario autenticado");
        }
        
        updateUIBasedOnAuth();
    });
    
    // Exponer funciones y objetos globalmente
    window.auth = auth;
    window.db = db;
    window.storage = storage;
    window.loginWithGoogle = loginWithGoogle;
    window.logoutUser = logoutUser;
    window.isAuthenticated = isAuthenticated;
    window.mostrarNotificacion = mostrarNotificacion;
    window.showLoginModal = showLoginModal;
    window.showRegisterModal = showRegisterModal;
});

// Exportar funciones y objetos
export {
    auth,
    db,
    storage,
    loginWithGoogle,
    logoutUser,
    isAuthenticated,
    mostrarNotificacion
};
