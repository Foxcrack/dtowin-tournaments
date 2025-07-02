document.addEventListener('DOMContentLoaded', () => {
  const lista = document.getElementById('lista-torneos');
  const btnAgregar = document.getElementById('agregar-torneo');

  btnAgregar.addEventListener('click', () => {
    const nombre = prompt('Nombre del torneo:');
    if (nombre && nombre.trim() !== '') {
      const li = document.createElement('li');
      li.textContent = nombre.trim();
      lista.appendChild(li);
    }
  });
});

setTimeout(() => {
  document.getElementById('redirect-animation').classList.add('fade-out');
}, 1400);
setTimeout(() => {
  window.location.href = "index-torneos.html";
}, 1800);
