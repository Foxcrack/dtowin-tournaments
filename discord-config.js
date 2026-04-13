// discord-config.js - Configuración de Discord OAuth
// IMPORTANTE: Estos valores se configuran en Cloud Functions mediante variables de entorno

export const DISCORD_CONFIG = {
    CLIENT_ID: '1493118118950604910', // Client ID de Discord
    CLOUD_FUNCTION_URL: 'https://dtowin-tournaments-mbtq4e830.vercel.app/api/exchangeDiscordCode',
    REDIRECT_URI: 'https://foxcrack.github.io/dtowin-tournaments/discord-callback.html',
    SCOPES: ['identify'],
    API_ENDPOINT: 'https://discordapp.com/api'
};

/**
 * Inicia el flujo de autenticación de Discord
 */
export function initiateDiscordOAuth() {
    const clientId = DISCORD_CONFIG.CLIENT_ID;
    
    if (!clientId || clientId === 'YOUR_DISCORD_CLIENT_ID') {
        alert('Error: Discord Client ID no configurado. Por favor, configura tu ID de aplicación Discord.');
        return;
    }

    const state = generateRandomState();
    sessionStorage.setItem('discord_oauth_state', state);
    
    const authUrl = new URL('https://discord.com/oauth2/authorize');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', DISCORD_CONFIG.REDIRECT_URI);
    authUrl.searchParams.append('scope', DISCORD_CONFIG.SCOPES.join(' '));
    authUrl.searchParams.append('state', state);
    
    window.location.href = authUrl.toString();
}

/**
 * Genera un string aleatorio para proteger contra CSRF
 */
function generateRandomState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Valida el state recibido del callback
 */
export function validateOAuthState(receivedState) {
    const storedState = sessionStorage.getItem('discord_oauth_state');
    sessionStorage.removeItem('discord_oauth_state');
    return storedState === receivedState;
}

/**
 * Intercambia el código por información del usuario
 * Usa Cloud Function para manejar esto de forma segura (sin exponer el client secret)
 */
export async function exchangeCodeForUserInfo(code) {
    try {
        const response = await fetch(DISCORD_CONFIG.CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al intercambiar código');
        }
        
        const userInfo = await response.json();
        return userInfo;
    } catch (error) {
        console.error('Error intercambiando código:', error);
        throw error;
    }
}
