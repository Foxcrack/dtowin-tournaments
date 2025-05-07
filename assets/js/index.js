import { auth, loginWithGoogle, getUserProfile, logoutUser } from '../firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const googleLoginBtn = document.getElementById('googleLogin');
  const logoutBtn = document.getElementById('logoutBtn');
  const userDataDiv = document.getElementById('userData');
  const adminPanelBtn = document.getElementById('adminPanel');
  const botonE621 = document.getElementById("Dirigir_a_e621Index");

  // ---------------- EVENTOS DE BOTONES ----------------
  document.getElementById("Dirigir_a_TorneosIndex").addEventListener("click", () => {
      window.location.href = "index-torneos.html";
  });

  document.getElementById("Dirigir_a_LeaderboardsIndex").addEventListener("click", () => {
      window.location.h = "leaderboard-completo.html";
  });

  document.getElementById("Dirigir_a_CalculadorasIndex").addEventListener("click", () => {
      window.location.href = "calculadoras-index.html";
  });

  document.getElementById("Dirigir_a_Pruebas").addEventListener("click", () => {
      window.location.href = "clases-chatgpt/login.html";
  });

  document.getElementById("Dirigir_a_e621Index").addEventListener("click", () => {
      window.location.href = "e621.html";
  });

  // ---------------- DETECCIÓN DE SESIÓN ----------------
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const profile = await getUserProfile(user.uid);

        if (profile.isHost && botonE621) {
          botonE621.style.display = "inline-block";
        }

      } catch (err) {
        console.error("Error cargando perfil de usuario:", err);
      }
    }
  });
});
