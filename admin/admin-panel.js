import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBHW2HsP2T6DOwLaOYloqZFerFmU_UA4kE",
  authDomain: "dtowin-tournament.firebaseapp.com",
  projectId: "dtowin-tournament",
  storageBucket: "dtowin-tournament.appspot.com",
  messagingSenderId: "991226820083",
  appId: "1:991226820083:web:6387773cf8c76a0f6ace86"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Verificación si es admin o host
async function isAdminOrHost(uid) {
  if (!uid) return false;
  if (uid === "dvblFee1ZnVKJNWBOR22tSAsNet2") return true; // Admin UID directo

  const docRef = doc(db, "usuarios", uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() && docSnap.data().isHost === true;
}

// Esperar autenticación
onAuthStateChanged(auth, async user => {
  if (user) {
    const esAdmin = await isAdminOrHost(user.uid);
    if (esAdmin) {
      document.getElementById("unauthorized").classList.add("hidden");
      document.getElementById("adminPanel").classList.remove("hidden");
    } else {
      document.getElementById("unauthorized").classList.remove("hidden");
      document.getElementById("adminPanel").classList.add("hidden");
    }
  } else {
    window.location.href = "index.html";
  }
});

// Botón Ver Sitio
document.addEventListener("DOMContentLoaded", () => {
  const verSitioBtn = document.getElementById("verSitioBtn");
  if (verSitioBtn) {
    verSitioBtn.addEventListener("click", () => {
      window.location.href = "../index-torneos.html";
    });
  }
});
