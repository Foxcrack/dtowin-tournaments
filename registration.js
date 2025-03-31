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

// Función que faltaba y estaba causando el error
export async function hasUserRegisterEditInfo(tournamentId) {
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

// Función para configurar botones de check-in
export function configurarBotonesCheckIn() {
    console.log("Configurando botones de check-in");
    
    // Utilizar selectores más simples y robustos
    const checkInButtons = document.querySelectorAll('.check-in-btn');
    
    if (checkInButtons.length === 0) {
        console.log("No se encontraron botones de check-in");
        return;
    }
    
    console.log(`Se encontraron ${checkInButtons.length} botones de check-in`);
    
    checkInButtons.forEach(button => {
        const tournamentId = button.dataset.tournamentId;
        if (!tournamentId) {
            console.log("Botón sin ID de torneo", button);
            return;
        }
        
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                await checkInForTournament(tournamentId);
                window.mostrarNotificacion("Check-in realizado con éxito", "success");
                
                // Actualizar UI
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Check-in completado';
                button.classList.remove('dtowin-primary');
                button.classList.add('bg-green-500');
                
                // Actualizar estado en la UI
                const statusElement = document.querySelector(`#check-in-status-${tournamentId}`);
                if (statusElement) {
                    statusElement.classList.remove('bg-red-100', 'text-red-800');
                    statusElement.classList.add('bg-green-100', 'text-green-800');
                    statusElement.textContent = 'Sí';
                }
                
            } catch (error) {
                window.mostrarNotificacion(error.message, "error");
            }
        });
    });
}

// Función para configurar botones de inscripción
export function configurarBotonesInscripcion() {
    console.log("Configurando botones de inscripción");
    
    // Utilizar selectores más simples y robustos
    const inscripcionButtons = document.querySelectorAll('.inscribirse-btn');
    
    if (inscripcionButtons.length === 0) {
        console.log("No se encontraron botones de inscripción");
        return;
    }
    
    console.log(`Se encontraron ${inscripcionButtons.length} botones de inscripción`);
    
    inscripcionButtons.forEach(button => {
        const tournamentId = button.dataset.tournamentId;
        if (!tournamentId) {
            console.log("Botón sin ID de torneo", button);
            return;
        }
        
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                // Mostrar modal de inscripción
                const inscripcionModal = document.getElementById('inscripcion-modal');
                if (inscripcionModal) {
                    // Establecer ID del torneo en el formulario
                    document.getElementById('inscripcion-torneo-id').value = tournamentId;
                    
                    // Mostrar modal
                    inscripcionModal.classList.remove('hidden');
                    inscripcionModal.classList.add('flex');
                } else {
                    console.error("No se encontró el modal de inscripción");
                }
            } catch (error) {
                window.mostrarNotificacion(error.message, "error");
            }
        });
    });
    
    // Configurar formulario de inscripción
    const inscripcionForm = document.getElementById('inscripcion-form');
    if (inscripcionForm) {
        inscripcionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const tournamentId = document.getElementById('inscripcion-torneo-id').value;
                const playerName = document.getElementById('inscripcion-nombre').value;
                const discordUsername = document.getElementById('inscripcion-discord').value;
                
                // Validar campos
                if (!playerName || playerName.trim() === '') {
                    throw new Error("Debes proporcionar un nombre de jugador");
                }
                
                // Mostrar estado de carga
                const submitBtn = document.getElementById('inscripcion-submit');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
                
                // Registrar en el torneo
                await registerForTournament(tournamentId, playerName, discordUsername);
                
                // Cerrar modal
                const modal = document.getElementById('inscripcion-modal');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                
                // Mostrar mensaje de éxito
                window.mostrarNotificacion("Inscripción realizada con éxito", "success");
                
                // Actualizar UI
                const button = document.querySelector(`[data-tournament-id="${tournamentId}"].inscribirse-btn`);
                if (button) {
                    button.disabled = true;
                    button.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Inscrito';
                    button.classList.remove('dtowin-primary');
                    button.classList.add('bg-green-500');
                }
                
                // Recargar página después de un breve retraso para actualizar UI
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                
            } catch (error) {
                document.getElementById('inscripcion-error').textContent = error.message;
            } finally {
                // Restaurar botón
                const submitBtn = document.getElementById('inscripcion-submit');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Inscribirme';
                }
            }
        });
    }
}
