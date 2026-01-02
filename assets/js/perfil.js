// perfil.js - Script para la gestión del perfil de usuario

// Variables globales
let isLoadingProfile = false;
let selectedBannerId = null;
let newProfilePhoto = null;

// Esperar a que Firebase esté disponible globalmente
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM cargado, esperando a que Firebase esté disponible");
    
    // Verificar que Firebase está cargado antes de comenzar
    if (typeof firebase !== 'undefined') {
        console.log("Firebase ya está disponible, inicializando...");
        setupAuthForms();
        initializeProfile();
    } else {
        console.log("Firebase no disponible todavía, configurando intervalo de verificación");
        
        // Comprobar cada 100ms si firebase ya está disponible
        const checkFirebase = setInterval(() => {
            if (typeof firebase !== 'undefined') {
                console.log("Firebase disponible, inicializando...");
                clearInterval(checkFirebase);
                setupAuthForms();
                initializeProfile();
            }
        }, 100);
        
        // Parar después de 5 segundos para evitar un bucle infinito
        setTimeout(() => {
            clearInterval(checkFirebase);
            console.error("Firebase no se pudo cargar después de 5 segundos");
            mostrarNotificacion("Error: No se pudo cargar Firebase", "error");
        }, 5000);
    }
});

// Función principal para inicializar el perfil
function initializeProfile() {
    console.log("Inicializando perfil");
    
    // Inicializar el modal de edición
    initEditProfileModal();
    
    // Configurar eventos de modales de login/registro
    setupAuthModals();
    
    // Configurar menú móvil
    setupMobileMenu();
    
    // Verificar el estado de autenticación y cargar el perfil
    firebase.auth().onAuthStateChanged(user => {
        console.log("Estado de autenticación cambiado:", user ? "Autenticado" : "No autenticado");
        // Actualizar UI del navbar basado en autenticación
        updateAuthUI(user);
        // Siempre renderizar el template y cargar el perfil
        // loadProfile() ya maneja los casos donde no hay autenticación pero hay uid en URL
        renderProfileTemplate();
        loadProfile();
    });
}

// Actualizar UI de autenticación en el navbar
async function updateAuthUI(user) {
    const loginBtn = document.getElementById('loginBtn');
    if (!loginBtn) return;
    
    // Remover event listeners previos
    loginBtn.onclick = null;
    
    if (user) {
        // Usuario autenticado - mostrar perfil y logout
        const userName = user.displayName || user.email.split('@')[0] || 'Usuario';
        loginBtn.innerHTML = `
            <div class="flex items-center gap-2 cursor-pointer" id="userProfile">
                <img src="${user.photoURL || 'assets/img/dtowin.png'}" alt="Perfil" class="w-8 h-8 rounded-full object-cover border-2 border-white">
                <span class="font-semibold">${userName}</span>
                <i class="fas fa-chevron-down text-sm"></i>
            </div>
        `;
        
        // Agregar event listener al botón para manejar clicks en el dropdown
        loginBtn.addEventListener('click', handleUserProfileClick);
        removeUserDropdownProfile();
    } else {
        // Usuario no autenticado - mostrar botón login
        loginBtn.innerHTML = 'Iniciar Sesión';
        loginBtn.onclick = () => {
            const loginModal = document.getElementById('loginModal');
            if (loginModal) {
                loginModal.classList.remove('hidden');
                loginModal.classList.add('flex');
            }
        };
        removeUserDropdownProfile();
    }
}

// Handler para el click en el perfil del usuario
function handleUserProfileClick(e) {
    e.stopPropagation();
    let dropdownMenu = document.getElementById('userDropdownMenuProfile');
    
    if (dropdownMenu) {
        // Toggle existente
        dropdownMenu.classList.toggle('hidden');
        return;
    }
    
    // Crear nuevo dropdown
    dropdownMenu = document.createElement('div');
    dropdownMenu.id = 'userDropdownMenuProfile';
    dropdownMenu.className = 'absolute top-16 right-4 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-40 min-w-max';
    dropdownMenu.innerHTML = `
        <a href="perfil.html" class="block px-4 py-2 text-white hover:bg-gray-700 rounded-t-lg">
            <i class="fas fa-user mr-2"></i>Mi Perfil
        </a>
        <button id="logoutBtnDropdown" class="w-full text-left px-4 py-2 text-white hover:bg-gray-700 rounded-b-lg">
            <i class="fas fa-sign-out-alt mr-2"></i>Cerrar Sesión
        </button>
    `;
    
    const userProfile = document.getElementById('userProfile');
    userProfile.parentElement.style.position = 'relative';
    userProfile.parentElement.appendChild(dropdownMenu);
    
    // Evento logout
    document.getElementById('logoutBtnDropdown').addEventListener('click', async () => {
        try {
            await firebase.auth().signOut();
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            alert("Error al cerrar sesión");
        }
    });
    
    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!userProfile.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.add('hidden');
        }
    });
}

// Crear dropdown para usuario autenticado (perfil page)
function createUserDropdownProfile() {
    removeUserDropdownProfile();
}

// Remover dropdown de usuario (perfil page)
function removeUserDropdownProfile() {
    const dropdownMenu = document.getElementById('userDropdownMenuProfile');
    if (dropdownMenu) {
        dropdownMenu.remove();
    }
}

// Configurar menú móvil
function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }
    
    if (mobileLoginBtn) {
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                // Usuario autenticado - cambiar botón a logout
                mobileLoginBtn.textContent = 'Cerrar Sesión';
                mobileLoginBtn.onclick = async () => {
                    try {
                        await firebase.auth().signOut();
                        mobileMenu.classList.add('hidden');
                        window.location.href = 'index.html';
                    } catch (error) {
                        console.error("Error al cerrar sesión:", error);
                        alert("Error al cerrar sesión");
                    }
                };
            } else {
                // Usuario no autenticado - mostrar login
                mobileLoginBtn.textContent = 'Iniciar Sesión';
                mobileLoginBtn.onclick = () => {
                    const loginModal = document.getElementById('loginModal');
                    if (loginModal) {
                        loginModal.classList.remove('hidden');
                        loginModal.classList.add('flex');
                        mobileMenu.classList.add('hidden');
                    }
                };
            }
        });
    }
}

// Configurar eventos de los modales de login/registro (solo Google)
function setupAuthModals() {
    // Cerrar modal de login
    document.getElementById('closeLoginModal')?.addEventListener('click', () => {
        document.getElementById('loginModal')?.classList.add('hidden');
    });
    
    // Cerrar modal de registro
    document.getElementById('closeRegisterModal')?.addEventListener('click', () => {
        document.getElementById('registroModal')?.classList.add('hidden');
    });
}

