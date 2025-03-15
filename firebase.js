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

// Función para inicio de sesión con Google
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Verificar si el usuario ya existe en la base de datos
    const userQuery = query(collection(db, "usuarios"), where("uid", "==", user.uid));
    const querySnapshot = await getDocs(userQuery);
    
    // Si no existe, créalo
    if (querySnapshot.empty) {
      await addDoc(collection(db, "usuarios"), {
        uid: user.uid,
        nombre: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        puntos: 0,
        fechaRegistro: new Date()
      });
    }
    
    return user;
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    throw error;
  }
}

// Función para cerrar sesión
export async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    throw error;
  }
}

// Función para obtener perfil de usuario
export async function getUserProfile(uid) {
  try {
    const userQuery = query(collection(db, "usuarios"), where("uid", "==", uid));
    const querySnapshot = await getDocs(userQuery);
    
    if (!querySnapshot.empty) {
      return {
        id: querySnapshot.docs[0].id,
        ...querySnapshot.docs[0].data()
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error al obtener perfil de usuario:", error);
    throw error;
  }
}

// Exporta las funciones y objetos que necesitas
export {
  auth,
  db,
  storage
};
