// registration.js - Module for managing tournament registrations
import { auth, db, isAuthenticated } from './firebase.js';
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query, 
    where,
    orderBy,
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Register user for a tournament
export async function registerForTournament(tournamentId, playerName, discordUsername = null) {
    try {
        // Verificar autenticación
        if (!isAuthenticated()) {
            throw new Error("Debes iniciar sesión para inscribirte en un torneo");
        }
        
        // Obtener datos del usuario actual
        const user = auth.currentUser;
        
        // Validar nombre de jugador
        if (!playerName || playerName.trim() === '') {
            throw new Error("Debes proporcionar un nombre de jugador");
        }
        
        // Obtener documento del torneo
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Comprobar si el torneo permite inscripciones
        if (tournamentData.estado === 'Finalizado') {
            throw new Error("Este torneo ya ha finalizado");
        }
        
        if (tournamentData.estado === 'En Progreso') {
            throw new Error("Este torneo ya está en progreso y no acepta nuevas inscripciones");
        }
        
        // Verificar límite de participantes
        if (tournamentData.limiteParticipantes && 
            tournamentData.participants && 
            tournamentData.participants.length >= tournamentData.limiteParticipantes) {
            throw new Error("El torneo ha alcanzado el límite de participantes");
        }
        
        // Verificar si el usuario ya está inscrito
        const participants = tournamentData.participants || [];
        if (participants.includes(user.uid)) {
            throw new Error("Ya estás inscrito en este torneo");
        }
        
        // Agregar al usuario a la lista de participantes
        await updateDoc(tournamentRef, {
            participants: arrayUnion(user.uid),
            updatedAt: serverTimestamp()
        });
        
        // Guardar información del participante
        await addDoc(collection(db, "participant_info"), {
            userId: user.uid,
            tournamentId: tournamentId,
            playerName: playerName,
            discordUsername: discordUsername,
            email: user.email,
            active: true,
            checkedIn: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        return {
            success: true,
            tournamentId: tournamentId,
            userId: user.uid,
            playerName: playerName,
            discordUsername: discordUsername
        };
        
    } catch (error) {
        console.error("Error registering for tournament:", error);
        throw error;
    }
}

// Unregister from a tournament
export async function unregisterFromTournament(tournamentId) {
    try {
        // Verificar autenticación
        if (!isAuthenticated()) {
            throw new Error("Debes iniciar sesión para anular tu inscripción");
        }
        
        // Obtener datos del usuario actual
        const user = auth.currentUser;
        
        // Obtener documento del torneo
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Comprobar si el torneo permite anular inscripciones
        if (tournamentData.estado === 'Finalizado') {
            throw new Error("Este torneo ya ha finalizado");
        }
        
        if (tournamentData.estado === 'En Progreso') {
            throw new Error("Este torneo ya está en progreso y no permite anular inscripciones");
        }
        
        // Verificar si el usuario está inscrito
        const participants = tournamentData.participants || [];
        if (!participants.includes(user.uid)) {
            throw new Error("No estás inscrito en este torneo");
        }
        
        // Eliminar al usuario de la lista de participantes
        await updateDoc(tournamentRef, {
            participants: arrayRemove(user.uid),
            updatedAt: serverTimestamp()
        });
        
        // También eliminar del array de check-in si está presente
        if (tournamentData.checkedInParticipants && tournamentData.checkedInParticipants.includes(user.uid)) {
            await updateDoc(tournamentRef, {
                checkedInParticipants: arrayRemove(user.uid)
            });
        }
        
        // Buscar y actualizar información del participante en participant_info
        const participantInfoQuery = query(
            collection(db, "participant_info"),
            where("userId", "==", user.uid),
            where("tournamentId", "==", tournamentId)
        );
        
        const participantInfoSnapshot = await getDocs(participantInfoQuery);
        
        if (!participantInfoSnapshot.empty) {
            const participantDoc = participantInfoSnapshot.docs[0];
            
            // Marcar como inactivo en lugar de eliminar
            await updateDoc(doc(db, "participant_info", participantDoc.id), {
                active: false,
                checkedIn: false,
                updatedAt: serverTimestamp()
            });
        }
        
        return {
            success: true,
            tournamentId: tournamentId,
            userId: user.uid
        };
        
    } catch (error) {
        console.error("Error unregistering from tournament:", error);
        throw error;
    }
}

// Check in for a tournament
export async function checkInForTournament(tournamentId) {
    try {
        // Verificar autenticación
        if (!isAuthenticated()) {
            throw new Error("Debes iniciar sesión para hacer check-in");
        }
        
        // Obtener datos del usuario actual
        const user = auth.currentUser;
        
        // Obtener documento del torneo
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Comprobar si el torneo permite check-in
        if (tournamentData.estado !== 'Check In' && tournamentData.estado !== 'Inscripciones Abiertas') {
            throw new Error(`El torneo no está en fase de check-in (Estado actual: ${tournamentData.estado})`);
        }
        
        // Verificar si el usuario está inscrito
        const participants = tournamentData.participants || [];
        if (!participants.includes(user.uid)) {
            throw new Error("No estás inscrito en este torneo");
        }
        
        // Verificar si el usuario ya hizo check-in
        const checkedInParticipants = tournamentData.checkedInParticipants || [];
        if (checkedInParticipants.includes(user.uid)) {
            throw new Error("Ya has realizado el check-in para este torneo");
        }
        
        // Agregar al usuario a la lista de check-in
        await updateDoc(tournamentRef, {
            checkedInParticipants: arrayUnion(user.uid),
            updatedAt: serverTimestamp()
        });
        
        // Actualizar información del participante
        const participantInfoQuery = query(
            collection(db, "participant_info"),
            where("userId", "==", user.uid),
            where("tournamentId", "==", tournamentId)
        );
        
        const participantInfoSnapshot = await getDocs(participantInfoQuery);
        
        if (!participantInfoSnapshot.empty) {
            const participantDoc = participantInfoSnapshot.docs[0];
            
            await updateDoc(doc(db, "participant_info", participantDoc.id), {
                checkedIn: true,
                updatedAt: serverTimestamp()
            });
        }
        
        return {
            success: true,
            tournamentId: tournamentId,
            userId: user.uid
        };
        
    } catch (error) {
        console.error("Error checking in for tournament:", error);
        throw error;
    }
}

// Get tournament participants info - VERSIÓN MEJORADA
export async function getTournamentParticipantsInfo(tournamentId) {
    try {
        console.log("Getting participants info for tournament:", tournamentId);
        
        // Objeto para almacenar la información de los participantes
        const participantsInfo = {};
        
        // Obtener información de la colección participant_info
        const participantInfoRef = collection(db, "participant_info");
        const participantInfoQuery = query(
            participantInfoRef,
            where("tournamentId", "==", tournamentId),
            where("active", "==", true)
        );
        
        const participantInfoSnapshot = await getDocs(participantInfoQuery);
        
        console.log(`Found ${participantInfoSnapshot.size} participants in participant_info collection`);
        
        // Procesar los resultados de la consulta
        participantInfoSnapshot.forEach(doc => {
            const data = doc.data();
            participantsInfo[data.userId] = {
                playerName: data.playerName || "Usuario",
                discordUsername: data.discordUsername || null,
                email: data.email || null,
                checkedIn: data.checkedIn || false
            };
            
            console.log(`Participant info from participant_info: ${data.userId} - ${data.playerName}`);
        });
        
        // Obtener documento del torneo para obtener los participantes
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            console.error("El torneo no existe");
            return participantsInfo;
        }
        
        const tournamentData = tournamentSnap.data();
        const participants = tournamentData.participants || [];
        const checkedInParticipants = tournamentData.checkedInParticipants || [];
        
        console.log(`Tournament has ${participants.length} registered participants and ${checkedInParticipants.length} checked-in participants`);
        
        // Para cualquier participante que no esté en participant_info, buscar en usuarios
        const missingParticipants = participants.filter(userId => !participantsInfo[userId]);
        
        if (missingParticipants.length > 0) {
            console.log(`Looking up ${missingParticipants.length} participants missing from participant_info`);
            
            // Buscar datos en la colección de usuarios para participantes faltantes
            const usersPromises = missingParticipants.map(async (userId) => {
                try {
                    // Verificar si es un ID manual
                    if (userId.startsWith('manual_')) {
                        // Buscar en manual_participants
                        const manualParticipantsRef = collection(db, "manual_participants");
                        const manualQuery = query(
                            manualParticipantsRef,
                            where("tournamentId", "==", tournamentId)
                        );
                        
                        const manualSnapshot = await getDocs(manualQuery);
                        
                        for (const manualDoc of manualSnapshot.docs) {
                            const manualData = manualDoc.data();
                            if (manualData && manualData.createdAt && 
                                userId.includes(manualData.createdAt.toMillis ? 
                                    manualData.createdAt.toMillis() : 0)) {
                                
                                participantsInfo[userId] = {
                                    playerName: manualData.playerName || "Usuario Manual",
                                    discordUsername: manualData.discordUsername || null,
                                    email: manualData.email || null,
                                    checkedIn: checkedInParticipants.includes(userId)
                                };
                                
                                console.log(`Found manual participant: ${userId} - ${manualData.playerName}`);
                                break;
                            }
                        }
                        
                        // Si no se encontró, usar datos genéricos
                        if (!participantsInfo[userId]) {
                            participantsInfo[userId] = {
                                playerName: `Participante #${userId.substring(0, 6)}`,
                                discordUsername: null,
                                email: null,
                                checkedIn: checkedInParticipants.includes(userId)
                            };
                        }
                        
                        return;
                    }
                    
                    // Buscar en la colección usuarios
                    const userRef = doc(db, "usuarios", userId);
                    const userSnap = await getDoc(userRef);
                    
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        participantsInfo[userId] = {
                            playerName: userData.nombre || "Usuario",
                            discordUsername: userData.discordUsername || null,
                            email: userData.email || null,
                            checkedIn: checkedInParticipants.includes(userId)
                        };
                        
                        console.log(`Participant info from usuarios: ${userId} - ${userData.nombre}`);
                    } else {
                        // Datos genéricos para usuarios que no existen
                        participantsInfo[userId] = {
                            playerName: `Usuario #${userId.substring(0, 6)}`,
                            discordUsername: null,
                            email: null,
                            checkedIn: checkedInParticipants.includes(userId)
                        };
                        
                        console.log(`No info found for participant: ${userId}, using generic name`);
                    }
                } catch (error) {
                    console.error(`Error getting info for participant ${userId}:`, error);
                    // Aún así, proporcionar datos genéricos
                    participantsInfo[userId] = {
                        playerName: `Usuario #${userId.substring(0, 6)}`,
                        discordUsername: null,
                        email: null,
                        checkedIn: checkedInParticipants.includes(userId)
                    };
                }
            });
            
            // Esperar a que todas las consultas se completen
            await Promise.all(usersPromises);
        }
        
        // Verificar que todos los participantes con check-in tengan información
        for (const userId of checkedInParticipants) {
            if (!participantsInfo[userId]) {
                participantsInfo[userId] = {
                    playerName: `Usuario #${userId.substring(0, 6)}`,
                    discordUsername: null,
                    email: null,
                    checkedIn: true
                };
                
                console.log(`Added generic info for checked-in participant: ${userId}`);
            }
        }
        
        console.log(`Final participant info count: ${Object.keys(participantsInfo).length}`);
        return participantsInfo;
        
    } catch (error) {
        console.error("Error getting tournament participants info:", error);
        return {}; // Devolver objeto vacío en caso de error
    }
}

