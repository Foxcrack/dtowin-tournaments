// Importar Firebase
import { auth, db, storage } from './firebase.js';

// Función principal para cargar el perfil
export async function loadProfile() {
    console.log("Cargando perfil...");
    
    // Verificar si hay un usuario autenticado
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
        // Si no hay usuario autenticado, mostrar mensaje
        const profileContainer = document.getElementById('profileContainer');
        if (profileContainer) {
            profileContainer.innerHTML = `
                <div class="bg-white rounded-xl shadow-lg p-8 max-w-4xl mx-auto text-center">
                    <i class="fas fa-user-lock text-gray-400 text-5xl mb-4"></i>
                    <h2 class="text-2xl font-bold text-gray-700 mb-2">Acceso Restringido</h2>
                    <p class="text-gray-600 mb-6">Debes iniciar sesión para ver tu perfil.</p>
                    <button id="loginFromProfileBtn" class="dtowin-primary text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition">
                        Iniciar Sesión
                    </button>
                </div>
            `;
            
            // Configurar botón de login
            const loginBtn = document.getElementById('loginFromProfileBtn');
            if (loginBtn) {
                loginBtn.addEventListener('click', () => {
                    const loginModal = document.getElementById('loginModal');
                    if (loginModal) {
                        loginModal.classList.remove('hidden');
                        loginModal.classList.add('flex');
                    }
                });
            }
        }
        return;
    }
    
    // Renderizar plantilla de perfil
    if (typeof window.renderProfileTemplate === 'function') {
        window.renderProfileTemplate();
    } else {
        console.error("Función renderProfileTemplate no disponible");
    }
    
    try {
        // Obtener datos del usuario desde Firestore
        const userDoc = await db.collection('usuarios').doc(currentUser.uid).get();
        
        // Verificar si existe el documento del usuario
        if (!userDoc.exists) {
            console.log("No existe documento para este usuario, creando uno nuevo...");
            
            // Crear documento de usuario si no existe
            await db.collection('usuarios').doc(currentUser.uid).set({
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Usuario',
                email: currentUser.email,
                photoURL: currentUser.photoURL || 'dtowin.png',
                customName: '',
                bannerId: '',
                points: 0,
                tournaments: 0,
                wins: 0,
                createdAt: new Date()
            });
            
            // Volver a obtener el documento
            const newUserDoc = await db.collection('usuarios').doc(currentUser.uid).get();
            updateProfileUI(newUserDoc.data(), true);
        } else {
            // Actualizar UI con datos existentes
            updateProfileUI(userDoc.data(), true);
        }
        
        // Cargar badges del usuario
        await loadUserBadges(currentUser.uid);
        
        // Cargar torneos del usuario
        await loadUserTournaments(currentUser.uid);
        
    } catch (error) {
        console.error("Error al cargar perfil:", error);
        if (typeof window.mostrarNotificacion === 'function') {
            window.mostrarNotificacion("Error al cargar el perfil", "error");
        }
    }
}

// Función para actualizar la UI del perfil
function updateProfileUI(userData, isOwnProfile = false) {
    console.log("Actualizando UI del perfil con datos:", userData);
    
    // Actualizar avatar
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.src = userData.photoURL || 'dtowin.png';
    }
    
    // Actualizar nombre de usuario (priorizar nombre personalizado si existe)
    const profileUsername = document.getElementById('profileUsername');
    if (profileUsername) {
        profileUsername.textContent = userData.customName || userData.displayName || 'Usuario';
    }
    
    // Actualizar estadísticas
    const profilePoints = document.getElementById('profilePoints');
    if (profilePoints) {
        profilePoints.textContent = userData.points || 0;
    }
    
    const profileTournaments = document.getElementById('profileTournaments');
    if (profileTournaments) {
        profileTournaments.textContent = userData.tournaments || 0;
    }
    
    const profileWins = document.getElementById('profileWins');
    if (profileWins) {
        profileWins.textContent = userData.wins || 0;
    }
    
    // Ranking (pendiente de implementar lógica real)
    const profileRanking = document.getElementById('profileRanking');
    if (profileRanking) {
        profileRanking.textContent = "#" + (userData.ranking || 0);
    }
    
    // Mostrar opciones de perfil solo si es el propio perfil
    const profileOptions = document.getElementById('profileOptions');
    if (profileOptions) {
        if (isOwnProfile) {
            profileOptions.classList.remove('hidden');
            
            // Configurar botón de editar perfil
            const editProfileBtn = document.getElementById('editProfileBtn');
            if (editProfileBtn) {
                editProfileBtn.addEventListener('click', () => showEditProfileModal(userData));
            }
        } else {
            profileOptions.classList.add('hidden');
        }
    }
    
    // Aplicar banner si existe
    if (userData.bannerId) {
        applyProfileBanner(userData.bannerId);
    }
}

