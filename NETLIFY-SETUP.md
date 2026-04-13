# Netlify Functions Configuration

Para migrar de Vercel a Netlify Functions (más simple y confiable):

## Paso 1: Conectar a Netlify

1. Ve a https://app.netlify.com
2. Click "New site from Git"
3. Conecta el repo de GitHub: `Foxcrack/dtowin-tournaments`
4. Build command: (déjalo vacío)
5. Publish directory: `.` (raíz)

## Paso 2: Crear archivo de configuración

Veremos que Netlify automáticamente detecta la carpeta `api/` y la trata como Functions.

## Paso 3: Configurar variables de entorno

En Netlify:
- Site settings → Build & deploy → Environment
- Agrega las mismas variables de Discord:
  - DISCORD_CLIENT_ID
  - DISCORD_CLIENT_SECRET
  - DISCORD_REDIRECT_URI

## Paso 4: Actualizar URL en discord-config.js

Cambiar:
```javascript
CLOUD_FUNCTION_URL: 'https://dtowin-tournaments.netlify.app/.netlify/functions/discord'
```

Cuando publiques en Netlify, automáticamente expone `api/discord.js` en `/.netlify/functions/discord`

## Ventajas sobre Vercel:

✅ Detección automática de `api/` como Functions
✅ Mejor integración git
✅ Más simple para proyectos estáticos + API
✅ Mismo nivel de free tier
