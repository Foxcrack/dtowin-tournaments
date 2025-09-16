// index-torneos.js - Versión refactorizada con subcolecciones
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, doc, getDoc, addDoc, setDoc, where, deleteDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
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

let currentUser = null;

// === FUNCIONES AUXILIARES ===
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `p-4 rounded-lg mb-4 text-white ${type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`;
    notification.textContent = message;
    document.getElementById('notifications').appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

async function checkIfUserIsAdmin(user) {
    if (!user) return false;
    const adminUIDs = ["dvblFee1ZnVKJNWBOR22tSAsNet2"];
    if (adminUIDs.includes(user.uid)) return true;

    const userRef = doc(db, "usuarios", user.uid);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.isHost === true;
    }
    return false;
}

// === FUNCIONES DE INSCRIPCIONES CON SUBCOLECCIONES ===

// Verificar si el usuario está inscrito en un torneo (usando subcolecciones)
async function checkUserInscription(userId, torneoId) {
    if (!userId || !torneoId) return null;

    try {
        // Buscar en la subcolección: torneos/{torneoId}/inscripciones/{userId}
        const inscripcionRef = doc(db, "torneos", torneoId, "inscripciones", userId);
        const inscripcionDoc = await getDoc(inscripcionRef);

        if (inscripcionDoc.exists() && inscripcionDoc.data().estado === "inscrito") {
            return inscripcionDoc;
        }
        return null;
    } catch (error) {
        console.error("Error verificando inscripción:", error);
        return null;
    }
}

// Contar inscripciones en un torneo (usando subcolecciones)
async function countInscriptions(torneoId) {
    try {
        // Contar documentos en torneos/{torneoId}/inscripciones donde estado = "inscrito"
        const inscripcionesRef = collection(db, "torneos", torneoId, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("estado", "==", "inscrito")
        );
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error("Error contando inscripciones:", error);
        return 0;
    }
}

// Obtener lista de inscritos por torneo (usando subcolecciones)
async function getInscritosByTorneo(torneoId) {
    try {
        const inscripcionesRef = collection(db, "torneos", torneoId, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("estado", "==", "inscrito"),
            orderBy("fechaInscripcion", "asc")
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id, // Este será el userId
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error obteniendo inscritos:", error);
        return [];
    }
}

// Verificar asistencia confirmada (usando subcolecciones)
async function checkUserAttendance(userId, torneoId) {
    if (!userId || !torneoId) return false;

    try {
        const inscripcionRef = doc(db, "torneos", torneoId, "inscripciones", userId);
        const inscripcionDoc = await getDoc(inscripcionRef);

        if (inscripcionDoc.exists()) {
            const inscripcion = inscripcionDoc.data();
            return inscripcion.estado === "inscrito" && (inscripcion.asistenciaConfirmada || false);
        }
        return false;
    } catch (error) {
        console.error("Error verificando asistencia:", error);
        return false;
    }
}

// Confirmar asistencia (usando subcolecciones)
async function confirmAttendance(torneoId) {
    if (!currentUser) {
        showNotification("Debes iniciar sesión para confirmar tu asistencia.", "error");
        return;
    }

    const userInscriptionRef = doc(db, "torneos", torneoId, "inscripciones", currentUser.uid);
    const userRef = doc(db, "usuarios", currentUser.uid);

    try {
        // --- Paso 1: Actualizar la asistencia del usuario en la subcolección ---
        await updateDoc(userInscriptionRef, {
            asistenciaConfirmada: true,
            updatedAt: new Date()
        });
        
        // --- Paso 2: Obtener el nombre del torneo ---
        const torneoDocRef = doc(db, "torneos", torneoId);
        const torneoDoc = await getDoc(torneoDocRef);
        let nombreTorneo = "Torneo Desconocido";

        if (torneoDoc.exists()) {
            nombreTorneo = torneoDoc.data().nombre;
        }

        // --- Paso 3: Actualizar el perfil del usuario ---
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Verificamos si el campo 'torneos' es null o no es un array válido.
            if (userData.torneos === null || !Array.isArray(userData.torneos)) {
                // Si es null, lo inicializamos como un array con el nombre del torneo.
                await updateDoc(userRef, {
                    torneos: [nombreTorneo]
                });
            } else {
                // Si ya es un array, agregamos el nombre al array existente.
                await updateDoc(userRef, {
                    torneos: arrayUnion(nombreTorneo)
                });
            }
        } else {
            // Si el documento del usuario no existe, lo creamos y lo inicializamos con el array.
            await setDoc(userRef, {
                torneos: [nombreTorneo]
            });
        }
        
        showNotification("Asistencia confirmada. ¡Bienvenido al torneo!", "success");
        loadTournaments();

    } catch (error) {
        console.error("Error al confirmar asistencia:", error);
        showNotification(`Error al confirmar asistencia: ${error.message}`, "error");
    }
}

