# ⚙️ Guía de Configuración en Firebase Console (GitHub Pages + Firebase Backend)

Este documento explica cómo configurar las variables de entorno de Cloud Functions en Firebase Console, específicamente para tu setup con GitHub Pages como frontend y Firebase como backend.

## 📋 Tu Configuración

- **Frontend**: GitHub Pages (`https://foxcrack.github.io/dtowin-tournaments/`)
- **Backend**: Firebase Cloud Functions
- **Base de Datos**: Firestore
- **Discord Client ID**: `1493118118950604910`
- **Discord Redirect URI**: `https://foxcrack.github.io/dtowin-tournaments/discord-callback.html`

---

## 🔧 Opción 1: Configurar en Firebase Console (RECOMENDADO)

### Paso 1: Acceder a Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **"dtowin-tournament"**

### Paso 2: Ir a Cloud Functions

1. En el menú lateral izquierdo, haz clic en **"Compilación"** (Build)
2. Selecciona **"Cloud Functions"**
3. Encontrarás la función `exchangeDiscordCode`

### Paso 3: Editar la Función

1. Haz clic en **"exchangeDiscordCode"**
2. Haz clic en la pestaña **"Runtime settings"** (Ajustes de runtime) en la parte superior
3. Expande la sección **"Runtime environment variables"** (Variables de entorno runtime)

### Paso 4: Agregar Variables de Entorno

Haz clic en **"+ Add variable"** y agrega las siguientes tres variables:

| Nombre | Valor |
|--------|-------|
| `DISCORD_CLIENT_ID` | `1493118118950604910` |
| `DISCORD_CLIENT_SECRET` | `e-3vrbqMrjBQEroK13DkW0EoPBccMlD3` |
| `DISCORD_REDIRECT_URI` | `https://foxcrack.github.io/dtowin-tournaments/discord-callback.html` |

### Paso 5: Guardar

- Haz clic en **"Deploy"** o **"Save"**
- Espera a que la función se redeploy (verás un ícono de carga)
- Debe mostrar un ✅ verde cuando esté lista

---

## 🔧 Opción 2: Configurar Localmente y Desplegar

### Paso 1: Configurar Archivo .env Localmente

Ya hemos creado `functions/.env` con tus credenciales. Verifica que contenga:

```bash
DISCORD_CLIENT_ID=1493118118950604910
DISCORD_CLIENT_SECRET=e-3vrbqMrjBQEroK13DkW0EoPBccMlD3
DISCORD_REDIRECT_URI=https://foxcrack.github.io/dtowin-tournaments/discord-callback.html
```

### Paso 2: Desplegar Cloud Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Firebase CLI leerá las variables del archivo `.env` y las configurará automáticamente en Cloud Functions.

---

## ✅ Verificar que Está Configurado

### En Firebase Console:

1. Ve a **Cloud Functions**
2. Haz clic en **"exchangeDiscordCode"**
3. Ve a **"Runtime settings"**
4. Verifica que las 3 variables estén ahí con sus valores

### En la Terminal (si desplegaste localmente):

```bash
firebase functions:config:get
```

Deberías ver algo como:

```
{
  "discord": {
    "client_id": "1493118118950604910",
    "client_secret": "e-3vrbqMrjBQEroK13DkW0EoPBccMlD3",
    "redirect_uri": "https://foxcrack.github.io/dtowin-tournaments/discord-callback.html"
  }
}
```

---

## 🎯 Próximos Pasos

1. **Verificar que Discord OAuth esté configurado**
   - Ve a [Discord Developer Portal](https://discord.com/developers/applications)
   - Selecciona tu aplicación "Dtowin Torneos"
   - Ve a **OAuth2** → **Redirects**
   - Verifica que `https://foxcrack.github.io/dtowin-tournaments/discord-callback.html` esté en la lista

2. **Probar la Vinculación**
   - Ve a tu sitio: `https://foxcrack.github.io/dtowin-tournaments/`
   - Inicia sesión
   - Ve a "Mi Perfil" → "Editar Perfil"
   - Haz clic en "Vincular Discord"
   - Deberías ser redirigido a Discord

3. **Si algo falla, revisa los logs**
   ```bash
   firebase functions:log
   ```

---

## ⚠️ Notas Importantes para GitHub Pages

### GitHub Pages + Firebase Backend

Tu setup es especial porque:

- ✅ **Ventaja**: No necesitas servidor Node.js para la web
- ✅ **Ventaja**: GitHub Pages es gratis y rápido
- ⚠️ **Nota**: El archivo `discord-callback.html` DEBE estar en GitHub Pages

### Ubicación del archivo discord-callback.html

**IMPORTANTE**: El archivo `discord-callback.html` **DEBE** estar en tu repositorio de GitHub en la ruta:

```
/dtowin-tournaments/discord-callback.html
```

Si no está, Discord no podrá redirigir después de la autorización.

### Verificar que el archivo está en GitHub Pages

1. Ve a `https://foxcrack.github.io/dtowin-tournaments/discord-callback.html` en tu navegador
2. Deberías ver una página con un spinner que dice "Verificando tu cuenta de Discord..."
3. Si ves un error 404, el archivo no está en el repositorio

---

## 🔒 Seguridad

### ⚠️ IMPORTANTE: NO COMMITS CON SECRETOS

**NUNCA** hagas commit del archivo `.env` con tus secretos en GitHub. 

**DEBE hacer**:

```bash
# En la raíz del proyecto
echo "functions/.env" >> .gitignore
git rm --cached functions/.env  # Si ya fue commited
git commit -m "Remove .env from tracking"
```

Tus secretos están seguros porque están en **Cloud Functions** (Firebase), no en GitHub.

---

## 🧪 Pruebas

### Test 1: Verificar que Cloud Function existe

```bash
firebase functions:list
```

Deberías ver `exchangeDiscordCode` en la lista.

### Test 2: Verificar variables de entorno

```bash
firebase functions:config:get
```

Deberías ver tus variables de Discord.

### Test 3: Hacer llamada de prueba a la función

```bash
curl -X POST https://us-central1-dtowin-tournament.cloudfunctions.net/exchangeDiscordCode \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code"}'
```

Deberías recibir un error JSON (es normal, es solo para verificar que la función responde).

---

## 📞 Soporte

Si tienes problemas:

1. **Verificar .env está configurado**
   ```bash
   cat functions/.env
   ```

2. **Verificar Firebase Console tiene las variables**
   - Cloud Functions → exchangeDiscordCode → Runtime settings

3. **Ver logs de errores**
   ```bash
   firebase functions:log
   ```

4. **Verificar Discord Redirect URI coincide**
   - Discord Developer Portal → OAuth2 → Redirects
   - Debe ser exactamente: `https://foxcrack.github.io/dtowin-tournaments/discord-callback.html`

---

## 📋 Checklist Final

- [ ] `.env` creado en `functions/` con credenciales
- [ ] Variables configuradas en Firebase Console (si elegiste esa opción)
- [ ] Cloud Functions desplegadas: `firebase deploy --only functions`
- [ ] `discord-callback.html` está en GitHub Pages
- [ ] Discord Redirect URI configurada en Discord Developer Portal
- [ ] Proyecto Dtowin dice que Discord está correctamente configurado
- [ ] Prueba: Vincular Discord desde el perfil funciona

---

## 🎉 ¡Listo!

Una vez todo esté configurado, los usuarios podrán:

1. Ir a su perfil
2. Editar perfil
3. Vincular Discord
4. Ver su username de Discord en el perfil
5. Auto-completar Discord en inscripciones a torneos

¡Éxito! 🚀
