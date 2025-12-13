// admin-resultados.js - Script para la gestión de resultados en el panel de administración

let db, auth, storage;
let torneoActualId = null;
let participanteActualId = null;
let participanteActualNombre = null;
let allTorneos = [];
let participantesFiltrados = [];
let allParticipantes = [];
let estadoFiltroActual = 'todos'; // 'todos', 'en-progreso', 'finalizado'

// Inicializar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Inicializando admin-resultados.js...");
    
    // Verificar que Firebase esté disponible
    if (typeof firebase === 'undefined') {
        console.error("Firebase no está disponible");
        return;
    }
    
    console.log("Firebase disponible, inicializando variables...");
    
    // Inicializar variables globales de Firebase
    db = window.db || firebase.firestore();
    auth = window.auth || firebase.auth();
    storage = window.storage || firebase.storage();
    
    console.log("Firebase inicializado:", { db: !!db, auth: !!auth, storage: !!storage });
    
    // Verificar autenticación
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            
            // Verificar si el usuario es administrador
            const isAdmin = await checkUserIsAdmin(user.uid);
            
            if (isAdmin) {
                console.log("Usuario es administrador, inicializando página...");
                // Actualizar UI con info del usuario
                updateUserProfileUI(user);
                
                // Inicializar la página
                initializePage();
            } else {
                console.log("Usuario no es administrador");
                alert("No tienes permisos para acceder a esta página");
                window.location.href = "../index.html";
            }
        } else {
            console.log("No hay usuario autenticado, redirigiendo...");
            window.location.href = "../index.html";
        }
    });
});

// Actualizar UI con info del usuario
function updateUserProfileUI(user) {
    const userProfile = document.getElementById('userProfile');
    if (userProfile) {
        userProfile.innerHTML = `
            <img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="${user.displayName || 'Admin'}" class="w-8 h-8 rounded-full">
            <span class="hidden md:inline">${user.displayName || 'Admin'}</span>
        `;
    }
}

// Verificar si el usuario es administrador
async function checkUserIsAdmin(uid) {
    try {
        const adminUIDs = ["dvblFee1ZnVKJNWBOR22tSAsNet2"];
        
        if (adminUIDs.includes(uid)) {
            return true;
        }
        
        const usersSnapshot = await db.collection("usuarios")
            .where("uid", "==", uid)
            .where("isHost", "==", true)
            .get();
        
        return !usersSnapshot.empty;
    } catch (error) {
        console.error("Error al verificar si el usuario es administrador:", error);
        return false;
    }
}

// Inicializar la página
async function initializePage() {
    try {
        // Configurar event listeners
        setupEventListeners();
        
        // Cargar torneos
        await loadTorneos();
        
    } catch (error) {
        console.error("Error al inicializar la página:", error);
        showError("Error al cargar la página. Por favor, recarga.");
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Filtro de torneos
    document.getElementById('filtroTorneo').addEventListener('input', filterTorneos);
    document.getElementById('limpiarFiltroBtn').addEventListener('click', () => {
        document.getElementById('filtroTorneo').value = '';
        filterTorneos();
    });
    
    // Filtros de estado
    document.getElementById('filtroTodos').addEventListener('click', () => {
        estadoFiltroActual = 'todos';
        updateFilterButtons('filtroTodos');
        filterTorneos();
    });
    
    document.getElementById('filtroEnProgreso').addEventListener('click', () => {
        estadoFiltroActual = 'en-progreso';
        updateFilterButtons('filtroEnProgreso');
        filterTorneos();
    });
    
    document.getElementById('filtroFinalizado').addEventListener('click', () => {
        estadoFiltroActual = 'finalizado';
        updateFilterButtons('filtroFinalizado');
        filterTorneos();
    });
    
    // Buscar participante
    document.getElementById('buscarParticipante').addEventListener('input', filterParticipantes);
    
    // Modal de edición
    document.getElementById('editResultadosForm').addEventListener('submit', handleEditResultados);
    document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
    document.getElementById('closeEditModal').addEventListener('click', closeEditModal);
    
    // Cambiar torneo
    document.getElementById('cambiarTorneoBtn').addEventListener('click', deselectTorneo);
    
    // Modal de emparejamiento
    document.getElementById('agregarEmparejamientoForm').addEventListener('submit', handleAddEmparejamiento);
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', closeEmparejamientoModal);
    });
}

