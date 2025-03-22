// Variables globales
let currentBadgeId = null;
let isEditMode = false;

// Ejecuta esto cuando la página cargue
document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const badgesContainer = document.getElementById('badgesContainer');
    const createBadgeForm = document.getElementById('createBadgeForm');
    const submitButton = document.getElementById('submitButton');
    const cancelButton = document.getElementById('cancelButton');
    const formSection = document.getElementById('badgeFormSection');
    const headerCreateBadgeBtn = document.getElementById('headerCreateBadgeBtn');
    const imagenBadgeInput = document.getElementById('imagenBadge');
    const badgePreviewContainer = document.getElementById('badgePreviewContainer');
    const formTitle = document.getElementById('formTitle');
    
    // Verificar autenticación
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            // Verificar si el usuario tiene rol de administrador
            checkAdminRole(user.uid);
        } else {
            console.log("No hay usuario autenticado");
            window.location.href = "login.html";
        }
    });
    
    // Comprobar si el usuario tiene rol de administrador
    async function checkAdminRole(userId) {
        try {
            const userRef = firebase.firestore().collection('usuarios').doc(userId);
            const doc = await userRef.get();
            
            if (doc.exists && doc.data().rol === 'host') {
                // El usuario es un administrador, cargar badges
                loadBadges();
            } else {
                // El usuario no tiene permisos de administrador
                mostrarNotificacion('No tienes permisos para acceder a esta sección', 'error');
                setTimeout(() => {
                    window.location.href = "index.html";
                }, 2000);
            }
        } catch (error) {
            console.error('Error al verificar permisos:', error);
            mostrarNotificacion('Error al verificar permisos', 'error');
        }
    }
    
    // Configurar listeners
    if (headerCreateBadgeBtn) {
        headerCreateBadgeBtn.addEventListener('click', function() {
            resetForm();
            formTitle.textContent = "Crear Nuevo Badge";
            submitButton.textContent = "Crear Badge";
            isEditMode = false;
            formSection.classList.remove('hidden');
        });
    }
    
    if (cancelButton) {
        cancelButton.addEventListener('click', function() {
            formSection.classList.add('hidden');
            resetForm();
        });
    }
    
    // Vista previa de imagen
    if (imagenBadgeInput) {
        imagenBadgeInput.addEventListener('change', function() {
            if (!badgePreviewContainer) return;
            
            const file = this.files[0];
            if (file) {
                // Verificar que sea una imagen
                if (!file.type.startsWith('image/')) {
                    mostrarNotificacion("El archivo debe ser una imagen", "error");
                    this.value = '';
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    badgePreviewContainer.innerHTML = `
                        <img src="${e.target.result}" alt="Vista previa" class="w-full h-full object-contain">
                    `;
                };
                reader.readAsDataURL(file);
            } else {
                badgePreviewContainer.innerHTML = '<i class="fas fa-image text-4xl text-gray-400"></i>';
            }
        });
    }
    
    // Manejar envío del formulario
    if (createBadgeForm) {
        createBadgeForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Validar formulario
            if (!validateForm()) {
                return;
            }
            
            // Obtener valores del formulario
            const nombre = document.getElementById('nombreBadge').value;
            const descripcion = document.getElementById('descripcionBadge').value;
            const color = document.getElementById('colorBadge').value;
            const icono = document.getElementById('iconoBadge').value;
            const imagenFile = document.getElementById('imagenBadge').files[0];
            
            // Mostrar indicador de carga
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Procesando...';
            
            try {
                if (isEditMode) {
                    // Actualizar badge existente
                    await updateBadge(currentBadgeId, nombre, descripcion, color, icono, imagenFile);
                } else {
                    // Crear nuevo badge
                    await createBadge(nombre, descripcion, color, icono, imagenFile);
                }
                
                // Restablecer y ocultar formulario
                resetForm();
                formSection.classList.add('hidden');
                
                // Recargar lista de badges
                loadBadges();
            } catch (error) {
                console.error('Error:', error);
                mostrarNotificacion('Error: ' + error.message, 'error');
            } finally {
                // Restaurar botón
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    }
    
    // Función para validar formulario
    function validateForm() {
        const nombre = document.getElementById('nombreBadge').value.trim();
        const descripcion = document.getElementById('descripcionBadge').value.trim();
        
        if (!nombre) {
            mostrarNotificacion('El nombre del badge es obligatorio', 'error');
            return false;
        }
        
        if (!descripcion) {
            mostrarNotificacion('La descripción del badge es obligatoria', 'error');
            return false;
        }
        
        return true;
    }
    
    // Función para crear nuevo badge
    async function createBadge(nombre, descripcion, color, icono, imagenFile) {
        // Preparar datos del badge
        const badgeData = {
            nombre: nombre,
            descripcion: descripcion,
            color: color,
            icono: icono,
            createdBy: firebase.auth().currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Si hay imagen, subirla a Storage
        if (imagenFile) {
            try {
                const imageUrl = await uploadImageToStorage(imagenFile);
                badgeData.imageUrl = imageUrl;
            } catch (error) {
                console.error('Error al subir imagen:', error);
                throw new Error('Error al subir la imagen: ' + error.message);
            }
        }
        
        // Guardar badge en Firestore
        try {
            await firebase.firestore().collection('badges').add(badgeData);
            mostrarNotificacion('Badge creado correctamente', 'success');
        } catch (error) {
            console.error('Error al guardar badge:', error);
            throw new Error('Error al guardar el badge: ' + error.message);
        }
    }
    
    // Función para actualizar badge
    async function updateBadge(badgeId, nombre, descripcion, color, icono, imagenFile) {
        // Preparar datos para actualizar
        const badgeData = {
            nombre: nombre,
            descripcion: descripcion,
            color: color,
            icono: icono,
            updatedBy: firebase.auth().currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Si hay nueva imagen, subirla a Storage
        if (imagenFile) {
            try {
                const imageUrl = await uploadImageToStorage(imagenFile);
                badgeData.imageUrl = imageUrl;
            } catch (error) {
                console.error('Error al subir imagen:', error);
                throw new Error('Error al subir la imagen: ' + error.message);
            }
        }
        
        // Actualizar badge en Firestore
        try {
            await firebase.firestore().collection('badges').doc(badgeId).update(badgeData);
            mostrarNotificacion('Badge actualizado correctamente', 'success');
        } catch (error) {
            console.error('Error al actualizar badge:', error);
            throw new Error('Error al actualizar el badge: ' + error.message);
        }
    }
    
    // Función para subir imagen a Firebase Storage
    async function uploadImageToStorage(imageFile) {
        return new Promise((resolve, reject) => {
            // Crear referencia con un nombre único
            const timestamp = new Date().getTime();
            const filename = `badges/badge_${timestamp}_${imageFile.name}`;
            const storageRef = firebase.storage().ref(filename);
            
            // Iniciar la subida
            const uploadTask = storageRef.put(imageFile);
            
            // Manejar eventos de la subida
            uploadTask.on('state_changed', 
                // Progress function
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`Subida ${progress.toFixed(2)}% completada`);
                },
                // Error function
                (error) => {
                    console.error('Error durante la subida:', error);
                    reject(error);
                },
                // Complete function
                async () => {
                    try {
                        // Obtener URL de descarga
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve(downloadURL);
                    } catch (error) {
                        console.error('Error al obtener URL:', error);
                        reject(error);
                    }
                }
            );
        });
    }
    
    // Función para cargar badge existente en el formulario para edición
    function loadBadgeForEdit(badgeId) {
        isEditMode = true;
        currentBadgeId = badgeId;
        
        // Cambiar título y botón del formulario
        formTitle.textContent = "Editar Badge";
        submitButton.textContent = "Guardar Cambios";
        
        // Mostrar formulario
        formSection.classList.remove('hidden');
        
        // Obtener datos del badge
        firebase.firestore().collection('badges').doc(badgeId).get()
            .then((doc) => {
                if (doc.exists) {
                    const badgeData = doc.data();
                    
                    // Llenar formulario con datos existentes
                    document.getElementById('nombreBadge').value = badgeData.nombre || '';
                    document.getElementById('descripcionBadge').value = badgeData.descripcion || '';
                    document.getElementById('colorBadge').value = badgeData.color || '#ff6b1a';
                    
                    const iconoSelect = document.getElementById('iconoBadge');
                    if (iconoSelect && badgeData.icono) {
                        // Seleccionar el icono correcto si existe
                        const optionExists = Array.from(iconoSelect.options).some(option => option.value === badgeData.icono);
                        if (optionExists) {
                            iconoSelect.value = badgeData.icono;
                        }
                    }
                    
                    // Mostrar imagen actual si existe
                    if (badgeData.imageUrl) {
                        badgePreviewContainer.innerHTML = `
                            <img src="${badgeData.imageUrl}" alt="Vista previa" class="w-full h-full object-contain">
                        `;
                    } else {
                        // Mostrar icono por defecto si no hay imagen
                        badgePreviewContainer.innerHTML = `
                            <div class="h-full w-full flex items-center justify-center" style="background-color: ${badgeData.color || '#ff6b1a'}">
                                <i class="fas fa-${badgeData.icono || 'trophy'} text-white text-4xl"></i>
                            </div>
                        `;
                    }
                } else {
                    mostrarNotificacion('No se encontró el badge para editar', 'error');
                    formSection.classList.add('hidden');
                }
            })
            .catch((error) => {
                console.error('Error al obtener badge:', error);
                mostrarNotificacion('Error al cargar datos del badge', 'error');
                formSection.classList.add('hidden');
            });
    }
    
    // Función para eliminar badge
    async function deleteBadge(badgeId) {
        try {
            // Obtener información del badge primero para verificar si tiene imagen
            const badgeDoc = await firebase.firestore().collection('badges').doc(badgeId).get();
            
            if (badgeDoc.exists) {
                const badgeData = badgeDoc.data();
                
                // Si hay una imagen asociada, eliminarla de Storage
                if (badgeData.imageUrl) {
                    try {
                        // Extraer la referencia del path de la URL
                        const urlPath = badgeData.imageUrl;
                        // Obtener la ruta de la imagen en Storage desde la URL
                        const storageRef = firebase.storage().refFromURL(urlPath);
                        await storageRef.delete();
                        console.log('Imagen eliminada de Storage');
                    } catch (storageError) {
                        console.error('Error al eliminar imagen:', storageError);
                        // Continuamos con la eliminación del documento aunque falle la eliminación de la imagen
                    }
                }
                
                // Eliminar el documento de Firestore
                await firebase.firestore().collection('badges').doc(badgeId).delete();
                mostrarNotificacion('Badge eliminado correctamente', 'success');
                return true;
            } else {
                mostrarNotificacion('No se encontró el badge para eliminar', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error al eliminar badge:', error);
            mostrarNotificacion('Error al eliminar badge: ' + error.message, 'error');
            return false;
        }
    }
    
    // Función para resetear formulario
    function resetForm() {
        createBadgeForm.reset();
        badgePreviewContainer.innerHTML = '<i class="fas fa-image text-4xl text-gray-400"></i>';
        currentBadgeId = null;
        isEditMode = false;
    }
    
    // Cargar badges existentes
    async function loadBadges() {
        if (!badgesContainer) return;
        
        try {
            badgesContainer.innerHTML = '<div class="flex justify-center"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
            
            const snapshot = await firebase.firestore().collection('badges').orderBy('createdAt', 'desc').get();
            
            if (snapshot.empty) {
                badgesContainer.innerHTML = '<p class="text-center text-gray-500">No hay badges disponibles. Crea el primer badge.</p>';
                return;
            }
            
            let html = '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';
            
            snapshot.forEach(doc => {
                const badge = doc.data();
                const badgeId = doc.id;
                
                // Determinar cómo mostrar el badge (con imagen o solo con icono)
                let badgeVisual;
                if (badge.imageUrl) {
                    badgeVisual = `<img src="${badge.imageUrl}" alt="${badge.nombre}" class="h-12 w-12 mr-3 rounded-full object-cover">`;
                } else {
                    badgeVisual = `
                        <div class="h-12 w-12 mr-3 rounded-full flex items-center justify-center" style="background-color: ${badge.color || '#ff6b1a'}">
                            <i class="fas fa-${badge.icono || 'trophy'} text-white"></i>
                        </div>
                    `;
                }
                
                html += `
                    <div class="bg-white rounded-lg p-4 shadow-md flex items-center" data-badge-id="${badgeId}">
                        ${badgeVisual}
                        <div class="flex-grow">
                            <h4 class="font-semibold">${badge.nombre || 'Sin nombre'}</h4>
                            <p class="text-sm text-gray-600">${badge.descripcion || ''}</p>
                        </div>
                        <div class="flex flex-col space-y-2">
                            <button class="text-blue-500 hover:text-blue-700 edit-badge-btn" data-badge-id="${badgeId}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="text-red-500 hover:text-red-700 delete-badge-btn" data-badge-id="${badgeId}">
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
                    const badgeId = this.getAttribute('data-badge-id');
                    loadBadgeForEdit(badgeId);
                });
            });
            
            // Añadir listeners a botones de eliminar
            document.querySelectorAll('.delete-badge-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const badgeId = this.getAttribute('data-badge-id');
                    
                    if (confirm('¿Estás seguro de que quieres eliminar este badge?')) {
                        const success = await deleteBadge(badgeId);
                        
                        if (success) {
                            // Actualizar vista sin recargar la página
                            const card = document.querySelector(`[data-badge-id="${badgeId}"]`);
                            if (card) {
                                card.remove();
                                
                                // Si no quedan badges, actualizar mensaje
                                if (document.querySelectorAll('[data-badge-id]').length === 0) {
                                    badgesContainer.innerHTML = '<p class="text-center text-gray-500">No hay badges disponibles. Crea el primer badge.</p>';
                                }
                            } else {
                                // Si no se puede encontrar el elemento, recargar todos los badges
                                loadBadges();
                            }
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Error al cargar badges:', error);
            badgesContainer.innerHTML = `<p class="text-center text-red-500">Error al cargar badges: ${error.message}</p>`;
        }
    }
    
    // Función para mostrar notificaciones
    window.mostrarNotificacion = function(mensaje, tipo) {
        const notificacion = document.createElement('div');
        
        // Definir clases según el tipo
        const bgColor = tipo === 'success' ? 'bg-green-500' : 'bg-red-500';
        
        notificacion.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg z-50`;
        notificacion.textContent = mensaje;
        
        document.body.appendChild(notificacion);
        
        // Eliminar después de 3 segundos
        setTimeout(() => {
            notificacion.classList.add('opacity-0', 'transition-opacity', 'duration-500');
            setTimeout(() => {
                notificacion.remove();
            }, 500);
        }, 3000);
    };
});
