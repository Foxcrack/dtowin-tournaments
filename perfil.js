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
        initializeProfile();
    } else {
        console.log("Firebase no disponible todavía, configurando intervalo de verificación");
        
        // Comprobar cada 100ms si firebase ya está disponible
        const checkFirebase = setInterval(() => {
            if (typeof firebase !== 'undefined') {
                console.log("Firebase disponible, inicializando...");
                clearInterval(checkFirebase);
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
    
    // Verificar el estado de autenticación y cargar el perfil
    firebase.auth().onAuthStateChanged(user => {
        console.log("Estado de autenticación cambiado:", user ? "Autenticado" : "No autenticado");
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            renderProfileTemplate();
            loadProfile();
        } else {
            console.log("No hay usuario autenticado");
            showLoginRequired();
        }
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
                <div class="bg-blue-50 rounded-lg p-6 max-w-md mx-auto">
                    <i class="fas fa-user-lock text-blue-500 text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Inicia sesión para ver tu perfil</h3>
                    <p class="text-gray-600 mb-4">Para ver tu perfil personal, necesitas iniciar sesión en tu cuenta.</p>
                    <button id="loginPromptBtn" class="dtowin-primary text-white px-5 py-2 rounded-lg font-semibold hover:opacity-90 transition">
                        Iniciar Sesión
                    </button>
                    <p class="text-sm text-gray-500 mt-4">¿No tienes cuenta? <button id="registerPromptBtn" class="text-blue-500 hover:underline">Regístrate</button></p>
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

// Función actualizada para mostrar información del perfil, incluido el banner
async function updateProfileInfo(userData) {
    console.log("Actualizando información del perfil", userData);
    
    // Actualizar nombre de usuario
    const profileUsername = document.getElementById('profileUsername');
    if (profileUsername) {
        profileUsername.textContent = userData.nombre || 'Usuario';
    }
    
    // Actualizar foto de perfil
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar && userData.photoURL) {
        profileAvatar.src = userData.photoURL;
        profileAvatar.alt = userData.nombre || 'Usuario';
        console.log("Foto de perfil actualizada:", userData.photoURL);
    } else {
        console.log("No se encontró foto de perfil o elemento para actualizarla");
    }
    
    // Identificar SOLO la sección de perfil que debe tener el banner
    // Busca específicamente el elemento que contiene el encabezado del perfil,
    // no todos los elementos con la clase gradient-background
    const profileHeader = document.querySelector('.bg-white.rounded-xl.shadow-lg .gradient-background');
    
    // Actualizar banner solo si se encuentra el elemento específico del perfil
    if (profileHeader) {
        // Actualizar banner si existe
        if (userData.bannerId && userData.bannerId !== "null" && userData.bannerId !== "") {
            try {
                const bannerRef = firebase.firestore().collection("banners").doc(userData.bannerId);
                const bannerSnap = await bannerRef.get();
                
                if (bannerSnap.exists) {
                    const bannerData = bannerSnap.data();
                    
                    // Obtener fuente de imagen del banner
                    const bannerImageSource = bannerData.imageUrl || bannerData.imageData;
                    
                    if (bannerImageSource) {
                        console.log("Aplicando banner a la sección del perfil:", bannerImageSource);
                        
                        // Guardar las clases originales para poder restaurarlas si es necesario
                        if (!profileHeader.dataset.originalClasses) {
                            profileHeader.dataset.originalClasses = profileHeader.className;
                        }
                        
                        // Aplicar banner como fondo
                        profileHeader.className = 'text-white p-8';
                        profileHeader.style.backgroundImage = `url(${bannerImageSource})`;
                        profileHeader.style.backgroundSize = 'cover';
                        profileHeader.style.backgroundPosition = 'center';
                        
                        // NO añadir overlay para respetar la visibilidad del contenido
                        // No queremos opacidad en el nombre y la foto de perfil
                    }
                }
            } catch (error) {
                console.error("Error al cargar banner:", error);
            }
        } else {
            // Restaurar fondo original si no hay banner
            console.log("Restaurando fondo original (sin banner)");
            
            if (profileHeader.dataset.originalClasses) {
                profileHeader.className = profileHeader.dataset.originalClasses;
                profileHeader.style.backgroundImage = '';
                profileHeader.style.backgroundSize = '';
                profileHeader.style.backgroundPosition = '';
                profileHeader.style.position = '';
                
                // Eliminar overlay si existe
                const overlay = profileHeader.querySelector('.profile-banner-overlay');
                if (overlay) {
                    overlay.remove();
                }
            }
        }
    } else {
        console.log("No se encontró el encabezado del perfil para aplicar el banner");
    }
    
    // Asegurarse de que la navbar y footer mantienen su degradado original
    preserveGradientInNavbarAndFooter();
    
    // Actualizar datos estadísticos
    updateProfileStats(userData);
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
                const torneoRef = firebase.firestore().collection("torneos").doc(torneoId);
                const torneoSnap = await torneoRef.get();
                
                if (torneoSnap.exists) {
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
        });
    }
    
    // Preview de foto de perfil
    if (profilePhotoInput) {
        profilePhotoInput.addEventListener('change', handleProfilePhotoChange);
    }
    
    // Manejar envío del formulario
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', handleProfileFormSubmit);
    } else {
        console.error("Formulario de edición no encontrado");
    }
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
            currentProfilePhoto.src = userData.photoURL || 'dtowin.png';
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

// Cargar banners disponibles
async function loadAvailableBanners() {
    console.log("Cargando banners disponibles");
    
    const bannerSelector = document.getElementById('bannerSelector');
    if (!bannerSelector) return;
    
    try {
        // Mostrar estado de carga
        bannerSelector.innerHTML = '<div class="flex justify-center items-center"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div><p class="text-gray-500 text-sm ml-2">Cargando banners...</p></div>';
        
        // Obtener banners
        const bannersSnapshot = await firebase.firestore().collection("banners").get();
        
        // Verificar si hay banners
        if (bannersSnapshot.empty) {
            bannerSelector.innerHTML = '<p class="text-center text-gray-600 py-2">No hay banners disponibles</p>';
            return;
        }
        
        // Crear HTML para selector de banners
        let html = '';
        
        // Opción de "Sin banner"
        html += `
            <div class="banner-option cursor-pointer border rounded p-1 hover:bg-gray-100 ${!selectedBannerId ? 'border-blue-500 bg-blue-50' : ''}" data-banner-id="">
                <div class="h-12 bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                    Sin banner
                </div>
            </div>
        `;
        
        // Variable para contar banners válidos
        let hasValidBanners = false;
        
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
                    <div class="banner-option cursor-pointer border rounded p-1 hover:bg-gray-100 ${isSelected ? 'border-blue-500 bg-blue-50' : ''}" data-banner-id="${doc.id}">
                        <img src="${imageSource}" alt="${banner.nombre || 'Banner'}" class="h-12 w-full object-cover">
                    </div>
                `;
            }
        });
        
        // Si no hay banners válidos, mostrar mensaje
        if (!hasValidBanners) {
            bannerSelector.innerHTML = '<p class="text-gray-500 text-center py-2">No hay banners disponibles</p>';
            return;
        }
        
        bannerSelector.innerHTML = html;
        
        // Agregar eventos de selección
        document.querySelectorAll('.banner-option').forEach(option => {
            option.addEventListener('click', function() {
                // Quitar selección actual
                document.querySelectorAll('.banner-option').forEach(opt => {
                    opt.classList.remove('border-blue-500', 'bg-blue-50');
                });
                
                // Marcar como seleccionado
                this.classList.add('border-blue-500', 'bg-blue-50');
                
                // Guardar ID de banner seleccionado
                selectedBannerId = this.dataset.bannerId || null;
                console.log("Banner seleccionado:", selectedBannerId);
            });
        });
        
    } catch (error) {
        console.error("Error al cargar banners:", error);
        bannerSelector.innerHTML = '<p class="text-red-500 text-center py-2">Error al cargar banners</p>';
    }
}

// Manejar cambio de foto de perfil - Versión actualizada
function handleProfilePhotoChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log("Archivo de foto seleccionado:", file.name);
    
    // Verificar que sea imagen
    if (!file.type.startsWith('image/')) {
        mostrarNotificacion("El archivo debe ser una imagen", "error");
        event.target.value = '';
        return;
    }
    
    // Verificar tamaño (max 2MB)
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
        mostrarNotificacion("La imagen es demasiado grande. Máximo 2MB", "warning");
    }
    
    // Guardar referencia al archivo
    newProfilePhoto = file;
    
    // Mostrar vista previa
    const photoPreview = document.getElementById('photoPreview');
    const photoPreviewContainer = document.getElementById('photoPreviewContainer');
    
    if (photoPreview && photoPreviewContainer) {
        const reader = new FileReader();
        reader.onload = function(e) {
            photoPreview.src = e.target.result;
            photoPreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

// Manejar envío del formulario de edición - Versión actualizada
async function handleProfileFormSubmit(event) {
    event.preventDefault();
    console.log("Enviando formulario de edición de perfil");
    
    // Referencias a elementos
    const editUsername = document.getElementById('editUsername');
    const saveProfileChanges = document.getElementById('saveProfileChanges');
    const editProfileErrorMsg = document.getElementById('editProfileErrorMsg');
    
    // Validar datos
    if (!editUsername || !editUsername.value.trim()) {
        if (editProfileErrorMsg) {
            editProfileErrorMsg.textContent = "El nombre de usuario es obligatorio";
            editProfileErrorMsg.classList.remove('hidden');
        }
        mostrarNotificacion("El nombre de usuario es obligatorio", "error");
        return;
    }
    
    // Ocultar mensaje de error si existe
    if (editProfileErrorMsg) {
        editProfileErrorMsg.textContent = "";
        editProfileErrorMsg.classList.add('hidden');
    }
    
    // Cambiar estado del botón
    if (saveProfileChanges) {
        saveProfileChanges.disabled = true;
        saveProfileChanges.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white mr-2 inline-block"></div> Guardando...';
    }
    
    try {
        // Obtener usuario actual
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            throw new Error("No hay usuario autenticado");
        }
        
        // Verificar duplicados de nombre
        const nuevoNombre = editUsername.value.trim();
        let esDuplicado = false;
        
        try {
            const usersRef = firebase.firestore().collection("usuarios");
            const querySnapshot = await usersRef.where("nombre", "==", nuevoNombre).get();
            
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.uid !== currentUser.uid) {
                    esDuplicado = true;
                }
            });
        } catch (error) {
            console.error("Error al verificar duplicados:", error);
        }
        
        if (esDuplicado) {
            throw new Error("Este nombre de usuario ya está en uso");
        }
        
        // Datos a actualizar
        const updateData = {
            nombre: nuevoNombre,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Si hay un banner seleccionado, añadirlo
        if (selectedBannerId !== null) {
            if (selectedBannerId === "") {
                // Si seleccionó "Sin banner", usar null explícitamente
                updateData.bannerId = null;
            } else {
                updateData.bannerId = selectedBannerId;
            }
        }
        
        console.log("Datos a actualizar:", updateData);
        
        // Primero, buscar el documento del usuario para asegurarnos que existe
        const usersRef = firebase.firestore().collection("usuarios");
        const userQuery = await usersRef.where("uid", "==", currentUser.uid).get();
        
        let userDocRef = null;
        let isNewUser = false;
        
        if (!userQuery.empty) {
            userDocRef = userQuery.docs[0].ref;
        } else {
            // Si no existe, preparar para crear uno nuevo
            isNewUser = true;
            console.log("No se encontró documento del usuario, se creará uno nuevo");
        }
        
        // Si hay nueva foto de perfil, procesarla
        if (newProfilePhoto) {
            try {
                console.log("Procesando nueva foto de perfil");
                
                // Generar un nombre único para la foto
                const timestamp = Date.now();
                const fileName = `profile_${currentUser.uid}_${timestamp}`;
                
                // Crear referencia en Storage
                const storageRef = firebase.storage().ref();
                const photoRef = storageRef.child(`profile_photos/${currentUser.uid}/${fileName}`);
                
                console.log("Subiendo imagen a:", `profile_photos/${currentUser.uid}/${fileName}`);
                
                // Usar un método más directo para subir
                try {
                    // Subir la imagen con un método que devuelve una promesa
                    const uploadResult = await photoRef.put(newProfilePhoto);
                    console.log("Imagen subida correctamente, resultado:", uploadResult);
                    
                    try {
                        // Obtener URL de descarga
                        const photoURL = await uploadResult.ref.getDownloadURL();
                        console.log("URL de foto obtenida:", photoURL);
                        
                        // Actualizar datos
                        updateData.photoURL = photoURL;
                        
                        try {
                            // Actualizar en Auth directamente
                            await currentUser.updateProfile({
                                displayName: nuevoNombre,
                                photoURL: photoURL
                            });
                            console.log("Perfil de Auth actualizado correctamente");
                        } catch (authError) {
                            console.error("Error al actualizar perfil en Auth:", authError);
                            throw new Error("Error al actualizar perfil de autenticación: " + authError.message);
                        }
                    } catch (urlError) {
                        console.error("Error al obtener URL de la foto:", urlError);
                        throw new Error("Error al obtener URL de la foto: " + urlError.message);
                    }
                } catch (uploadError) {
                    console.error("Error al subir la imagen:", uploadError);
                    throw new Error("Error al subir la imagen: " + uploadError.message);
                }
            } catch (photoError) {
                console.error("Error en todo el proceso de la foto:", photoError);
                throw new Error("Error al procesar la foto: " + photoError.message);
            }
        } else {
            try {
                // Solo actualizar el nombre en Auth
                await currentUser.updateProfile({
                    displayName: nuevoNombre
                });
                console.log("Nombre actualizado en Auth correctamente");
            } catch (authError) {
                console.error("Error al actualizar nombre en Auth:", authError);
                throw new Error("Error al actualizar nombre: " + authError.message);
            }
        }
        
        // Actualizar o crear documento en Firestore
        try {
            if (!isNewUser) {
                // Actualizar documento existente
                console.log("Actualizando documento existente con:", updateData);
                await userDocRef.update(updateData);
                console.log("Documento actualizado correctamente");
            } else {
                // Crear nuevo documento
                const newUserData = {
                    uid: currentUser.uid,
                    nombre: nuevoNombre,
                    email: currentUser.email,
                    photoURL: updateData.photoURL || currentUser.photoURL || null,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    puntos: 0,
                    victorias: 0,
                    torneos: []
                };
                
                // Añadir bannerId si existe
                if (updateData.bannerId !== undefined) {
                    newUserData.bannerId = updateData.bannerId;
                }
                
                console.log("Creando nuevo documento con:", newUserData);
                await usersRef.add(newUserData);
                console.log("Nuevo documento creado correctamente");
            }
            
            // Mostrar éxito
            mostrarNotificacion("Perfil actualizado correctamente", "success");
            
            // Cerrar modal y recargar
            const editProfileModal = document.getElementById('editProfileModal');
            if (editProfileModal) {
                editProfileModal.classList.add('hidden');
                editProfileModal.classList.remove('flex');
            }
            
            // Recargar página después de un momento
            console.log("Recargando página en 1 segundo...");
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
        } catch (firestoreError) {
            console.error("Error al actualizar Firestore:", firestoreError);
            throw new Error("Error al actualizar base de datos: " + firestoreError.message);
        }
        
    } catch (error) {
        console.error("Error general al guardar cambios:", error);
        
        if (editProfileErrorMsg) {
            editProfileErrorMsg.textContent = "Error al guardar cambios: " + (error.message || "Error desconocido");
            editProfileErrorMsg.classList.remove('hidden');
        }
        
        mostrarNotificacion("Error al guardar cambios en el perfil: " + (error.message || "Error desconocido"), "error");
        
    } finally {
        // Restaurar botón siempre
        console.log("Restaurando botón");
        if (saveProfileChanges) {
            saveProfileChanges.disabled = false;
            saveProfileChanges.textContent = "Guardar Cambios";
        }
    }
}

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = "info") {
    // Verificar si la función ya existe globalmente
    if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion(mensaje, tipo);
        return;
    }
    
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

// Exponer funciones a nivel global
window.loadProfile = loadProfile;
window.renderProfileTemplate = renderProfileTemplate;
window.mostrarNotificacion = mostrarNotificacion;
window.initializeProfile = initializeProfile;
