// Enhanced version of admin-panel-tournaments.js
import { auth, isUserHost, db, storage } from './firebase.js';
import { getAllBadges, assignBadgeToTournament, removeBadgeFromTournament, getTournamentBadges } from './badges.js';
import { showNotification } from './admin-panel.js';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

// DOM elements
const torneosContainer = document.getElementById('torneosContainer');
const tournamentFormSection = document.getElementById('tournamentFormSection');
const createTournamentForm = document.getElementById('createTournamentForm');
const headerCreateTournamentBtn = document.getElementById('headerCreateTournamentBtn');
const formTitle = document.getElementById('formTitle');
const cancelButton = document.getElementById('cancelButton');
const submitButton = document.getElementById('submitButton');

// Initialize tournament management
export async function initTournamentsManagement() {
    try {
        // Check if user is host/admin
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            showNotification("No tienes permisos para gestionar torneos", "error");
            return;
        }
        
        // Set up event listeners
        setupEventListeners();
        
        // Load existing tournaments
        await loadTournaments();
        
    } catch (error) {
        console.error("Error al inicializar gestión de torneos:", error);
        showNotification("Error al cargar la gestión de torneos. Inténtalo de nuevo.", "error");
    }
}

// Set up event listeners
function setupEventListeners() {
    // Create tournament button
    if (headerCreateTournamentBtn) {
        headerCreateTournamentBtn.addEventListener('click', () => {
            resetForm();
            showForm();
        });
    }
    
    // Cancel button
    if (cancelButton) {
        cancelButton.addEventListener('click', hideForm);
    }
    
    // Form submission
    if (createTournamentForm) {
        createTournamentForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Add badge button
    const addBadgeButton = document.querySelector('.dtowin-blue');
    if (addBadgeButton) {
        addBadgeButton.addEventListener('click', showBadgeSelectionModal);
    }
    
    // Image preview
    const imagenInput = document.getElementById('imagen');
    if (imagenInput) {
        imagenInput.addEventListener('change', handleImagePreview);
    }
}

// Reset the form to its initial state
function resetForm() {
    if (createTournamentForm) {
        createTournamentForm.reset();
        
        // Reset button text and mode
        if (submitButton) {
            submitButton.textContent = 'Crear Torneo';
            submitButton.dataset.editMode = 'false';
            delete submitButton.dataset.tournamentId;
        }
        
        // Reset form title
        if (formTitle) {
            formTitle.textContent = 'Crear Nuevo Torneo';
        }
        
        // Clear image preview
        const previews = createTournamentForm.querySelectorAll('.image-preview');
        previews.forEach(preview => preview.remove());
        
        // Clear badges container
        const badgesContainer = document.querySelector('.badges-container');
        if (badgesContainer) {
            badgesContainer.innerHTML = '<p class="text-sm text-gray-500">No hay badges asignados a este torneo.</p>';
        }
    }
}

// Show the tournament form
function showForm() {
    if (tournamentFormSection) {
        tournamentFormSection.classList.remove('hidden');
        // Scroll to form
        tournamentFormSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Hide the tournament form
function hideForm() {
    if (tournamentFormSection) {
        tournamentFormSection.classList.add('hidden');
    }
}

// Handle image preview
function handleImagePreview(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
        showNotification("El archivo debe ser una imagen", "error");
        event.target.value = '';
        return;
    }
    
    // Verificar tamaño de archivo (opcional, máximo 2MB)
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
        showNotification("La imagen es demasiado grande. El tamaño máximo es 2MB", "warning");
        // Continuar de todos modos, pero advertir al usuario
    }
    
    // Remove any existing preview
    const container = event.target.parentElement;
    const existingPreview = container.querySelector('.image-preview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // Create preview element
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview mt-2';
        previewDiv.innerHTML = `
            <p class="text-sm text-gray-600">Vista previa:</p>
            <img src="${e.target.result}" alt="Vista previa" class="h-32 object-cover rounded mt-1">
            <p class="text-xs text-gray-500">${file.name} (${(file.size / 1024).toFixed(1)} KB)</p>
        `;
        container.appendChild(previewDiv);
    };
    
    reader.onerror = function() {
        showNotification("Error al generar la vista previa", "error");
    };
    
    reader.readAsDataURL(file);
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    // Get form data
    const nombre = document.getElementById('nombre').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const fecha = document.getElementById('fecha').value;
    const hora = document.getElementById('hora').value;
    const capacidad = document.getElementById('capacidad').value;
    const estado = document.getElementById('estado').value;
    const imagenInput = document.getElementById('imagen');
    
    // Form validation
    if (!nombre) {
        showNotification("El nombre del torneo es obligatorio", "error");
        return;
    }
    
    if (!fecha) {
        showNotification("La fecha del torneo es obligatoria", "error");
        return;
    }
    
    // Verificar que la imagen sea válida
    const imageFile = imagenInput && imagenInput.files.length > 0 ? imagenInput.files[0] : null;
    if (imageFile && !imageFile.type.startsWith('image/')) {
        showNotification("El archivo debe ser una imagen válida", "error");
        return;
    }
    
    // Get points by position
    const puntosPosicion = {};
    const puntosInputs = document.querySelectorAll('input[type="number"][min="0"]');
    puntosInputs.forEach((input, index) => {
        if (index > 0) { // Skip capacity input
            puntosPosicion[index] = parseInt(input.value) || 0;
        }
    });
    
    // Check if we're in edit mode
    const isEditMode = submitButton.dataset.editMode === 'true';
    const tournamentId = submitButton.dataset.tournamentId;
    
    // Show loading state
    submitButton.disabled = true;
    const originalButtonText = submitButton.textContent;
    submitButton.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Procesando...';
    
    try {
        // Prepare tournament data
        const tournamentData = {
            nombre,
            descripcion,
            capacidad: parseInt(capacidad) || null,
            estado,
            puntosPosicion,
        };
        
        // Convert date and time to timestamp
        if (fecha) {
            const fechaHora = new Date(`${fecha}T${hora || '00:00'}`);
            tournamentData.fecha = fechaHora;
            tournamentData.hora = hora || '00:00';
        }
        
        let result;
        
        if (isEditMode && tournamentId) {
            // Update existing tournament
            result = await updateTournament(tournamentId, tournamentData, imageFile);
            showNotification("Torneo actualizado correctamente", "success");
        } else {
            // Create new tournament
            result = await createTournament(tournamentData, imageFile);
            showNotification("Torneo creado correctamente", "success");
        }
        
        // Reset form and hide
        resetForm();
        hideForm();
        
        // Reload tournaments list
        await loadTournaments();
        
    } catch (error) {
        console.error("Error al procesar torneo:", error);
        showNotification(error.message || "Error al procesar el torneo", "error");
    } finally {
        // Restore button
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

// Load and display tournaments
export async function loadTournaments() {
    try {
        if (!torneosContainer) {
            console.log("No se encontró el contenedor de torneos");
            return;
        }
        
        // Show loading spinner
        torneosContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
        
        // Get tournaments from Firestore
        const tournamentsCollection = collection(db, "torneos");
        const tournamentsSnapshot = await getDocs(tournamentsCollection);
        
        // Check if we have tournaments
        if (tournamentsSnapshot.empty) {
            torneosContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No hay torneos disponibles. Crea el primer torneo.</p>';
            return;
        }
        
        // Convert to array and sort by date
        const torneos = [];
        tournamentsSnapshot.forEach(doc => {
            torneos.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort by date (most recent first)
        torneos.sort((a, b) => {
            const dateA = a.fecha ? new Date(a.fecha.seconds * 1000) : new Date();
            const dateB = b.fecha ? new Date(b.fecha.seconds * 1000) : new Date();
            return dateA - dateB;
        });
        
        // Create table HTML
        let html = `
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
        
        // Add rows for each tournament
        torneos.forEach(torneo => {
            // Format date
            const fecha = torneo.fecha ? new Date(torneo.fecha.seconds * 1000) : new Date();
            const fechaFormateada = `${fecha.getDate()} de ${getMonthName(fecha.getMonth())}, ${fecha.getFullYear()}`;
            
            // Format status with colors
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
            
            // Calculate registrations
            const inscritos = torneo.participants ? torneo.participants.length : 0;
            const capacidad = torneo.capacidad || '∞';
            
            // Visibility
            const visibilidad = torneo.visible === false ? 
                '<span class="text-red-500"><i class="fas fa-eye-slash"></i> Oculto</span>' : 
                '<span class="text-green-500"><i class="fas fa-eye"></i> Visible</span>';
            
            // Add row to table
            html += `
                <tr class="border-b hover:bg-gray-50" data-torneo-id="${torneo.id}">
                    <td class="py-3 px-4">${torneo.nombre || 'Sin nombre'}</td>
                    <td class="py-3 px-4">${fechaFormateada}</td>
                    <td class="py-3 px-4">${inscritos} / ${capacidad}</td>
                    <td class="py-3 px-4">${estadoHTML}</td>
                    <td class="py-3 px-4">${visibilidad}</td>
                    <td class="py-3 px-4">
                        <button class="text-blue-500 hover:text-blue-700 mr-2 toggle-visibility-btn" title="Cambiar visibilidad">
                            <i class="fas fa-eye${torneo.visible === false ? '-slash' : ''}"></i>
                        </button>
                        <button class="text-orange-500 hover:text-orange-700 mr-2 edit-tournament-btn" title="Editar torneo">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="text-red-500 hover:text-red-700 delete-tournament-btn" title="Eliminar torneo">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        torneosContainer.innerHTML = html;
        
        // Add event listeners to action buttons
        addTournamentEventListeners();
        
    } catch (error) {
        console.error("Error al cargar torneos:", error);
        torneosContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar torneos. Inténtalo de nuevo.</p>';
    }
}

// Add event listeners to tournament cards
function addTournamentEventListeners() {
    // Visibility toggle buttons
    document.querySelectorAll('.toggle-visibility-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const row = this.closest('[data-torneo-id]');
            const tournamentId = row.dataset.torneoId;
            
            try {
                // Get current data
                const tournamentRef = doc(db, "torneos", tournamentId);
                const tournamentSnap = await getDoc(tournamentRef);
                
                if (!tournamentSnap.exists()) {
                    showNotification("No se encontró el torneo", "error");
                    return;
                }
                
                const tournamentData = tournamentSnap.data();
                const newVisibility = tournamentData.visible === false ? true : false;
                
                // Update visibility
                await updateDoc(tournamentRef, {
                    visible: newVisibility,
                    updatedAt: serverTimestamp()
                });
                
                // Update UI
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
    
    // Edit buttons
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
    
    // Delete buttons
    document.querySelectorAll('.delete-tournament-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const row = this.closest('[data-torneo-id]');
            const tournamentId = row.dataset.torneoId;
            const tournamentName = row.querySelector('td:first-child').textContent;
            
            if (confirm(`¿Estás seguro que deseas eliminar el torneo "${tournamentName}"?`)) {
                try {
                    // Show a loading indicator
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    this.disabled = true;
                    
                    await deleteTournament(tournamentId);
                    
                    // Remove row from table
                    row.remove();
                    
                    showNotification("Torneo eliminado correctamente", "success");
                    
                    // If no tournaments left, update message
                    if (document.querySelectorAll('[data-torneo-id]').length === 0) {
                        torneosContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No hay torneos disponibles. Crea el primer torneo.</p>';
                    }
                    
                } catch (error) {
                    console.error("Error al eliminar torneo:", error);
                    showNotification(error.message || "Error al eliminar torneo", "error");
                    
                    // Restore button
                    this.innerHTML = '<i class="fas fa-trash"></i>';
                    this.disabled = false;
                }
            }
        });
    });
}

// Load tournament data for editing
async function loadTournamentForEdit(tournamentId) {
    try {
        // Get tournament data
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("No se encontró el torneo para editar");
        }
        
        const tournament = tournamentSnap.data();
        
        // Fill form with tournament data
        document.getElementById('nombre').value = tournament.nombre || '';
        document.getElementById('descripcion').value = tournament.descripcion || '';
        
        // Format date
        if (tournament.fecha) {
            const fecha = new Date(tournament.fecha.seconds * 1000);
            const year = fecha.getFullYear();
            const month = String(fecha.getMonth() + 1).padStart(2, '0');
            const day = String(fecha.getDate()).padStart(2, '0');
            document.getElementById('fecha').value = `${year}-${month}-${day}`;
        }
        
        // Format time
        if (tournament.hora) {
            document.getElementById('hora').value = tournament.hora;
        }
        
        // Capacity
        document.getElementById('capacidad').value = tournament.capacidad || '';
        
        // Status
        const estadoSelect = document.getElementById('estado');
        for (let i = 0; i < estadoSelect.options.length; i++) {
            if (estadoSelect.options[i].value === tournament.estado) {
                estadoSelect.selectedIndex = i;
                break;
            }
        }
        
        // Points by position
        if (tournament.puntosPosicion) {
            const puntosInputs = document.querySelectorAll('input[type="number"][min="0"]');
            Object.entries(tournament.puntosPosicion).forEach(([posicion, puntos]) => {
                const pos = parseInt(posicion);
                if (pos > 0 && pos <= puntosInputs.length - 1) { // Skip capacity input
                    puntosInputs[pos].value = puntos;
                }
            });
        }
        
        // Show current image if exists
        if (tournament.imageUrl) {
            const container = document.getElementById('imagen').parentElement;
            const previewDiv = document.createElement('div');
            previewDiv.className = 'image-preview mt-2';
            previewDiv.innerHTML = `
                <p class="text-sm text-gray-600">Imagen actual:</p>
                <img src="${tournament.imageUrl}" alt="Imagen actual" class="h-32 object-cover rounded mt-1">
                <p class="text-xs text-gray-500">Cargar nueva imagen para reemplazar</p>
            `;
            container.appendChild(previewDiv);
        }
        
        // Load badges assigned to this tournament
        await loadTournamentBadges(tournamentId);
        
        // Update form title and button
        formTitle.textContent = 'Editar Torneo';
        submitButton.textContent = 'Actualizar Torneo';
        submitButton.dataset.editMode = 'true';
        submitButton.dataset.tournamentId = tournamentId;
        
        // Show form
        showForm();
        
    } catch (error) {
        console.error("Error al cargar torneo para editar:", error);
        throw error;
    }
}

// Load badges assigned to a tournament
async function loadTournamentBadges(tournamentId) {
    try {
        const badgesContainer = document.querySelector('.badges-container');
        if (!badgesContainer) {
            console.log("No se encontró el contenedor de badges del torneo");
            return;
        }
        
        // Clear container
        badgesContainer.innerHTML = '';
        
        // Get badges
        const tournamentBadges = await getTournamentBadges(tournamentId);
        
        // Show badges
        if (tournamentBadges.length === 0) {
            badgesContainer.innerHTML = '<p class="text-sm text-gray-500">No hay badges asignados a este torneo.</p>';
            return;
        }
        
        // Create elements for each badge
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
        
        // Add event listeners to position selectors
        document.querySelectorAll('.position-select').forEach(select => {
            select.addEventListener('change', async function() {
                const assignmentId = this.dataset.assignmentId;
                const newPosition = this.value;
                
                try {
                    // Update position in database
                    const assignmentRef = doc(db, "tournament_badges", assignmentId);
                    await updateDoc(assignmentRef, {
                        position: newPosition,
                        updatedAt: serverTimestamp()
                    });
                    
                    showNotification("Posición actualizada correctamente", "success");
                } catch (error) {
                    console.error("Error al actualizar posición:", error);
                    showNotification("Error al actualizar posición", "error");
                    
                    // Revert change in the select
                    this.value = this.getAttribute('data-original-value') || 'first';
                }
            });
            
            // Store original value for potential rollback
            select.setAttribute('data-original-value', select.value);
        });
        
        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-badge-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const assignmentId = this.dataset.assignmentId;
                
                try {
                    // Show loading
                    const originalHTML = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    this.disabled = true;
                    
                    // Remove from database
                    await removeBadgeFromTournament(assignmentId);
                    
                    // Remove from DOM
                    this.closest('.bg-gray-100').remove();
                    
                    showNotification("Badge removido correctamente", "success");
                    
                    // If no badges left, show message
                    if (!document.querySelector('.badges-container .bg-gray-100')) {
                        document.querySelector('.badges-container').innerHTML = 
                            '<p class="text-sm text-gray-500">No hay badges asignados a este torneo.</p>';
                    }
                    
                } catch (error) {
                    console.error("Error al eliminar badge del torneo:", error);
                    showNotification("Error al eliminar badge del torneo", "error");
                    
                    // Restore button
                    this.innerHTML = originalHTML;
                    this.disabled = false;
                }
            });
        });
        
    } catch (error) {
        console.error("Error al cargar badges del torneo:", error);
        showNotification("Error al cargar badges del torneo", "error");
    }
}

