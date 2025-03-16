// Ejecuta esto cuando la página cargue
document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const badgesContainer = document.getElementById('badgesContainer');
    const createBadgeForm = document.getElementById('createBadgeForm');
    const submitButton = document.querySelector('#createBadgeForm button[type="submit"]');
    const cancelButton = document.getElementById('cancelButton');
    const formSection = document.getElementById('badgeFormSection') || createBadgeForm.closest('.bg-gray-50');
    const headerCreateBadgeBtn = document.querySelector('button.dtowin-primary');
    const formTitle = document.getElementById('formTitle');
    const nombreBadgeInput = document.getElementById('nombreBadge');
    const descripcionBadgeInput = document.getElementById('descripcionBadge');
    const colorBadgeInput = document.getElementById('colorBadge');
    const iconoBadgeInput = document.getElementById('iconoBadge');
    
    // Estado para controlar edición
    let isEditMode = false;
    let editingBadgeId = null;
    
    // Configurar listeners
    if (headerCreateBadgeBtn) {
        headerCreateBadgeBtn.addEventListener('click', function() {
            // Resetear formulario para crear nuevo badge
            resetForm();
            if (formSection) formSection.classList.remove('hidden');
        });
    }
    
    if (cancelButton) {
        cancelButton.addEventListener('click', function() {
            if (formSection) formSection.classList.add('hidden');
            resetForm();
        });
    }
    
    // Resetear formulario
    function resetForm() {
        if (createBadgeForm) {
            createBadgeForm.reset();
            if (formTitle) formTitle.textContent = 'Crear Nuevo Badge';
            if (submitButton) submitButton.textContent = 'Crear Badge';
            isEditMode = false;
            editingBadgeId = null;
        }
    }
    
    if (createBadgeForm) {
        createBadgeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Obtener valores del formulario
            const nombre = nombreBadgeInput.value;
            const descripcion = descripcionBadgeInput.value;
            const color = colorBadgeInput.value;
            const icono = iconoBadgeInput.value;
            
            if (!nombre) {
                mostrarNotificacion('El nombre del badge es obligatorio', 'error');
                return;
            }
            
            // Verificar si estamos editando o creando
            if (isEditMode && editingBadgeId) {
                updateBadge(editingBadgeId, nombre, descripcion, color, icono);
            } else {
                createBadgeWithoutImage(nombre, descripcion, color, icono);
            }
        });
    }
    
    // Función para crear badge sin usar Storage
    async function createBadgeWithoutImage(nombre, descripcion, color, icono) {
        try {
            // Mostrar indicador de carga
            if (submitButton) {
                const originalText = submitButton.textContent;
                submitButton.disabled = true;
                submitButton.textContent = 'Procesando...';
                
                // Añadir badge a Firestore directamente (sin imagen)
                await firebase.firestore().collection('badges').add({
                    nombre: nombre,
                    descripcion: descripcion,
                    color: color,
                    icono: icono,
                    createdBy: firebase.auth().currentUser.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Mostrar mensaje de éxito
                mostrarNotificacion('Badge creado correctamente', 'success');
                
                // Ocultar formulario y recargar badges
                if (formSection) formSection.classList.add('hidden');
                createBadgeForm.reset();
                
                // Recargar lista de badges
                loadBadges();
                
                // Restaurar botón
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarNotificacion('Error al crear badge: ' + error.message, 'error');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Crear Badge';
            }
        }
    }
    
    // Función para actualizar un badge existente
    async function updateBadge(badgeId, nombre, descripcion, color, icono) {
        try {
            // Mostrar indicador de carga
            if (submitButton) {
                const originalText = submitButton.textContent;
                submitButton.disabled = true;
                submitButton.textContent = 'Actualizando...';
                
                // Actualizar badge en Firestore
                await firebase.firestore().collection('badges').doc(badgeId).update({
                    nombre: nombre,
                    descripcion: descripcion,
                    color: color,
                    icono: icono,
                    updatedBy: firebase.auth().currentUser.uid,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Mostrar mensaje de éxito
                mostrarNotificacion('Badge actualizado correctamente', 'success');
                
                // Ocultar formulario y recargar badges
                if (formSection) formSection.classList.add('hidden');
                createBadgeForm.reset();
                
                // Resetear modo de edición
                isEditMode = false;
                editingBadgeId = null;
                
                // Recargar lista de badges
                loadBadges();
                
                // Restaurar botón
                submitButton.disabled = false;
                submitButton.textContent = 'Crear Badge';
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarNotificacion('Error al actualizar badge: ' + error.message, 'error');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Confirmar Cambios';
            }
        }
    }
    
    // Función para editar un badge existente
    async function editBadge(badgeId) {
        try {
            // Obtener los datos del badge
            const badgeDoc = await firebase.firestore().collection('badges').doc(badgeId).get();
            
            if (!badgeDoc.exists) {
                mostrarNotificacion('No se encontró el badge', 'error');
                return;
            }
            
            const badgeData = badgeDoc.data();
            
            // Llenar el formulario con los datos del badge
            if (nombreBadgeInput) nombreBadgeInput.value = badgeData.nombre || '';
            if (descripcionBadgeInput) descripcionBadgeInput.value = badgeData.descripcion || '';
            if (colorBadgeInput) colorBadgeInput.value = badgeData.color || '#ff6b1a';
            if (iconoBadgeInput) iconoBadgeInput.value = badgeData.icono || 'trophy';
            
            // Cambiar título y texto del botón
            if (formTitle) formTitle.textContent = 'Editar Badge';
            if (submitButton) submitButton.textContent = 'Confirmar Cambios';
            
            // Activar modo de edición
            isEditMode = true;
            editingBadgeId = badgeId;
            
            // Mostrar formulario
            if (formSection) formSection.classList.remove('hidden');
            
            // Hacer scroll al formulario
            formSection.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('Error al cargar datos para editar:', error);
            mostrarNotificacion('Error al cargar datos del badge', 'error');
        }
    }
    
    // Función para mostrar notificaciones
    function mostrarNotificacion(mensaje, tipo) {
        const notificacion = document.createElement('div');
        
        // Definir clases según el tipo
        const bgColor = tipo === 'success' ? 'bg-green-500' : 'bg-red-500';
        
        notificacion.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50`;
        notificacion.textContent = mensaje;
        
        document.body.appendChild(notificacion);
        
        // Eliminar después de 3 segundos
        setTimeout(() => {
            notificacion.remove();
        }, 3000);
    }
    
    // Cargar badges existentes
    async function loadBadges() {
        if (!badgesContainer) return;
        
        try {
            badgesContainer.innerHTML = '<div class="flex justify-center py-4"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
            
            const snapshot = await firebase.firestore().collection('badges').get();
            
            if (snapshot.empty) {
                badgesContainer.innerHTML = '<p class="text-center py-4">No hay badges disponibles. Crea el primer badge.</p>';
                return;
            }
            
            let html = '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';
            
            snapshot.forEach(doc => {
                const badge = doc.data();
                html += `
                    <div class="bg-white rounded-lg p-4 shadow-md flex items-center" data-badge-id="${doc.id}">
                        <div class="h-12 w-12 mr-3 rounded-full flex items-center justify-center" style="background-color: ${badge.color || '#ff6b1a'}">
                            <i class="fas fa-${badge.icono || 'trophy'} text-white"></i>
                        </div>
                        <div class="flex-grow">
                            <h4 class="font-semibold">${badge.nombre || 'Sin nombre'}</h4>
                            <p class="text-sm text-gray-600">${badge.descripcion || ''}</p>
                        </div>
                        <div class="flex flex-col space-y-2">
                            <button class="text-blue-500 hover:text-blue-700 edit-badge-btn" title="Editar badge">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="text-red-500 hover:text-red-700 delete-badge-btn" title="Eliminar badge">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            badgesContainer.innerHTML = html;
            
            // Añadir listeners a botones de editar
            document.querySelectorAll('.edit-badge-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const card = this.closest('[data-badge-id]');
                    const id = card.dataset.badgeId;
                    editBadge(id);
                });
            });
            
            // Añadir listeners a botones de eliminar
            document.querySelectorAll('.delete-badge-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const card = this.closest('[data-badge-id]');
                    const id = card.dataset.badgeId;
                    const badgeName = card.querySelector('h4').textContent;
                    
                    if (confirm(`¿Estás seguro que deseas eliminar el badge "${badgeName}"?`)) {
                        try {
                            await firebase.firestore().collection('badges').doc(id).delete();
                            card.remove();
                            mostrarNotificacion('Badge eliminado correctamente', 'success');
                            
                            // Si no quedan badges, actualizar mensaje
                            if (document.querySelectorAll('[data-badge-id]').length === 0) {
                                badgesContainer.innerHTML = '<p class="text-center py-4">No hay badges disponibles. Crea el primer badge.</p>';
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            mostrarNotificacion('Error al eliminar badge', 'error');
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Error al cargar badges:', error);
            badgesContainer.innerHTML = `<p class="text-center text-red-500 py-4">Error al cargar badges: ${error.message}</p>`;
        }
    }
    
    // Iniciar carga de badges
    loadBadges();
});
