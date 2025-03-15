// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

// Tu configuración actualizada de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBHW2HsP2T6DOwLaOYloqZFerFmU_UA4kE",
  authDomain: "dtowin-tournament.firebaseapp.com",
  projectId: "dtowin-tournament",
  storageBucket: "dtowin-tournament.firebasestorage.app",
  messagingSenderId: "991226820083",
  appId: "1:991226820083:web:6387773cf8c76a0f6ace86",
  measurementId: "G-R4Q5YKZXGY"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// Configuración personalizada del provider para GitHub Pages
provider.setCustomParameters({
  prompt: 'select_account'
});

// Función para inicio de sesión con Google
export async function loginWithGoogle() {
  try {
    console.log("Iniciando proceso de login con Google...");
    
    // Esto es crítico para GitHub Pages
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    // Intenta realizar el login con popup
    console.log("Abriendo popup de autenticación...");
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log("Autenticación exitosa con Google:", user.uid);
    
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
        fechaRegistro: new Date()
      });
      console.log("Perfil de usuario creado exitosamente");
    } else {
      console.log("Usuario ya existe en la base de datos");
    }
    
    return user;
  } catch (error) {
    // Manejo detallado de errores para depuración
    console.error("Error detallado en loginWithGoogle:", error);
    
    if (error.code === 'auth/popup-blocked') {
      console.error("El navegador ha bloqueado la ventana emergente. Por favor, permite ventanas emergentes para este sitio.");
    } else if (error.code === 'auth/popup-closed-by-user') {
      console.error("El usuario cerró la ventana de inicio de sesión antes de completar la autenticación.");
    } else if (error.code === 'auth/cancelled-popup-request') {
      console.error("La operación de inicio de sesión fue cancelada porque se realizó otra solicitud de autenticación.");
    } else if (error.code === 'auth/unauthorized-domain') {
      console.error("El dominio de la aplicación no está autorizado para realizar operaciones de OAuth. Verifica la configuración de Firebase.");
    }
    
    throw error;
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
    const isAvailable = !querySnapshot.docs.some(doc => doc.data().uid === currentUserId);
    console.log(isAvailable ? "Nombre de usuario ya tomado" : "Es el mismo usuario");
    return isAvailable;
  } catch (error) {
    console.error("Error al verificar nombre de usuario:", error);
    return true; // Por seguridad, asumimos que existe
  }
}

// Exporta las funciones y objetos que necesitas
export {
  auth,
  db,
  storage
};
