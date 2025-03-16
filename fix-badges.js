// Ejecuta esto cuando la página cargue
document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const badgesContainer = document.getElementById('badgesContainer');
    const createBadgeForm = document.getElementById('createBadgeForm');
    const submitButton = document.querySelector('#createBadgeForm button[type="submit"]');
    const cancelButton = document.getElementById('cancelButton');
    const formSection = document.getElementById('badgeFormSection') || createBadgeForm.closest('.bg-gray-50');
    const headerCreateBadgeBtn = document.querySelector('button.dtowin-primary');
    
    // Configurar listeners
    if (headerCreateBadgeBtn) {
        headerCreateBadgeBtn.addEventListener('click', function() {
            if (formSection) formSection.classList.remove('hidden');
        });
    }
    
    if (cancelButton) {
        cancelButton.addEventListener('click', function() {
            if (formSection) formSection.classList.add('hidden');
        });
    }
    
    if (createBadgeForm) {
        createBadgeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Obtener valores del formulario
            const nombre = document.getElementById('nombreBadge').value;
            const descripcion = document.getElementById('descripcionBadge').value;
            const color = document.getElementById('colorBadge').value;
            const icono = document.getElementById('iconoBadge').value;
            
            // Crear badge sin subir imagen
            createBadgeWithoutImage(nombre, descripcion, color, icono);
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
            badgesContainer.innerHTML = '<div class="flex justify-center"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
            
            const snapshot = await firebase.firestore().collection('badges').get();
            
            if (snapshot.empty) {
                badgesContainer.innerHTML = '<p class="text-center">No hay badges disponibles. Crea el primer badge.</p>';
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
                        <button class="text-red-500 hover:text-red-700 delete-badge-btn">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            });
            
            html += '</div>';
            badgesContainer.innerHTML = html;
            
            // Añadir listeners a botones de eliminar
            document.querySelectorAll('.delete-badge-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const card = this.closest('[data-badge-id]');
                    const id = card.dataset.badgeId;
                    
                    if (confirm('¿Estás seguro de que quieres eliminar este badge?')) {
                        try {
                            await firebase.firestore().collection('badges').doc(id).delete();
                            card.remove();
                            mostrarNotificacion('Badge eliminado correctamente', 'success');
                            
                            // Si no quedan badges, actualizar mensaje
                            if (document.querySelectorAll('[data-badge-id]').length === 0) {
                                badgesContainer.innerHTML = '<p class="text-center">No hay badges disponibles. Crea el primer badge.</p>';
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
            badgesContainer.innerHTML = `<p class="text-center text-red-500">Error al cargar badges: ${error.message}</p>`;
        }
    }
    
    // Iniciar carga de badges
    loadBadges();
});
