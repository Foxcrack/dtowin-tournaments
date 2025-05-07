import { loginWithGoogle, getUserProfile } from '../firebase.js';

document.getElementById('googleLogin').addEventListener('click', async () => {
  try {
    const user = await loginWithGoogle();
    const profile = await getUserProfile(user.uid);

    console.log("Perfil completo:", profile);

    const userDataDiv = document.getElementById('userData');
    userDataDiv.innerHTML = `
      <p>Nombre: ${profile.nombre}</p>
      <p>Correo: ${profile.email}</p>
      <p>Puntos: ${profile.puntos ?? 0}</p>
      ${profile.isHost ? `<p style="color: #00ffd5;">🛡️ Usuario administrador</p>` : ''}
      <img src="${profile.photoURL}" width="100" height="100" />
    `;

    // Mostrar botón solo si es admin
    if (profile.isHost === true) {
      console.log("Mostrando botón de admin");
      document.getElementById('adminPanel').style.display = 'inline-block';
    }
    console.log("¿Es admin?", profile.isHost);


  } catch (error) {
    alert("Error al iniciar sesión: " + error.message);
  }
});
