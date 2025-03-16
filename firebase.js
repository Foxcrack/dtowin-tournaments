// Import Firebase SDK
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

// Lista de administradores por defecto
const adminUIDs = [
  "dvblFee1ZnVKJNWBOR22tSAsNet2"  // UID del administrador principal
];

// Función simplificada de login con Google
export async function loginWithGoogle() {
  try {
    console.log("Iniciando proceso de login con Google...");
    
    // Intentar realizar el login con popup
    console.log("Abriendo popup de autenticación...");
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log("Autenticación exitosa con Google:", user.uid);
    
    console.log("UID del usuario:", user.uid);
    console.log("UID del administrador:", adminUIDs[0]);
    console.log("¿Es administrador?", adminUIDs.includes(user.uid));
    
    // Verificar si el usuario ya existe en la base de datos
    console.log("Verificando si el usuario existe en la base de datos...");
    const userQuery = query(collection(db, "usuarios"), where("uid", "==", user.uid));
    const querySnapshot = await getDocs(userQuery);
    
    // Si no existe, créalo
    if (querySnapshot.empty) {
      console.log("Usuario nuevo, creando perfil en la base de datos...");
      
      // Verificar si el usuario debe ser administrador
      const isAdmin = adminUIDs.includes(user.uid);
      console.log("¿El usuario será creado como administrador?", isAdmin);
      
      await addDoc(collection(db, "usuarios"), {
        uid: user.uid,
        nombre: user.displayName || "Usuario",
        email: user.email,
        photoURL: user.photoURL,
        puntos: 0,
        fechaRegistro: serverTimestamp(),
        ultimoLogin: serverTimestamp(),
        isHost: isAdmin // Asignar permisos de host según la lista
      });
      console.log("Perfil de usuario creado exitosamente");
    } else {
      console.log("Usuario ya existe en la base de datos");
      // Actualizar fecha de último login
      const userDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "usuarios", userDoc.id), {
        ultimoLogin: serverTimestamp()
      });
      
      // Si el usuario es administrador pero no tiene el flag, actualizarlo
      if (adminUIDs.includes(user.uid) && !querySnapshot.docs[0].data().isHost) {
        console.log("Actualizando permisos de administrador...");
        await updateDoc(doc(db, "usuarios", userDoc.id), {
          isHost: true
        });
      }
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

// Función para obtener perfil de usuario
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
    
    // Si no existe el perfil pero existe el usuario, crearlo
    if (auth.currentUser && auth.currentUser.uid === uid) {
      // Verificar si el usuario debe ser administrador
      const isAdmin = adminUIDs.includes(uid);
      
      const userRef = await addDoc(collection(db, "usuarios"), {
        uid: uid,
        nombre: auth.currentUser.displayName || "Usuario",
        email: auth.currentUser.email,
        photoURL: auth.currentUser.photoURL,
        puntos: 0,
        fechaRegistro: serverTimestamp(),
        ultimoLogin: serverTimestamp(),
        isHost: isAdmin // Solo es host si está en la lista
      });
      
      const userDoc = await getDoc(userRef);
      return {
        id: userRef.id,
        ...userDoc.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error al obtener perfil de usuario:", error);
    return null;
  }
}

// Función para verificar si un usuario es host (simplificada para debugging)
export async function isUserHost() {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      console.error("No hay usuario autenticado");
      return false;
    }
    
    console.log("Verificando si el usuario es host:", user.uid);
    console.log("Lista de administradores:", adminUIDs);
    
    // Verificar directamente si está en la lista de administradores
    if (adminUIDs.includes(user.uid)) {
      console.log("Usuario es administrador por estar en la lista");
      return true;
    }
    
    // Verificar en la base de datos
    const userQuery = query(collection(db, "usuarios"), where("uid", "==", user.uid));
    const querySnapshot = await getDocs(userQuery);
    
    if (querySnapshot.empty) {
      console.error("No se encontró el perfil del usuario");
      return false;
    }
    
    const userData = querySnapshot.docs[0].data();
    console.log("Información del usuario:", userData);
    console.log("¿Es host según la base de datos?", userData.isHost === true);
    
    return userData.isHost === true;
  } catch (error) {
    console.error("Error al verificar si el usuario es host:", error);
    return false;
  }
}

// Exporta las funciones y objetos que necesitas
export {
  auth,
  db,
  storage
};
