// perfil.js - Script para la gestión del perfil de usuario
import { auth, db } from './firebase.js';
import { 
    doc, 
    getDoc, 
    collection, 
    query, 
    where, 
    getDocs,
    orderBy,
    limit 
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Función para cargar perfil
export async function loadProfile() {
    try {
        console.log("Cargando perfil...");
        
        // Verificar si hay un userId en la URL (para perfiles públicos)
        const urlParams = new URLSearchParams(window.location.search);
        const requestedUid = urlParams.get('uid');
        
        // Si hay un userId en la URL, cargamos ese perfil
        // Si no, intentamos cargar el perfil del usuario autenticado
        const currentUser = auth.currentUser;
        
        if (!requestedUid && !currentUser) {
            // No hay perfil para mostrar, redirigir al inicio
            console.log("No hay perfil para mostrar, redirigiendo...");
            showLoginRequired();
            return;
        }
        
        // Determinar qué UID usar para cargar el perfil
        const uidToLoad = requestedUid || currentUser.uid;
        console.log("Cargando perfil con UID:", uidToLoad);
        
        // Obtener datos del usuario
        const usersRef = collection(db, "usuarios");
        const q = query(usersRef, where("uid", "==", uidToLoad));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            console.error("No se encontró el perfil del usuario");
            showProfileNotFound();
            return;
        }
        
        // Obtener datos del perfil
        const userData = querySnapshot.docs[0].data();
        console.log("Datos del usuario:", userData);
        
        // Actualizar información del perfil
        updateProfileInfo(userData);
        
        // Cargar badges del usuario
        await loadUserBadges(userData);
        
        // Cargar historial de torneos
        await loadUserTournaments(userData);
        
        // Si es el propio perfil del usuario, mostrar opciones adicionales
        if (!requestedUid && currentUser) {
            showProfileOptions();
        } else {
            hideProfileOptions();
        }
        
    } catch (error) {
        console.error("Error al cargar perfil:", error);
        showProfileError();
    }
}

// Mostrar mensaje cuando se requiere inicio de sesión
function showLoginRequired() {
    const profileContainer = document.getElementById('profileContainer');
    
    if (profileContainer) {
        profileContainer.innerHTML = `
            <div class="text-center py-8">
                <div class="bg-blue-50 rounded-lg p-6 max-w-md mx-auto">
                    <i class="fas fa-user-lock text-blue-500 text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Inicia sesión para ver tu perfil</h3>
                    <p class="text-gray-600 mb-4">Para ver tu perfil personal, necesitas iniciar sesión en tu cuenta.</p>
                    <button id="loginPromptBtn" class="dtowin-primary text-white px-5 py-2 rounded-lg font-semibold hover:opacity-90 transition">
                        Iniciar Sesión
                    </button>
                    <p class="text-sm text-gray-500 mt-4">¿No tienes cuenta? <a href="#" id="registerPromptBtn" class="text-blue-500 hover:underline">Regístrate</a></p>
                </div>
            </div>
        `;
        
        // Configurar botones
        const loginPromptBtn = document.getElementById('loginPromptBtn');
        const registerPromptBtn = document.getElementById('registerPromptBtn');
        
        if (loginPromptBtn) {
            loginPromptBtn.addEventListener('click', () => {
                const loginBtn = document.getElementById('loginBtn');
                if (loginBtn) loginBtn.click();
            });
        }
        
        if (registerPromptBtn) {
            registerPromptBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const registerBtn = document.getElementById('registerBtn');
                if (registerBtn) registerBtn.click();
            });
        }
    }
}

// Mostrar mensaje cuando no se encuentra el perfil
function showProfileNotFound() {
    const profileContainer = document.getElementById('profileContainer');
    
    if (profileContainer) {
        profileContainer.innerHTML = `
            <div class="text-center py-8">
                <div class="bg-yellow-50 rounded-lg p-6 max-w-md mx-auto">
                    <i class="fas fa-user-slash text-yellow-500 text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Perfil no encontrado</h3>
                    <p class="text-gray-600 mb-4">Lo sentimos, no pudimos encontrar el perfil que estás buscando.</p>
                    <a href="index.html" class="dtowin-blue text-white px-5 py-2 rounded-lg font-semibold hover:opacity-90 transition inline-block">
                        Volver al inicio
                    </a>
                </div>
            </div>
        `;
    }
}

// Mostrar mensaje de error
function showProfileError() {
    const profileContainer = document.getElementById('profileContainer');
    
    if (profileContainer) {
        profileContainer.innerHTML = `
            <div class="text-center py-8">
                <div class="bg-red-50 rounded-lg p-6 max-w-md mx-auto">
                    <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Error al cargar perfil</h3>
                    <p class="text-gray-600 mb-4">Ocurrió un error al intentar cargar el perfil. Por favor, intenta de nuevo más tarde.</p>
                    <button onclick="window.location.reload()" class="dtowin-blue text-white px-5 py-2 rounded-lg font-semibold hover:opacity-90 transition">
                        Reintentar
                    </button>
                </div>
            </div>
        `;
    }
}

