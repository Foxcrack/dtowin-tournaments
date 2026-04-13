const TETRIO_API_BASE = 'https://ch.tetr.io/api';
const SESSION_ID = 'dtowin-tournaments-tetrio';

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function buildAvatarUrl(userId, avatarRevision) {
  if (!userId || avatarRevision === undefined || avatarRevision === null) {
    return null;
  }

  return `https://tetr.io/user-content/avatars/${userId}.jpg?rv=${avatarRevision}`;
}

async function fetchTetrioJson(url) {
  const response = await fetch(url, {
    headers: {
      'X-Session-ID': SESSION_ID
    }
  });

  const payload = await response.json();

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error?.msg || payload.error || 'No se pudo consultar TETR.IO');
  }

  return payload.data;
}

exports.handler = async (event) => {
  const headers = buildHeaders();

  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true })
      };
    }

    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const username = event.queryStringParameters?.username?.trim();

    if (!username) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Username required' })
      };
    }

    const normalizedUsername = username.toLowerCase();
    const [userData, leagueData] = await Promise.all([
      fetchTetrioJson(`${TETRIO_API_BASE}/users/${encodeURIComponent(normalizedUsername)}`),
      fetchTetrioJson(`${TETRIO_API_BASE}/users/${encodeURIComponent(normalizedUsername)}/summaries/league`)
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        account: {
          gameId: 'tetrio',
          username: userData.username,
          userId: userData._id,
          country: userData.country || null,
          avatarUrl: buildAvatarUrl(userData._id, userData.avatar_revision),
          rank: leagueData.rank || 'z',
          tr: typeof leagueData.tr === 'number' ? leagueData.tr : -1,
          gxe: typeof leagueData.gxe === 'number' ? leagueData.gxe : -1,
          gamesPlayed: typeof leagueData.gamesplayed === 'number' ? leagueData.gamesplayed : 0,
          apm: typeof leagueData.apm === 'number' ? leagueData.apm : null,
          pps: typeof leagueData.pps === 'number' ? leagueData.pps : null,
          vs: typeof leagueData.vs === 'number' ? leagueData.vs : null
        }
      })
    };
  } catch (error) {
    console.error('TETR.IO lookup error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Unexpected error' })
    };
  }
};
