// Ejemplo de integración en perfil.js o donde manejes la edición de perfil

import { uploadProfilePhoto, getCurrentProfilePhoto, deleteProfilePhoto } from './profile-photo-manager.js';
import { auth } from './firebase.js';

/**
 * Maneja la carga de foto de perfil desde un input file
 */
export async function handleProfilePhotoUpload(fileInput, progressCallback = null) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('Usuario no autenticado');
    }

    const file = fileInput.files[0];
    if (!file) {
        throw new Error('No se seleccionó ningún archivo');
    }

    try {
        // Mostrar loading
        showPhotoUploadLoading(true);

        // Subir foto
        const photoURL = await uploadProfilePhoto(user.uid, file, progressCallback);

        // Actualizar UI
        updateProfilePhotoInUI(photoURL);
        
        // Mostrar éxito
        showSuccessMessage('Foto de perfil actualizada correctamente');
        
        return photoURL;

    } catch (error) {
        console.error('Error subiendo foto:', error);
        showErrorMessage(error.message);
        throw error;
    } finally {
        showPhotoUploadLoading(false);
    }
}

/**
 * Carga la foto de perfil actual en la UI
 */
export async function loadCurrentProfilePhoto() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const photoURL = await getCurrentProfilePhoto(user.uid);
        if (photoURL) {
            updateProfilePhotoInUI(photoURL);
        }
    } catch (error) {
        console.error('Error cargando foto de perfil:', error);
    }
}

/**
 * Elimina la foto de perfil actual
 */
export async function handleDeleteProfilePhoto() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('Usuario no autenticado');
    }

    // Confirmar eliminación
    if (!confirm('¿Estás seguro de que quieres eliminar tu foto de perfil?')) {
        return;
    }

    try {
        showPhotoUploadLoading(true);
        
        await deleteProfilePhoto(user.uid);
        
        // Actualizar UI con foto por defecto
        updateProfilePhotoInUI(null);
        
        showSuccessMessage('Foto de perfil eliminada correctamente');

    } catch (error) {
        console.error('Error eliminando foto:', error);
        showErrorMessage(error.message);
        throw error;
    } finally {
        showPhotoUploadLoading(false);
    }
}

/**
 * Actualiza la foto de perfil en la UI
 */
function updateProfilePhotoInUI(photoURL) {
    const photoElements = document.querySelectorAll('.profile-photo, .user-avatar');
    const defaultPhotoURL = '/assets/img/default-avatar.png'; // Ajusta la ruta según tu estructura

    photoElements.forEach(element => {
        if (element.tagName === 'IMG') {
            element.src = photoURL || defaultPhotoURL;
        } else {
            element.style.backgroundImage = `url(${photoURL || defaultPhotoURL})`;
        }
    });

    // Actualizar también en el modal de edición si existe
    const modalPhoto = document.querySelector('#editProfileModal .profile-photo');
    if (modalPhoto) {
        if (modalPhoto.tagName === 'IMG') {
            modalPhoto.src = photoURL || defaultPhotoURL;
        } else {
            modalPhoto.style.backgroundImage = `url(${photoURL || defaultPhotoURL})`;
        }
    }
}

/**
 * Muestra/oculta loading durante la subida
 */
function showPhotoUploadLoading(show) {
    const loadingElement = document.querySelector('.photo-upload-loading');
    const uploadButton = document.querySelector('.photo-upload-button');
    
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
    
    if (uploadButton) {
        uploadButton.disabled = show;
        uploadButton.textContent = show ? 'Subiendo...' : 'Cambiar foto';
    }
}

/**
 * Muestra mensaje de éxito
 */
function showSuccessMessage(message) {
    // Implementa según tu sistema de notificaciones
    console.log('✅', message);
    // Ejemplo: mostrar toast, alert, etc.
}

/**
 * Muestra mensaje de error
 */
function showErrorMessage(message) {
    // Implementa según tu sistema de notificaciones
    console.error('❌', message);
    // Ejemplo: mostrar toast, alert, etc.
}

// Event listeners para cuando se cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
    // Input file para seleccionar foto
    const photoInput = document.querySelector('#profilePhotoInput');
    if (photoInput) {
        photoInput.addEventListener('change', (e) => {
            handleProfilePhotoUpload(e.target);
        });
    }

    // Botón para eliminar foto
    const deletePhotoButton = document.querySelector('#deleteProfilePhoto');
    if (deletePhotoButton) {
        deletePhotoButton.addEventListener('click', handleDeleteProfilePhoto);
    }

    // Cargar foto actual al cargar la página
    loadCurrentProfilePhoto();
});