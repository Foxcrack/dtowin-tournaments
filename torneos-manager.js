/**
 * torneos-manager.js - Gestión completa de torneos para Dtowin
 * Solución permanente para problemas de creación y actualización
 */

// Configuración inicial
document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticación
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            inicializarGestionTorneos();
        } else {
            console.log("No hay usuario autenticado");
            window.location.href = "index.html";
        }
    });
});

/**
 * Inicializa todas las funcionalidades de gestión de torneos
 */
function inicializarGestionTorneos() {
    // Detectar si estamos en modo creación o edición
    const isEditMode = window.location.href.includes('editar') || 
                       new URLSearchParams(window.location.search).get('id') || 
                       document.querySelector('button.actualizar');
    
    // Configurar eventos según el modo
    if (isEditMode) {
        configurarModoEdicion();
    } else {
        configurarModoCreacion();
    }
    
    // Configurar eventos comunes
    configurarVistaPrevia();
    configurarGestionBadges();
}

/**
 * Configura el formulario para el modo de creación de torneos
 */
function configurarModoCreacion() {
    console.log("Configurando modo de creación de torneos");
    
    // Botón de creación de torneo
    const crearBtn = document.querySelector('button.procesando') || 
                     document.getElementById('submitButton') ||
                     document.querySelector('[type="submit"]');
    
    if (crearBtn) {
        crearBtn.addEventListener('click', function(event) {
            event.preventDefault();
            crearTorneo();
        });
    }
    
    // Botón de cancelar
    const cancelarBtn = document.querySelector('button.cancelar') || 
                        document.getElementById('cancelButton');
    
    if (cancelarBtn) {
        cancelarBtn.addEventListener('click', function() {
            if (confirm("¿Estás seguro que deseas cancelar? Los cambios no se guardarán.")) {
                window.location.href = "admin-torneos.html";
            }
        });
    }
}

/**
 * Configura el formulario para el modo de edición de torneos
 */
function configurarModoEdicion() {
    console.log("Configurando modo de edición de torneos");
    
    // Obtener ID del torneo
    const tournamentId = obtenerTorneoId();
    
    if (!tournamentId) {
        console.error("No se pudo determinar el ID del torneo a editar");
        mostrarNotificacion("Error: No se pudo identificar el torneo a editar", "error");
        return;
    }
    
    // Cargar datos del torneo
    cargarDatosTorneo(tournamentId);
    
    // Botón de actualización
    const actualizarBtn = document.querySelector('button.actualizar') || 
                          document.getElementById('submitButton') ||
                          document.querySelector('[type="submit"]');
    
    if (actualizarBtn) {
        actualizarBtn.addEventListener('click', function(event) {
            event.preventDefault();
            actualizarTorneo(tournamentId);
        });
    }
    
    // Botón de cancelar
    const cancelarBtn = document.querySelector('button.cancelar') || 
                        document.getElementById('cancelButton');
    
    if (cancelarBtn) {
        cancelarBtn.addEventListener('click', function() {
            if (confirm("¿Estás seguro que deseas cancelar? Los cambios no se guardarán.")) {
                window.location.href = "admin-torneos.html";
            }
        });
    }
}

/**
 * Obtiene el ID del torneo a editar de varias fuentes posibles
 * @returns {string|null} ID del torneo o null si no se encuentra
 */
function obtenerTorneoId() {
    // Intentar obtener de URL
    const idFromUrl = new URLSearchParams(window.location.search).get('id');
    if (idFromUrl) return idFromUrl;
    
    // Intentar obtener de atributos data
    const torneoElement = document.querySelector('[data-torneo-id]');
    if (torneoElement) return torneoElement.dataset.torneoId;
    
    // Intentar obtener de botón de actualización
    const updateButton = document.querySelector('button.actualizar');
    if (updateButton && updateButton.dataset.torneoId) return updateButton.dataset.torneoId;
    
    // Intentar obtener del último segmento de la URL
    const urlSegments = window.location.pathname.split('/');
    const lastSegment = urlSegments[urlSegments.length - 1];
    if (lastSegment && lastSegment !== 'editar.html' && lastSegment !== 'index.html') return lastSegment;
    
    return null;
}

