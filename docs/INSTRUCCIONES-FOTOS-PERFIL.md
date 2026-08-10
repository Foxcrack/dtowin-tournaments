# Instrucciones para habilitar la carga de fotos de perfil

## 🚀 Pasos para implementar las reglas

### 1. Aplicar reglas de Firestore
1. Ve a la [Consola de Firebase](https://console.firebase.google.com/)
2. Selecciona tu proyecto "dtowin-tournaments"
3. Ve a **Firestore Database** → **Rules**
4. Copia y pega el contenido del archivo `firestore-rules.txt`
5. Haz clic en **"Publish"**

### 2. Aplicar reglas de Storage
1. En la misma consola de Firebase
2. Ve a **Storage** → **Rules**
3. Copia y pega el contenido del archivo `firebase-storage-rules.txt`
4. Haz clic en **"Publish"**

### 3. Verificar configuración de Storage
Asegúrate de que Firebase Storage esté habilitado:
1. Ve a **Storage** en tu consola
2. Si no está configurado, haz clic en **"Get started"**
3. Selecciona el modo de prueba por ahora
4. Elige una ubicación (preferiblemente la más cercana a tus usuarios)

## 📋 Qué cambios incluyen las nuevas reglas

### Firestore:
- ✅ **Usuarios pueden actualizar sus propios perfiles** (incluyendo foto)
- ✅ **Soporte para documentos identificados por UID o con campo uid**
- ✅ **Mantiene todas las funcionalidades existentes**
- ✅ **Seguridad mejorada para admins/hosts**

### Storage:
- ✅ **Usuarios pueden subir fotos a `/profile_photos/{uid}/`**
- ✅ **Lectura pública de fotos de perfil**
- ✅ **Solo el propietario puede modificar/eliminar sus fotos**
- ✅ **Admins pueden gestionar cualquier foto**
- ✅ **Estructura organizada por carpetas**

## 🔧 Funcionalidades ya implementadas en el código

Tu código JavaScript (`perfil.js`) ya incluye:
- ✅ **Validación de archivos** (solo imágenes, máximo 2MB)
- ✅ **Vista previa** antes de subir
- ✅ **Subida a Storage** en la ruta correcta
- ✅ **Actualización de Auth y Firestore**
- ✅ **Manejo de errores**
- ✅ **Interfaz de usuario** completa

## 🎯 Cómo usar la funcionalidad

### Para usuarios:
1. Van a su perfil
2. Hacen clic en "Editar Perfil"
3. Hacen clic en "Cambiar foto"
4. Seleccionan una imagen (JPG, PNG, WebP, máx 2MB)
5. Ven la vista previa
6. Hacen clic en "Guardar Cambios"
7. La foto se sube automáticamente y se actualiza en toda la app

### Para desarrolladores:
- Las fotos se almacenan en `/profile_photos/{uid}/timestamp-filename.ext`
- Se actualiza automáticamente `photoURL` en Auth y Firestore
- Se eliminan automáticamente fotos anteriores al subir una nueva

## 🛡️ Seguridad implementada

1. **Validación de archivos**: Solo imágenes permitidas
2. **Límite de tamaño**: Máximo 2MB por imagen  
3. **Autenticación requerida**: Solo usuarios autenticados
4. **Propiedad de archivos**: Cada usuario solo puede gestionar sus fotos
5. **Rutas organizadas**: Fotos separadas por usuario
6. **Admins con permisos especiales**: Pueden gestionar cualquier foto

## 🔍 Solución de problemas

### Si aún obtienes errores de permisos:
1. **Verifica que las reglas se publicaron correctamente**
2. **Espera 1-2 minutos** para que se propaguen
3. **Refresca la página** del navegador
4. **Verifica en la consola de Firebase** que no hay errores de sintaxis

### Si las fotos no se muestran:
1. **Verifica las reglas de Storage** (lectura pública habilitada)
2. **Comprueba la consola del navegador** para errores de red
3. **Asegúrate de que Storage esté habilitado** en tu proyecto

### Para depurar:
- Abre las **DevTools** del navegador (F12)
- Ve a la pestaña **Console**
- Los logs mostrarán el progreso de la subida
- Los errores de permisos aparecerán claramente

## 📞 Soporte adicional

Si necesitas ayuda adicional, puedes:
1. Revisar los logs en la consola del navegador
2. Verificar la configuración en Firebase Console
3. Comprobar que el proyecto Firebase esté correctamente configurado

¡Las reglas están optimizadas y deberían funcionar perfectamente! 🎉