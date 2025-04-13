// admin-panel-results.js - Script para la gestión de resultados de torneos
import { auth, isUserHost, db } from './firebase.js';
import { getAllBadges, getTournamentBadges, assignBadgeToUser } from './badges.js';
import { showNotification } from './admin-panel.js';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Elementos DOM
const tourneoSelect = document.getElementById('tourneoSelect');
const resultadosContainer = document.getElementById('resultadosContainer');
const historialContainer = document.getElementById('historialResultados');
const guardarResultadosBtn = document.querySelector('.guardar-resultados-btn');

// Inicializar la gestión de resultados
export async function initResultsManagement() {
  try {
    // Verificar si el usuario es host
    const userIsHost = await isUserHost();
    
    if (!userIsHost) {
      showNotification("No tienes permisos para gestionar resultados", "error");
      return;
    }
    
    // Cargar lista de torneos en el selector
    await loadTournamentsForSelect();
    
    // Configurar event listeners
    if (tourneoSelect) {
      tourneoSelect.addEventListener('change', loadResultsForm);
    }
    
    if (guardarResultadosBtn) {
      guardarResultadosBtn.addEventListener('click', saveResults);
    }
    
    // Cargar historial de resultados
    await loadResultsHistory();
    
  } catch (error) {
    console.error("Error al inicializar gestión de resultados:", error);
    showNotification("Error al cargar gestión de resultados. Inténtalo de nuevo.", "error");
  }
}

// Cargar torneos en el selector
async function loadTournamentsForSelect() {
  try {
    if (!tourneoSelect) {
      console.log("No se encontró el selector de torneos");
      return;
    }
    
    // Mostrar mensaje de carga
    tourneoSelect.innerHTML = '<option value="">Cargando torneos...</option>';
    
    // Obtener torneos
    const tournamentsCollection = collection(db, "torneos");
    const tournamentsSnapshot = await getDocs(tournamentsCollection);
    
    // Limpiar selector
    tourneoSelect.innerHTML = '<option value="">Seleccionar Torneo</option>';
    
    // Si no hay torneos
    if (tournamentsSnapshot.empty) {
      tourneoSelect.innerHTML += '<option value="" disabled>No hay torneos disponibles</option>';
      return;
    }
    
    // Ordenar torneos por fecha (más recientes primero)
    const torneos = tournamentsSnapshot.docs.map(doc => {
      return { id: doc.id, ...doc.data() };
    });
    
    torneos.sort((a, b) => {
      const dateA = a.fecha ? new Date(a.fecha.seconds * 1000) : new Date();
      const dateB = b.fecha ? new Date(b.fecha.seconds * 1000) : new Date();
      return dateB - dateA; // Orden descendente
    });
    
    // Añadir opciones al selector
    torneos.forEach(torneo => {
      const option = document.createElement('option');
      option.value = torneo.id;
      option.textContent = torneo.nombre || 'Torneo sin nombre';
      tourneoSelect.appendChild(option);
    });
    
  } catch (error) {
    console.error("Error al cargar torneos para el selector:", error);
    tourneoSelect.innerHTML = '<option value="">Error al cargar torneos</option>';
  }
}

