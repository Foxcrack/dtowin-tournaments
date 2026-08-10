# 🎮 Guía: Vincular Discord a Perfil Dtowin

Este documento explica cómo configurar la vinculación de Discord en tu plataforma de torneos Dtowin.

## 📋 Resumen de Cambios

Se han agregado las siguientes funcionalidades:

1. **Botón "Vincular Discord"** en el modal de edición de perfil
2. **Mostrar información de Discord** en el perfil del usuario (icono + username)
3. **Autocompletar Discord** en formularios de inscripción a torneos
4. **Cloud Function** para manejar OAuth de Discord de forma segura
5. **Vinculación y desvinculación** de cuentas de Discord

---

## 🔧 Configuración Requerida

> **📝 NOTA**: Para GitHub Pages + Firebase, ve a **[FIREBASE-CONSOLE-SETUP.md](FIREBASE-CONSOLE-SETUP.md)** para una guía específica paso a paso.

### 1. Crear una Aplicación en Discord Developer Portal

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Haz clic en **"New Application"** (Ícono +)
3. Dale un nombre: **"Dtowin Torneos"** (o el que prefieras)
4. Acepta los términos y crea la aplicación

### 2. Configurar OAuth2

En tu aplicación de Discord:

1. Ve a **"OAuth2"** → **"General"** en el menú lateral
2. Copia tu **Client ID** (lo necesitarás después)
3. Haz clic en **"Reset Secret"** para obtener tu **Client Secret** (guárdalo en un lugar seguro)
4. Ve a **"OAuth2"** → **"Redirect"**
5. Haz clic en **"Add Redirect"** y agrega:
   ```
   https://tu-dominio.firebaseapp.com/discord-callback.html
   ```
   (También agrega para desarrollo local: `http://localhost:5000/discord-callback.html` si lo necesitas)

### 3. Configurar Variables de Entorno en Cloud Functions

1. Abre tu terminal en la carpeta `functions/`
2. Edita el archivo `.env` (o créalo si no existe):
   ```bash
   DISCORD_CLIENT_ID=TU_CLIENT_ID_AQUI
   DISCORD_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
   DISCORD_REDIRECT_URI=https://tu-dominio.firebaseapp.com/discord-callback.html
   ```

3. También puedes configurar estas variables en Firebase Console:
   - Ve a **Cloud Functions** → Selecciona `exchangeDiscordCode`
   - En la sección **Runtime settings** → **Environment variables**
   - Agrega:
     - `DISCORD_CLIENT_ID=TU_CLIENT_ID`
     - `DISCORD_CLIENT_SECRET=TU_CLIENT_SECRET`
     - `DISCORD_REDIRECT_URI=tu_url`

### 4. Actualizar discord-config.js

En el archivo `discord-config.js` (raíz del proyecto), reemplaza:
```javascript
CLIENT_ID: 'YOUR_DISCORD_CLIENT_ID'
```
con tu ID de Discord:
```javascript
CLIENT_ID: '1234567890123456789'
```

También verifica que la URL de Cloud Function sea correcta:
```javascript
CLOUD_FUNCTION_URL: 'https://us-central1-dtowin-tournament.cloudfunctions.net/exchangeDiscordCode'
```

### 5. Reemplazar en perfil.js

En el archivo `assets/js/perfil.js`, busca la función `linkDiscordAccount()` y reemplaza:
```javascript
const discordClientId = 'YOUR_DISCORD_CLIENT_ID';
```
con tu Client ID real.

### 6. Desplegar Cloud Functions

```bash
cd functions
npm install  # Si no ya lo hiciste
firebase deploy --only functions
```

---

## 📱 Uso: Cómo Vincular Discord

### Para Usuarios:

1. **Ir al Perfil**
   - Haz clic en "Mi Perfil" en la navegación

2. **Editar Perfil**
   - Haz clic en "Editar Perfil"

3. **Vincular Discord**
   - En la sección "Vinculación de Discord", haz clic en el botón azul **"Vincular Discord"**
   - Serás redirigido a Discord para autorizar
   - Autoriza el acceso
   - Serás redirigido de vuelta a tu perfil