// Función principal para cargar perfil
async function loadProfile() {
    try {
        // Evitar cargas múltiples
        if (isLoadingProfile) {
            console.log("Ya se está cargando el perfil, ignorando solicitud duplicada");
            return;
        }
        
        isLoadingProfile = true;
        console.log("Cargando perfil...");
        
        // Verificar si hay un userId en la URL (para perfiles públicos)
        const urlParams = new URLSearchParams(window.location.search);
        const requestedUid = urlParams.get('uid');
        
        // Verificar si el usuario está autenticado
        const currentUser = firebase.auth().currentUser;
        console.log("Estado de autenticación:", currentUser ? "Autenticado" : "No autenticado");
        
        // Si hay un userId en la URL, cargamos ese perfil
        // Si no, intentamos cargar el perfil del usuario autenticado
        if (!requestedUid && !currentUser) {
            // No hay perfil para mostrar, mostrar mensaje de inicio de sesión
            console.log("No hay perfil para mostrar, mostrando pantalla de login");
            showLoginRequired();
            isLoadingProfile = false;
            return;
        }
        
        // Determinar qué UID usar para cargar el perfil
        const uidToLoad = requestedUid || currentUser.uid;
        console.log("Cargando perfil con UID:", uidToLoad);
        
        // Obtener datos del usuario
        const usersRef = firebase.firestore().collection("usuarios");
        const q = usersRef.where("uid", "==", uidToLoad);
        const querySnapshot = await q.get();
        
        if (querySnapshot.empty) {
            console.warn("No se encontró el perfil del usuario, creando uno nuevo");
            
            // Si es el usuario actual, crear un perfil básico
            if (currentUser && uidToLoad === currentUser.uid) {
                const newUserData = {
                    uid: currentUser.uid,
                    nombre: currentUser.displayName || 'Usuario',
                    email: currentUser.email,
                    photoURL: currentUser.photoURL || null,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    puntos: 0,
                    victorias: 0,
                    torneos: []
                };
                
                // Crear nuevo documento
                await firebase.firestore().collection("usuarios").add(newUserData);
                console.log("Nuevo perfil creado");
                
                // Cargar el perfil recién creado
                await loadProfile();
                return;
            } else {
                // Si es otro usuario y no se encuentra, mostrar error
                showProfileNotFound();
                isLoadingProfile = false;
                return;
            }
        }
        
        // Obtener datos del perfil
        const userData = querySnapshot.docs[0].data();
        console.log("Datos del usuario:", userData);
        
        // Actualizar información del perfil
        updateProfileInfo(userData);
        
        // Cargar badges del usuario
        loadUserBadges(userData);
        
        // Cargar historial de torneos
        loadUserTournaments(userData);
        
        // Si es el propio perfil del usuario, mostrar opciones adicionales
        if (!requestedUid && currentUser) {
            showProfileOptions();
        } else {
            hideProfileOptions();
        }
        
        isLoadingProfile = false;
    } catch (error) {
        console.error("Error al cargar perfil:", error);
        showProfileError();
        isLoadingProfile = false;
    }
}

