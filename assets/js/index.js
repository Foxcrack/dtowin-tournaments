import { auth, loginWithGoogle, getUserProfile, logoutUser } from '../firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // Elementos DOM
  const userProfileHeader = document.getElementById("userProfileHeader");
  const botonE621 = document.getElementById("Dirigir_a_e621Index");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // Navegación
  document.getElementById("Dirigir_a_TorneosIndex")?.addEventListener("click", () => {
    window.location.href = "index-torneos.html";
  });

  document.getElementById("Dirigir_a_LeaderboardsIndex")?.addEventListener("click", () => {
    window.location.href = "leaderboard-completo.html";
  });

  document.getElementById("Dirigir_a_CalculadorasIndex")?.addEventListener("click", () => {
    window.location.href = "calculadoras-index.html";
  });

  document.getElementById("Dirigir_a_JuegosIndex")?.addEventListener("click", () => {
    window.location.href = "juegos-index.html";
  });

  document.getElementById("Dirigir_a_Pruebas")?.addEventListener("click", () => {
    window.location.href = "clases-chatgpt/login.html";
  });

  botonE621?.addEventListener("click", () => {
    window.location.href = "e621.html";
  });

  // ---------------- LOGIN ----------------
  loginBtn.addEventListener("click", async () => {
    try {
      const user = await loginWithGoogle();
      mostrarPerfil(user);
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await logoutUser();
    location.reload();
  });

  // ---------------- CARGAR PERFIL SI YA ESTÁ AUTENTICADO ----------------
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      mostrarPerfil(user);
    } else {
      loginBtn.style.display = "inline-block";
      logoutBtn.style.display = "none";
      userProfileHeader.innerHTML = ""; // limpiar info
    }
  });

  // ---------------- FUNCIONALIDAD PERFIL ----------------
  async function mostrarPerfil(user) {
    try {
      const profile = await getUserProfile(user.uid);

      // Mostrar nombre y avatar
      userProfileHeader.innerHTML = `
        <span class="text-gray-800 text-sm font-semibold">${profile.nombre}</span>
        <img src="${profile.photoURL}" class="rounded-full w-8 h-8" alt="avatar">
      `;

      // Mostrar botón e621 si es admin
      if (profile.isHost && botonE621) {
        botonE621.style.display = "inline-block";
      }

      // Ocultar login, mostrar logout
      loginBtn.style.display = "none";
      logoutBtn.style.display = "inline-block";
    } catch (error) {
      console.error("Error al cargar perfil:", error);
    }
  }
});