4. **Ver Discord en el Perfil**
   - Una vez vinculado, verás tu nombre de Discord con el icono morado de Discord en tu perfil

5. **Desvincular Discord**
   - En el modal de edición, verás el botón rojo **"Desvincular Discord"**
   - Haz clic para desvincularse

### Para Inscripciones:

1. Cuando te inscribas en un torneo, selecciona un campo de Discord
2. Si tienes Discord vinculado, el campo se autocompletará automáticamente
3. Puedes editarlo si necesitas cambiar el nombre

---

## 🔒 Seguridad

- Los **Client Secrets nunca se exponen** en el cliente
- Todo el intercambio OAuth se maneja en **Cloud Functions** del lado del servidor
- Los datos de Discord se **almacenan encriptados en Firestore**
- Se valida el **state token** para proteger contra ataques CSRF

---

## 📊 Estructura de Datos en Firestore

Cuando un usuario vincula Discord, se guarda así en la colección `usuarios`:

```javascript
{
  uid: "usuario_uid",
  nombre: "Usuario",
  email: "usuario@gmail.com",
  discord: {
    id: "123456789",
    username: "usuario_discord",
    avatar: "hash_avatar",
    discriminator: "0000",
    connectedAt: timestamp
  },
  // ... otros campos
}
```

---

## 🐛 Solucución de Problemas

### Error: "Discord Client ID no configurado"
- Verifica que hayas actualizado `discord-config.js` con tu Client ID real
- Asegúrate de haber reemplazado `YOUR_DISCORD_CLIENT_ID` en `perfil.js`

### Error: "Error al intercambiar código"
- Verifica que tu **Redirect URI** en Discord Developer Portal coincida exactamente
- Confirma que las variables de entorno están configuradas en Cloud Functions
- Revisa los logs de Cloud Functions: `firebase functions:log`

### El Discord no se muestra en el perfil
- Verifica que el usuario haya completado el flujo de vinculación
- Revisa Firestore: La colección `usuarios` debe tener el campo `discord` poblado
- Recarga la página (Ctrl+F5 para limpiar caché)

### Autocompletar Discord no funciona
- Asegúrate de que el usuario tenga Discord vinculado
- Verifica que los selectores CSS del formulario de inscripción sean correctos
- Abre la consola del navegador para ver mensajes de error

---

## 📚 Funciones Disponibles

### En `perfil.js`:
```javascript
linkDiscordAccount()           // Inicia flujo OAuth
unlinkDiscord()                // Desvincula Discord
updateDiscordStatus()          // Actualiza estado en modal
loadDiscordInfo(userData)      // Carga info en perfil
```

### En `registration.js`:
```javascript
getUserDiscordInfo()           // Obtiene Discord del usuario
autoCompleteDiscordField(selector)  // Autocompleta un campo
```

---

## 🎯 Próximos Pasos

1. **Bot de Discord**: Puedes crear un bot que se comunique con tu Firestore
2. **Notificaciones**: Enviar notificaciones por Discord cuando hay cambios en torneos
3. **Roles en Discord**: Asignar roles en un servidor Discord basado en badges/puntos

---

## ⚠️ Notas Importantes

- **Desarrollo Local**: Para probar localmente, configura `http://localhost:5000/discord-callback.html` como Redirect URI
- **Producción**: Asegúrate de usar HTTPS en la URL de producción
- **Rate Limits**: Discord API tiene límites de tasa. Ver: [Discord Rate Limits](https://discord.com/developers/docs/topics/rate-limits)
- **Expiración de Tokens**: Los tokens de acceso de Discord expiran. Actualmente no se renueva, pero puedes agregarlo si es necesario

---

## 📞 Soporte

Si tienes preguntas sobre la implementación:
1. Revisa los logs de Cloud Functions: `firebase functions:log`
2. Verifica la consola del navegador (F12)
3. Consulta la [Documentación de Discord OAuth2](https://discord.com/developers/docs/topics/oauth2)
