# 🚀 Desplegar Cloud Functions para Challonge

## ⚠️ IMPORTANTE
Las Cloud Functions son necesarias para que la sincronización con Challonge funcione sin errores de CORS.

## Pasos para Desplegar

### 1. Instalar dependencias en Cloud Functions
```bash
cd functions
npm install
cd ..
```

### 2. Configurar Firebase (si no está configurado)
```bash
firebase login
firebase init
```

### 3. Desplegar las Cloud Functions
```bash
firebase deploy --only functions
```

### 4. Copiar la URL de la Cloud Function
Después del despliegue, Firebase mostrará las URLs de las funciones:
```
✔  functions[addChallongeParticipant]: https://REGION-PROJECT_ID.cloudfunctions.net/addChallongeParticipant
✔  functions[removeChallongeParticipant]: https://REGION-PROJECT_ID.cloudfunctions.net/removeChallongeParticipant
```

### 5. Actualizar las URLs en index-torneos.js
Reemplazar en `assets/js/index-torneos.js` las funciones:

En `addParticipantToChallonge()` (aprox. línea 693):
```javascript
const functionUrl = 'https://REGION-PROJECT_ID.cloudfunctions.net/addChallongeParticipant';
```

En `removeParticipantFromChallonge()` (aprox. línea 721):
```javascript
const functionUrl = 'https://REGION-PROJECT_ID.cloudfunctions.net/removeChallongeParticipant';
```

Donde:
- `REGION` es tu región (ej: us-central1, europe-west1)
- `PROJECT_ID` es el ID de tu proyecto Firebase

## Qué Hacen las Cloud Functions

### addChallongeParticipant
- **Recibe**: `torneoId` y `gameUsername`
- **Hace**: Agrega el usuario como participante en Challonge
- **Ventaja**: No expone la API Key al navegador
- **Maneja CORS**: Ejecuta desde el servidor (sin restricciones)

### removeChallongeParticipant
- **Recibe**: `torneoId` y `gameUsername`
- **Hace**: Remueve el usuario de los participantes de Challonge
- **Ventaja**: No expone la API Key al navegador
- **Busca inteligentemente**: Ignora mayúsculas/minúsculas

## Cómo Funcionan Automáticamente

1. **Usuario hace check-in**
   - → `confirmAttendance()` se ejecuta
   - → Llama a Cloud Function `addChallongeParticipant`
   - → Participante agregado a Challonge

2. **Usuario cancela check-in**
   - → `cancelAttendance()` se ejecuta
   - → Llama a Cloud Function `removeChallongeParticipant`
   - → Participante removido de Challonge

## Permisos Necesarios
Las Cloud Functions necesitan acceso a:
- ✓ Leer colección `torneos` (para obtener datos de Challonge)
- ✓ Salir a internet (para llamar API de Challonge)

Estos permisos se configuran en `firebase.json` o Firestore Security Rules.

## Troubleshooting

### Error: "Function not found"
- Verificar que las Cloud Functions se desplegaron correctamente
- Ejecutar `firebase deploy --only functions` de nuevo

### Error: "CORS still blocked"
- Las URLs deben estar correctas en `index-torneos.js`
- La Cloud Function es del lado del servidor, por lo que no tendrá restricciones CORS

### El check-in funciona pero no aparece en Challonge
- Verificar en logs: `firebase functions:log`
- Validar que el torneo esté vinculado en el admin panel
- Comprobar que la API Key sea correcta

## Local Development
Para probar localmente:
```bash
firebase emulators:start --only functions
```

Luego actualizar en `index-torneos.js`:
```javascript
const functionUrl = 'http://localhost:5001/PROJECT_ID/us-central1/addChallongeParticipant';
```
