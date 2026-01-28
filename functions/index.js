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