// Función para cargar los badges del usuario
async function loadUserBadges(userId) {
    const userBadgesContainer = document.getElementById('userBadges');
    if (!userBadgesContainer) return;
    
    try {
        // Obtener badges asignados al usuario
        const userBadgesSnapshot = await db.collection('user_badges')
            .where('userId', '==', userId)
            .get();
        
        if (userBadgesSnapshot.empty) {
            userBadgesContainer.innerHTML = `
                <p class="text-center text-gray-500 py-4">No tienes badges aún. ¡Participa en torneos para conseguirlos!</p>
            `;
            return;
        }
        
        // Array para almacenar promesas de obtención de badges
        const badgePromises = [];
        
        userBadgesSnapshot.forEach(doc => {
            const badgeData = doc.data();
            // Obtener detalles del badge
            badgePromises.push(
                db.collection('badges').doc(badgeData.badgeId).get()
            );
        });
        
        // Esperar a que se resuelvan todas las promesas
        const badgeResults = await Promise.all(badgePromises);
        
        // Generar HTML para los badges
        let badgesHTML = '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">';
        
        badgeResults.forEach(badgeDoc => {
            if (badgeDoc.exists) {
                const badge = badgeDoc.data();
                badgesHTML += `
                    <div class="bg-white rounded-lg shadow p-4 flex flex-col items-center text-center">
                        <div class="h-16 w-16 rounded-full overflow-hidden flex items-center justify-center mb-3" 
                             style="background-color: ${badge.color || '#ff6b1a'}">
                            ${badge.imageUrl 
                                ? `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="h-12 w-12 object-contain">` 
                                : `<i class="fas fa-${badge.icono || 'trophy'} text-white text-2xl"></i>`
                            }
                        </div>
                        <h4 class="font-semibold">${badge.nombre}</h4>
                        <p class="text-sm text-gray-600 mt-1">${badge.descripcion || ''}</p>
                    </div>
                `;
            }
        });
        
        badgesHTML += '</div>';
        userBadgesContainer.innerHTML = badgesHTML;
        
    } catch (error) {
        console.error("Error al cargar badges:", error);
        userBadgesContainer.innerHTML = `
            <p class="text-center text-red-500 py-4">Error al cargar badges. Intenta de nuevo más tarde.</p>
        `;
    }
}

// Función para cargar los torneos del usuario
async function loadUserTournaments(userId) {
    const userTournamentsContainer = document.getElementById('userTournaments');
    if (!userTournamentsContainer) return;
    
    try {
        // Obtener participaciones en torneos
        const participationsSnapshot = await db.collection('tournament_participants')
            .where('userId', '==', userId)
            .get();
        
        if (participationsSnapshot.empty) {
            userTournamentsContainer.innerHTML = `
                <p class="text-center text-gray-500 py-4">No has participado en ningún torneo aún.</p>
            `;
            return;
        }
        
        // Array para almacenar promesas de obtención de torneos
        const tournamentPromises = [];
        const participations = [];
        
        participationsSnapshot.forEach(doc => {
            const participationData = doc.data();
            participations.push(participationData);
            
            // Obtener detalles del torneo
            tournamentPromises.push(
                db.collection('tournaments').doc(participationData.tournamentId).get()
            );
        });
        
        // Esperar a que se resuelvan todas las promesas
        const tournamentResults = await Promise.all(tournamentPromises);
        
        // Generar HTML para los torneos
        let tournamentsHTML = '<div class="space-y-4">';
        
        tournamentResults.forEach((tournamentDoc, index) => {
            if (tournamentDoc.exists) {
                const tournament = tournamentDoc.data();
                const participation = participations[index];
                
                // Determinar estado de participación
                let statusClass = 'bg-gray-200 text-gray-700';
                let statusText = 'Pendiente';
                
                if (participation.position === 1) {
                    statusClass = 'bg-yellow-400 text-yellow-900';
                    statusText = 'Ganador';
                } else if (participation.position > 0) {
                    statusClass = 'bg-blue-200 text-blue-800';
                    statusText = `Posición #${participation.position}`;
                } else if (tournament.status === 'completed') {
                    statusClass = 'bg-red-200 text-red-800';
                    statusText = 'No clasificado';
                }
                
                tournamentsHTML += `
                    <div class="bg-white rounded-lg shadow p-4">
                        <div class="flex justify-between items-center">
                            <h4 class="font-semibold">${tournament.title || 'Torneo sin nombre'}</h4>
                            <span class="px-3 py-1 rounded-full text-xs font-medium ${statusClass}">
                                ${statusText}
                            </span>
                        </div>
                        <p class="text-sm text-gray-600 mt-1">
                            ${tournament.description || 'Sin descripción'}
                        </p>
                        <div class="flex justify-between items-center mt-3 text-sm">
                            <span class="text-gray-500">
                                <i class="far fa-calendar mr-1"></i>
                                ${tournament.date ? new Date(tournament.date.toDate()).toLocaleDateString() : 'Fecha no disponible'}
                            </span>
                            <a href="torneo.html?id=${tournamentDoc.id}" class="text-blue-500 hover:underline">
                                Ver detalles
                            </a>
                        </div>
                    </div>
                `;
            }
        });
        
        tournamentsHTML += '</div>';
        userTournamentsContainer.innerHTML = tournamentsHTML;
        
    } catch (error) {
        console.error("Error al cargar torneos:", error);
        userTournamentsContainer.innerHTML = `
            <p class="text-center text-red-500 py-4">Error al cargar torneos. Intenta de nuevo más tarde.</p>
        `;
    }
}

