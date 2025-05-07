import { auth, loginWithGoogle, logoutUser, getUserProfile } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // Botones de navegación
  const btnTorneos = document.getElementById("Dirigir_a_TorneosIndex");
  const btnLeaderboards = document.getElementById("Dirigir_a_LeaderboardsIndex");
  const btnCalculadoras = document.getElementById("Dirigir_a_CalculadorasIndex");
  const btnJuegos = document.getElementById("Dirigir_a_JuegosIndex");
  const btnPruebas = document.getElementById("Dirigir_a_Pruebas");
  const btnE621 = document.getElementById("Dirigir_a_e621Index");

  // Botones de sesión
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userProfileHeader = document.getElementById("userProfileHeader");

  // Navegación
  btnTorneos?.addEventListener("click", () => location.href = "index-torneos.html");
  btnLeaderboards?.addEventListener("click", () => location.href = "leaderboard-completo.html");
  btnCalculadoras?.addEventListener("click", () => location.href = "calculadoras-index.html");
  btnJuegos?.addEventListener("click", () => location.href = "juegos-index.html");
  btnPruebas?.addEventListener("click", () => location.href = "clases-chatgpt/login.html");
  btnE621?.addEventListener("click", () => location.href = "e621.html");

  // Iniciar sesión
  loginBtn?.addEventListener("click", async () => {
    try {
      const user = await loginWithGoogle();
      if (user) await mostrarPerfil(user);
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
    }
  });

  // Cerrar sesión
  logoutBtn?.addEventListener("click", async () => {
    await logoutUser();
    location.reload();
  });

  // Mantener sesión activa si ya estabas logueado
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await mostrarPerfil(user);
    } else {
      mostrarLogin();
    }
  });

  // Mostrar perfil en el header
  async function mostrarPerfil(user) {
    try {
      const profile = await getUserProfile(user.uid);

      // Mostrar nombre y avatar
      userProfileHeader.innerHTML = `
        <span class="text-gray-800 text-sm font-semibold">${profile.nombre}</span>
        <img src="${profile.photoURL}" class="rounded-full w-8 h-8" alt="avatar">
      `;

      // Mostrar logout, ocultar login
      loginBtn.style.display = "none";
      logoutBtn.style.display = "inline-block";

      // Mostrar e621 solo si es admin
      if (profile.isHost && btnE621) {
        btnE621.style.display = "inline-block";
      }

    } catch (err) {
      console.error("Error al mostrar perfil:", err);
    }
  }

  // Mostrar login si no hay sesión
  function mostrarLogin() {
    userProfileHeader.innerHTML = "";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    if (btnE621) btnE621.style.display = "none";
  }
});