/**
 * Carga los datos de un torneo en el formulario
 * @param {string} torneoId - ID del torneo a cargar
 */
async function cargarDatosTorneo(torneoId) {
    try {
        // Mostrar carga
        mostrarCargando("Cargando datos del torneo...");
        
        // Obtener documento
        const torneoRef = firebase.firestore().collection("torneos").doc(torneoId);
        const torneoSnap = await torneoRef.get();
        
        if (!torneoSnap.exists) {
            mostrarNotificacion("No se encontró el torneo solicitado", "error");
            return;
        }
        
        const torneo = torneoSnap.data();
        
        // Cargar datos en el formulario
        const campos = {
            'nombre': torneo.nombre || '',
            'descripcion': torneo.descripcion || '',
            'capacidad': torneo.capacidad || '',
            'estado': torneo.estado || 'Próximamente'
        };
        
        // Establecer valores en los campos
        Object.keys(campos).forEach(campo => {
            const element = document.getElementById(campo);
            if (element) element.value = campos[campo];
        });
        
        // Formatear y establecer fecha
        if (torneo.fecha) {
            const fecha = new Date(torneo.fecha.seconds * 1000);
            const fechaFormateada = formatearFecha(fecha);
            const element = document.getElementById('fecha');
            if (element) element.value = fechaFormateada;
        }
        
        // Establecer hora
        if (torneo.hora) {
            const element = document.getElementById('hora');
            if (element) element.value = torneo.hora;
        }
        
        // Cargar puntos por posición
        if (torneo.puntosPosicion) {
            const puntos1 = document.querySelector('input[placeholder="5"]') || document.getElementById('puntos1');
            const puntos2 = document.querySelector('input[placeholder="3"]') || document.getElementById('puntos2');
            const puntos3 = document.querySelector('input[placeholder="1"]') || document.getElementById('puntos3');
            
            if (puntos1) puntos1.value = torneo.puntosPosicion[1] || 5;
            if (puntos2) puntos2.value = torneo.puntosPosicion[2] || 3;
            if (puntos3) puntos3.value = torneo.puntosPosicion[3] || 1;
        }
        
        // Mostrar imagen actual
        if (torneo.imageUrl) {
            mostrarImagenPrevia(torneo.imageUrl);
        }
        
        // Cargar badges asignados
        cargarBadgesTorneo(torneoId);
        
        // Finalizar carga
        ocultarCargando();
        
    } catch (error) {
        console.error("Error al cargar datos del torneo:", error);
        mostrarNotificacion(`Error al cargar datos: ${error.message}`, "error");
        ocultarCargando();
    }
}

/**
 * Crea un nuevo torneo con los datos del formulario
 */
async function crearTorneo() {
    // Validar datos
    if (!validarFormulario()) return;
    
    // Obtener referencia al botón
    const submitBtn = document.querySelector('button.procesando') || 
                      document.getElementById('submitButton') ||
                      document.querySelector('[type="submit"]');
    
    // Mostrar estado de carga
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Procesando...';
    }
    
    try {
        // Obtener datos del formulario
        const datosTorneo = obtenerDatosFormulario();
        
        // Añadir campos adicionales para creación
        datosTorneo.createdBy = firebase.auth().currentUser.uid;
        datosTorneo.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        datosTorneo.participants = [];
        datosTorneo.visible = true;
        
        // Intentar subir imagen si existe
        const imagen = document.getElementById('imagen')?.files[0];
        if (imagen) {
            try {
                const imageUrl = await subirImagen(imagen, 'torneos');
                if (imageUrl) datosTorneo.imageUrl = imageUrl;
            } catch (imgError) {
                console.error("Error al subir imagen:", imgError);
                mostrarNotificacion("Error al subir imagen. El torneo se creará sin imagen.", "warning");
                // Continuar sin imagen
            }
        }
        
        // Crear documento en Firestore
        const torneoRef = await firebase.firestore().collection("torneos").add(datosTorneo);
        console.log("Torneo creado con ID:", torneoRef.id);
        
        // Mostrar mensaje de éxito y redirigir
        mostrarNotificacion("Torneo creado con éxito", "success");
        setTimeout(() => {
            window.location.href = "admin-torneos.html";
        }, 1500);
        
    } catch (error) {
        console.error("Error al crear torneo:", error);
        mostrarNotificacion("Error al crear torneo: " + error.message, "error");
        
        // Restaurar botón
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Crear Torneo';
        }
    }
}

