import { auth, loginWithGoogle, getUserProfile } from '../firebase.js';

async function mostrarPerfil(user) {
  const profile = await getUserProfile(user.uid);

  const userDataDiv = document.getElementById('userData');
  userDataDiv.innerHTML = `
    <p>Nombre: ${profile.nombre}</p>
    <p>Correo: ${profile.email}</p>
    <p>Puntos: ${profile.puntos ?? 0}</p>
    ${profile.isHost ? `<p style="color: #00ffd5;">🛡️ Usuario administrador</p>` : ''}
    <img src="${profile.photoURL}" width="100" height="100" />
  `;

  if (profile.isHost) {
    document.getElementById('adminPanel').style.display = 'inline-block';
  }
}

// Detectar si ya hay sesión iniciada
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("Sesión existente detectada");
    await mostrarPerfil(user);
  } else {
    console.log("No hay sesión iniciada");
  }
});

// Cuando haces clic en el botón de login
document.getElementById('googleLogin').addEventListener('click', async () => {
  try {
    const user = await loginWithGoogle();
    await mostrarPerfil(user);
  } catch (error) {
    alert("Error al iniciar sesión: " + error.message);
  }
});