// Cargar formulario de resultados para el torneo seleccionado
async function loadResultsForm() {
  try {
    if (!resultadosContainer) {
      console.log("No se encontró el contenedor de resultados");
      return;
    }
    
    const tournamentId = tourneoSelect.value;
    
    if (!tournamentId) {
      resultadosContainer.innerHTML = '<p class="text-center text-gray-600 py-4">Selecciona un torneo para registrar resultados.</p>';
      return;
    }
    
    // Mostrar indicador de carga
    resultadosContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
    
    // Obtener datos del torneo
    const tournamentRef = doc(db, "torneos", tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (!tournamentSnap.exists()) {
      resultadosContainer.innerHTML = '<p class="text-center text-red-500 py-4">No se encontró el torneo seleccionado.</p>';
      return;
    }
    
    const tournamentData = tournamentSnap.data();
    
    // Verificar si el torneo ya tiene resultados
    const resultsCollection = collection(db, "resultados");
    const resultsQuery = query(resultsCollection, where("tournamentId", "==", tournamentId));
    const resultsSnapshot = await getDocs(resultsQuery);
    
    let existingResults = null;
    if (!resultsSnapshot.empty) {
      existingResults = resultsSnapshot.docs[0].data();
      existingResults.id = resultsSnapshot.docs[0].id;
    }
    
    // Obtener participantes del torneo
    const participants = tournamentData.participants || [];
    
    // Obtener datos de usuarios
    const usersCollection = collection(db, "usuarios");
    let participantsData = [];
    
    if (participants.length > 0) {
      // Consultar cada usuario individualmente
      for (const userId of participants) {
        const userQuery = query(usersCollection, where("uid", "==", userId));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          participantsData.push({
            id: userData.uid,
            nombre: userData.nombre || 'Usuario',
            photoURL: userData.photoURL || ''
          });
        }
      }
    }
    
    // Obtener badges del torneo
    const tournamentBadges = await getTournamentBadges(tournamentId);
    
    // Crear formulario de resultados
    let formHTML = `
      <h3 class="font-semibold text-lg mb-4">Registrar Resultados - ${tournamentData.nombre || 'Torneo'}</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white mb-4">
          <thead>
            <tr class="bg-gray-100 text-gray-600 uppercase text-sm">
              <th class="py-3 px-4 text-left">Posición</th>
              <th class="py-3 px-4 text-left">Participante</th>
              <th class="py-3 px-4 text-left">Puntos a Asignar</th>
              <th class="py-3 px-4 text-left">Badges</th>
              <th class="py-3 px-4 text-left">Estado</th>
            </tr>
          </thead>
          <tbody class="text-gray-600">
    `;
    
    // Determinar número de posiciones a mostrar (depende de los puntos configurados)
    let numPositions = 3; // Mínimo 3 posiciones
    if (tournamentData.puntosPosicion) {
      numPositions = Object.keys(tournamentData.puntosPosicion).length;
    }
    
    // Crear filas para cada posición
    for (let i = 1; i <= numPositions; i++) {
      const puntos = tournamentData.puntosPosicion?.[i] || 0;
      
      // Determinar participante seleccionado previamente
      let selectedParticipantId = '';
      if (existingResults && existingResults.positions && existingResults.positions[i]) {
        selectedParticipantId = existingResults.positions[i].userId;
      }
      
      // Crear selector de participantes
      let participantsSelectHTML = `
        <select class="border rounded py-1 px-2 participant-select" data-position="${i}">
          <option value="">Seleccionar Participante</option>
      `;
      
      // Añadir opciones de participantes
      participantsData.forEach(participant => {
        participantsSelectHTML += `
          <option value="${participant.id}" ${participant.id === selectedParticipantId ? 'selected' : ''}>
            ${participant.nombre}
          </option>
        `;
      });
      
      participantsSelectHTML += '</select>';
      
      // Crear selector de badges
      let badgesHTML = '<div class="flex items-center">';
      
      // Determinar badges asignados previamente
      let assignedBadges = [];
      if (existingResults && existingResults.positions && existingResults.positions[i]) {
        assignedBadges = existingResults.positions[i].badges || [];
      }
      
      // Añadir badges que corresponden a esta posición
      const positionMapping = {
        1: 'first',
        2: 'second',
        3: 'third'
      };
      
      const positionKey = positionMapping[i] || 'other';
      const eligibleBadges = tournamentBadges.filter(badgeAssignment => {
        const position = badgeAssignment.position;
        return position === positionKey || position === 'all' || 
               (position === 'top3' && i <= 3);
      });
      
      if (eligibleBadges.length > 0) {
        eligibleBadges.forEach(badgeAssignment => {
          const badge = badgeAssignment.badge;
          const isAssigned = assignedBadges.includes(badge.id);
          
          badgesHTML += `
            <div class="mr-2">
              <input type="checkbox" class="badge-checkbox" 
                id="badge_${i}_${badge.id}" 
                data-badge-id="${badge.id}" 
                data-position="${i}"
                ${isAssigned ? 'checked' : ''}>
              <label for="badge_${i}_${badge.id}" class="ml-1 cursor-pointer">
                <div class="h-8 w-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-50">
                  ${badge.imageUrl ? 
                    `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="w-full h-full object-contain">` : 
                    `<div class="badge w-full h-full flex items-center justify-center" style="background-color: ${badge.color}">
                      <i class="fas fa-${badge.icono || 'trophy'} text-white"></i>
                    </div>`
                  }
                </div>
              </label>
            </div>
          `;
        });
      } else {
        badgesHTML += '<span class="text-gray-400">No hay badges para esta posición</span>';
      }
      
      badgesHTML += '</div>';
      
      // Estado (pendiente o asignado)
      const estado = selectedParticipantId ? 
        '<span class="bg-green-100 text-green-600 py-1 px-2 rounded text-xs">Asignado</span>' :
        '<span class="bg-gray-100 text-gray-600 py-1 px-2 rounded text-xs">Pendiente</span>';
      
      // Añadir fila a la tabla
      formHTML += `
        <tr class="border-b hover:bg-gray-50" data-position="${i}">
          <td class="py-3 px-4 font-bold">${i}°</td>
          <td class="py-3 px-4">
            <div class="flex items-center">
              <img src="${selectedParticipantId ? (participantsData.find(p => p.id === selectedParticipantId)?.photoURL || 'https://via.placeholder.com/40') : 'https://via.placeholder.com/40'}" 
                alt="User" class="w-8 h-8 rounded-full mr-3 participant-photo">
              ${participantsSelectHTML}
            </div>
          </td>
          <td class="py-3 px-4">
            <input type="number" value="${puntos}" class="border rounded w-16 py-1 px-2 points-input" data-position="${i}" min="0">
          </td>
          <td class="py-3 px-4">
            ${badgesHTML}
          </td>
          <td class="py-3 px-4 status-cell">
            ${estado}
          </td>
        </tr>
      `;
    }
    
    formHTML += `
          </tbody>
        </table>
      </div>
      <div class="mt-4 flex justify-end">
        <button class="dtowin-primary text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition guardar-resultados-btn">
          ${existingResults ? 'Actualizar Resultados' : 'Guardar Resultados'}
        </button>
      </div>
    `;
    
    resultadosContainer.innerHTML = formHTML;
    
    // Event listeners para cambios en selección de participantes
    document.querySelectorAll('.participant-select').forEach(select => {
      select.addEventListener('change', function() {
        // Actualizar foto del participante
        const position = this.dataset.position;
        const userId = this.value;
        const row = document.querySelector(`tr[data-position="${position}"]`);
        const photoElement = row.querySelector('.participant-photo');
        const statusCell = row.querySelector('.status-cell');
        
        if (userId) {
          const participant = participantsData.find(p => p.id === userId);
          if (participant) {
            photoElement.src = participant.photoURL || 'https://via.placeholder.com/40';
          }
          statusCell.innerHTML = '<span class="bg-green-100 text-green-600 py-1 px-2 rounded text-xs">Asignado</span>';
        } else {
          photoElement.src = 'https://via.placeholder.com/40';
          statusCell.innerHTML = '<span class="bg-gray-100 text-gray-600 py-1 px-2 rounded text-xs">Pendiente</span>';
        }
      });
    });
    
    // Si ya existe un registro de resultados, actualizar el botón
    if (existingResults) {
      const guardarBtn = resultadosContainer.querySelector('.guardar-resultados-btn');
      if (guardarBtn) {
        guardarBtn.dataset.resultId = existingResults.id;
        guardarBtn.textContent = 'Actualizar Resultados';
      }
    }
    
  } catch (error) {
    console.error("Error al cargar formulario de resultados:", error);
    resultadosContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar formulario de resultados. Inténtalo de nuevo.</p>';
  }
}