// Mostrar mensaje cuando se requiere inicio de sesión
function showLoginRequired() {
    const profileContainer = document.getElementById('profileContainer');
    
    if (profileContainer) {
        profileContainer.innerHTML = `
            <div class="text-center py-8">
                <div class="bg-gray-800 rounded-lg p-6 max-w-md mx-auto border border-gray-700">
                    <i class="fas fa-user-lock text-blue-400 text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold text-white mb-2">Inicia sesión para ver tu perfil</h3>
                    <p class="text-gray-400 mb-4">Para ver tu perfil personal, necesitas iniciar sesión en tu cuenta.</p>
                    <button id="loginPromptBtn" class="dtowin-primary text-white px-5 py-2 rounded-lg font-semibold hover:opacity-90 transition">
                        Iniciar Sesión
                    </button>
                    <p class="text-sm text-gray-500 mt-4">¿No tienes cuenta? <button id="registerPromptBtn" class="text-blue-400 hover:underline">Regístrate</button></p>
                </div>
            </div>
        `;
        
        // Configurar botones
        const loginPromptBtn = document.getElementById('loginPromptBtn');
        const registerPromptBtn = document.getElementById('registerPromptBtn');
        
        if (loginPromptBtn) {
            loginPromptBtn.addEventListener('click', () => {
                const loginModal = document.querySelector('#loginModal');
                if (loginModal) {
                    loginModal.classList.remove('hidden');
                    loginModal.classList.add('flex');
                } else {
                    alert("Modal de inicio de sesión no encontrado");
                }
            });
        }
        
        if (registerPromptBtn) {
            registerPromptBtn.addEventListener('click', () => {
                const registerModal = document.querySelector('#registroModal');
                if (registerModal) {
                    registerModal.classList.remove('hidden');
                    registerModal.classList.add('flex');
                } else {
                    alert("Modal de registro no encontrado");
                }
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
                <div class="bg-gray-800 rounded-lg p-6 max-w-md mx-auto border border-gray-700">
                    <i class="fas fa-user-slash text-yellow-400 text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold text-white mb-2">Perfil no encontrado</h3>
                    <p class="text-gray-400 mb-4">Lo sentimos, no pudimos encontrar el perfil que estás buscando.</p>
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
                <div class="bg-gray-800 rounded-lg p-6 max-w-md mx-auto border border-gray-700">
                    <i class="fas fa-exclamation-triangle text-red-400 text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold text-white mb-2">Error al cargar perfil</h3>
                    <p class="text-gray-400 mb-4">Ocurrió un error al intentar cargar el perfil. Por favor, intenta de nuevo más tarde.</p>
                    <button onclick="window.location.reload()" class="dtowin-blue text-white px-5 py-2 rounded-lg font-semibold hover:opacity-90 transition">
                        Reintentar
                    </button>
                </div>
            </div>
        `;
    }
}

// Función actualizada para mostrar información del perfil, incluido el banner
async function updateProfileInfo(userData) {
    console.log("Actualizando información del perfil", userData);
    
    // Actualizar nombre de usuario
    const profileUsername = document.getElementById('profileUsername');
    if (profileUsername) {
        profileUsername.textContent = userData.nombre || 'Usuario';
    }
    
    // Actualizar foto de perfil - Priorizar Firestore sobre Auth
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        // Usar photoURL de Firestore (Base64) si existe, sino usar la de Auth, sino imagen por defecto
        const profileImageSrc = userData.photoURL || userData.photoData || user.photoURL || 'dtowin.png';
        profileAvatar.src = profileImageSrc;
        profileAvatar.alt = userData.nombre || 'Usuario';
        console.log("Foto de perfil actualizada desde:", userData.photoURL ? 'Firestore (photoURL)' : (userData.photoData ? 'Firestore (photoData)' : (user.photoURL ? 'Auth' : 'default')));
    } else {
        console.log("No se encontró foto de perfil o elemento para actualizarla");
    }
    
    // Primero asegurarse de que navbar y footer mantengan su degradado
    preserveGradientInNavbarAndFooter();
    
    // Identificar el encabezado del perfil que debe tener el banner
    // Buscar el primer .gradient-background dentro del profileContainer que no sea navbar/footer
    const profileContainer = document.getElementById('profileContainer');
    let profileHeader = null;
    if (profileContainer) {
        profileHeader = profileContainer.querySelector('.gradient-background');
    }
    
    if (profileHeader) {
        console.log("Encontrado el encabezado del perfil para aplicar/restaurar banner", profileHeader);
        
        // Guardar las clases originales si no se ha hecho ya
        if (!profileHeader.dataset.originalClasses) {
            profileHeader.dataset.originalClasses = profileHeader.className;
            console.log("Guardadas clases originales:", profileHeader.className);
        }
        
        // Verificar si hay un banner asignado
        if (userData.bannerId && userData.bannerId !== "null") {
            console.log("Se encontró bannerId:", userData.bannerId);
            
            try {
                const bannerRef = firebase.firestore().collection("banners").doc(userData.bannerId);
                const bannerSnap = await bannerRef.get();
                
                if (bannerSnap.exists) {
                    const bannerData = bannerSnap.data();
                    console.log("Datos del banner:", bannerData);
                    
                    // Obtener fuente de imagen del banner
                    const bannerImageSource = bannerData.imageUrl || bannerData.imageData;
                    
                    if (bannerImageSource) {
                        console.log("Aplicando banner a sección de perfil");
                        
                        // Aplicar banner como fondo (sin overlay)
                        profileHeader.className = 'text-white p-8';
                        profileHeader.style.backgroundImage = `url(${bannerImageSource})`;
                        profileHeader.style.backgroundSize = 'cover';
                        profileHeader.style.backgroundPosition = 'center';
                    }
                } else {
                    console.log("No se encontró el banner, restaurando por defecto");
                    restoreDefaultGradient(profileHeader);
                }
            } catch (error) {
                console.error("Error al cargar banner:", error);
                restoreDefaultGradient(profileHeader);
            }
        } else {
            // Si no hay banner o es null, restaurar el degradado por defecto
            console.log("No hay banner asignado, restaurando degradado por defecto");
            restoreDefaultGradient(profileHeader);
        }
    } else {
        console.warn("No se encontró el encabezado del perfil para aplicar el banner");
    }
    
    // Actualizar datos estadísticos
    updateProfileStats(userData);
}

// Función para restaurar el degradado predeterminado
function restoreDefaultGradient(element) {
    if (!element) return;
    
    console.log("Restaurando degradado predeterminado");
    
    // Limpiar estilos inline
    element.style.backgroundImage = '';
    element.style.backgroundSize = '';
    element.style.backgroundPosition = '';
    element.style.position = '';
    
    // Restaurar clase original si existe
    if (element.dataset.originalClasses) {
        element.className = element.dataset.originalClasses;
    } else {
        // O aplicar la clase gradient-background si no hay clases originales guardadas
        element.className = 'gradient-background text-white p-8';
    }
    
    // Restaurar el degradado manualmente
    element.style.background = 'linear-gradient(135deg, #0042ff, #ff3000)';
    
    // Eliminar overlay si existe
    const overlay = element.querySelector('.profile-banner-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Función para asegurar que la navbar y footer mantienen su degradado original
function preserveGradientInNavbarAndFooter() {
    // Restaurar el degradado en la barra de navegación
    const navbar = document.querySelector('nav.gradient-background');
    if (navbar) {
        navbar.style.backgroundImage = '';
        navbar.style.background = 'linear-gradient(135deg, #0042ff, #ff3000)';
    }
    
    // Restaurar el degradado en el footer
    const footer = document.querySelector('footer.gradient-background');
    if (footer) {
        footer.style.backgroundImage = '';
        footer.style.background = 'linear-gradient(135deg, #0042ff, #ff3000)';
    }
}

// Actualizar estadísticas del perfil
async function updateProfileStats(userData) {
    // Puntos totales
    const profilePoints = document.getElementById('profilePoints');
    if (profilePoints) {
        profilePoints.textContent = userData.puntos || 0;
    }
    
    // Torneos jugados (buscar dinámicamente en la base de datos)
    const profileTournaments = document.getElementById('profileTournaments');
    if (profileTournaments) {
        try {
            let torneosJugados = 0;
            
            // Buscar TODOS los torneos en la base de datos
            const torneosRef = firebase.firestore().collection("torneos");
            const torneosSnapshot = await torneosRef.get();
            
            console.log(`Buscando torneos para el usuario ${userData.uid}...`);
            
            // Para cada torneo, verificar si el usuario tiene inscripción con asistenciaConfirmada: true
            const verificaciones = torneosSnapshot.docs.map(async (torneoDoc) => {
                try {
                    const torneoId = torneoDoc.id;
                    // Buscar la inscripción del usuario en este torneo
                    const inscripcionRef = firebase.firestore()
                        .collection("torneos")
                        .doc(torneoId)
                        .collection("inscripciones")
                        .doc(userData.uid);
                    
                    const inscripcionDoc = await inscripcionRef.get();
                    
                    if (inscripcionDoc.exists) {
                        const inscripcionData = inscripcionDoc.data();
                        console.log(`Usuario ${userData.uid} en torneo ${torneoId}:`, {
                            asistenciaConfirmada: inscripcionData.asistenciaConfirmada,
                            estado: inscripcionData.estado
                        });
                        
                        // Solo contar si tiene check-in confirmado
                        if (inscripcionData.asistenciaConfirmada === true && inscripcionData.estado === "inscrito") {
                            return 1; // Cuenta como torneo jugado
                        }
                    }
                    return 0;
                } catch (error) {
                    console.error(`Error al verificar torneo:`, error);
                    return 0;
                }
            });
            
            const resultados = await Promise.all(verificaciones);
            torneosJugados = resultados.reduce((sum, val) => sum + val, 0);
            console.log(`Total de torneos jugados para ${userData.uid}: ${torneosJugados}`);
            profileTournaments.textContent = torneosJugados;
            
        } catch (error) {
            console.error("Error al contar torneos jugados:", error);
            // Fallback: intentar contar del array torneos si existe
            profileTournaments.textContent = userData.torneos ? userData.torneos.length : 0;
        }
    }
    
    // Victorias
    const profileWins = document.getElementById('profileWins');
    if (profileWins) {
        profileWins.textContent = userData.victorias || 0;
    }
    
    // Posición en el ranking
    const profileRanking = document.getElementById('profileRanking');
    if (profileRanking) {
        try {
            // Si el usuario no tiene puntos, mostrar "unranked"
            if (!userData.puntos || userData.puntos === 0) {
                profileRanking.textContent = "unranked";
                return;
            }
            
            // Obtener todos los usuarios de la base de datos
            const usuariosRef = firebase.firestore().collection("usuarios");
            const querySnapshot = await usuariosRef.get();
            
            // Crear array de usuarios con sus puntos
            const usuarios = [];
            querySnapshot.forEach(doc => {
                usuarios.push({
                    uid: doc.data().uid,
                    puntos: doc.data().puntos || 0
                });
            });
            
            // Ordenar por puntos de mayor a menor
            usuarios.sort((a, b) => b.puntos - a.puntos);
            
            // Encontrar la posición del usuario actual
            const posicion = usuarios.findIndex(u => u.uid === userData.uid) + 1;
            
            if (posicion > 0) {
                profileRanking.textContent = `#${posicion}`;
            } else {
                profileRanking.textContent = "unranked";
            }
        } catch (error) {
            console.error("Error al calcular ranking:", error);
            profileRanking.textContent = "unranked";
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
            <p class="text-sm text-gray-400">Cargando badges...</p>
        </div>
    `;
    
    try {
        // Si el usuario no tiene badges, mostrar mensaje
        if (!userData.badges || Object.keys(userData.badges).length === 0) {
            badgesContainer.innerHTML = `
                <div class="text-center p-4">
                    <p class="text-gray-400">Este usuario no tiene badges todavía</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">';
        
        // Obtener datos de cada badge
        const badgeIds = Object.keys(userData.badges);
        
        for (const badgeId of badgeIds) {
            try {
                const badgeRef = firebase.firestore().collection("badges").doc(badgeId);
                const badgeSnap = await badgeRef.get();
                
                if (badgeSnap.exists) {
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
                        <div class="bg-gray-800 p-3 rounded-lg shadow text-center border border-gray-700">
                            ${badgeImage}
                            <h4 class="font-semibold text-white">${badgeData.nombre || 'Badge'}</h4>
                            <p class="text-xs text-gray-400">${badgeData.descripcion || ''}</p>
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
                <p class="text-red-400">Error al cargar badges. <button class="text-blue-400 underline" onclick="window.location.reload()">Reintentar</button></p>
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
            <p class="text-sm text-gray-400">Cargando historial de torneos...</p>
        </div>
    `;
    
    try {
        console.log(`Buscando torneos para el usuario ${userData.uid}...`);
        
        // Buscar TODOS los torneos en la base de datos
        const torneosRef = firebase.firestore().collection("torneos");
        const torneosSnapshot = await torneosRef.get();
        
        const torneosConInscripcion = [];
        
        // Para cada torneo, verificar si el usuario tiene inscripción con asistenciaConfirmada: true
        for (const torneoDoc of torneosSnapshot.docs) {
            try {
                const torneoId = torneoDoc.id;
                const torneoData = torneoDoc.data();
                
                // Buscar la inscripción del usuario en este torneo
                const inscripcionRef = firebase.firestore()
                    .collection("torneos")
                    .doc(torneoId)
                    .collection("inscripciones")
                    .doc(userData.uid);
                
                const inscripcionDoc = await inscripcionRef.get();
                
                // Si el usuario tiene inscripción con asistenciaConfirmada: true, agregar a la lista
                if (inscripcionDoc.exists) {
                    const inscripcionData = inscripcionDoc.data();
                    
                    console.log(`Verificando torneo ${torneoId}:`, {
                        asistenciaConfirmada: inscripcionData.asistenciaConfirmada,
                        estado: inscripcionData.estado
                    });
                    
                    if (inscripcionData.asistenciaConfirmada === true && inscripcionData.estado === "inscrito") {
                        torneosConInscripcion.push({
                            id: torneoId,
                            ...torneoData,
                            resultados: inscripcionData // Guardar los datos de la inscripción
                        });
                    }
                }
            } catch (error) {
                console.error(`Error al verificar torneo:`, error);
            }
        }
        
        console.log(`Total de torneos encontrados: ${torneosConInscripcion.length}`);
        
        // Si el usuario no ha jugado torneos, mostrar mensaje
        if (torneosConInscripcion.length === 0) {
            tournamentsContainer.innerHTML = `
                <div class="text-center p-4">
                    <p class="text-gray-400">Este usuario no ha participado en torneos todavía</p>
                </div>
            `;
            return;
        }
        
        // Ordenar por fecha (más reciente primero)
        torneosConInscripcion.sort((a, b) => {
            const dateA = a.fecha ? new Date(a.fecha.seconds * 1000) : new Date(0);
            const dateB = b.fecha ? new Date(b.fecha.seconds * 1000) : new Date(0);
            return dateB - dateA; // Orden descendente
        });
        
        // Generar HTML
        let html = '<div class="space-y-4">';
        
        torneosConInscripcion.forEach(torneo => {
            // Formatear fecha
            let fechaFormateada = 'Fecha no disponible';
            if (torneo.fecha && torneo.fecha.seconds) {
                const fecha = new Date(torneo.fecha.seconds * 1000);
                fechaFormateada = fecha.toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
            
            // Determinar clase de estado
            let estadoClass;
            switch (torneo.estado) {
                case 'Finalizado':
                    estadoClass = 'bg-gray-700 text-gray-200';
                    break;
                case 'En Progreso':
                    estadoClass = 'bg-yellow-700 text-yellow-100';
                    break;
                case 'Abierto':
                    estadoClass = 'bg-green-700 text-green-100';
                    break;
                default:
                    estadoClass = 'bg-blue-700 text-blue-100';
            }
            
            // Determinar posición del usuario (desde los datos de inscripción)
            let posicionHTML = '';
            if (torneo.resultados && torneo.resultados.posicion) {
                const posicion = torneo.resultados.posicion;
                const puntos = torneo.resultados.puntos || 0;
                
                // Clase para posiciones destacadas
                let posicionClass = '';
                if (posicion === 1) {
                    posicionClass = 'bg-yellow-500 text-white';
                } else if (posicion === 2) {
                    posicionClass = 'bg-gray-400 text-white';
                } else if (posicion === 3) {
                    posicionClass = 'bg-red-500 text-white';
                } else {
                    posicionClass = 'bg-gray-700 text-gray-200';
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
                <div class="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-bold text-white">${torneo.nombre || 'Torneo sin nombre'}</h4>
                        <span class="px-2 py-1 rounded text-xs ${estadoClass}">
                            ${torneo.estado || 'Desconocido'}
                        </span>
                    </div>
                    <div class="text-sm text-gray-400 mb-3">
                        <i class="far fa-calendar-alt mr-1"></i> ${fechaFormateada}
                    </div>
                    ${posicionHTML}
                    <div class="mt-4 flex gap-2">
                        ${torneo.bracketsLink ? `
                            <a href="${torneo.bracketsLink}" target="_blank" class="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm font-semibold transition">
                                <i class="fas fa-bracket mr-1"></i>Ver Bracket
                            </a>
                        ` : `
                            <button class="flex-1 text-center bg-gray-600 text-gray-300 py-2 px-3 rounded-lg text-sm font-semibold cursor-not-allowed" disabled>
                                <i class="fas fa-bracket mr-1"></i>Sin Bracket
                            </button>
                        `}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        tournamentsContainer.innerHTML = html;
        
    } catch (error) {
        console.error("Error al cargar historial de torneos:", error);
        tournamentsContainer.innerHTML = `
            <div class="text-center p-4">
                <p class="text-red-400">Error al cargar historial de torneos. <button class="text-blue-400 underline" onclick="window.location.reload()">Reintentar</button></p>
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

// Función para renderizar la plantilla de perfil
function renderProfileTemplate() {
    const template = document.getElementById('profileTemplate');
    const profileContainer = document.getElementById('profileContainer');
    
    if (template && profileContainer) {
        profileContainer.innerHTML = '';
        const clone = document.importNode(template.content, true);
        profileContainer.appendChild(clone);
        
        // Configurar pestañas después de renderizar
        setupTabs();
        
        // Configurar botones después de renderizar
        setupButtons();
    }
}

// Configurar navegación por pestañas
function setupTabs() {
    const tabLinks = document.querySelectorAll('[href^="#"]');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabLinks.forEach(tabLink => {
        tabLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Ocultar todos los contenidos
            tabContents.forEach(content => {
                content.classList.add('hidden');
            });
            
            // Mostrar el contenido correspondiente
            const targetId = tabLink.getAttribute('href').substring(1);
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }
            
            // Desactivar todos los enlaces
            tabLinks.forEach(link => {
                link.classList.remove('text-blue-600', 'border-blue-600');
                link.classList.add('text-gray-500', 'border-transparent');
            });
            
            // Activar el enlace actual
            tabLink.classList.remove('text-gray-500', 'border-transparent');
            tabLink.classList.add('text-blue-600', 'border-blue-600');
        });
    });
}

// Configurar botones del perfil
function setupButtons() {
    console.log("Configurando botones del perfil");
    const logoutBtn = document.getElementById('logoutBtn');
    const editProfileBtn = document.getElementById('editProfileBtn');
    
    // Configurar botón de cerrar sesión
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await firebase.auth().signOut();
                mostrarNotificacion("Has cerrado sesión correctamente", "success");
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                mostrarNotificacion("Error al cerrar sesión", "error");
            }
        });
    }
    
    // Configurar botón de editar perfil
    if (editProfileBtn) {
        console.log("Configurando botón editar perfil");
        editProfileBtn.addEventListener('click', async () => {
            console.log("Botón editar perfil clickeado");
            
            try {
                // Mostrar modal primero para que se vea la carga
                const editProfileModal = document.getElementById('editProfileModal');
                if (editProfileModal) {
                    editProfileModal.classList.remove('hidden');
                    editProfileModal.classList.add('flex');
                } else {
                    console.error("Modal de edición no encontrado");
                    mostrarNotificacion("Error: Modal de edición no encontrado", "error");
                    return;
                }
                
                // Cargar datos actuales
                await loadCurrentProfileData();
                
                // Cargar banners disponibles
                await loadAvailableBanners();
                
            } catch (error) {
                console.error("Error al abrir el modal de edición:", error);
                mostrarNotificacion("Error al cargar datos del perfil", "error");
            }
        });
    }
}