/**
 * Actualiza un torneo existente con los datos del formulario
 * @param {string} torneoId - ID del torneo a actualizar
 */
async function actualizarTorneo(torneoId) {
    // Validar datos
    if (!validarFormulario()) return;
    
    // Obtener referencia al botón
    const submitBtn = document.querySelector('button.actualizar') || 
                      document.getElementById('submitButton') ||
                      document.querySelector('[type="submit"]');
    
    // Mostrar estado de carga
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Procesando...';
    }
    
    try {
        // Obtener datos actuales del torneo
        const torneoRef = firebase.firestore().collection("torneos").doc(torneoId);
        const torneoSnap = await torneoRef.get();
        
        if (!torneoSnap.exists) {
            throw new Error("El torneo que intentas actualizar no existe");
        }
        
        const datosActuales = torneoSnap.data();
        
        // Obtener datos del formulario
        const datosFormulario = obtenerDatosFormulario();
        
        // Crear objeto de actualización (solo con campos válidos)
        const datosActualizacion = {
            nombre: datosFormulario.nombre,
            descripcion: datosFormulario.descripcion,
            estado: datosFormulario.estado,
            puntosPosicion: datosFormulario.puntosPosicion,
            updatedBy: firebase.auth().currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Añadir campos opcionales solo si tienen valor
        if (datosFormulario.capacidad !== null) datosActualizacion.capacidad = datosFormulario.capacidad;
        if (datosFormulario.fecha) datosActualizacion.fecha = datosFormulario.fecha;
        if (datosFormulario.hora) datosActualizacion.hora = datosFormulario.hora;
        
        // Mantener datos que no se deben modificar desde el formulario
        datosActualizacion.participants = datosActuales.participants || [];
        datosActualizacion.visible = datosActuales.visible !== false;
        datosActualizacion.createdAt = datosActuales.createdAt;
        datosActualizacion.createdBy = datosActuales.createdBy;
        
        // IMPORTANTE: Mantener la URL de imagen actual si no hay una nueva
        datosActualizacion.imageUrl = datosActuales.imageUrl || null;
        
        // Intentar subir nueva imagen si existe
        const imagen = document.getElementById('imagen')?.files[0];
        if (imagen) {
            try {
                // Eliminar imagen anterior si existe
                if (datosActuales.imageUrl) {
                    await eliminarImagen(datosActuales.imageUrl);
                }
                
                // Subir nueva imagen
                const imageUrl = await subirImagen(imagen, 'torneos');
                if (imageUrl) datosActualizacion.imageUrl = imageUrl;
                
            } catch (imgError) {
                console.error("Error al procesar imagen:", imgError);
                mostrarNotificacion("Error al procesar la imagen. Se mantendrá la imagen actual.", "warning");
                // Continuar con la imagen actual
            }
        }
        
        // Actualizar documento en Firestore
        await torneoRef.set(datosActualizacion); // Usar set en lugar de update para reemplazar todo
        console.log("Torneo actualizado:", torneoId);
        
        // Mostrar mensaje de éxito y redirigir
        mostrarNotificacion("Torneo actualizado con éxito", "success");
        setTimeout(() => {
            window.location.href = "admin-torneos.html";
        }, 1500);
        
    } catch (error) {
        console.error("Error al actualizar torneo:", error);
        mostrarNotificacion("Error al actualizar torneo: " + error.message, "error");
        
        // Restaurar botón
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Actualizar Torneo';
        }
    }
}

/**
 * Obtiene y valida los datos del formulario de torneo
 * @returns {Object} Datos validados del formulario
 */