// Actualizar información del perfil
function updateProfileInfo(userData) {
    // Actualizar nombre de usuario
    const profileUsername = document.getElementById('profileUsername');
    if (profileUsername) {
        profileUsername.textContent = userData.nombre || 'Usuario';
    }
    
    // Actualizar foto de perfil
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.src = userData.photoURL || 'dtowin.png';
        profileAvatar.alt = userData.nombre || 'Usuario';
    }
    
    // Actualizar datos estadísticos
    updateProfileStats(userData);
}

// Actualizar estadísticas del perfil
function updateProfileStats(userData) {
    // Puntos totales
    const profilePoints = document.getElementById('profilePoints');
    if (profilePoints) {
        profilePoints.textContent = userData.puntos || 0;
    }
    
    // Torneos jugados
    const profileTournaments = document.getElementById('profileTournaments');
    if (profileTournaments) {
        profileTournaments.textContent = userData.torneos ? userData.torneos.length : 0;
    }
    
    // Victorias
    const profileWins = document.getElementById('profileWins');
    if (profileWins) {
        profileWins.textContent = userData.victorias || 0;
    }
    
    // Posición en el ranking
    const profileRanking = document.getElementById('profileRanking');
    if (profileRanking) {
        if (userData.ranking) {
            profileRanking.textContent = `#${userData.ranking}`;
        } else {
            // Si no tiene ranking definido, poner "Sin clasificar"
            profileRanking.textContent = "Sin clasificar";
        }
    }
}