// ----- FUNCIONES PARA EDICIÓN DE PERFIL -----

// Función para inicializar el modal de edición de perfil
function initEditProfileModal() {
    console.log("Inicializando modal de edición de perfil");
    
    // Referencias a elementos DOM
    const closeEditProfileModal = document.getElementById('closeEditProfileModal');
    const cancelEditProfile = document.getElementById('cancelEditProfile');
    const editProfileForm = document.getElementById('editProfileForm');
    const saveProfileChanges = document.getElementById('saveProfileChanges');
    const profilePhotoInput = document.getElementById('profilePhotoInput');
    
    // Cerrar modal
    if (closeEditProfileModal) {
        closeEditProfileModal.addEventListener('click', () => {
            const editProfileModal = document.getElementById('editProfileModal');
            if (editProfileModal) {
                editProfileModal.classList.remove('flex');
                editProfileModal.classList.add('hidden');
            }
            
            // Resetear variables
            selectedBannerId = null;
            newProfilePhoto = null;
            
            // Ocultar vista previa de foto
            const photoPreviewContainer = document.getElementById('photoPreviewContainer');
            if (photoPreviewContainer) {
                photoPreviewContainer.classList.add('hidden');
            }
            
            // Restaurar el estado del botón
            if (saveProfileChanges) {
                saveProfileChanges.disabled = false;
                saveProfileChanges.textContent = "Guardar Cambios";
            }
            
            // Limpiar input de foto
            const profilePhotoInput = document.getElementById('profilePhotoInput');
            if(profilePhotoInput) profilePhotoInput.value = "";
        });
    }
    
    // Cancelar edición
    if (cancelEditProfile) {
        cancelEditProfile.addEventListener('click', () => {
            const editProfileModal = document.getElementById('editProfileModal');
            if (editProfileModal) {
                editProfileModal.classList.remove('flex');
                editProfileModal.classList.add('hidden');
            }
            
            // Resetear variables
            selectedBannerId = null;
            newProfilePhoto = null;
            
            // Ocultar vista previa de foto
            const photoPreviewContainer = document.getElementById('photoPreviewContainer');
            if (photoPreviewContainer) {
                photoPreviewContainer.classList.add('hidden');
            }
            
            // Restaurar el estado del botón
            if (saveProfileChanges) {
                saveProfileChanges.disabled = false;
                saveProfileChanges.textContent = "Guardar Cambios";
            }
            
            // Limpiar input de foto
            const profilePhotoInput = document.getElementById('profilePhotoInput');
            if(profilePhotoInput) profilePhotoInput.value = "";
        });
    }
    
    // Preview de foto de perfil
    if (profilePhotoInput) {
        profilePhotoInput.addEventListener('change', handleProfilePhotoChange);
    }
    
    // NO configurar el evento submit aquí - lo haremos al final para sobrescribir cualquier otro listener
}

