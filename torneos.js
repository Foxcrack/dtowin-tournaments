// Script para la gestión de torneos en la página principal
import { auth, db, isAuthenticated } from './firebase.js';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    query, 
    where, 
    orderBy, 
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Import registration and brackets modules
import { showRegistrationModal, unregisterFromTournament, getTournamentParticipantsInfo, hasUserRegisteredWithInfo, initRegistrationModule } from './registration.js';

// Global variable to store participants info
let participantsInfoCache = {};

// Initialize registration module
document.addEventListener('DOMContentLoaded', () => {
    initRegistrationModule();
});

// Get color according to tournament status
function getStatusColor(estado) {
    switch(estado) {
        case 'Abierto':
            return 'green-500';
        case 'Check In':
            return 'purple-500';
        case 'En Progreso':
            return 'yellow-500';
        case 'Próximamente':
            return 'blue-500';
        case 'Finalizado':
            return 'gray-500';
        default:
            return 'gray-500';
    }
}

// Render points by position
function renderPuntosPosicion(puntosPosicion) {
    if (!puntosPosicion) return 'No hay información de puntos';
    
    let html = '';
    const colors = ['yellow-500', 'gray-400', 'red-500', 'blue-400', 'purple-400'];
    
    for (let i = 1; i <= 5; i++) {
        if (puntosPosicion[i] !== undefined) {
            const colorClass = colors[i-1] || 'gray-500';
            html += `
                <span class="bg-${colorClass} text-white rounded-full px-3 py-1 text-xs">
                    ${i}° - ${puntosPosicion[i]} pts
                </span>
            `;
        }
    }
    
    return html || 'No hay información de puntos';
}

// Show error message
function showErrorMessage() {
    const containers = [
        document.getElementById('torneos-en-proceso'),
        document.getElementById('torneos-abiertos'),
        document.getElementById('torneos-proximos'),
        document.getElementById('torneos-checkin') // Añadir contenedor de check-in
    ];
    
    containers.forEach(container => {
        if (container) {
            container.innerHTML = `
                <div class="col-span-full text-center p-4">
                    <p class="text-red-500">Error al cargar torneos. Inténtalo de nuevo.</p>
                    <button class="text-blue-500 underline mt-2" onclick="window.location.reload()">
                        Recargar página
                    </button>
                </div>
            `;
        }
    });
}

// Show notification
function mostrarNotificacion(mensaje, tipo = "info") {
    // Check if notification function exists in window
    if (typeof window.mostrarNotificacion === "function") {
        window.mostrarNotificacion(mensaje, tipo);
        return;
    }
    
    // Verify if a notification already exists
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    
    // Classes based on notification type
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
    
    // Notification styles
    notification.className = `notification fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center`;
    notification.innerHTML = `
        <i class="fas fa-${icon} mr-2"></i>
        <span>${mensaje}</span>
    `;
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('opacity-0');
        notification.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 3000);
}

// Get banner data for a tournament
async function getBannerForTournament(torneo) {
    try {
        // If the tournament already has an image URL, use it
        if (torneo.imageUrl) {
            return torneo.imageUrl;
        }
        
        // If the tournament has a bannerId, get the corresponding banner
        if (torneo.bannerId) {
            const bannerDoc = await getDoc(doc(db, "banners", torneo.bannerId));
            
            if (bannerDoc.exists()) {
                const bannerData = bannerDoc.data();
                // Use imageData or imageUrl from the banner
                return bannerData.imageData || bannerData.imageUrl || null;
            }
        }
        
        // If the tournament has a bannerRef, get the banner by reference
        if (torneo.bannerRef) {
            const bannerDoc = await getDoc(torneo.bannerRef);
            
            if (bannerDoc.exists()) {
                const bannerData = bannerDoc.data();
                return bannerData.imageData || bannerData.imageUrl || null;
            }
        }
        
        // Try to search by tournament name (fallback solution)
        if (torneo.nombre) {
            const bannersRef = collection(db, "banners");
            const q = query(bannersRef, where("nombre", "==", torneo.nombre.split(' ')[0]), limit(1));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const bannerData = querySnapshot.docs[0].data();
                return bannerData.imageData || bannerData.imageUrl || null;
            }
        }
        
        return null;
    } catch (error) {
        console.error("Error getting banner for tournament:", error);
        return null;
    }
}

