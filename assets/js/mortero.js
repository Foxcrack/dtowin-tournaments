document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("calcularBtn");
  
    btn.addEventListener("click", () => {
      // Obtener valores del formulario
      const angulo = parseFloat(document.getElementById("angulo").value);
      const velocidad = parseFloat(document.getElementById("velocidad").value);
      const altura = parseFloat(document.getElementById("altura").value);
  
      const g = 9.81; // gravedad m/s²
      const rad = angulo * (Math.PI / 180);
  
      const vx = velocidad * Math.cos(rad);
      const vy = velocidad * Math.sin(rad);
  
      // Tiempo de vuelo total (resolviendo ecuación cuadrática para y final = 0)
      const tiempoTotal = (vy + Math.sqrt(vy * vy + 2 * g * altura)) / g;
  
      const alcance = vx * tiempoTotal;
      const alturaMaxima = altura + (vy * vy) / (2 * g);
  
      // Mostrar resultados
      document.getElementById("rango").textContent = `Alcance: ${alcance.toFixed(2)} m`;
      document.getElementById("tiempoVuelo").textContent = `Tiempo de vuelo: ${tiempoTotal.toFixed(2)} s`;
      document.getElementById("alturaMaxima").textContent = `Altura máxima: ${alturaMaxima.toFixed(2)} m`;
  
      // Animar y graficar
      graficarTiro(vx, vy, altura, tiempoTotal);
    });
  
    function graficarTiro(vx, vy, h0, tiempoTotal) {
      const canvas = document.getElementById("canvasTiro");
      const ctx = canvas.getContext("2d");
  
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      const escala = 10; // 1 metro = 10px (puedes ajustar)
      const suelo = canvas.height - 20;
  
      let tiempo = 0;
      const dt = 0.05; // resolución de la animación
  
      function dibujarFrame() {
        const x = vx * tiempo;
        const y = h0 + vy * tiempo - 0.5 * 9.81 * tiempo * tiempo;
  
        if (y < 0) return;
  
        const px = x * escala;
        const py = suelo - y * escala;
  
        // Dibujar punto
        ctx.fillStyle = "#00ff88";
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
  
        tiempo += dt;
        requestAnimationFrame(dibujarFrame);
      }
  
      dibujarFrame();
    }
});


document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("regresar").addEventListener("click", () => {
        window.location.href = "fisica-index.html";
    });
});