// Cargar datos actuales del perfil en el formulario
async function loadCurrentProfileData() {
    console.log("Cargando datos actuales del perfil");
    
    try {
        // Obtener usuario actual
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            throw new Error("No hay usuario autenticado");
        }
        
        // Buscar perfil en Firestore
        const usersRef = firebase.firestore().collection("usuarios");
        const q = usersRef.where("uid", "==", currentUser.uid);
        const querySnapshot = await q.get();
        
        // Datos del usuario (del Auth)
        let userData = {
            nombre: currentUser.displayName || '',
            photoURL: currentUser.photoURL || 'dtowin.png',
            uid: currentUser.uid,
            email: currentUser.email
        };
        
        // Si encontramos datos adicionales en Firestore
        if (!querySnapshot.empty) {
            const firestoreData = querySnapshot.docs[0].data();
            userData = {...userData, ...firestoreData};
            console.log("Datos del usuario cargados desde Firestore:", userData);
        } else {
            console.warn("No se encontró perfil del usuario en Firestore, usando datos de auth");
        }
        
        // Llenar campos del formulario
        const editUsername = document.getElementById('editUsername');
        const currentProfilePhoto = document.getElementById('currentProfilePhoto');
        
        if (editUsername) {
            editUsername.value = userData.nombre || '';
            console.log("Nombre asignado al campo:", userData.nombre);
        }
        
        if (currentProfilePhoto) {
            // Priorizar la foto de Firestore (photoURL o photoData) sobre Auth
            const profileImageSrc = userData.photoURL || userData.photoData || 'dtowin.png';
            currentProfilePhoto.src = profileImageSrc;
            console.log("Foto de perfil del modal cargada desde:", userData.photoURL ? 'photoURL' : (userData.photoData ? 'photoData' : 'default'));
        }
        
        // Guardar bannerId actual si existe
        selectedBannerId = userData.bannerId || null;
        console.log("Banner ID cargado:", selectedBannerId);
        
    } catch (error) {
        console.error("Error al cargar datos del perfil:", error);
        mostrarNotificacion("Error al cargar los datos del perfil", "error");
        throw error;
    }
}