// Get user registered tournaments
export async function getUserTournaments() {
    try {
        // Verificar autenticación
        if (!isAuthenticated()) {
            throw new Error("Debes iniciar sesión para ver tus torneos");
        }
        
        // Obtener datos del usuario actual
        const user = auth.currentUser;
        
        // Buscar torneos donde el usuario esté registrado
        const tournamentsRef = collection(db, "torneos");
        const userTournamentsQuery = query(
            tournamentsRef,
            where("participants", "array-contains", user.uid),
            orderBy("fechaInicio", "desc")
        );
        
        const tournamentsSnapshot = await getDocs(userTournamentsQuery);
        
        // Formatear resultados
        const tournaments = [];
        
        tournamentsSnapshot.forEach((doc) => {
            const data = doc.data();
            
            tournaments.push({
                id: doc.id,
                nombre: data.nombre,
                juego: data.juego,
                plataforma: data.plataforma,
                estado: data.estado,
                fechaInicio: data.fechaInicio ? new Date(data.fechaInicio.seconds * 1000) : null,
                checkedIn: data.checkedInParticipants && data.checkedInParticipants.includes(user.uid)
            });
        });
        
        return tournaments;
        
    } catch (error) {
        console.error("Error getting user tournaments:", error);
        throw error;
    }
}

