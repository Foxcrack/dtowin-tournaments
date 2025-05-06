document.getElementById("calcularBtn").addEventListener("click", () => {
    const notas = [
      parseFloat(document.getElementById("nota1").value),
      parseFloat(document.getElementById("nota2").value),
      parseFloat(document.getElementById("nota3").value),
      parseFloat(document.getElementById("nota4").value)
    ];
  
    const VACIO = isNaN;
    const meta = 3.6;
    let suma = 0;
    let faltantes = 0;
  
    notas.forEach(nota => {
      if (!isNaN(nota)) suma += nota;
      else faltantes++;
    });
  
    const resultados = document.getElementById("resultados");
  
    if (faltantes === 0) {
      const promedio = suma / 4;
      resultados.innerHTML = `<p>Nota definitiva: <strong>${promedio.toFixed(2)}</strong><br>
        ${promedio >= meta ? "✅ ¡Aprobaste!" : "❌ No aprobaste, sigue intentando."}</p>`;
    } else {
      const notaNecesaria = ((meta * 4) - suma) / faltantes;
  
      if (notaNecesaria > 5) {
        resultados.innerHTML = `<p>❌ No es posible aprobar, necesitarías sacar más de 5.0 en las ${faltantes} nota(s) faltante(s).</p>`;
      } else {
        resultados.innerHTML = `<p>Para aprobar con 3.6, necesitas sacar <strong>${notaNecesaria.toFixed(2)}</strong> en cada una de las ${faltantes} nota(s) faltante(s).</p>`;
      }
    }
  });
  