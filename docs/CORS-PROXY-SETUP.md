# Solución de Sincronización Challonge

## El Problema
El navegador bloquea las solicitudes directas a la API de Challonge por CORS. Esto evita que los usuarios se agreguen y remuevan correctamente de los torneos.

## La Solución
Se ha implementado un **proxy CORS local** que actúa como intermediario entre tu aplicación web y la API de Challonge.

## Instrucciones de Uso

### 1. Iniciar el Proxy CORS
Abre una terminal PowerShell en la carpeta del proyecto y ejecuta:

```powershell
node cors-proxy.js
```

O simplemente haz doble clic en `start-proxy.bat`

Deberías ver:
```
CORS Proxy running on http://localhost:3000
Usage: http://localhost:3000?url=<target-url>
```

### 2. Mantener el Proxy Corriendo
- Deja la terminal abierta mientras uses la aplicación
- El proxy estará disponible en `http://localhost:3000`
- Ciérralo con Ctrl+C cuando termines

### 3. Usar la Aplicación Normalmente
1. Abre la aplicación en el navegador (http://127.0.0.1:5500 o similar)
2. Haz check-in de usuarios (se agregarán a Challonge)
3. Cancela check-ins (ahora se removerán de Challonge correctamente)

## Cómo Funciona
```
Aplicación Web
      ↓ (por CORS, bloqueado directamente)
Navegador
      ↓ (proxy local, permitido)
Proxy Local (localhost:3000)
      ↓ (sin restricciones CORS)
API Challonge
```

## Solución Futura
Una vez que puedas habilitar billing en Firebase, se pueden usar las Cloud Functions que ya están implementadas, eliminando la necesidad del proxy local.

## Archivos Relacionados
- `cors-proxy.js` - El servidor proxy
- `start-proxy.bat` - Script para iniciar el proxy en Windows
- `assets/js/index-torneos.js` - Código que usa el proxy para las llamadas a Challonge
