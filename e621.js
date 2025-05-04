//ingreso para ver la galeria

document.getElementById("boton_e621_denegado").addEventListener("click", () => {
    window.location.href = "https://www.google.com";
});
  
document.getElementById("boton_e621_aceptado").addEventListener("click", () => {
    document.getElementById("cuerpo_e621").style.display = "block";
    document.getElementById("botones_pregunta_e621").style.display = "none";
});

document.getElementById("boton_volver").addEventListener("click", () => {
    document.getElementById("cuerpo_e621").style.display = "none";
    document.getElementById("botones_pregunta_e621").style.display = "block";
});

