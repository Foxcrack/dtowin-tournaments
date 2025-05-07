import { auth, loginWithGoogle, getUserProfile, logoutUser } from '../firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";

// =======================
// 🔧 Referencias DOM
// =======================
const googleLoginBtn = document.getElementById('googleLogin');
const logoutBtn = document.getElementById('logoutBtn');
const userDataDiv = document.getElementById('userData');
const adminPanelBtn = document.getElementById('adminPanel');
const botonE621 = document.getElementById("Dirigir_a_e621Index");

// =======================
// 🚀 Inicialización al cargar
// =======================
document.addEventListener("DOMContentLoaded", () => {
  inicializarNavegacion();
  inicializarAuthEvents();
});

// =======================
// 📌 Configurar navegación
// =======================
function inicializarNavegacion() {
  document.getElementById("Dirigir_a_TorneosIndex")?.addEventListener("click", () => {
    window.location.href = "index-torneos.html";
  });

  document.getElementById("Dirigir_a_LeaderboardsIndex")?.addEventListener("click", () => {
    window.location.href = "leaderboard-completo.html";
  });

  document.getElementById("Dirigir_a_CalculadorasIndex")?.addEventListener("click", () => {
    window.location.href = "calculadoras-index.html";
  });

  document.getElementById("Dirigir_a_Pruebas")?.addEventListener("click", () => {
    window.location.href = "clases-chatgpt/login.html";
  });

  botonE621?.addEventListener("click", () => {
    window.location.href = "e621.html";
  });
}

// =======================
// 👤 Eventos de login/logout
// =======================
function inicializarAuthEvents() {
  // Login
  googleLoginBtn?.addEventListener('click', async () => {
    try {
      const user = await loginWithGoogle();
      await mostrarPerfil(user);
    } catch (error) {
      alert("Error al iniciar sesión: " + error.message);
    }
  });

  // Logout
  logoutBtn?.addEventListener('click', async () => {
    try {
      await logoutUser();
      limpiarInterfaz();
    } catch (error) {
      alert("Error al cerrar sesión: " + error.message);
    }
  });

  // Sesión activa
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("✅ Sesión activa detectada");
      await mostrarPerfil(user);
    } else {
      console.log("⛔ No hay sesión activa");
      limpiarInterfaz();
    }
  });
}

// =======================
// 🧼 Limpiar interfaz
// =======================
function limpiarInterfaz() {
  userDataDiv.innerHTML = '';
  googleLoginBtn.style.display = 'inline-block';
  logoutBtn.style.display = 'none';
  adminPanelBtn.style.display = 'none';
  if (botonE621) botonE621.style.display = 'none';
}

// =======================
// 👑 Mostrar perfil y permisos
// =======================
async function mostrarPerfil(user) {
  try {
    const profile = await getUserProfile(user.uid);

    userDataDiv.innerHTML = `
      <p>Nombre: ${profile.nombre}</p>
      <p>Correo: ${profile.email}</p>
      <img src="${profile.photoURL}" width="100" height="100" />
    `;

    googleLoginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';

    if (profile.isHost) {
      adminPanelBtn.style.display = 'inline-block';
      if (botonE621) {
        botonE621.style.display = 'inline-block';
      }
    }
  } catch (err) {
    console.error("❌ Error cargando perfil:", err);
  }
}
