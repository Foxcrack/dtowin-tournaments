// Netlify Serverless Function: /api/test
// Endpoint para verificar la configuración del servidor

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const config = {
      status: 'API Test Endpoint Ready',
      timestamp: new Date().toISOString(),
      environment: {
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ? '✅ Configurado' : '❌ NO configurado',
        DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET ? '✅ Configurado' : '❌ NO configurado',
        NODE_ENV: process.env.NODE_ENV || 'unknown'
      },
      request: {
        method: event.httpMethod,
        path: event.path,
        origin: event.headers.origin || 'unknown'
      }
    };

    // Si tienes variables de entorno configuradas, muestra sus valores (últimos 4 caracteres)
    if (process.env.DISCORD_CLIENT_ID) {
      config.environment.DISCORD_CLIENT_ID_preview = 
        process.env.DISCORD_CLIENT_ID.substring(process.env.DISCORD_CLIENT_ID.length - 4);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(config, null, 2)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
