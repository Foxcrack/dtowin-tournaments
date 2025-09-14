// index-torneos.js - Lógica JS para la página de torneos

// Importar funciones de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, doc, getDoc, addDoc, setDoc, where } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBHW2HsP2T6DOwLaOYloqZFerFmU_UA4kE",
    authDomain: "dtowin-tournament.firebaseapp.com",
    projectId: "dtowin-tournament",
    storageBucket: "dtowin-tournament.appspot.com",
    messagingSenderId: "991226820083",
    appId: "1:991226820083:web:6387773cf8c76a0f6ace86",
    measurementId: "G-R4Q5YKZXGY"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Variable para almacenar el usuario currentUser
let currentUser = null;

// Función para mostrar notificaciones
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `p-4 rounded-lg mb-4 text-white ${type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`;
    notification.textContent = message;
    document.getElementById('notifications').appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

// Función para verificar si el usuario es admin - ACTUALIZADA
async function checkIfUserIsAdmin(user) {
    if (!user) return false;

    // Lista de UIDs de administradores (debe coincidir con Firestore rules)
    const adminUIDs = [
        "dvblFee1ZnVKJNWBOR22tSAsNet2"
    ];

    if (adminUIDs.includes(user.uid)) {
        return true;
    }

    // Verificar en la base de datos si tiene isHost: true
    const userRef = doc(db, "usuarios", user.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.isHost === true;
    }

    return false;
}

// Función para actualizar la interfaz según el estado de autenticación - ACTUALIZADA
async function updateAuthUI(user) {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const heroSection = document.querySelector('section.text-center');
    
    if (user) {
        // Usuario autenticado
        currentUser = user;
        
        // Verificar si es admin para mostrar indicador visual
        const isAdmin = await checkIfUserIsAdmin(user);
        
        // Obtener el nombre del usuario
        const userName = user.displayName || user.email.split('@')[0] || 'Usuario';
        
        // Cambiar botón de login por perfil del usuario
        loginBtn.innerHTML = `
            <div class="flex items-center gap-2 cursor-pointer" id="userProfile">
                <img src="${user.photoURL || 'dtowin.png'}" alt="Perfil" class="w-8 h-8 rounded-full object-cover border-2 border-white">
                <span class="font-semibold">${userName}</span>
                ${isAdmin ? '<i class="fas fa-crown text-yellow-300 text-xs"></i>' : ''}
                <i class="fas fa-chevron-down text-sm"></i>
            </div>
        `;
        
        // Cambiar el mensaje de bienvenida
        const heroTitle = heroSection.querySelector('h1');
        const heroText = heroSection.querySelector('p');
        heroTitle.textContent = `¡Bienvenido/a de vuelta, ${userName}!${isAdmin ? ' 👑' : ''}`;
        heroText.textContent = isAdmin ? 
            'Administra la plataforma y gestiona todos los torneos desde tu panel de control.' :
            'Continúa participando en emocionantes torneos y escalando en el ranking global.';
        
        // Cambiar botón de registro por mensaje personalizado
        registerBtn.innerHTML = isAdmin ? 
            `<i class="fas fa-cog mr-2"></i>Panel de Admin` :
            `<i class="fas fa-gamepad mr-2"></i>Ver Mis Torneos`;
        registerBtn.onclick = () => window.open(isAdmin ? 'admin/admin-panel.html' : 'perfil.html', '_blank');
        
        // Crear dropdown menu para el perfil
        createUserDropdown();
        
    } else {
        // Usuario no autenticado
        currentUser = null;
        
        // Restaurar botones originales
        loginBtn.innerHTML = 'Iniciar Sesión';
        loginBtn.onclick = () => document.getElementById('loginModal').classList.remove('hidden');
        
        registerBtn.innerHTML = '¡Regístrate Ahora!';
        registerBtn.onclick = () => document.getElementById('registerModal').classList.remove('hidden');
        
        // Restaurar mensaje original
        const heroTitle = heroSection.querySelector('h1');
        const heroText = heroSection.querySelector('p');
        heroTitle.textContent = 'Bienvenido a la Plataforma de Torneos Dtowin';
        heroText.textContent = 'Participa en emocionantes torneos, gana puntos, consigue badges y escala en el ranking global.';
        
        // Remover dropdown si existe
        removeUserDropdown();
    }
}

// Función para crear el dropdown del usuario - ACTUALIZADA
async function createUserDropdown() {
    // Remover dropdown existente si hay uno
    removeUserDropdown();
    
    const userProfile = document.getElementById('userProfile');
    if (userProfile) {
        userProfile.addEventListener('click', async () => {
            // Verificar si el usuario es admin
            const isAdmin = await checkIfUserIsAdmin(currentUser);
            
            // Crear dropdown
            const dropdown = document.createElement('div');
            dropdown.id = 'userDropdown';
            dropdown.className = 'absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50';
            dropdown.innerHTML = `
                <div class="py-2">
                    <a href="perfil.html" class="block px-4 py-2 text-gray-800 hover:bg-gray-100 transition-colors">
                        <i class="fas fa-user mr-2"></i>Mi Perfil
                    </a>
                    <a href="index-torneos.html" class="block px-4 py-2 text-gray-800 hover:bg-gray-100 transition-colors">
                        <i class="fas fa-trophy mr-2"></i>Mis Torneos
                    </a>
                    ${isAdmin ? `
                        <hr class="my-1">
                        <a href="admin/admin-panel.html" class="block px-4 py-2 text-purple-600 hover:bg-purple-50 transition-colors font-semibold">
                            <i class="fas fa-cog mr-2"></i>Panel de Admin
                        </a>
                    ` : ''}
                    <hr class="my-1">
                    <button id="logoutBtn" class="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition-colors">
                        <i class="fas fa-sign-out-alt mr-2"></i>Cerrar Sesión
                    </button>
                </div>
            `;
            
            // Posicionar el dropdown
            userProfile.style.position = 'relative';
            userProfile.appendChild(dropdown);
            
            // Agregar evento para cerrar sesión
            document.getElementById('logoutBtn').addEventListener('click', async () => {
                try {
                    await signOut(auth);
                    showNotification('¡Sesión cerrada correctamente!', 'success');
                    removeUserDropdown();
                } catch (error) {
                    showNotification('Error al cerrar sesión: ' + error.message, 'error');
                }
            });
            
            // Cerrar dropdown al hacer clic fuera
            setTimeout(() => {
                document.addEventListener('click', function closeDropdown(e) {
                    if (!userProfile.contains(e.target)) {
                        removeUserDropdown();
                        document.removeEventListener('click', closeDropdown);
                    }
                });
            }, 100);
        });
    }
}

