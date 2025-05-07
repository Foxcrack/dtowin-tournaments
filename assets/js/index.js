import { auth, loginWithGoogle, getUserProfile, logoutUser } from '../firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";

const googleLoginBtn = document.getElementById('googleLogin');
const logoutBtn = document.getElementById('logoutBtn');
const userDataDiv = document.getElementById('userData');
const adminPanelBtn = document.getElementById('adminPanel');

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("Dirigir_a_TorneosIndex").addEventListener("click", () => {
        window.location.href = "index-torneos.html";
    });

    document.getElementById("Dirigir_a_LeaderboardsIndex").addEventListener("click", () => {
        window.location.href = "leaderboard-completo.html";
    });

    document.getElementById("Dirigir_a_CalculadorasIndex").addEventListener("click", () => {
        window.location.href = "calculadoras-index.html";
    });

    //archivos de pruebas con el firestore

    document.getElementById("Dirigir_a_Pruebas").addEventListener("click", () => {
        window.location.href = "clases-chatgpt/login.html";
    });

    document.getElementById("Dirigir_a_e621Index").addEventListener("click", () => {
        window.location.href = "e621.html";
    });
});

// Mostrar el perfil si el usuario está autenticado

//cargar el perfil del usuario al cargar la pagina
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Sesión activa detectada");
        await mostrarPerfil(user);
    } else {
        console.log("No hay sesión activa");
        limpiarInterfaz();
    }
});
// Limpiar interfaz al cerrar sesión
function limpiarInterfaz() {
    userDataDiv.innerHTML = '';
    googleLoginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    adminPanelBtn.style.display = 'none';
}
// Evento de login
googleLoginBtn.addEventListener('click', async () => {
    try {
        const user = await loginWithGoogle();
        await mostrarPerfil(user);
    } catch (error) {
        alert("Error al iniciar sesión: " + error.message);
    }
});
// Evento de logout
logoutBtn.addEventListener('click', async () => {
    try {
        await logoutUser();
        limpiarInterfaz();
    } catch (error) {
        alert("Error al cerrar sesión: " + error.message);
    }
});

//hacer que el boton de document.getElementById("Dirigir_a_e621Index").addEventListener("click", () => { aparezca solo si el usuario es admin

document.getElementById("Dirigir_a_e621Index").style.display = "none";
    if (profile.isHost) {
    document.getElementById("Dirigir_a_e621Index").style.display = "block";
}