// Show badge selection modal
async function showBadgeSelectionModal() {
    try {
        // Create modal if it doesn't exist
        let modalContainer = document.getElementById('badgeSelectionModal');
        
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'badgeSelectionModal';
            modalContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 hidden';
            
            // Create modal content
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
                        <div class="flex justify-center col-span-2">
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
            
            // Event listener to close modal
            document.getElementById('closeBadgeModal').addEventListener('click', function() {
                modalContainer.classList.add('hidden');
            });
        }
        
        // Show modal
        modalContainer.classList.remove('hidden');
        
        // Load available badges
        const badgesList = document.getElementById('badgesList');
        const badges = await getAllBadges();
        
        // If no badges
        if (!badges || badges.length === 0) {
            badgesList.innerHTML = '<p class="col-span-2 text-center text-gray-500">No hay badges disponibles. Crea un badge primero.</p>';
            return;
        }
        
        // Show badges
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
        
        // Event listeners for badge selection
        let selectedBadgeId = null;
        
        document.querySelectorAll('.badge-option').forEach(badgeElement => {
            badgeElement.addEventListener('click', function() {
                // Remove previous selection
                document.querySelectorAll('.badge-option').forEach(el => el.classList.remove('ring-2', 'ring-orange-500'));
                
                // Add selection
                this.classList.add('ring-2', 'ring-orange-500');
                selectedBadgeId = this.dataset.badgeId;
                
                // Enable assign button
                document.getElementById('assignBadgeButton').disabled = false;
            });
        });
        
        // Event listener for assign button
        document.getElementById('assignBadgeButton').addEventListener('click', async function() {
            if (!selectedBadgeId) return;
            
            const position = document.getElementById('badgePosition').value;
            const tournamentId = submitButton.dataset.tournamentId;
            
            if (!tournamentId) {
                showNotification("Debes guardar el torneo primero para asignar badges", "warning");
                modalContainer.classList.add('hidden');
                return;
            }
            
            try {
                // Show loading
                const originalText = this.textContent;
                this.disabled = true;
                this.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Asignando...';
                
                // Assign badge to tournament
                await assignBadgeToTournament(selectedBadgeId, tournamentId, position);
                
                // Reload tournament badges
                await loadTournamentBadges(tournamentId);
                
                // Close modal
                modalContainer.classList.add('hidden');
                
                showNotification("Badge asignado correctamente", "success");
                
            } catch (error) {
                console.error("Error al asignar badge:", error);
                showNotification(error.message || "Error al asignar badge", "error");
            } finally {
                // Restore button
                this.disabled = false;
                this.textContent = originalText;
            }
        });
        
    } catch (error) {
        console.error("Error al mostrar modal de badges:", error);
        showNotification("Error al cargar badges disponibles", "error");
    }
}

