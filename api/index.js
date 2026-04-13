// API endpoint para intercambiar código de Discord
// Ruta: /api/

module.exports = async function handler(req, res) {
  // Logs para debugging
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);

  // Configurar CORS aggressive
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // Manejar preflight
  if (req.method === 'OPTIONS') {
    console.log('Respondiendo a preflight OPTIONS');
    return res.status(204).end();
  }

  // Si es GET a /, devolver un mensaje de prueba
  if (req.method === 'GET') {
    console.log('GET request recibido');
    return res.status(200).json({ 
      message: 'Discord OAuth API ready',
      env: {
        hasClientId: !!process.env.DISCORD_CLIENT_ID,
        hasClientSecret: !!process.env.DISCORD_CLIENT_SECRET,
        hasRedirectUri: !!process.env.DISCORD_REDIRECT_URI
      }
    });
  }

  if (req.method !== 'POST') {
    console.log(`Método no permitido: ${req.method}`);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    console.log('Procesando POST...');
    const { code } = req.body;

    if (!code) {
      console.error('No code provided');
      return res.status(400).json({
        success: false,
        error: 'Código de autorización requerido'
      });
    }

    console.log('Código recibido, intercambiando por token...');

    // Obtener variables de entorno
    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
    const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !REDIRECT_URI) {
      console.error('Credenciales faltantes:', {
        hasClientId: !!DISCORD_CLIENT_ID,
        hasClientSecret: !!DISCORD_CLIENT_SECRET,
        hasRedirectUri: !!REDIRECT_URI
      });
      return res.status(500).json({
        success: false,
        error: 'Configuración del servidor incompleta'
      });
    }

    // Paso 1: Intercambiar código por token
    console.log('Llamando a Discord API para intercambiar código...');
    
    const tokenParams = new URLSearchParams({
      'client_id': DISCORD_CLIENT_ID,
      'client_secret': DISCORD_CLIENT_SECRET,
      'grant_type': 'authorization_code',
      'code': code,
      'redirect_uri': REDIRECT_URI
    });

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: tokenParams.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('Respuesta de Discord token:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Discord API error:', errorData);
      return res.status(400).json({
        success: false,
        error: 'Error al intercambiar código de autorización'
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    console.log('Token obtenido, pidiendo información del usuario...');

    // Paso 2: Obtener información del usuario
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'DiscordBot'
      }
    });

    console.log('Respuesta de Discord user:', userResponse.status);

    if (!userResponse.ok) {
      const errorData = await userResponse.text();
      console.error('Discord user API error:', errorData);
      return res.status(400).json({
        success: false,
        error: 'Error al obtener información del usuario de Discord'
      });
    }

    const discordUser = await userResponse.json();

    console.log(`✓ Usuario de Discord verificado: ${discordUser.username}`);

    return res.status(200).json({
      success: true,
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      discriminator: discordUser.discriminator,
      email: discordUser.email
    });

  } catch (error) {
    console.error('Error en Discord OAuth handler:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};
