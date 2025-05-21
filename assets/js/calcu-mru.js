document.addEventListener("DOMContentLoaded", () => {
  const calculoSelect = document.getElementById("calculo");
  const label1 = document.getElementById("label1");
  const label2 = document.getElementById("label2");
  const valor1 = document.getElementById("valor1");
  const valor2 = document.getElementById("valor2");
  const resultado = document.getElementById("resultado");
  const calcularBtn = document.getElementById("calcularBtn");

  function actualizarLabels() {
    const opcion = calculoSelect.value;
    if (opcion === "velocidad") {
      label1.textContent = "Distancia (m):";
      label2.textContent = "Tiempo (s):";
    } else if (opcion === "distancia") {
      label1.textContent = "Velocidad (m/s):";
      label2.textContent = "Tiempo (s):";
    } else if (opcion === "tiempo") {
      label1.textContent = "Distancia (m):";
      label2.textContent = "Velocidad (m/s):";
    }
    valor1.value = "";
    valor2.value = "";
    resultado.textContent = "";
  }

  calculoSelect.addEventListener("change", actualizarLabels);

  calcularBtn.addEventListener("click", () => {
    const opcion = calculoSelect.value;
    const v1 = parseFloat(valor1.value);
    const v2 = parseFloat(valor2.value);

    if (isNaN(v1) || isNaN(v2) || v1 <= 0 || v2 <= 0) {
      resultado.textContent = "Por favor ingresa valores válidos.";
      return;
    }

    let res;
    if (opcion === "velocidad") {
      res = v1 / v2;
      resultado.textContent = `Velocidad: ${res.toFixed(2)} m/s`;
    } else if (opcion === "distancia") {
      res = v1 * v2;
      resultado.textContent = `Distancia: ${res.toFixed(2)} metros`;
    } else if (opcion === "tiempo") {
      res = v1 / v2;
      resultado.textContent = `Tiempo: ${res.toFixed(2)} segundos`;
    }
  });

  // Inicializa etiquetas al cargar
  actualizarLabels();
});
