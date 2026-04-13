// Netlify Serverless Function: /api/discord
// Intercambia código de Discord por información del usuario

exports.handler = async (event, context) => {
  try {
    // Parse body
    let body = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }

    const { code } = body;

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
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Code required' })
      };
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server config incomplete' })
      };
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    });

    const tokenResp = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!tokenResp.ok) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token exchange failed' })
      };
    }

    const tokenData = await tokenResp.json();
    const userResp = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userResp.ok) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'User fetch failed' })
      };
    }

    const user = await userResp.json();
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
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