// Mostrar opciones adicionales para el propio perfil
function showProfileOptions() {
    const profileOptionsContainer = document.getElementById('profileOptions');
    if (!profileOptionsContainer) return;
    
    profileOptionsContainer.classList.remove('hidden');
    
    // Configurar botón de editar perfil
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', showEditProfileModal);
    }
    
    // Configurar botón de cerrar sesión
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            });
        });
    }
}

// Función para mostrar el modal de edición de perfil
async function showEditProfileModal() {
    try {
        // Verificar si el usuario está autenticado
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error("Usuario no autenticado");
            return;
        }
        
        // Obtener datos actuales del usuario
        const userRef = doc(db, "usuarios", currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            console.error("Documento de usuario no encontrado");
            return;
        }
        
        const userData = userSnap.data();
        
        // Verificar si ya existe un modal de edición
        let editModal = document.getElementById('editProfileModal');
        
        if (editModal) {
            // Si ya existe, solo mostrarlo
            editModal.classList.remove('hidden');
            editModal.classList.add('flex');
            return;
        }
        
        // Cargar banners disponibles
        const bannersRef = collection(db, "banners");
        const bannersQuery = query(bannersRef, where("activo", "==", true));
        const bannersSnapshot = await getDocs(bannersQuery);
        
        let bannersOptions = '';
        bannersSnapshot.forEach(doc => {
            const banner = doc.data();
            bannersOptions += `
                <option value="${doc.id}" ${userData.bannerId === doc.id ? 'selected' : ''}>
                    ${banner.nombre || 'Banner sin nombre'}
                </option>
            `;
        });
        
        // Crear modal de edición
        editModal = document.createElement('div');
        editModal.id = 'editProfileModal';
        editModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
        editModal.innerHTML = `
            <div class="bg-white rounded-xl max-w-md w-full p-6 relative">
                <button id="closeEditModal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
                <div class="text-center mb-6">
                    <h3 class="text-2xl font-bold text-gray-800">Editar Perfil</h3>
                    <p class="text-gray-600">Personaliza tu perfil</p>
                </div>
                
                <form id="editProfileForm">
                    <div class="mb-4">
                        <label class="block text-gray-700 text-sm font-bold mb-2" for="customName">
                            Nombre personalizado
                        </label>
                        <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" 
                            id="customName" 
                            type="text" 
                            placeholder="Tu nombre personalizado"
                            value="${userData.customName || userData.nombre || ''}">
                        <p class="text-xs text-gray-500 mt-1">Este nombre se mostrará en tu perfil</p>
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-gray-700 text-sm font-bold mb-2" for="profileBanner">
                            Banner de perfil
                        </label>
                        <select class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" 
                            id="profileBanner">
                            <option value="">Sin banner</option>
                            ${bannersOptions}
                        </select>
                        <p class="text-xs text-gray-500 mt-1">Selecciona un banner para personalizar tu perfil</p>
                    </div>
                    
                    <div id="bannerPreview" class="mb-6 rounded-lg overflow-hidden h-24 bg-gray-200 flex items-center justify-center">
                        <p class="text-gray-500 text-sm">Vista previa del banner</p>
                    </div>
                    
                    <div class="flex justify-end">
                        <button type="button" id="cancelEditBtn" class="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-400 transition mr-2">
                            Cancelar
                        </button>
                        <button type="submit" class="dtowin-primary text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition">
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        // Añadir modal al DOM
        document.body.appendChild(editModal);
        
        // Configurar eventos
        const closeEditModal = document.getElementById('closeEditModal');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const editProfileForm = document.getElementById('editProfileForm');
        const profileBannerSelect = document.getElementById('profileBanner');
        const bannerPreview = document.getElementById('bannerPreview');
        
        // Función para cerrar el modal
        const closeModal = () => {
            editModal.classList.add('hidden');
            editModal.classList.remove('flex');
        };
        
        // Configurar cierre del modal
        if (closeEditModal) closeEditModal.addEventListener('click', closeModal);
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeModal);
        
        // Actualizar vista previa del banner cuando cambia la selección
        if (profileBannerSelect) {
            // Mostrar vista previa inicial si hay un banner seleccionado
            updateBannerPreview(profileBannerSelect.value);
            
            profileBannerSelect.addEventListener('change', (e) => {
                updateBannerPreview(e.target.value);
            });
        }
        
        // Manejar envío del formulario
        if (editProfileForm) {
            editProfileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const customName = document.getElementById('customName').value.trim();
                const bannerId = document.getElementById('profileBanner').value;
                
                try {
                    // Actualizar datos del usuario
                    await updateDoc(userRef, {
                        customName: customName,
                        bannerId: bannerId
                    });
                    
                    // Cerrar modal
                    closeModal();
                    
                    // Recargar perfil
                    window.location.reload();
                    
                } catch (error) {
                    console.error("Error al actualizar perfil:", error);
                    alert("Error al guardar cambios. Por favor, intenta de nuevo.");
                }
            });
        }
        
        // Función para actualizar vista previa del banner
        async function updateBannerPreview(bannerId) {
            if (!bannerPreview) return;
            
            if (!bannerId) {
                bannerPreview.innerHTML = `<p class="text-gray-500 text-sm">Sin banner seleccionado</p>`;
                bannerPreview.style.backgroundImage = 'none';
                return;
            }
            
            try {
                const bannerRef = doc(db, "banners", bannerId);
                const bannerSnap = await getDoc(bannerRef);
                
                if (bannerSnap.exists()) {
                    const bannerData = bannerSnap.data();
                    if (bannerData.imageUrl) {
                        bannerPreview.innerHTML = '';
                        bannerPreview.style.backgroundImage = `url(${bannerData.imageUrl})`;
                        bannerPreview.style.backgroundSize = 'cover';
                        bannerPreview.style.backgroundPosition = 'center';
                    } else {
                        bannerPreview.innerHTML = `<p class="text-gray-500 text-sm">Banner sin imagen</p>`;
                    }
                }
            } catch (error) {
                console.error("Error al cargar vista previa del banner:", error);
                bannerPreview.innerHTML = `<p class="text-red-500 text-sm">Error al cargar vista previa</p>`;
            }
        }
        
    } catch (error) {
        console.error("Error al mostrar modal de edición:", error);
    }
}

// Función para aplicar banner al perfil
async function applyProfileBanner(userData) {
    if (!userData.bannerId) return;
    
    try {
        const bannerRef = doc(db, "banners", userData.bannerId);
        const bannerSnap = await getDoc(bannerRef);
        
        if (!bannerSnap.exists()) return;
        
        const bannerData = bannerSnap.data();
        if (!bannerData.imageUrl) return;
        
        // Aplicar banner al encabezado del perfil
        const profileHeader = document.querySelector('.gradient-background');
        if (profileHeader) {
            profileHeader.style.backgroundImage = `url(${bannerData.imageUrl})`;
            profileHeader.style.backgroundSize = 'cover';
            profileHeader.style.backgroundPosition = 'center';
            
            // Añadir overlay para mejorar legibilidad
            profileHeader.style.position = 'relative';
            
            // Verificar si ya existe un overlay
            let overlay = profileHeader.querySelector('.banner-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'banner-overlay absolute inset-0';
                overlay.style.background = 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7))';
                overlay.style.zIndex = '1';
                profileHeader.appendChild(overlay);
                
                // Asegurar que el contenido esté por encima del overlay
                const contentContainer = profileHeader.querySelector('.flex');
                if (contentContainer) {
                    contentContainer.style.position = 'relative';
                    contentContainer.style.zIndex = '2';
                }
            }
        }
    } catch (error) {
        console.error("Error al aplicar banner:", error);
    }
}

// Modificar la función updateProfileInfo para usar el nombre personalizado y aplicar el banner
function updateProfileInfo(userData) {
    // Actualizar nombre de usuario (priorizar nombre personalizado si existe)
    const profileUsername = document.getElementById('profileUsername');
    if (profileUsername) {
        profileUsername.textContent = userData.customName || userData.nombre || 'Usuario';
    }
    
    // Actualizar foto de perfil
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.src = userData.photoURL || 'dtowin.png';
        profileAvatar.alt = userData.customName || userData.nombre || 'Usuario';
    }
    
    // Aplicar banner si existe
    if (userData.bannerId) {
        applyProfileBanner(userData);
    }
    
    // Actualizar datos estadísticos
    updateProfileStats(userData);
}