// Check if user is registered for a tournament
export async function isUserRegistered(tournamentId) {
    try {
        // Verificar autenticación
        if (!isAuthenticated()) {
            return false;
        }
        
        // Obtener datos del usuario actual
        const user = auth.currentUser;
        
        // Obtener documento del torneo
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            return false;
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Verificar si el usuario está en la lista de participantes
        return tournamentData.participants && tournamentData.participants.includes(user.uid);
        
    } catch (error) {
        console.error("Error checking if user is registered:", error);
        return false;
    }
}

// Check if user has checked in for a tournament
export async function hasUserCheckedIn(tournamentId) {
    try {
        // Verificar autenticación
        if (!isAuthenticated()) {
            return false;
        }
        
        // Obtener datos del usuario actual
        const user = auth.currentUser;
        
        // Obtener documento del torneo
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            return false;
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Verificar si el usuario está en la lista de check-in
        return tournamentData.checkedInParticipants && 
               tournamentData.checkedInParticipants.includes(user.uid);
        
    } catch (error) {
        console.error("Error checking if user has checked in:", error);
        return false;
    }
}

// Get participant info for current user in a tournament
export async function getParticipantInfo(tournamentId) {
    try {
        // Verificar autenticación
        if (!isAuthenticated()) {
            throw new Error("Debes iniciar sesión para ver tu información de participante");
        }
        
        // Obtener datos del usuario actual
        const user = auth.currentUser;
        
        // Buscar información del participante
        const participantInfoQuery = query(
            collection(db, "participant_info"),
            where("userId", "==", user.uid),
            where("tournamentId", "==", tournamentId),
            where("active", "==", true)
        );
        
        const participantInfoSnapshot = await getDocs(participantInfoQuery);
        
        if (participantInfoSnapshot.empty) {
            return null;
        }
        
        const participantData = participantInfoSnapshot.docs[0].data();
        
        return {
            id: participantInfoSnapshot.docs[0].id,
            userId: participantData.userId,
            tournamentId: participantData.tournamentId,
            playerName: participantData.playerName,
            discordUsername: participantData.discordUsername,
            email: participantData.email,
            checkedIn: participantData.checkedIn,
            createdAt: participantData.createdAt ? new Date(participantData.createdAt.seconds * 1000) : null
        };
        
    } catch (error) {
        console.error("Error getting participant info:", error);
        throw error;
    }
}

