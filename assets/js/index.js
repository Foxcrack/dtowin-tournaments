import { auth, loginWithGoogle, getUserProfile, logoutUser } from '../firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";

const googleLoginBtn = document.getElementById('googleLogin');
const logoutBtn = document.getElementById('logoutBtn');
const userDataDiv = document.getElementById('userData');
const adminPanelBtn = document.getElementById('adminPanel');

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("Dirigir_a_TorneosIndex").addEventListener("click", () => {
        window.location.href = "index-torneos.html";
    });

    document.getElementById("Dirigir_a_LeaderboardsIndex").addEventListener("click", () => {
        window.location.href = "leaderboard-completo.html";
    });

    document.getElementById("Dirigir_a_CalculadorasIndex").addEventListener("click", () => {
        window.location.href = "calculadoras-index.html";
    });

    //archivos de pruebas con el firestore

    document.getElementById("Dirigir_a_Pruebas").addEventListener("click", () => {
        window.location.href = "clases-chatgpt/login.html";
    });

    document.getElementById("Dirigir_a_e621Index").addEventListener("click", () => {
        window.location.href = "e621.html";
    });
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const profile = await getUserProfile(user.uid);
  
        // Mostrar botón de e621 solo si es host/admin
        if (profile.isHost) {
          const botonE621 = document.getElementById("Dirigir_a_e621Index");
          if (botonE621) {
            botonE621.style.display = "inline-block"; // o "block" si no es botón inline
          }
        }
      } catch (err) {
        console.error("Error cargando perfil de usuario:", err);
      }
    }
  });