// Guardar o actualizar resultados
async function saveResults() {
  try {
    const tournamentId = tourneoSelect.value;
    
    if (!tournamentId) {
      showNotification("Selecciona un torneo primero", "error");
      return;
    }
    
    // Obtener datos del formulario
    const positions = {};
    const positionRows = document.querySelectorAll('tr[data-position]');
    
    // Verificar si hay cambios (para puntos)
    const pointsUpdates = [];
    
    // Verificar si hay un resultado existente
    const guardarBtn = document.querySelector('.guardar-resultados-btn');
    const resultId = guardarBtn.dataset.resultId;
    let existingPositions = {};
    
    if (resultId) {
      // Obtener datos existentes
      const resultRef = doc(db, "resultados", resultId);
      const resultSnap = await getDoc(resultRef);
      
      if (resultSnap.exists()) {
        existingPositions = resultSnap.data().positions || {};
      }
    }
    
    // Recopilar datos de cada posición
    for (const row of positionRows) {
      const position = row.dataset.position;
      const participantSelect = row.querySelector('.participant-select');
      const pointsInput = row.querySelector('.points-input');
      const badgeCheckboxes = row.querySelectorAll('.badge-checkbox');
      
      const userId = participantSelect.value;
      const points = parseInt(pointsInput.value) || 0;
      
      // Recopilar badges seleccionados
      const selectedBadges = [];
      badgeCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
          selectedBadges.push(checkbox.dataset.badgeId);
        }
      });
      
      // Si hay un participante seleccionado, añadir a las posiciones
      if (userId) {
        positions[position] = {
          userId,
          points,
          badges: selectedBadges
        };
        
        // Verificar cambios en puntos para actualizar al usuario
        if (existingPositions[position]) {
          // Si hay cambio de usuario o puntos
          if (existingPositions[position].userId !== userId) {
            // Restar puntos al usuario anterior
            if (existingPositions[position].userId) {
              pointsUpdates.push({
                userId: existingPositions[position].userId,
                points: -existingPositions[position].points
              });
            }
            // Añadir puntos al nuevo usuario
            pointsUpdates.push({
              userId,
              points
            });
          } else if (existingPositions[position].points !== points) {
            // Si es el mismo usuario pero cambiaron los puntos
            pointsUpdates.push({
              userId,
              points: points - existingPositions[position].points
            });
          }
        } else {
          // Nueva posición, añadir puntos
          pointsUpdates.push({
            userId,
            points
          });
        }
      }
    }
    
    // Verificar posiciones eliminadas para restar puntos
    for (const [position, data] of Object.entries(existingPositions)) {
      if (!positions[position] && data.userId) {
        pointsUpdates.push({
          userId: data.userId,
          points: -data.points
        });
      }
    }
    
    // Preparar datos para guardar
    const resultsData = {
      tournamentId,
      positions,
      updatedBy: auth.currentUser.uid,
      updatedAt: serverTimestamp()
    };
    
    // Si tiene ID, actualizar, si no, crear nuevo
    if (resultId) {
      // Actualizar documento existente
      const resultRef = doc(db, "resultados", resultId);
      await updateDoc(resultRef, resultsData);
    } else {
      // Crear nuevo documento
      resultsData.createdBy = auth.currentUser.uid;
      resultsData.createdAt = serverTimestamp();
      
      const resultRef = await addDoc(collection(db, "resultados"), resultsData);
      
      // Actualizar botón con ID del resultado
      guardarBtn.dataset.resultId = resultRef.id;
      guardarBtn.textContent = 'Actualizar Resultados';
    }
    
    // Actualizar puntos de los usuarios
    await updateUserPoints(pointsUpdates);
    
    // Asignar badges a los usuarios
    await assignBadgesToUsers(positions);
    
    // Recargar historial de resultados
    await loadResultsHistory();
    
    showNotification("Resultados guardados correctamente", "success");
    
  } catch (error) {
    console.error("Error al guardar resultados:", error);
    showNotification(error.message || "Error al guardar resultados", "error");
  }
}