// Create a new tournament
async function createTournament(tournamentData, imageFile) {
    try {
        const user = auth.currentUser;
        
        if (!user) {
            throw new Error("Debes iniciar sesión para crear un torneo");
        }
        
        // Check if user is host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            throw new Error("Solo el host puede crear torneos");
        }
        
        // Add additional fields
        tournamentData.createdBy = user.uid;
        tournamentData.createdAt = serverTimestamp();
        tournamentData.updatedAt = serverTimestamp();
        tournamentData.participants = [];
        tournamentData.visible = true; // Visible by default
        tournamentData.imageUrl = null; // Initialize as null explicitly
        
        // Add tournament to Firestore first (without image)
        const tournamentRef = await addDoc(collection(db, "torneos"), tournamentData);
        const tournamentId = tournamentRef.id;
        
        // Upload image if provided
        if (imageFile) {
            try {
                // Verify it's an image
                if (!imageFile.type.startsWith('image/')) {
                    throw new Error("El archivo debe ser una imagen");
                }
                
                // Sanitize filename and create a unique name
                const fileName = `torneos_${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                const storageRef = ref(storage, `torneos/${fileName}`);
                
                // Create blob to avoid CORS issues
                const arrayBuffer = await imageFile.arrayBuffer();
                const blob = new Blob([arrayBuffer], { type: imageFile.type });
                
                // Upload to Firebase Storage
                await uploadBytes(storageRef, blob);
                const imageUrl = await getDownloadURL(storageRef);
                
                // Update the document with the image URL
                await updateDoc(tournamentRef, { imageUrl: imageUrl });
                
                return {
                    id: tournamentId,
                    success: true,
                    imageUrl: imageUrl
                };
            } catch (imgError) {
                console.error("Error al subir imagen:", imgError);
                // Return success even if image upload fails
                return {
                    id: tournamentId,
                    success: true,
                    imageWarning: true
                };
            }
        }
        
        return {
            id: tournamentId,
            success: true
        };
    } catch (error) {
        console.error("Error al crear torneo:", error);
        throw error;
    }
}

// Update an existing tournament
async function updateTournament(tournamentId, tournamentData, imageFile) {
    try {
        const user = auth.currentUser;
        
        if (!user) {
            throw new Error("Debes iniciar sesión para actualizar un torneo");
        }
        
        // Check if user is host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            throw new Error("Solo el host puede actualizar torneos");
        }
        
        // Get tournament reference
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const currentTournament = tournamentSnap.data();
        
        // IMPORTANTE: Preparar objeto de datos sin la propiedad imageUrl inicialmente
        const updateData = {
            nombre: tournamentData.nombre,
            descripcion: tournamentData.descripcion,
            capacidad: tournamentData.capacidad,
            estado: tournamentData.estado,
            puntosPosicion: tournamentData.puntosPosicion,
            createdBy: currentTournament.createdBy,
            createdAt: currentTournament.createdAt,
            participants: currentTournament.participants || [],
            visible: currentTournament.visible !== false,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
        };
        
        // Añadir fecha y hora si existen
        if (tournamentData.fecha) {
            updateData.fecha = tournamentData.fecha;
        }
        if (tournamentData.hora) {
            updateData.hora = tournamentData.hora;
        }
        
        // Definir explícitamente la URL de la imagen (nunca debe ser undefined)
        // IMPORTANTE: Si no hay nueva imagen, mantener la URL existente o null
        updateData.imageUrl = currentTournament.imageUrl || null;
        
        // Si hay una nueva imagen, procesarla
        if (imageFile) {
            try {
                // Verificar que sea una imagen
                if (!imageFile.type.startsWith('image/')) {
                    throw new Error("El archivo debe ser una imagen");
                }
                
                // Eliminar imagen anterior si existe
                if (currentTournament.imageUrl) {
                    try {
                        const urlPath = currentTournament.imageUrl.split('?')[0];
                        const fileName = urlPath.split('/').pop();
                        if (fileName) {
                            const storagePath = `torneos/${fileName}`;
                            const oldImageRef = ref(storage, storagePath);
                            await deleteObject(oldImageRef).catch(error => {
                                console.warn("Error al eliminar imagen anterior, posiblemente ya no existe:", error);
                            });
                        }
                    } catch (error) {
                        console.warn("Error al procesar la URL de la imagen anterior:", error);
                        // Continuar con la actualización aunque falle la eliminación
                    }
                }
                
                // Subir nueva imagen
                const fileName = `torneos_${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                const storageRef = ref(storage, `torneos/${fileName}`);
                
                // Crear un blob para evitar problemas CORS
                const arrayBuffer = await imageFile.arrayBuffer();
                const blob = new Blob([arrayBuffer], { type: imageFile.type });
                
                // Subir imagen
                await uploadBytes(storageRef, blob);
                const imageUrl = await getDownloadURL(storageRef);
                
                // Actualizar URL de imagen en los datos
                updateData.imageUrl = imageUrl;
                
                console.log("Nueva imagen subida exitosamente:", imageUrl);
            } catch (imgError) {
                console.error("Error al procesar la imagen:", imgError);
                // NO CAMBIAR la URL de imagen si hay error (mantener la original)
                // updateData.imageUrl ya está establecido correctamente arriba
                console.log("Manteniendo URL de imagen original:", updateData.imageUrl);
            }
        } else {
            console.log("No hay nueva imagen, manteniendo URL existente:", updateData.imageUrl);
        }
        
        // Verificar que imageUrl no sea undefined antes de actualizar
        if (updateData.imageUrl === undefined) {
            console.warn("imageUrl es undefined, estableciendo a null");
            updateData.imageUrl = null;
        }
        
        console.log("Actualizando documento con datos:", JSON.stringify(updateData));
        
        // Actualizar documento con todos los datos
        await updateDoc(tournamentRef, updateData);
        
        console.log("Torneo actualizado correctamente");
        
        return {
            id: tournamentId,
            success: true,
            imageUrl: updateData.imageUrl
        };
    } catch (error) {
        console.error("Error al actualizar torneo:", error);
        throw error;
    }
}

