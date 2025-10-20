// Solución temporal para CORS - Agregar al inicio de perfil.js

// Configurar Storage con configuración personalizada
function initializeCustomStorage() {
    // Verificar que Firebase esté cargado
    if (typeof firebase === 'undefined') {
        console.error('Firebase no está cargado');
        return false;
    }

    try {
        // Configuración personalizada para Storage
        const storage = firebase.storage();
        
        // Establecer configuración de CORS en el lado del cliente
        const customConfig = {
            maxOperationRetryTime: 60000,
            maxUploadRetryTime: 120000
        };

        // Aplicar configuración si es posible
        if (storage.setMaxOperationRetryTime) {
            storage.setMaxOperationRetryTime(customConfig.maxOperationRetryTime);
            storage.setMaxUploadRetryTime(customConfig.maxUploadRetryTime);
        }

        console.log('Storage configurado correctamente');
        return true;
    } catch (error) {
        console.error('Error configurando Storage:', error);
        return false;
    }
}

// Función mejorada para subir fotos con mejor manejo de errores
async function uploadProfilePhotoWithRetry(user, file, maxRetries = 3) {
    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            console.log(`Intento ${attempt + 1} de subida de foto`);
            
            // Crear referencia con timestamp más específico
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substr(2, 9);
            const fileName = `${timestamp}-${randomId}-${file.name}`;
            const path = `profile_photos/${user.uid}/${fileName}`;
            
            console.log('Subiendo a:', path);
            
            // Crear referencia
            const storageRef = firebase.storage().ref();
            const fileRef = storageRef.child(path);
            
            // Configurar metadatos
            const metadata = {
                contentType: file.type,
                customMetadata: {
                    userId: user.uid,
                    uploadedAt: new Date().toISOString()
                }
            };
            
            // Subir archivo con metadatos
            const snapshot = await fileRef.put(file, metadata);
            console.log('Archivo subido exitosamente:', snapshot);
            
            // Obtener URL de descarga
            const downloadURL = await snapshot.ref.getDownloadURL();
            console.log('URL de descarga obtenida:', downloadURL);
            
            return downloadURL;
            
        } catch (error) {
            attempt++;
            console.error(`Error en intento ${attempt}:`, error);
            
            if (attempt >= maxRetries) {
                throw new Error(`No se pudo subir la foto después de ${maxRetries} intentos: ${error.message}`);
            }
            
            // Esperar antes del siguiente intento
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

// Exportar para uso global
window.uploadProfilePhotoWithRetry = uploadProfilePhotoWithRetry;
window.initializeCustomStorage = initializeCustomStorage;