// Actualizar botones de filtro de estado
function updateFilterButtons(activeButtonId) {
    document.querySelectorAll('.filtro-estado-btn').forEach(btn => {
        btn.classList.remove('active-filter', 'ring-2', 'ring-offset-2');
        if (btn.id === activeButtonId) {
            btn.classList.add('active-filter', 'ring-2', 'ring-offset-2');
        }
    });
}

// Cargar todos los torneos
async function loadTorneos() {
    try {
        const listaTorneos = document.getElementById('listaTorneos');
        listaTorneos.innerHTML = '<div class="flex justify-center col-span-2 p-8"><div><div class="spinner rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500 mx-auto mb-3"></div><p class="text-gray-500 text-center">Cargando torneos...</p></div></div>';
        
        console.log("Iniciando carga de torneos...");
        console.log("DB disponible:", !!db);
        
        // Consultar torneos en Firestore - sin orderBy para evitar errores de índice
        const torneosSnapshot = await db.collection("torneos").get();
        console.log("Resultado de consulta:", torneosSnapshot.size, "torneos encontrados");
        
        allTorneos = [];
        torneosSnapshot.forEach(doc => {
            const torneoData = doc.data();
            console.log("Torneo encontrado:", doc.id, torneoData.nombre, "Estado:", torneoData.estado);
            allTorneos.push({
                id: doc.id,
                nombre: torneoData.nombre || 'Sin nombre',
                estado: torneoData.estado || 'Desconocido',
                fecha: torneoData.fecha || torneoData.fechaHora,
                descripcion: torneoData.descripcion || '',
                capacidad: torneoData.capacidad || 0,
                ...torneoData
            });
        });
        
        console.log("Total de torneos cargados:", allTorneos.length);
        
        // Ordenar por fecha (más recientes primero)
        allTorneos.sort((a, b) => {
            let dateA = new Date(0);
            let dateB = new Date(0);
            
            // Manejar fecha en formato Timestamp (con .seconds)
            if (a.fecha && a.fecha.seconds) {
                dateA = new Date(a.fecha.seconds * 1000);
            } else if (a.fecha) {
                dateA = new Date(a.fecha);
            }
            
            if (b.fecha && b.fecha.seconds) {
                dateB = new Date(b.fecha.seconds * 1000);
            } else if (b.fecha) {
                dateB = new Date(b.fecha);
            }
            
            return dateB - dateA;
        });
        
        console.log("Torneos ordenados, mostrando lista...");
        
        // Renderizar torneos filtrados
        filterTorneos();
        
    } catch (error) {
        console.error("Error al cargar torneos:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        
        const listaTorneos = document.getElementById('listaTorneos');
        listaTorneos.innerHTML = `<div class="col-span-2 text-center p-8 bg-red-50 rounded-lg border border-red-200">
            <i class="fas fa-exclamation-circle text-red-500 text-3xl mb-3 block"></i>
            <p class="text-red-700 font-semibold mb-2">Error al cargar torneos</p>
            <p class="text-red-600 text-sm mb-3">${error.message}</p>
            ${error.code ? `<p class="text-red-500 text-xs mb-4">Código: ${error.code}</p>` : ''}
            <button onclick="location.reload()" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition">
                <i class="fas fa-redo mr-2"></i>Reintentar
            </button>
        </div>`;
    }
}

// Renderizar torneos como tarjetas seleccionables
function renderTorneos(torneos) {
    const listaTorneos = document.getElementById('listaTorneos');
    
    if (!torneos || torneos.length === 0) {
        listaTorneos.innerHTML = '<div class="col-span-2 text-center text-gray-500 p-8 bg-gray-50 rounded-lg border border-gray-200"><i class="fas fa-inbox text-3xl text-gray-300 mb-3 block"></i><p class="font-semibold mb-2">No hay torneos disponibles</p><p class="text-sm">Crea un nuevo torneo en la sección de "Torneos"</p></div>';
        return;
    }
    
    let html = '';
    torneos.forEach(torneo => {
        // Formatear fecha con manejo de ambos formatos
        let fechaFormateada = 'Fecha no disponible';
        if (torneo.fecha) {
            let fecha;
            if (torneo.fecha.seconds) {
                fecha = new Date(torneo.fecha.seconds * 1000);
            } else {
                fecha = new Date(torneo.fecha);
            }
            if (fecha instanceof Date && !isNaN(fecha)) {
                fechaFormateada = fecha.toLocaleDateString('es-ES');
            }
        }
        
        // Determinar color del badge según estado
        let estadoBadgeClass = 'bg-gray-100 text-gray-700';
        let estadoIcon = 'fa-question-circle';
        if (torneo.estado === 'En Progreso') {
            estadoBadgeClass = 'bg-yellow-100 text-yellow-800';
            estadoIcon = 'fa-spinner';
        } else if (torneo.estado === 'Finalizado') {
            estadoBadgeClass = 'bg-green-100 text-green-800';
            estadoIcon = 'fa-check-circle';
        }
        
        html += `
            <div class="participante-card" onclick="selectTorneo('${torneo.id}', '${(torneo.nombre || 'Torneo').replace(/'/g, "\\'")}')">
                <div class="flex items-start justify-between">
                    <div class="flex-grow">
                        <h4 class="font-bold text-lg text-gray-800">${torneo.nombre || 'Torneo sin nombre'}</h4>
                        <p class="text-sm text-gray-600 mt-1">
                            <i class="fas fa-calendar mr-2"></i>${fechaFormateada}
                        </p>
                        <p class="text-sm mt-2">
                            <span class="px-3 py-1 rounded-full text-xs font-semibold ${estadoBadgeClass}">
                                <i class="fas ${estadoIcon} mr-1"></i>${torneo.estado || 'Desconocido'}
                            </span>
                        </p>
                    </div>
                    <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold whitespace-nowrap ml-4">
                        Seleccionar
                    </span>
                </div>
            </div>
        `;
    });
    
    listaTorneos.innerHTML = html;
}

// Filtrar torneos por nombre
// Filtrar torneos por nombre y estado
function filterTorneos() {
    const filtro = document.getElementById('filtroTorneo').value.toLowerCase();
    const tornesFiltrados = allTorneos.filter(torneo => {
        // Filtrar por nombre
        const cumpleFiltroNombre = torneo.nombre.toLowerCase().includes(filtro);
        
        // Filtrar por estado
        let cumpleFiltroEstado = true;
        if (estadoFiltroActual === 'en-progreso') {
            cumpleFiltroEstado = torneo.estado === 'En Progreso';
        } else if (estadoFiltroActual === 'finalizado') {
            cumpleFiltroEstado = torneo.estado === 'Finalizado';
        }
        // Si estadoFiltroActual === 'todos', cumpleFiltroEstado siempre es true
        
        return cumpleFiltroNombre && cumpleFiltroEstado;
    });
    renderTorneos(tornesFiltrados);
}

// Seleccionar un torneo
async function selectTorneo(torneoId, torneoNombre) {
    try {
        torneoActualId = torneoId;
        document.getElementById('tornoSeleccionadoNombre').textContent = torneoNombre;
        document.getElementById('participantesSection').classList.remove('hidden');
        
        // Cargar participantes del torneo
        await loadParticipantes(torneoId);
        
        // Scroll a la sección de participantes
        document.getElementById('participantesSection').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error("Error al seleccionar torneo:", error);
        showError("Error al cargar participantes: " + error.message);
    }
}

// Desseleccionar torneo
function deselectTorneo() {
    torneoActualId = null;
    participanteActualId = null;
    document.getElementById('participantesSection').classList.add('hidden');
    document.getElementById('filtroTorneo').value = '';
}

// Cargar participantes de un torneo
async function loadParticipantes(torneoId) {
    try {
        console.log("Cargando participantes del torneo:", torneoId);
        
        // Usar sintaxis compat de Firebase (como en tournaments.js)
        const inscripcionesSnapshot = await db.collection("torneos")
            .doc(torneoId)
            .collection("inscripciones")
            .where("estado", "==", "inscrito")
            .get();
        
        console.log("Participantes encontrados:", inscripcionesSnapshot.size);
        
        allParticipantes = [];
        
        inscripcionesSnapshot.forEach(inscripcionDoc => {
            const inscripcion = inscripcionDoc.data();
            const userId = inscripcionDoc.id;
            
            console.log("Participante:", userId, inscripcion.userName);
            
            allParticipantes.push({
                id: userId,
                nombre: inscripcion.userName || inscripcion.userEmail || 'Sin nombre',
                discord: inscripcion.discordUsername || 'No especificado',
                nombreJuego: inscripcion.gameUsername || 'No especificado',
                puntos: inscripcion.puntos || 0,
                posicion: inscripcion.posicion || '',
                emparejamientos: inscripcion.emparejamientos || [],
                // Guardar todos los datos para poder actualizar
                ...inscripcion
            });
        });
        
        console.log("Total participantes cargados:", allParticipantes.length);
        
        participantesFiltrados = [...allParticipantes];
        renderParticipantes(participantesFiltrados);
        
    } catch (error) {
        console.error("Error al cargar participantes:", error);
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        showError("Error al cargar participantes: " + error.message);
    }
}

// Renderizar tabla de participantes
function renderParticipantes(participantes) {
    const tableBody = document.getElementById('participantesTableBody');
    
    if (!participantes || participantes.length === 0) {
        tableBody.innerHTML = `<tr>
            <td colspan="6" class="px-6 py-8 text-center">
                <div class="flex flex-col items-center justify-center">
                    <i class="fas fa-inbox text-3xl text-gray-300 mb-3"></i>
                    <p class="text-gray-500 font-semibold">No hay participantes en este torneo</p>
                    <p class="text-xs text-gray-400 mt-1">Los participantes aparecerán aquí una vez que se inscriban</p>
                </div>
            </td>
        </tr>`;
        return;
    }
    
    console.log("Renderizando", participantes.length, "participantes");
    
    let html = '';
    participantes.forEach((participante, index) => {
        const posicionClass = `posicion-${participante.posicion || 'no_clasificado'}`;
        const posicionText = getPosicionText(participante.posicion);
        
        // Determinar color de fila según estado
        // Rojo si está descalificado o tiene pérdidas (está muerto)
        // Verde si está vivo y ganando
        let rowBgColor = 'bg-white';
        let rowStyle = '';
        
        if (participante.posicion === 'descalificado') {
            // Rojo si está descalificado
            rowBgColor = 'bg-red-50';
            rowStyle = 'background-color: #fee2e2;';
        } else {
            // Verificar si tiene pérdidas (está muerto)
            const tieneDerrota = participante.emparejamientos && participante.emparejamientos.some(emp => emp.resultado === 'perdió');
            
            if (tieneDerrota) {
                // Rojo si está muerto
                rowBgColor = 'bg-red-50';
                rowStyle = 'background-color: #fee2e2;';
            } else {
                // Verde si está vivo
                rowBgColor = 'bg-green-50';
                rowStyle = 'background-color: #dcfce7;';
            }
        }
        
        html += `
            <tr class="hover:opacity-80 transition" style="${rowStyle}">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${participante.nombre}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">${participante.nombreJuego}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">${participante.discord}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <span class="puntos-badge">${participante.puntos}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <span class="posicion-badge ${posicionClass}">${posicionText}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-blue-600 hover:text-blue-900 mr-3" onclick="openEditModal('${participante.id}', '${participante.nombreJuego.replace(/'/g, "\\'")}', ${participante.puntos}, '${participante.posicion || ''}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-green-600 hover:text-green-900" onclick="openEmparejamientoModal('${participante.id}')">
                        <i class="fas fa-gamepad"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// Filtrar participantes
function filterParticipantes() {
    const filtro = document.getElementById('buscarParticipante').value.toLowerCase();
    participantesFiltrados = allParticipantes.filter(p => 
        p.nombre.toLowerCase().includes(filtro) ||
        p.nombreJuego.toLowerCase().includes(filtro) ||
        p.discord.toLowerCase().includes(filtro)
    );
    renderParticipantes(participantesFiltrados);
}

// Obtener texto de posición
function getPosicionText(posicion) {
    const posiciones = {
        '1': '🥇 1er Lugar',
        '2': '🥈 2do Lugar',
        '3': '🥉 3er Lugar',
        'no_clasificado': 'No Clasificado',
        'descalificado': 'Descalificado',
        '': 'Pendiente'
    };
    return posiciones[posicion] || 'Pendiente';
}

// Abrir modal de edición de resultados
function openEditModal(participanteId, nombreJuego, puntos, posicion) {
    participanteActualId = participanteId;
    participanteActualNombre = nombreJuego;
    
    document.getElementById('participanteNombre').textContent = nombreJuego;
    document.getElementById('editPuntos').value = puntos;
    document.getElementById('editPosicion').value = posicion;
    
    // Cargar emparejamientos
    loadEmparejamientos(participanteId);
    
    document.getElementById('editResultadosModal').classList.remove('hidden');
}

// Cerrar modal de edición
function closeEditModal() {
    document.getElementById('editResultadosModal').classList.add('hidden');
    // No nulificar participanteActualId aquí, podría ser usado por el modal de emparejamiento
}

// Cargar emparejamientos de un participante
async function loadEmparejamientos(participanteId) {
    try {
        const emparejamientosContainer = document.getElementById('emparejamientosContainer');
        
        const participante = allParticipantes.find(p => p.id === participanteId);
        
        if (!participante || !participante.emparejamientos || participante.emparejamientos.length === 0) {
            emparejamientosContainer.innerHTML = '<p class="text-gray-500 text-sm">No hay emparejamientos registrados. Agrega uno nuevo.</p>';
        } else {
            let html = '';
            participante.emparejamientos.forEach((emp, index) => {
                // Determinar icono y colores basados en resultado
                let iconoResultado = '';
                let colorFondo = '';
                let colorTexto = '';
                
                if (emp.resultado === 'ganó') {
                    iconoResultado = '✓';
                    colorFondo = '#dcfce7'; // Verde pastel
                    colorTexto = '#166534'; // Verde oscuro
                } else if (emp.resultado === 'perdió') {
                    iconoResultado = '✗';
                    colorFondo = '#fee2e2'; // Rojo pastel
                    colorTexto = '#991b1b'; // Rojo oscuro
                } else {
                    iconoResultado = '~';
                    colorFondo = '#fef3c7'; // Amarillo pastel
                    colorTexto = '#92400e'; // Amarillo oscuro
                }
                
                // Formato mejorado: (Tu Nombre) Puntaje vs Puntaje (Oponente Nombre)
                const tuNombreJuego = participante.nombreJuego || 'Sin nombre';
                const oponenteNombreJuego = emp.contraroGameUsername || 'Sin nombre';
                
                html += `
                    <div class="emparejamiento-item border border-gray-200 rounded-lg p-4 mb-2" style="background-color: ${colorFondo};">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <p class="font-bold text-lg" style="color: ${colorTexto};">
                                    (${tuNombreJuego}) ${emp.puntosPropio} vs ${emp.puntosContrario} (${oponenteNombreJuego})
                                </p>
                                <p class="text-xs mt-2" style="color: ${colorTexto}; opacity: 0.8;">
                                    vs ${emp.contrario}
                                </p>
                            </div>
                            <div class="flex flex-col items-end gap-2">
                                <span class="text-3xl font-bold" style="color: ${colorTexto};">
                                    ${iconoResultado}
                                </span>
                                <button type="button" class="text-red-500 hover:text-red-700 text-sm" onclick="deleteEmparejamiento(${index})">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            emparejamientosContainer.innerHTML = html;
        }
        
        // Agregar botón para añadir emparejamiento
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'mt-3 w-full bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition';
        addBtn.innerHTML = '<i class="fas fa-plus mr-2"></i>Agregar Emparejamiento';
        addBtn.onclick = (e) => {
            e.preventDefault();
            openEmparejamientoModal(participanteId);
        };
        emparejamientosContainer.appendChild(addBtn);
        
    } catch (error) {
        console.error("Error al cargar emparejamientos:", error);
    }
}

// Guardar edición de resultados
async function handleEditResultados(e) {
    e.preventDefault();
    
    try {
        const puntos = parseInt(document.getElementById('editPuntos').value);
        const posicion = document.getElementById('editPosicion').value;
        
        if (isNaN(puntos) || puntos < 0) {
            showError("Los puntos deben ser un número válido");
            return;
        }
        
        // Actualizar en Firestore
        const inscripcionRef = db.collection("torneos")
            .doc(torneoActualId)
            .collection("inscripciones")
            .doc(participanteActualId);
        
        const participante = allParticipantes.find(p => p.id === participanteActualId);
        
        await inscripcionRef.update({
            puntos: puntos,
            posicion: posicion,
            emparejamientos: participante.emparejamientos,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Actualizar localmente
        const idx = allParticipantes.findIndex(p => p.id === participanteActualId);
        if (idx !== -1) {
            allParticipantes[idx].puntos = puntos;
            allParticipantes[idx].posicion = posicion;
        }
        
        // Recargar tabla
        renderParticipantes(participantesFiltrados);
        
        showSuccess("Resultados guardados correctamente");
        closeEditModal();
        
    } catch (error) {
        console.error("Error al guardar resultados:", error);
        showError("Error al guardar: " + error.message);
    }
}

// Abrir modal de emparejamiento
function openEmparejamientoModal(participanteId) {
    // Validar y establecer el ID del participante
    if (participanteId && typeof participanteId === 'string') {
        participanteActualId = participanteId;
    }
    
    // Verificar que hay un participante seleccionado
    if (!participanteActualId) {
        showError("No hay participante seleccionado. Por favor, abre correctamente el editor.");
        return;
    }
    
    // Cargar lista de participantes en el dropdown
    const participanteActual = allParticipantes.find(p => p.id === participanteActualId);
    
    if (!participanteActual) {
        showError("No se encontró el participante seleccionado");
        return;
    }
    
    const selectContrario = document.getElementById('emparejamientoContrario');
    selectContrario.innerHTML = '<option value="">Selecciona un oponente</option>';
    
    // Agregar solo participantes diferentes al actual
    allParticipantes.forEach(p => {
        if (p.id !== participanteActualId) {
            const option = document.createElement('option');
            option.value = p.id; // Guardamos el ID del participante
            option.dataset.nombre = p.nombre || p.userName || 'Sin nombre';
            option.textContent = `${p.nombre || p.userName || 'Sin nombre'} (${p.nombreJuego || 'Sin nombre de juego'})`;
            selectContrario.appendChild(option);
        }
    });
    
    document.getElementById('agregarEmparejamientoForm').reset();
    document.getElementById('agregarEmparejamientoModal').classList.remove('hidden');
}

// Cerrar modal de emparejamiento
function closeEmparejamientoModal() {
    document.getElementById('agregarEmparejamientoModal').classList.add('hidden');
}

// Agregar emparejamiento
async function handleAddEmparejamiento(e) {
    e.preventDefault();
    
    try {
        const contrarioId = document.getElementById('emparejamientoContrario').value.trim();
        const puntosPropio = parseInt(document.getElementById('puntosPropio').value);
        const puntosContrario = parseInt(document.getElementById('puntosContrario').value);
        
        console.log("=== handleAddEmparejamiento ===");
        console.log("torneoActualId:", torneoActualId);
        console.log("participanteActualId:", participanteActualId);
        console.log("contrarioId:", contrarioId);
        console.log("puntosPropio:", puntosPropio);
        console.log("puntosContrario:", puntosContrario);
        console.log("allParticipantes.length:", allParticipantes.length);
        
        // Validación de campos requeridos
        if (!torneoActualId) {
            showError("No hay torneo seleccionado. Por favor, selecciona un torneo.");
            return;
        }
        
        if (!participanteActualId) {
            showError("No hay participante seleccionado. Por favor, abre el modal correctamente.");
            return;
        }
        
        if (!contrarioId || isNaN(puntosPropio) || isNaN(puntosContrario)) {
            showError("Todos los campos son requeridos");
            return;
        }
        
        // Encontrar participantes
        const participante = allParticipantes.find(p => p.id === participanteActualId);
        const contrario = allParticipantes.find(p => p.id === contrarioId);
        
        console.log("Participante encontrado:", !!participante, participante?.nombre);
        console.log("Contrario encontrado:", !!contrario, contrario?.nombre);
        
        if (!participante || !contrario) {
            console.error("ERROR: Participantes no encontrados", {
                participanteActualId,
                contrarioId,
                participanteExists: !!participante,
                contrarioExists: !!contrario,
                allParticipantes: allParticipantes.map(p => ({ id: p.id, nombre: p.nombre }))
            });
            showError("Error al encontrar los participantes");
            return;
        }
        
        // Determinar ganador y perdedor basado en puntos
        const ganador = puntosPropio > puntosContrario ? 'ganó' : 
                       puntosContrario > puntosPropio ? 'perdió' : 'empate';
        
        // Crear objeto del emparejamiento
        const emparejamiento = {
            contrarioId: contrarioId,
            contrario: contrario.nombre || contrario.userName || 'Sin nombre',
            contraroGameUsername: contrario.nombreJuego || 'Sin nombre',
            puntosPropio,
            puntosContrario,
            resultado: ganador,
            fecha: new Date().toISOString()
        };
        
        // Actualizar participante actual
        if (!participante.emparejamientos) {
            participante.emparejamientos = [];
        }
        participante.emparejamientos.push(emparejamiento);
        
        // Crear emparejamiento del contrario (reflejo)
        const emparejamientoContrario = {
            contrarioId: participanteActualId,
            contrario: participante.nombre || participante.userName || 'Sin nombre',
            contraroGameUsername: participante.nombreJuego || 'Sin nombre',
            puntosPropio: puntosContrario,
            puntosContrario: puntosPropio,
            resultado: ganador === 'ganó' ? 'perdió' : ganador === 'perdió' ? 'ganó' : 'empate',
            fecha: new Date().toISOString()
        };
        
        // Actualizar contrario
        if (!contrario.emparejamientos) {
            contrario.emparejamientos = [];
        }
        contrario.emparejamientos.push(emparejamientoContrario);
        
        console.log("✓ Emparejamiento para participante:", emparejamiento);
        console.log("✓ Emparejamiento para contrario:", emparejamientoContrario);
        
        // Guardar ambos en Firestore
        const batch = db.batch();
        
        const inscripcionRef1 = db.collection("torneos")
            .doc(torneoActualId)
            .collection("inscripciones")
            .doc(participanteActualId);
        
        const inscripcionRef2 = db.collection("torneos")
            .doc(torneoActualId)
            .collection("inscripciones")
            .doc(contrarioId);
        
        batch.update(inscripcionRef1, {
            emparejamientos: participante.emparejamientos,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        batch.update(inscripcionRef2, {
            emparejamientos: contrario.emparejamientos,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await batch.commit();
        
        console.log("✓ Emparejamientos guardados correctamente en Firestore");
        
        // Recargar emparejamientos en el modal
        loadEmparejamientos(participanteActualId);
        
        const resultadoText = ganador === 'ganó' ? '✓ Victoria' : ganador === 'perdió' ? '✗ Derrota' : '~ Empate';
        showSuccess(`Emparejamiento agregado - ${resultadoText}`);
        closeEmparejamientoModal();
        
        // Recargar tabla de participantes
        renderParticipantes(participantesFiltrados);
        
    } catch (error) {
        console.error("ERROR CRÍTICO en handleAddEmparejamiento:", error);
        console.error("Stack:", error.stack);
        showError("Error al agregar: " + error.message);
    }
}

// Eliminar emparejamiento
async function deleteEmparejamiento(index) {
    try {
        if (!confirm("¿Eliminar este emparejamiento? Se eliminará para ambos jugadores.")) return;
        
        const participante = allParticipantes.find(p => p.id === participanteActualId);
        
        if (!participante.emparejamientos || !participante.emparejamientos[index]) {
            showError("No se encontró el emparejamiento");
            return;
        }
        
        // Obtener el emparejamiento a eliminar
        const emparejamientoAEliminar = participante.emparejamientos[index];
        const contrarioId = emparejamientoAEliminar.contrarioId;
        
        // Encontrar el participante contrario
        const contrario = allParticipantes.find(p => p.id === contrarioId);
        
        if (!contrario) {
            showError("No se encontró el participante contrario");
            return;
        }
        
        // Eliminar el emparejamiento del participante actual
        participante.emparejamientos.splice(index, 1);
        
        // Encontrar y eliminar el emparejamiento del contrario
        // Buscar el índice del emparejamiento que corresponde al participante actual
        const indexContrario = contrario.emparejamientos.findIndex(emp => 
            emp.contrarioId === participanteActualId && 
            emp.puntosPropio === emparejamientoAEliminar.puntosContrario &&
            emp.puntosContrario === emparejamientoAEliminar.puntosPropio
        );
        
        if (indexContrario !== -1) {
            contrario.emparejamientos.splice(indexContrario, 1);
        }
        
        // Actualizar ambos en Firestore usando batch
        const batch = db.batch();
        
        const inscripcionRef1 = db.collection("torneos")
            .doc(torneoActualId)
            .collection("inscripciones")
            .doc(participanteActualId);
        
        const inscripcionRef2 = db.collection("torneos")
            .doc(torneoActualId)
            .collection("inscripciones")
            .doc(contrarioId);
        
        batch.update(inscripcionRef1, {
            emparejamientos: participante.emparejamientos,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        batch.update(inscripcionRef2, {
            emparejamientos: contrario.emparejamientos,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await batch.commit();
        
        loadEmparejamientos(participanteActualId);
        renderParticipantes(participantesFiltrados);
        showSuccess("Emparejamiento eliminado para ambos jugadores");
    } catch (error) {
        console.error("Error al eliminar emparejamiento:", error);
        showError("Error al eliminar: " + error.message);
    }
}

// Mostrar error
function showError(message) {
    alert(message);
}

// Mostrar éxito
function showSuccess(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}
