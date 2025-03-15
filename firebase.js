// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged,
  getRedirectResult,
  signInWithRedirect
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc,
  updateDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBHW2HsP2T6DOwLaOYloqZFerFmU_UA4kE",
  authDomain: "dtowin-tournament.firebaseapp.com",
  projectId: "dtowin-tournament",
  storageBucket: "dtowin-tournament.appspot.com", // Corregido
  messagingSenderId: "991226820083",
  appId: "1:991226820083:web:6387773cf8c76a0f6ace86",
  measurementId: "G-R4Q5YKZXGY"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// Configuración personalizada del provider
provider.setCustomParameters({
  prompt: 'select_account'
});

// Detectar si estamos en GitHub Pages o localhost
function isGitHubPages() {
  return window.location.hostname.includes('github.io');
}

// Detectar si estamos en un dispositivo móvil
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Función para inicio de sesión con Google
export async function loginWithGoogle() {
  try {
    console.log("Iniciando proceso de login con Google...");
    
    // Esto es crítico para GitHub Pages
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    let user;
    
    // En dispositivos móviles o GitHub Pages es mejor usar redirect en lugar de popup
    if (isMobileDevice() || isGitHubPages()) {
      console.log("Usando método de redirección para login en mobile o GitHub Pages");
      await signInWithRedirect(auth, provider);
      return null; // La página se recargará después del redirect
    } else {
      // Intenta realizar el login con popup
      console.log("Abriendo popup de autenticación...");
      const result = await signInWithPopup(auth, provider);
      user = result.user;
      console.log("Autenticación exitosa con Google:", user.uid);
    }
    
    // Verificar si el usuario ya existe en la base de datos
    console.log("Verificando si el usuario existe en la base de datos...");
    const userQuery = query(collection(db, "usuarios"), where("uid", "==", user.uid));
    const querySnapshot = await getDocs(userQuery);
    
    // Si no existe, créalo
    if (querySnapshot.empty) {
      console.log("Usuario nuevo, creando perfil en la base de datos...");
      await addDoc(collection(db, "usuarios"), {
        uid: user.uid,
        nombre: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        puntos: 0,
        fechaRegistro: serverTimestamp(),
        ultimoLogin: serverTimestamp(),
        isHost: false // Por defecto, no es host
      });
      console.log("Perfil de usuario creado exitosamente");
    } else {
      console.log("Usuario ya existe en la base de datos");
      // Actualizar fecha de último login
      const userDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "usuarios", userDoc.id), {
        ultimoLogin: serverTimestamp()
      });
    }
    
    return user;
  } catch (error) {
    // Manejo detallado de errores para depuración
    console.error("Error detallado en loginWithGoogle:", error);
    
    // Generar mensaje de error más descriptivo según el código
    let errorMessage = "Error durante el inicio de sesión: ";
    
    if (error.code === 'auth/popup-blocked') {
      errorMessage += "El navegador ha bloqueado la ventana emergente. Por favor, permite ventanas emergentes para este sitio.";
      console.error("El navegador ha bloqueado la ventana emergente.");
    } else if (error.code === 'auth/popup-closed-by-user') {
      errorMessage += "Has cerrado la ventana de inicio de sesión antes de completar el proceso.";
      console.error("El usuario cerró la ventana de inicio de sesión.");
    } else if (error.code === 'auth/cancelled-popup-request') {
      errorMessage += "Se canceló la operación actual porque se inició una nueva solicitud de autenticación.";
      console.error("La operación de inicio de sesión fue cancelada.");
    } else if (error.code === 'auth/unauthorized-domain') {
      errorMessage += "Este dominio no está autorizado para operaciones de OAuth. Contacta al administrador.";
      console.error("El dominio de la aplicación no está autorizado para realizar operaciones de OAuth.");
    } else {
      errorMessage += error.message || "Error desconocido.";
    }
    
    // Crear un objeto de error personalizado con mensaje mejorado
    const enhancedError = new Error(errorMessage);
    enhancedError.code = error.code;
    enhancedError.originalError = error;
    
    throw enhancedError;
  }
}

