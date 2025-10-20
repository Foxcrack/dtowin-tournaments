// profile-photo-manager.js
import { storage, db } from './firebase.js';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

class ProfilePhotoManager {
    constructor() {
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    }

    /**
     * Valida el archivo de imagen
     * @param {File} file - Archivo a validar
     * @returns {Object} - {valid: boolean, error: string}
     */
    validateFile(file) {
        if (!file) {
            return { valid: false, error: 'No se seleccionó ningún archivo' };
        }

        if (file.size > this.maxFileSize) {
            return { valid: false, error: 'El archivo es demasiado grande. Máximo 5MB.' };
        }

        if (!this.allowedTypes.includes(file.type)) {
            return { valid: false, error: 'Tipo de archivo no permitido. Usa JPG, PNG o WebP.' };
        }

        return { valid: true, error: null };
    }

    /**
     * Elimina todas las fotos de perfil anteriores del usuario
     * @param {string} userId - ID del usuario
     */
    async deleteOldProfilePhotos(userId) {
        try {
            const folderRef = ref(storage, `profile-photos/${userId}`);
            const filesList = await listAll(folderRef);
            
            // Eliminar todos los archivos en la carpeta del usuario
            const deletePromises = filesList.items.map(fileRef => deleteObject(fileRef));
            await Promise.all(deletePromises);
            
            console.log('Fotos de perfil anteriores eliminadas');
        } catch (error) {
            console.error('Error eliminando fotos anteriores:', error);
            // No lanzamos el error para que no interrumpa la subida de la nueva foto
        }
    }

    /**
     * Sube una nueva foto de perfil
     * @param {string} userId - ID del usuario
     * @param {File} file - Archivo de imagen
     * @param {Function} onProgress - Callback para progreso (opcional)
     * @returns {Promise<string>} - URL de descarga de la nueva foto
     */
    async uploadProfilePhoto(userId, file, onProgress = null) {
        // Validar archivo
        const validation = this.validateFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        try {
            // 1. Eliminar fotos anteriores
            await this.deleteOldProfilePhotos(userId);

            // 2. Crear referencia para la nueva foto con timestamp para evitar cache
            const timestamp = Date.now();
            const fileExtension = file.name.split('.').pop();
            const fileName = `profile_${timestamp}.${fileExtension}`;
            const photoRef = ref(storage, `profile-photos/${userId}/${fileName}`);

            // 3. Subir nueva foto
            const uploadTask = uploadBytes(photoRef, file);
            
            // Si se proporciona callback de progreso, podríamos usar uploadBytesResumable
            const snapshot = await uploadTask;

            // 4. Obtener URL de descarga
            const downloadURL = await getDownloadURL(snapshot.ref);

            // 5. Actualizar documento del usuario en Firestore
            await this.updateUserProfilePhoto(userId, downloadURL, fileName);

            // 6. Guardar metadatos en colección profile_photos
            await this.savePhotoMetadata(userId, downloadURL, fileName, file);

            return downloadURL;

        } catch (error) {
            console.error('Error subiendo foto de perfil:', error);
            throw new Error(`Error subiendo foto: ${error.message}`);
        }
    }

    /**
     * Actualiza la URL de la foto en el documento del usuario
     * @param {string} userId - ID del usuario
     * @param {string} photoURL - URL de la nueva foto
     * @param {string} fileName - Nombre del archivo
     */
    async updateUserProfilePhoto(userId, photoURL, fileName) {
        try {
            const userRef = doc(db, 'usuarios', userId);
            await updateDoc(userRef, {
                photoURL: photoURL,
                photoFileName: fileName,
                photoUpdatedAt: new Date()
            });
        } catch (error) {
            console.error('Error actualizando documento de usuario:', error);
            throw error;
        }
    }

    /**
     * Guarda metadatos de la foto en Firestore
     * @param {string} userId - ID del usuario
     * @param {string} photoURL - URL de la foto
     * @param {string} fileName - Nombre del archivo
     * @param {File} file - Archivo original
     */
    async savePhotoMetadata(userId, photoURL, fileName, file) {
        try {
            const photoRef = doc(db, 'profile_photos', userId);
            await setDoc(photoRef, {
                userId: userId,
                photoURL: photoURL,
                fileName: fileName,
                originalName: file.name,
                fileSize: file.size,
                fileType: file.type,
                uploadedAt: new Date(),
                lastUpdated: new Date()
            });
        } catch (error) {
            console.error('Error guardando metadatos de foto:', error);
            // No lanzamos el error ya que la foto ya se subió correctamente
        }
    }

    /**
     * Obtiene la foto de perfil actual del usuario
     * @param {string} userId - ID del usuario
     * @returns {Promise<string|null>} - URL de la foto o null si no tiene
     */
    async getCurrentProfilePhoto(userId) {
        try {
            const userRef = doc(db, 'usuarios', userId);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists() && userDoc.data().photoURL) {
                return userDoc.data().photoURL;
            }
            
            return null;
        } catch (error) {
            console.error('Error obteniendo foto de perfil:', error);
            return null;
        }
    }

    /**
     * Elimina completamente la foto de perfil del usuario
     * @param {string} userId - ID del usuario
     */
    async deleteProfilePhoto(userId) {
        try {
            // 1. Eliminar archivos de Storage
            await this.deleteOldProfilePhotos(userId);

            // 2. Actualizar documento del usuario
            const userRef = doc(db, 'usuarios', userId);
            await updateDoc(userRef, {
                photoURL: null,
                photoFileName: null,
                photoUpdatedAt: new Date()
            });

            // 3. Eliminar metadatos
            const photoRef = doc(db, 'profile_photos', userId);
            await setDoc(photoRef, {
                userId: userId,
                photoURL: null,
                deletedAt: new Date()
            });

        } catch (error) {
            console.error('Error eliminando foto de perfil:', error);
            throw new Error(`Error eliminando foto: ${error.message}`);
        }
    }
}

// Exportar instancia
export const profilePhotoManager = new ProfilePhotoManager();

// Funciones de utilidad para usar en la UI
export const uploadProfilePhoto = (userId, file, onProgress) => 
    profilePhotoManager.uploadProfilePhoto(userId, file, onProgress);

export const getCurrentProfilePhoto = (userId) => 
    profilePhotoManager.getCurrentProfilePhoto(userId);

export const deleteProfilePhoto = (userId) => 
    profilePhotoManager.deleteProfilePhoto(userId);