// Función para remover el dropdown del usuario
function removeUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.remove();
    }
}

// Función para verificar si el usuario está inscrito en un torneo
async function checkUserInscription(userId, torneoId) {
    if (!userId || !torneoId) return null;
    
    try {
        const inscripcionesRef = collection(db, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("userId", "==", userId),
            where("torneoId", "==", torneoId),
            where("estado", "==", "inscrito")
        );
        const snapshot = await getDocs(q);
        
        return snapshot.empty ? null : snapshot.docs[0];
    } catch (error) {
        console.error("Error verificando inscripción:", error);
        return null;
    }
}

// Función para contar inscripciones en un torneo
async function countInscriptions(torneoId) {
    try {
        const inscripcionesRef = collection(db, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("torneoId", "==", torneoId),
            where("estado", "==", "inscrito")
        );
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error("Error contando inscripciones:", error);
        return 0;
    }
}

// Función para obtener la URL del banner - REVISADA Y MEJORADA
async function getBannerUrl(bannerId) {
    if (!bannerId) return null;

    // Si el campo ya es una URL, úsala directamente
    if (typeof bannerId === "string" && (bannerId.startsWith("http://") || bannerId.startsWith("https://") || bannerId.startsWith("data:image"))) {
        return bannerId;
    }

    try {
        // Buscar en la colección banners
        const bannerRef = doc(db, "banners", bannerId);
        const bannerDoc = await getDoc(bannerRef);
        if (bannerDoc.exists()) {
            const bannerData = bannerDoc.data();
            // Prioridad: imageUrl > imageData > url > imagen > src > banner
            return bannerData.imageUrl || bannerData.imageData || bannerData.url || bannerData.imagen || bannerData.src || bannerData.banner || null;
        }
    } catch (error) {
        console.error("Error obteniendo banner:", error);
    }
    return null;
}