// Función para la carga de banners disponibles - Versión mejorada
async function loadAvailableBanners() {
    console.log("Cargando banners disponibles");
    
    const bannerSelector = document.getElementById('bannerSelector');
    if (!bannerSelector) return;
    
    try {
        // Mostrar estado de carga
        bannerSelector.innerHTML = '<div class="flex justify-center items-center"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div><p class="text-gray-500 text-sm ml-2">Cargando banners...</p></div>';
        
        // Obtener banners
        const bannersSnapshot = await firebase.firestore().collection("banners").get();
        
        // Crear HTML para selector de banners
        let html = '';
        
        // Opción de "Sin banner" - Siempre disponible
        html += `
            <div class="banner-option cursor-pointer border rounded p-1 hover:bg-gray-100 ${!selectedBannerId ? 'selected border-orange-500' : 'border-gray-600'}" data-banner-id="">
                <div class="h-12 bg-gray-200 flex items-center justify-center text-gray-500 text-xs rounded">
                    Sin banner
                </div>
            </div>
        `;
        
        // Variable para contar banners válidos
        let hasValidBanners = false;
        
        // Verificar si hay banners
        if (!bannersSnapshot.empty) {
            // Añadir cada banner
            bannersSnapshot.forEach(doc => {
                const banner = doc.data();
                
                // Verificar si el banner tiene imageData o imageUrl y está visible
                if ((banner.imageData || banner.imageUrl) && banner.visible !== false) {
                    hasValidBanners = true;
                    const isSelected = selectedBannerId === doc.id;
                    
                    // Determinar fuente de imagen
                    const imageSource = banner.imageUrl || banner.imageData || '';
                    
                    html += `
                        <div class="banner-option cursor-pointer border rounded p-1 ${isSelected ? 'selected border-orange-500' : 'border-gray-600'}" data-banner-id="${doc.id}">
                            <img src="${imageSource}" alt="${banner.nombre || 'Banner'}" class="h-12 w-full object-cover rounded">
                        </div>
                    `;
                }
            });
        }
        
        // Actualizar HTML
        bannerSelector.innerHTML = html;
        
        // Agregar eventos de selección
        document.querySelectorAll('.banner-option').forEach(option => {
            option.addEventListener('click', function() {
                console.log("Click en banner, data-banner-id:", this.dataset.bannerId);
                
                // Quitar selección actual
                document.querySelectorAll('.banner-option').forEach(opt => {
                    opt.classList.remove('selected', 'border-orange-500');
                    opt.classList.add('border-gray-600');
                });
                
                // Marcar como seleccionado
                this.classList.add('selected', 'border-orange-500');
                this.classList.remove('border-gray-600');
                
                // Guardar ID de banner seleccionado
                selectedBannerId = this.dataset.bannerId || "";
                window.selectedBannerId = selectedBannerId; // También asignar a window para mayor compatibilidad
                console.log("Banner seleccionado:", selectedBannerId);
                console.log("window.selectedBannerId actualizado a:", window.selectedBannerId);
            });
        });
        
    } catch (error) {
        console.error("Error al cargar banners:", error);
        bannerSelector.innerHTML = '<p class="text-red-500 text-center py-2">Error al cargar banners</p>';
    }
}

