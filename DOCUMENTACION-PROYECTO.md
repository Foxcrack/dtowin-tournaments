# Documentacion del Proyecto Dtowin Tournaments

## 1. Resumen
Este repositorio contiene una plataforma web de torneos con:
- Frontend publico (listado de torneos, inscripcion, check-in, leaderboard, perfil).
- Panel administrativo (dashboard, torneos, participantes, badges, banners, resultados).
- Backend en Firebase (Firestore, Auth, Storage, Rules) y Cloud Functions para integracion con Challonge.
- Proxy local opcional para evitar CORS con Challonge en desarrollo local.

## 2. Stack Tecnologico
- Frontend: HTML + CSS + JavaScript vanilla (sin framework SPA).
- Estilos: Tailwind CSS CDN + CSS propio en `assets/css/`.
- Auth/DB/Storage: Firebase (Auth, Firestore, Storage).
- Backend serverless: Firebase Cloud Functions (`functions/index.js`).
- Integracion externa: API de Challonge.
- Runtime local auxiliar: Node.js para `cors-proxy.js`.

## 3. Estructura General del Repositorio

```text
.
|- admin/                        # Vistas HTML del panel admin
|- assets/
|  |- css/                       # Estilos principales
|  |- img/                       # Imagenes (logo, mascota)
|  |- js/                        # Logica principal frontend y admin
|- functions/                    # Firebase Cloud Functions
|- dtowin-tournaments-main/      # Copia/variante legacy del proyecto
|- index.html                    # Splash/redirect de entrada
|- index-torneos.html            # Home principal de torneos
|- leaderboard-completo.html     # Leaderboard global completo
|- perfil.html                   # Perfil publico/propio
|- firebase.json                 # Config Firebase
|- firestore.rules               # Reglas de seguridad
|- firestore.indexes.json        # Indices Firestore
|- cors-proxy.js                 # Proxy local CORS para Challonge
|- CORS-PROXY-SETUP.md           # Guia del proxy
|- DEPLOY_CLOUD_FUNCTIONS.md     # Guia deploy functions
```

Notas:
- `dtowin-tournaments-main/` replica gran parte de los archivos (rama/copia historica).
- Hay archivos duplicados entre raiz, `assets/js/` y `dtowin-tournaments-main/`.

## 4. Entradas Web Principales
- `index.html`: pantalla de bienvenida con redireccion.
- `index-torneos.html`: pagina principal publica.
- `leaderboard-completo.html`: ranking completo de usuarios.
- `perfil.html`: perfil de usuario y edicion de cuenta.
- `inscripcion_torneo.html`: pagina de prueba/demo de inscripcion.
- `admin/admin-panel.html`: dashboard admin.
- `admin/admin-torneos.html`: gestion de torneos.
- `admin/admin-participantes.html`: gestion de usuarios/roles/puntos.
- `admin/admin-badges.html` y `admin/admin-badges-nuevo.html`: gestion de badges.
- `admin/admin-banners.html`: gestion de banners.
- `admin/admin-resultados.html`: gestion de resultados y emparejamientos.

## 5. Modulos JavaScript (carpeta `assets/js`)

### 5.1 Publico
- `index-torneos.js` (archivo principal publico):
  - Carga torneos por estado.
  - Usa listeners en tiempo real (`onSnapshot`) para torneos e inscripciones.
  - Maneja inscripcion/desinscripcion/check-in.
  - Muestra modal de inscritos.
  - Carga top leaderboard.
  - Integra Challonge (agregar/remover participantes).
- `auth.js`: login/registro con Google, creacion/actualizacion de perfil en `usuarios`.
- `perfil.js`: carga perfil propio/publico, estadisticas, badges, historial, edicion de perfil, foto y banner.
- `leaderboard.js`: ranking completo, soporte de banner por usuario.
- `registration.js`: modulo alterno/legacy para registro y check-in (usa arrays `participants` y `checkedInParticipants`).
- `torneos.js` y `torneos-eventos.js`: logica adicional/legacy de carga de torneos e interacciones.

### 5.2 Admin
- `admin-panel.js`: dashboard (contadores y proximos torneos).
- `admin-panel-tournaments.js`: CRUD de torneos, banners, badges por posicion.
- `admin-panel-participants.js`: gestion de participantes, roles host, puntos, badges, expulsion de torneo.
- `admin-panel-badges.js`: CRUD de badges (incluye imagenes base64/url).
- `admin-panel-banners.js`: CRUD de banners.
- `admin-resultados.js` + `admin-resultados-db.js`: resultados por torneo, posiciones, emparejamientos.
- `admin-panel-config.js`: modulo de configuracion (depende de imports que no siempre coinciden con la estructura real).