// Cargar torneos - AJUSTADO PARA ASIGNAR bannerUrl EN EL OBJETO TORNEO
async function loadTournaments() {
    const containers = {
        "En Progreso": document.getElementById("torneos-en-proceso"),
        "Abierto": document.getElementById("torneos-abiertos"),
        "Check In": document.getElementById("torneos-checkin"),
        "Próximamente": document.getElementById("torneos-proximos")
    };

    Object.values(containers).forEach(c => { if (c) c.innerHTML = ""; });

    try {
        const torneosRef = collection(db, "torneos");
        const q = query(torneosRef, orderBy("fecha", "desc"));
        const snapshot = await getDocs(q);

        const torneosPorEstado = {
            "En Progreso": [],
            "Abierto": [],
            "Check In": [],
            "Próximamente": []
        };

        // 1. Recolectar todos los torneos y sus bannerId
        const torneos = [];
        snapshot.forEach(docSnap => {
            const torneo = { id: docSnap.id, ...docSnap.data() };
            if (torneosPorEstado[torneo.estado]) {
                torneosPorEstado[torneo.estado].push(torneo);
            }
            torneos.push(torneo);
        });

        // 2. Pre-cargar todos los banners en paralelo y asignar bannerUrl al objeto torneo
        const bannerPromises = torneos.map(async torneo => {
            if (torneo.bannerId) {
                torneo.bannerUrl = await getBannerUrl(torneo.bannerId);
            } else if (torneo.banner) {
                torneo.bannerUrl = torneo.banner;
            } else {
                torneo.bannerUrl = null;
            }
        });
        await Promise.all(bannerPromises);

        // 3. Renderizar cada sección
        for (const [estado, torneos] of Object.entries(torneosPorEstado)) {
            const contenedor = containers[estado];
            if (!contenedor) continue;

            if (torneos.length === 0) {
                contenedor.innerHTML = `<div class="text-center text-gray-400 p-4">No hay torneos</div>`;
                continue;
            }

            const torneosHTML = await Promise.all(torneos.map(async (torneo) => {
                let isInscrito = false;
                let totalInscritos = 0;

                totalInscritos = await countInscriptions(torneo.id);

                if (currentUser && (estado === "Abierto" || estado === "Check In")) {
                    const inscripcion = await checkUserInscription(currentUser.uid, torneo.id);
                    isInscrito = inscripcion !== null;
                    if (estado === "Check In" && isInscrito) {
                        const asistenciaConfirmada = await checkUserAttendance(currentUser.uid, torneo.id);
                        torneo.asistenciaConfirmada = asistenciaConfirmada;
                    }
                }

                // Formatear fecha
                const fechaTorneo = torneo.fecha ? new Date(torneo.fecha.seconds * 1000) : null;
                const fechaFormateada = fechaTorneo ?
                    fechaTorneo.toLocaleDateString('es-ES', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    }) : 'Fecha TBD';

                // Banner HTML
                let bannerHtml;
                if (torneo.bannerUrl) {
                    bannerHtml = `<img src="${torneo.bannerUrl}" alt="Banner ${torneo.nombre}" class="w-full h-full object-cover" loading="lazy"
                        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`;
                } else {
                    bannerHtml = '';
                }

                return `
                    <div class="bg-white rounded-lg shadow-lg overflow-hidden tournament-card hover:shadow-xl transition-shadow duration-300">
                        <div class="relative h-32 bg-gradient-to-r from-blue-500 to-purple-600 overflow-hidden">
                            ${bannerHtml}
                            <div class="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center" style="${torneo.bannerUrl ? 'display:none;' : ''}">
                                <i class="fas fa-trophy text-white text-3xl opacity-50"></i>
                                <div class="absolute bottom-2 left-2 text-white text-xs opacity-75">Sin banner configurado</div>
                            </div>
                            <div class="absolute top-2 right-2">
                                <span class="px-2 py-1 rounded-full text-xs font-semibold bg-white/90 text-gray-800">
                                    ${torneo.estado}
                                </span>
                            </div>
                            <div class="absolute bottom-2 right-2">
                                <div class="bg-black/50 text-white px-2 py-1 rounded text-xs">
                                    <i class="fas fa-calendar mr-1"></i>${fechaFormateada}
                                </div>
                            </div>
                        </div>
                        <div class="p-4">
                            <h4 class="font-bold text-gray-800 mb-2 text-lg">${torneo.nombre || "Torneo sin nombre"}</h4>
                            <p class="text-gray-600 text-sm mb-3 line-clamp-2">${torneo.descripcion || "Sin descripción disponible"}</p>
                            <div class="flex items-center justify-between mb-3 p-2 bg-gray-50 rounded-lg">
                                <div class="flex items-center gap-2">
                                    <i class="fas fa-users text-blue-500"></i>
                                    <span class="text-sm font-medium text-gray-700">
                                        ${totalInscritos} participante${totalInscritos !== 1 ? 's' : ''}
                                    </span>
                                    ${torneo.capacidad ? `<span class="text-xs text-gray-500">/ ${torneo.capacidad}</span>` : ''}
                                </div>
                                <button class="ver-inscritos-btn text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200 transition"
                                    data-torneo-id="${torneo.id}" data-torneo-nombre="${torneo.nombre}">
                                    <i class="fas fa-eye mr-1"></i>Ver Lista
                                </button>
                            </div>
                            <!-- Botones de acción -->
                            <div class="flex flex-col gap-2 mt-2">
                                ${
                                    // Lógica para estado "Abierto" (la misma que ya tienes)
                                    estado === "Abierto"
                                    ? (
                                        currentUser
                                        ? (
                                            isInscrito
                                            ? `<button class="desinscribirse-btn bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700 transition"
                                            data-torneo-id="${torneo.id}" data-torneo-nombre="${torneo.nombre}">
                                            <i class="fas fa-user-minus mr-2"></i>Desinscribirse
                                            </button>`
                                            : (torneo.capacidad && totalInscritos >= torneo.capacidad
                                                ? `<button class="bg-gray-400 text-white py-2 px-4 rounded-lg font-semibold cursor-not-allowed">
                                                    <i class="fas fa-users mr-2"></i>Torneo Lleno
                                                </button>`
                                                : `<button class="inscribirse-btn bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition"
                                                    data-torneo-id="${torneo.id}" data-torneo-nombre="${torneo.nombre}">
                                                    <i class="fas fa-user-plus mr-2"></i>Inscribirse
                                                </button>`
                                            )
                                        )
                                        : `<button class="login-required-btn bg-gray-400 text-white py-2 px-4 rounded-lg font-semibold cursor-not-allowed">
                                            Inicia sesión para inscribirte
                                        </button>`
                                    )
                                    // Lógica para estado "Check In" (nuevo)
                                    : estado === "Check In"
                                    ? (currentUser && isInscrito && !torneo.asistenciaConfirmada
                                        ? `<button class="check-in-btn bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition"
                                            data-torneo-id="${torneo.id}">
                                            <i class="fas fa-check-circle mr-2"></i>Hacer Check-in
                                            </button>`
                                        : currentUser && isInscrito && torneo.asistenciaConfirmada
                                            ? `<button class="bg-gray-400 text-white py-2 px-4 rounded-lg font-semibold cursor-not-allowed">
                                                <i class="fas fa-check-double mr-2"></i>Check-in Confirmado
                                            </button>`
                                            : `<button class="login-required-btn bg-gray-400 text-white py-2 px-4 rounded-lg font-semibold cursor-not-allowed">
                                                Check-in disponible solo para inscritos
                                            </button>`
                                        )
                                    : ""
                                }
                            </div>
                        </div>
                    </div>
                `;
            }));

            contenedor.innerHTML = torneosHTML.join("");
        }

        setupTournamentButtons();

    } catch (error) {
        console.error("Error cargando torneos:", error);
        Object.values(containers).forEach(c => {
            if (c) c.innerHTML = `<div class="text-center text-red-500 p-4">Error al cargar torneos</div>`;
        });
    }
}

// Función para verificar si el usuario confirmó asistencia
async function checkUserAttendance(userId, torneoId) {
    if (!userId || !torneoId) return false;
    
    try {
        const inscripcionesRef = collection(db, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("userId", "==", userId),
            where("torneoId", "==", torneoId),
            where("estado", "==", "inscrito")
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const inscripcion = snapshot.docs[0].data();
            return inscripcion.asistenciaConfirmada || false;
        }
        
        return false;
    } catch (error) {
        console.error("Error verificando asistencia:", error);
        return false;
    }
}

