// Versión simplificada de torneos.js
import { auth, db } from './firebase.js';
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

// Colores para los puestos
const COLORS_POSICION = {
    1: 'yellow-500',  // Oro
    2: 'gray-400',    // Plata
    3: 'red-500'      // Rojo (más visible)
};

// Colores para estados
const COLORS_ESTADO = {
    'Abierto': 'green-500',
    'En Progreso': 'yellow-500',
    'Próximamente': 'blue-500',
    'Finalizado': 'gray-500'
};

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

// Función principal para cargar torneos
export function loadTournaments() {
    console.log("Cargando torneos...");
    
    // Contenedores para los diferentes tipos de torneos
    const enProcesoContainer = document.getElementById('torneos-en-proceso');
    const abiertosContainer = document.getElementById('torneos-abiertos');
    const proximosContainer = document.getElementById('torneos-proximos');
    
    // Si no se encuentran los contenedores, salir
    if (!enProcesoContainer || !abiertosContainer || !proximosContainer) {
        console.error("No se encontraron los contenedores para torneos");
        return;
    }
    
    // Mostrar indicadores de carga
    const loadingHTML = `
        <div class="col-span-full flex justify-center items-center p-4">
            <div class="spinner w-8 h-8 border-t-4 border-b-4 border-blue-500 rounded-full mr-3"></div>
            <p class="text-gray-500">Cargando torneos...</p>
        </div>
    `;
    enProcesoContainer.innerHTML = loadingHTML;
    abiertosContainer.innerHTML = loadingHTML;
    proximosContainer.innerHTML = loadingHTML;
    
    // Obtener torneos de Firebase
    const torneosRef = collection(db, "torneos");
    const q = query(torneosRef, where("visible", "!=", false));
    
    // Obtener datos
    getDocs(q)
        .then(querySnapshot => {
            // Arrays para clasificar torneos
            const torneosEnProceso = [];
            const torneosAbiertos = [];
            const torneosProximos = [];
            
            // Clasificar torneos según su estado
            querySnapshot.forEach(doc => {
                const torneo = {
                    id: doc.id,
                    ...doc.data()
                };
                
                if (torneo.estado === 'En Progreso') {
                    torneosEnProceso.push(torneo);
                } else if (torneo.estado === 'Abierto') {
                    torneosAbiertos.push(torneo);
                } else if (torneo.estado === 'Próximamente') {
                    torneosProximos.push(torneo);
                }
            });
            
            // Ordenar por fecha
            const sortByDate = (a, b) => {
                const dateA = a.fecha ? new Date(a.fecha.seconds * 1000) : new Date();
                const dateB = b.fecha ? new Date(b.fecha.seconds * 1000) : new Date();
                return dateA - dateB;
            };
            
            torneosEnProceso.sort(sortByDate);
            torneosAbiertos.sort(sortByDate);
            torneosProximos.sort(sortByDate);
            
            // Renderizar las secciones
            renderTorneos('en-proceso-section', enProcesoContainer, torneosEnProceso);
            renderTorneos('abiertos-section', abiertosContainer, torneosAbiertos);
            renderTorneos('proximos-section', proximosContainer, torneosProximos);
            
            // Configurar botones después de renderizar
            setTimeout(() => {
                setupBotones();
            }, 100);
            
            console.log("Torneos cargados correctamente");
        })
        .catch(error => {
            console.error("Error al cargar torneos:", error);
            
            // Mostrar mensaje de error
            enProcesoContainer.innerHTML = mensajeError();
            abiertosContainer.innerHTML = mensajeError();
            proximosContainer.innerHTML = mensajeError();
        });
}

