import { auth, getUserProfile } from '../firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // Botones
  const e621Btn = document.getElementById("Dirigir_a_e621Index");
  const userProfileHeader = document.getElementById("userProfileHeader");

  // Navegación
  document.getElementById("Dirigir_a_TorneosIndex").addEventListener("click", () => {
    window.location.href = "index-torneos.html";
  });

  document.getElementById("Dirigir_a_LeaderboardsIndex").addEventListener("click", () => {
    window.location.href = "leaderboard-completo.html";
  });

  document.getElementById("Dirigir_a_CalculadorasIndex").addEventListener("click", () => {
    window.location.href = "calculadoras-index.html";
  });

  document.getElementById("Dirigir_a_JuegosIndex").addEventListener("click", () => {
    window.location.href = "juegos-index.html";
  });

  document.getElementById("Dirigir_a_Pruebas").addEventListener("click", () => {
    window.location.href = "clases-chatgpt/login.html";
  });

  document.getElementById("Dirigir_a_e621Index").addEventListener("click", () => {
    window.location.href = "e621.html";
  });

  // Detectar sesión activa
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const profile = await getUserProfile(user.uid);

        // Mostrar botón e621 si es admin
        if (profile.isHost && e621Btn) {
          e621Btn.style.display = "inline-block";
        }

        // Mostrar mini perfil en el header
        if (userProfileHeader) {
          userProfileHeader.innerHTML = `
            <span class="text-gray-800 text-sm font-semibold">${profile.nombre}</span>
            <img src="${profile.photoURL}" class="rounded-full w-8 h-8" alt="avatar">
            <button id="logoutHeaderBtn" class="ml-2 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs">Cerrar sesión</button>
          `;
        }

        document.addEventListener("click", async (e) => {
            if (e.target.id === "logoutHeaderBtn") {
              await logoutUser();
              location.reload(); // recarga para limpiar perfil y mostrar login si tienes lógica para eso
            }
          });
          

      } catch (err) {
        console.error("Error obteniendo perfil del usuario:", err);
      }
    }
  });
});
