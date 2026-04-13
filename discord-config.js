// discord-config.js - Configuración de Discord OAuth
// IMPORTANTE: Estos valores se configuran en Cloud Functions mediante variables de entorno

export const DISCORD_CONFIG = {
    CLIENT_ID: '1493118118950604910',
    CLOUD_FUNCTION_URL: 'https://dtowin-tournaments.netlify.app/.netlify/functions/discord',
    REDIRECT_URI: 'https://foxcrack.github.io/dtowin-tournaments/discord-callback.html',
    SCOPES: ['identify'],
    API_ENDPOINT: 'https://discord.com/api' // Corregido: discord.com en lugar de discordapp.com
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
        console.log('Iniciando intercambio de código...');
        console.log('URL de API:', DISCORD_CONFIG.CLOUD_FUNCTION_URL);
        console.log('Redirect URI:', DISCORD_CONFIG.REDIRECT_URI);
        console.log('Código:', code ? 'recibido' : 'NO recibido');

        // Enviar código + redirect_uri a la función Netlify
        const response = await fetch(DISCORD_CONFIG.CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                code,
                redirectUri: DISCORD_CONFIG.REDIRECT_URI // IMPORTANTE: Enviar el redirect_uri
            }),
            mode: 'cors'
        });

        console.log('Fetch completado. Status:', response.status);
        
        if (!response.ok) {
            console.error('Response no es OK:', response.status, response.statusText);
            try {
                const errorData = await response.json();
                console.error('Error details:', errorData);
                throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
            } catch (e) {
                throw new Error(`Error del servidor: ${response.statusText}`);
            }
        }
        
        const userInfo = await response.json();
        console.log('Información recibida:', userInfo);
        
        // La respuesta debe tener el formato correcto
        if (!userInfo.id && !userInfo.success) {
            throw new Error('Respuesta del servidor inválida');
        }
        
        return userInfo;
    } catch (error) {
        console.error('Error intercambiando código:', error);
        console.error('Stack:', error.stack);
        throw error;
    }
}
