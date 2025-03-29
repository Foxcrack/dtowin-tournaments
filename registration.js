// registration.js - Module for handling tournament registration with additional information
import { auth, db, isAuthenticated } from './firebase.js';
import { 
    collection, 
    addDoc, 
    getDoc, 
    doc, 
    updateDoc, 
    query, 
    where, 
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// DOM Elements for Registration Modal
let registrationModal;
let closeRegistrationModalBtn;
let tournamentRegistrationForm;
let playerNameInput;
let discordUsernameInput;
let registrationSubmitBtn;
let registrationErrorMsg;
let currentTournamentId = null;

// Initialize the registration module
export function initRegistrationModule() {
    console.log("Initializing registration module...");
    
    // Create the registration modal if it doesn't exist
    createRegistrationModal();
    
    // Set up event listeners
    setupEventListeners();
}

// Create the registration modal dynamically
function createRegistrationModal() {
    // Check if modal already exists
    if (document.getElementById('tournamentRegistrationModal')) {
        return;
    }
    
    // Create modal element
    const modalHTML = `
    <div id="tournamentRegistrationModal" class="fixed inset-0 bg-black bg-opacity-50 hidden flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-xl max-w-md w-full p-6 relative">
            <button id="closeRegistrationModalBtn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                <i class="fas fa-times"></i>
            </button>
            <div class="text-center mb-6">
                <h3 id="registrationTitle" class="text-2xl font-bold text-gray-800">Inscripción al Torneo</h3>
                <p class="text-gray-600">Completa la información para participar</p>
                <p id="registrationErrorMsg" class="text-red-500 mt-2 text-sm"></p>
            </div>
            
            <form id="tournamentRegistrationForm">
                <div class="mb-4">
                    <label for="playerName" class="block text-gray-700 text-sm font-bold mb-2">Nombre de Jugador *</label>
                    <input type="text" id="playerName" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Nombre que usarás en el torneo" required>
                    <p class="text-xs text-gray-500 mt-1">Este nombre se mostrará en la lista de participantes y brackets</p>
                </div>
                
                <div class="mb-6">
                    <label for="discordUsername" class="block text-gray-700 text-sm font-bold mb-2">Discord (opcional)</label>
                    <input type="text" id="discordUsername" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Tu usuario de Discord (ej: username#1234)">
                    <p class="text-xs text-gray-500 mt-1">Será utilizado para comunicación durante el torneo</p>
                </div>
                
                <div class="flex items-center justify-end">
                    <button type="button" id="cancelRegistrationBtn" class="text-gray-600 mr-4 hover:text-gray-800">
                        Cancelar
                    </button>
                    <button type="submit" id="registrationSubmitBtn" class="dtowin-blue text-white py-2 px-6 rounded-lg hover:opacity-90 transition font-semibold">
                        Confirmar Inscripción
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
    
    // Append to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Get references to elements
    registrationModal = document.getElementById('tournamentRegistrationModal');
    closeRegistrationModalBtn = document.getElementById('closeRegistrationModalBtn');
    tournamentRegistrationForm = document.getElementById('tournamentRegistrationForm');
    playerNameInput = document.getElementById('playerName');
    discordUsernameInput = document.getElementById('discordUsername');
    registrationSubmitBtn = document.getElementById('registrationSubmitBtn');
    registrationErrorMsg = document.getElementById('registrationErrorMsg');
    
    console.log("Registration modal created");
}

// Set up event listeners for the registration modal
function setupEventListeners() {
    if (closeRegistrationModalBtn) {
        closeRegistrationModalBtn.addEventListener('click', hideRegistrationModal);
    }
    
    const cancelBtn = document.getElementById('cancelRegistrationBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideRegistrationModal);
    }
    
    if (tournamentRegistrationForm) {
        tournamentRegistrationForm.addEventListener('submit', handleRegistrationSubmit);
    }
    
    // Close modal when clicking outside
    if (registrationModal) {
        registrationModal.addEventListener('click', function(e) {
            if (e.target === registrationModal) {
                hideRegistrationModal();
            }
        });
    }
}

// Show registration modal for a specific tournament
export function showRegistrationModal(tournamentId, tournamentName) {
    if (!registrationModal) {
        createRegistrationModal();
    }
    
    // Store tournament ID
    currentTournamentId = tournamentId;
    
    // Update title with tournament name if provided
    const titleEl = document.getElementById('registrationTitle');
    if (titleEl && tournamentName) {
        titleEl.textContent = `Inscripción: ${tournamentName}`;
    }
    
    // Clear previous error messages
    if (registrationErrorMsg) {
        registrationErrorMsg.textContent = '';
    }
    
    // Clear form fields
    if (tournamentRegistrationForm) {
        tournamentRegistrationForm.reset();
    }
    
    // Try to pre-fill with previous registration info if available
    loadPreviousRegistrationInfo(tournamentId);
    
    // Show modal
    registrationModal.classList.remove('hidden');
    registrationModal.classList.add('flex');
}

// Hide registration modal
export function hideRegistrationModal() {
    if (registrationModal) {
        registrationModal.classList.add('hidden');
        registrationModal.classList.remove('flex');
        
        // Reset current tournament ID
        currentTournamentId = null;
    }
}

// Load previous registration info if the user has registered before
async function loadPreviousRegistrationInfo(tournamentId) {
    try {
        if (!isAuthenticated()) return;
        
        const user = auth.currentUser;
        
        // Query participant_info collection to find previous registration
        const participantInfoRef = collection(db, "participant_info");
        const q = query(
            participantInfoRef, 
            where("userId", "==", user.uid),
            where("tournamentId", "==", tournamentId)
        );
        
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            // User has registered before, load their info
            const registrationInfo = snapshot.docs[0].data();
            
            if (playerNameInput && registrationInfo.playerName) {
                playerNameInput.value = registrationInfo.playerName;
            }
            
            if (discordUsernameInput && registrationInfo.discordUsername) {
                discordUsernameInput.value = registrationInfo.discordUsername;
            }
        }
    } catch (error) {
        console.error("Error loading previous registration info:", error);
    }
}

// Handle registration form submission
async function handleRegistrationSubmit(e) {
    e.preventDefault();
    
    if (!currentTournamentId) {
        showRegistrationError("Error en el proceso de inscripción. Inténtalo de nuevo.");
        return;
    }
    
    // Validate form
    const playerName = playerNameInput.value.trim();
    const discordUsername = discordUsernameInput.value.trim();
    
    if (!playerName) {
        showRegistrationError("El nombre de jugador es obligatorio");
        return;
    }
    
    // Show loading state
    registrationSubmitBtn.disabled = true;
    registrationSubmitBtn.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
    
    try {
        // Check if user is authenticated
        if (!isAuthenticated()) {
            throw new Error("Debes iniciar sesión para inscribirte");
        }
        
        const user = auth.currentUser;
        
        // Register user to the tournament with additional info
        await registerForTournamentWithInfo(currentTournamentId, playerName, discordUsername);
        
        // Hide modal
        hideRegistrationModal();
        
        // Show success message
        window.mostrarNotificacion("¡Te has inscrito correctamente al torneo!", "success");
        
        // Reload tournaments to update UI
        const { loadTournaments } = await import('./torneos.js');
        await loadTournaments();
        
    } catch (error) {
        console.error("Error registering for tournament:", error);
        showRegistrationError(error.message || "Error al inscribirse al torneo");
    } finally {
        // Restore button
        registrationSubmitBtn.disabled = false;
        registrationSubmitBtn.textContent = "Confirmar Inscripción";
    }
}

// Register user to tournament with additional info
export async function registerForTournamentWithInfo(tournamentId, playerName, discordUsername) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Debes iniciar sesión para inscribirte");
        }
        
        // Get tournament document
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Check if tournament is open
        if (tournamentData.estado !== 'Abierto') {
            throw new Error("Este torneo no está abierto para inscripciones");
        }
        
        // Check if there are spots available
        const currentParticipants = tournamentData.participants || [];
        if (tournamentData.capacidad && currentParticipants.length >= tournamentData.capacidad) {
            throw new Error("No hay cupos disponibles para este torneo");
        }
        
        // Check if user is already registered
        if (currentParticipants.includes(user.uid)) {
            throw new Error("Ya estás inscrito en este torneo");
        }
        
        // Save participant info
        const participantInfoRef = collection(db, "participant_info");
        
        // Check if there's already an entry for this user and tournament
        const q = query(
            participantInfoRef, 
            where("userId", "==", user.uid),
            where("tournamentId", "==", tournamentId)
        );
        
        const existingInfoSnapshot = await getDocs(q);
        
        if (!existingInfoSnapshot.empty) {
            // Update existing entry
            const infoDoc = existingInfoSnapshot.docs[0];
            await updateDoc(doc(db, "participant_info", infoDoc.id), {
                playerName: playerName,
                discordUsername: discordUsername || null,
                active: true,
                checkedIn: false, // Reiniciar el estado de check-in si había uno anterior
                updatedAt: serverTimestamp()
            });
        } else {
            // Create new entry
            await addDoc(participantInfoRef, {
                userId: user.uid,
                tournamentId: tournamentId,
                playerName: playerName,
                discordUsername: discordUsername || null,
                active: true,
                checkedIn: false, // Inicialmente no ha hecho check-in
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        
        // Add user to tournament participants
        await updateDoc(tournamentRef, {
            participants: [...currentParticipants, user.uid],
            updatedAt: serverTimestamp()
        });
        
        // Update user document to record participation
        const usersRef = collection(db, "usuarios");
        const userQuery = query(usersRef, where("uid", "==", user.uid));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            const userTournaments = userDoc.data().torneos || [];
            
            if (!userTournaments.includes(tournamentId)) {
                await updateDoc(doc(db, "usuarios", userDoc.id), {
                    torneos: [...userTournaments, tournamentId],
                    updatedAt: serverTimestamp()
                });
            }
        }
        
        return true;
    } catch (error) {
        console.error("Error registering for tournament with info:", error);
        throw error;
    }
}

// Unregister from tournament
export async function unregisterFromTournament(tournamentId) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Debes iniciar sesión para desinscribirte");
        }
        
        // Get tournament document
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Check if tournament is still open or in progress
        if (tournamentData.estado !== 'Abierto' && tournamentData.estado !== 'Check In') {
            throw new Error("Solo puedes desinscribirte cuando el torneo está en fase de inscripción o check-in");
        }
        
        // Check if user is registered
        const currentParticipants = tournamentData.participants || [];
        if (!currentParticipants.includes(user.uid)) {
            throw new Error("No estás inscrito en este torneo");
        }
        
        // Remove user from participants
        const newParticipants = currentParticipants.filter(uid => uid !== user.uid);
        
        // Update tournament document
        await updateDoc(tournamentRef, {
            participants: newParticipants,
            updatedAt: serverTimestamp()
        });
        
        // Delete participant info (optional - keeping for historical purposes)
        // Find and mark participant info as inactive
        const participantInfoRef = collection(db, "participant_info");
        const q = query(
            participantInfoRef, 
            where("userId", "==", user.uid),
            where("tournamentId", "==", tournamentId)
        );
        
        const infoSnapshot = await getDocs(q);
        
        if (!infoSnapshot.empty) {
            // Mark as inactive instead of deleting
            await updateDoc(doc(db, "participant_info", infoSnapshot.docs[0].id), {
                active: false,
                updatedAt: serverTimestamp()
            });
        }
        
        // Update user document
        const usersRef = collection(db, "usuarios");
        const userQuery = query(usersRef, where("uid", "==", user.uid));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            const userTournaments = userDoc.data().torneos || [];
            const newUserTournaments = userTournaments.filter(id => id !== tournamentId);
            
            await updateDoc(doc(db, "usuarios", userDoc.id), {
                torneos: newUserTournaments,
                updatedAt: serverTimestamp()
            });
        }
        
        return true;
    } catch (error) {
        console.error("Error unregistering from tournament:", error);
        throw error;
    }
}

// Función para hacer check-in en un torneo
export async function checkInForTournament(tournamentId) {
    try {
        if (!isAuthenticated()) {
            throw new Error("Debes iniciar sesión para hacer check-in");
        }
        
        const user = auth.currentUser;
        
        // Verificar si el usuario está inscrito en el torneo
        const participantInfoRef = collection(db, "participant_info");
        const q = query(
            participantInfoRef, 
            where("userId", "==", user.uid),
            where("tournamentId", "==", tournamentId),
            where("active", "!=", false)
        );
        
        const infoSnapshot = await getDocs(q);
        
        if (infoSnapshot.empty) {
            throw new Error("No estás inscrito en este torneo");
        }
        
        // Obtener el documento de información del participante
        const participantInfoDoc = infoSnapshot.docs[0];
        const participantInfo = participantInfoDoc.data();
        
        // Verificar si ya hizo check-in
        if (participantInfo.checkedIn) {
            throw new Error("Ya has confirmado tu asistencia a este torneo");
        }
        
        // Actualizar el documento con el estado de check-in
        await updateDoc(doc(db, "participant_info", participantInfoDoc.id), {
            checkedIn: true,
            checkedInAt: serverTimestamp()
        });
        
        console.log("Check-in realizado correctamente");
        return true;
        
    } catch (error) {
        console.error("Error al hacer check-in:", error);
        throw error;
    }
}

// Función para verificar si un usuario ha hecho check-in
export async function hasUserCheckedIn(userId, tournamentId) {
    try {
        const participantInfoRef = collection(db, "participant_info");
        const q = query(
            participantInfoRef, 
            where("userId", "==", userId),
            where("tournamentId", "==", tournamentId),
            where("checkedIn", "==", true)
        );
        
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        console.error("Error al verificar check-in:", error);
        return false;
    }
}

// Show registration error message
function showRegistrationError(message) {
    if (registrationErrorMsg) {
        registrationErrorMsg.textContent = message;
    }
}

// Get participant info for a tournament
export async function getTournamentParticipantsInfo(tournamentId) {
    try {
        // Query participant_info collection
        const participantInfoRef = collection(db, "participant_info");
        const q = query(
            participantInfoRef, 
            where("tournamentId", "==", tournamentId),
            where("active", "!=", false)
        );
        
        const snapshot = await getDocs(q);
        
        // Map results to an object with userId as key
        const participantsInfo = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            participantsInfo[data.userId] = {
                id: doc.id,
                playerName: data.playerName,
                discordUsername: data.discordUsername,
                checkedIn: data.checkedIn || false,
                ...data
            };
        });
        
        return participantsInfo;
    } catch (error) {
        console.error("Error getting tournament participants info:", error);
        return {};
    }
}

// Check if user has registered for tournament with additional info
export async function hasUserRegisteredWithInfo(userId, tournamentId) {
    try {
        const participantInfoRef = collection(db, "participant_info");
        const q = query(
            participantInfoRef, 
            where("userId", "==", userId),
            where("tournamentId", "==", tournamentId),
            where("active", "!=", false)
        );
        
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        console.error("Error checking if user has registered with info:", error);
        return false;
    }
}
