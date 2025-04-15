// index.js optimizado - Script principal para la página de inicio de Dtowin
import { auth, db, isAuthenticated } from './firebase.js';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    query, 
    where, 
    orderBy, 
    limit,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Variable para prevenir múltiples inicializaciones
let isInitialized = false;

// Función principal para inicializar la aplicación
export async function initApp() {
    // Evitar inicialización múltiple
    if (isInitialized) {
        console.log("La aplicación ya está inicializada");
        return true;
    }
    
    try {
        console.log("Inicializando aplicación Dtowin...");
        isInitialized = true;
        
        // Cargar componentes principales
        const loadPromises = [
            loadTorneos(),
            loadLeaderboard()
        ];
        
        // Usar Promise.allSettled para evitar bloqueo por fallos parciales
        const results = await Promise.allSettled(loadPromises);
        
        // Revisar resultados para detectar errores
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Error al cargar componente #${index}:`, result.reason);
            }
        });
        
        // Inicializar botones de inscripción
        setupButtons();
        
        console.log("Aplicación inicializada correctamente");
        return true;
    } catch (error) {
        console.error("Error al inicializar la aplicación:", error);
        
        // Mostrar mensaje de error al usuario
        mostrarNotificacion("Ha ocurrido un error al cargar la página. Inténtalo de nuevo.", "error");
        
        return false;
    }
}

