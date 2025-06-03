// main.js - Script principal para la plataforma Dtowin
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

// Variable para almacenar el usuario actual
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

// Función para obtener la URL del banner - CORREGIDA
async function getBannerUrl(bannerId) {
    if (!bannerId) {
        console.log('No bannerId proporcionado');
        return null;
    }
    
    try {
        console.log('Buscando banner con ID:', bannerId);
        
        // Si bannerId ya es una URL directa, devolverla
        if (bannerId.startsWith('http://') || bannerId.startsWith('https://')) {
            console.log('bannerId es una URL directa:', bannerId);
            return bannerId;
        }
        
        // Buscar en la colección banners con el ID proporcionado
        const bannerRef = doc(db, "banners", bannerId);
        const bannerDoc = await getDoc(bannerRef);
        
        console.log('Banner documento existe:', bannerDoc.exists());
        
        if (bannerDoc.exists()) {
            const bannerData = bannerDoc.data();
            console.log('Datos del banner:', bannerData);
            
            // Los banners almacenan la imagen en imageData (base64) o imageUrl
            // Priorizar imageUrl si existe, sino usar imageData
            const url = bannerData.imageUrl || bannerData.imageData || bannerData.url || bannerData.imagen || bannerData.src || bannerData.banner || null;
            console.log('URL del banner encontrada:', url);
            return url;
        } else {
            console.log('Banner no encontrado en la colección banners con ID:', bannerId);
            return null;
        }
        
    } catch (error) {
        console.error("Error obteniendo banner:", error);
        return null;
    }
}