// Función para verificar si hay un usuario autenticado por redirección
export async function checkRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      // El usuario ha sido autenticado por redirección
      const user = result.user;
      console.log("Usuario autenticado por redirección:", user.uid);
      
      // Verificar si el usuario ya existe en la base de datos
      const userQuery = query(collection(db, "usuarios"), where("uid", "==", user.uid));
      const querySnapshot = await getDocs(userQuery);
      
      // Si no existe, créalo
      if (querySnapshot.empty) {
        console.log("Usuario nuevo, creando perfil en la base de datos...");
        await addDoc(collection(db, "usuarios"), {
          uid: user.uid,
          nombre: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          puntos: 0,
          fechaRegistro: serverTimestamp(),
          ultimoLogin: serverTimestamp(),
          isHost: false // Por defecto, no es host
        });
        console.log("Perfil de usuario creado exitosamente");
      } else {
        console.log("Usuario ya existe en la base de datos");
        // Actualizar fecha de último login
        const userDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, "usuarios", userDoc.id), {
          ultimoLogin: serverTimestamp()
        });
      }
      
      return user;
    }
    return null;
  } catch (error) {
    console.error("Error al verificar resultado de redirección:", error);
    return null;
  }
}

// Función para cerrar sesión
export async function logoutUser() {
  try {
    console.log("Cerrando sesión...");
    await signOut(auth);
    console.log("Sesión cerrada exitosamente");
    return { success: true };
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    throw error;
  }
}

// Función para obtener perfil de usuario
export async function getUserProfile(uid) {
  try {
    console.log("Obteniendo perfil del usuario:", uid);
    const userQuery = query(collection(db, "usuarios"), where("uid", "==", uid));
    const querySnapshot = await getDocs(userQuery);
    
    if (!querySnapshot.empty) {
      const userData = {
        id: querySnapshot.docs[0].id,
        ...querySnapshot.docs[0].data()
      };
      console.log("Perfil de usuario obtenido:", userData.nombre);
      return userData;
    }
    
    console.log("No se encontró perfil para el usuario", uid);
    return null;
  } catch (error) {
    console.error("Error al obtener perfil de usuario:", error);
    throw error;
  }
}

// Función para verificar si un nombre de usuario ya existe
export async function checkUsernameExists(username, currentUserId) {
  try {
    console.log("Verificando si existe el nombre de usuario:", username);
    const usersCollection = collection(db, "usuarios");
    const q = query(usersCollection, where("nombre", "==", username));
    const querySnapshot = await getDocs(q);
    
    // Si no hay resultados, el nombre está disponible
    if (querySnapshot.empty) {
      console.log("Nombre de usuario disponible");
      return false;
    }
    
    // Si hay resultados, verificar que no sea el usuario actual
    const existingUser = querySnapshot.docs.some(doc => doc.data().uid !== currentUserId);
    console.log(existingUser ? "Nombre de usuario ya tomado" : "Es el mismo usuario");
    return existingUser;
  } catch (error) {
    console.error("Error al verificar nombre de usuario:", error);
    return true; // Por seguridad, asumimos que existe
  }
}

// Función para escuchar cambios en el estado de autenticación
export function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// Función para verificar si un usuario es host
export async function isUserHost(uid) {
  try {
    const userId = uid || (auth.currentUser ? auth.currentUser.uid : null);
    
    if (!userId) {
      return false;
    }
    
    const userQuery = query(collection(db, "usuarios"), where("uid", "==", userId));
    const querySnapshot = await getDocs(userQuery);
    
    if (querySnapshot.empty) {
      return false;
    }
    
    const userData = querySnapshot.docs[0].data();
    return userData.isHost === true;
  } catch (error) {
    console.error("Error al verificar si el usuario es host:", error);
    return false;
  }
}

// Función para convertir a un usuario en host
export async function makeUserHost(uid) {
  try {
    // Verificar si el usuario actual es host
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Debes iniciar sesión para realizar esta acción");
    }
    
    const currentUserIsHost = await isUserHost(currentUser.uid);
    if (!currentUserIsHost) {
      throw new Error("No tienes permisos para realizar esta acción");
    }
    
    // Buscar al usuario que queremos convertir en host
    const userQuery = query(collection(db, "usuarios"), where("uid", "==", uid));
    const querySnapshot = await getDocs(userQuery);
    
    if (querySnapshot.empty) {
      throw new Error("Usuario no encontrado");
    }
    
    // Actualizar al usuario como host
    const userDoc = querySnapshot.docs[0];
    await updateDoc(doc(db, "usuarios", userDoc.id), {
      isHost: true
    });
    
    return { 
      success: true,
      message: "Usuario convertido en host correctamente"
    };
  } catch (error) {
    console.error("Error al convertir usuario en host:", error);
    throw error;
  }
}

// Exporta las funciones y objetos que necesitas
export {
  auth,
  db,
  storage
};