// Función para renderizar torneos en una sección
function renderTorneos(sectionId, container, torneos) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    // Si no hay torneos, ocultar sección
    if (torneos.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center p-4">
                <p class="text-gray-500">No hay torneos disponibles en esta categoría</p>
            </div>
        `;
        section.classList.add('hidden');
        return;
    }
    
    // Mostrar sección y comenzar a construir HTML
    section.classList.remove('hidden');
    
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">';
    
    // Usuario actual
    const currentUser = auth.currentUser;
    
    // Generar HTML para cada torneo
    torneos.forEach(torneo => {
        // Formatear fecha
        const fecha = torneo.fecha ? new Date(torneo.fecha.seconds * 1000) : new Date();
        const fechaFormateada = fecha.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        // Formatear hora
        const horaFormateada = torneo.hora || '00:00';
        
        // Participantes
        const participants = torneo.participants || [];
        const inscritos = participants.length;
        const capacidad = torneo.capacidad || '∞';
        const lleno = torneo.capacidad && inscritos >= torneo.capacidad;
        
        // Usuario está inscrito?
        const estaInscrito = currentUser && participants.includes(currentUser.uid);
        
        // Determinar botón según estado
        let botonHTML = '';
        if (torneo.estado === 'Abierto') {
            if (estaInscrito) {
                botonHTML = `<button class="w-full dtowin-red text-white py-2 rounded-lg hover:opacity-90 transition font-semibold desinscribirse-btn" data-torneo-id="${torneo.id}">Desinscribirse</button>`;
            } else if (lleno) {
                botonHTML = `<button class="w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed font-semibold">Cupos Agotados</button>`;
            } else {
                botonHTML = `<button class="w-full dtowin-blue text-white py-2 rounded-lg hover:opacity-90 transition font-semibold inscribirse-btn" data-torneo-id="${torneo.id}">Inscribirse</button>`;
            }
        } else if (torneo.estado === 'En Progreso') {
            botonHTML = `<button class="w-full bg-yellow-500 text-white py-2 rounded-lg cursor-not-allowed font-semibold">En Progreso</button>`;
        } else {
            botonHTML = `<button class="w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed font-semibold">Próximamente</button>`;
        }
        
        // HTML para puntos por posición
        let puntosHTML = '';
        const puntosPosicion = torneo.puntosPosicion || {};
        
        for (let i = 1; i <= 3; i++) {
            if (puntosPosicion[i] !== undefined) {
                const colorClass = COLORS_POSICION[i] || 'gray-500';
                puntosHTML += `
                    <span class="bg-${colorClass} text-white rounded-full px-3 py-1 text-xs">
                        ${i}° - ${puntosPosicion[i]} pts
                    </span>
                `;
            }
        }
        
        if (!puntosHTML) {
            puntosHTML = '<span class="text-gray-500 text-xs">No hay información de puntos</span>';
        }
        
        // Banner fallback si no hay imagen
        const bannerUrl = torneo.imageUrl || `https://via.placeholder.com/800x400/ff6b1a/ffffff?text=${encodeURIComponent(torneo.nombre || 'Torneo')}`;
        
        // Generar HTML del torneo
        html += `
            <div class="bg-white rounded-xl shadow-lg overflow-hidden tournament-card transition duration-300" data-torneo-id="${torneo.id}">
                <div class="w-full h-48 bg-gray-200">
                    <img src="${bannerUrl}" alt="${torneo.nombre}" class="w-full h-full object-cover" 
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/800x400/ff6b1a/ffffff?text=${encodeURIComponent(torneo.nombre || 'Torneo').replace(/'/g, '')}'">
                </div>
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <h3 class="text-xl font-bold text-gray-800">${torneo.nombre || 'Torneo sin nombre'}</h3>
                        <span class="bg-${COLORS_ESTADO[torneo.estado] || 'gray-500'} text-white text-xs px-2 py-1 rounded-full">${torneo.estado}</span>
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
                            ${puntosHTML}
                        </div>
                    </div>
                    ${botonHTML}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Cargar participantes después
    torneos.forEach(torneo => {
        setTimeout(() => {
            cargarParticipantes(torneo.id, torneo.participants || []);
        }, 200); // pequeño retraso para no sobrecargar
    });
}

// Función para cargar participantes
function cargarParticipantes(torneoId, participantIds) {
    const container = document.getElementById(`participants-${torneoId}`);
    if (!container) return;
    
    // Si no hay participantes
    if (!participantIds || participantIds.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 text-xs">No hay participantes inscritos</p>';
        return;
    }
    
    // Cargar participantes de Firebase
    const usersRef = collection(db, "usuarios");
    const maxToShow = Math.min(5, participantIds.length); // Máximo 5 participantes
    let participantesHTML = '<ul class="space-y-1">';
    let participantesCargados = 0;
    
    // Procesar cada participante
    for (let i = 0; i < maxToShow; i++) {
        const uid = participantIds[i];
        const q = query(usersRef, where("uid", "==", uid), limit(1));
        
        getDocs(q)
            .then(querySnapshot => {
                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data();
                    participantesHTML += `
                        <li class="text-xs truncate">
                            <i class="fas fa-user text-gray-400 mr-1"></i>
                            ${userData.nombre || 'Usuario'}
                        </li>
                    `;
                }
                
                participantesCargados++;
                
                // Si ya cargamos todos los participantes que queremos mostrar
                if (participantesCargados === maxToShow) {
                    // Si hay más participantes, mostrar cuántos más
                    if (participantIds.length > maxToShow) {
                        participantesHTML += `
                            <li class="text-xs text-center text-gray-500 mt-1">
                                Y ${participantIds.length - maxToShow} participantes más...
                            </li>
                        `;
                    }
                    
                    participantesHTML += '</ul>';
                    container.innerHTML = participantesHTML;
                }
            })
            .catch(error => {
                console.warn(`Error al cargar participante ${uid}:`, error);
                participantesCargados++;
                
                // Si ya cargamos todos los participantes
                if (participantesCargados === maxToShow) {
                    participantesHTML += '</ul>';
                    container.innerHTML = participantesHTML;
                }
            });
    }
}

// Configurar botones de inscripción/desinscripción
function setupBotones() {
    // Botones de inscripción
    document.querySelectorAll('.inscribirse-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Obtener ID del torneo
            const torneoId = this.dataset.torneoId;
            
            // Verificar si el usuario está autenticado
            if (!auth.currentUser) {
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
            
            // Inscribir al usuario
            inscribirUsuario(torneoId)
                .then(() => {
                    mostrarNotificacion("¡Te has inscrito correctamente al torneo!", "success");
                    // Recargar torneos
                    loadTournaments();
                })
                .catch(error => {
                    console.error("Error al inscribirse:", error);
                    mostrarNotificacion(error.message || "Error al inscribirse al torneo", "error");
                    
                    // Restaurar botón
                    this.disabled = false;
                    this.textContent = originalText;
                });
        });
    });
    
    // Botones de desinscripción
    document.querySelectorAll('.desinscribirse-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Obtener ID del torneo
            const torneoId = this.dataset.torneoId;
            
            // Verificar si el usuario está autenticado
            if (!auth.currentUser) {
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
            
            // Desinscribir al usuario
            desinscribirUsuario(torneoId)
                .then(() => {
                    mostrarNotificacion("Te has desinscrito del torneo correctamente", "success");
                    // Recargar torneos
                    loadTournaments();
                })
                .catch(error => {
                    console.error("Error al desinscribirse:", error);
                    mostrarNotificacion(error.message || "Error al desinscribirse del torneo", "error");
                    
                    // Restaurar botón
                    this.disabled = false;
                    this.textContent = originalText;
                });
        });
    });
}

// Función para inscribir al usuario
function inscribirUsuario(torneoId) {
    return new Promise((resolve, reject) => {
        const user = auth.currentUser;
        if (!user) {
            reject(new Error("Debes iniciar sesión para inscribirte"));
            return;
        }
        
        // Obtener documento del torneo
        const torneoRef = doc(db, "torneos", torneoId);
        getDoc(torneoRef)
            .then(torneoSnap => {
                if (!torneoSnap.exists()) {
                    reject(new Error("El torneo no existe"));
                    return;
                }
                
                const torneoData = torneoSnap.data();
                
                // Verificar que el torneo esté abierto
                if (torneoData.estado !== 'Abierto') {
                    reject(new Error("Este torneo no está abierto para inscripciones"));
                    return;
                }
                
                // Verificar si hay cupos disponibles
                const currentParticipants = torneoData.participants || [];
                if (torneoData.capacidad && currentParticipants.length >= torneoData.capacidad) {
                    reject(new Error("No hay cupos disponibles para este torneo"));
                    return;
                }
                
                // Verificar si el usuario ya está inscrito
                if (currentParticipants.includes(user.uid)) {
                    reject(new Error("Ya estás inscrito en este torneo"));
                    return;
                }
                
                // Inscribir al usuario
                updateDoc(torneoRef, {
                    participants: [...currentParticipants, user.uid],
                    updatedAt: serverTimestamp()
                })
                    .then(() => {
                        // Actualizar usuario
                        const usersRef = collection(db, "usuarios");
                        const q = query(usersRef, where("uid", "==", user.uid));
                        
                        getDocs(q)
                            .then(userQuerySnapshot => {
                                if (!userQuerySnapshot.empty) {
                                    const userDoc = userQuerySnapshot.docs[0];
                                    
                                    // Añadir torneo a la lista de torneos del usuario
                                    const userTorneos = userDoc.data().torneos || [];
                                    
                                    if (!userTorneos.includes(torneoId)) {
                                        updateDoc(doc(db, "usuarios", userDoc.id), {
                                            torneos: [...userTorneos, torneoId],
                                            updatedAt: serverTimestamp()
                                        })
                                            .then(() => resolve(true))
                                            .catch(error => reject(error));
                                    } else {
                                        resolve(true);
                                    }
                                } else {
                                    resolve(true);
                                }
                            })
                            .catch(error => reject(error));
                    })
                    .catch(error => reject(error));
            })
            .catch(error => reject(error));
    });
}

// Función para desinscribir al usuario
function desinscribirUsuario(torneoId) {
    return new Promise((resolve, reject) => {
        const user = auth.currentUser;
        if (!user) {
            reject(new Error("Debes iniciar sesión para desinscribirte"));
            return;
        }
        
        // Obtener documento del torneo
        const torneoRef = doc(db, "torneos", torneoId);
        getDoc(torneoRef)
            .then(torneoSnap => {
                if (!torneoSnap.exists()) {
                    reject(new Error("El torneo no existe"));
                    return;
                }
                
                const torneoData = torneoSnap.data();
                
                // Verificar que el torneo esté aún abierto o en proceso
                if (torneoData.estado !== 'Abierto' && torneoData.estado !== 'En Progreso') {
                    reject(new Error("No puedes desinscribirte de este torneo"));
                    return;
                }
                
                // Verificar si el usuario está inscrito
                const currentParticipants = torneoData.participants || [];
                if (!currentParticipants.includes(user.uid)) {
                    reject(new Error("No estás inscrito en este torneo"));
                    return;
                }
                
                // Eliminar al usuario de la lista de participantes
                const newParticipants = currentParticipants.filter(uid => uid !== user.uid);
                
                // Actualizar el documento del torneo
                updateDoc(torneoRef, {
                    participants: newParticipants,
                    updatedAt: serverTimestamp()
                })
                    .then(() => {
                        // Actualizar usuario
                        const usersRef = collection(db, "usuarios");
                        const q = query(usersRef, where("uid", "==", user.uid));
                        
                        getDocs(q)
                            .then(userQuerySnapshot => {
                                if (!userQuerySnapshot.empty) {
                                    const userDoc = userQuerySnapshot.docs[0];
                                    
                                    // Eliminar torneo de la lista de torneos del usuario
                                    const userTorneos = userDoc.data().torneos || [];
                                    const newUserTorneos = userTorneos.filter(id => id !== torneoId);
                                    
                                    updateDoc(doc(db, "usuarios", userDoc.id), {
                                        torneos: newUserTorneos,
                                        updatedAt: serverTimestamp()
                                    })
                                        .then(() => resolve(true))
                                        .catch(error => reject(error));
                                } else {
                                    resolve(true);
                                }
                            })
                            .catch(error => reject(error));
                    })
                    .catch(error => reject(error));
            })
            .catch(error => reject(error));
    });
}

// Función para mensaje de error
function mensajeError() {
    return `
        <div class="col-span-full text-center p-4">
            <p class="text-red-500">Error al cargar torneos. Inténtalo de nuevo.</p>
            <button class="text-blue-500 underline mt-2" onclick="window.location.reload()">
                Recargar página
            </button>
        </div>
    `;
}
