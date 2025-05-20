import { auth, loginWithGoogle, getUserProfile, logoutUser } from '../firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";

const googleLoginBtn = document.getElementById('googleLogin');
const logoutBtn = document.getElementById('logoutBtn');
const userDataDiv = document.getElementById('userData');
const adminPanelBtn = document.getElementById('adminPanel');

// Mostrar el perfil si el usuario está autenticado
async function mostrarPerfil(user) {
  const profile = await getUserProfile(user.uid);

  userDataDiv.innerHTML = `
    <p>Nombre: ${profile.nombre}</p>
    <p>Correo: ${profile.email}</p>
    <p>Puntos: ${profile.puntos ?? 0}</p>
    ${profile.isHost ? `<p style="color: #00ffd5;">🛡️ Usuario administrador</p>` : ''}
    <img src="${profile.photoURL}" width="100" height="100" />
  `;

  googleLoginBtn.style.display = 'none';
  logoutBtn.style.display = 'inline-block';

  if (profile.isHost) {
    const adminBtn = document.getElementById("adminPanel");
    adminBtn.style.display = "inline-block";
  
    // Redirigir al panel e621
    adminBtn.addEventListener("click", () => {
      window.location.href = "../e621.html";
    });
  }
}

// Limpiar interfaz al cerrar sesión
function limpiarInterfaz() {
  userDataDiv.innerHTML = '';
  googleLoginBtn.style.display = 'inline-block';
  logoutBtn.style.display = 'none';
  adminPanelBtn.style.display = 'none';
}

// Detectar sesión activa
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("Sesión activa detectada");
    await mostrarPerfil(user);
  } else {
    console.log("No hay sesión activa");
    limpiarInterfaz();
  }
});

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

document.addEventListener("DOMContentLoaded", function() {

  const btnCodigos = document.getElementById("btnCodigos")
  const e621 = document.getElementById("e621")

  btnCodigos.addEventListener("click", function() {
    const codigoIngresado = document.getElementById("Codigos").value.trim().toLowerCase();

    if (codigoIngresado === "e621") {
      e621.style.display = "block";
    } else {
      alert("Código inválido");
    }
  });
});