// Get badges assigned to a tournament
async function getTournamentBadges(torneoId) {
    try {
        if (!torneoId) {
            throw new Error("Tournament ID is required");
        }
        
        const tournamentBadgesCollection = collection(db, "tournament_badges");
        const q = query(tournamentBadgesCollection, where("tournamentId", "==", torneoId));
        const querySnapshot = await getDocs(q);
        
        // If no badges are assigned, return empty array
        if (querySnapshot.empty) return [];
        
        // Get details of each badge
        const badgesData = [];
        for (const doc of querySnapshot.docs) {
            const badgeAssignment = doc.data();
            const badgeRef = await getDoc(doc(db, "badges", badgeAssignment.badgeId));
            
            if (badgeRef.exists()) {
                badgesData.push({
                    id: doc.id,
                    ...badgeAssignment,
                    badge: {
                        id: badgeAssignment.badgeId,
                        ...badgeRef.data()
                    }
                });
            }
        }
        
        return badgesData;
    } catch (error) {
        console.error("Error getting tournament badges:", error);
        return [];
    }
}

// Función para realizar check-in en un torneo
async function realizarCheckIn(torneoId) {
    try {
        // Verificar si el usuario está autenticado
        if (!isAuthenticated()) {
            throw new Error("Debes iniciar sesión para hacer check-in");
        }
        
        const user = auth.currentUser;
        
        // Verificar si el usuario está inscrito en el torneo
        const torneoRef = doc(db, "torneos", torneoId);
        const torneoSnap = await getDoc(torneoRef);
        
        if (!torneoSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const torneoData = torneoSnap.data();
        const participants = torneoData.participants || [];
        
        if (!participants.includes(user.uid)) {
            throw new Error("No estás inscrito en este torneo");
        }
        
        // Verificar si el torneo está en estado de check-in
        if (torneoData.estado !== 'Check In') {
            throw new Error("Este torneo no está en período de check-in");
        }
        
        // Verificar si el usuario ya hizo check-in
        const checkedInParticipants = torneoData.checkedInParticipants || [];
        if (checkedInParticipants.includes(user.uid)) {
            throw new Error("Ya has confirmado tu asistencia a este torneo");
        }
        
        // Actualizar el documento con el estado de check-in
        await updateDoc(torneoRef, {
            checkedInParticipants: [...checkedInParticipants, user.uid],
            updatedAt: serverTimestamp()
        });
        
        // También actualizar la información en participant_info si existe
        const participantInfoRef = collection(db, "participant_info");
        const q = query(
            participantInfoRef, 
            where("userId", "==", user.uid),
            where("tournamentId", "==", torneoId),
            where("active", "!=", false)
        );
        
        const infoSnapshot = await getDocs(q);
        
        if (!infoSnapshot.empty) {
            await updateDoc(doc(db, "participant_info", infoSnapshot.docs[0].id), {
                checkedIn: true,
                checkedInAt: serverTimestamp()
            });
        }
        
        console.log("Check-in realizado correctamente");
        mostrarNotificacion("Has confirmado tu asistencia correctamente", "success");
        return true;
        
    } catch (error) {
        console.error("Error al hacer check-in:", error);
        mostrarNotificacion(`Error: ${error.message}`, "error");
        throw error;
    }
}

// Main function to load tournaments
async function loadTournaments() {
    try {
        console.log("Loading tournaments...");
        
        // Containers for different types of tournaments
        const enProcesoContainer = document.getElementById('torneos-en-proceso');
        const abiertosContainer = document.getElementById('torneos-abiertos');
        const proximosContainer = document.getElementById('torneos-proximos');
        const checkInContainer = document.getElementById('torneos-checkin'); // Nuevo contenedor para check-in
        
        // Verify if containers exist
        if (!enProcesoContainer && !abiertosContainer && !proximosContainer && !checkInContainer) {
            console.error("Containers for tournaments not found");
            return;
        }
        
        // Show loading indicators for containers that exist
        const loadingHTML = `
            <div class="col-span-full flex justify-center items-center p-4">
                <div class="spinner w-8 h-8 border-t-4 border-b-4 border-blue-500 rounded-full"></div>
            </div>
        `;
        
        if (enProcesoContainer) enProcesoContainer.innerHTML = loadingHTML;
        if (abiertosContainer) abiertosContainer.innerHTML = loadingHTML;
        if (proximosContainer) proximosContainer.innerHTML = loadingHTML;
        if (checkInContainer) checkInContainer.innerHTML = loadingHTML;
        
        try {
            // Get all visible tournaments
            const torneosRef = collection(db, "torneos");
            const q = query(torneosRef, where("visible", "!=", false));
            const querySnapshot = await getDocs(q);
            
            // Classify tournaments by status
            const torneosEnProceso = [];
            const torneosAbiertos = [];
            const torneosProximos = [];
            const torneosCheckIn = []; // Nuevo array para torneos en check-in
            
            // Process each tournament and get its banner data
            const torneoPromises = [];
            
            // Clear participants cache
            participantsInfoCache = {};
            
            // Preload participants info for all tournaments
            const allParticipantsPromise = preloadAllParticipantsInfo(querySnapshot.docs.map(doc => doc.id));
            
            // Get current user for filtering
            const currentUser = auth.currentUser;
            
            querySnapshot.forEach(docSnapshot => {
                const torneo = {
                    id: docSnapshot.id,
                    ...docSnapshot.data()
                };
                
                // Add promise to load the banner
                torneoPromises.push(
                    getBannerForTournament(torneo).then(bannerUrl => {
                        if (bannerUrl) {
                            torneo.bannerImageUrl = bannerUrl;
                        }
                        
                        // Add promise to load tournament badges
                        return getTournamentBadges(torneo.id).then(badges => {
                            if (badges && badges.length > 0) {
                                torneo.badges = badges;
                            }
                            
                            // Classify by status
                            if (torneo.estado === 'En Progreso') {
                                torneosEnProceso.push(torneo);
                            } else if (torneo.estado === 'Abierto') {
                                torneosAbiertos.push(torneo);
                            } else if (torneo.estado === 'Próximamente') {
                                torneosProximos.push(torneo);
                            } else if (torneo.estado === 'Check In') {
                                // Mostrar torneos en check-in solo si el usuario está autenticado y está inscrito
                                const participants = torneo.participants || [];
                                
                                if (currentUser && participants.includes(currentUser.uid)) {
                                    torneosCheckIn.push(torneo);
                                }
                                // No añadir a torneosCheckIn si el usuario no está inscrito
                            }
                        });
                    })
                );
            });
            
            // Wait for all tournaments to be processed
            await Promise.all([...torneoPromises, allParticipantsPromise]);
            
            // Sort by date (closest first)
            const sortByDate = (a, b) => {
                const dateA = a.fecha ? new Date(a.fecha.seconds * 1000) : new Date();
                const dateB = b.fecha ? new Date(b.fecha.seconds * 1000) : new Date();
                return dateA - dateB;
            };
            
            torneosEnProceso.sort(sortByDate);
            torneosAbiertos.sort(sortByDate);
            torneosProximos.sort(sortByDate);
            torneosCheckIn.sort(sortByDate);
            
            // Render tournaments in their respective containers if they exist
            if (enProcesoContainer) {
                await renderTournamentSection('en-proceso-section', 'torneos-en-proceso', torneosEnProceso);
            }
            
            if (abiertosContainer) {
                await renderTournamentSection('abiertos-section', 'torneos-abiertos', torneosAbiertos);
            }
            
            if (proximosContainer) {
                await renderTournamentSection('proximos-section', 'torneos-proximos', torneosProximos);
            }
            
            // Render check-in tournaments if container exists
            if (checkInContainer) {
                await renderTournamentSection('checkin-section', 'torneos-checkin', torneosCheckIn);
            }
            
            // Configure registration/unregistration buttons
            setupTournamentButtons();
            
            console.log("Tournaments loaded successfully");
            
        } catch (error) {
            console.error("Error querying tournaments:", error);
            showErrorMessage();
        }
        
    } catch (error) {
        console.error("Error loading tournaments:", error);
        showErrorMessage();
    }
}

// Preload participants info for all tournaments
async function preloadAllParticipantsInfo(tournamentIds) {
    try {
        if (!tournamentIds || tournamentIds.length === 0) {
            return {};
        }
        
        // Query participant_info collection for all active entries
        const participantInfoRef = collection(db, "participant_info");
        
        // Firestore limits to 10 items in 'in' queries
        // Handle this by processing in batches if needed
        const firstBatch = tournamentIds.slice(0, Math.min(10, tournamentIds.length));
        
        const q = query(
            participantInfoRef, 
            where("tournamentId", "in", firstBatch),
            where("active", "!=", false)
        );
        
        const snapshot = await getDocs(q);
        
        // Organize by tournament ID
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!participantsInfoCache[data.tournamentId]) {
                participantsInfoCache[data.tournamentId] = {};
            }
            
            participantsInfoCache[data.tournamentId][data.userId] = {
                id: doc.id,
                playerName: data.playerName,
                discordUsername: data.discordUsername,
                checkedIn: data.checkedIn || false, // Añadir estado de check-in
                ...data
            };
        });
        
        // If more than 10 tournaments, process them in batches
        if (tournamentIds.length > 10) {
            // Process remaining tournaments in batches of 10
            for (let i = 10; i < tournamentIds.length; i += 10) {
                const batch = tournamentIds.slice(i, i + 10);
                if (batch.length === 0) break;
                
                const batchQuery = query(
                    participantInfoRef, 
                    where("tournamentId", "in", batch),
                    where("active", "!=", false)
                );
                
                const batchSnapshot = await getDocs(batchQuery);
                
                batchSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (!participantsInfoCache[data.tournamentId]) {
                        participantsInfoCache[data.tournamentId] = {};
                    }
                    
                    participantsInfoCache[data.tournamentId][data.userId] = {
                        id: doc.id,
                        playerName: data.playerName,
                        discordUsername: data.discordUsername,
                        checkedIn: data.checkedIn || false, // Añadir estado de check-in
                        ...data
                    };
                });
            }
        }
        
        return participantsInfoCache;
    } catch (error) {
        console.error("Error preloading participants info:", error);
        return {};
    }
}

