import { auth, getUserProfile, logoutUser } from '../firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const userProfileHeader = document.getElementById("userProfileHeader");
  const e621Btn = document.getElementById("Dirigir_a_e621Index");

  // Botones que deben funcionar siempre
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
  document.getElementById("Dirigir_a_e621Index")?.addEventListener("click", () => {
    window.location.href = "e621.html";
  });

  // AUTENTICACIÓN - verificar si ya hay sesión activa
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("Usuario autenticado:", user.email);
      try {
        const profile = await getUserProfile(user.uid);
        console.log("Perfil obtenido:", profile);

        // Mostrar el botón solo a admin
        if (profile.isHost && e621Btn) {
          e621Btn.style.display = "inline-block";
        }

        // Mostrar perfil en el header
        if (userProfileHeader) {
          userProfileHeader.innerHTML = `
            <span class="text-gray-800 text-sm font-semibold">${profile.nombre}</span>
            <img src="${profile.photoURL}" class="rounded-full w-8 h-8" alt="avatar">
            <button id="logoutHeaderBtn" class="ml-2 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs">Cerrar sesión</button>
          `;

          // Evento para cerrar sesión
          document.getElementById("logoutHeaderBtn").addEventListener("click", async () => {
            await logoutUser();
            location.reload();
          });
        }
      } catch (error) {
        console.error("Error al cargar perfil:", error);
      }
    } else {
      console.log("No hay sesión activa");
    }
  });
});