// Manejar inscripción (usando subcolecciones)
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

    if (discordUsername.length < 2 || discordUsername.length > 50) {
        showNotification('El nombre de Discord debe tener entre 2 y 50 caracteres', 'error');
        return;
    }

    try {
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

        // Crear documento de inscripción usando el userId como ID del documento
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
            puntos: 0,
            asistenciaConfirmada: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Guardar en subcolección: torneos/{torneoId}/inscripciones/{userId}
        const inscripcionRef = doc(db, "torneos", torneoId, "inscripciones", currentUser.uid);
        await setDoc(inscripcionRef, inscripcionData);

        showNotification('¡Inscripción exitosa! Te has registrado en el torneo.', 'success');
        closeInscriptionModal();
        loadTournaments();

    } catch (error) {
        console.error('Error en inscripción:', error);
        showNotification('Error al inscribirse: ' + error.message, 'error');
    } finally {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-trophy mr-2"></i>Inscribirse';
            submitBtn.disabled = false;
        }
    }
}

// Manejar desinscripción (usando subcolecciones)
async function handleUnsubscribe(torneoId, torneoNombre) {
    const confirmed = confirm(`¿Estás seguro de que deseas desinscribirte del torneo "${torneoNombre}"?`);
    if (!confirmed) return;

    try {
        const inscripcionRef = doc(db, "torneos", torneoId, "inscripciones", currentUser.uid);
        const inscripcionDoc = await getDoc(inscripcionRef);

        if (!inscripcionDoc.exists() || inscripcionDoc.data().estado !== "inscrito") {
            showNotification('No se encontró tu inscripción en este torneo', 'error');
            return;
        }

        const inscripcionData = inscripcionDoc.data();

        // Actualizar el estado a "desinscrito"
        await setDoc(inscripcionRef, {
            ...inscripcionData,
            estado: "desinscrito",
            fechaDesinscripcion: new Date(),
            updatedAt: new Date()
        });

        showNotification('Te has desinscrito del torneo correctamente', 'success');
        loadTournaments();

    } catch (error) {
        console.error('Error al desinscribirse:', error);
        showNotification('Error al desinscribirse: ' + error.message, 'error');
    }
}

// === FUNCIONES DE UI ===

async function updateAuthUI(user) {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const heroSection = document.querySelector('section.text-center');

    if (user) {
        currentUser = user;
        const isAdmin = await checkIfUserIsAdmin(user);
        const userName = user.displayName || user.email.split('@')[0] || 'Usuario';

        loginBtn.innerHTML = `
            <div class="flex items-center gap-2 cursor-pointer" id="userProfile">
                <img src="${user.photoURL || 'dtowin.png'}" alt="Perfil" class="w-8 h-8 rounded-full object-cover border-2 border-white">
                <span class="font-semibold">${userName}</span>
                ${isAdmin ? '<i class="fas fa-crown text-yellow-300 text-xs"></i>' : ''}
                <i class="fas fa-chevron-down text-sm"></i>
            </div>
        `;

        const heroTitle = heroSection.querySelector('h1');
        const heroText = heroSection.querySelector('p');
        heroTitle.textContent = `¡Bienvenido/a de vuelta, ${userName}!${isAdmin ? ' 👑' : ''}`;
        heroText.textContent = isAdmin ?
            'Administra la plataforma y gestiona todos los torneos desde tu panel de control.' :
            'Continúa participando en emocionantes torneos y escalando en el ranking global.';

        registerBtn.innerHTML = isAdmin ?
            `<i class="fas fa-cog mr-2"></i>Panel de Admin` :
            `<i class="fas fa-gamepad mr-2"></i>Ver Mis Torneos`;
        registerBtn.onclick = () => window.open(isAdmin ? 'admin/admin-panel.html' : 'perfil.html', '_blank');

        createUserDropdown();

    } else {
        currentUser = null;

        loginBtn.innerHTML = 'Iniciar Sesión';
        loginBtn.onclick = () => document.getElementById('loginModal').classList.remove('hidden');

        registerBtn.innerHTML = '¡Regístrate Ahora!';
        registerBtn.onclick = () => document.getElementById('registerModal').classList.remove('hidden');

        const heroTitle = heroSection.querySelector('h1');
        const heroText = heroSection.querySelector('p');
        heroTitle.textContent = 'Bienvenido a la Plataforma de Torneos Dtowin';
        heroText.textContent = 'Participa en emocionantes torneos, gana puntos, consigue badges y escala en el ranking global.';

        removeUserDropdown();
    }
}