// Función para confirmar asistencia
async function confirmAttendance(torneoId) {
    if (!currentUser) {
        showNotification('Debes iniciar sesión para confirmar asistencia', 'error');
        return;
    }

    try {
        // Buscar la inscripción del usuario
        const inscripcionesRef = collection(db, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("userId", "==", currentUser.uid),
            where("torneoId", "==", torneoId),
            where("estado", "==", "inscrito")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            showNotification('No estás inscrito en este torneo', 'error');
            return;
        }

        const inscripcionDoc = snapshot.docs[0];
        const inscripcionData = inscripcionDoc.data();

        // Verificar si ya confirmó asistencia
        if (inscripcionData.asistenciaConfirmada) {
            showNotification('Ya has confirmado tu asistencia', 'info');
            return;
        }

        // Actualizar la inscripción para confirmar asistencia
        await setDoc(doc(db, "inscripciones", inscripcionDoc.id), {
            ...inscripcionData,
            asistenciaConfirmada: true,
            fechaConfirmacion: new Date(),
            updatedAt: new Date()
        });

        showNotification('¡Asistencia confirmada exitosamente!', 'success');
        
        // Recargar torneos para actualizar la interfaz
        loadTournaments();

    } catch (error) {
        console.error('Error al confirmar asistencia:', error);
        showNotification('Error al confirmar asistencia: ' + error.message, 'error');
    }
}

