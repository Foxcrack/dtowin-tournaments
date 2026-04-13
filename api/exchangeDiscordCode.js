// api/exchangeDiscordCode.js - Cloud Function para Vercel
// Maneja el intercambio de código de Discord por token y info de usuario

import admin from 'firebase-admin';
import fetch from 'node-fetch';

// Inicializar Firebase Admin si no está ya inicializado
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Código de autorización requerido'
      });
    }

    // Obtener variables de entorno
    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
    const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      console.error('Credenciales de Discord no configuradas');
      return res.status(500).json({
        success: false,
        error: 'Configuración de servidor incompleta'
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
      console.error('Error al intercambiar código:', errorData);
      return res.status(400).json({
        success: false,
        error: 'Error al intercambiar código de autorización'
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
      console.error('Error al obtener información del usuario');
      return res.status(400).json({
        success: false,
        error: 'Error al obtener información del usuario de Discord'
      });
    }

    const discordUser = await userResponse.json();

    console.log(`Usuario de Discord verificado: ${discordUser.username}`);

    // Paso 3: Guardar info en Firestore (opcional, el cliente también lo hace)
    // Esto garantiza que los datos estén en Firestore aunque falle el lado del cliente

    return res.status(200).json({
      success: true,
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      discriminator: discordUser.discriminator,
      email: discordUser.email
    });

  } catch (error) {
    console.error('Error en exchangeDiscordCode:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}