async function createUserDropdown() {
    removeUserDropdown();

    const userProfile = document.getElementById('userProfile');
    if (userProfile) {
        userProfile.addEventListener('click', async () => {
            const isAdmin = await checkIfUserIsAdmin(currentUser);

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

            userProfile.style.position = 'relative';
            userProfile.appendChild(dropdown);

            document.getElementById('logoutBtn').addEventListener('click', async () => {
                try {
                    await signOut(auth);
                    showNotification('¡Sesión cerrada correctamente!', 'success');
                    removeUserDropdown();
                } catch (error) {
                    showNotification('Error al cerrar sesión: ' + error.message, 'error');
                }
            });

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

function removeUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.remove();
    }
}

// Obtener URL del banner (sin cambios)
async function getBannerUrl(bannerId) {
    if (!bannerId) return null;

    if (typeof bannerId === "string" && (bannerId.startsWith("http://") || bannerId.startsWith("https://") || bannerId.startsWith("data:image"))) {
        return bannerId;
    }

    try {
        const bannerRef = doc(db, "banners", bannerId);
        const bannerDoc = await getDoc(bannerRef);
        if (bannerDoc.exists()) {
            const bannerData = bannerDoc.data();
            return bannerData.imageUrl || bannerData.imageData || bannerData.url || bannerData.imagen || bannerData.src || bannerData.banner || null;
        }
    } catch (error) {
        console.error("Error obteniendo banner:", error);
    }
    return null;
}

// Cargar torneos (actualizado para usar subcolecciones)
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

        const torneos = [];
        snapshot.forEach(docSnap => {
            const torneo = { id: docSnap.id, ...docSnap.data() };
            if (torneosPorEstado[torneo.estado]) {
                torneosPorEstado[torneo.estado].push(torneo);
            }
            torneos.push(torneo);
        });

        // Pre-cargar banners
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

        // Renderizar cada sección
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

                // Usar funciones con subcolecciones
                totalInscritos = await countInscriptions(torneo.id);

                if (currentUser && (estado === "Abierto" || estado === "Check In")) {
                    const inscripcion = await checkUserInscription(currentUser.uid, torneo.id);
                    isInscrito = inscripcion !== null;
                    if (estado === "Check In" && isInscrito) {
                        const asistenciaConfirmada = await checkUserAttendance(currentUser.uid, torneo.id);
                        torneo.asistenciaConfirmada = asistenciaConfirmada;
                    }
                }

                const fechaTorneo = torneo.fecha ? new Date(torneo.fecha.seconds * 1000) : null;
                const fechaFormateada = fechaTorneo ?
                    fechaTorneo.toLocaleDateString('es-ES', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    }) : 'Fecha TBD';

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
                            <div class="flex flex-col gap-2 mt-2">
                                ${estado === "Abierto"
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

// Modal de inscritos (actualizado para usar subcolecciones)
async function showInscritosModal(torneoId, torneoNombre) {
    try {
        document.querySelectorAll('#inscritosModal').forEach(m => m.remove());

        // Usar función con subcolecciones
        const inscritos = await getInscritosByTorneo(torneoId);

        const confirmados = inscritos.filter(inscrito => inscrito.asistenciaConfirmada);
        const noConfirmados = inscritos.filter(inscrito => !inscrito.asistenciaConfirmada);

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

        modal.querySelector('#closeInscritosModal').addEventListener('click', () => modal.remove());
        modal.querySelector('#closeInscritosModalBtn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

    } catch (error) {
        console.error('Error mostrando inscritos:', error);
        showNotification('Error al cargar la lista de inscritos', 'error');
    }
}

// Funciones auxiliares para modales
function openInscriptionModal(torneoId, torneoNombre) {
    const modal = document.getElementById('inscriptionModal');
    if (!modal) {
        console.error('Modal de inscripción no encontrado');
        return;
    }

    document.getElementById('modalTournamentName').textContent = torneoNombre;
    document.getElementById('inscriptionForm').dataset.torneoId = torneoId;

    document.getElementById('gameUsername').value = '';
    document.getElementById('discordUsername').value = '';

    modal.classList.remove('hidden');
}

function closeInscriptionModal() {
    const modal = document.getElementById('inscriptionModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Setup de botones
function setupTournamentButtons() {
    document.querySelectorAll('.check-in-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const torneoId = e.currentTarget.dataset.torneoId;
            confirmAttendance(torneoId);
        });
    });

    document.querySelectorAll('.login-required-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showNotification('Debes iniciar sesión para participar', 'error');
            document.getElementById('loginModal').classList.remove('hidden');
        });
    });

    document.querySelectorAll('.ver-inscritos-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const torneoId = e.currentTarget.dataset.torneoId;
            const torneoNombre = e.currentTarget.dataset.torneoNombre;
            showInscritosModal(torneoId, torneoNombre);
        });
    });
}