// REEMPLAZAR la función showInscritosModal para evitar duplicados de forma robusta:
async function showInscritosModal(torneoId, torneoNombre) {
    try {
        // Cerrar cualquier modal de inscritos abierto antes de crear uno nuevo (robusto)
        document.querySelectorAll('#inscritosModal').forEach(m => m.remove());

        // Obtener inscritos
        const inscritos = await getInscritosByTorneo(torneoId);
        
        // Separar confirmados y no confirmados
        const confirmados = inscritos.filter(inscrito => inscrito.asistenciaConfirmada);
        const noConfirmados = inscritos.filter(inscrito => !inscrito.asistenciaConfirmada);

        // Crear modal
        const modal = document.createElement('div');
        modal.id = 'inscritosModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';

        modal.innerHTML = `
            <div class="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl">
                <div class="p-6 border-b border-gray-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">Participantes Inscritos</h3>
                            <p class="text-gray-600">${torneoNombre}</p>
                        </div>
                        <button id="closeInscritosModal" class="text-gray-400 hover:text-gray-600 transition-colors">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <!-- Estadísticas -->
                    <div class="mt-4 grid grid-cols-3 gap-4">
                        <div class="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-users text-blue-500"></i>
                                <div>
                                    <p class="text-xs text-blue-600">Total Inscritos</p>
                                    <p class="font-bold text-blue-800">${inscritos.length}</p>
                                </div>
                            </div>
                        </div>
                        <div class="p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-check-circle text-green-500"></i>
                                <div>
                                    <p class="text-xs text-green-600">Confirmados</p>
                                    <p class="font-bold text-green-800">${confirmados.length}</p>
                                </div>
                            </div>
                        </div>
                        <div class="p-3 bg-red-50 rounded-lg border-l-4 border-red-400">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-clock text-red-500"></i>
                                <div>
                                    <p class="text-xs text-red-600">Pendientes</p>
                                    <p class="font-bold text-red-800">${noConfirmados.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="p-6 overflow-y-auto max-h-96">
                    ${inscritos.length === 0 ? `
                        <div class="text-center text-gray-500 py-8">
                            <i class="fas fa-users text-4xl text-gray-300 mb-4"></i>
                            <p class="text-lg font-medium">No hay participantes inscritos</p>
                            <p class="text-sm">¡Sé el primero en inscribirte!</p>
                        </div>
                    ` : `
                        <!-- Pestañas -->
                        <div class="flex mb-4 border-b">
                            <button class="tab-btn flex-1 py-2 px-4 text-center font-medium border-b-2 border-blue-500 text-blue-600" data-tab="todos">
                                Todos (${inscritos.length})
                            </button>
                            <button class="tab-btn flex-1 py-2 px-4 text-center font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="confirmados">
                                Confirmados (${confirmados.length})
                            </button>
                            <button class="tab-btn flex-1 py-2 px-4 text-center font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="pendientes">
                                Pendientes (${noConfirmados.length})
                            </button>
                        </div>
                        
                        <!-- Contenido de pestañas -->
                        <div id="tab-todos" class="tab-content">
                            <div class="space-y-3">
                                ${inscritos.map((inscrito, index) => `
                                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border-l-4 ${inscrito.asistenciaConfirmada ? 'border-green-400' : 'border-red-400'}">
                                        <div class="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold text-sm">
                                            ${index + 1}
                                        </div>
                                        <img src="${inscrito.userPhoto || 'dtowin.png'}" alt="Avatar" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2">
                                                <p class="font-semibold text-gray-800">${inscrito.userName}</p>
                                                ${inscrito.userId === currentUser?.uid ? '<span class="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">Tú</span>' : ''}
                                                <span class="text-xs px-2 py-1 rounded ${inscrito.asistenciaConfirmada ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
                                                    <i class="fas fa-${inscrito.asistenciaConfirmada ? 'check-circle' : 'clock'} mr-1"></i>
                                                    ${inscrito.asistenciaConfirmada ? 'Confirmado' : 'Pendiente'}
                                                </span>
                                            </div>
                                            <p class="text-sm text-gray-600">
                                                <i class="fas fa-gamepad mr-1"></i>${inscrito.gameUsername || 'No especificado'}
                                            </p>
                                            <p class="text-sm text-purple-600">
                                                <i class="fab fa-discord mr-1"></i>${inscrito.discordUsername || 'No especificado'}
                                            </p>
                                        </div>
                                        <div class="text-right text-xs text-gray-500">
                                            <div>Inscrito: ${new Date(inscrito.fechaInscripcion.seconds * 1000).toLocaleDateString()}</div>
                                            ${inscrito.asistenciaConfirmada && inscrito.fechaConfirmacion ? `<div class="text-green-600">Confirmado: ${new Date(inscrito.fechaConfirmacion.seconds * 1000).toLocaleDateString()}</div>` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div id="tab-confirmados" class="tab-content hidden">
                            <div class="space-y-3">
                                ${confirmados.length === 0 ? `
                                    <div class="text-center text-gray-500 py-4">
                                        <i class="fas fa-check-circle text-3xl text-gray-300 mb-2"></i>
                                        <p>Aún no hay asistencias confirmadas</p>
                                    </div>
                                ` : confirmados.map((inscrito, index) => `
                                    <div class="flex items-center gap-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                                        <div class="flex items-center justify-center w-8 h-8 bg-green-100 text-green-600 rounded-full font-semibold text-sm">
                                            ${index + 1}
                                        </div>
                                        <img src="${inscrito.userPhoto || 'dtowin.png'}" alt="Avatar" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2">
                                                <p class="font-semibold text-gray-800">${inscrito.userName}</p>
                                                ${inscrito.userId === currentUser?.uid ? '<span class="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">Tú</span>' : ''}
                                            </div>
                                            <p class="text-sm text-gray-600">
                                                <i class="fas fa-gamepad mr-1"></i>${inscrito.gameUsername || 'No especificado'}
                                            </p>
                                            <p class="text-sm text-purple-600">
                                                <i class="fab fa-discord mr-1"></i>${inscrito.discordUsername || 'No especificado'}
                                            </p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div id="tab-pendientes" class="tab-content hidden">
                            <div class="space-y-3">
                                ${noConfirmados.length === 0 ? `
                                    <div class="text-center text-gray-500 py-4">
                                        <i class="fas fa-check-circle text-3xl text-green-300 mb-2"></i>
                                        <p>¡Todos han confirmado su asistencia!</p>
                                    </div>
                                ` : noConfirmados.map((inscrito, index) => `
                                    <div class="flex items-center gap-3 p-3 bg-red-50 rounded-lg border-l-4 border-red-400">
                                        <div class="flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 rounded-full font-semibold text-sm">
                                            ${index + 1}
                                        </div>
                                        <img src="${inscrito.userPhoto || 'dtowin.png'}" alt="Avatar" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2">
                                                <p class="font-semibold text-gray-800">${inscrito.userName}</p>
                                                ${inscrito.userId === currentUser?.uid ? '<span class="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">Tú</span>' : ''}
                                            </div>
                                            <p class="text-sm text-gray-600">
                                                <i class="fas fa-gamepad mr-1"></i>${inscrito.gameUsername || 'No especificado'}
                                            </p>
                                            <p class="text-sm text-purple-600">
                                                <i class="fab fa-discord mr-1"></i>${inscrito.discordUsername || 'No especificado'}
                                            </p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `}
                </div>
                
                <div class="p-4 border-t border-gray-200 bg-gray-50">
                    <button id="closeInscritosModalBtn" class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition">
                        Cerrar
                    </button>
                </div>
            </div>
        `;
        
        // Agregar modal al DOM
        document.body.appendChild(modal);

        // Event listeners para las pestañas
        const tabBtns = modal.querySelectorAll('.tab-btn');
        const tabContents = modal.querySelectorAll('.tab-content');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                tabBtns.forEach(b => {
                    b.classList.remove('border-blue-500', 'text-blue-600');
                    b.classList.add('border-transparent', 'text-gray-500');
                });
                btn.classList.add('border-blue-500', 'text-blue-600');
                btn.classList.remove('border-transparent', 'text-gray-500');
                tabContents.forEach(content => content.classList.add('hidden'));
                modal.querySelector(`#tab-${targetTab}`).classList.remove('hidden');
            });
        });

        // Event listeners para cerrar
        modal.querySelector('#closeInscritosModal').addEventListener('click', () => {
            modal.remove();
        });
        modal.querySelector('#closeInscritosModalBtn').addEventListener('click', () => {
            modal.remove();
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

    } catch (error) {
        console.error('Error mostrando inscritos:', error);
        showNotification('Error al cargar la lista de inscritos', 'error');
    }
}

// ACTUALIZAR la función getInscritosByTorneo para incluir el ID del documento:
async function getInscritosByTorneo(torneoId) {
    try {
        const inscripcionesRef = collection(db, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("torneoId", "==", torneoId),
            where("estado", "==", "inscrito")
        );
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error obteniendo inscritos:", error);
        return [];
    }
}

// Elimina listeners duplicados y usa SOLO el event listener delegado global para desinscribirse
function setupTournamentButtons() {
    // Solo deja los listeners que no están cubiertos por el event delegation global
    // Por ejemplo: check-in, login-required, start-tournament, checkin-state, view-bracket

    // Botones de check-in/confirmar asistencia - NUEVO
    document.querySelectorAll('.check-in-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const torneoId = e.target.dataset.torneoId;
            confirmAttendance(torneoId);
        });
    });

    // Botones que requieren login
    document.querySelectorAll('.login-required-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showNotification('Debes iniciar sesión para participar', 'error');
            document.getElementById('loginModal').classList.remove('hidden');
        });
    });

    // Botones para ver inscritos
    document.querySelectorAll('.ver-inscritos-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const torneoId = e.target.dataset.torneoId;
            const torneoNombre = e.target.dataset.torneoNombre;
            showInscritosModal(torneoId, torneoNombre);
        });
    });

    // Botones para iniciar torneo (solo admins)
    document.querySelectorAll('.start-tournament-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const torneoId = e.target.dataset.torneoId;
            const torneoNombre = e.target.dataset.torneoNombre;
            
            const confirmed = confirm(`¿Estás seguro de iniciar el torneo "${torneoNombre}"?\n\nEsto eliminará automáticamente a todos los participantes que no confirmaron asistencia y generará el bracket con los participantes confirmados.`);
            
            if (confirmed) {
                // Cambiar botón a estado de carga
                const originalText = e.target.innerHTML;
                e.target.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Iniciando...';
                e.target.disabled = true;
                
                try {
                    await startTournamentAndGenerateBracket(torneoId);
                } catch (error) {
                    console.error('Error:', error);
                } finally {
                    // Restaurar botón
                    e.target.innerHTML = originalText;
                    e.target.disabled = false;
                }
            }
        });
    });

    // Botones para cambiar a Check In (solo admins)
    document.querySelectorAll('.checkin-state-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const torneoId = e.target.dataset.torneoId;
            const torneoNombre = e.target.dataset.torneoNombre;
            
            const confirmed = confirm(`¿Cambiar el torneo "${torneoNombre}" a estado Check In?\n\nSi no hay participantes inscritos, se generarán 8 bots automáticamente para poder probar el torneo.`);
            
            if (confirmed) {
                // Cambiar botón a estado de carga
                const originalText = e.target.innerHTML;
                e.target.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Cambiando...';
                e.target.disabled = true;
                
                try {
                    await changeToCheckInState(torneoId);
                } catch (error) {
                    console.error('Error:', error);
                } finally {
                    // Restaurar botón
                    e.target.innerHTML = originalText;
                    e.target.disabled = false;
                }
            }
        });
    });

    // Botones para ver bracket
    document.querySelectorAll('.view-bracket-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const torneoId = e.target.dataset.torneoId;
            window.open(`bracket.html?id=${torneoId}`, '_blank');
        });
    });
}