// Update participant information
export async function updateParticipantInfo(tournamentId, playerName, discordUsername) {
    try {
        // Verificar autenticación
        if (!isAuthenticated()) {
            throw new Error("Debes iniciar sesión para actualizar tu información");
        }
        
        // Validar nombre de jugador
        if (!playerName || playerName.trim() === '') {
            throw new Error("Debes proporcionar un nombre de jugador");
        }
        
        // Obtener datos del usuario actual
        const user = auth.currentUser;
        
        // Verificar si el usuario está inscrito
        const isRegistered = await isUserRegistered(tournamentId);
        
        if (!isRegistered) {
            throw new Error("No estás inscrito en este torneo");
        }
        
        // Buscar información del participante
        const participantInfoQuery = query(
            collection(db, "participant_info"),
            where("userId", "==", user.uid),
            where("tournamentId", "==", tournamentId),
            where("active", "==", true)
        );
        
        const participantInfoSnapshot = await getDocs(participantInfoQuery);
        
        if (participantInfoSnapshot.empty) {
            // No hay info de participante, crearla
            await addDoc(collection(db, "participant_info"), {
                userId: user.uid,
                tournamentId: tournamentId,
                playerName: playerName,
                discordUsername: discordUsername || null,
                email: user.email,
                active: true,
                checkedIn: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        } else {
            // Actualizar info existente
            const participantDoc = participantInfoSnapshot.docs[0];
            
            await updateDoc(doc(db, "participant_info", participantDoc.id), {
                playerName: playerName,
                discordUsername: discordUsername || null,
                updatedAt: serverTimestamp()
            });
        }
        
        return {
            success: true,
            tournamentId: tournamentId,
            userId: user.uid,
            playerName: playerName,
            discordUsername: discordUsername
        };
        
    } catch (error) {
        console.error("Error updating participant info:", error);
        throw error;
    }
}

// Función que faltaba y estaba causando el error - CORREGIDO
export async function hasUserRegisteredWithInfo(tournamentId) {
    try {
        // Verificar autenticación
        if (!isAuthenticated()) {
            return false;
        }
        
        // Obtener datos del usuario actual
        const user = auth.currentUser;
        
        // Verificar si el usuario está inscrito
        const isRegistered = await isUserRegistered(tournamentId);
        
        if (!isRegistered) {
            return false;
        }
        
        // Buscar información del participante
        const participantInfoQuery = query(
            collection(db, "participant_info"),
            where("userId", "==", user.uid),
            where("tournamentId", "==", tournamentId),
            where("active", "==", true)
        );
        
        const participantInfoSnapshot = await getDocs(participantInfoQuery);
        
        // Si existe información del participante, el usuario ha editado sus datos
        return !participantInfoSnapshot.empty;
        
    } catch (error) {
        console.error("Error checking if user has register edit info:", error);
        return false;
    }
}

// Mostrar modal de inscripción
export function showRegistrationModal(tournamentId, tournamentName) {
    if (!isAuthenticated()) {
        window.mostrarNotificacion("Debes iniciar sesión para inscribirte", "error");
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) loginBtn.click();
        return;
    }

    let registrationModal = document.getElementById('tournamentRegistrationModal');

    if (!registrationModal) {
        // Crear el modal si no existe
        const modalHTML = `
        <div id="tournamentRegistrationModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center p-4 z-50">
            <div class="bg-white rounded-xl max-w-md w-full p-6 relative">
                <button id="closeRegistrationModalBtn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
                <div class="text-center mb-6">
                    <h3 id="registrationTitle" class="text-2xl font-bold text-gray-800">Inscripción: ${tournamentName}</h3>
                    <p class="text-gray-600">Completa la información para participar</p>
                    <p id="registrationErrorMsg" class="text-red-500 mt-2 text-sm"></p>
                </div>

                <form id="tournamentRegistrationForm">
                    <input type="hidden" id="tournamentId" value="${tournamentId}">
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
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        registrationModal = document.getElementById('tournamentRegistrationModal');
    } else {
        // Si ya existe, actualizar valores
        document.getElementById('registrationTitle').textContent = `Inscripción: ${tournamentName}`;
        document.getElementById('tournamentId').value = tournamentId;
        document.getElementById('registrationErrorMsg').textContent = '';
        document.getElementById('tournamentRegistrationForm').reset();
    }

    // 🔄 Siempre conectar los botones (por si se perdieron los listeners)
    document.getElementById('closeRegistrationModalBtn')?.addEventListener('click', () => {
        registrationModal.classList.add('hidden');
        registrationModal.classList.remove('flex');
    });

    document.getElementById('cancelRegistrationBtn')?.addEventListener('click', () => {
        registrationModal.classList.add('hidden');
        registrationModal.classList.remove('flex');
    });

    // ✅ Confirmar inscripción (submit)
    const form = document.getElementById('tournamentRegistrationForm');
    if (form) {
        form.onsubmit = handleRegistrationSubmit; // esto evita múltiples .addEventListener
    }

    registrationModal.classList.remove('hidden');
    registrationModal.classList.add('flex');
}

// Manejar envío del formulario de inscripción
async function handleRegistrationSubmit(e) {
    e.preventDefault();
    
    const tournamentId = document.getElementById('tournamentId').value;
    const playerName = document.getElementById('playerName').value;
    const discordUsername = document.getElementById('discordUsername').value;
    const submitBtn = document.getElementById('registrationSubmitBtn');
    const errorMsg = document.getElementById('registrationErrorMsg');
    
    if (!playerName) {
        errorMsg.textContent = "El nombre de jugador es obligatorio";
        return;
    }
    
    // Mostrar estado de carga
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
    
    try {
        // Registrar al usuario
        await registerForTournament(tournamentId, playerName, discordUsername);
        
        // Cerrar modal
        const modal = document.getElementById('tournamentRegistrationModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        
        // Mostrar mensaje de éxito
        window.mostrarNotificacion("¡Te has inscrito correctamente al torneo!", "success");
        
        // Recargar para actualizar la UI
        setTimeout(() => window.location.reload(), 1500);
        
    } catch (error) {
        errorMsg.textContent = error.message || "Error al inscribirse al torneo";
        
        // Restaurar botón
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirmar Inscripción";
    }
}

// Función para configurar botones de check-in
export function configurarBotonesCheckIn() {
    console.log("Configurando botones de check-in");
    
    // Buscar todos los botones de check-in (usando clases en lugar de selectores inválidos)
    const checkInButtons = document.querySelectorAll('.checkin-btn');
    
    if (checkInButtons.length === 0) {
        console.log("No se encontraron botones de check-in");
        return;
    }
    
    console.log(`Se encontraron ${checkInButtons.length} botones de check-in`);
    
    checkInButtons.forEach(button => {
        const tournamentId = button.dataset.torneoId || button.getAttribute('data-torneo-id');
        if (!tournamentId) {
            console.log("Botón sin ID de torneo", button);
            return;
        }
        
        // Remover listeners previos
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                // Cambiar estado del botón
                newButton.disabled = true;
                const originalText = newButton.innerHTML;
                newButton.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
                
                // Realizar check-in
                await checkInForTournament(tournamentId);
                
                // Actualizar UI
                newButton.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Check-in completado';
                newButton.classList.remove('dtowin-primary', 'bg-purple-600', 'hover:bg-purple-700');
                newButton.classList.add('bg-green-500');
                newButton.disabled = true;
                
                // Mostrar mensaje
                window.mostrarNotificacion("¡Has confirmado tu asistencia correctamente!", "success");
                
                // Actualizar estado en la UI
                const statusElement = document.querySelector(`#check-in-status-${tournamentId}`);
                if (statusElement) {
                    statusElement.classList.remove('bg-red-100', 'text-red-800');
                    statusElement.classList.add('bg-green-100', 'text-green-800');
                    statusElement.textContent = 'Sí';
                }
                
            } catch (error) {
                window.mostrarNotificacion(error.message, "error");
                newButton.disabled = false;
                newButton.innerHTML = originalText;
            }
        });
    });
}

// Inicializar módulo de registro
export function initRegistrationModule() {
    console.log("Inicializando módulo de registro");
    
    // Ejecutar configuraciones cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(configurarBotonesCheckIn, 1000);
        });
    } else {
        setTimeout(configurarBotonesCheckIn, 1000);
    }
}