// Cargar leaderboard
async function loadLeaderboard() {
    const leaderboardContainer = document.getElementById('leaderboard');
    if (!leaderboardContainer) return;

    try {
        leaderboardContainer.innerHTML = '<div class="text-center text-gray-500 p-4">Cargando leaderboard...</div>';

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

// Setup de event listeners
function setupEventListeners() {
    document.body.addEventListener('click', function (e) {
        // En este caso, e.target.closest() es más seguro
        const inscribirseBtn = e.target.closest('.inscribirse-btn');
        if (inscribirseBtn) {
            const torneoId = inscribirseBtn.dataset.torneoId;
            const torneoNombre = inscribirseBtn.dataset.torneoNombre;
            openInscriptionModal(torneoId, torneoNombre);
        }

        const desinscribirseBtn = e.target.closest('.desinscribirse-btn');
        if (desinscribirseBtn) {
            const torneoId = desinscribirseBtn.dataset.torneoId;
            const torneoNombre = desinscribirseBtn.dataset.torneoNombre;
            handleUnsubscribe(torneoId, torneoNombre);
        }

        if (
            e.target.id === 'closeInscriptionModal' ||
            e.target.id === 'cancelInscriptionBtn' ||
            (e.target.closest && e.target.closest('#closeInscriptionModal'))
        ) {
            closeInscriptionModal();
        }
    });

    const inscriptionForm = document.getElementById('inscriptionForm');
    if (inscriptionForm) {
        inscriptionForm.addEventListener('submit', handleInscription);
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        updateAuthUI(user);
        loadTournaments();
    });

    loadTournaments();
    loadLeaderboard();
    setupEventListeners();

    // Modales de login/register
    document.getElementById('closeLoginModal')?.addEventListener('click', () => {
        document.getElementById('loginModal').classList.add('hidden');
    });

    document.getElementById('closeRegisterModal')?.addEventListener('click', () => {
        document.getElementById('registerModal').classList.add('hidden');
    });

    document.getElementById('openRegisterModalBtn')?.addEventListener('click', () => {
        document.getElementById('loginModal').classList.add('hidden');
        document.getElementById('registerModal').classList.remove('hidden');
    });

    document.getElementById('openLoginModalBtn')?.addEventListener('click', () => {
        document.getElementById('registerModal').classList.add('hidden');
        document.getElementById('loginModal').classList.remove('hidden');
    });

    function isUserLoggedIn() {
        return !!document.getElementById('userProfile');
    }

    document.getElementById('loginBtn')?.addEventListener('click', () => {
        if (!isUserLoggedIn()) {
            document.getElementById('loginModal').classList.remove('hidden');
        }
    });

    document.getElementById('registerBtn')?.addEventListener('click', () => {
        if (!isUserLoggedIn()) {
            document.getElementById('registerModal').classList.remove('hidden');
        }
    });

    // Google authentication
    document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, provider);
            document.getElementById('loginModal')?.classList.add('hidden');
            document.getElementById('registerModal')?.classList.add('hidden');
        } catch (error) {
            showNotification('Error al iniciar sesión con Google: ' + (error.message || error), 'error');
        }
    });

    document.getElementById('googleRegisterBtn')?.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, provider);
            document.getElementById('loginModal')?.classList.add('hidden');
            document.getElementById('registerModal')?.classList.add('hidden');
        } catch (error) {
            showNotification('Error al registrarse con Google: ' + (error.message || error), 'error');
        }
    });
});

async function awardTournamentsPlayed(torneoId) {
    try {
        // 1. Obtener la lista de inscritos del torneo
        const inscripcionesRef = collection(db, "torneos", torneoId, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("asistenciaConfirmada", "==", true), // Filtramos solo por los que hicieron check-in
            where("estado", "==", "inscrito") // y que sigan inscritos
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log(`No hay participantes confirmados para el torneo ${torneoId}.`);
            return;
        }

        console.log(`Registrando torneo a ${snapshot.size} participantes que realizaron check-in.`);

        // 2. Recorrer la lista de confirmados y actualizar sus datos
        const updatePromises = snapshot.docs.map(async (inscritoDoc) => {
            const participante = inscritoDoc.data();
            const userRef = doc(db, "usuarios", participante.userId);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();

                // Asegurar que el campo 'torneos' es un array y agregar el torneoId
                const userTorneos = Array.isArray(userData.torneos) ? userData.torneos : [];
                if (!userTorneos.includes(torneoId)) {
                    userTorneos.push(torneoId);
                }

                // Actualizar solo el array de torneos
                await updateDoc(userRef, {
                    torneos: userTorneos,
                    updatedAt: new Date()
                });
            }
        });

        // Esperar a que todas las actualizaciones se completen
        await Promise.all(updatePromises);
        console.log("Torneos jugados actualizados con éxito.");

    } catch (error) {
        console.error("Error al registrar torneos jugados:", error);
    }
}