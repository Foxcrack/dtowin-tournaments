# 🚨 SOLUCIÓN para errores de CORS en Firebase Storage

## Problema identificado
Los errores en la consola muestran problemas de CORS (Cross-Origin Resource Sharing) al intentar subir fotos a Firebase Storage.

## 🔧 Soluciones paso a paso

### 1. Actualizar reglas de Storage en Firebase Console

**Ve a Firebase Console → Storage → Rules y pega esto:**

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // === FOTOS DE PERFIL ===
    match /profile_photos/{userId}/{allPaths=**} {
      // Lectura pública para mostrar fotos de perfil
      allow read: if true;
      
      // Solo el propietario puede subir/actualizar su foto de perfil
      // Los admins también pueden gestionar cualquier foto
      allow write: if request.auth != null && (
        request.auth.uid == userId ||
        request.auth.uid in ["dvblFee1ZnVKJNWBOR22tSAsNet2"]
      );
      
      // Solo el propietario o admin puede eliminar
      allow delete: if request.auth != null && (
        request.auth.uid == userId ||
        request.auth.uid in ["dvblFee1ZnVKJNWBOR22tSAsNet2"]
      );
    }
    
    // === BANNERS DE TORNEOS ===
    match /tournament-banners/{allPaths=**} {
      // Lectura pública
      allow read: if true;
      
      // Solo admins pueden gestionar banners
      allow write, delete: if request.auth != null && 
        request.auth.uid in ["dvblFee1ZnVKJNWBOR22tSAsNet2"];
    }
    
    // === BADGES ===
    match /badges/{allPaths=**} {
      // Lectura pública
      allow read: if true;
      
      // Solo admins pueden gestionar badges
      allow write, delete: if request.auth != null && 
        request.auth.uid in ["dvblFee1ZnVKJNWBOR22tSAsNet2"];
    }
    
    // === REGLA CATCH-ALL PARA SEGURIDAD ===
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### 2. Configurar CORS en Firebase Storage

#### Opción A: Usando Google Cloud Console
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto de Firebase
3. Ve a **Cloud Storage** → **Browser**
4. Selecciona tu bucket (debería ser algo como `dtowin-tournaments.appspot.com`)
5. Ve a la pestaña **Configuration**
6. En **CORS**, añade esta configuración:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization", "Range"]
  }
]
```

#### Opción B: Usando Google Cloud Shell (Recomendado)
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Abre **Cloud Shell** (ícono de terminal en la parte superior)
3. Ejecuta estos comandos:

```bash
# Crear archivo de configuración CORS
cat > cors.json << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Authorization", "Range"]
  }
]
EOF

# Aplicar configuración CORS a tu bucket
gsutil cors set cors.json gs://dtowin-tournaments.appspot.com
```

**⚠️ Importante:** Reemplaza `dtowin-tournaments.appspot.com` con el nombre real de tu bucket.

### 3. Verificar configuración de Firebase

Asegúrate de que tu archivo `firebase.js` tenga la configuración correcta:

```javascript
// Verificar que Storage esté inicializado
const storage = firebase.storage();

// Si usas Firebase v9+ modular, usar:
// import { getStorage } from 'firebase/storage';
// const storage = getStorage();
```

### 4. Solución temporal: Usar dominio correcto

Si estás probando desde `localhost`, asegúrate de que tu configuración de Firebase incluya `localhost` en los dominios autorizados:

1. Ve a **Firebase Console** → **Authentication** → **Settings**
2. En **Authorized domains**, añade:
   - `localhost`
   - `127.0.0.1`
   - Tu dominio de producción

### 5. Verificar el bucket name

En tu código JavaScript, asegúrate de que estés usando el bucket correcto:

```javascript
// Verificar que el bucket se esté referenciando correctamente
const fileRef = firebase.storage().ref().child(`profile_photos/${user.uid}/${Date.now()}-${newProfilePhoto.name}`);

// Si el problema persiste, intenta especificar el bucket explícitamente:
const fileRef = firebase.storage().ref().child(`profile_photos/${user.uid}/${Date.now()}-${newProfilePhoto.name}`);
```

## 🧪 Para probar la solución

1. **Aplica las reglas de Storage actualizadas**
2. **Configura CORS usando una de las opciones anteriores**
3. **Espera 2-3 minutos** para que los cambios se propaguen
4. **Refresca completamente tu página** (Ctrl+F5)
5. **Intenta subir una foto de perfil**

## 🔍 Verificar que funciona

Después de aplicar los cambios:

1. Abre **DevTools** (F12)
2. Ve a **Console**
3. Intenta subir una foto
4. **No deberían aparecer errores de CORS**
5. Deberías ver logs como:
   ```
   Archivo de foto seleccionado: imagen.jpg
   photoURL: https://firebasestorage.googleapis.com/...
   Actualizando foto en Auth
   ```

## 🆘 Si el problema persiste

1. **Verifica el nombre de tu bucket** en Firebase Console → Storage
2. **Comprueba que CORS se aplicó correctamente** ejecutando:
   ```bash
   gsutil cors get gs://TU-BUCKET-NAME.appspot.com
   ```
3. **Revisa los logs de Firebase** en la consola para más detalles
4. **Intenta desde una ventana de incógnito** para evitar problemas de caché

## ✅ Una vez que funcione

Las fotos se subirán a `/profile_photos/{uid}/timestamp-filename.ext` y se actualizarán automáticamente en:
- Firebase Auth (`user.photoURL`)
- Firestore (documento del usuario)
- Toda la interfaz de la aplicación

¡Con estos cambios debería funcionar perfectamente! 🎉