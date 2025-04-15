// torneos-eventos.js - Módulo auxiliar para eventos de torneos
import { auth, db } from './firebase.js';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    query, 
    where, 
    limit,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Función para cargar participantes de un torneo
export async function loadParticipants(torneoId, maxToShow = 5) {
    const containerID = `participants-${torneoId}`;
    const container = document.getElementById(containerID);
    
    if (!container) return;
    
    try {
        // Consultar información del torneo para obtener lista de participantes
        const torneoRef = doc(db, "torneos", torneoId);
        const torneoSnap = await getDoc(torneoRef);
        
        if (!torneoSnap.exists()) {
            container.innerHTML = '<p class="text-center text-gray-500 text-xs">No hay información disponible</p>';
            return;
        }
        
        const torneo = torneoSnap.data();
        const participantIds = torneo.participants || [];
        
        // Si no hay participantes
        if (participantIds.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 text-xs">No hay participantes inscritos</p>';
            return;
        }
        
        // Limitar el número de participantes a mostrar
        const idsToShow = participantIds.slice(0, maxToShow);
        
        // Obtener información de los participantes
        let html = '<ul class="space-y-1">';
        
        // Usar Promise.all para cargar todos los participantes en paralelo
        const participantsPromises = idsToShow.map(async (uid) => {
            try {
                // Buscar primero en participant_info
                const infoQuery = query(
                    collection(db, "participant_info"),
                    where("userId", "==", uid),
                    where("tournamentId", "==", torneoId),
                    limit(1)
                );
                
                const infoSnapshot = await getDocs(infoQuery);
                
                if (!infoSnapshot.empty) {
                    const info = infoSnapshot.docs[0].data();
                    return {
                        name: info.playerName || 'Participante',
                        discord: info.discordUsername || null,
                        checkedIn: info.checkedIn || false,
                        photoURL: null
                    };
                }
                
                // Si no hay info específica, buscar en usuarios
                const userQuery = query(
                    collection(db, "usuarios"),
                    where("uid", "==", uid),
                    limit(1)
                );
                
                const userSnapshot = await getDocs(userQuery);
                
                if (!userSnapshot.empty) {
                    const user = userSnapshot.docs[0].data();
                    return {
                        name: user.nombre || 'Usuario',
                        discord: null,
                        checkedIn: false,
                        photoURL: user.photoURL || null
                    };
                }
                
                // Si no se encontró información
                return {
                    name: 'Usuario',
                    discord: null,
                    checkedIn: false,
                    photoURL: null
                };
            } catch (error) {
                console.error(`Error al cargar participante ${uid}:`, error);
                return {
                    name: 'Usuario',
                    discord: null,
                    checkedIn: false,
                    photoURL: null
                };
            }
        });
        
        // Esperar a que se resuelvan todas las promesas
        const participants = await Promise.all(participantsPromises);
        
        // Generar HTML para cada participante
        participants.forEach(participant => {
            const checkedInIcon = participant.checkedIn ? 
                '<i class="fas fa-check-circle text-green-500 ml-1" title="Check-in completado"></i>' : '';
            
            const discordTooltip = participant.discord ? 
                `<div class="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 z-10">
                    Discord: ${participant.discord}
                </div>` : '';
            
            html += `
                <li class="text-xs ${participant.discord ? 'cursor-pointer hover:text-blue-600 group relative' : ''}">
                    <i class="fas fa-user text-gray-400 mr-1"></i>
                    ${participant.name}
                    ${checkedInIcon}
                    ${discordTooltip}
                </li>
            `;
        });
        
        // Si hay más participantes que no se muestran
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
        console.error(`Error al cargar participantes para ${torneoId}:`, error);
        container.innerHTML = '<p class="text-center text-red-500 text-xs">Error al cargar participantes</p>';
    }
}

// Función para realizar check-in en un torneo
export async function realizarCheckIn(torneoId) {
    try {
        // Verificar si el usuario está autenticado
        if (!auth.currentUser) {
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
        
        // Actualizar documento con participantes que han hecho check-in
        await updateDoc(torneoRef, {
            checkedInParticipants: [...checkedInParticipants, user.uid],
            updatedAt: serverTimestamp()
        });
        
        // Actualizar información en participant_info si existe
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
        return true;
        
    } catch (error) {
        console.error("Error al hacer check-in:", error);
        throw error;
    }
}

// Función para desinscribirse de un torneo
export async function desinscribirseDeTorneo(torneoId) {
    try {
        // Verificar si el usuario está autenticado
        if (!auth.currentUser) {
            throw new Error("Debes iniciar sesión para desinscribirte");
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
        
        // Verificar que el torneo aún esté en estado Abierto o Check In
        if (torneoData.estado !== 'Abierto' && torneoData.estado !== 'Check In') {
            throw new Error("No puedes desinscribirte de un torneo que ya está en progreso o ha finalizado");
        }
        
        // Actualizar documento eliminando al participante
        await updateDoc(torneoRef, {
            participants: participants.filter(id => id !== user.uid),
            updatedAt: serverTimestamp()
        });
        
        // Actualizar información en participant_info si existe
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
                active: false,
                deactivatedAt: serverTimestamp()
            });
        }
        
        // Actualizar también el perfil del usuario si tiene el torneo registrado
        const userRef = collection(db, "usuarios");
        const userQuery = query(userRef, where("uid", "==", user.uid));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            
            // Si torneos es un array
            if (Array.isArray(userData.torneos)) {
                await updateDoc(doc(db, "usuarios", userSnapshot.docs[0].id), {
                    torneos: userData.torneos.filter(id => id !== torneoId),
                    updatedAt: serverTimestamp()
                });
            } 
            // Si torneos es un objeto
            else if (userData.torneos && typeof userData.torneos === 'object') {
                const newTorneos = { ...userData.torneos };
                delete newTorneos[torneoId];
                
                await updateDoc(doc(db, "usuarios", userSnapshot.docs[0].id), {
                    torneos: newTorneos,
                    updatedAt: serverTimestamp()
                });
            }
        }
        
        console.log("Desinscripción realizada correctamente");
        return true;
        
    } catch (error) {
        console.error("Error al desinscribirse:", error);
        throw error;
    }
}

