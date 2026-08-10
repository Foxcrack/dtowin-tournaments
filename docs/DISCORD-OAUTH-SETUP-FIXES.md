# 🔧 Guía de Verificación - Discord OAuth en Netlify

## Paso 1: Verificar Configuración de Netlify

### A. Verifica tu Aplicación Discord
1. Abre https://discord.com/developers/applications/1493118118950604910
2. Ve a **OAuth2 > Redirects**
3. ✅ Debe haber UNA redirect URI registrada:
   ```
   https://foxcrack.github.io/dtowin-tournaments/discord-callback.html
   ```
4. Si NO está, **AGRÉGALA** y guarda cambios

### B. Verifica Variables de Entorno en Netlify
1. Abre https://app.netlify.com/sites/dtowin-tournaments/settings/deploys
2. Ve a **Build & Deploy > Environment variables**
3. ✅ Debe haber dos variables:
   - `DISCORD_CLIENT_ID`: `1493118118950604910`
   - `DISCORD_CLIENT_SECRET`: (Tu client secret desde Discord Developer Portal)

4. Si **FALTA** `DISCORD_CLIENT_SECRET`:
   - Ve a https://discord.com/developers/applications/1493118118950604910
   - Click en **OAuth2** en la izquierda
   - Click en **Reset Secret** (o copiar secret existente)
   - Cópia el **CLIENT SECRET**
   - Añade a Netlify como variable de entorno

## Paso 2: Prueba del Endpoint

### A. Test Endpoint de Configuración
Abre en tu navegador:
```
https://dtowin-tournaments.netlify.app/.netlify/functions/test
```

Deberías ver:
```json
{
  "status": "API Test Endpoint Ready",
  "environment": {
    "DISCORD_CLIENT_ID": "✅ Configurado",
    "DISCORD_CLIENT_SECRET": "✅ Configurado"
  }
}
```

Si ves `❌ NO configurado`, las variables de entorno no están en Netlify.

### B. Test del Flujo Completo
1. Ve a https://foxcrack.github.io/dtowin-tournaments/perfil.html
2. Inicia sesión con tu cuenta de Google/Firebase
3. Click en **"Vincular Discord"**
4. Completa el flujo en Discord
5. Abre DevTools (F12) > Console
6. Deberías ver logs como:
   ```
   ✅ Iniciando intercambio de código...
   ✅ Fetch completado. Status: 200
   ✅ Información recibida: {...}
   ```

## Paso 3: Debugging si aún falla

### A. Verifica el error exacto en la consola
En DevTools > Console, busca por:
- `Error intercambiando código:`
- `Fetch completado. Status:`

### B. Posibles Errores:

**Error 400 - "Token exchange failed"**
→ Discord rechazó el intercambio
→ Verifica que DISCORD_CLIENT_SECRET esté correcto

**Error 400 - "Código de autorización requerido"**
→ El código no se está pasando correctamente
→ Verifica que discord-config.js está siendo importado

**Error 500 - "Server config incomplete"**
→ Falta DISCORD_CLIENT_ID o DISCORD_CLIENT_SECRET en Netlify
→ Añade las variables y redeploy

**Error - "Redirect URI mismatch"**
→ El redirect_uri registrado en Discord NO coincide
→ Verifica que sea exactamente: `https://foxcrack.github.io/dtowin-tournaments/discord-callback.html`

## Paso 4: Deploy de Cambios

Los cambios que hicimos:
1. 📝 `discord-config.js` - Ahora envía `redirectUri` al API
2. 📝 `api/discord.js` - Ahora recibe y usa `redirectUri` del cliente
3. 🆕 `api/test.js` - Nuevo endpoint para verify configuration

Para aplicar cambios:
```bash
# En tu proyecto local:
git add .
git commit -m "Fix Discord OAuth - send redirectUri from client"
git push origin main

# En Netlify:
# Auto-redeploy (debería ocurrir automáticamente en push a main)
# O manual: Site settings > Deploys > Trigger deploy
```

## Checklist Final

- [ ] Discord Developer Portal: Redirect URI configurada
- [ ] Netlify: DISCORD_CLIENT_ID configurada
- [ ] Netlify: DISCORD_CLIENT_SECRET configurada  
- [ ] Test endpoint retorna "✅ Configurado" para ambas vars
- [ ] Cambios pushados a GitHub
- [ ] Netlify ha redeployado después del push
- [ ] Prueba de flujo completo en perfil.html funciona

---

**¿Aún no funciona?**
Comparte los logs de la consola (F12) cuando intentes conectar Discord.
