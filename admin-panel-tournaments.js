// admin-panel-tournaments.js - Script específico para la gestión de torneos en el panel de administración
import { auth, isUserHost, db } from './firebase.js';
import { getAllBadges, assignBadgeToTournament, removeBadgeFromTournament, getTournamentBadges } from './badges.js';
import { showNotification } from './admin-panel.js';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

// Variables y elementos DOM
const torneosContainer = document.getElementById('torneosContainer');
const createTournamentForm = document.getElementById('createTournamentForm');
const headerCreateTournamentButton = document.querySelector('button.dtowin-primary');

// Inicializar la gestión de torneos
export async function initTournamentsManagement() {
  try {
    // Verificar si el usuario es host
    const userIsHost = await isUserHost();
    
    if (!userIsHost) {
      showNotification("No tienes permisos para gestionar torneos", "error");
      return;
    }
    
    // Añadir listener al botón de crear en la cabecera si existe
    if (headerCreateTournamentButton) {
      headerCreateTournamentButton.addEventListener('click', function() {
        // Mostrar formulario de creación de torneo si está oculto
        const formSection = createTournamentForm?.closest('.bg-gray-50');
        if (formSection && formSection.classList.contains('hidden')) {
          formSection.classList.remove('hidden');
        }
        // Hacer scroll al formulario
        if (createTournamentForm) {
          createTournamentForm.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
    
    // Cargar torneos existentes
    await loadTournaments();
    
    // Configurar formulario de creación/edición de torneos
    setupTournamentForm();
    
  } catch (error) {
    console.error("Error al inicializar gestión de torneos:", error);
    showNotification("Error al cargar la gestión de torneos. Inténtalo de nuevo.", "error");
  }
}

// Función para cargar todos los torneos
export async function loadTournaments() {
  try {
    if (!torneosContainer) {
      console.log("No se encontró el contenedor de torneos");
      return;
    }
    
    // Mostrar indicador de carga
    torneosContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
    
    // Obtener torneos
    const tournamentsCollection = collection(db, "torneos");
    const tournamentsSnapshot = await getDocs(tournamentsCollection);
    
    // Si no hay torneos
    if (tournamentsSnapshot.empty) {
      torneosContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No hay torneos disponibles. Crea el primer torneo.</p>';
      return;
    }
    
    // Crear tabla de torneos
    let torneosHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white">
          <thead>
            <tr class="bg-gray-100 text-gray-600 uppercase text-sm">
              <th class="py-3 px-4 text-left">Nombre</th>
              <th class="py-3 px-4 text-left">Fecha</th>
              <th class="py-3 px-4 text-left">Inscritos</th>
              <th class="py-3 px-4 text-left">Estado</th>
              <th class="py-3 px-4 text-left">Visibilidad</th>
              <th class="py-3 px-4 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody class="text-gray-600">
    `;
    
    // Formatear datos de torneos
    const torneos = tournamentsSnapshot.docs.map(doc => {
      return { id: doc.id, ...doc.data() };
    });
    
    // Ordenar por fecha (más próximos primero)
    torneos.sort((a, b) => {
      const dateA = a.fecha ? new Date(a.fecha.seconds * 1000) : new Date();
      const dateB = b.fecha ? new Date(b.fecha.seconds * 1000) : new Date();
      return dateA - dateB;
    });
    
    // Añadir filas para cada torneo
    for (const torneo of torneos) {
      // Formatear fecha
      const fecha = torneo.fecha ? new Date(torneo.fecha.seconds * 1000) : new Date();
      const fechaFormateada = `${fecha.getDate()} de ${getMonthName(fecha.getMonth())}, ${fecha.getFullYear()}`;
      
      // Formatear estado con colores
      let estadoHTML = '';
      switch(torneo.estado) {
        case 'Abierto':
          estadoHTML = '<span class="bg-green-100 text-green-600 py-1 px-2 rounded text-xs">Abierto</span>';
          break;
        case 'Próximo':
        case 'Próximamente':
          estadoHTML = '<span class="bg-yellow-100 text-yellow-600 py-1 px-2 rounded text-xs">Próximo</span>';
          break;
        case 'En Progreso':
          estadoHTML = '<span class="bg-blue-100 text-blue-600 py-1 px-2 rounded text-xs">En Progreso</span>';
          break;
        case 'Finalizado':
          estadoHTML = '<span class="bg-gray-100 text-gray-600 py-1 px-2 rounded text-xs">Finalizado</span>';
          break;
        case 'Badge Especial':
          estadoHTML = '<span class="bg-purple-100 text-purple-600 py-1 px-2 rounded text-xs">Badge Especial</span>';
          break;
        default:
          estadoHTML = `<span class="bg-gray-100 text-gray-600 py-1 px-2 rounded text-xs">${torneo.estado || 'N/A'}</span>`;
      }
      
      // Calcular inscritos
      const inscritos = torneo.participants ? torneo.participants.length : 0;
      const capacidad = torneo.capacidad || '∞';
      
      // Visibilidad
      const visibilidad = torneo.visible === false ? 
        '<span class="text-red-500"><i class="fas fa-eye-slash"></i> Oculto</span>' : 
        '<span class="text-green-500"><i class="fas fa-eye"></i> Visible</span>';
      
      // Añadir fila a la tabla
      torneosHTML += `
        <tr class="border-b hover:bg-gray-50" data-torneo-id="${torneo.id}">
          <td class="py-3 px-4">${torneo.nombre || 'Sin nombre'}</td>
          <td class="py-3 px-4">${fechaFormateada}</td>
          <td class="py-3 px-4">${inscritos} / ${capacidad}</td>
          <td class="py-3 px-4">${estadoHTML}</td>
          <td class="py-3 px-4">${visibilidad}</td>
          <td class="py-3 px-4">
            <button class="text-blue-500 hover:text-blue-700 mr-2 toggle-visibility-btn">
              <i class="fas fa-eye${torneo.visible === false ? '-slash' : ''}"></i>
            </button>
            <button class="text-orange-500 hover:text-orange-700 mr-2 edit-tournament-btn">
              <i class="fas fa-edit"></i>
            </button>
            <button class="text-red-500 hover:text-red-700 delete-tournament-btn">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }
    
    torneosHTML += `
          </tbody>
        </table>
      </div>
    `;
    
    torneosContainer.innerHTML = torneosHTML;
    
    // Añadir event listeners para botones de acciones
    addTournamentEventListeners();
    
  } catch (error) {
    console.error("Error al cargar torneos:", error);
    torneosContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar torneos. Inténtalo de nuevo.</p>';
  }
}

// Función para añadir event listeners a los botones de torneos
function addTournamentEventListeners() {
  // Botones de visibilidad
  document.querySelectorAll('.toggle-visibility-btn').forEach(button => {
    button.addEventListener('click', async function() {
      const row = this.closest('[data-torneo-id]');
      const tournamentId = row.dataset.torneoId;
      
      try {
        // Obtener datos actuales
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
          showNotification("No se encontró el torneo", "error");
          return;
        }
        
        const tournamentData = tournamentSnap.data();
        const newVisibility = tournamentData.visible === false ? true : false;
        
        // Actualizar visibilidad
        await updateDoc(tournamentRef, {
          visible: newVisibility
        });
        
        // Actualizar UI
        const icon = this.querySelector('i');
        if (newVisibility) {
          icon.className = 'fas fa-eye';
          row.querySelector('td:nth-child(5)').innerHTML = '<span class="text-green-500"><i class="fas fa-eye"></i> Visible</span>';
        } else {
          icon.className = 'fas fa-eye-slash';
          row.querySelector('td:nth-child(5)').innerHTML = '<span class="text-red-500"><i class="fas fa-eye-slash"></i> Oculto</span>';
        }
        
        showNotification(`Torneo ${newVisibility ? 'visible' : 'oculto'} correctamente`, "success");
        
      } catch (error) {
        console.error("Error al cambiar visibilidad:", error);
        showNotification("Error al cambiar visibilidad del torneo", "error");
      }
    });
  });
  
  // Botones de editar
  document.querySelectorAll('.edit-tournament-btn').forEach(button => {
    button.addEventListener('click', async function() {
      const tournamentId = this.closest('[data-torneo-id]').dataset.torneoId;
      
      try {
        await loadTournamentForEdit(tournamentId);
      } catch (error) {
        console.error("Error al cargar torneo para editar:", error);
        showNotification("Error al cargar torneo para editar", "error");
      }
    });
  });
  
  // Botones de eliminar
  document.querySelectorAll('.delete-tournament-btn').forEach(button => {
    button.addEventListener('click', async function() {
      const row = this.closest('[data-torneo-id]');
      const tournamentId = row.dataset.torneoId;
      const tournamentName = row.querySelector('td:first-child').textContent;
      
      if (confirm(`¿Estás seguro que deseas eliminar el torneo "${tournamentName}"?`)) {
        try {
          await deleteTournament(tournamentId);
          row.remove();
          showNotification("Torneo eliminado correctamente", "success");
        } catch (error) {
          console.error("Error al eliminar torneo:", error);
          showNotification(error.message || "Error al eliminar torneo", "error");
        }
      }
    });
  });
}

// Función para cargar un torneo para edición
async function loadTournamentForEdit(tournamentId) {
  if (!createTournamentForm) {
    console.error("No se encontró el formulario de torneos");
    return;
  }
  
  try {
    // Obtener datos del torneo
    const tournamentRef = doc(db, "torneos", tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (!tournamentSnap.exists()) {
      throw new Error("No se encontró el torneo para editar");
    }
    
    const tournamentData = tournamentSnap.data();
    
    // Llenar el formulario con los datos del torneo
    const nombreInput = createTournamentForm.querySelector('#nombre');
    const fechaInput = createTournamentForm.querySelector('#fecha');
    const horaInput = createTournamentForm.querySelector('#hora');
    const capacidadInput = createTournamentForm.querySelector('#capacidad');
    const estadoSelect = createTournamentForm.querySelector('#estado');
    const descripcionInput = createTournamentForm.querySelector('#descripcion');
    const submitButton = createTournamentForm.querySelector('button[type="submit"]');
    
    if (nombreInput) nombreInput.value = tournamentData.nombre || '';
    
    // Formatear fecha y hora si existen
    if (fechaInput && tournamentData.fecha) {
      const fecha = new Date(tournamentData.fecha.seconds * 1000);
      const year = fecha.getFullYear();
      const month = String(fecha.getMonth() + 1).padStart(2, '0');
      const day = String(fecha.getDate()).padStart(2, '0');
      fechaInput.value = `${year}-${month}-${day}`;
    }
    
    if (horaInput && tournamentData.hora) {
      horaInput.value = tournamentData.hora;
    }
    
    if (capacidadInput) capacidadInput.value = tournamentData.capacidad || '';
    if (estadoSelect) {
      // Buscar o crear la opción correspondiente
      let optionExists = false;
      for (const option of estadoSelect.options) {
        if (option.value === tournamentData.estado) {
          option.selected = true;
          optionExists = true;
          break;
        }
      }
      
      if (!optionExists && tournamentData.estado) {
        const newOption = new Option(tournamentData.estado, tournamentData.estado);
        estadoSelect.add(newOption);
        newOption.selected = true;
      }
    }
    
    if (descripcionInput) descripcionInput.value = tournamentData.descripcion || '';
    
    // Configurar puntos por posición
    const puntosInputs = createTournamentForm.querySelectorAll('input[type="number"][min="0"]');
    if (puntosInputs.length > 0 && tournamentData.puntosPosicion) {
      Object.entries(tournamentData.puntosPosicion).forEach(([posicion, puntos]) => {
        const index = parseInt(posicion) - 1;
        if (index >= 0 && index < puntosInputs.length) {
          puntosInputs[index].value = puntos;
        }
      });
    }
    
    // Mostrar imagen actual si existe
    if (tournamentData.imageUrl) {
      const imagenPreview = document.createElement('div');
      imagenPreview.className = 'mt-2';
      imagenPreview.innerHTML = `
        <p class="text-sm text-gray-500">Imagen actual:</p>
        <img src="${tournamentData.imageUrl}" alt="Preview" class="h-32 object-cover rounded mt-1">
      `;
      
      const imagenInput = createTournamentForm.querySelector('#imagen');
      if (imagenInput) {
        imagenInput.parentNode.appendChild(imagenPreview);
      }
    }
    
    // Cargar los badges asignados a este torneo
    await loadTournamentBadges(tournamentId);
    
    // Cambiar el botón de "Crear Torneo" a "Actualizar Torneo"
    if (submitButton) {
      submitButton.textContent = 'Actualizar Torneo';
      submitButton.dataset.editMode = 'true';
      submitButton.dataset.tournamentId = tournamentId;
    }
    
    // Mostrar formulario si está oculto
    const formSection = createTournamentForm.closest('.bg-gray-50');
    if (formSection && formSection.classList.contains('hidden')) {
      formSection.classList.remove('hidden');
    }
    
    // Hacer scroll al formulario
    createTournamentForm.scrollIntoView({ behavior: 'smooth' });
    
  } catch (error) {
    console.error("Error al cargar torneo para editar:", error);
    throw error;
  }
}

// Función para cargar los badges asociados a un torneo
async function loadTournamentBadges(tournamentId) {
  try {
    const badgesContainer = document.querySelector('.badges-container');
    if (!badgesContainer) {
      console.log("No se encontró el contenedor de badges del torneo");
      return;
    }
    
    // Limpiar contenedor
    badgesContainer.innerHTML = '';
    
    // Obtener badges del torneo
    const tournamentBadges = await getTournamentBadges(tournamentId);
    
    // Mostrar badges
    if (tournamentBadges.length === 0) {
      badgesContainer.innerHTML = '<p class="text-sm text-gray-500">No hay badges asignados a este torneo.</p>';
      return;
    }
    
    // Crear elementos para cada badge
    tournamentBadges.forEach(badgeAssignment => {
      const badge = badgeAssignment.badge;
      const position = badgeAssignment.position;
      
      const badgeElement = document.createElement('div');
      badgeElement.className = 'bg-gray-100 p-2 rounded-lg flex items-center mb-2';
      badgeElement.innerHTML = `
        <div class="h-8 w-8 rounded-full mr-2 overflow-hidden flex items-center justify-center bg-gray-50">
          ${badge.imageUrl ? 
            `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-full h-full object-contain">` : 
            `<div class="badge w-full h-full flex items-center justify-center" style="background-color: ${badge.color}">
              <i class="fas fa-${badge.icono || 'trophy'} text-white"></i>
            </div>`
          }
        </div>
        <span class="mr-4">${badge.nombre}</span>
        <select class="text-sm border rounded px-2 py-1 position-select" data-assignment-id="${badgeAssignment.id}">
          <option value="first" ${position === 'first' ? 'selected' : ''}>1° Lugar</option>
          <option value="second" ${position === 'second' ? 'selected' : ''}>2° Lugar</option>
          <option value="third" ${position === 'third' ? 'selected' : ''}>3° Lugar</option>
          <option value="top3" ${position === 'top3' ? 'selected' : ''}>Top 3</option>
          <option value="all" ${position === 'all' ? 'selected' : ''}>Todos</option>
        </select>
        <button class="text-red-500 hover:text-red-700 ml-2 remove-badge-btn" data-assignment-id="${badgeAssignment.id}">
          <i class="fas fa-times"></i>
        </button>
      `;
      
      badgesContainer.appendChild(badgeElement);
    });
    
    // Añadir event listeners a los selectores de posición
    document.querySelectorAll('.position-select').forEach(select => {
      select.addEventListener('change', async function() {
        const assignmentId = this.dataset.assignmentId;
        const newPosition = this.value;
        
        try {
          // Actualizar posición en la base de datos
          const assignmentRef = doc(db, "tournament_badges", assignmentId);
          await updateDoc(assignmentRef, {
            position: newPosition
          });
          
          showNotification("Posición actualizada correctamente", "success");
        } catch (error) {
          console.error("Error al actualizar posición:", error);
          showNotification("Error al actualizar posición", "error");
          // Revertir cambio en el select
          this.value = this.getAttribute('data-original-value') || 'first';
        }
      });
    });
    
    // Añadir event listeners a los botones de eliminar
    document.querySelectorAll('.remove-badge-btn').forEach(button => {
      button.addEventListener('click', async function() {
        const assignmentId = this.dataset.assignmentId;
        
        try {
          // Eliminar asignación en la base de datos
          await removeBadgeFromTournament(assignmentId);
          // Eliminar elemento del DOM
          this.closest('.bg-gray-100').remove();
          showNotification("Badge removido correctamente", "success");
        } catch (error) {
          console.error("Error al eliminar badge del torneo:", error);
          showNotification("Error al eliminar badge del torneo", "error");
        }
      });
    });
    
  } catch (error) {
    console.error("Error al cargar badges del torneo:", error);
    showNotification("Error al cargar badges del torneo", "error");
  }
}

// Función para configurar el formulario de torneos
function setupTournamentForm() {
  if (!createTournamentForm) {
    console.log("No se encontró el formulario de torneos");
    return;
  }
  
  // Añadir badge al torneo
  const addBadgeButton = createTournamentForm.querySelector('button.dtowin-blue');
  if (addBadgeButton) {
    addBadgeButton.addEventListener('click', async function(e) {
      e.preventDefault();
      
      try {
        // Mostrar modal de selección de badges
        await showBadgeSelectionModal();
      } catch (error) {
        console.error("Error al mostrar modal de badges:", error);
        showNotification("Error al cargar badges disponibles", "error");
      }
    });
  }
  
  // Manejar envío del formulario (crear/actualizar torneo)
  createTournamentForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Obtener datos del formulario
    const nombre = createTournamentForm.querySelector('#nombre')?.value.trim();
    const fecha = createTournamentForm.querySelector('#fecha')?.value;
    const hora = createTournamentForm.querySelector('#hora')?.value;
    const capacidad = createTournamentForm.querySelector('#capacidad')?.value;
    const estado = createTournamentForm.querySelector('#estado')?.value;
    const descripcion = createTournamentForm.querySelector('#descripcion')?.value.trim();
    const imagenInput = createTournamentForm.querySelector('#imagen');
    const submitButton = createTournamentForm.querySelector('button[type="submit"]');
    
    // Validaciones básicas
    if (!nombre) {
      showNotification("El nombre del torneo es obligatorio", "error");
      return;
    }
    
    if (!fecha) {
      showNotification("La fecha del torneo es obligatoria", "error");
      return;
    }
    
    // Recopilar puntos por posición
    const puntosPosicion = {};
    const puntosInputs = createTournamentForm.querySelectorAll('input[type="number"][min="0"]');
    puntosInputs.forEach((input, index) => {
      puntosPosicion[index + 1] = parseInt(input.value) || 0;
    });
    
    // Verificar si estamos en modo edición
    const isEditMode = submitButton.dataset.editMode === 'true';
    const tournamentId = isEditMode ? submitButton.dataset.tournamentId : null;
    
    try {
      // Archivo de imagen (si se seleccionó)
      let imageFile = null;
      if (imagenInput && imagenInput.files.length > 0) {
        imageFile = imagenInput.files[0];
      }
      
      // Preparar datos del torneo
      const tournamentData = {
        nombre,
        descripcion,
        capacidad: parseInt(capacidad) || null,
        estado,
        puntosPosicion,
        updatedAt: serverTimestamp()
      };
      
      // Convertir fecha y hora a timestamp
      if (fecha) {
        // Formato de fecha YYYY-MM-DD y hora HH:MM
        const fechaHora = new Date(`${fecha}T${hora || '00:00'}`);
        tournamentData.fecha = fechaHora;
        tournamentData.hora = hora || '00:00';
      }
      
      // Indicador de proceso
      submitButton.disabled = true;
      submitButton.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Procesando...';
      
      if (isEditMode) {
        // Actualizar torneo existente
        await updateTournament(tournamentId, tournamentData, imageFile);
        showNotification("Torneo actualizado correctamente", "success");
      } else {
        // Crear nuevo torneo
        await createTournament(tournamentData, imageFile);
        showNotification("Torneo creado correctamente", "success");
      }
      
      // Resetear formulario
      createTournamentForm.reset();
      submitButton.textContent = 'Crear Torneo';
      submitButton.dataset.editMode = 'false';
      delete submitButton.dataset.tournamentId;
      
      // Eliminar previews
      const previews = createTournamentForm.querySelectorAll('.mt-2');
      previews.forEach(preview => preview.remove());
      
      // Limpiar contenedor de badges
      const badgesContainer = document.querySelector('.badges-container');
      if (badgesContainer) {
        badgesContainer.innerHTML = '';
      }
      
      // Recargar lista de torneos
      await loadTournaments();
      
    } catch (error) {
      console.error("Error al procesar torneo:", error);
      showNotification(error.message || "Error al procesar el torneo", "error");
    } finally {
      // Restaurar botón
      submitButton.disabled = false;
      submitButton.textContent = isEditMode ? 'Actualizar Torneo' : 'Crear Torneo';
    }
  });
  
  // Vista previa de imagen
  const imagenInput = createTournamentForm.querySelector('#imagen');
  if (imagenInput) {
    imagenInput.addEventListener('change', function() {
      // Eliminar preview anterior
      const prevPreview = this.parentNode.querySelector('.mt-2');
      if (prevPreview) prevPreview.remove();
      
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
          const imagenPreview = document.createElement('div');
          imagenPreview.className = 'mt-2';
          imagenPreview.innerHTML = `
            <p class="text-sm text-gray-500">Vista previa:</p>
            <img src="${e.target.result}" alt="Preview" class="h-32 object-cover rounded mt-1">
          `;
          
          imagenInput.parentNode.appendChild(imagenPreview);
        }
        
        reader.readAsDataURL(this.files[0]);
      }
    });
  }
}

// Función para mostrar modal de selección de badges
async function showBadgeSelectionModal() {
  try {
    // Crear modal si no existe
    let modalContainer = document.getElementById('badgeSelectionModal');
    
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'badgeSelectionModal';
      modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 hidden';
      
      // Crear contenido del modal
      modalContainer.innerHTML = `
        <div class="bg-white rounded-xl max-w-md w-full p-6 relative">
          <button id="closeBadgeModal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
            <i class="fas fa-times"></i>
          </button>
          <div class="text-center mb-6">
            <h3 class="text-2xl font-bold text-gray-800">Seleccionar Badge</h3>
            <p class="text-gray-600">Elige un badge para asignar al torneo</p>
          </div>
          
          <div id="badgesList" class="grid grid-cols-2 gap-3 mb-6">
            <div class="flex justify-center">
              <div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
            </div>
          </div>
          
          <div class="flex flex-col">
            <label class="block text-gray-700 text-sm font-bold mb-2">
              Posición que recibe este badge:
            </label>
            <select id="badgePosition" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline">
              <option value="first">1° Lugar</option>
              <option value="second">2° Lugar</option>
              <option value="third">3° Lugar</option>
              <option value="top3">Top 3</option>
              <option value="all">Todos los participantes</option>
            </select>
          </div>
          
          <div class="text-center mt-4">
            <button id="assignBadgeButton" class="dtowin-primary text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition" disabled>
              Asignar Badge
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modalContainer);
      
      // Event listener para cerrar el modal
      document.getElementById('closeBadgeModal').addEventListener('click', function() {
        modalContainer.classList.add('hidden');
      });
    }
    
    // Mostrar modal
    modalContainer.classList.remove('hidden');
    
    // Cargar badges disponibles
    const badgesList = document.getElementById('badgesList');
    const badges = await getAllBadges();
    
    // Si no hay badges
    if (!badges || badges.length === 0) {
      badgesList.innerHTML = '<p class="col-span-2 text-center text-gray-500">No hay badges disponibles. Crea un badge primero.</p>';
      return;
    }
    
    // Mostrar badges
    let badgesHTML = '';
    
    badges.forEach(badge => {
      badgesHTML += `
        <div class="border rounded-lg p-3 flex flex-col items-center cursor-pointer hover:bg-gray-50 badge-option" data-badge-id="${badge.id}">
          <div class="h-16 w-16 mb-2 rounded-full overflow-hidden flex items-center justify-center bg-gray-50">
            ${badge.imageUrl ? 
              `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-full h-full object-contain">` : 
              `<div class="badge w-full h-full flex items-center justify-center" style="background-color: ${badge.color}">
                <i class="fas fa-${badge.icono || 'trophy'} text-white"></i>
              </div>`
            }
          </div>
          <p class="font-semibold text-center">${badge.nombre}</p>
        </div>
      `;
    });
    
    badgesList.innerHTML = badgesHTML;
    
    // Event listeners para selección de badges
    let selectedBadgeId = null;
    
    document.querySelectorAll('.badge-option').forEach(badgeElement => {
      badgeElement.addEventListener('click', function() {
        // Quitar selección anterior
        document.querySelectorAll('.badge-option').forEach(el => el.classList.remove('ring-2', 'ring-orange-500'));
        
        // Añadir selección
        this.classList.add('ring-2', 'ring-orange-500');
        selectedBadgeId = this.dataset.badgeId;
        
        // Habilitar botón de asignar
        document.getElementById('assignBadgeButton').disabled = false;
      });
    });
    
    // Event listener para botón de asignar
    document.getElementById('assignBadgeButton').addEventListener('click', async function() {
      if (!selectedBadgeId) return;
      
      const position = document.getElementById('badgePosition').value;
      const submitButton = document.querySelector('button[type="submit"]');
      const tournamentId = submitButton.dataset.tournamentId;
      
      try {
        // Si no hay ID de torneo, es un torneo nuevo y aún no podemos asignar badges
        if (!tournamentId) {
          showNotification("Guarda el torneo primero antes de asignar badges", "warning");
          modalContainer.classList.add('hidden');
          return;
        }
        
        // Asignar badge al torneo
        const result = await assignBadgeToTournament(selectedBadgeId, tournamentId, position);
        
        if (result.success) {
          showNotification("Badge asignado correctamente", "success");
          
          // Recargar badges del torneo
          await loadTournamentBadges(tournamentId);
          
          // Cerrar modal
          modalContainer.classList.add('hidden');
        } else {
          throw new Error(result.message || "Error al asignar badge");
        }
      } catch (error) {
        console.error("Error al asignar badge:", error);
        showNotification(error.message || "Error al asignar badge", "error");
      }
    });
  } catch (error) {
    console.error("Error al mostrar modal de badges:", error);
    throw error;
  }
}

// Función para crear un nuevo torneo
async function createTournament(tournamentData, imageFile) {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error("Debes iniciar sesión para crear un torneo");
    }
    
    // Verificar si el usuario es host
    const userIsHost = await isUserHost();
    
    if (!userIsHost) {
      throw new Error("Solo el host puede crear torneos");
    }
    
    // Subir imagen del torneo si existe
    let imageUrl = null;
    if (imageFile) {
      // Verificar que sea un archivo de imagen
      if (!imageFile.type.startsWith('image/')) {
        throw new Error("El archivo debe ser una imagen");
      }
      
      // Referencia única para el archivo en Storage
      const storageRef = ref(storage, `torneos/${Date.now()}_${imageFile.name}`);
      
      try {
        // Subir el archivo
        await uploadBytes(storageRef, imageFile);
        
        // Obtener la URL de descarga
        imageUrl = await getDownloadURL(storageRef);
        console.log("Imagen subida correctamente:", imageUrl);
      } catch (uploadError) {
        console.error("Error al subir la imagen:", uploadError);
        throw new Error("Error al subir la imagen. Verifica tu conexión e inténtalo de nuevo.");
      }
    }
    
    // Añadir campos adicionales
    tournamentData.imageUrl = imageUrl;
    tournamentData.createdBy = user.uid;
    tournamentData.createdAt = serverTimestamp();
    tournamentData.participants = [];
    tournamentData.visible = true; // Visible por defecto
    
    // Añadir torneo a Firestore
    const tournamentRef = await addDoc(collection(db, "torneos"), tournamentData);
    
    return {
      id: tournamentRef.id,
      success: true,
      message: "Torneo creado correctamente"
    };
  } catch (error) {
    console.error("Error al crear torneo:", error);
    throw error;
  }
}

// Función para actualizar un torneo existente
async function updateTournament(tournamentId, tournamentData, imageFile) {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error("Debes iniciar sesión para actualizar un torneo");
    }
    
    // Verificar si el usuario es host
    const userIsHost = await isUserHost();
    
    if (!userIsHost) {
      throw new Error("Solo el host puede actualizar torneos");
    }
    
    // Obtener referencia al torneo
    const tournamentRef = doc(db, "torneos", tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (!tournamentSnap.exists()) {
      throw new Error("El torneo no existe");
    }
    
    const tournamentActual = tournamentSnap.data();
    
    // Si hay una nueva imagen, subir y actualizar URL
    if (imageFile) {
      // Verificar que sea un archivo de imagen
      if (!imageFile.type.startsWith('image/')) {
        throw new Error("El archivo debe ser una imagen");
      }
      
      // Si el torneo tenía una imagen previa, intentar eliminarla
      if (tournamentActual.imageUrl) {
        try {
          // Extraer la ruta del archivo de la URL
          const urlPath = tournamentActual.imageUrl.split('?')[0]; // Eliminar query params
          const fileName = urlPath.split('/').pop(); // Obtener el nombre del archivo
          const storagePath = `torneos/${fileName}`;
          
          // Crear referencia al archivo en Storage
          const oldImageRef = ref(storage, storagePath);
          
          // Eliminar el archivo
          await deleteObject(oldImageRef);
          console.log("Imagen anterior eliminada:", storagePath);
        } catch (deleteError) {
          console.warn("No se pudo eliminar la imagen anterior:", deleteError);
          // Continuamos con la actualización aunque falle la eliminación
        }
      }
      
      // Subir la nueva imagen
      try {
        const storageRef = ref(storage, `torneos/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        tournamentData.imageUrl = await getDownloadURL(storageRef);
        console.log("Nueva imagen subida correctamente:", tournamentData.imageUrl);
      } catch (uploadError) {
        console.error("Error al subir la nueva imagen:", uploadError);
        throw new Error("Error al subir la imagen. Verifica tu conexión e inténtalo de nuevo.");
      }
    } else {
      // Mantener la URL de imagen existente
      tournamentData.imageUrl = tournamentActual.imageUrl;
    }
    
    // Mantener otros campos que no se deben modificar
    tournamentData.createdBy = tournamentActual.createdBy;
    tournamentData.createdAt = tournamentActual.createdAt;
    tournamentData.participants = tournamentActual.participants || [];
    tournamentData.visible = tournamentActual.visible !== false; // Mantener visibilidad actual
    
    // Actualizar el documento en Firestore
    await updateDoc(tournamentRef, tournamentData);
    
    return {
      id: tournamentId,
      success: true,
      message: "Torneo actualizado correctamente"
    };
  } catch (error) {
    console.error("Error al actualizar torneo:", error);
    throw error;
  }
}

// Función para eliminar un torneo
async function deleteTournament(tournamentId) {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error("Debes iniciar sesión para eliminar un torneo");
    }
    
    // Verificar si el usuario es host
    const userIsHost = await isUserHost();
    
    if (!userIsHost) {
      throw new Error("Solo el host puede eliminar torneos");
    }
    
    // Obtener el torneo para verificar si tiene imagen
    const tournamentRef = doc(db, "torneos", tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (!tournamentSnap.exists()) {
      throw new Error("El torneo no existe");
    }
    
    const tournamentData = tournamentSnap.data();
    
    // Si tiene imagen, eliminarla del storage
    if (tournamentData.imageUrl) {
      try {
        // Extraer la ruta del archivo de la URL
        const urlPath = tournamentData.imageUrl.split('?')[0]; // Eliminar query params
        const fileName = urlPath.split('/').pop(); // Obtener el nombre del archivo
        const storagePath = `torneos/${fileName}`;
        
        // Crear referencia al archivo en Storage
        const imageRef = ref(storage, storagePath);
        
        // Eliminar el archivo
        await deleteObject(imageRef);
        console.log("Imagen del torneo eliminada:", storagePath);
      } catch (deleteImageError) {
        console.error("Error al eliminar la imagen del torneo:", deleteImageError);
        // Continuamos con la eliminación del torneo aunque falle la eliminación de la imagen
      }
    }
    
    // Eliminar badges asociados al torneo
    const tournamentBadgesCollection = collection(db, "tournament_badges");
    const q = query(tournamentBadgesCollection, where("tournamentId", "==", tournamentId));
    const badgesSnapshot = await getDocs(q);
    
    if (!badgesSnapshot.empty) {
      // Eliminar cada asignación de badge
      for (const badgeDoc of badgesSnapshot.docs) {
        await deleteDoc(doc(db, "tournament_badges", badgeDoc.id));
      }
      console.log(`Se eliminaron ${badgesSnapshot.size} badges asociados al torneo`);
    }
    
    // Eliminar resultados asociados al torneo (si existe una colección de resultados)
    try {
      const resultsCollection = collection(db, "resultados");
      const resultsQuery = query(resultsCollection, where("tournamentId", "==", tournamentId));
      const resultsSnapshot = await getDocs(resultsQuery);
      
      if (!resultsSnapshot.empty) {
        for (const resultDoc of resultsSnapshot.docs) {
          await deleteDoc(doc(db, "resultados", resultDoc.id));
        }
        console.log(`Se eliminaron ${resultsSnapshot.size} resultados asociados al torneo`);
      }
    } catch (error) {
      console.warn("Error o no existe la colección de resultados:", error);
    }
    
    // Eliminar el torneo de Firestore
    await deleteDoc(tournamentRef);
    
    return {
      success: true,
      message: "Torneo eliminado correctamente"
    };
  } catch (error) {
    console.error("Error al eliminar torneo:", error);
    throw error;
  }
}

// Función para obtener nombre del mes
function getMonthName(month) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[month];
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initTournamentsManagement);

// Exportar funciones
export {
  loadTournaments,
  initTournamentsManagement
};
