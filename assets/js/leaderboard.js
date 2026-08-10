// Importar Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

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
  if (user) {
    // Mostrar botón de Admin si corresponde
    if (adminUIDs.includes(user.uid)) {
        const adminBtn = document.createElement("a");
        adminBtn.href = "admin/admin-panel.html";
        adminBtn.className = "fixed top-4 right-4 bg-red-600 text-white px-3 py-2 rounded shadow hover:bg-red-700 transition z-50";
        adminBtn.innerHTML = `<i class="fas fa-tools mr-2"></i>Panel Admin`;
        document.body.appendChild(adminBtn);
    }

    // Actualizar UI del Navbar (Premium Header)
    const headerActions = document.querySelector('.header-actions');
    const loginBtn = document.getElementById('loginBtn');
    
    if (loginBtn && headerActions) {
        loginBtn.classList.add('hidden');
        
        let userDropdown = document.getElementById('userDropdown');
        if (!userDropdown) {
            userDropdown = document.createElement('div');
            userDropdown.id = 'userDropdown';
            userDropdown.className = 'user-dropdown';
            
            userDropdown.innerHTML = `
                <div class="user-dropdown-toggle" id="userDropdownToggle">
                    <img src="${user.photoURL || 'assets/img/dtowin.png'}" alt="User" class="user-avatar" id="userAvatar">
                    <span class="user-name" id="userName">${user.displayName || 'Usuario'}</span>
                    <i class="fas fa-chevron-down ml-2 text-xs transition-transform duration-200"></i>
                </div>
                <div class="user-dropdown-menu" id="userDropdownMenu">
                    <a href="perfil.html" class="dropdown-item">
                        <i class="fas fa-user text-blue-400"></i> Mi Perfil
                    </a>
                    <a href="#" id="logoutBtn" class="dropdown-item text-red-400 hover:bg-red-400/10">
                        <i class="fas fa-sign-out-alt"></i> Cerrar Sesión
                    </a>
                </div>
            `;
            // Insertar antes del botón de menú móvil si existe
            const mobileMenuToggle = document.getElementById('mobileMenuToggle');
            if (mobileMenuToggle) {
                headerActions.insertBefore(userDropdown, mobileMenuToggle);
            } else {
                headerActions.appendChild(userDropdown);
            }

            // Eventos del Dropdown
            const toggle = userDropdown.querySelector('#userDropdownToggle');
            const menu = userDropdown.querySelector('#userDropdownMenu');
            const chevron = toggle.querySelector('.fa-chevron-down');
            
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('active');
                chevron.style.transform = menu.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0deg)';
            });

            document.addEventListener('click', (e) => {
                if (!userDropdown.contains(e.target) && menu.classList.contains('active')) {
                    menu.classList.remove('active');
                    chevron.style.transform = 'rotate(0deg)';
                }
            });

            document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
                e.preventDefault();
                await auth.signOut();
                window.location.reload();
            });
        }
    }
  }

  // Cargar usuarios desde Firestore
  const usuariosRef = collection(db, "usuarios");
  const q = query(usuariosRef, orderBy("puntos", "desc"));
  const snapshot = await getDocs(q);

  const users = [];
  
  for (const userDoc of snapshot.docs) {
    const data = userDoc.data();
    
    let nombre = data.nombre;
    if (!nombre || nombre === "undefined" || nombre === "null") nombre = data.displayName;
    if (!nombre || nombre === "undefined" || nombre === "null") nombre = data.email;
    if (!nombre || nombre === "undefined" || nombre === "null") nombre = "Jugador";

    let avatar = data.photoURL;
    if (!avatar || avatar === "undefined" || avatar === "null") avatar = "assets/img/dtowin.png";

    users.push({
      uid: data.uid || userDoc.id,
      nombre: nombre,
      puntos: data.puntos || 0,
      creado: data.createdAt?.seconds || 0,
      bannerId: data.bannerId || null,
      photoURL: avatar,
      badges: data.badges || 0
    });
  }

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
async function renderLeaderboard(users) {
    // Primero cargar los banners de los usuarios que los tengan
    const bannerMap = new Map();
    
    for (const user of users) {
        if (user.bannerId) {
            try {
                const bannerDoc = await firebase.firestore().collection("banners").doc(user.bannerId).get();
                if (bannerDoc.exists) {
                    const bannerData = bannerDoc.data();
                    bannerMap.set(user.uid, bannerData.imageUrl || bannerData.imageData);
                }
            } catch (error) {
                console.warn(`Error cargando banner para ${user.nombre}:`, error);
            }
        }
    }
    
    // Renderizar con los banners cargados
    fullLeaderboardBody.innerHTML = users.map((user, i) => {
        const position = i + 1;
        let medalla = "";
        let claseMedalla = "text-gray-400";
    
        if (position === 1) { medalla = "🥇"; claseMedalla = "text-yellow-400"; }
        else if (position === 2) { medalla = "🥈"; claseMedalla = "text-gray-300"; }
        else if (position === 3) { medalla = "🥉"; claseMedalla = "text-yellow-700"; }
    
        const bannerImage = bannerMap.get(user.uid);
        
        let badgesCount = 0;
        if (user.badges && typeof user.badges === "object" && !Array.isArray(user.badges)) {
            badgesCount = Object.keys(user.badges).length;
        } else if (typeof user.badges === "number") {
            badgesCount = user.badges;
        }

        return `
            <a href="perfil.html?uid=${encodeURIComponent(user.uid)}" class="block hover:bg-gray-800 transition group" style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div class="flex items-center justify-between p-4 relative overflow-hidden">
                    ${bannerImage ? `<div style="position: absolute; left: 0; top: 0; bottom: 0; width: 250px; opacity: 0.25; background: url('${bannerImage}') center/cover no-repeat; clip-path: polygon(0% 0%, 100% 0%, 75% 100%, 0% 100%); transition: opacity 0.3s ease;" class="group-hover:opacity-40"></div>` : ''}
                    
                    <div class="flex items-center gap-4 relative z-10">
                        <span class="font-bold text-xl w-12 ${claseMedalla}">${medalla} #${position}</span>
                        <img src="${user.photoURL || 'assets/img/dtowin.png'}" alt="Avatar" class="w-12 h-12 rounded-full object-cover border border-gray-700 group-hover:border-blue-500 transition-colors">
                        <div>
                            <p class="font-semibold text-white group-hover:text-blue-400 transition-colors text-lg">${user.nombre}</p>
                        </div>
                    </div>
                    
                    <div class="text-right relative z-10">
                        <p class="font-bold text-blue-400 text-xl">${user.puntos || 0} <span class="text-sm font-normal text-gray-400">pts</span></p>
                        <p class="text-xs text-gray-400 mt-1"><i class="fas fa-medal text-yellow-500 mr-1"></i>${badgesCount} badges</p>
                    </div>
                </div>
            </a>
        `;
    }).join("");
}

// Unifica la lógica y los estilos de notificaciones, tablas, etc.