// Función para manejar la desinscripción
async function handleUnsubscribe(torneoId, torneoNombre) {
    const confirmed = confirm(`¿Estás seguro de que deseas desinscribirte del torneo "${torneoNombre}"?`);
    
    if (!confirmed) return;

    try {
        // Buscar la inscripción del usuario
        const inscripcionesRef = collection(db, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("userId", "==", currentUser.uid),
            where("torneoId", "==", torneoId),
            where("estado", "==", "inscrito")
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const inscripcionDoc = snapshot.docs[0];
            
            // Actualizar el estado a "desinscrito" en lugar de eliminar
            await setDoc(doc(db, "inscripciones", inscripcionDoc.id), {
                ...inscripcionDoc.data(),
                estado: "desinscrito",
                fechaDesinscripcion: new Date()
            });

            showNotification('Te has desinscrito del torneo correctamente', 'success');
            
            // Recargar torneos para actualizar la interfaz
            loadTournaments();
        } else {
            showNotification('No se encontró tu inscripción en este torneo', 'error');
        }

    } catch (error) {
        console.error('Error al desinscribirse:', error);
        showNotification('Error al desinscribirse: ' + error.message, 'error');
    }
}

// Función para manejar la inscripción - ACTUALIZADA
async function handleInscription(e) {
    e.preventDefault();

    const form = e.target;
    const torneoId = form.dataset.torneoId;
    const gameUsername = document.getElementById('gameUsername').value.trim();
    const discordUsername = document.getElementById('discordUsername').value.trim();

    // Validaciones
    if (!gameUsername) {
        showNotification('El nombre de juego es obligatorio', 'error');
        return;
    }

    if (!discordUsername) {
        showNotification('El Discord es obligatorio', 'error');
        return;
    }

    // Solo validar longitud, no formato de Discord
    if (discordUsername.length < 2 || discordUsername.length > 50) {
        showNotification('El nombre de Discord debe tener entre 2 y 50 caracteres', 'error');
        return;
    }

    try {
        // Mostrar loading
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Inscribiendo...';
        submitBtn.disabled = true;
        
        // Verificar si ya está inscrito
        const existingInscription = await checkUserInscription(currentUser.uid, torneoId);
        if (existingInscription) {
            showNotification('Ya estás inscrito en este torneo', 'error');
            closeInscriptionModal();
            return;
        }
        
        // Crear documento de inscripción en Firestore
        const inscripcionData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: currentUser.displayName || currentUser.email.split('@')[0],
            userPhoto: currentUser.photoURL || '',
            gameUsername: gameUsername,
            discordUsername: discordUsername,
            torneoId: torneoId,
            fechaInscripcion: new Date(),
            estado: 'inscrito',
            puntos: 0 // Puntos iniciales
        };
        
        // Guardar en Firestore
        await addDoc(collection(db, "inscripciones"), inscripcionData);
        
        showNotification('¡Inscripción exitosa! Te has registrado en el torneo.', 'success');
        closeInscriptionModal();
        
        // Recargar torneos para mostrar el cambio de estado
        loadTournaments();
        
    } catch (error) {
        console.error('Error en inscripción:', error);
        showNotification('Error al inscribirse: ' + error.message, 'error');
    } finally {
        // Restaurar botón
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-trophy mr-2"></i>Inscribirse';
        submitBtn.disabled = false;
    }
}

// Función para abrir el modal de inscripción
function openInscriptionModal(torneoId, torneoNombre) {
    const modal = document.getElementById('inscriptionModal');
    if (!modal) {
        console.error('Modal de inscripción no encontrado');
        return;
    }
    
    document.getElementById('modalTournamentName').textContent = torneoNombre;
    document.getElementById('inscriptionForm').dataset.torneoId = torneoId;
    
    // Limpiar formulario
    document.getElementById('gameUsername').value = '';
    document.getElementById('discordUsername').value = '';
    
    modal.classList.remove('hidden');
}

