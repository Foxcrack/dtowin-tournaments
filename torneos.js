// torneos.js - Script completo para la gestión de torneos
// Versión corregida para evitar bucles infinitos y problemas de carga

import { auth } from './firebase.js';

// Variables para prevenir cargas y configuraciones múltiples
let torneosCargados = false;
let botonesConfigurados = false;

// Obtener color según el estado del torneo
function getStatusColor(estado) {
    switch(estado) {
        case 'Abierto':
            return 'green-500';
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

// Renderizar puntos por posición
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

// Mostrar mensaje de error
function showErrorMessage(message = "Error al cargar torneos. Inténtalo de nuevo.") {
    const containers = [
        document.getElementById('torneos-en-proceso'),
        document.getElementById('torneos-abiertos'),
        document.getElementById('torneos-proximos')
    ];
    
    containers.forEach(container => {
        if (container) {
            container.innerHTML = `
                <div class="col-span-full text-center p-4">
                    <p class="text-red-500">${message}</p>
                    <button class="text-blue-500 underline mt-2" onclick="window.location.reload()">
                        Recargar página
                    </button>
                </div>
            `;
        }
    });
}

// Mostrar notificación
function mostrarNotificacion(mensaje, tipo = "info") {
    // Usar función global si está disponible
    if (window.mostrarNotificacion) {
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

// Verificar si el usuario está autenticado
function isAuthenticated() {
    return !!auth.currentUser;
}

// Función principal para cargar torneos
export async function loadTournaments() {
    try {
        console.log("Iniciando carga de torneos...");
        
        // Evitar cargar múltiples veces
        if (torneosCargados) {
            console.log("Los torneos ya están cargados. Omitiendo carga duplicada.");
            return;
        }
        
        // Contenedores para los diferentes tipos de torneos
        const enProcesoContainer = document.getElementById('torneos-en-proceso');
        const abiertosContainer = document.getElementById('torneos-abiertos');
        const proximosContainer = document.getElementById('torneos-proximos');
        
        // Verificar si existen los contenedores
        if (!enProcesoContainer && !abiertosContainer && !proximosContainer) {
            console.log("No se encontraron contenedores para torneos en el DOM");
            return;
        }
        
        // Mostrar indicadores de carga
        const loadingHTML = `
            <div class="col-span-full flex justify-center items-center p-4">
                <div class="spinner w-8 h-8 border-t-4 border-b-4 border-blue-500 rounded-full"></div>
                <p class="ml-3 text-gray-600">Cargando torneos...</p>
            </div>
        `;
        
        if (enProcesoContainer) enProcesoContainer.innerHTML = loadingHTML;
        if (abiertosContainer) abiertosContainer.innerHTML = loadingHTML;
        if (proximosContainer) proximosContainer.innerHTML = loadingHTML;
        
        // Establecer un timeout para la carga
        const loadingTimeout = setTimeout(() => {
            console.error("Tiempo de espera agotado al cargar torneos");
            showErrorMessage("Tiempo de espera agotado. Verifica tu conexión a internet y recarga la página.");
        }, 15000); // 15 segundos máximo
        
        try {
            // Obtener todos los torneos visibles de Firebase
            const torneosSnapshot = await firebase.firestore().collection('torneos')
                .where("visible", "!=", false)
                .get();
            
            // Limpiar el timeout ya que se completó la consulta
            clearTimeout(loadingTimeout);
            
            // Clasificar torneos por estado
            const torneosEnProceso = [];
            const torneosAbiertos = [];
            const torneosProximos = [];
            
            // Procesar los torneos
            torneosSnapshot.forEach(doc => {
                const torneo = {
                    id: doc.id,
                    ...doc.data()
                };
                
                // Clasificar según estado
                if (torneo.estado === 'En Progreso') {
                    torneosEnProceso.push(torneo);
                } else if (torneo.estado === 'Abierto') {
                    torneosAbiertos.push(torneo);
                } else if (torneo.estado === 'Próximamente') {
                    torneosProximos.push(torneo);
                }
            });
            
            console.log(`Torneos encontrados: ${torneosEnProceso.length} en progreso, ${torneosAbiertos.length} abiertos, ${torneosProximos.length} próximos`);
            
            // Ordenar por fecha (más cercana primero)
            const sortByDate = (a, b) => {
                const dateA = a.fecha ? new Date(a.fecha.seconds * 1000) : new Date();
                const dateB = b.fecha ? new Date(b.fecha.seconds * 1000) : new Date();
                return dateA - dateB;
            };
            
            torneosEnProceso.sort(sortByDate);
            torneosAbiertos.sort(sortByDate);
            torneosProximos.sort(sortByDate);
            
            // Renderizar torneos en cada contenedor
            if (enProcesoContainer) {
                if (torneosEnProceso.length > 0) {
                    enProcesoContainer.innerHTML = renderTorneos(torneosEnProceso);
                    document.getElementById('en-proceso-section').style.display = 'block';
                } else {
                    enProcesoContainer.innerHTML = '<div class="col-span-full text-center p-4"><p class="text-gray-500">No hay torneos en progreso actualmente</p></div>';
                    document.getElementById('en-proceso-section').style.display = 'none';
                }
            }
            
            if (abiertosContainer) {
                if (torneosAbiertos.length > 0) {
                    abiertosContainer.innerHTML = renderTorneos(torneosAbiertos);
                    document.getElementById('abiertos-section').style.display = 'block';
                } else {
                    abiertosContainer.innerHTML = '<div class="col-span-full text-center p-4"><p class="text-gray-500">No hay torneos con inscripciones abiertas</p></div>';
                    document.getElementById('abiertos-section').style.display = 'none';
                }
            }
            
            if (proximosContainer) {
                if (torneosProximos.length > 0) {
                    proximosContainer.innerHTML = renderTorneos(torneosProximos);
                    document.getElementById('proximos-section').style.display = 'block';
                } else {
                    proximosContainer.innerHTML = '<div class="col-span-full text-center p-4"><p class="text-gray-500">No hay torneos próximamente</p></div>';
                    document.getElementById('proximos-section').style.display = 'none';
                }
            }
            
            // Configurar botones de inscripción (sin observer)
            setupTournamentButtons();
            
            // Marcar como cargado
            torneosCargados = true;
            
            console.log("Torneos cargados correctamente");
            
        } catch (error) {
            // Limpiar el timeout si hay un error
            clearTimeout(loadingTimeout);
            
            console.error("Error al cargar torneos:", error);
            showErrorMessage(error.message || "Error al cargar torneos. Inténtalo de nuevo.");
        }
        
    } catch (error) {
        console.error("Error general al cargar torneos:", error);
        showErrorMessage("Error al inicializar la carga de torneos");
    }
}

// Función para renderizar torneos
function renderTorneos(torneosList) {
    if (!torneosList || torneosList.length === 0) {
        return '<div class="col-span-full text-center p-4"><p class="text-gray-500">No hay torneos disponibles</p></div>';
    }
    
    let html = '';
    
    torneosList.forEach(torneo => {
        try {
            // Formatear fecha
            let fechaFormateada = 'Fecha no disponible';
            if (torneo.fecha && torneo.fecha.seconds) {
                const fecha = new Date(torneo.fecha.seconds * 1000);
                fechaFormateada = fecha.toLocaleDateString('es-ES', {
                    day: 'numeric', month: 'long', year: 'numeric'
                });
            }
            
            // Formatear hora
            const horaFormateada = torneo.hora || 'Hora no especificada';
            
            // Calcular inscripciones y capacidad
            const participants = torneo.participants || [];
            const inscritos = participants.length;
            const capacidad = torneo.capacidad || '∞';
            const lleno = torneo.capacidad && inscritos >= torneo.capacidad;
            
            // Verificar si el usuario actual está inscrito
            const estaInscrito = isAuthenticated() && auth.currentUser && participants.includes(auth.currentUser.uid);
            
            // Determinar estado del botón de inscripción
            let botonInscripcion = '';
            
            if (torneo.estado === 'Abierto') {
                if (!isAuthenticated()) {
                    // Usuario no autenticado
                    botonInscripcion = `
                        <button class="w-full dtowin-blue text-white py-2 rounded-lg hover:opacity-90 transition font-semibold register-btn">
                            Registrarse para participar
                        </button>
                    `;
                } else if (estaInscrito) {
                    // Usuario inscrito
                    botonInscripcion = `
                        <button class="w-full dtowin-red text-white py-2 rounded-lg hover:opacity-90 transition font-semibold desinscribirse-btn" data-torneo-id="${torneo.id}">
                            Desinscribirse
                        </button>
                    `;
                } else if (lleno) {
                    // Torneo lleno
                    botonInscripcion = `
                        <button class="w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed font-semibold">
                            Cupos Agotados
                        </button>
                    `;
                } else {
                    // Usuario puede inscribirse
                    botonInscripcion = `
                        <button class="w-full dtowin-blue text-white py-2 rounded-lg hover:opacity-90 transition font-semibold inscribirse-btn" data-torneo-id="${torneo.id}">
                            Inscribirse
                        </button>
                    `;
                }
            } else if (torneo.estado === 'En Progreso') {
                botonInscripcion = `
                    <button class="w-full bg-yellow-500 text-white py-2 rounded-lg cursor-not-allowed font-semibold">
                        En Progreso
                    </button>
                `;
            } else {
                botonInscripcion = `
                    <button class="w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed font-semibold">
                        Próximamente
                    </button>
                `;
            }
            
            // Obtener imagen o placeholder
            const imageSrc = torneo.imageUrl || torneo.bannerImageUrl || 'https://via.placeholder.com/400x200?text=Torneo+Dtowin';
            
            // Generar puntos por posición si existen
            const puntosPosicionHTML = torneo.puntosPosicion ? renderPuntosPosicion(torneo.puntosPosicion) : '';
            
            // HTML para cada tarjeta de torneo
            html += `
                <div class="bg-white rounded-xl shadow-lg overflow-hidden tournament-card transition duration-300" data-torneo-id="${torneo.id}">
                    <img src="${imageSrc}" alt="${torneo.nombre || 'Torneo'}" class="w-full h-48 object-cover">
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
                        
                        <div class="bg-gray-100 rounded-lg p-3 mb-4">
                            <div class="flex justify-between items-center mb-2">
                                <h4 class="font-semibold text-gray-700">Participantes:</h4>
                                <span class="text-sm font-medium ${lleno ? 'text-red-500' : 'text-green-500'}">${inscritos}/${capacidad}</span>
                            </div>
                            <div class="participants-list text-sm text-gray-600 max-h-20 overflow-y-auto" id="participants-${torneo.id}">
                                <p class="text-center text-gray-500 text-xs">${inscritos > 0 ? `${inscritos} participantes inscritos` : 'No hay participantes inscritos'}</p>
                            </div>
                        </div>
                        
                        ${puntosPosicionHTML ? `
                        <div class="bg-gray-100 rounded-lg p-3 mb-4">
                            <h4 class="font-semibold text-gray-700 mb-2">Puntos por posición:</h4>
                            <div class="flex flex-wrap gap-2">
                                ${puntosPosicionHTML}
                            </div>
                        </div>
                        ` : ''}
                        
                        ${botonInscripcion}
                    </div>
                </div>
            `;
        } catch (err) {
            console.error("Error al renderizar torneo:", err);
            // Si hay error, mostrar una tarjeta de error
            html += `
                <div class="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div class="p-6">
                        <p class="text-red-500">Error al mostrar este torneo</p>
                    </div>
                </div>
            `;
        }
    });
    
    return html;
}

// Cargar la lista de participantes para un torneo específico
async function loadParticipants(torneoId) {
    const container = document.getElementById(`participants-${torneoId}`);
    if (!container) return;
    
    try {
        // Obtener datos del torneo
        const torneoDoc = await firebase.firestore().collection('torneos').doc(torneoId).get();
        
        if (!torneoDoc.exists) {
            container.innerHTML = '<p class="text-center text-gray-500 text-xs">Información no disponible</p>';
            return;
        }
        
        const torneoData = torneoDoc.data();
        const participantIds = torneoData.participants || [];
        const participantsData = torneoData.participantsData || {};
        
        if (participantIds.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 text-xs">No hay participantes inscritos</p>';
            return;
        }
        
        // Mostrar máximo 5 participantes
        const maxToShow = Math.min(5, participantIds.length);
        let html = '<ul class="space-y-1">';
        
        for (let i = 0; i < maxToShow; i++) {
            const uid = participantIds[i];
            
            // Usar nickname si está disponible en participantsData
            let displayName = 'Participante';
            
            if (participantsData[uid] && participantsData[uid].nickname) {
                displayName = participantsData[uid].nickname;
            } else {
                // Intenta buscar en la base de datos
                try {
                    const userQuery = await firebase.firestore().collection('usuarios')
                        .where('uid', '==', uid)
                        .limit(1)
                        .get();
                    
                    if (!userQuery.empty) {
                        const userData = userQuery.docs[0].data();
                        displayName = userData.nombre || 'Participante';
                    }
                } catch (error) {
                    console.warn("Error al buscar nombre de usuario:", error);
                }
            }
            
            html += `
                <li class="text-xs truncate">
                    <i class="fas fa-user text-gray-400 mr-1"></i>
                    ${displayName}
                </li>
            `;
        }
        
        // Si hay más participantes, mostrar cuántos más
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
        console.error(`Error al cargar participantes para torneo ${torneoId}:`, error);
        container.innerHTML = '<p class="text-center text-gray-500 text-xs">Error al cargar participantes</p>';
    }
}

// Configurar botones de inscripción
function setupTournamentButtons() {
    // Evitar configurar múltiples veces
    if (botonesConfigurados) {
        console.log("Botones ya configurados. Omitiendo.");
        return;
    }
    
    console.log("Configurando botones de inscripción...");
    
    try {
        // Botones de inscripción
        document.querySelectorAll('.inscribirse-btn').forEach(button => {
            // Marcar como configurado para evitar duplicados
            if (button.dataset.configured === 'true') return;
            button.dataset.configured = 'true';
            
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Obtener ID del torneo
                const torneoId = this.dataset.torneoId;
                
                // Verificar si el usuario está autenticado
                if (!isAuthenticated()) {
                    mostrarNotificacion("Debes iniciar sesión para inscribirte", "error");
                    // Abrir modal de login
                    const loginBtn = document.getElementById('loginBtn');
                    if (loginBtn) loginBtn.click();
                    return;
                }
                
                // Si existe el modal de inscripción personalizado, usarlo
                if (typeof window.openTournamentRegistrationModal === 'function') {
                    window.openTournamentRegistrationModal(torneoId);
                } else {
                    // Fallback: usar el método tradicional
                    registerForTournament(torneoId);
                }
            });
        });
        
        // Botones de desinscripción
        document.querySelectorAll('.desinscribirse-btn').forEach(button => {
            // Marcar como configurado para evitar duplicados
            if (button.dataset.configured === 'true') return;
            button.dataset.configured = 'true';
            
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Obtener ID del torneo
                const torneoId = this.dataset.torneoId;
                
                // Verificar si el usuario está autenticado
                if (!isAuthenticated()) {
                    mostrarNotificacion("Debes iniciar sesión para desinscribirte", "error");
                    return;
                }
                
                // Confirmar acción
                if (confirm("¿Estás seguro que deseas desinscribirte de este torneo?")) {
                    unregisterFromTournament(torneoId);
                }
            });
        });
        
        // Botones para usuarios no registrados
        document.querySelectorAll('.register-btn').forEach(button => {
            // Marcar como configurado para evitar duplicados
            if (button.dataset.configured === 'true') return;
            button.dataset.configured = 'true';
            
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Mostrar mensaje y redirigir a registro
                mostrarNotificacion("Para participar en torneos, primero debes registrarte", "info");
                
                // Abrir modal de registro
                const registerBtn = document.getElementById('registerBtn');
                if (registerBtn) {
                    setTimeout(() => {
                        registerBtn.click();
                    }, 1000);
                } else {
                    // Alternativa: abrir modal de login
                    const loginBtn = document.getElementById('loginBtn');
                    if (loginBtn) loginBtn.click();
                }
            });
        });
        
        // Cargar participantes para cada torneo visible
        document.querySelectorAll('[id^="participants-"]').forEach(container => {
            const torneoId = container.id.replace('participants-', '');
            loadParticipants(torneoId);
        });
        
        // Marcar como configurados
        botonesConfigurados = true;
        
        console.log("Botones de inscripción configurados correctamente");
        
    } catch (error) {
        console.error("Error al configurar botones:", error);
    }
}