// Cargar torneos - SIMPLIFICADO Y CORREGIDO
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

        snapshot.forEach(doc => {
            const torneo = { id: doc.id, ...doc.data() };
            if (torneosPorEstado[torneo.estado]) {
                torneosPorEstado[torneo.estado].push(torneo);
            }
        });

        // Procesar cada estado y verificar inscripciones
        for (const [estado, torneos] of Object.entries(torneosPorEstado)) {
            const contenedor = containers[estado];
            if (!contenedor) continue;
            
            if (torneos.length === 0) {
                contenedor.innerHTML = `<div class="text-center text-gray-400 p-4">No hay torneos</div>`;
                continue;
            }

            // Verificar inscripciones para cada torneo
            const torneosHTML = await Promise.all(torneos.map(async (torneo) => {
                let isInscrito = false;
                let totalInscritos = 0;
                
                // Contar total de inscritos
                totalInscritos = await countInscriptions(torneo.id);
                
                if (currentUser && (estado === "Abierto" || estado === "Check In")) {
                    const inscripcion = await checkUserInscription(currentUser.uid, torneo.id);
                    isInscrito = inscripcion !== null;
                    
                    // Si está en estado Check In, verificar también si confirmó asistencia
                    if (estado === "Check In" && isInscrito) {
                        const asistenciaConfirmada = await checkUserAttendance(currentUser.uid, torneo.id);
                        torneo.asistenciaConfirmada = asistenciaConfirmada;
                    }
                }

                // Obtener el banner del torneo - CORREGIDO
                let bannerUrl = null;
                
                console.log('Datos completos del torneo:', torneo);
                console.log('bannerId del torneo:', torneo.bannerId);
                
                // El torneo YA TIENE el bannerId, solo necesitamos usarlo para buscar el banner
                if (torneo.bannerId) {
                    bannerUrl = await getBannerUrl(torneo.bannerId);
                    console.log(`Banner obtenido para torneo ${torneo.nombre}:`, bannerUrl);
                } else {
                    console.log('No hay bannerId en el torneo');
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

                return `
                    <div class="bg-white rounded-lg shadow-lg overflow-hidden tournament-card hover:shadow-xl transition-shadow duration-300">
                        <!-- Banner del torneo -->
                        <div class="relative h-32 bg-gradient-to-r from-blue-500 to-purple-600 overflow-hidden">
                            ${bannerUrl ? `
                                <img src="${bannerUrl}" alt="Banner ${torneo.nombre}" 
                                     class="w-full h-full object-cover"
                                     onload="console.log('✅ Banner cargado exitosamente: ${bannerUrl}')"
                                     onerror="console.log('❌ Error cargando banner: ${bannerUrl}'); this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                <div class="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center" style="display:none;">
                                    <i class="fas fa-trophy text-white text-3xl opacity-50"></i>
                                    <div class="absolute bottom-2 left-2 text-white text-xs opacity-75">Error cargando banner</div>
                                </div>
                            ` : `
                                <div class="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                                    <i class="fas fa-trophy text-white text-3xl opacity-50"></i>
                                    <div class="absolute bottom-2 left-2 text-white text-xs opacity-75">Sin banner configurado</div>
                                </div>
                            `}
                            
                            <!-- Overlay con estado del torneo -->
                            <div class="absolute top-2 right-2">
                                <span class="px-2 py-1 rounded-full text-xs font-semibold bg-white/90 text-gray-800">
                                    ${torneo.estado}
                                </span>
                            </div>
                            
                            <!-- Overlay con fecha -->
                            <div class="absolute bottom-2 right-2">
                                <div class="bg-black/50 text-white px-2 py-1 rounded text-xs">
                                    <i class="fas fa-calendar mr-1"></i>${fechaFormateada}
                                </div>
                            </div>
                        </div>
                        
                        <!-- Contenido del torneo -->
                        <div class="p-4">
                            <h4 class="font-bold text-gray-800 mb-2 text-lg">${torneo.nombre || "Torneo sin nombre"}</h4>
                            <p class="text-gray-600 text-sm mb-3 line-clamp-2">${torneo.descripcion || "Sin descripción disponible"}</p>
                            
                            <!-- Debug info (solo mostrar en desarrollo) -->
                            <div class="text-xs text-gray-400 mb-2" style="display: ${window.location.hostname === 'localhost' ? 'block' : 'none'}">
                                🔍 Banner ID: ${torneo.bannerId || 'No definido'} | URL: ${bannerUrl ? '✅' : '❌'}
                            </div>
                            
                            <!-- Información de participantes -->
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
                            
                            <!-- Barra de progreso si hay capacidad máxima -->
                            ${torneo.capacidad ? `
                                <div class="mb-3">
                                    <div class="w-full bg-gray-200 rounded-full h-2">
                                        <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                             style="width: ${Math.min((totalInscritos / torneo.capacidad) * 100, 100)}%"></div>
                                    </div>
                                </div>
                            ` : ''}
                            
                            <div class="flex flex-col gap-2">
                                ${estado === "Abierto" ? `
                                    ${currentUser ? `
                                        ${isInscrito ? `
                                            <button class="desinscribirse-btn bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700 transition"
                                                data-torneo-id="${torneo.id}" data-torneo-nombre="${torneo.nombre}">
                                                <i class="fas fa-user-minus mr-2"></i>Desinscribirse
                                            </button>
                                        ` : `
                                            ${torneo.capacidad && totalInscritos >= torneo.capacidad ? `
                                                <button class="bg-gray-400 text-white py-2 px-4 rounded-lg font-semibold cursor-not-allowed">
                                                    <i class="fas fa-users mr-2"></i>Torneo Lleno
                                                </button>
                                            ` : `
                                                <button class="inscribirse-btn bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition"
                                                    data-torneo-id="${torneo.id}" data-torneo-nombre="${torneo.nombre}">
                                                    <i class="fas fa-user-plus mr-2"></i>Inscribirse
                                                </button>
                                            `}
                                        `}
                                    ` : `
                                        <button class="login-required-btn bg-gray-400 text-white py-2 px-4 rounded-lg font-semibold cursor-not-allowed">
                                            Inicia sesión para inscribirte
                                        </button>
                                    `}
                                    ${await checkIfUserIsAdmin(currentUser) ? `
                                        <button class="checkin-state-btn bg-yellow-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-yellow-700 transition"
                                            data-torneo-id="${torneo.id}" data-torneo-nombre="${torneo.nombre}">
                                            <i class="fas fa-clock mr-2"></i>Iniciar Check In
                                        </button>
                                    ` : ""}
                                ` : ""}
                                ${estado === "Check In" ? `
                                    ${currentUser ? `
                                        ${isInscrito ? `
                                            ${torneo.asistenciaConfirmada ? `
                                                <button class="confirmed-btn bg-green-600 text-white py-2 px-4 rounded-lg font-semibold cursor-not-allowed">
                                                    <i class="fas fa-check-circle mr-2"></i>Asistencia Confirmada
                                                </button>
                                            ` : `
                                                <button class="checkin-btn bg-purple-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-purple-700 transition"
                                                    data-torneo-id="${torneo.id}">
                                                    <i class="fas fa-check-circle mr-2"></i>Confirmar Asistencia
                                                </button>
                                            `}
                                        ` : `
                                            <button class="not-inscribed-btn bg-gray-400 text-white py-2 px-4 rounded-lg font-semibold cursor-not-allowed">
                                                <i class="fas fa-lock mr-2"></i>No inscrito
                                            </button>
                                        `}
                                    ` : `
                                        <button class="login-required-btn bg-gray-400 text-white py-2 px-4 rounded-lg font-semibold cursor-not-allowed">
                                            Inicia sesión para confirmar
                                        </button>
                                    `}
                                    ${await checkIfUserIsAdmin(currentUser) ? `
                                        <button class="start-tournament-btn bg-orange-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-orange-700 transition"
                                            data-torneo-id="${torneo.id}" data-torneo-nombre="${torneo.nombre}">
                                            <i class="fas fa-play mr-2"></i>Iniciar Torneo
                                        </button>
                                    ` : ""}
                                ` : ""}
                                ${estado === "En Progreso" ? `
                                    <button class="view-bracket-btn bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition"
                                        data-torneo-id="${torneo.id}" data-torneo-nombre="${torneo.nombre}">
                                        <i class="fas fa-sitemap mr-2"></i>Ver Bracket
                                    </button>
                                ` : ""}
                                
                                <!-- Indicadores de estado -->
                                <div class="flex gap-2 items-center">
                                    ${isInscrito ? '<span class="text-xs px-2 py-1 rounded bg-green-100 text-green-800"><i class="fas fa-check mr-1"></i>Inscrito</span>' : ''}
                                    ${estado === "Check In" && torneo.asistenciaConfirmada ? '<span class="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800"><i class="fas fa-check-circle mr-1"></i>Confirmado</span>' : ''}
                                    ${torneo.destacado ? '<span class="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800"><i class="fas fa-star mr-1"></i>Destacado</span>' : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }));

            contenedor.innerHTML = torneosHTML.join("");
        }

        // Agregar event listeners para los botones
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

// REEMPLAZAR la función showInscritosModal existente con esta versión mejorada:
async function showInscritosModal(torneoId, torneoNombre) {
    try {
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
                
                // Actualizar botones
                tabBtns.forEach(b => {
                    b.classList.remove('border-blue-500', 'text-blue-600');
                    b.classList.add('border-transparent', 'text-gray-500');
                });
                btn.classList.add('border-blue-500', 'text-blue-600');
                btn.classList.remove('border-transparent', 'text-gray-500');
                
                // Mostrar contenido correspondiente
                tabContents.forEach(content => content.classList.add('hidden'));
                document.getElementById(`tab-${targetTab}`).classList.remove('hidden');
            });
        });
        
        // Event listeners para cerrar
        document.getElementById('closeInscritosModal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        document.getElementById('closeInscritosModalBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Cerrar al hacer clic fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
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

// ACTUALIZAR setupTournamentButtons para incluir los botones de check-in:
function setupTournamentButtons() {
    // Botones de inscripción
    document.querySelectorAll('.inscribirse-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const torneoId = e.target.dataset.torneoId;
            const torneoNombre = e.target.dataset.torneoNombre;
            openInscriptionModal(torneoId, torneoNombre);
        });
    });

    // Botones de desinscripción
    document.querySelectorAll('.desinscribirse-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const torneoId = e.target.dataset.torneoId;
            const torneoNombre = e.target.dataset.torneoNombre;
            handleUnsubscribe(torneoId, torneoNombre);
        });
    });

    // Botones de check-in/confirmar asistencia - NUEVO
    document.querySelectorAll('.checkin-btn').forEach(btn => {
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
    
    // Validar formato de Discord (opcional pero recomendado)
    const discordRegex = /^.{2,32}#[0-9]{4}$|^[a-z0-9._]{2,32}$/i;
    if (!discordRegex.test(discordUsername)) {
        showNotification('Formato de Discord inválido. Usa: usuario#1234 o @usuario', 'error');
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
            const position = index + 1;
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
            
            return `
                <div class="flex items-center justify-between p-3 bg-white rounded-lg shadow mb-2">
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-lg ${position <= 3 ? 'text-yellow-500' : 'text-gray-500'}">${medal} #${position}</span>
                        <img src="${usuario.photoURL || 'dtowin.png'}" alt="Avatar" class="w-10 h-10 rounded-full object-cover">
                        <div>
                            <p class="font-semibold text-gray-800">${usuario.displayName || usuario.email}</p>
                            <p class="text-sm text-gray-500">${usuario.torneos || 0} torneos</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-blue-600">${usuario.puntos || 0} pts</p>
                        <p class="text-xs text-gray-500">${usuario.badges || 0} badges</p>
                    </div>
                </div>
            `;
        }).join('');
        
        leaderboardContainer.innerHTML = leaderboardHTML;
        
    } catch (error) {
        console.error('Error cargando leaderboard:', error);
        leaderboardContainer.innerHTML = '<div class="text-center text-red-500 p-4">Error al cargar el leaderboard</div>';
    }
}

// Actualizar la función setupEventListeners para incluir el botón de cancelar
function setupEventListeners() {
    // Formularios de autenticación
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showNotification('¡Inicio de sesión exitoso!', 'success');
            document.getElementById('loginModal').classList.add('hidden');
        } catch (error) {
            showNotification('Error al iniciar sesión: ' + error.message, 'error');
        }
    });

    document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            showNotification('¡Registro exitoso!', 'success');
            document.getElementById('registerModal').classList.add('hidden');
        } catch (error) {
            showNotification('Error al registrarse: ' + error.message, 'error');
        }
    });

    document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, provider);
            showNotification('¡Inicio de sesión con Google exitoso!', 'success');
            document.getElementById('loginModal').classList.add('hidden');
        } catch (error) {
            showNotification('Error al iniciar sesión con Google: ' + error.message, 'error');
        }
    });

    // Cerrar modales
    document.getElementById('closeLoginModal')?.addEventListener('click', () => {
        document.getElementById('loginModal').classList.add('hidden');
    });

    document.getElementById('closeRegisterModal')?.addEventListener('click', () => {
        document.getElementById('registerModal').classList.add('hidden');
    });

    // Modal de inscripción - CON VERIFICACIONES MEJORADAS
    const inscriptionModal = document.getElementById('inscriptionModal');
    const closeInscriptionBtn = document.getElementById('closeInscriptionModal');
    const cancelInscriptionBtn = document.getElementById('cancelInscriptionBtn');
    const inscriptionForm = document.getElementById('inscriptionForm');
    
    if (closeInscriptionBtn) {
        closeInscriptionBtn.addEventListener('click', closeInscriptionModal);
    }
    
    if (cancelInscriptionBtn) {
        cancelInscriptionBtn.addEventListener('click', closeInscriptionModal);
    }
    
    if (inscriptionForm) {
        inscriptionForm.addEventListener('submit', handleInscription);
    }
    
    if (inscriptionModal) {
        // Cerrar modal al hacer clic fuera
        inscriptionModal.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                closeInscriptionModal();
            }
        });
    }
}

// Hacer las funciones globales para que puedan ser llamadas desde el HTML
window.openInscriptionModal = openInscriptionModal;
window.closeInscriptionModal = closeInscriptionModal;

// Función para eliminar usuarios que no confirmaron asistencia
async function removeUnconfirmedParticipants(torneoId) {
    try {
        console.log('Eliminando participantes no confirmados del torneo:', torneoId);
        
        // Obtener todas las inscripciones del torneo
        const inscripcionesRef = collection(db, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("torneoId", "==", torneoId),
            where("estado", "==", "inscrito")
        );
        const snapshot = await getDocs(q);
        
        const confirmados = [];
        const noConfirmados = [];
        
        snapshot.forEach(doc => {
            const inscripcion = doc.data();
            if (inscripcion.asistenciaConfirmada) {
                confirmados.push(inscripcion.userId);
            } else {
                noConfirmados.push({
                    docId: doc.id,
                    userId: inscripcion.userId,
                    userName: inscripcion.userName
                });
            }
        });
        
        console.log(`Participantes confirmados: ${confirmados.length}`);
        console.log(`Participantes no confirmados: ${noConfirmados.length}`);
        
        // Eliminar inscripciones no confirmadas
        for (const inscripcion of noConfirmados) {
            await setDoc(doc(db, "inscripciones", inscripcion.docId), {
                estado: "eliminado_por_no_confirmar",
                fechaEliminacion: new Date(),
                motivoEliminacion: "No confirmó asistencia antes del inicio del torneo",
                asistenciaConfirmada: false
            }, { merge: true });
            
            console.log(`Eliminado participante: ${inscripcion.userName} (${inscripcion.userId})`);
        }
        
        // Actualizar el torneo con solo los participantes confirmados
        const torneoRef = doc(db, "torneos", torneoId);
        await setDoc(torneoRef, {
            participantesConfirmados: confirmados,
            participantesEliminados: noConfirmados.map(p => p.userId),
            fechaInicioTorneo: new Date(),
            estado: "En Progreso",
            updatedAt: new Date()
        }, { merge: true });
        
        showNotification(`Se eliminaron ${noConfirmados.length} participantes no confirmados`, 'info');
        
        return {
            confirmados: confirmados.length,
            eliminados: noConfirmados.length
        };
        
    } catch (error) {
        console.error('Error eliminando participantes no confirmados:', error);
        throw error;
    }
}

// Función para iniciar torneo y generar bracket - MEJORADA
async function startTournamentAndGenerateBracket(torneoId) {
    try {
        // Verificar participantes confirmados
        const inscripcionesRef = collection(db, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("torneoId", "==", torneoId),
            where("estado", "==", "inscrito"),
            where("asistenciaConfirmada", "==", true)
        );
        const snapshot = await getDocs(q);
        const confirmados = snapshot.size;
        
        console.log(`Participantes confirmados: ${confirmados}`);
        
        if (confirmados === 0) {
            // Preguntar si quiere crear un torneo de prueba
            const crearPrueba = confirm(
                'No hay participantes confirmados en este torneo.\n\n' +
                '¿Quieres crear un bracket de prueba con jugadores bot para testing?\n\n' +
                'Esto te permitirá probar la funcionalidad del bracket.'
            );
            
            if (!crearPrueba) {
                showNotification('Se necesitan participantes confirmados para iniciar el torneo', 'error');
                return;
            }
        } else if (confirmados === 1) {
            // Solo hay un participante confirmado, ofrecer agregar bots
            const agregarBots = confirm(
                `Solo hay 1 participante confirmado.\n\n` +
                `¿Quieres agregar jugadores bot para completar el bracket y poder probar?`
            );
            
            if (!agregarBots) {
                showNotification('Se necesitan al menos 2 participantes para iniciar el torneo', 'error');
                return;
            }
        }
        
        // Eliminar participantes no confirmados si los hay
        if (confirmados > 0) {
            await removeUnconfirmedParticipants(torneoId);
        }
        
        // Generar bracket (incluirá bots si es necesario)
        showNotification('Generando bracket del torneo...', 'info');
        
        // Importar función de brackets
        const { generateTournamentBracket } = await import('./brackets-new.js');
        
        const bracketId = await generateTournamentBracket(torneoId);
        
        const totalParticipantes = confirmados === 0 ? 8 : Math.max(confirmados + (8 - confirmados), 2);
        showNotification(
            `¡Torneo iniciado! Bracket generado con ${totalParticipantes} participantes` + 
            (confirmados < 2 ? ' (incluyendo jugadores bot para prueba)' : ''), 
            'success'
        );
        
        // Recargar torneos para mostrar el cambio
        loadTournaments();
        
        return bracketId;
        
    } catch (error) {
        console.error('Error iniciando torneo:', error);
        showNotification('Error al iniciar torneo: ' + error.message, 'error');
    }
}

// Función para auto-generar participantes bot cuando no hay inscritos
async function autoGenerateBotParticipants(torneoId) {
    try {
        console.log('Auto-generando participantes bot para torneo:', torneoId);
        
        // Verificar si ya hay participantes
        const inscripcionesRef = collection(db, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("torneoId", "==", torneoId),
            where("estado", "==", "inscrito")
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.size > 0) {
            console.log('Ya hay participantes inscritos, no se generarán bots');
            return snapshot.size;
        }
        
        // Crear 8 participantes bot automáticamente
        const participantesBots = [
            {
                userId: `bot_${torneoId}_1`,
                userName: 'Alpha Bot',
                gameUsername: 'AlphaBot',
                discordUsername: 'alpha_bot#0001',
                userPhoto: 'dtowin.png'
            },
            {
                userId: `bot_${torneoId}_2`,
                userName: 'Beta Bot',
                gameUsername: 'BetaBot',
                discordUsername: 'beta_bot#0002',
                userPhoto: 'dtowin.png'
            },
            {
                userId: `bot_${torneoId}_3`,
                userName: 'Gamma Bot',
                gameUsername: 'GammaBot',
                discordUsername: 'gamma_bot#0003',
                userPhoto: 'dtowin.png'
            },
            {
                userId: `bot_${torneoId}_4`,
                userName: 'Delta Bot',
                gameUsername: 'DeltaBot',
                discordUsername: 'delta_bot#0004',
                userPhoto: 'dtowin.png'
            },
            {
                userId: `bot_${torneoId}_5`,
                userName: 'Epsilon Bot',
                gameUsername: 'EpsilonBot',
                discordUsername: 'epsilon_bot#0005',
                userPhoto: 'dtowin.png'
            },
            {
                userId: `bot_${torneoId}_6`,
                userName: 'Zeta Bot',
                gameUsername: 'ZetaBot',
                discordUsername: 'zeta_bot#0006',
                userPhoto: 'dtowin.png'
            },
            {
                userId: `bot_${torneoId}_7`,
                userName: 'Eta Bot',
                gameUsername: 'EtaBot',
                discordUsername: 'eta_bot#0007',
                userPhoto: 'dtowin.png'
            },
            {
                userId: `bot_${torneoId}_8`,
                userName: 'Theta Bot',
                gameUsername: 'ThetaBot',
                discordUsername: 'theta_bot#0008',
                userPhoto: 'dtowin.png'
            }
        ];
        
        // Insertar cada bot como inscripción confirmada
        for (const bot of participantesBots) {
            await addDoc(collection(db, "inscripciones"), {
                userId: bot.userId,
                userName: bot.userName,
                gameUsername: bot.gameUsername,
                discordUsername: bot.discordUsername,
                userPhoto: bot.userPhoto,
                torneoId: torneoId,
                estado: "inscrito",
                asistenciaConfirmada: true,
                fechaInscripcion: new Date(),
                fechaConfirmacion: new Date(),
                esBot: true, // Marcar como bot
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
        
        console.log(`Se generaron ${participantesBots.length} participantes bot automáticamente`);
        return participantesBots.length;
        
    } catch (error) {
        console.error('Error auto-generando participantes bot:', error);
        throw error;
    }
}

// Función para cambiar estado del torneo a Check In
async function changeToCheckInState(torneoId) {
    try {
        // Verificar participantes actuales
        const inscripcionesRef = collection(db, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("torneoId", "==", torneoId),
            where("estado", "==", "inscrito")
        );
        const snapshot = await getDocs(q);
        const participantesActuales = snapshot.size;
        
        console.log(`Participantes actuales: ${participantesActuales}`);
        
        // Si no hay participantes, generar bots automáticamente
        if (participantesActuales === 0) {
            const botsGenerados = await autoGenerateBotParticipants(torneoId);
            showNotification(`Se generaron ${botsGenerados} participantes bot automáticamente para el torneo`, 'info');
        }
        
        // Cambiar estado del torneo a Check In
        const torneoRef = doc(db, "torneos", torneoId);
        await setDoc(torneoRef, {
            estado: "Check In",
            fechaCheckIn: new Date(),
            updatedAt: new Date()
        }, { merge: true });
        
        showNotification('Torneo cambiado a estado Check In', 'success');
        
        // Recargar torneos para mostrar el cambio
        loadTournaments();
        
    } catch (error) {
        console.error('Error cambiando estado a Check In:', error);
        showNotification('Error al cambiar estado: ' + error.message, 'error');
    }
}

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