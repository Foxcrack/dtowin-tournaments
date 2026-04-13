// index-torneos.js - Versión refactorizada con subcolecciones
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, doc, getDoc, addDoc, setDoc, where, deleteDoc, updateDoc, arrayUnion, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";

// Funciones de utilidad para zonas horarias (inline para evitar problemas de imports)
function getUserTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function getTimeZoneName(timeZone = null) {
    const userTimeZone = timeZone || getUserTimeZone();
    
    const timeZoneNames = {
        'America/Bogota': 'COT (Colombia)',
        'America/Mexico_City': 'CST (México)',
        'America/Argentina/Buenos_Aires': 'ART (Argentina)',
        'America/Santiago': 'CLT (Chile)',
        'America/Lima': 'PET (Perú)',
        'America/Caracas': 'VET (Venezuela)',
        'Europe/Madrid': 'CET (España)',
        'America/New_York': 'EST (Estados Unidos - Este)',
        'America/Los_Angeles': 'PST (Estados Unidos - Oeste)',
        'Europe/London': 'GMT (Reino Unido)'
    };
    
    return timeZoneNames[userTimeZone] || userTimeZone;
}

function formatDateTimeInLocalZone(utcDate, options = {}) {
    const userTimeZone = getUserTimeZone();
    
    console.log("Formateando fecha:", utcDate, "para zona:", userTimeZone);
    
    // Convertir Timestamp de Firebase a Date si es necesario
    let date = utcDate;
    if (utcDate && typeof utcDate.toDate === 'function') {
        date = utcDate.toDate();
        console.log("Convertido de Timestamp:", date);
    } else if (typeof utcDate === 'string') {
        date = new Date(utcDate);
        console.log("Convertido de string:", date);
    }
    
    const defaultOptions = {
        timeZone: userTimeZone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    const formatOptions = { ...defaultOptions, ...options };
    
    const resultado = date.toLocaleString('es-ES', formatOptions);
    console.log("Resultado formateado:", resultado);
    
    return resultado;
}

function convertUTCToLocal(utcDate, timeZone = null) {
    const userTimeZone = timeZone || getUserTimeZone();
    
    // Convertir Timestamp de Firebase a Date si es necesario
    let date = utcDate;
    if (utcDate && typeof utcDate.toDate === 'function') {
        date = utcDate.toDate();
    } else if (typeof utcDate === 'string') {
        date = new Date(utcDate);
    }
    
    // Crear nueva fecha en la zona horaria local
    return new Date(date.toLocaleString("en-US", { timeZone: userTimeZone }));
}

// Función para mostrar notificaciones (inline)
function showNotification(message, type = "info") {
    // Verificar si ya existe una notificación
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Crear elemento de notificación
    const notification = document.createElement('div');
    
    // Clases según el tipo de notificación
    let bgColor = 'bg-blue-500';
    let icon = 'info-circle';
    
    if (type === 'success') {
        bgColor = 'bg-green-500';
        icon = 'check-circle';
    } else if (type === 'error') {
        bgColor = 'bg-red-500';
        icon = 'exclamation-circle';
    } else if (type === 'warning') {
        bgColor = 'bg-yellow-500';
        icon = 'exclamation-triangle';
    }
    
    // Estilos de la notificación
    notification.className = `notification fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center`;
    notification.innerHTML = `
        <i class="fas fa-${icon} mr-2"></i>
        <span>${message}</span>
    `;
    
    // Añadir al DOM
    document.body.appendChild(notification);
    
    // Eliminar después de 3 segundos
    setTimeout(() => {
        notification.classList.add('opacity-0');
        notification.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 3000);
}

console.log("🔧 index-torneos.js cargado correctamente");

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
let torneosListener = null; // Para almacenar el listener activo
let inscripcionesListeners = new Map(); // Para almacenar listeners de inscripciones por torneo

const TETRIO_RANK_ORDER = ['z', 'd', 'd+', 'c-', 'c', 'c+', 'b-', 'b', 'b+', 'a-', 'a', 'a+', 's-', 's', 's+', 'ss', 'u', 'x'];
const TETRIO_RANK_ICON_MAP = {
    'z': 'z',
    'd': 'd',
    'd+': 'dp',
    'c-': 'cm',
    'c': 'c',
    'c+': 'cp',
    'b-': 'bm',
    'b': 'b',
    'b+': 'bp',
    'a-': 'am',
    'a': 'a',
    'a+': 'ap',
    's-': 'sm',
    's': 's',
    's+': 'sp',
    'ss': 'ss',
    'u': 'u',
    'x': 'x'
};
const TETRIO_LOOKUP_ENDPOINTS = [
    '/.netlify/functions/tetrio',
    '/api/tetrio',
    'https://dtowin-tournaments.netlify.app/.netlify/functions/tetrio'
];

function normalizeTetrioRank(rank) {
    return String(rank || 'z').trim().toLowerCase();
}

function getTetrioRankIconUrl(rank) {
    const normalizedRank = normalizeTetrioRank(rank);
    const iconCode = TETRIO_RANK_ICON_MAP[normalizedRank] || 'z';
    return `https://tetrio.team2xh.net/images/ranks/${iconCode}.png`;
}

function formatTetrioRank(rank) {
    const normalizedRank = normalizeTetrioRank(rank);
    return normalizedRank === 'z' ? 'Z' : normalizedRank.toUpperCase();
}

function compareTetrioRanks(userRank, rankCap) {
    const userIndex = TETRIO_RANK_ORDER.indexOf(normalizeTetrioRank(userRank));
    const capIndex = TETRIO_RANK_ORDER.indexOf(normalizeTetrioRank(rankCap));

    if (userIndex === -1 || capIndex === -1) {
        return 0;
    }

    return userIndex - capIndex;
}

function formatTetrioTr(tr) {
    return typeof tr === 'number' && tr >= 0 ? tr.toFixed(2) : 'Sin TR';
}

function getTournamentGameLabel(gameId) {
    if (gameId === 'tetrio') {
        return 'Usuario de TETR.IO *';
    }

    return 'Nombre de Juego *';
}

async function getCurrentUserProfileData() {
    if (!currentUser) {
        return null;
    }

    const usersRef = collection(db, "usuarios");
    const userQuery = query(usersRef, where("uid", "==", currentUser.uid), limit(1));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
        return null;
    }

    return {
        id: userSnapshot.docs[0].id,
        ref: userSnapshot.docs[0].ref,
        data: userSnapshot.docs[0].data()
    };
}

async function lookupTetrioAccountForRegistration(username) {
    let lastError = null;

    for (const endpoint of TETRIO_LOOKUP_ENDPOINTS) {
        try {
            const response = await fetch(`${endpoint}?username=${encodeURIComponent(username)}`);

            if (response.status === 404) {
                lastError = new Error('La función de TETR.IO no está desplegada todavía.');
                continue;
            }

            const data = await response.json();

            if (!response.ok || !data.success || !data.account) {
                throw new Error(data.error || 'No se pudo validar la cuenta de TETR.IO');
            }

            return data.account;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('No se pudo validar la cuenta de TETR.IO');
}

async function configureInscriptionModalForTournament(torneoId) {
    const gameInput = document.getElementById('gameUsername');
    const discordInput = document.getElementById('discordUsername');
    const gameLabel = document.getElementById('gameUsernameLabel');
    const gameHelp = document.getElementById('gameUsernameHelp');
    const form = document.getElementById('inscriptionForm');

    if (!gameInput || !discordInput || !gameLabel || !gameHelp || !form) {
        return;
    }

    gameInput.value = '';
    discordInput.value = '';
    form.dataset.gameCategory = 'general';

    try {
        const torneoRef = doc(db, "torneos", torneoId);
        const torneoSnap = await getDoc(torneoRef);
        const torneoData = torneoSnap.exists() ? torneoSnap.data() : {};
        const gameCategory = torneoData.juego || 'general';
        form.dataset.gameCategory = gameCategory;
        form.dataset.rankCap = torneoData.rankCap || '';

        gameLabel.textContent = getTournamentGameLabel(gameCategory);
        gameInput.placeholder = gameCategory === 'tetrio' ? 'Tu usuario de TETR.IO' : 'Tu nombre en el juego';
        gameHelp.textContent = gameCategory === 'tetrio'
            ? `Si ya vinculaste TETR.IO en tu perfil, se autocompletará. Si no, escribe tu usuario y lo guardaremos en tu cuenta.${torneoData.rankCap ? ` Rank cap: ${formatTetrioRank(torneoData.rankCap)}.` : ''}`
            : 'Este será tu nombre visible en el torneo';

        if (!currentUser) {
            return;
        }

        const profile = await getCurrentUserProfileData();
        const userData = profile?.data;

        if (userData?.discord?.username) {
            discordInput.value = userData.discord.username;
        }

        if (gameCategory === 'tetrio' && userData?.gameAccounts?.tetrio?.username) {
            gameInput.value = userData.gameAccounts.tetrio.username;
        }
    } catch (error) {
        console.error('Error configurando modal de inscripcion:', error);
    }
}

async function persistTournamentGameAccount(gameCategory, gameUsername, accountData = null) {
    if (!currentUser || !gameUsername || gameCategory !== 'tetrio') {
        return;
    }

    const profile = await getCurrentUserProfileData();
    if (!profile) {
        return;
    }

    const existingAccount = profile.data?.gameAccounts?.tetrio || {};
    const nextAccount = {
        gameId: 'tetrio',
        username: gameUsername,
        rank: accountData?.rank ?? existingAccount.rank ?? null,
        tr: typeof accountData?.tr === 'number' ? accountData.tr : (existingAccount.tr ?? null),
        userId: accountData?.userId ?? existingAccount.userId ?? null,
        avatarUrl: accountData?.avatarUrl ?? existingAccount.avatarUrl ?? null,
        linkedFrom: existingAccount.linkedFrom || 'tournament_registration',
        updatedAt: serverTimestamp()
    };

    await updateDoc(profile.ref, {
        'gameAccounts.tetrio': nextAccount,
        updatedAt: serverTimestamp()
    });
}

// === FUNCIONES DE TIEMPO REAL ===

// Configurar listeners en tiempo real para torneos
function setupRealTimeTournaments() {
    // Limpiar listener anterior si existe
    if (torneosListener) {
        torneosListener();
        torneosListener = null;
    }

    // Limpiar listeners de inscripciones anteriores
    inscripcionesListeners.forEach(unsubscribe => unsubscribe());
    inscripcionesListeners.clear();

    const containers = {
        "En Progreso": document.getElementById("torneos-en-proceso"),
        "Abierto": document.getElementById("torneos-abiertos"),
        "Check In": document.getElementById("torneos-checkin"),
        "Próximamente": document.getElementById("torneos-proximos")
    };

    // Listener principal para torneos
    const torneosRef = collection(db, "torneos");
    // Sin ordenar por ahora para evitar errores con campos mixtos
    // const q = query(torneosRef, orderBy("fechaHora", "desc"));
    
    console.log("🔄 Configurando listener de torneos...");
    
    torneosListener = onSnapshot(torneosRef, async (snapshot) => {
        console.log("🔄 Actualizando torneos en tiempo real...");
        console.log("Número de torneos recibidos:", snapshot.size);
        
        const torneosPorEstado = {
            "En Progreso": [],
            "Abierto": [],
            "Check In": [],
            "Próximamente": []
        };

        const torneos = [];
        snapshot.forEach(docSnap => {
            const torneo = { id: docSnap.id, ...docSnap.data() };
            console.log("Torneo procesado:", torneo.nombre, "Estado:", torneo.estado, "Visible:", torneo.visible);
            
            if (torneo.visible !== false && torneosPorEstado[torneo.estado]) {
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

        // Configurar listeners de inscripciones para cada torneo
        torneos.forEach(torneo => {
            setupInscripcionesListener(torneo.id);
            // Configurar listener para el estado del usuario actual en torneos de Check-in
            if (torneo.estado === "Check In" && currentUser) {
                setupUserAttendanceListener(torneo.id, currentUser.uid);
            }
        });

        // Renderizar torneos
        await renderTorneosPorEstado(torneosPorEstado, containers);
        
        console.log("✅ Torneos actualizados en tiempo real");
    }, (error) => {
        console.error("❌ Error en listener de torneos:", error);
        Object.values(containers).forEach(c => {
            if (c) c.innerHTML = `<div class="text-center text-red-500 p-4">Error al cargar torneos en tiempo real</div>`;
        });
    });
}

// Configurar listener en tiempo real para inscripciones de un torneo específico
function setupInscripcionesListener(torneoId) {
    // Si ya existe un listener para este torneo, no crear otro
    if (inscripcionesListeners.has(torneoId)) {
        return;
    }

    const inscripcionesRef = collection(db, "torneos", torneoId, "inscripciones");
    const q = query(inscripcionesRef, where("estado", "==", "inscrito"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log(`🔄 Actualizando inscripciones del torneo ${torneoId} en tiempo real...`);
        
        // Actualizar contador en la UI
        updateTorneoInscripcionesCount(torneoId, snapshot.size);
        
        // Si hay un modal abierto de este torneo, actualizarlo
        const modal = document.getElementById('inscritosModal');
        if (modal && modal.dataset.torneoId === torneoId) {
            updateInscritosModal(torneoId, snapshot);
        }
    }, (error) => {
        console.error(`❌ Error en listener de inscripciones para torneo ${torneoId}:`, error);
    });

    inscripcionesListeners.set(torneoId, unsubscribe);
}

// Configurar listener en tiempo real para el estado de asistencia del usuario actual
function setupUserAttendanceListener(torneoId, userId) {
    const userInscriptionRef = doc(db, "torneos", torneoId, "inscripciones", userId);
    
    const unsubscribe = onSnapshot(userInscriptionRef, (snapshot) => {
        if (snapshot.exists()) {
            const inscriptionData = snapshot.data();
            const asistenciaConfirmada = inscriptionData.asistenciaConfirmada || false;
            
            console.log(`📝 Estado de asistencia del usuario en ${torneoId}: ${asistenciaConfirmada}`);
            
            // Actualizar botones en tiempo real
            updateCheckInButtonsUI(torneoId, asistenciaConfirmada);
        }
    }, (error) => {
        console.warn(`Advertencia en listener de asistencia para torneo ${torneoId}:`, error);
    });
    
    inscripcionesListeners.set(`${torneoId}-attendance-${userId}`, unsubscribe);
}

// Actualizar UI de botones de check-in en tiempo real
function updateCheckInButtonsUI(torneoId, asistenciaConfirmada) {
    const container = document.getElementById("torneos-checkin");
    if (!container) return;
    
    // Buscar los botones del torneo específico
    const allCheckInBtns = container.querySelectorAll('.check-in-btn');
    const allCancelBtns = container.querySelectorAll('.cancel-checkin-btn');
    
    let found = false;
    
    // Buscar botones por data-torneo-id
    allCheckInBtns.forEach(btn => {
        if (btn.getAttribute('data-torneo-id') === torneoId) {
            btn.style.display = asistenciaConfirmada ? 'none' : 'block';
            found = true;
        }
    });
    
    allCancelBtns.forEach(btn => {
        if (btn.getAttribute('data-torneo-id') === torneoId) {
            btn.style.display = asistenciaConfirmada ? 'block' : 'none';
            found = true;
        }
    });
    
    if (found) {
        console.log(`✓ Botón de ${torneoId} actualizado: ${asistenciaConfirmada ? 'Cancelar' : 'Hacer'} Check-in`);
    } else {
        console.log(`⚠ Botones no encontrados para ${torneoId}, esperando re-render...`);
    }
}

// Actualizar contador de inscripciones en la UI
function updateTorneoInscripcionesCount(torneoId, count) {
    const torneoCards = document.querySelectorAll(`.tournament-card`);
    
    torneoCards.forEach(card => {
        const verInscritosBtn = card.querySelector(`[data-torneo-id="${torneoId}"]`);
        if (verInscritosBtn) {
            const participantesSpan = card.querySelector('.fas.fa-users').nextElementSibling;
            if (participantesSpan) {
                participantesSpan.textContent = `${count} participante${count !== 1 ? 's' : ''}`;
            }
        }
    });
}

// Actualizar modal de inscritos en tiempo real
async function updateInscritosModal(torneoId, snapshot) {
    const inscritos = [];
    snapshot.forEach(doc => {
        inscritos.push({
            id: doc.id,
            ...doc.data()
        });
    });

    const confirmados = inscritos.filter(inscrito => inscrito.asistenciaConfirmada);
    const noConfirmados = inscritos.filter(inscrito => !inscrito.asistenciaConfirmada);

    // Actualizar contadores
    const totalElement = document.querySelector('#inscritosModal .text-blue-800');
    const confirmadosElement = document.querySelector('#inscritosModal .text-green-800');
    const pendientesElement = document.querySelector('#inscritosModal .text-yellow-800');

    if (totalElement) totalElement.textContent = inscritos.length;
    if (confirmadosElement) confirmadosElement.textContent = confirmados.length;
    if (pendientesElement) pendientesElement.textContent = noConfirmados.length;

    const modal = document.getElementById('inscritosModal');
    if (modal) {
        populateInscritosModalTabs(modal, inscritos, confirmados, noConfirmados);
    }
}

// Renderizar torneos por estado (función auxiliar para reutilizar código)
async function renderTorneosPorEstado(torneosPorEstado, containers) {
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

            // Formatear fecha y hora en zona local del usuario
            let fechaFormateada = 'Fecha TBD';
            let horaFormateada = '';
            
            if (torneo.fechaHora) {
                // Si el torneo tiene el nuevo campo fechaHora (UTC)
                fechaFormateada = formatDateTimeInLocalZone(torneo.fechaHora, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                horaFormateada = formatDateTimeInLocalZone(torneo.fechaHora, {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            } else if (torneo.fecha) {
                // Compatibilidad con torneos existentes que tienen fecha separada
                const fechaTorneo = new Date(torneo.fecha.seconds * 1000);
                fechaFormateada = fechaTorneo.toLocaleDateString('es-ES', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                if (torneo.hora) {
                    horaFormateada = torneo.hora;
                }
            }

            let bannerHtml;
            if (torneo.bannerUrl) {
                bannerHtml = `<img src="${torneo.bannerUrl}" alt="Banner ${torneo.nombre}" class="w-full h-full object-cover" loading="lazy"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`;
            } else {
                bannerHtml = '';
            }

            return `
                <div class="bg-white rounded-lg shadow-lg overflow-hidden tournament-card hover:shadow-xl transition-shadow duration-300" data-torneo-id="${torneo.id}">
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
                                ${horaFormateada ? `<br><i class="fas fa-clock mr-1"></i>${horaFormateada}` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="p-4">
                        <h4 class="font-bold text-gray-800 mb-2 text-lg">${torneo.nombre || "Torneo sin nombre"}</h4>
                        <p class="text-gray-600 text-sm mb-3 line-clamp-2">${torneo.descripcion || "Sin descripción disponible"}</p>
                        ${horaFormateada ? `
                            <div class="flex items-center text-xs text-gray-500 mb-3">
                                <i class="fas fa-globe-americas mr-1"></i>
                                <span>Horario en tu zona: ${horaFormateada} - ${getTimeZoneName()}</span>
                            </div>
                        ` : ''}
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
                        ? (currentUser && isInscrito
                            ? `<div class="flex flex-col gap-2">
                                <button class="check-in-btn bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition ${torneo.asistenciaConfirmada ? 'hidden' : ''}"
                                            data-torneo-id="${torneo.id}"
                                            style="display: ${torneo.asistenciaConfirmada ? 'none' : 'block'}">
                                            <i class="fas fa-check-circle mr-2"></i>Hacer Check-in
                                        </button>
                                <button class="cancel-checkin-btn bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700 transition ${!torneo.asistenciaConfirmada ? 'hidden' : ''}"
                                            data-torneo-id="${torneo.id}"
                                            style="display: ${torneo.asistenciaConfirmada ? 'block' : 'none'}">
                                            <i class="fas fa-times-circle mr-2"></i>Cancelar Check-in
                                        </button>
                            </div>`
                            : `<button class="login-required-btn bg-gray-400 text-white py-2 px-4 rounded-lg font-semibold cursor-not-allowed">
                                            Check-in disponible solo para inscritos
                                        </button>`
                        )
                        : (estado === "En Progreso" || estado === "Finalizado") && torneo.bracketsLink
                            ? `<a href="${torneo.bracketsLink}" target="_blank" rel="noopener noreferrer" class="inline-block bg-purple-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-purple-700 transition text-center">
                                    <i class="fas fa-bracket-square mr-2"></i>Ver Brackets
                                </a>`
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
        // --- Paso 1: Obtener el gameUsername del usuario ---
        const inscriptionSnapshot = await getDoc(userInscriptionRef);
        if (!inscriptionSnapshot.exists()) {
            showNotification("No se encontró tu inscripción", "error");
            return;
        }
        const gameUsername = inscriptionSnapshot.data().gameUsername;
        
        // --- Paso 2: Actualizar la asistencia del usuario en la subcolección ---
        await updateDoc(userInscriptionRef, {
            asistenciaConfirmada: true,
            updatedAt: new Date()
        });
        
        // --- Paso 3: Obtener el nombre del torneo ---
        const torneoDocRef = doc(db, "torneos", torneoId);
        const torneoDoc = await getDoc(torneoDocRef);
        let nombreTorneo = "Torneo Desconocido";

        if (torneoDoc.exists()) {
            nombreTorneo = torneoDoc.data().nombre;
        }

        // --- Paso 4: Actualizar el perfil del usuario ---
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
        
        // --- Paso 5: Agregar participante a Challonge ---
        if (gameUsername) {
            await addParticipantToChallonge(torneoId, gameUsername);
        }
        
        showNotification("Asistencia confirmada. ¡Bienvenido al torneo!", "success");
        // Los torneos se actualizarán automáticamente por el listener en tiempo real

    } catch (error) {
        console.error("Error al confirmar asistencia:", error);
        showNotification(`Error al confirmar asistencia: ${error.message}`, "error");
    }
}

// Cancelar check-in (revertir asistencia)
async function cancelAttendance(torneoId) {
    if (!currentUser) {
        showNotification("Debes iniciar sesión para cancelar tu check-in.", "error");
        return;
    }

    const userInscriptionRef = doc(db, "torneos", torneoId, "inscripciones", currentUser.uid);
    const userRef = doc(db, "usuarios", currentUser.uid);

    try {
        // --- Paso 1: Obtener el gameUsername del usuario ---
        const inscriptionSnapshot = await getDoc(userInscriptionRef);
        if (!inscriptionSnapshot.exists()) {
            showNotification("No se encontró tu inscripción", "error");
            return;
        }
        const gameUsername = inscriptionSnapshot.data().gameUsername;
        
        // --- Paso 2: Revertir la asistencia del usuario en la subcolección ---
        await updateDoc(userInscriptionRef, {
            asistenciaConfirmada: false,
            updatedAt: new Date()
        });
        
        // --- Paso 3: Obtener el nombre del torneo ---
        const torneoDocRef = doc(db, "torneos", torneoId);
        const torneoDoc = await getDoc(torneoDocRef);
        let nombreTorneo = "Torneo Desconocido";

        if (torneoDoc.exists()) {
            nombreTorneo = torneoDoc.data().nombre;
        }

        // --- Paso 4: Actualizar el perfil del usuario (remover el torneo del array) ---
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Si existe el array de torneos, remover este torneo
            if (Array.isArray(userData.torneos)) {
                await updateDoc(userRef, {
                    torneos: userData.torneos.filter(t => t !== nombreTorneo)
                });
            }
        }
        
        // --- Paso 5: Remover participante de Challonge ---
        if (gameUsername) {
            await removeParticipantFromChallonge(torneoId, gameUsername);
        }
        
        showNotification("Check-in cancelado. ¡Esperamos verte en el próximo torneo!", "info");
        // Los torneos se actualizarán automáticamente por el listener en tiempo real

    } catch (error) {
        console.error("Error al cancelar check-in:", error);
        showNotification(`Error al cancelar check-in: ${error.message}`, "error");
    }
}

// Agregar participante a Challonge
async function addParticipantToChallonge(torneoId, gameUsername) {
    try {
        // Obtener datos del torneo
        const torneoDocRef = doc(db, "torneos", torneoId);
        const torneoDoc = await getDoc(torneoDocRef);
        
        if (!torneoDoc.exists()) {
            return;
        }
        
        const torneoData = torneoDoc.data();
        
        // Verificar que esté vinculado con Challonge
        if (!torneoData.challonge || !torneoData.challonge.slug || !torneoData.challonge.apiKey) {
            return;
        }
        
        const { slug, apiKey } = torneoData.challonge;
        
        console.log(`📤 Intentando agregar a Challonge:`, { slug, gameUsername });
        
        const url = `https://api.challonge.com/v1/tournaments/${slug}/participants.json`;
        
        const params = new URLSearchParams({
            'api_key': apiKey,
            'participant[name]': gameUsername
        });
        
        // Fire and forget (sin esperar respuesta)
        fetch(url, {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).then(response => {
            if (response.ok) {
                console.log('✓ Participante agregado a Challonge:', gameUsername);
            }
        }).catch(error => {
            console.log('📌 Nota: Sincronización con Challonge en progreso...');
        });
        
    } catch (error) {
        console.log('⚠ Error preparando sincronización Challonge:', error.message);
    }
}

// Remover participante de Challonge
async function removeParticipantFromChallonge(torneoId, gameUsername) {
    try {
        // Obtener datos del torneo
        const torneoDocRef = doc(db, "torneos", torneoId);
        const torneoDoc = await getDoc(torneoDocRef);
        
        if (!torneoDoc.exists()) {
            console.log("❌ Torneo no encontrado en Firestore");
            return;
        }
        
        const torneoData = torneoDoc.data();
        
        // Verificar que esté vinculado con Challonge
        if (!torneoData.challonge || !torneoData.challonge.slug || !torneoData.challonge.apiKey) {
            console.log("❌ Torneo no vinculado con Challonge");
            return;
        }
        
        const { slug, apiKey } = torneoData.challonge;
        
        console.log(`📤 Intentando remover de Challonge:`, { slug, gameUsername });
        
        // Paso 1: Obtener lista de participantes
        const participantsUrl = `https://api.challonge.com/v1/tournaments/${slug}/participants.json?api_key=${apiKey}`;
        
        console.log(`🔍 Obteniendo participantes de: ${slug}`);
        
        // Usar proxy local para CORS
        const proxyUrl = `http://localhost:3000?url=${encodeURIComponent(participantsUrl)}`;
        
        try {
            const participantsResponse = await fetch(proxyUrl);
            
            if (!participantsResponse.ok) {
                console.log(`❌ Error obteniendo participantes: ${participantsResponse.status}`);
                return;
            }
            
            const participants = await participantsResponse.json();
            console.log(`📋 Total de participantes encontrados: ${participants.length}`);
            console.log(`📋 Buscando participante con nombre: "${gameUsername}"`);
            
            // Buscar el participante por nombre (case-insensitive)
            const participant = participants.find(p => {
                const pName = p.participant.name.toLowerCase();
                const searchName = gameUsername.toLowerCase();
                console.log(`  - Comparando: "${pName}" === "${searchName}"? ${pName === searchName}`);
                return pName === searchName;
            });
            
            if (!participant) {
                console.log(`⚠️ Participante "${gameUsername}" no encontrado en Challonge`);
                console.log(`Participantes disponibles:`, participants.map(p => p.participant.name));
                return;
            }
            
            console.log(`✓ Participante encontrado:`, participant.participant);
            
            // Paso 2: Remover participante
            const participantId = participant.participant.id;
            const deleteUrl = `https://api.challonge.com/v1/tournaments/${slug}/participants/${participantId}.json?api_key=${apiKey}`;
            
            console.log(`🗑️ Removiendo participante ID: ${participantId}`);
            
            const proxyDeleteUrl = `http://localhost:3000?url=${encodeURIComponent(deleteUrl)}`;
            
            const deleteResponse = await fetch(proxyDeleteUrl, { method: 'DELETE' });
            
            if (deleteResponse.ok) {
                console.log('✓ Participante removido exitosamente de Challonge:', gameUsername);
            } else {
                console.log(`❌ Error al remover: ${deleteResponse.status} ${deleteResponse.statusText}`);
                const responseText = await deleteResponse.text();
                console.log(`Respuesta: ${responseText}`);
            }
        } catch (proxyError) {
            console.log('⚠️ Error de conexión con proxy local. ¿Está corriendo "node cors-proxy.js"?');
            console.log('Detalle:', proxyError.message);
        }
        
    } catch (error) {
        console.log('❌ Error en removeParticipantFromChallonge:', error.message);
    }
}

// Manejar inscripción (usando subcolecciones)
async function handleInscription(e) {
    e.preventDefault();

    const form = e.target;
    const torneoId = form.dataset.torneoId;
    const gameCategory = form.dataset.gameCategory || 'general';
    const rankCap = form.dataset.rankCap || '';
    const gameUsername = document.getElementById('gameUsername').value.trim();
    const discordInputValue = document.getElementById('discordUsername').value.trim();

    // Validaciones
    if (!gameUsername) {
        showNotification('El nombre de juego es obligatorio', 'error');
        return;
    }

    const profile = await getCurrentUserProfileData();
    const resolvedDiscordUsername = discordInputValue || profile?.data?.discord?.username || '';

    let tetrioAccount = null;
    if (gameCategory === 'tetrio') {
        const linkedTetrioAccount = profile?.data?.gameAccounts?.tetrio || null;

        if (linkedTetrioAccount?.username && linkedTetrioAccount.username.toLowerCase() === gameUsername.toLowerCase()) {
            tetrioAccount = linkedTetrioAccount;
        } else {
            try {
                tetrioAccount = await lookupTetrioAccountForRegistration(gameUsername);
            } catch (lookupError) {
                if (rankCap) {
                    showNotification(`No se pudo validar tu cuenta de TETR.IO para aplicar el rank cap: ${lookupError.message}`, 'error');
                    return;
                }
                console.warn('No se pudo validar TETR.IO en este momento:', lookupError);
            }
        }
    }

    if (!resolvedDiscordUsername) {
        showNotification('El Discord es obligatorio', 'error');
        return;
    }

    if (resolvedDiscordUsername.length < 2 || resolvedDiscordUsername.length > 50) {
        showNotification('El nombre de Discord debe tener entre 2 y 50 caracteres', 'error');
        return;
    }

    if (gameCategory === 'tetrio' && rankCap) {
        const detectedRank = tetrioAccount?.rank;

        if (!detectedRank) {
            showNotification('No se pudo verificar el rango de TETR.IO para este torneo.', 'error');
            return;
        }

        if (compareTetrioRanks(detectedRank, rankCap) > 0) {
            showNotification(`Tu rango de TETR.IO (${formatTetrioRank(detectedRank)}) supera el rank cap permitido (${formatTetrioRank(rankCap)}).`, 'error');
            return;
        }
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
            juego: gameCategory,
            gameUsername: gameUsername,
            discordUsername: resolvedDiscordUsername,
            gameRank: tetrioAccount?.rank || null,
            gameRankIconUrl: tetrioAccount?.rank ? getTetrioRankIconUrl(tetrioAccount.rank) : null,
            gameTr: typeof tetrioAccount?.tr === 'number' ? tetrioAccount.tr : null,
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

        await persistTournamentGameAccount(gameCategory, gameUsername, tetrioAccount);

        showNotification('¡Inscripción exitosa! Te has registrado en el torneo.', 'success');
        closeInscriptionModal();
        await setupRealTimeTournaments();
        // Los torneos se actualizarán automáticamente por el listener en tiempo real

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
        await setupRealTimeTournaments();
        // Los torneos se actualizarán automáticamente por el listener en tiempo real

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
                            ? (currentUser && isInscrito
                                ? `<div class="flex flex-col gap-2">
                                <button class="check-in-btn bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition ${torneo.asistenciaConfirmada ? 'hidden' : ''}"
                                            data-torneo-id="${torneo.id}"
                                            style="display: ${torneo.asistenciaConfirmada ? 'none' : 'block'}">
                                            <i class="fas fa-check-circle mr-2"></i>Hacer Check-in
                                            </button>
                                <button class="cancel-checkin-btn bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700 transition ${!torneo.asistenciaConfirmada ? 'hidden' : ''}"
                                            data-torneo-id="${torneo.id}"
                                            style="display: ${torneo.asistenciaConfirmada ? 'block' : 'none'}">
                                            <i class="fas fa-times-circle mr-2"></i>Cancelar Check-in
                                            </button>
                            </div>`
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
        modal.dataset.torneoId = torneoId; // Añadir dataset para identificar el torneo

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
        populateInscritosModalTabs(modal, inscritos, confirmados, noConfirmados);

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
async function openInscriptionModal(torneoId, torneoNombre) {
    const modal = document.getElementById('inscriptionModal');
    if (!modal) {
        console.error('Modal de inscripción no encontrado');
        return;
    }

    document.getElementById('modalTournamentName').textContent = torneoNombre;
    document.getElementById('inscriptionForm').dataset.torneoId = torneoId;
    await configureInscriptionModalForTournament(torneoId);

    modal.classList.remove('hidden');
}

function renderTetrioBadge(inscrito) {
    if (!inscrito.gameRank) {
        return '';
    }

    return `
        <div class="flex items-center gap-2 mt-1">
            <img src="${inscrito.gameRankIconUrl || getTetrioRankIconUrl(inscrito.gameRank)}" alt="Rango ${formatTetrioRank(inscrito.gameRank)}" class="w-6 h-6 object-contain">
            <span class="text-xs font-semibold text-gray-700">${formatTetrioRank(inscrito.gameRank)}</span>
            <span class="text-xs text-blue-600">TR: ${formatTetrioTr(inscrito.gameTr)}</span>
        </div>
    `;
}

function renderInscritoRow(inscrito, index, variant = 'all') {
    const variantClass = variant === 'confirmed'
        ? 'bg-green-50 border-green-400'
        : variant === 'pending'
            ? 'bg-yellow-50 border-yellow-400'
            : `${inscrito.asistenciaConfirmada ? 'bg-gray-50 border-green-400' : 'bg-gray-50 border-red-400'}`;
    const statusBadge = variant === 'confirmed'
        ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Confirmado</span>'
        : variant === 'pending'
            ? '<span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Pendiente</span>'
            : `<span class="text-xs px-2 py-1 rounded ${inscrito.asistenciaConfirmada ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
                    <i class="fas fa-${inscrito.asistenciaConfirmada ? 'check-circle' : 'clock'} mr-1"></i>
                    ${inscrito.asistenciaConfirmada ? 'Confirmado' : 'Pendiente'}
               </span>`;

    return `
        <div class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors border-l-4 ${variantClass}">
            <div class="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold text-sm">
                ${index + 1}
            </div>
            <img src="${inscrito.userPhoto || 'dtowin.png'}" alt="Avatar" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow">
            <div class="flex-1">
                <div class="flex items-center gap-2">
                    <p class="font-semibold text-gray-800">${inscrito.userName}</p>
                    ${inscrito.userId === currentUser?.uid ? '<span class="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">Tú</span>' : ''}
                    ${statusBadge}
                </div>
                <p class="text-sm text-gray-600">
                    <i class="fas fa-gamepad mr-1"></i>${inscrito.gameUsername || 'No especificado'}
                </p>
                ${inscrito.juego === 'tetrio' ? renderTetrioBadge(inscrito) : ''}
                <p class="text-sm text-purple-600">
                    <i class="fab fa-discord mr-1"></i>${inscrito.discordUsername || 'No especificado'}
                </p>
            </div>
            <div class="text-right text-xs text-gray-500">
                <div>Inscrito: ${new Date(inscrito.fechaInscripcion.seconds * 1000).toLocaleDateString()}</div>
                ${inscrito.asistenciaConfirmada && inscrito.fechaConfirmacion ? `<div class="text-green-600">Confirmado: ${new Date(inscrito.fechaConfirmacion.seconds * 1000).toLocaleDateString()}</div>` : ''}
            </div>
        </div>
    `;
}

function populateInscritosModalTabs(root, inscritos, confirmados, noConfirmados) {
    const todosTab = root.querySelector('#tab-todos');
    const confirmadosTab = root.querySelector('#tab-confirmados');
    const pendientesTab = root.querySelector('#tab-pendientes');

    if (todosTab) {
        todosTab.innerHTML = `
            <div class="space-y-3">
                ${inscritos.map((inscrito, index) => renderInscritoRow(inscrito, index, 'all')).join('')}
            </div>
        `;
    }

    if (confirmadosTab) {
        confirmadosTab.innerHTML = confirmados.length === 0
            ? `
                <div class="text-center text-gray-500 py-4">
                    <i class="fas fa-check-circle text-3xl text-gray-300 mb-2"></i>
                    <p>Aún no hay asistencias confirmadas</p>
                </div>
            `
            : `
                <div class="space-y-3">
                    ${confirmados.map((inscrito, index) => renderInscritoRow(inscrito, index, 'confirmed')).join('')}
                </div>
            `;
    }

    if (pendientesTab) {
        pendientesTab.innerHTML = noConfirmados.length === 0
            ? `
                <div class="text-center text-gray-500 py-4">
                    <i class="fas fa-check-circle text-3xl text-green-300 mb-2"></i>
                    <p>¡Todos han confirmado su asistencia!</p>
                </div>
            `
            : `
                <div class="space-y-3">
                    ${noConfirmados.map((inscrito, index) => renderInscritoRow(inscrito, index, 'pending')).join('')}
                </div>
            `;
    }
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

    document.querySelectorAll('.cancel-checkin-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const torneoId = e.currentTarget.dataset.torneoId;
            if (confirm('¿Estás seguro de que deseas cancelar tu check-in? Tendrás que hacer check-in de nuevo para confirmar tu asistencia.')) {
                cancelAttendance(torneoId);
            }
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
        leaderboardContainer.innerHTML = '<div class="text-center text-gray-300 p-4">Cargando leaderboard...</div>';

        // Obtener todos los usuarios
        const usuariosRef = collection(db, "usuarios");
        const q = query(usuariosRef, orderBy("puntos", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            leaderboardContainer.innerHTML = '<div class="text-center text-gray-300 p-4">No hay datos de leaderboard disponibles</div>';
            return;
        }

        // Tomar solo los top 10
        const topUsuarios = snapshot.docs.slice(0, 10).map(doc => ({
            ...doc.data(),
            uid: doc.data().uid || doc.id
        }));

        // Cargar banners para los usuarios que los tengan
        const bannerMap = new Map();
        for (const usuario of topUsuarios) {
            if (usuario.bannerId) {
                try {
                    const bannerDoc = await getDoc(doc(db, "banners", usuario.bannerId));
                    if (bannerDoc.exists()) {
                        const bannerData = bannerDoc.data();
                        bannerMap.set(usuario.uid, bannerData.imageUrl || bannerData.imageData);
                    }
                } catch (error) {
                    console.warn(`Error cargando banner para ${usuario.nombre}:`, error);
                }
            }
        }

        const leaderboardHTML = topUsuarios.map((usuario, index) => {
            const position = index + 1;
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
            const nombre = usuario.nombre || usuario.displayName || usuario.email;
            const bannerImage = bannerMap.get(usuario.uid);

            let badges = 0;
            if (usuario.badges && typeof usuario.badges === "object" && !Array.isArray(usuario.badges)) {
                badges = Object.keys(usuario.badges).length;
            } else if (typeof usuario.badges === "number") {
                badges = usuario.badges;
            }

            return `
                <a href="perfil.html?uid=${encodeURIComponent(usuario.uid)}" class="block hover:bg-gray-800 rounded-lg transition group">
                    <div class="flex items-center justify-between p-3 bg-gray-800 rounded-lg shadow mb-2 group-hover:shadow-lg border border-gray-700 relative overflow-hidden">
                        ${bannerImage ? `<div style="position: absolute; left: 0; top: 0; bottom: 0; width: 200px; opacity: 0.4; background: url('${bannerImage}') center/cover no-repeat; clip-path: polygon(0% 0%, 100% 0%, 70% 100%, 0% 100%); transition: opacity 0.3s ease;"></div>` : ''}
                        <div class="flex items-center gap-3 relative z-10">
                            <span class="font-bold text-lg ${position <= 3 ? 'text-yellow-400' : 'text-gray-400'}">${medal} #${position}</span>
                            <img src="${usuario.photoURL || 'dtowin.png'}" alt="Avatar" class="w-10 h-10 rounded-full object-cover">
                            <div>
                                <p class="font-semibold text-white group-hover:text-blue-300">${nombre}</p>
                            </div>
                        </div>
                        <div class="text-right relative z-10">
                            <p class="font-bold text-blue-400">${usuario.puntos || 0} pts</p>
                            <p class="text-xs text-gray-400">${badges} badges</p>
                        </div>
                    </div>
                </a>
            `;
        }).join('');

        leaderboardContainer.innerHTML = leaderboardHTML;

    } catch (error) {
        console.error('Error cargando leaderboard:', error);
        leaderboardContainer.innerHTML = '<div class="text-center text-red-400 p-4">Error al cargar el leaderboard</div>';
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
    console.log("🚀 Inicializando index-torneos...");
    
    onAuthStateChanged(auth, (user) => {
        console.log("👤 Estado de autenticación cambiado:", !!user);
        updateAuthUI(user);
        // Solo configurar una vez cuando cambie el estado de auth
        if (!torneosListener) {
            setupRealTimeTournaments();
        }
    });

    // Configurar solo una vez al cargar
    setupRealTimeTournaments();
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
