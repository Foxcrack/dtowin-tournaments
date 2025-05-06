// Importar Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBHW2HsP2T6DOwLaOYloqZFerFmU_UA4kE",
  authDomain: "dtowin-tournament.firebaseapp.com",
  projectId: "dtowin-tournament",
  storageBucket: "dtowin-tournament.appspot.com",
  messagingSenderId: "991226820083",
  appId: "1:991226820083:web:6387773cf8c76a0f6ace86"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// UIDs de administradores
const adminUIDs = ["dvblFee1ZnVKJNWBOR22tSAsNet2"];

// Mostrar loader
const loader = document.getElementById("loader");
loader.classList.remove("hidden");

// Referencias al DOM
const fullLeaderboardBody = document.getElementById("fullLeaderboardBody");

// Escuchar cambios de autenticación
onAuthStateChanged(auth, async (user) => {
  if (user && adminUIDs.includes(user.uid)) {
    // Mostrar botón Admin
    const adminBtn = document.createElement("a");
    adminBtn.href = "admin/admin-panel.html";
    adminBtn.className = "fixed top-4 right-4 bg-red-600 text-white px-3 py-2 rounded shadow hover:bg-red-700 transition z-50";
    adminBtn.innerHTML = `<i class="fas fa-tools mr-2"></i>Panel Admin`;
    document.body.appendChild(adminBtn);
  }

  // Cargar usuarios desde Firestore
  const usuariosRef = collection(db, "usuarios");
  const snapshot = await getDocs(usuariosRef);

  const users = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    users.push({
      uid: data.uid,
      nombre: data.nombre || "Jugador",
      puntos: data.puntos || 0,
      torneos: Array.isArray(data.torneos) ? data.torneos.length : 0,
      creado: data.createdAt?.seconds || 0
    });
  });

  // Ordenar por puntos y luego por antigüedad
  users.sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    return a.creado - b.creado;
  });

  // Mostrar usuarios
  renderLeaderboard(users);

  // Ocultar loader
  loader.classList.add("hidden");
});

// Renderizar el leaderboard
function renderLeaderboard(users) {
    fullLeaderboardBody.innerHTML = users.map((user, i) => {
      let clasePosicion = "";
      let medalla = "";
  
      if (i === 0) {
        clasePosicion = "leaderboard-gold";
        medalla = "🥇";
      } else if (i === 1) {
        clasePosicion = "leaderboard-silver";
        medalla = "🥈";
      } else if (i === 2) {
        clasePosicion = "leaderboard-bronze";
        medalla = "🥉";
      }
  
      const delay = i * 50; // cada fila se retrasa 50ms más que la anterior
  
      return `
        <div class="grid grid-cols-12 py-3 px-4 leaderboard-row ${clasePosicion} leaderboard-anim" style="animation-delay: ${delay}ms;" onclick="window.location.href='perfil.html?uid=${user.uid}'">
          <div class="col-span-1 text-center font-bold">#${i + 1}</div>
          <div class="col-span-6 font-medium text-gray-800 truncate">${medalla} ${user.nombre}</div>
          <div class="col-span-2 text-center text-gray-600">${user.torneos}</div>
          <div class="col-span-3 text-center text-blue-600 font-semibold">${user.puntos}</div>
        </div>
      `;
    }).join("");
}