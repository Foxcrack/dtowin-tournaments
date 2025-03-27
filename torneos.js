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
function showErrorMessage() {
    const containers = [
        document.getElementById('torneos-en-proceso'),
        document.getElementById('torneos-abiertos'),
        document.getElementById('torneos-proximos')
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

// Mostrar notificación
function mostrarNotificacion(mensaje, tipo = "info") {
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

// Obtener datos del banner para un torneo
async function getBannerForTournament(torneo) {
    try {
        // Si el torneo ya tiene una URL de imagen, usarla
        if (torneo.imageUrl) {
            return torneo.imageUrl;
        }
        
        // Si el torneo tiene bannerId, obtener el banner correspondiente
        if (torneo.bannerId) {
            const bannerDoc = await getDoc(doc(db, "banners", torneo.bannerId));
            
            if (bannerDoc.exists()) {
                const bannerData = bannerDoc.data();
                // Usar imageData o imageUrl del banner
                return bannerData.imageData || bannerData.imageUrl || null;
            }
        }
        
        // Si el torneo tiene bannerRef, obtener el banner por referencia
        if (torneo.bannerRef) {
            const bannerDoc = await getDoc(torneo.bannerRef);
            
            if (bannerDoc.exists()) {
                const bannerData = bannerDoc.data();
                return bannerData.imageData || bannerData.imageUrl || null;
            }
        }
        
        // Intentar buscar por nombre del torneo (solución de respaldo)
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
        console.error("Error al obtener banner para torneo:", error);
        return null;
    }
}

// Función principal para cargar torneos
export async function loadTournaments() {
    try {
        console.log("Cargando torneos...");
        
        // Contenedores para los diferentes tipos de torneos
        const enProcesoContainer = document.getElementById('torneos-en-proceso');
        const abiertosContainer = document.getElementById('torneos-abiertos');
        const proximosContainer = document.getElementById('torneos-proximos');
        
        // Verificar si existen los contenedores
        if (!enProcesoContainer || !abiertosContainer || !proximosContainer) {
            console.error("No se encontraron los contenedores para torneos");
            return;
        }
        
        // Mostrar indicadores de carga
        const loadingHTML = `
            <div class="col-span-full flex justify-center items-center p-4">
                <div class="spinner w-8 h-8 border-t-4 border-b-4 border-blue-500 rounded-full"></div>
            </div>
        `;
        enProcesoContainer.innerHTML = loadingHTML;
        abiertosContainer.innerHTML = loadingHTML;
        proximosContainer.innerHTML = loadingHTML;
        
        try {
            // Obtener todos los torneos visibles
            const torneosRef = collection(db, "torneos");
            const q = query(torneosRef, where("visible", "!=", false));
            const querySnapshot = await getDocs(q);
            
            // Clasificar torneos por estado
            const torneosEnProceso = [];
            const torneosAbiertos = [];
            const torneosProximos = [];
            
            // Procesar cada torneo y obtener sus datos de banner
            const torneoPromises = [];
            
            querySnapshot.forEach(docSnapshot => {
                const torneo = {
                    id: docSnapshot.id,
                    ...docSnapshot.data()
                };
                
                // Agregar promesa para cargar el banner
                torneoPromises.push(
                    getBannerForTournament(torneo).then(bannerUrl => {
                        if (bannerUrl) {
                            torneo.bannerImageUrl = bannerUrl;
                        }
                        
                        // Clasificar según estado
                        if (torneo.estado === 'En Progreso') {
                            torneosEnProceso.push(torneo);
                        } else if (torneo.estado === 'Abierto') {
                            torneosAbiertos.push(torneo);
                        } else if (torneo.estado === 'Próximamente') {
                            torneosProximos.push(torneo);
                        }
                    })
                );
            });
            
            // Esperar a que todos los torneos se procesen
            await Promise.all(torneoPromises);
            
            // Ordenar por fecha (más cercana primero)
            const sortByDate = (a, b) => {
                const dateA = a.fecha ? new Date(a.fecha.seconds * 1000) : new Date();
                const dateB = b.fecha ? new Date(b.fecha.seconds * 1000) : new Date();
                return dateA - dateB;
            };
            
            torneosEnProceso.sort(sortByDate);
            torneosAbiertos.sort(sortByDate);
            torneosProximos.sort(sortByDate);
            
            // Renderizar torneos en sus respectivos contenedores
            await renderTournamentSection('en-proceso-section', 'torneos-en-proceso', torneosEnProceso);
            await renderTournamentSection('abiertos-section', 'torneos-abiertos', torneosAbiertos);
            await renderTournamentSection('proximos-section', 'torneos-proximos', torneosProximos);
            
            // Configurar botones de inscripción/desinscripción
            setupTournamentButtons();
            
            console.log("Torneos cargados correctamente");
            
        } catch (error) {
            console.error("Error al consultar torneos:", error);
            showErrorMessage();
        }
        
    } catch (error) {
        console.error("Error al cargar torneos:", error);
        showErrorMessage();
    }
}

// Renderizar sección de torneos
async function renderTournamentSection(sectionId, containerId, torneos) {
    const container = document.getElementById(containerId);
    const section = document.getElementById(sectionId);
    
    if (!container || !section) return;
    
    // Mostrar u ocultar sección dependiendo si hay torneos
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

// Renderizar torneos en un contenedor
async function renderTournaments(containerId, torneos) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = '';
    
    // Verificar si el usuario está autenticado
    const userAuthenticated = isAuthenticated();
    
    for (const torneo of torneos) {
        // Formatear fecha
        const fecha = torneo.fecha ? new Date(torneo.fecha.seconds * 1000) : new Date();
        const fechaFormateada = fecha.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        // Formatear hora
        const hora = torneo.hora || '00:00';
        const horaFormateada = hora.substring(0, 5);
        
        // Calcular inscripciones y capacidad
        const participants = torneo.participants || [];
        const inscritos = participants.length;
        const capacidad = torneo.capacidad || '∞';
        const lleno = torneo.capacidad && inscritos >= torneo.capacidad;
        
        // Verificar si el usuario actual está inscrito
        const estaInscrito = userAuthenticated && auth.currentUser && participants.includes(auth.currentUser.uid);
        
        // Determinar estado del botón de inscripción
        let botonInscripcion = '';
        
        if (torneo.estado === 'Abierto') {
            if (!userAuthenticated) {
                // Usuario no autenticado - Mostrar botón de registro
                botonInscripcion = `
                    <button class="w-full dtowin-blue text-white py-2 rounded-lg hover:opacity-90 transition font-semibold register-btn">
                        Registrarse para participar
                    </button>
                `;
            } else if (estaInscrito) {
                // Usuario autenticado e inscrito - Mostrar botón de desinscripción
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
                // Usuario autenticado pero no inscrito
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
        
        // Generar HTML para puntos por posición
        const puntosPosicionHTML = renderPuntosPosicion(torneo.puntosPosicion);
        
        // Usar la imagen del banner si está disponible, de lo contrario usar imageUrl o fallback
        const imageSrc = torneo.bannerImageUrl || torneo.imageUrl || 'https://via.placeholder.com/400x200';
        
        // HTML del torneo
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
    
    // Cargar lista de participantes para cada torneo
    for (const torneo of torneos) {
        await loadParticipants(torneo.id, torneo.participants || []);
    }
}

// Cargar participantes de un torneo
async function loadParticipants(torneoId, participantIds) {
    const container = document.getElementById(`participants-${torneoId}`);
    if (!container) return;
    
    if (!participantIds || participantIds.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 text-xs">No hay participantes inscritos</p>';
        return;
    }
    
    try {
        let html = '<ul class="space-y-1">';
        const maxToShow = Math.min(5, participantIds.length); // Mostrar máximo 5 participantes
        
        for (let i = 0; i < maxToShow; i++) {
            try {
                const uid = participantIds[i];
                const usersRef = collection(db, "usuarios");
                const q = query(usersRef, where("uid", "==", uid), limit(1));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data();
                    html += `
                        <li class="text-xs truncate">
                            <i class="fas fa-user text-gray-400 mr-1"></i>
                            ${userData.nombre || 'Usuario'}
                        </li>
                    `;
                }
            } catch (e) {
                console.error(`Error al cargar participante individual:`, e);
            }
        }
        
        // Si hay más participantes, mostrar cuántos más hay
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

// Configurar botones de inscripción/desinscripción
function setupTournamentButtons() {
    // Botones de inscripción
    document.querySelectorAll('.inscribirse-btn').forEach(button => {
        button.addEventListener('click', async function(e) {
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
            
            // Cambiar estado del botón
            this.disabled = true;
            const originalText = this.textContent;
            this.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
            
            try {
                // Inscribir al usuario
                await registerForTournament(torneoId);
                mostrarNotificacion("¡Te has inscrito correctamente al torneo!", "success");
                
                // Recargar torneos para actualizar la UI
                await loadTournaments();
            } catch (error) {
                console.error("Error al inscribirse:", error);
                mostrarNotificacion(error.message || "Error al inscribirse al torneo", "error");
                
                // Restaurar botón
                this.disabled = false;
                this.textContent = originalText;
            }
        });
    });
    
    // Botones de desinscripción
    document.querySelectorAll('.desinscribirse-btn').forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Obtener ID del torneo
            const torneoId = this.dataset.torneoId;
            
            // Verificar si el usuario está autenticado
            if (!isAuthenticated()) {
                mostrarNotificacion("Debes iniciar sesión para desinscribirte", "error");
                return;
            }
            
            // Confirmar acción
            if (!confirm("¿Estás seguro que deseas desinscribirte de este torneo?")) {
                return;
            }
            
            // Cambiar estado del botón
            this.disabled = true;
            const originalText = this.textContent;
            this.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
            
            try {
                // Desinscribir al usuario
                await unregisterFromTournament(torneoId);
                mostrarNotificacion("Te has desinscrito del torneo correctamente", "success");
                
                // Recargar torneos para actualizar la UI
                await loadTournaments();
            } catch (error) {
                console.error("Error al desinscribirse:", error);
                mostrarNotificacion(error.message || "Error al desinscribirse del torneo", "error");
                
                // Restaurar botón
                this.disabled = false;
                this.textContent = originalText;
            }
        });
    });
    
    // Botones de registro para usuarios no autenticados
    document.querySelectorAll('.register-btn').forEach(button => {
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
}

// Inscribir al usuario actual en un torneo
async function registerForTournament(torneoId) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Debes iniciar sesión para inscribirte");
        }
        
        // Obtener documento del torneo
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
        await updateDoc(torneoRef, {
            participants: [...currentParticipants, user.uid],
            updatedAt: serverTimestamp()
        });
        
        // También actualizar el usuario para registrar su participación
        const usersRef = collection(db, "usuarios");
        const q = query(usersRef, where("uid", "==", user.uid));
        const userQuerySnapshot = await getDocs(q);
        
        if (!userQuerySnapshot.empty) {
            const userDoc = userQuerySnapshot.docs[0];
            
            // Añadir torneo a la lista de torneos del usuario
            const userTorneos = userDoc.data().torneos || [];
            if (!userTorneos.includes(torneoId)) {
                await updateDoc(doc(db, "usuarios", userDoc.id), {
                    torneos: [...userTorneos, torneoId],
                    updatedAt: serverTimestamp()
                });
            }
        }
        
        return true;
        
    } catch (error) {
        console.error("Error al inscribirse al torneo:", error);
        throw error;
    }
}

// Desinscribir al usuario actual de un torneo
async function unregisterFromTournament(torneoId) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Debes iniciar sesión para desinscribirte");
        }
        
        // Obtener documento del torneo
        const torneoRef = doc(db, "torneos", torneoId);
        const torneoSnap = await getDoc(torneoRef);
        
        if (!torneoSnap.exists()) {
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
        
        // Eliminar al usuario de la lista de participantes
        const newParticipants = currentParticipants.filter(uid => uid !== user.uid);
        
        // Actualizar el documento del torneo
        await updateDoc(torneoRef, {
            participants: newParticipants,
            updatedAt: serverTimestamp()
        });
        
        // También actualizar el usuario para eliminar su participación
        const usersRef = collection(db, "usuarios");
        const q = query(usersRef, where("uid", "==", user.uid));
        const userQuerySnapshot = await getDocs(q);
        
        if (!userQuerySnapshot.empty) {
            const userDoc = userQuerySnapshot.docs[0];
            
            // Eliminar torneo de la lista de torneos del usuario
            const userTorneos = userDoc.data().torneos || [];
            const newUserTorneos = userTorneos.filter(id => id !== torneoId);
            
            await updateDoc(doc(db, "usuarios", userDoc.id), {
                torneos: newUserTorneos,
                updatedAt: serverTimestamp()
            });
        }
        
        return true;
    } catch (error) {
        console.error("Error al desinscribirse del torneo:", error);
        throw error;
    }
}

