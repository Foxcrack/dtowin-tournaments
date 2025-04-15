// registro.js - Módulo para manejar el registro de participantes
import { auth, db } from './firebase.js';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    addDoc,
    updateDoc, 
    query, 
    where, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Referencias al modal de registro
const tournamentRegistrationModal = document.getElementById('tournamentRegistrationModal');
const closeRegistrationModalBtn = document.getElementById('closeRegistrationModalBtn');
const registrationTitle = document.getElementById('registrationTitle');
const registrationErrorMsg = document.getElementById('registrationErrorMsg');
const tournamentRegistrationForm = document.getElementById('tournamentRegistrationForm');
const cancelRegistrationBtn = document.getElementById('cancelRegistrationBtn');
const registrationSubmitBtn = document.getElementById('registrationSubmitBtn');

// Variables de estado
let currentTournamentId = null;
let isRegistrationModuleInitialized = false;

// Inicializar módulo de registro
export function initRegistrationModule() {
    if (isRegistrationModuleInitialized) return;
    
    try {
        // Configurar event listeners para el modal
        if (closeRegistrationModalBtn) {
            closeRegistrationModalBtn.addEventListener('click', hideRegistrationModal);
        }
        
        if (cancelRegistrationBtn) {
            cancelRegistrationBtn.addEventListener('click', hideRegistrationModal);
        }
        
        // Manejar envío del formulario
        if (tournamentRegistrationForm) {
            tournamentRegistrationForm.addEventListener('submit', handleRegistrationSubmit);
        }
        
        // Marcar como inicializado
        isRegistrationModuleInitialized = true;
        console.log("Módulo de registro inicializado correctamente");
    } catch (error) {
        console.error("Error al inicializar módulo de registro:", error);
    }
}

// Mostrar modal de registro
export function showRegistrationModal(torneoId, torneoNombre) {
    if (!tournamentRegistrationModal) {
        console.error("Modal de registro no encontrado");
        return;
    }
    
    try {
        // Actualizar datos del modal
        currentTournamentId = torneoId;
        
        if (registrationTitle) {
            registrationTitle.textContent = `Inscripción: ${torneoNombre}`;
        }
        
        if (registrationErrorMsg) {
            registrationErrorMsg.textContent = '';
        }
        
        // Resetear formulario
        if (tournamentRegistrationForm) {
            tournamentRegistrationForm.reset();
            
            // Prellenar campos con datos del usuario si están disponibles
            if (auth.currentUser) {
                // Buscar datos previos del usuario para este torneo
                getTournamentParticipantInfo(torneoId, auth.currentUser.uid)
                    .then(participantInfo => {
                        if (participantInfo) {
                            const playerNameInput = document.getElementById('playerName');
                            const discordUsernameInput = document.getElementById('discordUsername');
                            
                            if (playerNameInput && participantInfo.playerName) {
                                playerNameInput.value = participantInfo.playerName;
                            } else if (playerNameInput && auth.currentUser.displayName) {
                                playerNameInput.value = auth.currentUser.displayName;
                            }
                            
                            if (discordUsernameInput && participantInfo.discordUsername) {
                                discordUsernameInput.value = participantInfo.discordUsername;
                            }
                        }
                    })
                    .catch(error => {
                        console.error("Error al cargar información del participante:", error);
                    });
            }
        }
        
        // Mostrar modal
        tournamentRegistrationModal.classList.remove('hidden');
        tournamentRegistrationModal.classList.add('flex');
    } catch (error) {
        console.error("Error al mostrar modal de registro:", error);
        if (typeof window.mostrarNotificacion === 'function') {
            window.mostrarNotificacion("Error al mostrar formulario de inscripción", "error");
        }
    }
}

// Ocultar modal de registro
export function hideRegistrationModal() {
    if (tournamentRegistrationModal) {
        tournamentRegistrationModal.classList.add('hidden');
        tournamentRegistrationModal.classList.remove('flex');
    }
    
    // Resetear estado
    currentTournamentId = null;
}