function obtenerDatosFormulario() {
    // Obtener valores de los campos
    const nombre = document.getElementById('nombre')?.value.trim() || '';
    const descripcion = document.getElementById('descripcion')?.value.trim() || '';
    const fechaStr = document.getElementById('fecha')?.value || '';
    const hora = document.getElementById('hora')?.value || '';
    const capacidadStr = document.getElementById('capacidad')?.value || '';
    const estado = document.getElementById('estado')?.value || 'Próximamente';
    
    // Obtener puntos (con diferentes selectores posibles)
    const puntos1 = document.querySelector('input[placeholder="5"]')?.value || 
                   document.getElementById('puntos1')?.value || 5;
    
    const puntos2 = document.querySelector('input[placeholder="3"]')?.value || 
                   document.getElementById('puntos2')?.value || 3;
    
    const puntos3 = document.querySelector('input[placeholder="1"]')?.value ||
                   document.getElementById('puntos3')?.value || 1;
    
    // Crear objeto de datos
    const datos = {
        nombre: nombre,
        descripcion: descripcion,
        estado: estado,
        puntosPosicion: {
            1: parseInt(puntos1) || 5,
            2: parseInt(puntos2) || 3,
            3: parseInt(puntos3) || 1
        }
    };
    
    // Convertir y añadir fecha si existe
    if (fechaStr) {
        try {
            const fechaObj = new Date(`${fechaStr}T${hora || '00:00'}`);
            datos.fecha = firebase.firestore.Timestamp.fromDate(fechaObj);
            datos.hora = hora || '00:00';
        } catch (e) {
            console.warn("Error al convertir fecha:", e);
            // No añadir fecha si hay error
        }
    }
    
    // Convertir y añadir capacidad si existe
    const capacidad = parseInt(capacidadStr);
    if (!isNaN(capacidad)) {
        datos.capacidad = capacidad;
    } else {
        datos.capacidad = null;
    }
    
    return datos;
}

/**
 * Valida los datos del formulario antes de enviar
 * @returns {boolean} true si los datos son válidos, false en caso contrario
 */
function validarFormulario() {
    const nombre = document.getElementById('nombre')?.value.trim();
    const fecha = document.getElementById('fecha')?.value;
    
    if (!nombre) {
        mostrarNotificacion("El nombre del torneo es obligatorio", "error");
        return false;
    }
    
    if (!fecha) {
        mostrarNotificacion("La fecha del torneo es obligatoria", "error");
        return false;
    }
    
    return true;
}

/**
 * Sube una imagen a Firebase Storage
 * @param {File} file - Archivo a subir
 * @param {string} path - Ruta dentro de Storage
 * @returns {Promise<string|null>} URL de la imagen o null si hay error
 */
async function subirImagen(file, path) {
    if (!file) return null;
    
    // Verificar que es una imagen
    if (!file.type.startsWith('image/')) {
        throw new Error("El archivo debe ser una imagen");
    }
    
    // Crear nombre único
    const nombreArchivo = `${Date.now()}_${file.name}`;
    const rutaCompleta = `${path}/${nombreArchivo}`;
    
    // Crear referencia en Storage
    const storageRef = firebase.storage().ref(rutaCompleta);
    
    // Subir archivo
    const snapshot = await storageRef.put(file);
    
    // Obtener URL
    const url = await snapshot.ref.getDownloadURL();
    
    return url;
}

/**
 * Elimina una imagen de Firebase Storage
 * @param {string} imageUrl - URL de la imagen a eliminar
 */
async function eliminarImagen(imageUrl) {
    if (!imageUrl) return;
    
    try {
        // Extraer ruta de la URL
        const urlPath = imageUrl.split('?')[0];
        const fileName = urlPath.split('/').pop();
        const storagePath = `torneos/${fileName}`;
        
        // Crear referencia y eliminar
        const imageRef = firebase.storage().ref(storagePath);
        await imageRef.delete();
        
        console.log("Imagen eliminada:", storagePath);
    } catch (error) {
        console.warn("Error al eliminar imagen:", error);
        // Continuar con la operación aunque falle la eliminación
    }
}

/**
 * Carga los badges asignados a un torneo
 * @param {string} torneoId - ID del torneo
 */