// Delete a tournament
async function deleteTournament(tournamentId) {
    try {
        const user = auth.currentUser;
        
        if (!user) {
            throw new Error("Debes iniciar sesión para eliminar un torneo");
        }
        
        // Check if user is host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            throw new Error("Solo el host puede eliminar torneos");
        }
        
        // Get tournament data
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            throw new Error("El torneo no existe");
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Delete image if exists
        if (tournamentData.imageUrl) {
            try {
                const urlPath = tournamentData.imageUrl.split('?')[0];
                const fileName = urlPath.split('/').pop();
                const storagePath = `torneos/${fileName}`;
                const imageRef = ref(storage, storagePath);
                await deleteObject(imageRef);
            } catch (error) {
                console.warn("Error al eliminar imagen del torneo:", error);
                // Continue anyway
            }
        }
        
        // Delete badges assigned to this tournament
        const tournamentBadgesRef = collection(db, "tournament_badges");
        const badgesQuery = query(tournamentBadgesRef, where("tournamentId", "==", tournamentId));
        const badgesSnapshot = await getDocs(badgesQuery);
        
        if (!badgesSnapshot.empty) {
            const deletePromises = [];
            badgesSnapshot.forEach(doc => {
                deletePromises.push(deleteDoc(doc.ref));
            });
            await Promise.all(deletePromises);
        }
        
        // Delete results related to this tournament
        try {
            const resultsRef = collection(db, "resultados");
            const resultsQuery = query(resultsRef, where("tournamentId", "==", tournamentId));
            const resultsSnapshot = await getDocs(resultsQuery);
            
            if (!resultsSnapshot.empty) {
                const deletePromises = [];
                resultsSnapshot.forEach(doc => {
                    deletePromises.push(deleteDoc(doc.ref));
                });
                await Promise.all(deletePromises);
            }
        } catch (error) {
            console.warn("Error al eliminar resultados del torneo:", error);
            // Continue anyway
        }
        
        // Finally delete the tournament
        await deleteDoc(tournamentRef);
        
        return {
            success: true
        };
    } catch (error) {
        console.error("Error al eliminar torneo:", error);
        throw error;
    }
}

// Helper function to get month name
function getMonthName(month) {
    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[month];
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initTournamentsManagement);

// Export functions
export {
    loadTournaments,
    initTournamentsManagement
};
