const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

setGlobalOptions({ maxInstances: 10 });

// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Placeholder para futuras Cloud Functions
exports.helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

// Agregar participante a Challonge (sin CORS issues)
exports.addChallongeParticipant = onRequest(async (request, response) => {
  // Solo permitir POST
  if (request.method !== "POST") {
    return response.status(405).send("Method Not Allowed");
  }

  try {
    const { torneoId, gameUsername } = request.body;

    if (!torneoId || !gameUsername) {
      return response.status(400).json({
        success: false,
        error: "torneoId y gameUsername son requeridos"
      });
    }

    // Obtener datos del torneo desde Firestore
    const torneoDocRef = db.collection("torneos").doc(torneoId);
    const torneoDoc = await torneoDocRef.get();

    if (!torneoDoc.exists()) {
      return response.status(404).json({
        success: false,
        error: "Torneo no encontrado"
      });
    }

    const torneoData = torneoDoc.data();

    // Verificar que esté vinculado con Challonge
    if (!torneoData.challonge || !torneoData.challonge.slug || !torneoData.challonge.apiKey) {
      return response.status(400).json({
        success: false,
        error: "Torneo no vinculado con Challonge"
      });
    }

    const { slug, apiKey } = torneoData.challonge;

    // Realizar llamada a Challonge API
    const url = `https://api.challonge.com/v1/tournaments/${slug}/participants.json`;
    
    const params = new URLSearchParams({
      'api_key': apiKey,
      'participant[name]': gameUsername
    });

    const apiResponse = await fetch(url, {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (apiResponse.ok) {
      const data = await apiResponse.json();
      logger.info(`Participante agregado a Challonge: ${gameUsername}`, { torneoId });
      return response.json({
        success: true,
        message: `Participante ${gameUsername} agregado a Challonge`,
        data: data
      });
    } else {
      const errorText = await apiResponse.text();
      logger.warn(`Error en Challonge API: ${errorText}`, { torneoId });
      return response.json({
        success: false,
        warning: "No se pudo agregar a Challonge, pero el check-in se completó"
      });
    }

  } catch (error) {
    logger.error("Error en addChallongeParticipant:", error);
    return response.json({
      success: false,
      warning: "Error de sincronización con Challonge"
    });
  }
});

// Remover participante de Challonge (sin CORS issues)
exports.removeChallongeParticipant = onRequest(async (request, response) => {
  // Solo permitir POST
  if (request.method !== "POST") {
    return response.status(405).send("Method Not Allowed");
  }

  try {
    const { torneoId, gameUsername } = request.body;

    if (!torneoId || !gameUsername) {
      return response.status(400).json({
        success: false,
        error: "torneoId y gameUsername son requeridos"
      });
    }

    // Obtener datos del torneo desde Firestore
    const torneoDocRef = db.collection("torneos").doc(torneoId);
    const torneoDoc = await torneoDocRef.get();

    if (!torneoDoc.exists()) {
      return response.status(404).json({
        success: false,
        error: "Torneo no encontrado"
      });
    }

    const torneoData = torneoDoc.data();

    // Verificar que esté vinculado con Challonge
    if (!torneoData.challonge || !torneoData.challonge.slug || !torneoData.challonge.apiKey) {
      return response.json({
        success: false,
        warning: "Torneo no vinculado con Challonge"
      });
    }

    const { slug, apiKey } = torneoData.challonge;

    // Obtener lista de participantes
    const participantsUrl = `https://api.challonge.com/v1/tournaments/${slug}/participants.json?api_key=${apiKey}`;
    
    const participantsResponse = await fetch(participantsUrl);

    if (!participantsResponse.ok) {
      logger.warn("No se pudo obtener participantes de Challonge", { torneoId });
      return response.json({
        success: false,
        warning: "No se pudo remover de Challonge"
      });
    }

    const participants = await participantsResponse.json();

    // Buscar el participante
    const participant = participants.find(p => 
      p.participant.name.toLowerCase() === gameUsername.toLowerCase()
    );

    if (!participant) {
      logger.info(`Participante no encontrado en Challonge: ${gameUsername}`, { torneoId });
      return response.json({
        success: true,
        message: "Participante no encontrado (ya estaba removido)"
      });
    }

    // Remover participante
    const participantId = participant.participant.id;
    const deleteUrl = `https://api.challonge.com/v1/tournaments/${slug}/participants/${participantId}.json`;
    
    const params = new URLSearchParams({
      'api_key': apiKey
    });

    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (deleteResponse.ok) {
      logger.info(`Participante removido de Challonge: ${gameUsername}`, { torneoId });
      return response.json({
        success: true,
        message: `Participante ${gameUsername} removido de Challonge`
      });
    } else {
      logger.warn("No se pudo remover de Challonge", { torneoId });
      return response.json({
        success: false,
        warning: "No se pudo remover de Challonge"
      });
    }

  } catch (error) {
    logger.error("Error en removeChallongeParticipant:", error);
    return response.json({
      success: false,
      warning: "Error de sincronización con Challonge"
    });
  }
});

// ============================================
// DISCORD OAUTH - Intercambiar código por info de usuario
// ============================================
exports.exchangeDiscordCode = onRequest(async (request, response) => {
  // Solo permitir POST
  if (request.method !== "POST") {
    return response.status(405).send("Method Not Allowed");
  }

  // Habilitar CORS
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(204).send('');
  }

  try {
    const { code } = request.body;

    if (!code) {
      return response.status(400).json({
        success: false,
        error: "Código de autorización requerido"
      });
    }

    // Variables de configuración de Discord
    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
    const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 
      'https://dtowin-tournament.firebaseapp.com/discord-callback.html';

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      logger.error("Credenciales de Discord no configuradas");
      return response.status(500).json({
        success: false,
        error: "Configuración de servidor incompleta"
      });
    }

    // Paso 1: Intercambiar código por token
    const tokenParams = new URLSearchParams({
      'client_id': DISCORD_CLIENT_ID,
      'client_secret': DISCORD_CLIENT_SECRET,
      'grant_type': 'authorization_code',
      'code': code,
      'redirect_uri': REDIRECT_URI
    });

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: tokenParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      logger.error("Error al intercambiar código:", errorData);
      return response.status(400).json({
        success: false,
        error: "Error al intercambiar código de autorización"
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Paso 2: Obtener información del usuario
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      logger.error("Error al obtener información del usuario");
      return response.status(400).json({
        success: false,
        error: "Error al obtener información del usuario de Discord"
      });
    }

    const discordUser = await userResponse.json();

    logger.info(`Usuario de Discord verificado: ${discordUser.username}`, {
      discordId: discordUser.id
    });

    return response.json({
      success: true,
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      discriminator: discordUser.discriminator,
      email: discordUser.email
    });

  } catch (error) {
    logger.error("Error en exchangeDiscordCode:", error);
    return response.status(500).json({
      success: false,
      error: "Error interno del servidor"
    });
  }
});

    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (deleteResponse.ok) {
      logger.info(`Participante removido de Challonge: ${gameUsername}`, { torneoId });
      return response.json({
        success: true,
        message: `Participante ${gameUsername} removido de Challonge`
      });
    } else {
      const errorText = await deleteResponse.text();
      logger.warn(`Error removiendo de Challonge: ${errorText}`, { torneoId });
      return response.json({
        success: false,
        warning: "No se pudo remover de Challonge"
      });
    }

  } catch (error) {
    logger.error("Error en removeChallongeParticipant:", error);
    return response.json({
      success: false,
      warning: "Error de sincronización con Challonge"
    });
  }
});