### 5.3 Utilidades
- `utils.js`: notificaciones y utilidades de zona horaria.
- `storage-fix.js`, `profile-photo-manager.js`, `profile-photo-ui.js`: utilidades de foto/perfil/storage.
- Archivos vacios detectados:
  - `assets/js/admin-challonge-linker.js`
  - `assets/js/admin-panel-results.js`
  - `assets/js/challonge-check-in.js`

## 6. Modelo de Datos (Firestore)
Colecciones identificadas en codigo y reglas:
- `usuarios`
- `torneos`
  - Subcoleccion: `torneos/{torneoId}/inscripciones`
- `inscripciones` (global, tambien existe)
- `participant_info`
- `badges`
- `banners`
- `tournament_badges`
- `user_badges`
- `brackets`
- `profile_photos`
- `config` (usada por modulo admin config)
- `manual_participants` (referenciada en `registration.js`)
- `resultados` (referenciada por `admin-panel-config.js`)

Observacion importante:
- Conviven dos modelos de inscripcion:
  1. Subcoleccion por torneo (`torneos/{id}/inscripciones`).
  2. Arrays en documento torneo (`participants`, `checkedInParticipants`) + `participant_info`.

## 7. Seguridad (Firestore Rules)
Archivo: `firestore.rules`
- Lectura publica para varias colecciones (`usuarios`, `torneos`, `badges`, etc.).
- Escritura restringida con funciones:
  - `isAdminOrHost()` (UID fijo o campo `isHost`).
  - `isOwner(userId)` para recursos propios.
- Torneos: create/update/delete solo admin/host.
- Inscripciones: propietario o admin/host.
- Regla catch-all final: deniega todo lo no explicitado.

## 8. Cloud Functions y Challonge
Archivo: `functions/index.js`
- `helloWorld` (placeholder).
- `addChallongeParticipant`.
- `removeChallongeParticipant`.

Funcion:
- Leen `torneos/{torneoId}` para obtener `challonge.slug` y `challonge.apiKey`.
- Ejecutan llamadas server-side a API Challonge (evita CORS y evita exponer API key al cliente).

Estado actual del frontend:
- `assets/js/index-torneos.js` aun contiene llamadas directas y via proxy local en ciertas rutas.
- Documentos de soporte:
  - `CORS-PROXY-SETUP.md`
  - `DEPLOY_CLOUD_FUNCTIONS.md`

## 9. Flujo Funcional del Sistema

### 9.1 Usuario final
1. Entra por `index.html` -> redireccion a `index-torneos.html`.
2. Inicia sesion con Google.
3. Se crea/actualiza perfil en `usuarios`.
4. Se inscribe en torneos abiertos.
5. Hace check-in en estado `Check In`.
6. Visualiza leaderboard y perfil (estadisticas/badges/historial).

### 9.2 Administrador
1. Accede a `admin/admin-panel.html`.
2. Validacion por UID admin fijo o `isHost` en `usuarios`.
3. Gestiona torneos, banners, badges, participantes y resultados.
4. Al finalizar torneos, actualiza resultados/puntos/emparejamientos.

## 10. Configuracion y Ejecucion Local

### Dependencias raiz
- `package.json` raiz: `node-fetch` (uso auxiliar).

### Dependencias functions
- `functions/package.json`: `firebase-admin`, `firebase-functions`, `node-fetch`.

### Comandos utiles
- Proxy local Challonge:
  - `node cors-proxy.js`
  - o `start-proxy.bat`
- Functions local:
  - `cd functions && npm install`
  - `npm run serve`
- Deploy functions:
  - `firebase deploy --only functions`

## 11. Hallazgos de Estructura y Deuda Tecnica
- Duplicacion importante de codigo entre:
  - `assets/js/*`
  - `dtowin-tournaments-main/*`
  - algunos scripts en raiz.
- Mezcla de SDK Firebase modular (`v9`) y compat (`firebase.*`) en distintos archivos.
- Mezcla de modelos de datos para inscripciones/check-in.
- Algunos archivos parecen legacy o incompletos (vacios o no referenciados).
- En varios HTML se observa contenido duplicado/mezclado, probablemente por merges previos.

## 12. Recomendacion de Organizacion (Roadmap breve)
1. Definir carpeta fuente unica (sugerido: `assets/js` + `admin/` + `functions/`).
2. Eliminar o archivar `dtowin-tournaments-main/` para evitar divergencia.
3. Unificar modelo de inscripciones en Firestore (preferible subcoleccion por torneo).
4. Unificar uso de Firebase SDK (solo modular o solo compat, no mixto).
5. Centralizar config Firebase y utilidades (notificaciones, auth, timezone).
6. Reemplazar proxy local por Cloud Functions en toda la app.

---
Documento generado a partir de revision del codigo actual del repositorio.