// Render tournament section
async function renderTournamentSection(sectionId, containerId, torneos) {
    const container = document.getElementById(containerId);
    const section = document.getElementById(sectionId);
    
    if (!container || !section) return;
    
    // Show or hide section depending if there are tournaments
    if (torneos.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center p-4">
                <p class="text-gray-500">No hay torneos disponibles en esta categoría</p>
            </div>
        `;
        section.classList.add('hidden');
    } else {
        section.classList.remove('hidden');
        await renderTournaments(containerId, torneos);
    }
}

// Render tournaments in a container
async function renderTournaments(containerId, torneos) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = '';
    
    // Check if user is authenticated
    const userAuthenticated = isAuthenticated();
    const currentUser = auth.currentUser;
    
    for (const torneo of torneos) {
        // Format date
        const fecha = torneo.fecha ? new Date(torneo.fecha.seconds * 1000) : new Date();
        const fechaFormateada = fecha.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        // Format time
        const hora = torneo.hora || '00:00';
        const horaFormateada = hora.substring(0, 5);
        
        // Calculate registrations and capacity
        const participants = torneo.participants || [];
        const inscritos = participants.length;
        const capacidad = torneo.capacidad || '∞';
        const lleno = torneo.capacidad && inscritos >= torneo.capacidad;
        
        // Check if current user is registered
        const estaInscrito = userAuthenticated && currentUser && participants.includes(currentUser.uid);
        
        // Check if user has registered with additional info
        let hasAdditionalInfo = false;
        if (estaInscrito && currentUser) {
            hasAdditionalInfo = participantsInfoCache[torneo.id] && 
                                participantsInfoCache[torneo.id][currentUser.uid];
        }
        
        // Determine registration button state
        let botonInscripcion = '';

        if (torneo.estado === 'Abierto') {
            if (!userAuthenticated) {
                // User not authenticated - Show registration button
                botonInscripcion = `
                    <button class="w-full dtowin-blue text-white py-2 rounded-lg hover:opacity-90 transition font-semibold register-btn">
                        Registrarse para participar
                    </button>
                `;
            } else if (estaInscrito) {
                // User authenticated and registered - Show unregistration button
                botonInscripcion = `
                    <button class="w-full dtowin-red text-white py-2 rounded-lg hover:opacity-90 transition font-semibold desinscribirse-btn" data-torneo-id="${torneo.id}">
                        Desinscribirse
                    </button>
                `;
            } else if (lleno) {
                // Tournament full
                botonInscripcion = `
                    <button class="w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed font-semibold">
                        Cupos Agotados
                    </button>
                `;
            } else {
                // User authenticated but not registered
                botonInscripcion = `
                    <button class="w-full dtowin-blue text-white py-2 rounded-lg hover:opacity-90 transition font-semibold inscribirse-btn" 
                            data-torneo-id="${torneo.id}" data-torneo-nombre="${torneo.nombre || 'Torneo'}">
                        Inscribirse
                    </button>
                `;
            }
        } else if (torneo.estado === 'Check In') {
            if (!userAuthenticated) {
                // Usuario no autenticado - No mostrar botón
                botonInscripcion = `
                    <button class="w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed font-semibold">
                        Período de Check-In
                    </button>
                `;
            } else if (estaInscrito) {
                // Usuario inscrito - Verificar si ya hizo check-in
                const yaHizoCheckIn = (torneo.checkedInParticipants && torneo.checkedInParticipants.includes(currentUser.uid)) ||
                                     (participantsInfoCache[torneo.id] && 
                                      participantsInfoCache[torneo.id][currentUser.uid] && 
                                      participantsInfoCache[torneo.id][currentUser.uid].checkedIn);
        
                if (yaHizoCheckIn) {
                    // Ya hizo check-in
                    botonInscripcion = `
                        <button class="w-full bg-purple-700 text-white py-2 rounded-lg cursor-not-allowed font-semibold">
                            <i class="fas fa-check-circle mr-2"></i> Check-In Completado
                        </button>
                    `;
                } else {
                    // No ha hecho check-in
                    botonInscripcion = `
                        <button class="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition font-semibold checkin-btn" data-torneo-id="${torneo.id}">
                            <i class="fas fa-clipboard-check mr-2"></i> Hacer Check-In
                        </button>
                        <p class="text-xs text-gray-500 mt-1 text-center">Confirma tu asistencia para ser incluido en el bracket</p>
                    `;
                }
            } else {
                // Usuario no inscrito - No mostrar opción de check-in
                botonInscripcion = `
                    <button class="w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed font-semibold">
                        No estás inscrito
                    </button>
                `;
            }
        } else if (torneo.estado === 'En Progreso') {
            // Tournament in progress - Show bracket button
            botonInscripcion = `
                <a href="bracket.html?id=${torneo.id}" class="block w-full bg-yellow-500 text-white py-2 rounded-lg font-semibold text-center hover:bg-yellow-600 transition">
                    Ver Bracket
                </a>
            `;
        } else {
            botonInscripcion = `
                <button class="w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed font-semibold">
                    Próximamente
                </button>
            `;
        }
        
        // Generate HTML for points by position
        const puntosPosicionHTML = renderPuntosPosicion(torneo.puntosPosicion);
        
        // Generate HTML for badges if available
        let badgesHTML = '';
        if (torneo.badges && torneo.badges.length > 0) {
            badgesHTML = `
                <div class="bg-gray-100 rounded-lg p-3 mb-4">
                    <h4 class="font-semibold text-gray-700 mb-2">Badges del torneo:</h4>
                    <div class="flex flex-wrap gap-2">
            `;
            
            // Add up to 3 badges with tooltips
            torneo.badges.slice(0, 3).forEach(badgeAssignment => {
                const badge = badgeAssignment.badge;
                let positionText = '';
                
                switch (badgeAssignment.position) {
                    case 'first':
                        positionText = 'Primer lugar';
                        break;
                    case 'second':
                        positionText = 'Segundo lugar';
                        break;
                    case 'top3':
                        positionText = 'Top 3';
                        break;
                    case 'all':
                        positionText = 'Todos los participantes';
                        break;
                    default:
                        positionText = 'Premio';
                }
                
                badgesHTML += `
                    <div class="relative group">
                        ${badge.imageUrl ? 
                            `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-8 h-8 object-contain" title="${badge.nombre}">` : 
                            `<div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs" style="background-color: ${badge.color || '#ff6b1a'}" title="${badge.nombre}">
                                <i class="fas fa-${badge.icono || 'trophy'}"></i>
                            </div>`
                        }
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 w-max">
                            ${badge.nombre} - ${positionText}
                        </div>
                    </div>
                `;
            });
            
            // If there are more badges, show a counter
            if (torneo.badges.length > 3) {
                badgesHTML += `
                    <div class="relative group">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs bg-gray-500">
                            +${torneo.badges.length - 3}
                        </div>
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 w-max">
                            ${torneo.badges.length - 3} badges más
                        </div>
                    </div>
                `;
            }
            
            badgesHTML += `
                    </div>
                </div>
            `;
        }
        
        // Use banner image if available, otherwise use imageUrl or fallback
        const imageSrc = torneo.bannerImageUrl || torneo.imageUrl || 'https://via.placeholder.com/400x200';
        
        // Tournament HTML
        html += `
            <div class="bg-white rounded-xl shadow-lg overflow-hidden tournament-card transition duration-300" data-torneo-id="${torneo.id}">
                <img src="${imageSrc}" alt="${torneo.nombre}" class="w-full h-48 object-cover">
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <h3 class="text-xl font-bold text-gray-800">${torneo.nombre || 'Torneo sin nombre'}</h3>
                        <span class="bg-${getStatusColor(torneo.estado)} text-white text-xs px-2 py-1 rounded-full">${torneo.estado}</span>
                    </div>
                    <p class="text-gray-600 mb-4">${torneo.descripcion || 'Sin descripción disponible.'}</p>
                    <div class="flex items-center text-gray-500 text-sm mb-4">
                        <i class="far fa-calendar-alt mr-2"></i>
                        <span>${fechaFormateada}</span>
                        <i class="far fa-clock ml-4 mr-2"></i>
                        <span>${horaFormateada}</span>
                    </div>
                    
                    ${badgesHTML}
                    
                    <div class="bg-gray-100 rounded-lg p-3 mb-4">
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="font-semibold text-gray-700">Participantes:</h4>
                            <span class="text-sm font-medium ${lleno ? 'text-red-500' : 'text-green-500'}">${inscritos}/${capacidad}</span>
                        </div>
                        <div class="participants-list text-sm text-gray-600 max-h-20 overflow-y-auto" id="participants-${torneo.id}">
                            <p class="text-center text-gray-500 text-xs">Cargando participantes...</p>
                        </div>
                    </div>
                    <div class="bg-gray-100 rounded-lg p-3 mb-4">
                        <h4 class="font-semibold text-gray-700 mb-2">Puntos por posición:</h4>
                        <div class="flex flex-wrap gap-2">
                            ${puntosPosicionHTML}
                        </div>
                    </div>
                    ${botonInscripcion}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Load participant list for each tournament
    for (const torneo of torneos) {
        await loadParticipants(torneo.id, torneo.participants || []);
    }
}

// Load participants for a tournament
async function loadParticipants(torneoId, participantIds) {
    const container = document.getElementById(`participants-${torneoId}`);
    if (!container) return;
    
    if (!participantIds || participantIds.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 text-xs">No hay participantes inscritos</p>';
        return;
    }
    
    try {
        let html = '<ul class="space-y-1">';
        const maxToShow = Math.min(5, participantIds.length); // Show maximum 5 participants
        
        // Check if we have cached participants info
        const tournamentParticipantsInfo = participantsInfoCache[torneoId] || {};
        
        for (let i = 0; i < maxToShow; i++) {
            try {
                const uid = participantIds[i];
                
                // Try to get player name from cache
                let playerName = null;
                let discordUsername = null;
                let checkedIn = false;
                
                if (tournamentParticipantsInfo[uid]) {
                    playerName = tournamentParticipantsInfo[uid].playerName;
                    discordUsername = tournamentParticipantsInfo[uid].discordUsername;
                    checkedIn = tournamentParticipantsInfo[uid].checkedIn || false;
                }
                
                // If not in cache, try to get from users collection
                if (!playerName) {
                    const usersRef = collection(db, "usuarios");
                    const q = query(usersRef, where("uid", "==", uid), limit(1));
                    const querySnapshot = await getDocs(q);
                    
                    if (!querySnapshot.empty) {
                        const userData = querySnapshot.docs[0].data();
                        playerName = userData.nombre || 'Usuario';
                    } else {
                        playerName = 'Usuario';
                    }
                }
                
                // Add participant to list with check-in status indicator
                html += `
                    <li class="text-xs ${discordUsername ? 'cursor-pointer hover:text-blue-600 group relative' : ''}">
                        <i class="fas fa-user text-gray-400 mr-1"></i>
                        ${playerName}
                        ${checkedIn ? '<i class="fas fa-check-circle text-green-500 ml-1" title="Check-in completado"></i>' : ''}
                        ${discordUsername ? `
                            <div class="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 z-10">
                                Discord: ${discordUsername}
                            </div>
                        ` : ''}
                    </li>
                `;
            } catch (e) {
                console.error(`Error loading individual participant:`, e);
            }
        }
        
        // If there are more participants, show how many more
        if (participantIds.length > maxToShow) {
            html += `
                <li class="text-xs text-center text-gray-500 mt-1">
                    Y ${participantIds.length - maxToShow} participantes más...
                </li>
            `;
        }
        
        html += '</ul>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error(`Error loading participants for tournament ${torneoId}:`, error);
        container.innerHTML = '<p class="text-center text-gray-500 text-xs">Error al cargar participantes</p>';
    }
}

// Configure registration/unregistration buttons
function setupTournamentButtons() {
    // Registration buttons
    document.querySelectorAll('.inscribirse-btn').forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Get tournament ID and name
            const torneoId = this.dataset.torneoId;
            const torneoNombre = this.dataset.torneoNombre;
            
            // Check if user is authenticated
            if (!isAuthenticated()) {
                mostrarNotificacion("Debes iniciar sesión para inscribirte", "error");
                // Open login modal
                const loginBtn = document.getElementById('loginBtn');
                if (loginBtn) loginBtn.click();
                return;
            }
            
            // Show registration form modal
            showRegistrationModal(torneoId, torneoNombre);
        });
    });
    
    // Unregistration buttons
    document.querySelectorAll('.desinscribirse-btn').forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Get tournament ID
            const torneoId = this.dataset.torneoId;
            
            // Check if user is authenticated
            if (!isAuthenticated()) {
                mostrarNotificacion("Debes iniciar sesión para desinscribirte", "error");
                return;
            }
            
            // Confirm action
            if (!confirm("¿Estás seguro que deseas desinscribirte de este torneo?")) {
                return;
            }
            
            // Change button state
            this.disabled = true;
            const originalText = this.textContent;
            this.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
            
            try {
                // Unregister user
                await unregisterFromTournament(torneoId);
                mostrarNotificacion("Te has desinscrito del torneo correctamente", "success");
                
                // Reload tournaments to update UI
                await loadTournaments();
            } catch (error) {
                console.error("Error unregistering:", error);
                mostrarNotificacion(error.message || "Error al desinscribirse del torneo", "error");
                
                // Restore button
                this.disabled = false;
                this.textContent = originalText;
            }
        });
    });
    
    // Check-in buttons
    document.querySelectorAll('.checkin-btn').forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Get tournament ID
            const torneoId = this.dataset.torneoId;
            
            // Check if user is authenticated
            if (!isAuthenticated()) {
                mostrarNotificacion("Debes iniciar sesión para hacer check-in", "error");
                return;
            }
            
            // Confirm action
            if (!confirm("¿Confirmas tu asistencia a este torneo? Esta acción es necesaria para participar en el bracket.")) {
                return;
            }
            
            // Change button state
            this.disabled = true;
            const originalText = this.textContent;
            this.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
            
            try {
                // Realizar check-in
                await realizarCheckIn(torneoId);
                
                // Cambiar el estado del botón a confirmado
                this.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Check-In Completado';
                this.classList.remove('bg-purple-600', 'hover:bg-purple-700');
                this.classList.add('bg-purple-700', 'cursor-not-allowed');
                this.disabled = true;
                
                // No es necesario recargar toda la página, ya actualizamos el botón manualmente
            } catch (error) {
                console.error("Error en check-in:", error);
                mostrarNotificacion(error.message || "Error al confirmar asistencia", "error");
                
                // Restore button
                this.disabled = false;
                this.innerHTML = originalText;
            }
        });
    });
    
    // Registration buttons for non-authenticated users
    document.querySelectorAll('.register-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Show message and redirect to registration
            mostrarNotificacion("Para participar en torneos, primero debes registrarte", "info");
            
            // Open registration modal
            const registerBtn = document.getElementById('registerBtn');
            if (registerBtn) {
                setTimeout(() => {
                    registerBtn.click();
                }, 1000);
            } else {
                // Alternative: open login modal
                const loginBtn = document.getElementById('loginBtn');
                if (loginBtn) loginBtn.click();
            }
        });
    });
}

// Exportar funciones para uso en otros módulos
export {
    loadTournaments,
    getTournamentBadges
};