// Actualizar puntos de los usuarios
async function updateUserPoints(pointsUpdates) {
  try {
    // Agrupar por usuario para evitar múltiples actualizaciones
    const userPoints = {};
    
    pointsUpdates.forEach(update => {
      if (!userPoints[update.userId]) {
        userPoints[update.userId] = 0;
      }
      userPoints[update.userId] += update.points;
    });
    
    // Actualizar cada usuario
    for (const [userId, points] of Object.entries(userPoints)) {
      if (points === 0) continue; // No hay cambio neto
      
      // Buscar el documento del usuario
      const usersCollection = collection(db, "usuarios");
      const userQuery = query(usersCollection, where("uid", "==", userId));
      const userSnapshot = await getDocs(userQuery);
      
      if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        await updateDoc(doc(db, "usuarios", userDoc.id), {
          puntos: increment(points)
        });
        
        console.log(`Actualizado usuario ${userId} con ${points > 0 ? '+' : ''}${points} puntos`);
      }
    }
    
  } catch (error) {
    console.error("Error al actualizar puntos de usuarios:", error);
    throw error;
  }
}

// Asignar badges a los usuarios
async function assignBadgesToUsers(positions) {
  try {
    for (const [position, data] of Object.entries(positions)) {
      if (!data.userId || !data.badges || data.badges.length === 0) continue;
      
      // Asignar cada badge al usuario
      for (const badgeId of data.badges) {
        try {
          await assignBadgeToUser(badgeId, data.userId);
        } catch (error) {
          console.error(`Error al asignar badge ${badgeId} a usuario ${data.userId}:`, error);
          // Continuar con otros badges
        }
      }
    }
  } catch (error) {
    console.error("Error al asignar badges a usuarios:", error);
    // No lanzar error para que no bloquee el guardado de resultados
  }
}

