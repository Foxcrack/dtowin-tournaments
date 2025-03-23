// firebase.js - Configuración y funciones de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    updateProfile
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
import { getStorage } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

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

// Proveedor de autenticación con Google
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// Función para login con correo y contraseña
export async function loginWithEmail(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Usuario autenticado:", userCredential.user);
        
        // Verificar si el usuario existe en la base de datos
        await ensureUserProfileExists(userCredential.user);
        
        return userCredential.user;
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        
        // Traducir mensajes de error
        let errorMessage;
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = "No existe una cuenta con este correo electrónico.";
                break;
            case 'auth/wrong-password':
                errorMessage = "Contraseña incorrecta.";
                break;
            case 'auth/invalid-email':
                errorMessage = "El formato del correo electrónico no es válido.";
                break;
            case 'auth/too-many-requests':
                errorMessage = "Demasiados intentos fallidos. Intenta de nuevo más tarde.";
                break;
            default:
                errorMessage = error.message;
                break;
        }
        
        throw new Error(errorMessage);
    }
}

// Función para login con Google
export async function loginWithGoogle() {
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

// Función para registrar un nuevo usuario
export async function registerUser(email, password, username) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Usuario registrado:", userCredential.user);
        
        // Actualizar perfil del usuario
        await updateProfile(userCredential.user, {
            displayName: username,
        });
        
        // Crear documento del usuario en la base de datos
        await createUserProfile(userCredential.user, username);
        
        return userCredential.user;
    } catch (error) {
        console.error("Error al registrar usuario:", error);
        
        // Traducir mensajes de error
        let errorMessage;
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = "Este correo electrónico ya está registrado.";
                break;
            case 'auth/invalid-email':
                errorMessage = "El formato del correo electrónico no es válido.";
                break;
            case 'auth/weak-password':
                errorMessage = "La contraseña es demasiado débil. Debe tener al menos 6 caracteres.";
                break;
            default:
                errorMessage = error.message;
                break;
        }
        
        throw new Error(errorMessage);
    }
}

// Función para cerrar sesión
export async function logoutUser() {
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
export async function createUserProfile(user, username = null) {
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
export async function ensureUserProfileExists(user) {
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

// Obtener perfil del usuario actual
export async function getUserProfile(userId = null) {
    try {
        // Si no se proporciona un ID, usar el usuario actual
        const uid = userId || auth.currentUser?.uid;
        
        if (!uid) {
            throw new Error("No hay un usuario autenticado");
        }
        
        // Buscar el usuario por uid
        const usersRef = collection(db, "usuarios");
        const q = query(usersRef, where("uid", "==", uid));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            throw new Error("Perfil no encontrado");
        }
        
        return querySnapshot.docs[0].data();
    } catch (error) {
        console.error("Error al obtener perfil de usuario:", error);
        throw error;
    }
}

// Funcionalidad para verificar si hay un usuario autenticado
export function isAuthenticated() {
    return auth.currentUser !== null;
}

// Exportamos las instancias para uso en otros archivos
export { auth, db, storage };