// Manejar cambio de foto de perfil - Versión actualizada con Base64 y compresión
async function handleProfilePhotoChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log("Archivo de foto seleccionado:", file.name, "Tamaño:", file.size, "bytes");
    
    // Verificar que sea imagen
    if (!file.type.startsWith('image/')) {
        mostrarNotificacion("El archivo debe ser una imagen", "error");
        event.target.value = '';
        return;
    }
    
    // Verificar tamaño (max 10MB - aumentamos el límite ya que vamos a comprimir)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
        mostrarNotificacion("La imagen es demasiado grande. Máximo 10MB", "warning");
        event.target.value = '';
        return;
    }
    
    // Guardar referencia al archivo
    newProfilePhoto = file;
    console.log("newProfilePhoto:", newProfilePhoto);
    
    // Mostrar vista previa comprimida
    const photoPreview = document.getElementById('photoPreview');
    const photoPreviewContainer = document.getElementById('photoPreviewContainer');
    
    if (photoPreview && photoPreviewContainer) {
        try {
            // Comprimir imagen para vista previa (calidad más baja)
            const compressedPreview = await compressImage(file, 400, 300, 0.6);
            photoPreview.src = compressedPreview;
            photoPreviewContainer.classList.remove('hidden');
            console.log("Vista previa comprimida generada");
        } catch (error) {
            console.error("Error al generar vista previa comprimida:", error);
            // Fallback a método original
            const reader = new FileReader();
            reader.onload = function(e) {
                photoPreview.src = e.target.result;
                photoPreviewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    }
}

// Función para leer archivo como Base64 (adaptada de admin-panel-banners.js)
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// Función para comprimir imagen automáticamente
function compressImage(file, maxWidth = 800, maxHeight = 600, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // Calcular nuevas dimensiones manteniendo proporción
            let { width, height } = img;
            
            // Reducir tamaño si es muy grande
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            
            // Configurar canvas
            canvas.width = width;
            canvas.height = height;
            
            // Dibujar imagen redimensionada
            ctx.fillStyle = '#FFFFFF'; // Fondo blanco
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convertir a Base64 con calidad comprimida
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            
            console.log(`Imagen comprimida: ${width}x${height}, calidad: ${quality}`);
            console.log(`Tamaño original: ${file.size} bytes, tamaño comprimido: ${compressedBase64.length} caracteres`);
            
            resolve(compressedBase64);
        };
        
        img.onerror = function() {
            reject(new Error('Error al cargar la imagen para compresión'));
        };
        
        // Cargar imagen
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
        };
        reader.onerror = function() {
            reject(new Error('Error al leer el archivo'));
        };
        reader.readAsDataURL(file);
    });
}