async function cargarBadgesTorneo(torneoId) {
    try {
        const badgesContainer = document.querySelector('.badges-container');
        if (!badgesContainer) return;
        
        // Obtener badges asignados al torneo
        const badgesSnapshot = await firebase.firestore().collection("tournament_badges")
            .where("tournamentId", "==", torneoId)
            .get();
        
        if (badgesSnapshot.empty) {
            badgesContainer.innerHTML = '<p class="text-sm text-gray-500">No hay badges asignados a este torneo.</p>';
            return;
        }
        
        // Limpiar contenedor
        badgesContainer.innerHTML = '';
        
        // Procesar cada badge asignado
        const badgePromises = [];
        badgesSnapshot.forEach(doc => {
            const assignment = doc.data();
            // Cargar detalles del badge
            const badgePromise = firebase.firestore().collection("badges")
                .doc(assignment.badgeId)
                .get()
                .then(badgeDoc => {
                    if (badgeDoc.exists) {
                        return {
                            assignmentId: doc.id,
                            position: assignment.position,
                            badge: {
                                id: badgeDoc.id,
                                ...badgeDoc.data()
                            }
                        };
                    }
                    return null;
                });
            
            badgePromises.push(badgePromise);
        });
        
        const badgeAssignments = (await Promise.all(badgePromises)).filter(badge => badge !== null);
        
        if (badgeAssignments.length === 0) {
            badgesContainer.innerHTML = '<p class="text-sm text-gray-500">No hay badges asignados a este torneo.</p>';
            return;
        }
        
        // Crear elementos HTML para cada badge
        badgeAssignments.forEach(assignment => {
            const badge = assignment.badge;
            const position = assignment.position;
            
            // Crear elemento
            const badgeElement = document.createElement('div');
            badgeElement.className = 'badge-item flex items-center p-2 bg-gray-100 rounded mb-2';
            
            // Traducir posición
            const positionText = {
                'first': '1° Lugar',
                'second': '2° Lugar',
                'third': '3° Lugar',
                'top3': 'Top 3',
                'all': 'Todos'
            }[position] || '1° Lugar';
            
            // HTML del badge
            badgeElement.innerHTML = `
                <div class="h-8 w-8 rounded-full mr-2 overflow-hidden flex items-center justify-center bg-gray-50">
                    ${badge.imageUrl ? 
                        `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-full h-full object-contain">` : 
                        `<div class="badge w-full h-full flex items-center justify-center" style="background-color: ${badge.color || '#ff6b1a'}">
                            <i class="fas fa-${badge.icono || 'trophy'} text-white"></i>
                        </div>`
                    }
                </div>
                <span class="flex-grow">${badge.nombre}</span>
                <select class="position-select px-2 py-1 text-sm border rounded mr-2">
                    <option value="first" ${position === 'first' ? 'selected' : ''}>1° Lugar</option>
                    <option value="second" ${position === 'second' ? 'selected' : ''}>2° Lugar</option>
                    <option value="third" ${position === 'third' ? 'selected' : ''}>3° Lugar</option>
                    <option value="top3" ${position === 'top3' ? 'selected' : ''}>Top 3</option>
                    <option value="all" ${position === 'all' ? 'selected' : ''}>Todos</option>
                </select>
                <button class="remove-badge-btn text-red-500 hover:text-red-700" title="Eliminar badge">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            badgesContainer.appendChild(badgeElement);
            
            // Configurar selector de posición
            const positionSelect = badgeElement.querySelector('.position-select');
            positionSelect.dataset.assignmentId = assignment.assignmentId;
            positionSelect.addEventListener('change', cambiarPosicionBadge);
            
            // Configurar botón de eliminar
            const removeBtn = badgeElement.querySelector('.remove-badge-btn');
            removeBtn.dataset.assignmentId = assignment.assignmentId;
            removeBtn.addEventListener('click', eliminarBadgeTorneo);
        });
        
    } catch (error) {
        console.error("Error al cargar badges del torneo:", error);
        const badgesContainer = document.querySelector('.badges-container');
        if (badgesContainer) {
            badgesContainer.innerHTML = '<p class="text-sm text-red-500">Error al cargar badges del torneo.</p>';
        }
    }
}

/**
 * Cambia la posición de un badge en un torneo
 * @param {Event} event - Evento de cambio
 */
