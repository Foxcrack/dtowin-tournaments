// admin-panel.js

export async function initDashboard() {
    await new Promise(resolve => {
      if (document.readyState === "complete") return resolve();
      window.addEventListener("DOMContentLoaded", resolve);
    });
  
    console.log("Cargando el panel de administración...");
  
    // Inicializar Firebase si no está ya inicializado
    if (typeof window.firebase === "undefined") {
      console.error("Firebase no está inicializado.");
      return;
    }
  
    if (typeof window.db === "undefined") {
      console.error("Base de datos no disponible.");
      return;
    }
  
    console.log("Base de datos disponible.");
    console.log("Inicializando el panel de administración...");
  
    const db = window.db;
  
    // Elementos
    const usuariosCounter = document.getElementById("totalUsuariosCounter");
    const torneosCounter = document.getElementById("torneosActivosCounter");
    const badgesCounter = document.getElementById("badgesOtorgadosCounter");
    const torneosTable = document.getElementById("proximosTorneosTable");
  
    if (!usuariosCounter || !torneosCounter || !badgesCounter || !torneosTable) {
      console.error("Uno o más elementos del DOM no se encontraron. Asegúrate de que el HTML los incluya.");
      return;
    }
  
    // Cargar total de usuarios
    try {
      const usuariosSnap = await db.collection("usuarios").get();
      usuariosCounter.textContent = usuariosSnap.size;
    } catch (error) {
      console.error("Error al contar usuarios:", error);
      usuariosCounter.textContent = "-";
    }
  
    // Cargar torneos activos
    try {
      const torneosSnap = await db
        .collection("torneos")
        .where("estado", "in", ["abierto", "checkin", "iniciando"])
        .get();
      torneosCounter.textContent = torneosSnap.size;
    } catch (error) {
      console.error("Error al contar torneos:", error);
      torneosCounter.textContent = "-";
    }
  
    // Cargar cantidad de badges otorgadas
    try {
      const userBadgesSnap = await db.collection("user_badges").get();
      let totalBadges = 0;
      userBadgesSnap.forEach(doc => {
        const data = doc.data();
        if (data.badges && typeof data.badges === 'object') {
          totalBadges += Object.keys(data.badges).length;
        }
      });
      badgesCounter.textContent = totalBadges;
    } catch (error) {
      console.error("Error al contar badges otorgadas:", error);
      badgesCounter.textContent = "-";
    }
  
    // Cargar tabla de próximos torneos
    try {
      const proximosSnap = await db
        .collection("torneos")
        .where("estado", "==", "proximamente")
        .orderBy("fecha")
        .limit(5)
        .get();
  
      torneosTable.innerHTML = ""; // Limpiar tabla
  
      if (proximosSnap.empty) {
        torneosTable.innerHTML = `
          <tr><td colspan="5" class="text-center py-4 text-gray-500">No hay torneos próximos registrados.</td></tr>
        `;
      } else {
        proximosSnap.forEach(doc => {
          const torneo = doc.data();
          const fecha = torneo.fecha ? new Date(torneo.fecha.seconds * 1000).toLocaleDateString() : "-";
          const inscritos = Array.isArray(torneo.inscritos) ? torneo.inscritos.length : 0;
  
          torneosTable.innerHTML += `
            <tr>
              <td class="px-6 py-4">${torneo.nombre || "Sin nombre"}</td>
              <td class="px-6 py-4">${fecha}</td>
              <td class="px-6 py-4">${inscritos}</td>
              <td class="px-6 py-4 capitalize">${torneo.estado}</td>
              <td class="px-6 py-4 text-right">
                <a href="admin-torneos.html?id=${doc.id}" class="text-blue-500 hover:underline">Ver</a>
              </td>
            </tr>
          `;
        });
      }
    } catch (error) {
      console.error("Error al cargar próximos torneos:", error);
      torneosTable.innerHTML = `
        <tr><td colspan="5" class="text-center py-4 text-red-500">Error al cargar torneos.</td></tr>
      `;
    }
  }
  