// Manejar envío del formulario de registro
async function handleRegistrationSubmit(e) {
    e.preventDefault();
    
    // Verificar que haya un torneo seleccionado
    if (!currentTournamentId) {
        if (registrationErrorMsg) {
            registrationErrorMsg.textContent = "Error: No se ha seleccionado un torneo";
        }
        return;
    }
    
    // Obtener datos del formulario
    const playerNameInput = document.getElementById('playerName');
    const discordUsernameInput = document.getElementById('discordUsername');
    
    if (!playerNameInput) {
        console.error("No se encontró el campo de nombre de jugador");
        if (registrationErrorMsg) {
            registrationErrorMsg.textContent = "Error en el formulario. Inténtalo de nuevo.";
        }
        return;
    }
    
    const playerName = playerNameInput.value.trim();
    const discordUsername = discordUsernameInput ? discordUsernameInput.value.trim() : '';
    
    // Validación básica
    if (!playerName) {
        if (registrationErrorMsg) {
            registrationErrorMsg.textContent = "El nombre de jugador es obligatorio";
        }
        return;
    }
    
    // Cambiar estado del botón
    if (registrationSubmitBtn) {
        registrationSubmitBtn.disabled = true;
        registrationSubmitBtn.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
    }
    
    try {
        // Verificar usuario autenticado
        if (!auth.currentUser) {
            throw new Error("Debes iniciar sesión para inscribirte");
        }
        
        // Verificar si el torneo existe y está abierto
        const torneoRef = doc(db, "torneos", currentTournamentId);
        const torneoDoc = await getDoc(torneoRef);
        
        if (!torneoDoc.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const torneo = torneoDoc.data();
        
        if (torneo.estado !== 'Abierto') {
            throw new Error("Este torneo no está abierto para inscripciones");
        }
        
        // Verificar cupos disponibles
        const currentParticipants = torneo.participants || [];
        if (torneo.capacidad && currentParticipants.length >= torneo.capacidad) {
            throw new Error("No hay cupos disponibles para este torneo");
        }
        
        // Verificar si ya está inscrito
        if (currentParticipants.includes(auth.currentUser.uid)) {
            throw new Error("Ya estás inscrito en este torneo");
        }
        
        // Guardar información del participante
        const participantInfoQuery = query(
            collection(db, "participant_info"),
            where("userId", "==", auth.currentUser.uid),
            where("tournamentId", "==", currentTournamentId)
        );
        
        const participantSnapshot = await getDocs(participantInfoQuery);
        
        if (!participantSnapshot.empty) {
            // Actualizar información existente
            await updateDoc(doc(db, "participant_info", participantSnapshot.docs[0].id), {
                playerName: playerName,
                discordUsername: discordUsername || null,
                active: true,
                updatedAt: serverTimestamp()
            });
        } else {
            // Crear nueva entrada
            await addDoc(collection(db, "participant_info"), {
                userId: auth.currentUser.uid,
                tournamentId: currentTournamentId,
                playerName: playerName,
                discordUsername: discordUsername || null,
                active: true,
                checkedIn: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        
        // Actualizar lista de participantes del torneo
        await updateDoc(torneoRef, {
            participants: [...currentParticipants, auth.currentUser.uid],
            updatedAt: serverTimestamp()
        });
        
        // Actualizar perfil del usuario con el torneo
        const userQuery = query(
            collection(db, "usuarios"),
            where("uid", "==", auth.currentUser.uid)
        );
        
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            const userData = userDoc.data();
            const userTorneos = userData.torneos || [];
            
            // Verificar si el torneo ya está en la lista
            let needsUpdate = false;
            
            if (Array.isArray(userTorneos)) {
                if (!userTorneos.includes(currentTournamentId)) {
                    needsUpdate = true;
                    await updateDoc(doc(db, "usuarios", userDoc.id), {
                        torneos: [...userTorneos, currentTournamentId],
                        updatedAt: serverTimestamp()
                    });
                }
            } else if (typeof userTorneos === 'object') {
                if (!userTorneos[currentTournamentId]) {
                    needsUpdate = true;
                    const newTorneos = { ...userTorneos };
                    newTorneos[currentTournamentId] = {
                        joinedAt: serverTimestamp()
                    };
                    
                    await updateDoc(doc(db, "usuarios", userDoc.id), {
                        torneos: newTorneos,
                        updatedAt: serverTimestamp()
                    });
                }
            }
            
            if (needsUpdate) {
                console.log("Perfil de usuario actualizado con nuevo torneo");
            }
        }
        
        // Ocultar modal
        hideRegistrationModal();
        
        // Mostrar mensaje de éxito
        if (typeof window.mostrarNotificacion === 'function') {
            window.mostrarNotificacion("¡Te has inscrito correctamente al torneo!", "success");
        }
        
        // Recargar página después de un breve retraso
        setTimeout(() => {
            window.location.reload();
        }, 1500);
        
    } catch (error) {
        console.error("Error al inscribirse al torneo:", error);
        
        // Mostrar mensaje de error
        if (registrationErrorMsg) {
            registrationErrorMsg.textContent = error.message || "Error al inscribirse al torneo";
        }
        
        // Si se usa la función global de notificación
        if (typeof window.mostrarNotificacion === 'function') {
            window.mostrarNotificacion(error.message || "Error al inscribirse al torneo", "error");
        }
    } finally {
        // Restaurar botón
        if (registrationSubmitBtn) {
            registrationSubmitBtn.disabled = false;
            registrationSubmitBtn.textContent = "Confirmar Inscripción";
        }
    }
}

// Función para desinscribirse de un torneo
export async function unregisterFromTournament(torneoId) {
    try {
        if (!auth.currentUser) {
            throw new Error("Debes iniciar sesión para desinscribirte");
        }
        
        // Verificar si el torneo existe
        const torneoRef = doc(db, "torneos", torneoId);
        const torneoDoc = await getDoc(torneoRef);
        
        if (!torneoDoc.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const torneo = torneoDoc.data();
        
        // Verificar si el usuario está inscrito
        const participants = torneo.participants || [];
        if (!participants.includes(auth.currentUser.uid)) {
            throw new Error("No estás inscrito en este torneo");
        }
        
        // Verificar que el torneo no esté en progreso
        if (torneo.estado === 'En Progreso' || torneo.estado === 'Finalizado') {
            throw new Error("No puedes desinscribirte de un torneo que ya está en progreso o ha finalizado");
        }
        
        // Actualizar lista de participantes
        await updateDoc(torneoRef, {
            participants: participants.filter(uid => uid !== auth.currentUser.uid),
            updatedAt: serverTimestamp()
        });
        
        // Actualizar información del participante
        const participantInfoQuery = query(
            collection(db, "participant_info"),
            where("userId", "==", auth.currentUser.uid),
            where("tournamentId", "==", torneoId),
            where("active", "!=", false)
        );
        
        const participantSnapshot = await getDocs(participantInfoQuery);
        
        if (!participantSnapshot.empty) {
            await updateDoc(doc(db, "participant_info", participantSnapshot.docs[0].id), {
                active: false,
                deactivatedAt: serverTimestamp()
            });
        }
        
        // Actualizar perfil del usuario
        const userQuery = query(
            collection(db, "usuarios"),
            where("uid", "==", auth.currentUser.uid)
        );
        
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
            const userDoc