// Cargar torneos para la página principal
async function loadTorneos() {
    try {
        // Identificar los contenedores de torneos
        const containers = {
            'en-proceso': document.getElementById('torneos-en-proceso'),
            'abiertos': document.getElementById('torneos-abiertos'),
            'proximos': document.getElementById('torneos-proximos'),
            'checkin': document.getElementById('torneos-checkin')
        };
        
        // Verificar si existen los contenedores
        const availableContainers = Object.entries(containers)
            .filter(([_, container]) => container !== null);
        
        if (availableContainers.length === 0) {
            console.log("No se encontraron contenedores para torneos");
            return;
        }
        
        // Mostrar indicadores de carga
        availableContainers.forEach(([_, container]) => {
            container.innerHTML = `
                <div class="col-span-full flex justify-center p-4">
                    <div class="spinner w-8 h-8 border-t-4 border-b-4 border-blue-500 rounded-full"></div>
                </div>
            `;
        });
        
        // Obtener torneos con límite de tiempo
        let torneosSnapshot;
        try {
            const torneosQuery = query(
                collection(db, "torneos"),
                where("visible", "!=", false),
                limit(20) // Limitar a 20 torneos para mejorar rendimiento
            );
            
            // Agregar timeout para evitar espera infinita
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout al cargar torneos")), 10000)
            );
            
            torneosSnapshot = await Promise.race([
                getDocs(torneosQuery),
                timeoutPromise
            ]);
        } catch (error) {
            console.error("Error al consultar torneos:", error);
            // Mostrar mensaje de error en los contenedores
            availableContainers.forEach(([_, container]) => {
                container.innerHTML = `
                    <div class="col-span-full text-center p-4">
                        <p class="text-red-500">Error al cargar torneos. Inténtalo de nuevo.</p>
                        <button class="text-blue-500 underline mt-2" onclick="window.location.reload()">
                            Recargar página
                        </button>
                    </div>
                `;
            });
            throw error;
        }
        
        // Clasificar torneos por estado
        const torneos = {
            'en-proceso': [],
            'abiertos': [],
            'proximos': [],
            'checkin': []
        };
        
        // Obtener usuario actual para filtrar torneos de check-in
        const currentUser = auth.currentUser;
        
        torneosSnapshot.forEach(doc => {
            const torneo = {
                id: doc.id,
                ...doc.data()
            };
            
            // Clasificar por estado
            switch (torneo.estado) {
                case 'En Progreso':
                    torneos['en-proceso'].push(torneo);
                    break;
                case 'Abierto':
                    torneos['abiertos'].push(torneo);
                    break;
                case 'Próximamente':
                    torneos['proximos'].push(torneo);
                    break;
                case 'Check In':
                    // Solo mostrar torneos en check-in si el usuario está inscrito
                    const participants = torneo.participants || [];
                    if (currentUser && participants.includes(currentUser.uid)) {
                        torneos['checkin'].push(torneo);
                    }
                    break;
            }
        });
        
        // Ordenar torneos por fecha (los más cercanos primero)
        Object.values(torneos).forEach(category => {
            category.sort((a, b) => {
                const dateA = a.fecha ? new Date(a.fecha.seconds * 1000) : new Date();
                const dateB = b.fecha ? new Date(b.fecha.seconds * 1000) : new Date();
                return dateA - dateB;
            });
        });
        
        // Mostrar torneos en sus respectivos contenedores
        for (const [category, container] of availableContainers) {
            const categoryTorneos = torneos[category];
            
            if (categoryTorneos.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center p-4">
                        <p class="text-gray-500">No hay torneos disponibles en esta categoría</p>
                    </div>
                `;
                
                // Ocultar sección si no hay torneos
                const section = document.getElementById(`${category}-section`);
                if (section) {
                    section.classList.add('hidden');
                }
            } else {
                // Mostrar sección si hay torneos
                const section = document.getElementById(`${category}-section`);
                if (section) {
                    section.classList.remove('hidden');
                }
                
                // Renderizar tarjetas de torneos
                renderTorneos(container, categoryTorneos);
            }
        }
        
        return true;
    } catch (error) {
        console.error("Error al cargar torneos:", error);
        return false;
    }
}

// Renderizar tarjetas de torneos
function renderTorneos(container, torneos) {
    let html = '';
    
    // Check if user is authenticated
    const userAuthenticated = isAuthenticated();
    const currentUser = auth.currentUser;
    
    torneos.forEach(torneo => {
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
                const yaHizoCheckIn = (torneo.checkedInParticipants && torneo.checkedInParticipants.includes(currentUser.uid));
        
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
        let puntosPosicionHTML = '';
        
        if (torneo.puntosPosicion) {
            const colors = ['yellow-500', 'gray-400', 'red-500', 'blue-400', 'purple-400'];
            
            for (let i = 1; i <= 5; i++) {
                if (torneo.puntosPosicion[i] !== undefined) {
                    const colorClass = colors[i-1] || 'gray-500';
                    puntosPosicionHTML += `
                        <span class="bg-${colorClass} text-white rounded-full px-3 py-1 text-xs">
                            ${i}° - ${torneo.puntosPosicion[i]} pts
                        </span>
                    `;
                }
            }
        }
        
        if (!puntosPosicionHTML) {
            puntosPosicionHTML = 'No hay información de puntos';
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
    });
    
    container.innerHTML = html;
}

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

// Cargar clasificación (leaderboard)
async function loadLeaderboard() {
    try {
        const leaderboardBody = document.getElementById('leaderboardBody');
        if (!leaderboardBody) {
            console.log("No se encontró el contenedor para el leaderboard");
            return;
        }
        
        // Mostrar indicador de carga
        leaderboardBody.innerHTML = `
            <div class="col-span-12 p-4 text-center">
                <div class="spinner w-8 h-8 border-t-4 border-b-4 border-blue-500 rounded-full mx-auto mb-2"></div>
                <p class="text-gray-500">Cargando leaderboard...</p>
            </div>
        `;
        
        // Obtener usuarios con límite de tiempo
        let usuariosSnapshot;
        try {
            const usuariosQuery = query(
                collection(db, "usuarios"),
                orderBy("puntos", "desc"),
                limit(10) // Mostrar solo los 10 primeros
            );
            
            // Agregar timeout para evitar espera infinita
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout al cargar usuarios")), 10000)
            );
            
            usuariosSnapshot = await Promise.race([
                getDocs(usuariosQuery),
                timeoutPromise
            ]);
        } catch (error) {
            console.error("Error al consultar usuarios:", error);
            leaderboardBody.innerHTML = `
                <div class="col-span-12 p-4 text-center">
                    <p class="text-red-500">Error al cargar leaderboard. Inténtalo de nuevo.</p>
                    <button class="text-blue-500 underline mt-2" onclick="window.location.reload()">
                        Recargar página
                    </button>
                </div>
            `;
            throw error;
        }
        
        // Verificar si hay usuarios
        if (usuariosSnapshot.empty) {
            leaderboardBody.innerHTML = `
                <div class="col-span-12 p-4 text-center">
                    <p class="text-gray-500">No hay jugadores en el ranking aún.</p>
                </div>
            `;
            return;
        }
        
        // Generar filas para el leaderboard
        let html = '';
        
        let posicion = 1;
        usuariosSnapshot.forEach(doc => {
            const usuario = doc.data();
            
            // Calcular torneos participados
            const torneos = usuario.torneos ? (Array.isArray(usuario.torneos) ? usuario.torneos.length : Object.keys(usuario.torneos).length) : 0;
            
            // Badge de posición según ranking
            let badgeClass = '';
            if (posicion === 1) {
                badgeClass = 'bg-yellow-500';
            } else if (posicion === 2) {
                badgeClass = 'bg-gray-400';
            } else if (posicion === 3) {
                badgeClass = 'bg-red-500';
            }
            
            html += `
                <div class="grid grid-cols-12 p-3 items-center ${posicion % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
                    <div class="col-span-1 text-center">
                        <span class="${badgeClass ? badgeClass + ' text-white w-6 h-6 inline-flex items-center justify-center rounded-full' : ''}">
                            ${posicion}
                        </span>
                    </div>
                    <div class="col-span-6 flex items-center">
                        <img src="${usuario.photoURL || 'https://via.placeholder.com/40'}" alt="${usuario.nombre || 'Usuario'}" class="w-8 h-8 rounded-full mr-2">
                        <span class="font-medium truncate">${usuario.nombre || 'Usuario'}</span>
                    </div>
                    <div class="col-span-2 text-center">${torneos}</div>
                    <div class="col-span-3 text-center font-bold">${usuario.puntos || 0}</div>
                </div>
            `;
            
            posicion++;
        });
        
        leaderboardBody.innerHTML = html;
        
        return true;
    } catch (error) {
        console.error("Error al cargar leaderboard:", error);
        return false;
    }
}

// Configurar botones de inscripción y check-in
function setupButtons() {
    // Asegurar que se ejecute después de que los torneos estén cargados
    setTimeout(() => {
        // Botones de inscripción
        const inscribirseBtns = document.querySelectorAll('.inscribirse-btn');
        
        inscribirseBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                
                const torneoId = this.dataset.torneoId;
                const torneoNombre = this.dataset.torneoNombre;
                
                // Si el usuario no está autenticado, mostrar login
                if (!isAuthenticated()) {
                    mostrarNotificacion("Debes iniciar sesión para inscribirte", "info");
                    
                    // Abrir modal de login si existe
                    const loginBtn = document.getElementById('loginBtn');
                    if (loginBtn) {
                        loginBtn.click();
                    }
                    return;
                }
                
                // Mostrar formulario de inscripción
                mostrarFormularioInscripcion(torneoId, torneoNombre);
            });
        });
        
        // Botones de desinscripción
        const desinscribirseBtns = document.querySelectorAll('.desinscribirse-btn');
        
        desinscribirseBtns.forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.preventDefault();
                
                const torneoId = this.dataset.torneoId;
                
                // Si el usuario no está autenticado, mostrar error
                if (!isAuthenticated()) {
                    mostrarNotificacion("Debes iniciar sesión para desinscribirte", "error");
                    return;
                }
                
                // Confirmar desinscripción
                if (!confirm("¿Estás seguro que deseas desinscribirte de este torneo?")) {
                    return;
                }
                
                // Cambiar estado del botón
                this.disabled = true;
                this.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
                
                try {
                    // Intentar desinscribir al usuario (función a implementar según tu lógica)
                    // Aquí deberías llamar a la función correspondiente de tu módulo de registro
                    // Por ejemplo: await unregisterFromTournament(torneoId);
                    
                    mostrarNotificacion("Te has desinscrito del torneo correctamente", "success");
                    
                    // Recargar para actualizar UI
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } catch (error) {
                    console.error("Error al desinscribirse:", error);
                    mostrarNotificacion(error.message || "Error al desinscribirse del torneo", "error");
                    
                    // Restaurar botón
                    this.disabled = false;
                    this.textContent = "Desinscribirse";
                }
            });
        });
        
        // Botones de check-in
        const checkinBtns = document.querySelectorAll('.checkin-btn');
        
        checkinBtns.forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.preventDefault();
                
                const torneoId = this.dataset.torneoId;
                
                // Si el usuario no está autenticado, mostrar error
                if (!isAuthenticated()) {
                    mostrarNotificacion("Debes iniciar sesión para hacer check-in", "error");
                    return;
                }
                
                // Confirmar check-in
                if (!confirm("¿Confirmas tu asistencia a este torneo? Esta acción es necesaria para participar en el bracket.")) {
                    return;
                }
                
                // Cambiar estado del botón
                this.disabled = true;
                this.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';
                
                try {
                    // Intentar hacer check-in (función a implementar según tu lógica)
                    // Aquí deberías llamar a la función correspondiente
                    // Por ejemplo: await realizarCheckIn(torneoId);
                    
                    // Cambiar el botón a completado
                    this.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Check-In Completado';
                    this.classList.remove('bg-purple-600', 'hover:bg-purple-700');
                    this.classList.add('bg-purple-700', 'cursor-not-allowed');
                    
                    mostrarNotificacion("Has confirmado tu asistencia correctamente", "success");
                } catch (error) {
                    console.error("Error al hacer check-in:", error);
                    mostrarNotificacion(error.message || "Error al confirmar asistencia", "error");
                    
                    // Restaurar botón
                    this.disabled = false;
                    this.innerHTML = '<i class="fas fa-clipboard-check mr-2"></i> Hacer Check-In';
                }
            });
        });
        
        // Botones de registro para usuario no autenticado
        const registerBtns = document.querySelectorAll('.register-btn');
        
        registerBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                
                mostrarNotificacion("Para participar en torneos, primero debes registrarte", "info");
                
                // Abrir modal de registro si existe
                const registerBtn = document.getElementById('registerBtn');
                if (registerBtn) {
                    setTimeout(() => {
                        registerBtn.click();
                    }, 1000);
                } else {
                    // Alternativa: abrir login
                    const loginBtn = document.getElementById('loginBtn');
                    if (loginBtn) loginBtn.click();
                }
            });
        });
    }, 500); // Esperar 500ms para asegurar que los elementos estén presentes
}

// Mostrar formulario de inscripción a torneo
function mostrarFormularioInscripcion(torneoId, torneoNombre) {
    // Buscar el modal de inscripción
    let registrationModal = document.getElementById('tournamentRegistrationModal');
    
    // Si no existe, manejarlo adecuadamente
    if (!registrationModal) {
        console.error("Modal de registro no encontrado");
        mostrarNotificacion("Error al mostrar formulario de inscripción", "error");
        return;
    }
    
    // Actualizar título del modal con el nombre del torneo
    const titleEl = document.getElementById('registrationTitle');
    if (titleEl) {
        titleEl.textContent = `Inscripción: ${torneoNombre}`;
    }
    
    // Limpiar mensajes de error
    const errorMsgEl = document.getElementById('registrationErrorMsg');
    if (errorMsgEl) {
        errorMsgEl.textContent = '';
    }
    
    // Almacenar ID del torneo en un campo oculto
    const torneoIdField = document.getElementById('current-tournament-id') || document.createElement('input');
    torneoIdField.type = 'hidden';
    torneoIdField.id = 'current-tournament-id';
    torneoIdField.value = torneoId;
    
    // Si no existe en el DOM, añadirlo al formulario
    const form = document.getElementById('tournamentRegistrationForm');
    if (form && !document.getElementById('current-tournament-id')) {
        form.appendChild(torneoIdField);
    }
    
    // Mostrar el modal
    registrationModal.classList.remove('hidden');
    registrationModal.classList.add('flex');
}

// Función para mostrar notificaciones
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

// Hacer accesible la función de notificación globalmente
window.mostrarNotificacion = mostrarNotificacion;

// Inicializar menú móvil
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', function() {
            if (mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.remove('hidden');
                mobileMenuBtn.innerHTML = '<i class="fas fa-times"></i>';
            } else {
                mobileMenu.classList.add('hidden');
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            }
        });
    }
}

// Verificar si el usuario es host/admin
async function isUserAdmin(uid) {
    try {
        // Lista de administradores fijos
        const adminUIDs = ["dvblFee1ZnVKJNWBOR22tSAsNet2"];
        
        // Si el UID está en la lista de administradores
        if (adminUIDs.includes(uid)) {
            return true;
        }
        
        // Verificar en la base de datos
        const usersRef = collection(db, "usuarios");
        const q = query(usersRef, where("uid", "==", uid), where("isHost", "==", true));
        const querySnapshot = await getDocs(q);
        
        return !querySnapshot.empty;
    } catch (error) {
        console.error("Error al verificar si el usuario es administrador:", error);
        return false;
    }
}

// Mostrar botón de admin si el usuario es administrador
async function checkAndShowAdminButton() {
    try {
        const user = auth.currentUser;
        
        if (!user) {
            return;
        }
        
        // Verificar si el usuario es administrador
        const isAdmin = await isUserAdmin(user.uid);
        
        // Si el usuario es admin, mostrar el botón de Admin
        if (isAdmin) {
            // Buscar el elemento de navegación donde añadir el botón
            const navLinks = document.querySelector(".hidden.md\\:flex.items-center.space-x-6");
            
            if (navLinks) {
                // Crear el botón de Admin
                const adminButton = document.createElement("a");
                adminButton.href = "admin-panel.html";
                adminButton.className = "bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition";
                adminButton.textContent = "Admin";
                
                // Insertar antes del botón de "Mi Perfil" o al final
                const profileLink = navLinks.querySelector('a[href="perfil.html"]');
                if (profileLink) {
                    navLinks.insertBefore(adminButton, profileLink.nextSibling);
                } else {
                    navLinks.appendChild(adminButton);
                }
                
                // También añadir al menú móvil
                const mobileMenu = document.getElementById("mobileMenu");
                if (mobileMenu) {
                    const mobileMenuLinks = mobileMenu.querySelector("div");
                    if (mobileMenuLinks) {
                        const mobileAdminLink = document.createElement("a");
                        mobileAdminLink.href = "admin-panel.html";
                        mobileAdminLink.className = "bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition inline-block";
                        mobileAdminLink.textContent = "Admin";
                        mobileMenuLinks.appendChild(mobileAdminLink);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error al verificar permisos de admin:", error);
    }
}

// Actualizar UI cuando el usuario inicia sesión
async function updateUIForLoggedInUser(user) {
    if (!user) return;
    
    console.log("Actualizando UI para usuario: ", user.displayName || user.email);
    
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.innerHTML = `
            <div class="flex items-center bg-white rounded-lg px-3 py-1">
                <img src="${user.photoURL || 'dtowin.png'}" alt="Profile" class="w-8 h-8 rounded-full mr-2">
                <span class="text-gray-800 font-medium">${user.displayName || 'Usuario'}</span>
            </div>
        `;
        
        loginBtn.removeEventListener('click', showLoginModal);
        loginBtn.addEventListener('click', () => {
            window.location.href = 'perfil.html';
        });
    }
    
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.style.display = 'none';
    }
    
    // Verificar si el usuario es admin
    await checkAndShowAdminButton();
    
    // Recargar torneos para actualizar botones
    loadTorneos();
}

// Función para mostrar modal de login
function showLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.remove('hidden');
        loginModal.classList.add('flex');
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar menú móvil
    initMobileMenu();
    
    // Inicializar aplicación principal
    await initApp();
    
    // Verificar si hay usuario autenticado
    auth.onAuthStateChanged(async user => {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            await updateUIForLoggedInUser(user);
        } else {
            console.log("No hay usuario autenticado");
        }
    });
});

// Exportar funciones
export {
    initApp,
    isUserAdmin,
    mostrarNotificacion
};
