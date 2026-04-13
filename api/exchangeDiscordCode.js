// api/exchangeDiscordCode.js - Cloud Function para Vercel
// Maneja el intercambio de código de Discord por token e info de usuario

module.exports = async function handler(req, res) {
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

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !REDIRECT_URI) {
      console.error('Variables de Discord no configuradas:', {
        hasClientId: !!DISCORD_CLIENT_ID,
        hasClientSecret: !!DISCORD_CLIENT_SECRET,
        hasRedirectUri: !!REDIRECT_URI
      });
      return res.status(500).json({
        success: false,
        error: 'Configuración de servidor incompleta'
      });
    }

    // Paso 1: Intercambiar código por token
    console.log('Intercambiando código por token...');
    
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
        error: 'Error al intercambiar código de autorización',
        details: errorData
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Paso 2: Obtener información del usuario
    console.log('Obteniendo información del usuario...');
    
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

    return res.status(200).json({
      success: true,
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      discriminator: discordUser.discriminator,
      email: discordUser.email
    });

  } catch (error) {
    console.error('Error en exchangeDiscordCode:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor: ' + error.message
    });
  }
};
