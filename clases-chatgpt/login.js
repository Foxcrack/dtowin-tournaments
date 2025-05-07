import { loginWithGoogle, getUserProfile } from '../firebase.js';

document.getElementById('googleLogin').addEventListener('click', async () => {
  try {
    const user = await loginWithGoogle();
    const profile = await getUserProfile(user.uid);

    const userDataDiv = document.getElementById('userData');
    userDataDiv.innerHTML = `
      <p>Nombre: ${profile.nombre}</p>
      <p>Correo: ${profile.email}</p>
      <p>Puntos: ${profile.puntos ?? 0}</p>
      <img src="${profile.photoURL}" width="100" height="100" />
    `;
  } catch (error) {
    alert("Error al iniciar sesión: " + error.message);
    // Manejar el error de manera adecuada
    console.log("Perfil completo:", profile);

  }
});