// Inscribir al usuario en un torneo
async function registerForTournament(torneoId) {
    try {
        console.log("Inscribiendo al usuario en torneo:", torneoId);
        
        // Verificar si hay modal de inscripción personalizado
        if (typeof window.registerTournamentWithNickname === 'function') {
            // Si existe la función personalizada, mostrar modal primero
            if (typeof window.openTournamentRegistrationModal === 'function') {
                window.openTournamentRegistrationModal(torneoId);
                return;
            }
        }
        
        // Método tradicional de inscripción (sin nickname/discord)
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Debes iniciar sesión para inscribirte");
        }
        
        // Obtener documento del torneo
        const torneoRef = firebase.firestore().doc(`torneos/${torneoId}`);
        const torneoSnap = await torneoRef.get();
        
        if (!torneoSnap.exists) {
            throw new Error("El torneo no existe");
        }
        
        const torneoData = torneoSnap.data();
        
        // Verificar que el torneo esté abierto
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
        
        // Inscribir al usuario
        await torneoRef.update({
            participants: [...currentParticipants, user.uid],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // También actualizar el usuario para registrar su participación
        try {
            const userQuery = await firebase.firestore().collection('usuarios')
                .where('uid', '==', user.uid)
                .limit(1)
                .get();
            
            if (!userQuery.empty) {
                const userDoc = userQuery.docs[0];
                
                // Añadir torneo a la lista de torneos del usuario
                const userData = userDoc.data();
                
                if (Array.isArray(userData.torneos)) {
                    if (!userData.torneos.includes(torneoId)) {
                        await firebase.firestore().doc(`usuarios/${userDoc.id}`).update({
                            torneos: [...userData.torneos, torneoId],
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                } else {
                    // Si torneos es un objeto o no existe
                    const userTorneos = userData.torneos || {};
                    userTorneos[torneoId] = {
                        registerDate: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    await firebase.firestore().doc(`usuarios/${userDoc.id}`).update({
                        torneos: userTorneos,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        } catch (userUpdateError) {
            console.warn("No se pudo actualizar el usuario, pero la inscripción continúa:", userUpdateError);
        }
        
        // Mostrar mensaje de éxito
        mostrarNotificacion("¡Te has inscrito correctamente al torneo!", "success");
        
        // Recargar torneos para actualizar la UI
        torneosCargados = false; // Forzar recarga
        await loadTournaments();
        
        return true;
        
    } catch (error) {
        console.error("Error al inscribirse al torneo:", error);
        mostrarNotificacion(error.message || "Error al inscribirse al torneo", "error");
        throw error;
    }
}

// Desinscribir al usuario de un torneo
async function unregisterFromTournament(torneoId) {
    try {
        console.log("Desinscribiendo al usuario del torneo:", torneoId);
        
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Debes iniciar sesión para desinscribirte");
        }
        
        // Obtener documento del torneo
        const torneoRef = firebase.firestore().doc(`torneos/${torneoId}`);
        const torneoSnap = await torneoRef.get();
        
        if (!torneoSnap.exists) {
            throw new Error("El torneo no existe");
        }
        
        const torneoData = torneoSnap.data();
        
        // Verificar que el torneo esté aún abierto o en proceso
        if (torneoData.estado !== 'Abierto' && torneoData.estado !== 'En Progreso') {
            throw new Error("No puedes desinscribirte de este torneo");
        }
        
        // Verificar si el usuario está inscrito
        const currentParticipants = torneoData.participants || [];
        if (!currentParticipants.includes(user.uid)) {
            throw new Error("No estás inscrito en este torneo");
        }
        
        // Usar arrayRemove para evitar problemas de concurrencia
        await torneoRef.update({
            participants: firebase.firestore.FieldValue.arrayRemove(user.uid),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Si hay datos del participante, eliminarlos también
        if (torneoData.participantsData && torneoData.participantsData[user.uid]) {
            const participantsData = {...torneoData.participantsData};
            delete participantsData[user.uid];
            
            await torneoRef.update({
                participantsData: participantsData
            });
        }
        
        // También actualizar el usuario para eliminar su participación
        try {
            const userQuery = await firebase.firestore().collection('usuarios')
                .where('uid', '==', user.uid)
                .limit(1)
                .get();
            
            if (!userQuery.empty) {
                const userDoc = userQuery.docs[0];
                const userData = userDoc.data();
                
                // Si torneos es un array
                if (Array.isArray(userData.torneos)) {
                    await firebase.firestore().doc(`usuarios/${userDoc.id}`).update({
                        torneos: firebase.firestore.FieldValue.arrayRemove(torneoId),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } 
                // Si torneos es un objeto
                else if (userData.torneos && userData.torneos[torneoId]) {
                    const torneosUpdate = {...userData.torneos};
                    delete torneosUpdate[torneoId];
                    
                    await firebase.firestore().doc(`usuarios/${userDoc.id}`).update({
                        torneos: torneosUpdate,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        } catch (userUpdateError) {
            console.warn("No se pudo actualizar el usuario, pero la desinscripción continúa:", userUpdateError);
        }
        
        // Mostrar mensaje de éxito
        mostrarNotificacion("Te has desinscrito del torneo correctamente", "success");
        
        // Recargar torneos para actualizar la UI
        torneosCargados = false; // Forzar recarga
        await loadTournaments();
        
        return true;
        
    } catch (error) {
        console.error("Error al desinscribirse del torneo:", error);
        mostrarNotificacion(error.message || "Error al desinscribirse del torneo", "error");
        throw error;
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si la función debe ejecutarse en esta página
    const shouldLoadTournaments = 
        document.getElementById('torneos-en-proceso') || 
        document.getElementById('torneos-abiertos') || 
        document.getElementById('torneos-proximos');
    
    if (shouldLoadTournaments && !torneosCargados) {
        console.log("Página de torneos detectada, iniciando carga");
        loadTournaments();
    } else {
        console.log("No es una página de torneos o ya se han cargado, omitiendo carga");
    }
});

// Exportar funciones para uso en otros scripts
export {
    loadTournaments,
    registerForTournament,
    unregisterFromTournament,
    isAuthenticated,
    mostrarNotificacion,
    setupTournamentButtons
};
