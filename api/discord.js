// Netlify Serverless Function: /api/discord
// Intercambia código de Discord por información del usuario

exports.handler = async (event, context) => {
  try {
    // Parse body
    let body = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }

    const { code, redirectUri } = body;

    // CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // Si es OPTIONS (preflight)
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers };
    }

    // Si es GET (test)
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'API Discord ready' })
      };
    }

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    if (!code) {
      console.error('❌ No code provided');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Code required' })
      };
    }

    if (!redirectUri) {
      console.error('❌ No redirectUri provided');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Redirect URI required' })
      };
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('❌ Missing environment variables:', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret
      });
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server config incomplete' })
      };
    }

    console.log('🔄 Intercambiando código por token...');
    console.log('Client ID:', clientId.substring(0, 10) + '...');
    console.log('Redirect URI:', redirectUri);

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri  // IMPORTANTE: Usar el redirect_uri del cliente
    });

    const tokenResp = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!tokenResp.ok) {
      const errorBody = await tokenResp.text();
      console.error('❌ Token exchange failed:', {
        status: tokenResp.status,
        statusText: tokenResp.statusText,
        body: errorBody
      });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Token exchange failed',
          details: errorBody 
        })
      };
    }

    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;
    
    console.log('✅ Token obtenido');

    console.log('🔄 Obteniendo información del usuario...');
    const userResp = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userResp.ok) {
      console.error('❌ User fetch failed:', userResp.status, userResp.statusText);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'User fetch failed' })
      };
    }

    const user = await userResp.json();
    console.log('✅ Usuario verificado:', user.username);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        discriminator: user.discriminator
      })
    };

  } catch (error) {
    console.error('💥 Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