// La función handleProfileFormSubmit tradicional está eliminada deliberadamente
// En su lugar, usamos un enfoque directo que sobrescribe el comportamiento del formulario

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = "info") {
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
    
    if (tipo === 'success') {
        bgColor = 'bg-green-500';
        icon = 'check-circle';
    } else if (tipo === 'error') {
        bgColor = 'bg-red-500';
        icon = 'exclamation-circle';
    } else if (tipo === 'warning') {
        bgColor = 'bg-yellow-500';
        icon = 'exclamation-triangle';
    }
    
    // Estilos de la notificación
    notification.className = `notification fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center`;
    notification.innerHTML = `
        <i class="fas fa-${icon} mr-2"></i>
        <span>${mensaje}</span>
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

// Configurar formularios de login y registro (solo Google)
function setupAuthForms() {
    // Google login button
    document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await firebase.auth().signInWithPopup(provider);
            
            // Crear o actualizar perfil
            const userDocs = await firebase.firestore()
                .collection('usuarios')
                .where('uid', '==', result.user.uid)
                .limit(1)
                .get();
            
            if (userDocs.empty) {
                await firebase.firestore().collection('usuarios').add({
                    uid: result.user.uid,
                    nombre: result.user.displayName || 'Usuario',
                    email: result.user.email,
                    photoURL: result.user.photoURL,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    puntos: 0,
                    victorias: 0,
                    torneos: []
                });
            }
            
            document.getElementById('loginModal')?.classList.add('hidden');
            mostrarNotificacion('Sesión iniciada correctamente', 'success');
        } catch (error) {
            mostrarNotificacion('Error al iniciar sesión con Google: ' + error.message, 'error');
        }
    });
    
    // Google register button
    document.querySelectorAll('.google-register-btn')?.forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                const result = await firebase.auth().signInWithPopup(provider);
                
                // Crear o actualizar perfil
                const userDocs = await firebase.firestore()
                    .collection('usuarios')
                    .where('uid', '==', result.user.uid)
                    .limit(1)
                    .get();
                
                if (userDocs.empty) {
                    await firebase.firestore().collection('usuarios').add({
                        uid: result.user.uid,
                        nombre: result.user.displayName || 'Usuario',
                        email: result.user.email,
                        photoURL: result.user.photoURL,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        puntos: 0,
                        victorias: 0,
                        torneos: []
                    });
                }
                
                document.getElementById('registroModal')?.classList.add('hidden');
                mostrarNotificacion('Cuenta creada correctamente', 'success');
            } catch (error) {
                mostrarNotificacion('Error al registrar con Google: ' + error.message, 'error');
            }
        });
    });
}

// Exponer funciones a nivel global
window.loadProfile = loadProfile;
window.renderProfileTemplate = renderProfileTemplate;
window.mostrarNotificacion = mostrarNotificacion;
window.initializeProfile = initializeProfile;

// ----------------------
// SOLUCIÓN INDEPENDIENTE
// ----------------------
// Esta solución reemplaza el comportamiento del formulario para evitar recursión
document.addEventListener("DOMContentLoaded", function() {
    // Esperar a que el DOM esté completamente cargado
    setTimeout(function() {
        // Dar tiempo adicional para que el formulario esté disponible
        const form = document.getElementById('editProfileForm');
        if (form) {
            console.log("Configurando comportamiento independiente del formulario");
            
            // Sobrescribir completamente el comportamiento del formulario
            form.onsubmit = async function(e) {
                // Prevenir comportamiento por defecto
                e.preventDefault();
                console.log("Formulario enviado - usando manejador independiente");
                
                // Obtener valores del formulario
                const username = document.getElementById('editUsername').value.trim();
                const bannerID = window.selectedBannerId || selectedBannerId; // Usar variable global
                
                console.log("=== ACTUALIZANDO PERFIL ===");
                console.log("Usuario:", username);
                console.log("BannerID (window.selectedBannerId):", window.selectedBannerId);
                console.log("BannerID (selectedBannerId):", selectedBannerId);
                console.log("BannerID (final):", bannerID);
                console.log("Tiene foto nueva:", !!newProfilePhoto);
                
                // Validación simple
                if (newProfilePhoto && !newProfilePhoto.type.startsWith('image/')) {
                    mostrarNotificacion("El archivo debe ser una imagen", "error");
                    return;
                }
                if (!username) {
                    window.alert("El nombre de usuario es obligatorio");
                    return false;
                }
                
                // Obtener botón y mostrarlo en estado de carga
                const button = document.getElementById('saveProfileChanges');
                if (button) {
                    button.disabled = true;
                    button.textContent = "Guardando...";
                }
                
                try {
                    // 1. Obtener usuario actual
                    const user = firebase.auth().currentUser;
                    if (!user) {
                        throw new Error("No hay usuario autenticado");
                    }
                    
                    // 2. Actualizar perfil en Auth
                    await firebase.auth().currentUser.updateProfile({
                        displayName: username
                    });
                    
                    // 3. Buscar documento en Firestore
                    const userDocs = await firebase.firestore()
                        .collection("usuarios")
                        .where("uid", "==", user.uid)
                        .limit(1)
                        .get();
                        
                    // 4. Preparar datos a actualizar
                    const updateData = {
                        nombre: username,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    // 5. Manejar banner
                    console.log("Procesando banner: bannerID=", bannerID);
                    if (bannerID === "" || bannerID === null || bannerID === undefined) {
                        console.log("Banner vacío/nulo - estableciendo bannerId a null");
                        updateData.bannerId = null;
                    } else if (bannerID) {
                        console.log("Banner seleccionado - estableciendo bannerId a:", bannerID);
                        updateData.bannerId = bannerID;
                    }
                    
                    console.log("Datos a actualizar:", updateData);
                    
                    // 6. Actualizar o crear documento
                    if (!userDocs.empty) {
                        console.log("Actualizando documento existente del usuario");
                        await userDocs.docs[0].ref.update(updateData);
                        console.log("Documento actualizado correctamente");
                    } else {
                        console.log("Creando nuevo documento del usuario");
                        await firebase.firestore().collection("usuarios").add({
                            ...updateData,
                            uid: user.uid,
                            email: user.email,
                            photoURL: user.photoURL,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            puntos: 0,
                            victorias: 0,
                            torneos: []
                        });
                        console.log("Documento creado correctamente");
                    }
                    
                    // 7. Manejar foto si existe
                    const photoInput = document.getElementById('profilePhotoInput');
                    const saveProfileChanges = document.getElementById('saveProfileChanges');
                    
                    if (newProfilePhoto) {
                        // Mostrar carga en el botón
                        if (saveProfileChanges) {
                            saveProfileChanges.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
                            saveProfileChanges.disabled = true;
                        }
                        
                        console.log("Procesando foto de perfil con compresión automática...");
                        
                        // Comprimir imagen automáticamente (800x600, calidad 0.8)
                        const compressedImage = await compressImage(newProfilePhoto, 800, 600, 0.8);
                        console.log("Imagen comprimida, tamaño final:", compressedImage.length, "caracteres");
                        
                        // NO actualizar Firebase Auth con Base64 (es demasiado largo)
                        // En su lugar, solo actualizar Firestore y usar null en Auth
                        console.log("Saltando actualización de Auth (Base64 demasiado largo para Firebase Auth)");
                        
                        // Actualizar solo el displayName en Auth si es necesario
                        await firebase.auth().currentUser.updateProfile({
                            displayName: username
                        });

                        // Imprimir la imagen comprimida justo antes de actualizar Firestore
                        console.log("compressedImage antes de Firestore update:", compressedImage.substring(0, 100) + "...");

                        // Actualizar foto en Firestore usando imagen comprimida (Firestore no tiene límite de tamaño)
                        if (!userDocs.empty) {
                            await userDocs.docs[0].ref.update({
                                photoURL: compressedImage, // Guardar imagen comprimida en Firestore
                                photoData: compressedImage, // Campo adicional para compatibilidad
                                hasCustomPhoto: true, // Flag para indicar que tiene foto personalizada
                                photoCompressed: true, // Flag para indicar que la foto está comprimida
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            console.log("Foto comprimida actualizada en Firestore");
                        } else {
                            console.warn("No se encontró perfil del usuario en Firestore, no se actualizó foto");
                        }
                    }
                    
                    // 8. Cerrar modal
                    const modal = document.getElementById('editProfileModal');
                    if (modal) {
                        modal.classList.add('hidden');
                        modal.classList.remove('flex');
                    }
                    
                    // 9. Mostrar mensaje de éxito
                    console.log("=== ACTUALIZACIÓN COMPLETADA CON ÉXITO ===");
                    mostrarNotificacion("Perfil actualizado correctamente", "success");
                    
                    // Resetear variables globales
                    selectedBannerId = null;
                    newProfilePhoto = null;
                    
                    // 10. Forzar recarga completa después de un pequeño delay (no usar reload que podría usar caché)
                    console.log("Recargando página en 1.5 segundos...");
                    setTimeout(() => {
                        try {
                            window.location.href = window.location.pathname + "?t=" + Date.now();
                        } catch (reloadError) {
                            console.error("Error al recargar:", reloadError);
                            // Fallback: recargar sin parametros
                            window.location.reload(true);
                        }
                    }, 1500);
                    
                } catch (error) {
                    // Manejar error
                    const profilePhotoInput = document.getElementById('profilePhotoInput');
                    
                    // Limpiar input de foto
                    if(profilePhotoInput) profilePhotoInput.value = "";
                    
                    // Eliminar referencia
                    newProfilePhoto = null;
                    
                    console.error("Error al actualizar perfil:", error);
                    console.error("Stack:", error.stack);
                    
                    // Mostrar notificación en lugar de alert
                    mostrarNotificacion("Error al actualizar: " + error.message, "error");
                    
                    // Restaurar botón
                    if (button) {
                        button.disabled = false;
                        button.textContent = "Guardar Cambios";
                    }
                    
                }
                
                return false; // Para asegurar que el formulario no se envía
            };
        } else {
            console.warn("No se encontró el formulario de edición de perfil");
        }
    }, 1000); // Esperar 1 segundo para asegurar que el DOM está listo
});