async function cambiarPosicionBadge(event) {
    const select = event.target;
    const assignmentId = select.dataset.assignmentId;
    const newPosition = select.value;
    
    // Guardar posición original para posible rollback
    const originalPosition = select.getAttribute('data-original-position') || 
                             select.options[select.selectedIndex].value;
    
    try {
        // Actualizar posición en Firestore
        await firebase.firestore().collection("tournament_badges")
            .doc(assignmentId)
            .update({
                position: newPosition,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        // Guardar nueva posición como original
        select.setAttribute('data-original-position', newPosition);
        
        mostrarNotificacion("Posición actualizada correctamente", "success");
        
    } catch (error) {
        console.error("Error al cambiar posición del badge:", error);
        mostrarNotificacion("Error al actualizar posición", "error");
        
        // Revertir cambio en UI
        select.value = originalPosition;
    }
}

/**
 * Elimina un badge de un torneo
 * @param {Event} event - Evento de clic
 */
async function eliminarBadgeTorneo(event) {
    const button = event.target.closest('.remove-badge-btn');
    const assignmentId = button.dataset.assignmentId;
    const badgeItem = button.closest('.badge-item');
    
    try {
        // Mostrar estado de carga
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;
        
        // Eliminar asignación en Firestore
        await firebase.firestore().collection("tournament_badges")
            .doc(assignmentId)
            .delete();
        
        // Eliminar elemento del DOM
        badgeItem.remove();
        
        mostrarNotificacion("Badge eliminado correctamente", "success");
        
        // Si no quedan badges, mostrar mensaje
        const badgesContainer = document.querySelector('.badges-container');
        if (badgesContainer && !badgesContainer.querySelector('.badge-item')) {
            badgesContainer.innerHTML = '<p class="text-sm text-gray-500">No hay badges asignados a este torneo.</p>';
        }
        
    } catch (error) {
        console.error("Error al eliminar badge del torneo:", error);
        mostrarNotificacion("Error al eliminar badge", "error");
        
        // Restaurar botón
        button.innerHTML = '<i class="fas fa-times"></i>';
        button.disabled = false;
    }
}

/**
 * Configura los eventos para la vista previa de imágenes
 */
function configurarVistaPrevia() {
    const imagenInput = document.getElementById('imagen');
    if (!imagenInput) return;
    
    imagenInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Verificar que es una imagen
        if (!file.type.startsWith('image/')) {
            mostrarNotificacion("El archivo debe ser una imagen", "error");
            event.target.value = '';
            return;
        }
        
        // Crear vista previa
        const reader = new FileReader();
        reader.onload = function(e) {
            mostrarImagenPrevia(e.target.result);
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Muestra una imagen de vista previa
 * @param {string} url - URL de la imagen
 */
function mostrarImagenPrevia(url) {
    // Buscar contenedor de vista previa
    let previewContainer = document.querySelector('.vista-previa') || 
                          document.getElementById('vista-previa');
    
    // Si no existe, crear uno nuevo después del input de imagen
    if (!previewContainer) {
        const imagenInput = document.getElementById('imagen');
        if (!imagenInput) return;
        
        previewContainer = document.createElement('div');
        previewContainer.className = 'vista-previa mt-2';
        imagenInput.parentNode.appendChild(previewContainer);
    }
    
    // Establecer imagen
    previewContainer.innerHTML = `
        <p class="text-sm text-gray-600 mb-1">Vista previa:</p>
        <img src="${url}" alt="Vista previa" class="h-32 object-cover rounded">
    `;
}

/**
 * Configura los eventos para la gestión de badges
 */
function configurarGestionBadges() {
    const addBadgeBtn = document.querySelector('.anadirBadge') || 
                       document.getElementById('anadirBadge') ||
                       document.querySelector('[data-action="anadirBadge"]');
    
    if (addBadgeBtn) {
        addBadgeBtn.addEventListener('click', mostrarModalBadges);
    }
}

/**
 * Muestra el modal para selección de badges
 */
async function mostrarModalBadges() {
    try {
        // Verificar si existe un ID de torneo (para edición)
        const torneoId = obtenerTorneoId();
        if (!torneoId && !confirm("Debes guardar el torneo primero antes de poder asignar badges. ¿Deseas continuar sin asignar badges?")) {
            return;
        }
        
        // Crear modal si no existe
        let modal = document.getElementById('badgeSelectionModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'badgeSelectionModal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
            
            modal.innerHTML = `
                <div class="bg-white rounded-lg p-6 w-full max-w-md relative">
                    <button id="closeModalBtn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="text-center mb-4">
                        <h3 class="text-xl font-bold">Seleccionar Badge</h3>
                        <p class="text-gray-600 text-sm">Elige un badge para asignar al torneo</p>
                    </div>
                    
                    <div id="badgesList" class="grid grid-cols-2 gap-3 mb-4 max-h-60 overflow-y-auto">
                        <div class="col-span-2 text-center py-4">
                            <div class="spinner inline-block h-8 w-8 border-t-2 border-b-2 border-orange-500 rounded-full"></div>
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-semibold mb-2">Posición que recibe este badge:</label>
                        <select id="badgePosition" class="w-full border rounded p-2">
                            <option value="first">1° Lugar</option>
                            <option value="second">2° Lugar</option>
                            <option value="third">3° Lugar</option>
                            <option value="top3">Top 3</option>
                            <option value="all">Todos los participantes</option>
                        </select>
                    </div>
                    
                    <div class="text-center">
                        <button id="assignBadgeBtn" class="dtowin-primary text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50" disabled>
                            Asignar Badge
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Configurar botón de cerrar
            document.getElementById('closeModalBtn').addEventListener('click', function() {
                modal.classList.add('hidden');
            });
            
            // Configurar botón de asignar
            document.getElementById('assignBadgeBtn').addEventListener('click', asignarBadgeATorneo);
        }
        
        // Mostrar modal
        modal.classList.remove('hidden');
        
        // Cargar badges disponibles
        const badgesList = document.getElementById('badgesList');
        badgesList.innerHTML = `
            <div class="col-span-2 text-center py-4">
                <div class="spinner inline-block h-8 w-8 border-t-2 border-b-2 border-orange-500 rounded-full"></div>
            </div>
        `;
        
        // Obtener badges
        const badgesSnapshot = await firebase.firestore().collection("badges").get();
        
        if (badgesSnapshot.empty) {
            badgesList.innerHTML = '<p class="col-span-2 text-center text-gray-500 py-4">No hay badges disponibles. Crea un badge primero.</p>';
            return;
        }
        
        // Crear elementos para cada badge
        let badgesHTML = '';
        badgesSnapshot.forEach(doc => {
            const badge = doc.data();
            badgesHTML += `
                <div class="badge-option border rounded-lg p-3 flex flex-col items-center cursor-pointer hover:bg-gray-50" data-badge-id="${doc.id}">
                    <div class="h-12 w-12 mb-2 rounded-full overflow-hidden flex items-center justify-center bg-gray-50">
                        ${badge.imageUrl ? 
                            `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-full h-full object-contain">` : 
                            `<div class="badge w-full h-full flex items-center justify-center" style="background-color: ${badge.color || '#ff6b1a'}">
                                <i class="fas fa-${badge.icono || 'trophy'} text-white"></i>
                            </div>`
                        }
                    </div>
                    <span class="text-center font-medium text-sm">${badge.nombre}</span>
                </div>
            `;
        });
        
        badgesList.innerHTML = badgesHTML;
        
        // Configurar selección de badges
        const badgeOptions = document.querySelectorAll('.badge-option');
        badgeOptions.forEach(option => {
            option.addEventListener('click', function() {
                // Quitar selección anterior
                badgeOptions.forEach(opt => opt.classList.remove('ring-2', 'ring-orange-500'));
                
                // Añadir selección actual
                this.classList.add('ring-2', 'ring-orange-500');
                
                // Habilitar botón de asignar
                document.getElementById('assignBadgeBtn').disabled = false;
            });
        });
        
    } catch (error) {
        console.error("Error al mostrar modal de badges:", error);
        mostrarNotificacion("Error al cargar badges disponibles", "error");
    }
}

/**
 * Asigna un badge al torneo desde el modal
 */
async function asignarBadgeATorneo() {
    const badgeOption = document.querySelector('.badge-option.ring-2');
    if (!badgeOption) {
        mostrarNotificacion("Selecciona un badge primero", "warning");
        return;
    }
    
    const badgeId = badgeOption.dataset.badgeId;
    const position = document.getElementById('badgePosition').value;
    const torneoId = obtenerTorneoId();
    
    if (!torneoId) {
        mostrarNotificacion("Debes guardar el torneo primero para asignar badges", "warning");
        document.getElementById('badgeSelectionModal').classList.add('hidden');
        return;
    }
    
    const assignButton = document.getElementById('assignBadgeBtn');
    assignButton.disabled = true;
    assignButton.innerHTML = '<div class="spinner inline-block h-4 w-4 border-t-2 border-b-2 border-white rounded-full mr-2"></div> Asignando...';
    
    try {
        // Verificar si ya existe esta asignación
        const checkQuery = await firebase.firestore().collection("tournament_badges")
            .where("tournamentId", "==", torneoId)
            .where("badgeId", "==", badgeId)
            .where("position", "==", position)
            .get();
        
        if (!checkQuery.empty) {
            mostrarNotificacion("Este badge ya está asignado para esa posición", "warning");
            assignButton.disabled = false;
            assignButton.textContent = "Asignar Badge";
            return;
        }
        
        // Crear asignación
        await firebase.firestore().collection("tournament_badges").add({
            tournamentId: torneoId,
            badgeId: badgeId,
            position: position,
            createdBy: firebase.auth().currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Cerrar modal
        document.getElementById('badgeSelectionModal').classList.add('hidden');
        
        // Recargar badges del torneo
        await cargarBadgesTorneo(torneoId);
        
        mostrarNotificacion("Badge asignado correctamente", "success");
        
    } catch (error) {
        console.error("Error al asignar badge:", error);
        mostrarNotificacion("Error al asignar badge: " + error.message, "error");
        
    } finally {
        // Restaurar botón
        assignButton.disabled = false;
        assignButton.textContent = "Asignar Badge";
    }
}

/**
 * Muestra un indicador de carga
 * @param {string} mensaje - Mensaje a mostrar
 */
function mostrarCargando(mensaje = "Cargando...") {
    // Verificar si ya existe un elemento de carga
    let loadingElement = document.getElementById('loading-indicator');
    
    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.id = 'loading-indicator';
        loadingElement.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        
        loadingElement.innerHTML = `
            <div class="bg-white p-4 rounded-lg shadow-lg text-center">
                <div class="spinner inline-block h-8 w-8 border-t-2 border-b-2 border-orange-500 rounded-full mb-2"></div>
                <p id="loading-message" class="text-gray-700">${mensaje}</p>
            </div>
        `;
        
        document.body.appendChild(loadingElement);
    } else {
        document.getElementById('loading-message').textContent = mensaje;
        loadingElement.classList.remove('hidden');
    }
}

/**
 * Oculta el indicador de carga
 */
function ocultarCargando() {
    const loadingElement = document.getElementById('loading-indicator');
    if (loadingElement) {
        loadingElement.classList.add('hidden');
    }
}

/**
 * Muestra una notificación al usuario
 * @param {string} mensaje - Mensaje a mostrar
 * @param {string} tipo - Tipo de notificación: success, error, warning, info
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
    // Eliminar notificación existente
    const notificacionExistente = document.querySelector('.notification');
    if (notificacionExistente) {
        notificacionExistente.remove();
    }
    
    // Configurar colores según tipo
    const colores = {
        'success': 'bg-green-500',
        'error': 'bg-red-500',
        'warning': 'bg-yellow-500',
        'info': 'bg-blue-500'
    };
    
    const iconos = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    
    // Crear notificación
    const notificacion = document.createElement('div');
    notificacion.className = `notification fixed top-4 right-4 ${colores[tipo]} text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center`;
    notificacion.innerHTML = `
        <i class="fas fa-${iconos[tipo]} mr-2"></i>
        <span>${mensaje}</span>
    `;
    
    // Añadir al DOM
    document.body.appendChild(notificacion);
    
    // Eliminar después de 3 segundos
    setTimeout(() => {
        notificacion.classList.add('opacity-0');
        notificacion.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            notificacion.remove();
        }, 500);
    }, 3000);
}

/**
 * Formatea una fecha para uso en input type="date"
 * @param {Date} fecha - Fecha a formatear
 * @returns {string} Fecha formateada como YYYY-MM-DD
 */
function formatearFecha(fecha) {
    if (!fecha) return '';
    
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// Exportar funciones para uso en consola de desarrollo
window.torneosManager = {
    crearTorneo,
    actualizarTorneo,
    cargarDatosTorneo,
    cargarBadgesTorneo,
    mostrarNotificacion
};