// Cargar historial de resultados
async function loadResultsHistory() {
  try {
    if (!historialContainer) {
      console.log("No se encontró el contenedor de historial");
      return;
    }
    
    // Mostrar indicador de carga
    historialContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
    
    // Obtener resultados
    const resultsCollection = collection(db, "resultados");
    const resultsSnapshot = await getDocs(resultsCollection);
    
    // Si no hay resultados
    if (resultsSnapshot.empty) {
      historialContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No hay resultados registrados.</p>';
      return;
    }
    
    // Crear tabla de historial
    let historialHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white">
          <thead>
            <tr class="bg-gray-100 text-gray-600 uppercase text-sm">
              <th class="py-3 px-4 text-left">Torneo</th>
              <th class="py-3 px-4 text-left">Fecha</th>
              <th class="py-3 px-4 text-left">Participantes</th>
              <th class="py-3 px-4 text-left">Ganador</th>
              <th class="py-3 px-4 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody class="text-gray-600">
    `;
    
    // Obtener datos de los resultados
    const results = resultsSnapshot.docs.map(doc => {
      return { id: doc.id, ...doc.data() };
    });
    
    // Ordenar por fecha (más recientes primero)
    results.sort((a, b) => {
      const dateA = a.updatedAt || a.createdAt;
      const dateB = b.updatedAt || b.createdAt;
      
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      return dateB.seconds - dateA.seconds;
    });
    
    // Obtener información de torneos y ganadores
    const tourneosInfo = {};
    const ganadoresInfo = {};
    
    // Obtener IDs de torneos y ganadores
    const tournamentIds = new Set();
    const ganadorIds = new Set();
    
    results.forEach(result => {
      tournamentIds.add(result.tournamentId);
      
      // Añadir ID del ganador (posición 1)
      if (result.positions && result.positions['1']) {
        ganadorIds.add(result.positions['1'].userId);
      }
    });
    
    // Obtener información de torneos
    for (const tournamentId of tournamentIds) {
      const tournamentRef = doc(db, "torneos", tournamentId);
      const tournamentSnap = await getDoc(tournamentRef);
      
      if (tournamentSnap.exists()) {
        tourneosInfo[tournamentId] = tournamentSnap.data();
      }
    }
    
    // Obtener información de ganadores
    const usersCollection = collection(db, "usuarios");
    for (const userId of ganadorIds) {
      const userQuery = query(usersCollection, where("uid", "==", userId));
      const userSnapshot = await getDocs(userQuery);
      
      if (!userSnapshot.empty) {
        ganadoresInfo[userId] = userSnapshot.docs[0].data();
      }
    }
    
    // Crear filas para cada resultado
    for (const result of results) {
      // Obtener información del torneo
      const torneo = tourneosInfo[result.tournamentId] || {};
      
      // Formatear fecha
      const fecha = result.updatedAt || result.createdAt;
      let fechaFormateada = 'N/A';
      
      if (fecha) {
        const dateObj = new Date(fecha.seconds * 1000);
        fechaFormateada = `${dateObj.getDate()} de ${getMonthName(dateObj.getMonth())}, ${dateObj.getFullYear()}`;
      }
      
      // Obtener información del ganador
      let ganadorHTML = '<span class="text-gray-400">Sin ganador</span>';
      
      if (result.positions && result.positions['1']) {
        const ganadorId = result.positions['1'].userId;
        const ganador = ganadoresInfo[ganadorId] || {};
        
        ganadorHTML = `
          <div class="flex items-center">
            <img src="${ganador.photoURL || 'https://via.placeholder.com/40'}" alt="User" class="w-6 h-6 rounded-full mr-2">
            <span>${ganador.nombre || 'Usuario'}</span>
          </div>
        `;
      }
      
      // Contar participantes con resultados
      const numParticipantes = Object.keys(result.positions || {}).length;
      
      // Añadir fila a la tabla
      historialHTML += `
        <tr class="border-b hover:bg-gray-50" data-result-id="${result.id}">
          <td class="py-3 px-4">${torneo.nombre || 'Torneo desconocido'}</td>
          <td class="py-3 px-4">${fechaFormateada}</td>
          <td class="py-3 px-4">${numParticipantes}</td>
          <td class="py-3 px-4">${ganadorHTML}</td>
          <td class="py-3 px-4">
            <button class="text-blue-500 hover:text-blue-700 mr-2 view-result-btn" data-tournament-id="${result.tournamentId}">
              <i class="fas fa-eye"></i>
            </button>
          </td>
        </tr>
      `;
    }
    
    historialHTML += `
          </tbody>
        </table>
      </div>
    `;
    
    historialContainer.innerHTML = historialHTML;
    
    // Añadir event listeners para ver resultado
    document.querySelectorAll('.view-result-btn').forEach(button => {
      button.addEventListener('click', function() {
        const tournamentId = this.dataset.tournamentId;
        
        // Seleccionar el torneo en el selector
        if (tourneoSelect) {
          tourneoSelect.value = tournamentId;
          // Disparar evento change para cargar el formulario
          tourneoSelect.dispatchEvent(new Event('change'));
        }
      });
    });
    
  } catch (error) {
    console.error("Error al cargar historial de resultados:", error);
    historialContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar historial de resultados. Inténtalo de nuevo.</p>';
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
document.addEventListener('DOMContentLoaded', initResultsManagement);

// Exportar funciones
export {
  initResultsManagement
};