// Función para cerrar el modal de inscripción
function closeInscriptionModal() {
    const modal = document.getElementById('inscriptionModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Función para cargar el leaderboard - FALTABA ESTA FUNCIÓN
async function loadLeaderboard() {
    const leaderboardContainer = document.getElementById('leaderboard');
    if (!leaderboardContainer) return;
    
    try {
        leaderboardContainer.innerHTML = '<div class="text-center text-gray-500 p-4">Cargando leaderboard...</div>';
        
        // Obtener usuarios ordenados por puntos
        const usuariosRef = collection(db, "usuarios");
        const q = query(usuariosRef, orderBy("puntos", "desc"), limit(10));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            leaderboardContainer.innerHTML = '<div class="text-center text-gray-500 p-4">No hay datos de leaderboard disponibles</div>';
            return;
        }
        
        const leaderboardHTML = snapshot.docs.map((doc, index) => {
            const usuario = doc.data();
            const uid = usuario.uid || doc.id;
            const position = index + 1;
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
            const nombre = usuario.nombre || usuario.displayName || usuario.email;
            let torneos = 0;
            if (Array.isArray(usuario.torneos)) {
                torneos = usuario.torneos.length;
            } else if (typeof usuario.torneos === "number") {
                torneos = usuario.torneos;
            }
            let badges = 0;
            if (usuario.badges && typeof usuario.badges === "object" && !Array.isArray(usuario.badges)) {
                badges = Object.keys(usuario.badges).length;
            } else if (typeof usuario.badges === "number") {
                badges = usuario.badges;
            }
            // Hacer toda la tarjeta clickeable y llevar a perfil.html?uid=...
            return `
                <a href="perfil.html?uid=${encodeURIComponent(uid)}" class="block hover:bg-blue-50 rounded-lg transition group">
                    <div class="flex items-center justify-between p-3 bg-white rounded-lg shadow mb-2 group-hover:shadow-lg">
                        <div class="flex items-center gap-3">
                            <span class="font-bold text-lg ${position <= 3 ? 'text-yellow-500' : 'text-gray-500'}">${medal} #${position}</span>
                            <img src="${usuario.photoURL || 'dtowin.png'}" alt="Avatar" class="w-10 h-10 rounded-full object-cover">
                            <div>
                                <p class="font-semibold text-gray-800 group-hover:text-blue-700">${nombre}</p>
                                <p class="text-sm text-gray-500">${torneos} torneos</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-blue-600">${usuario.puntos || 0} pts</p>
                            <p class="text-xs text-gray-500">${badges} badges</p>
                        </div>
                    </div>
                </a>
            `;
        }).join('');
        
        leaderboardContainer.innerHTML = leaderboardHTML;
        
    } catch (error) {
        console.error('Error cargando leaderboard:', error);
        leaderboardContainer.innerHTML = '<div class="text-center text-red-500 p-4">Error al cargar el leaderboard</div>';
    }
}

// Función para renderizar torneos en cada sección
function renderTorneoCard(torneo) {
    // Usa el banner si existe, si no muestra un fondo por defecto
    const bannerUrl = torneo.bannerUrl || torneo.banner || null;
    const bannerHtml = bannerUrl
        ? `<img src="${bannerUrl}" alt="Banner del torneo" class="w-full h-32 object-cover rounded-t-lg" loading="lazy">`
        : `<div class="w-full h-32 bg-gradient-to-r from-blue-600 to-purple-500 flex items-center justify-center rounded-t-lg">
                <span class="text-white font-semibold">Sin banner configurado</span>
           </div>`;

    return `
        <div class="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
            ${bannerHtml}
            <div class="p-4 flex-1 flex flex-col">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-lg">${torneo.nombre || 'Torneo sin nombre'}</span>
                    <span class="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">${torneo.estado || ''}</span>
                </div>
                <p class="text-gray-600 text-sm mb-2">${torneo.descripcion || ''}</p>
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs text-gray-500"><i class="fas fa-calendar-alt mr-1"></i>${torneo.fecha ? new Date(torneo.fecha.seconds * 1000).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                </div>
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs bg-gray-100 px-2 py-1 rounded"><i class="fas fa-users mr-1"></i>${torneo.participants?.length || 0} participantes</span>
                    ${torneo.capacidad ? `<span class="text-xs bg-gray-100 px-2 py-1 rounded">/ ${torneo.capacidad}</span>` : ''}
                    <button class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition" onclick="window.mostrarListaParticipantes && window.mostrarListaParticipantes('${torneo.id}')">Ver Lista</button>
                </div>
                <div class="flex flex-col gap-2 mt-auto">
                    <button class="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition"><i class="fas fa-user-plus mr-2"></i>Inscribirse</button>
                    <button class="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition"><i class="fas fa-sign-in-alt mr-2"></i>Iniciar Check In</button>
                </div>
            </div>
        </div>
    `;
}

// Cuando cargues los torneos, asegúrate de pasar el bannerUrl/banner al renderizador
// Ejemplo de uso:
// document.getElementById('torneos-abiertos').innerHTML = torneosAbiertos.map(renderTorneoCard).join('');

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Configurar listener de autenticación
    onAuthStateChanged(auth, (user) => {
        updateAuthUI(user);
        // Recargar torneos para actualizar los botones
        loadTournaments();
    });
    
    loadTournaments();
    loadLeaderboard();
    setupEventListeners();
});