// Inserta este código al final de tu archivo torneos.js (o reemplázalo por completo)

// Variables para evitar bucles infinitos
let torneosCargados = false;

// Función para cargar los torneos MODIFICADA para evitar bucles
export async function loadTournaments() {
    try {
        console.log("Cargando torneos...");
        
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
            console.log("No se encontraron los contenedores para torneos");
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
        
        // Establecer un timeout para abortar en caso de problemas
        const timeout = setTimeout(() => {
            console.error("Tiempo de espera agotado al cargar torneos");
            if (enProcesoContainer) enProcesoContainer.innerHTML = '<div class="text-center p-4"><p class="text-red-500">Error al cargar torneos: tiempo de espera agotado</p></div>';
            if (abiertosContainer) abiertosContainer.innerHTML = '<div class="text-center p-4"><p class="text-red-500">Error al cargar torneos: tiempo de espera agotado</p></div>';
            if (proximosContainer) proximosContainer.innerHTML = '<div class="text-center p-4"><p class="text-red-500">Error al cargar torneos: tiempo de espera agotado</p></div>';
        }, 15000); // 15 segundos máximo
        
        try {
            // Obtener todos los torneos visibles de Firebase directamente
            const torneos = await firebase.firestore().collection('torneos')
                .where("visible", "!=", false)
                .get();
            
            // Limpiar el timeout ya que se completó la consulta
            clearTimeout(timeout);
            
            // Clasificar torneos por estado
            const torneosEnProceso = [];
            const torneosAbiertos = [];
            const torneosProximos = [];
            
            // Procesar los torneos
            torneos.forEach(doc => {
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
            
            // Mostrar torneos en cada contenedor
            if (enProcesoContainer) {
                enProcesoContainer.innerHTML = torneosEnProceso.length > 0 
                    ? renderTorneos(torneosEnProceso) 
                    : '<div class="text-center p-4"><p class="text-gray-500">No hay torneos en progreso actualmente</p></div>';
            }
            
            if (abiertosContainer) {
                abiertosContainer.innerHTML = torneosAbiertos.length > 0 
                    ? renderTorneos(torneosAbiertos) 
                    : '<div class="text-center p-4"><p class="text-gray-500">No hay torneos con inscripciones abiertas</p></div>';
            }
            
            if (proximosContainer) {
                proximosContainer.innerHTML = torneosProximos.length > 0 
                    ? renderTorneos(torneosProximos) 
                    : '<div class="text-center p-4"><p class="text-gray-500">No hay torneos próximamente</p></div>';
            }
            
            // Configurar botones de inscripción (IMPORTANTE: fuera del sistema de observadores)
            if (window.setupTournamentButtons) {
                window.setupTournamentButtons();
            } else {
                setupStaticTournamentButtons();
            }
            
            // Marcar como cargado para evitar cargas duplicadas
            torneosCargados = true;
            
            console.log("Torneos cargados correctamente");
            
        } catch (error) {
            // Limpiar el timeout si hay un error
            clearTimeout(timeout);
            
            console.error("Error al cargar torneos:", error);
            
            // Mostrar mensaje de error
            const errorMessage = error.message || "Error desconocido al cargar torneos";
            if (enProcesoContainer) enProcesoContainer.innerHTML = `<div class="text-center p-4"><p class="text-red-500">${errorMessage}</p></div>`;
            if (abiertosContainer) abiertosContainer.innerHTML = `<div class="text-center p-4"><p class="text-red-500">${errorMessage}</p></div>`;
            if (proximosContainer) proximosContainer.innerHTML = `<div class="text-center p-4"><p class="text-red-500">${errorMessage}</p></div>`;
        }
        
    } catch (error) {
        console.error("Error general al cargar torneos:", error);
    }
}

// Función para renderizar los torneos
function renderTorneos(torneos) {
    let html = '';
    
    torneos.forEach(torneo => {
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
        const estaInscrito = isAuthenticated() && participants.includes(firebase.auth().currentUser.uid);
        
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
                // Usuario autenticado e inscrito
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
                // Usuario autenticado pero no inscrito
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
        
        // Generar HTML para cada torneo
        html += `
            <div class="bg-white rounded-xl shadow-lg overflow-hidden tournament-card transition duration-300" data-torneo-id="${torneo.id}">
                <img src="${torneo.imageUrl || torneo.bannerImageUrl || 'https://via.placeholder.com/400x200'}" alt="${torneo.nombre}" class="w-full h-48 object-cover">
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
                        <div class="participants-list text-sm text-gray-600">
                            <p class="text-center text-gray-500 text-xs">${inscritos > 0 ? `${inscritos} participantes inscritos` : 'No hay participantes inscritos'}</p>
                        </div>
                    </div>
                    ${botonInscripcion}
                </div>
            </div>
        `;
    });
    
    return html;
}

// Configurar botones de inscripción de forma estática (sin observer)
function setupStaticTournamentButtons() {
    // Botones de inscripción
    document.querySelectorAll('.inscribirse-btn').forEach(button => {
        // Evitar configurar el mismo botón múltiples veces
        if (button.dataset.configured === 'true') return;
        button.dataset.configured = 'true';
        
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Obtener ID del torneo
            const torneoId = this.dataset.torneoId;
            
            // Verificar si el usuario está autenticado
            if (!isAuthenticated()) {
                mostrarNotificacion("Debes iniciar sesión para inscribirte", "error");
                const loginBtn = document.getElementById('loginBtn');
                if (loginBtn) loginBtn.click();
                return;
            }
            
            // Abrir el modal de inscripción si existe la función
            if (typeof window.openTournamentRegistrationModal === 'function') {
                window.openTournamentRegistrationModal(torneoId);
            } else {
                // Fallback al método antiguo si el nuevo no está disponible
                registerForTournament(torneoId);
            }
        });
    });
    
    // Botones de desinscripción
    document.querySelectorAll('.desinscribirse-btn').forEach(button => {
        // Evitar configurar el mismo botón múltiples veces
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
        // Evitar configurar el mismo botón múltiples veces
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
}

// Verificar si el usuario está autenticado
function isAuthenticated() {
    return firebase.auth().currentUser !== null;
}

// Inicializar una sola vez al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    // Evitar ejecutarse si no estamos en una página con torneos
    const hasTorneoContainers = 
        document.getElementById('torneos-en-proceso') || 
        document.getElementById('torneos-abiertos') || 
        document.getElementById('torneos-proximos');
    
    if (hasTorneoContainers && !torneosCargados) {
        // Cargar torneos
        loadTournaments();
    }
});
