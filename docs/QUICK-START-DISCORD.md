# 🚀 Quick Start: Vincular Discord a Dtowin (GitHub Pages Edition)

## ✅ Qué Ya Está Hecho

Tu proyecto está **casi listo** para funcionar. Hemos actualizado automáticamente:

- ✅ `discord-config.js` con tu Client ID: `1493118118950604910`
- ✅ `perfil.js` con tu Client ID
- ✅ `functions/.env` con todas tus credenciales
- ✅ Redirect URI configurado a: `https://foxcrack.github.io/dtowin-tournaments/discord-callback.html`

---

## 📋 Solo Necesitas Hacer 3 Cosas

### 1️⃣ VERIFICAR en Discord Developer Portal

1. Ve a: https://discord.com/developers/applications
2. Abre tu aplicación "Dtowin Torneos"
3. Ve a **OAuth2** → **Redirects**
4. Verifica que esté agregado:
   ```
   https://foxcrack.github.io/dtowin-tournaments/discord-callback.html
   ```
   - Si no está, haz clic en **"Add Redirect"** y agrega este URL

✅ Listo, Discord está configurado.

---

### 2️⃣ DESPLIEGA en Firebase

Ejecuta en tu terminal:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Espera a que termine. Verás algo como:

```
✔ Deploy complete!
```

✅ Listo, Cloud Functions está actualizada.

---

### 3️⃣ VERIFICA que todo funciona

1. Ve a: https://foxcrack.github.io/dtowin-tournaments/
2. Inicia sesión (con Google)
3. Ve a **"Mi Perfil"** → **"Editar Perfil"**
4. Busca la sección **"Vinculación de Discord"**
5. Haz clic en **"Vincular Discord"**
6. Deberías ser redirigido a Discord para autorizar
7. Después de autorizar, regresarás a tu perfil

✅ ¡Listo! Discord está vinculado.

---

## 🎯 Eso es TODO

No necesitas hacer nada más. Los archivos necesarios ya están:

- `discord-config.js` ← Configurado
- `discord-callback.html` ← Listo en GitHub
- `functions/.env` ← Con tus secretos
- `functions/index.js` → Cloud Function lista

---

## 🐛 Si algo no funciona

### Error: Redirección a Discord no funciona
1. Verifica que el Redirect URI esté exacto en Discord Developer Portal
2. Verifica que `discord-callback.html` exista en GitHub Pages:
   - Ve a: https://foxcrack.github.io/dtowin-tournaments/discord-callback.html
   - Debe mostrar una página con un spinner

### Error: "Error al intercambiar código"
1. Ejecuta: `firebase functions:log` para ver el error exacto
2. Verifica que `functions/.env` tenga las credenciales correctas
3. Redeploy: `firebase deploy --only functions`

### Error: "No se muestra Discord en el perfil"
1. Verifica que autenticación funcionó (debe regresar a discord-callback.html)
2. Recarga la página (Ctrl+F5 para limpiar caché)
3. Abre la consola del navegador (F12) para ver errores

---

## 📚 Documentación Completa

- **Setup detallado**: [SETUP-DISCORD-OAUTH.md](SETUP-DISCORD-OAUTH.md)
- **Firebase Console**: [FIREBASE-CONSOLE-SETUP.md](FIREBASE-CONSOLE-SETUP.md)
- **Solución de problemas**: Ver ambos documentos anteriores

---

## ✨ Lo que Pueden Hacer los Usuarios Ahora

✅ Vincular su cuenta de Discord al perfil  
✅ Ver su username de Discord en el perfil (con icono morado)  
✅ Desvincular Discord si quieren  
✅ Auto-llenar Discord cuando se inscriben a torneos  
✅ Ver el Discord vinculado de otros usuarios en sus perfiles públicos  

---

## 🎉 ¡Listo!

Sigue los 3 pasos de arriba y tendrás Discord completamente funcional.

¿Preguntas? Ver la documentación completa en:
- [FIREBASE-CONSOLE-SETUP.md](FIREBASE-CONSOLE-SETUP.md) - Para Firebase Console
- [SETUP-DISCORD-OAUTH.md](SETUP-DISCORD-OAUTH.md) - Para todo lo demás
