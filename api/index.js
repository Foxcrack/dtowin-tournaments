// API endpoint para intercambiar código de Discord
// Ruta: /api/

module.exports = async function handler(req, res) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Si es GET a /, devolver un mensaje de bienvenida
  if (req.method === 'GET') {
    return res.status(200).json({ message: 'Discord OAuth API ready' });
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

    console.log('Verificando credenciales:', {
      hasClientId: !!DISCORD_CLIENT_ID,
      hasClientSecret: !!DISCORD_CLIENT_SECRET,
      hasRedirectUri: !!REDIRECT_URI
    });

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !REDIRECT_URI) {
      console.error('Credenciales de Discord no configuradas');
      return res.status(500).json({
        success: false,
        error: 'Configuración de servidor incompleta'
      });
    }

    // Paso 1: Intercambiar código por token
    console.log('Paso 1: Intercambiando código por token...');
    
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
    console.log('Paso 2: Obteniendo información del usuario de Discord...');
    
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'DiscordBot'
      }
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.text();
      console.error('Error al obtener información del usuario:', errorData);
      return res.status(400).json({
        success: false,
        error: 'Error al obtener información del usuario de Discord'
      });
    }

    const discordUser = await userResponse.json();

    console.log(`Usuario de Discord verificado: ${discordUser.username}#${discordUser.discriminator}`);

    return res.status(200).json({
      success: true,
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      discriminator: discordUser.discriminator,
      email: discordUser.email
    });

  } catch (error) {
    console.error('Error en Discord OAuth handler:', error.message, error.stack);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor: ' + error.message
    });
  }
};
