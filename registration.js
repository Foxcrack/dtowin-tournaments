// registration.js - Script para gestionar la inscripción a torneos con nickname y Discord
// Versión corregida para evitar bucles infinitos

// Referencias a elementos del DOM para el modal de inscripción
const tournamentRegistrationModal = document.getElementById('tournamentRegistrationModal');
const closeTournamentRegistrationModal = document.getElementById('closeTournamentRegistrationModal');
const tournamentRegistrationForm = document.getElementById('tournamentRegistrationForm');
const tournamentIdInput = document.getElementById('tournamentId');
const tournamentNickname = document.getElementById('tournamentNickname');
const discordUsername = document.getElementById('discordUsername');
const summaryTournamentName = document.getElementById('summaryTournamentName');
const summaryTournamentDate = document.getElementById('summaryTournamentDate');
const summaryTournamentTime = document.getElementById('summaryTournamentTime');
const cancelRegistrationBtn = document.getElementById('cancelRegistrationBtn');
const confirmRegistrationBtn = document.getElementById('confirmRegistrationBtn');

// Flag para evitar inicializaciones múltiples
let isRegistrationSystemInitialized = false;

// Variable para almacenar torneo actual
let currentTournament = null;

// Inicializar el sistema de inscripción una vez que el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Evitar inicialización múltiple
    if (isRegistrationSystemInitialized) {
        console.log("Sistema de inscripción ya inicializado");
        return;
    }
    
    console.log("Inicializando sistema de inscripción a torneos");
    
    // Verificar que los elementos existen
    if (!tournamentRegistrationModal) {
        console.error("No se encontró el modal de inscripción en el DOM");
        return;
    }
    
    // Configurar eventos para el modal
    if (closeTournamentRegistrationModal) {
        closeTournamentRegistrationModal.addEventListener('click', closeTournamentModal);
    }
    
    if (cancelRegistrationBtn) {
        cancelRegistrationBtn.addEventListener('click', closeTournamentModal);
    }
    
    if (tournamentRegistrationForm) {
        tournamentRegistrationForm.addEventListener('submit', handleTournamentRegistration);
    }
    
    // Configurar los botones de inscripción existentes (UNA SOLA VEZ)
    setupInscriptionButtons();
    
    // Exponer la función para abrir el modal
    window.openTournamentRegistrationModal = openTournamentModal;
    
    // Marcar como inicializado
    isRegistrationSystemInitialized = true;
    console.log("Sistema de inscripción configurado correctamente");
});

// Configurar botones de inscripción (versión simplificada, sin observer)
function setupInscriptionButtons() {
    console.log("Botones de inscripción configurados");
    
    // IMPORTANTE: No usamos un observer para evitar bucles infinitos
    // En su lugar, esta función debe ser llamada después de que los torneos se cargan
    
    // Buscar todos los botones de inscripción actuales
    document.querySelectorAll('.inscribirse-btn').forEach(button => {
        // Verificar si el botón ya tiene un controlador para evitar duplicados
        if (button.dataset.hasHandler === 'true') {
            return; // Saltar si ya tiene un handler
        }
        
        // Marcar el botón como que ya tiene un handler
        button.dataset.hasHandler = 'true';
        
        // Añadir el controlador de eventos
        button.addEventListener('click', function(event) {
            event.preventDefault();
            
            // Verificar que el usuario está autenticado
            if (!firebase.auth().currentUser) {
                if (typeof mostrarNotificacion === 'function') {
                    mostrarNotificacion("Debes iniciar sesión para inscribirte", "error");
                } else {
                    alert("Debes iniciar sesión para inscribirte");
                }
                
                // Intentar abrir el modal de login
                const loginBtn = document.getElementById('loginBtn');
                if (loginBtn) {
                    loginBtn.click();
                }
                return;
            }
            
            // Obtener el ID del torneo
            const torneoId = this.dataset.torneoId;
            if (!torneoId) {
                console.error("No se encontró el ID del torneo");
                return;
            }
            
            // Abrir el modal de inscripción con los datos del torneo
            openTournamentModal(torneoId);
        });
    });
}

