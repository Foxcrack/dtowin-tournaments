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
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

async function isAdminOrHost(uid) {
  if (!uid) return false;

  // UID directo de admin
  if (uid === "dvblFee1ZnVKJNWBOR22tSAsNet2") return true;

  const usersRef = collection(db, "usuarios");
  const q = query(usersRef, where("uid", "==", uid));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return false;

  const userData = querySnapshot.docs[0].data();
  return userData.isHost === true;
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