// Cargar badges del usuario
async function loadUserBadges(userData) {
    const badgesContainer = document.getElementById('userBadges');
    if (!badgesContainer) return;
    
    // Mostrar indicador de carga
    badgesContainer.innerHTML = `
        <div class="text-center p-4">
            <div class="spinner w-6 h-6 border-t-2 border-b-2 border-blue-500 rounded-full mx-auto mb-2"></div>
            <p class="text-sm text-gray-500">Cargando badges...</p>
        </div>
    `;
    
    try {
        // Si el usuario no tiene badges, mostrar mensaje
        if (!userData.badges || Object.keys(userData.badges).length === 0) {
            badgesContainer.innerHTML = `
                <div class="text-center p-4">
                    <p class="text-gray-500">Este usuario no tiene badges todavía</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">';
        
        // Obtener datos de cada badge
        const badgeIds = Object.keys(userData.badges);
        
        for (const badgeId of badgeIds) {
            try {
                const badgeRef = doc(db, "badges", badgeId);
                const badgeSnap = await getDoc(badgeRef);
                
                if (badgeSnap.exists()) {
                    const badgeData = badgeSnap.data();
                    
                    // Determinar la fuente de la imagen
                    const imageSource = badgeData.imageUrl || badgeData.imageData;
                    
                    // Si hay imagen, mostrarla; si no, usar un icono
                    let badgeImage;
                    if (imageSource) {
                        badgeImage = `<img src="${imageSource}" alt="${badgeData.nombre}" class="w-16 h-16 object-cover rounded-full mx-auto mb-2">`;
                    } else {
                        badgeImage = `
                            <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2" style="background-color: ${badgeData.color || '#ff6b1a'}">
                                <i class="fas fa-${badgeData.icono || 'trophy'} text-white text-xl"></i>
                            </div>
                        `;
                    }
                    
                    html += `
                        <div class="bg-white p-3 rounded-lg shadow text-center">
                            ${badgeImage}
                            <h4 class="font-semibold text-gray-800">${badgeData.nombre || 'Badge'}</h4>
                            <p class="text-xs text-gray-500">${badgeData.descripcion || ''}</p>
                        </div>
                    `;
                }
            } catch (error) {
                console.error(`Error al cargar badge ${badgeId}:`, error);
            }
        }
        
        html += '</div>';
        badgesContainer.innerHTML = html;
        
    } catch (error) {
        console.error("Error al cargar badges:", error);
        badgesContainer.innerHTML = `
            <div class="text-center p-4">
                <p class="text-red-500">Error al cargar badges. <button class="text-blue-500 underline" onclick="window.location.reload()">Reintentar</button></p>
            </div>
        `;
    }
}

// Cargar historial de torneos del usuario
async function loadUserTournaments(userData) {
    const tournamentsContainer = document.getElementById('userTournaments');
    if (!tournamentsContainer) return;
    
    // Mostrar indicador de carga
    tournamentsContainer.innerHTML = `
        <div class="text-center p-4">
            <div class="spinner w-6 h-6 border-t-2 border-b-2 border-blue-500 rounded-full mx-auto mb-2"></div>
            <p class="text-sm text-gray-500">Cargando historial de torneos...</p>
        </div>
    `;
    
    try {
        // Si el usuario no ha participado en torneos, mostrar mensaje
        if (!userData.torneos || userData.torneos.length === 0) {
            tournamentsContainer.innerHTML = `
                <div class="text-center p-4">
                    <p class="text-gray-500">Este usuario no ha participado en torneos todavía</p>
                </div>
            `;
            return;
        }
        
        // Obtener datos de cada torneo
        const torneoIds = userData.torneos;
        const torneosData = [];
        
        for (const torneoId of torneoIds) {
            try {
                const torneoRef = doc(db, "torneos", torneoId);
                const torneoSnap = await getDoc(torneoRef);
                
                if (torneoSnap.exists()) {
                    torneosData.push({
                        id: torneoId,
                        ...torneoSnap.data()
                    });
                }
            } catch (error) {
                console.error(`Error al cargar torneo ${torneoId}:`, error);
            }
        }
        
        // Ordenar por fecha (más reciente primero)
        torneosData.sort((a, b) => {
            const dateA = a.fecha ? new Date(a.fecha.seconds * 1000) : new Date(0);
            const dateB = b.fecha ? new Date(b.fecha.seconds * 1000) : new Date(0);
            return dateB - dateA; // Orden descendente
        });
        
        // Generar HTML
        let html = '<div class="space-y-4">';
        
        torneosData.forEach(torneo => {
            // Formatear fecha
            const fecha = torneo.fecha ? new Date(torneo.fecha.seconds * 1000) : new Date();
            const fechaFormateada = fecha.toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            
            // Determinar clase de estado
            let estadoClass;
            switch (torneo.estado) {
                case 'Finalizado':
                    estadoClass = 'bg-gray-100 text-gray-800';
                    break;
                case 'En Progreso':
                    estadoClass = 'bg-yellow-100 text-yellow-800';
                    break;
                case 'Abierto':
                    estadoClass = 'bg-green-100 text-green-800';
                    break;
                default:
                    estadoClass = 'bg-blue-100 text-blue-800';
            }
            
            // Determinar posición del usuario (si existe)
            let posicionHTML = '';
            if (torneo.resultados && torneo.resultados[userData.uid]) {
                const posicion = torneo.resultados[userData.uid].posicion;
                const puntos = torneo.resultados[userData.uid].puntos || 0;
                
                // Clase para posiciones destacadas
                let posicionClass = '';
                if (posicion === 1) {
                    posicionClass = 'bg-yellow-500 text-white';
                } else if (posicion === 2) {
                    posicionClass = 'bg-gray-400 text-white';
                } else if (posicion === 3) {
                    posicionClass = 'bg-red-500 text-white';
                } else {
                    posicionClass = 'bg-gray-200 text-gray-800';
                }
                
                posicionHTML = `
                    <div class="flex items-center">
                        <span class="${posicionClass} w-8 h-8 rounded-full flex items-center justify-center font-bold mr-2">
                            ${posicion}
                        </span>
                        <span class="text-sm font-medium">${puntos} puntos</span>
                    </div>
                `;
            }
            
            html += `
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-bold text-gray-800">${torneo.nombre || 'Torneo sin nombre'}</h4>
                        <span class="px-2 py-1 rounded text-xs ${estadoClass}">
                            ${torneo.estado || 'Desconocido'}
                        </span>
                    </div>
                    <div class="text-sm text-gray-600 mb-3">
                        <i class="far fa-calendar-alt mr-1"></i> ${fechaFormateada}
                    </div>
                    ${posicionHTML}
                </div>
            `;
        });
        
        html += '</div>';
        tournamentsContainer.innerHTML = html;
        
    } catch (error) {
        console.error("Error al cargar historial de torneos:", error);
        tournamentsContainer.innerHTML = `
            <div class="text-center p-4">
                <p class="text-red-500">Error al cargar historial de torneos. <button class="text-blue-500 underline" onclick="window.location.reload()">Reintentar</button></p>
            </div>
        `;
    }
}

// Mostrar opciones adicionales para el propio perfil
function showProfileOptions() {
    const profileOptionsContainer = document.getElementById('profileOptions');
    if (!profileOptionsContainer) return;
    
    profileOptionsContainer.classList.remove('hidden');
}

// Ocultar opciones adicionales (para perfiles de otros usuarios)
function hideProfileOptions() {
    const profileOptionsContainer = document.getElementById('profileOptions');
    if (!profileOptionsContainer) return;
    
    profileOptionsContainer.classList.add('hidden');
}