// Abrir el modal de inscripción con los datos del torneo
function openTournamentModal(torneoId) {
    console.log("Abriendo modal de inscripción para torneo:", torneoId);
    
    // Obtener datos del torneo
    firebase.firestore().collection('torneos').doc(torneoId).get()
        .then(doc => {
            if (!doc.exists) {
                throw new Error("No se encontró información del torneo");
            }
            
            const torneoData = doc.data();
            currentTournament = {
                id: torneoId,
                ...torneoData
            };
            
            // Configurar campos del formulario
            tournamentIdInput.value = torneoId;
            document.getElementById('tournamentRegistrationTitle').textContent = 
                `Inscripción a ${torneoData.nombre || 'Torneo'}`;
            
            // Prellenar el nickname con el nombre del usuario
            const user = firebase.auth().currentUser;
            if (user) {
                tournamentNickname.value = user.displayName || '';
            }
            
            // Mostrar información del torneo
            summaryTournamentName.textContent = torneoData.nombre || 'Sin nombre';
            
            // Formatear fecha del torneo
            let fechaText = 'Fecha no disponible';
            if (torneoData.fecha) {
                const fecha = new Date(torneoData.fecha.seconds * 1000);
                fechaText = fecha.toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
            summaryTournamentDate.textContent = fechaText;
            
            // Formatear hora del torneo
            summaryTournamentTime.textContent = torneoData.hora || 'Hora no especificada';
            
            // Mostrar el modal
            tournamentRegistrationModal.classList.remove('hidden');
        })
        .catch(error => {
            console.error("Error al cargar datos del torneo:", error);
            
            if (typeof mostrarNotificacion === 'function') {
                mostrarNotificacion("Error al cargar la información del torneo", "error");
            } else {
                alert("Error al cargar la información del torneo: " + error.message);
            }
        });
}

// Cerrar el modal de inscripción
function closeTournamentModal() {
    tournamentRegistrationModal.classList.add('hidden');
    tournamentRegistrationForm.reset();
    currentTournament = null;
}

// Manejar el envío del formulario de inscripción
async function handleTournamentRegistration(event) {
    event.preventDefault();
    
    if (!currentTournament) {
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion("Error al procesar la inscripción", "error");
        }
        return;
    }
    
    // Obtener datos del formulario
    const nickname = tournamentNickname.value.trim();
    const discord = discordUsername.value.trim();
    const torneoId = tournamentIdInput.value;
    
    // Validar nickname
    if (!nickname) {
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion("El nombre de usuario es obligatorio", "error");
        } else {
            alert("El nombre de usuario es obligatorio");
        }
        return;
    }
    
    // Verificar autenticación
    const user = firebase.auth().currentUser;
    if (!user) {
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion("Debes iniciar sesión para inscribirte", "error");
        }
        closeTournamentModal();
        return;
    }
    
    // Mostrar estado de carga
    confirmRegistrationBtn.disabled = true;
    const originalText = confirmRegistrationBtn.textContent;
    confirmRegistrationBtn.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Inscribiendo...';
    
    try {
        await registerForTournament(torneoId, nickname, discord);
        
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion("¡Inscripción completada con éxito!", "success");
        } else {
            alert("¡Inscripción completada con éxito!");
        }
        
        closeTournamentModal();
        
        // Recargar torneos o la página para actualizar la UI
        if (typeof loadTournaments === 'function') {
            await loadTournaments();
        } else {
            // Si no existe la función, simplemente recargar la página
            window.location.reload();
        }
    } catch (error) {
        console.error("Error al inscribirse al torneo:", error);
        
        if (typeof mostrarNotificacion === 'function') {
            mostrarNotificacion(error.message || "Error al procesar la inscripción", "error");
        } else {
            alert("Error al procesar la inscripción: " + error.message);
        }
    } finally {
        // Restaurar botón
        confirmRegistrationBtn.disabled = false;
        confirmRegistrationBtn.textContent = originalText;
    }
}

// Función para inscribir al usuario al torneo
async function registerForTournament(torneoId, nickname, discord = null) {
    const user = firebase.auth().currentUser;
    
    if (!user) {
        throw new Error("Debes iniciar sesión para inscribirte");
    }
    
    // Referencia al documento del torneo
    const torneoRef = firebase.firestore().collection('torneos').doc(torneoId);
    
    // Usar una transacción para garantizar consistencia
    return firebase.firestore().runTransaction(async (transaction) => {
        // Leer el documento del torneo
        const torneoDoc = await transaction.get(torneoRef);
        
        if (!torneoDoc.exists) {
            throw new Error("El torneo no existe");
        }
        
        const torneoData = torneoDoc.data();
        
        // Verificar que el torneo está abierto para inscripciones
        if (torneoData.estado !== 'Abierto') {
            throw new Error("Este torneo no está abierto para inscripciones");
        }
        
        // Verificar si hay cupos disponibles
        const currentParticipants = torneoData.participants || [];
        if (torneoData.capacidad && currentParticipants.length >= torneoData.capacidad) {
            throw new Error("No hay cupos disponibles para este torneo");
        }
        
        // Verificar si el usuario ya está inscrito
        if (currentParticipants.includes(user.uid)) {
            throw new Error("Ya estás inscrito en este torneo");
        }
        
        // Datos del participante
        const participantData = {
            nickname: nickname,
            discord: discord || null,
            registeredAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Preparar datos para actualizar el torneo
        const newParticipants = [...currentParticipants, user.uid];
        const participantsData = torneoData.participantsData || {};
        participantsData[user.uid] = participantData;
        
        // Actualizar el documento del torneo
        transaction.update(torneoRef, {
            participants: newParticipants,
            participantsData: participantsData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Buscar y actualizar el documento del usuario
        const userQuery = await firebase.firestore().collection('usuarios')
            .where('uid', '==', user.uid)
            .limit(1)
            .get();
        
        if (!userQuery.empty) {
            const userDoc = userQuery.docs[0];
            const userData = userDoc.data();
            const userRef = firebase.firestore().collection('usuarios').doc(userDoc.id);
            
            // Si torneos es un array
            if (Array.isArray(userData.torneos)) {
                if (!userData.torneos.includes(torneoId)) {
                    transaction.update(userRef, {
                        torneos: [...userData.torneos, torneoId],
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } 
            // Si torneos es un objeto o no existe
            else {
                const userTorneos = userData.torneos || {};
                userTorneos[torneoId] = {
                    registerDate: firebase.firestore.FieldValue.serverTimestamp(),
                    nickname: nickname,
                    discord: discord || null
                };
                
                transaction.update(userRef, {
                    torneos: userTorneos,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }
        
        return true;
    });
}

// Exponer funciones globalmente
window.registerTournamentWithNickname = registerForTournament;
window.setupTournamentButtons = setupInscriptionButtons;