// Asegúrate de que los botones de inscripción y cerrar modal funcionen correctamente
function setupEventListeners() {
    document.body.addEventListener('click', function (e) {
        // Inscribirse
        if (e.target.closest('.inscribirse-btn')) {
            const btn = e.target.closest('.inscribirse-btn');
            const torneoId = btn.dataset.torneoId;
            const torneoNombre = btn.dataset.torneoNombre;
            openInscriptionModal(torneoId, torneoNombre);
        }
        // Desinscribirse
        if (e.target.closest('.desinscribirse-btn')) {
            const btn = e.target.closest('.desinscribirse-btn');
            const torneoId = btn.dataset.torneoId;
            const torneoNombre = btn.dataset.torneoNombre;
            handleUnsubscribe(torneoId, torneoNombre);
        }
        // Cerrar modal inscripción (X o Cancelar)
        if (
            e.target.id === 'closeInscriptionModal' ||
            e.target.id === 'cancelInscriptionBtn' ||
            (e.target.closest && e.target.closest('#closeInscriptionModal'))
        ) {
            closeInscriptionModal();
        }
    });

    // Envío del formulario de inscripción
    const inscriptionForm = document.getElementById('inscriptionForm');
    if (inscriptionForm) {
        inscriptionForm.addEventListener('submit', handleInscription);
    }
}

// --- Código migrado desde el HTML para modales login/register y control de modales "ver lista" ---
document.addEventListener('DOMContentLoaded', () => {
    // Modal login/register: abrir/cerrar y solo Google
    // Cerrar login modal
    document.getElementById('closeLoginModal')?.addEventListener('click', () => {
        document.getElementById('loginModal').classList.add('hidden');
    });
    // Cerrar register modal
    document.getElementById('closeRegisterModal')?.addEventListener('click', () => {
        document.getElementById('registerModal').classList.add('hidden');
    });
    // Abrir registro desde login
    document.getElementById('openRegisterModalBtn')?.addEventListener('click', () => {
        document.getElementById('loginModal').classList.add('hidden');
        document.getElementById('registerModal').classList.remove('hidden');
    });
    // Abrir login desde registro
    document.getElementById('openLoginModalBtn')?.addEventListener('click', () => {
        document.getElementById('registerModal').classList.add('hidden');
        document.getElementById('loginModal').classList.remove('hidden');
    });

    // Helper para saber si el usuario está autenticado
    function isUserLoggedIn() {
        // window.auth es de Firebase Auth v9, pero puede no estar disponible inmediatamente
        // onAuthStateChanged ya lo inicializó en index-torneos.js
        if (window.auth && typeof window.auth.currentUser !== "undefined") {
            return !!window.auth.currentUser;
        }
        // fallback: busca el perfil en el DOM (si ya hay menú de usuario)
        return !!document.getElementById('userProfile');
    }

    // Botón login principal
    document.getElementById('loginBtn')?.addEventListener('click', () => {
        if (!isUserLoggedIn()) {
            document.getElementById('loginModal').classList.remove('hidden');
        }
    });

    // Botón registro principal
    document.getElementById('registerBtn')?.addEventListener('click', () => {
        if (!isUserLoggedIn()) {
            document.getElementById('registerModal').classList.remove('hidden');
        }
    });

    // Google login
    document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
        try {
            // Usa el auth y provider globales definidos en index-torneos.js
            if (window.auth && window.provider && window.signInWithPopup) {
                await window.signInWithPopup(window.auth, window.provider);
                document.getElementById('loginModal')?.classList.add('hidden');
                document.getElementById('registerModal')?.classList.add('hidden');
            } else {
                // fallback: intenta importar desde Firebase v9
                const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js');
                const auth = getAuth();
                const provider = new GoogleAuthProvider();
                await signInWithPopup(auth, provider);
                document.getElementById('loginModal')?.classList.add('hidden');
                document.getElementById('registerModal')?.classList.add('hidden');
            }
        } catch (error) {
            if (typeof showNotification === "function") {
                showNotification('Error al iniciar sesión con Google: ' + (error.message || error), 'error');
            } else {
                alert('Error al iniciar sesión con Google: ' + (error.message || error));
            }
        }
    });
    // Google register (puede ser igual a login)
    document.getElementById('googleRegisterBtn')?.addEventListener('click', async () => {
        try {
            if (window.auth && window.provider && window.signInWithPopup) {
                await window.signInWithPopup(window.auth, window.provider);
                document.getElementById('loginModal')?.classList.add('hidden');
                document.getElementById('registerModal')?.classList.add('hidden');
            } else {
                const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js');
                const auth = getAuth();
                const provider = new GoogleAuthProvider();
                await signInWithPopup(auth, provider);
                document.getElementById('loginModal')?.classList.add('hidden');
                document.getElementById('registerModal')?.classList.add('hidden');
            }
        } catch (error) {
            if (typeof showNotification === "function") {
                showNotification('Error al iniciar sesión con Google: ' + (error.message || error), 'error');
            } else {
                alert('Error al iniciar sesión con Google: ' + (error.message || error));
            }
        }
    });

    // --- Solo permitir un modal de "ver lista" abierto a la vez (si aplica) ---
    // Si tienes varios modales de participantes, usa una clase común, por ejemplo: 'modal-participantes'
    // Si solo tienes uno, ajusta el selector según corresponda
    const verListaBtns = document.querySelectorAll('.ver-lista-btn');
    verListaBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.modal-participantes').forEach(modal => {
                modal.classList.add('hidden');
            });
            const modalId = btn.getAttribute('data-modal-id') || 'modalParticipantes';
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('hidden');
            }
        });
    });

    document.querySelectorAll('.cerrar-modal-participantes').forEach(cerrarBtn => {
        cerrarBtn.addEventListener('click', () => {
            const modal = cerrarBtn.closest('.modal-participantes');
            if (modal) {
                modal.classList.add('hidden');
            }
        });
    });

    document.querySelectorAll('.modal-participantes').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
});