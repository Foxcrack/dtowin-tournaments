// Import Firebase SDK - VERSIÓN SIMPLIFICADA
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
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

// Configurar persistencia de sesión
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Persistencia de sesión configurada correctamente");
  })
  .catch((error) => {
    console.error("Error al configurar persistencia de sesión:", error);
  });

// Configuración personalizada del provider
provider.setCustomParameters({
  prompt: 'select_account'
});

// Función para inicio de sesión con Google
export async function loginWithGoogle() {
  try {
    console.log("Iniciando proceso de login con Google...");
    
    // Intentar realizar el login con popup
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
        fechaRegistro: serverTimestamp(),
        ultimoLogin: serverTimestamp(),
        isHost: true // Todos los usuarios son host por ahora
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
    console.error("Error en loginWithGoogle:", error);
    alert("Error al iniciar sesión: " + (error.message || "Error desconocido"));
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

// Función para obtener perfil de usuario - Simplificada
export async function getUserProfile(uid) {
  try {
    console.log("Obteniendo perfil del usuario:", uid);
    
    if (!uid) {
      console.error("UID no proporcionado");
      return null;
    }
    
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
    
    return null;
  } catch (error) {
    console.error("Error al obtener perfil de usuario:", error);
    return null;
  }
}

// Función simplificada para verificar si un usuario es host
export async function isUserHost() {
  // Por ahora, todos son administradores
  return true;
}

// Exporta las funciones y objetos que necesitas
export {
  auth,
  db,
  storage
};