// Función para registrar a un usuario en un torneo
export async function registrarEnTorneo(torneoId, playerName, discordUsername) {
    try {
        // Verificar si el usuario está autenticado
        if (!auth.currentUser) {
            throw new Error("Debes iniciar sesión para inscribirte");
        }
        
        const user = auth.currentUser;
        
        // Verificar datos del torneo
        const torneoRef = doc(db, "torneos", torneoId);
        const torneoSnap = await getDoc(torneoRef);
        
        if (!torneoSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const torneoData = torneoSnap.data();
        
        // Verificar que el torneo esté abierto
        if (torneoData.estado !== 'Abierto') {
            throw new Error("Este torneo no está abierto para inscripciones");
        }
        
        // Verificar cupos disponibles
        const participants = torneoData.participants || [];
        if (torneoData.capacidad && participants.length >= torneoData.capacidad) {
            throw new Error("No hay cupos disponibles para este torneo");
        }
        
        // Verificar si ya está inscrito
        if (participants.includes(user.uid)) {
            throw new Error("Ya estás inscrito en este torneo");
        }
        
        // Guardar información del participante
        const participantInfoQuery = query(
            collection(db, "participant_info"),
            where("userId", "==", user.uid),
            where("tournamentId", "==", torneoId)
        );
        
        const infoSnapshot = await getDocs(participantInfoQuery);
        
        if (!infoSnapshot.empty) {
            // Actualizar entrada existente
            await updateDoc(doc(db, "participant_info", infoSnapshot.docs[0].id), {
                playerName: playerName,
                discordUsername: discordUsername || null,
                active: true,
                checkedIn: false,
                updatedAt: serverTimestamp()
            });
        } else {
            // Crear nueva entrada
            await addDoc(collection(db, "participant_info"), {
                userId: user.uid,
                tournamentId: torneoId,
                playerName: playerName,
                discordUsername: discordUsername || null,
                active: true,
                checkedIn: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        
        // Añadir usuario a la lista de participantes del torneo
        await updateDoc(torneoRef, {
            participants: [...participants, user.uid],
            updatedAt: serverTimestamp()
        });
        
        // Actualizar documento del usuario
        const userQuery = query(
            collection(db, "usuarios"),
            where("uid", "==", user.uid)
        );
        
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            const userData = userDoc.data();
            const userTorneos = userData.torneos || [];
            
            if (!userTorneos.includes(torneoId)) {
                // Si torneos es un array
                if (Array.isArray(userTorneos)) {
                    await updateDoc(doc(db, "usuarios", userDoc.id), {
                        torneos: [...userTorneos, torneoId],
                        updatedAt: serverTimestamp()
                    });
                } 
                // Si torneos es un objeto
                else if (typeof userTorneos === 'object') {
                    const newTorneos = { ...userTorneos };
                    newTorneos[torneoId] = {
                        joinedAt: serverTimestamp()
                    };
                    
                    await updateDoc(doc(db, "usuarios", userDoc.id), {
                        torneos: newTorneos,
                        updatedAt: serverTimestamp()
                    });
                }
            }
        }
        
        console.log("Inscripción realizada correctamente");
        return true;
        
    } catch (error) {
        console.error("Error al inscribirse:", error);
        throw error;
    }
}

// Función utilitaria para manejar errores en botones
export function handleButtonError(button, originalText, error) {
    console.error("Error en operación:", error);
    
    // Restaurar estado del botón
    if (button) {
        button.disabled = false;
        button.textContent = originalText;
    }
    
    // Mostrar error
    if (typeof window.mostrarNotificacion === 'function') {
        window.mostrarNotificacion(
            error.message || "Error al realizar la operación", 
            "error"
        );
    } else {
        alert(error.message || "Error al realizar la operación");
    }
}

// Exportamos funciones adicionales necesarias
export {
    loadParticipants,
    realizarCheckIn,
    desinscribirseDeTorneo,
    registrarEnTorneo
};
