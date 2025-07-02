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

    // Cargar torneos activos (Abierto, En Progreso)
    try {
        const torneosSnap = await db
            .collection("torneos")
            .where("estado", "in", ["Abierto", "En Progreso"])
            .get();
        torneosCounter.textContent = torneosSnap.size;
    } catch (error) {
        console.error("Error al contar torneos:", error);
        torneosCounter.textContent = "-";
    }

    // Cargar cantidad de badges otorgadas (user_badges o usuarios.badges)
    try {
        let totalBadges = 0;
        // Preferencia: colección user_badges
        const userBadgesSnap = await db.collection("user_badges").get();
        if (!userBadgesSnap.empty) {
            userBadgesSnap.forEach(doc => {
                const data = doc.data();
                if (data.badges && typeof data.badges === 'object') {
                    totalBadges += Object.keys(data.badges).length;
                }
            });
        } else {
            // Alternativamente, contar badges en usuarios
            const usuariosSnap = await db.collection("usuarios").get();
            usuariosSnap.forEach(doc => {
                const userData = doc.data();
                if (userData.badges) {
                    totalBadges += Object.keys(userData.badges).length;
                }
            });
        }
        badgesCounter.textContent = totalBadges;
    } catch (error) {
        console.error("Error al contar badges otorgadas:", error);
        badgesCounter.textContent = "-";
    }

    // Cargar tabla de próximos torneos (Próximamente, Abierto, En Progreso)
    try {
        const proximosSnap = await db
            .collection("torneos")
            .where("estado", "in", ["Próximamente", "Abierto", "En Progreso"])
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
                const fecha = torneo.fecha ? new Date(torneo.fecha.seconds * 1000).toLocaleDateString('es-ES') : "-";
                const inscritos = Array.isArray(torneo.participants) ? torneo.participants.length : 0;
                let estadoClase, estadoTexto;
                switch (torneo.estado) {
                    case 'Abierto':
                        estadoClase = 'bg-green-100 text-green-800';
                        estadoTexto = 'Abierto';
                        break;
                    case 'En Progreso':
                        estadoClase = 'bg-blue-100 text-blue-800';
                        estadoTexto = 'En Progreso';
                        break;
                    case 'Próximamente':
                        estadoClase = 'bg-yellow-100 text-yellow-800';
                        estadoTexto = 'Próximamente';
                        break;
                    default:
                        estadoClase = 'bg-gray-100 text-gray-800';
                        estadoTexto = torneo.estado || 'Desconocido';
                }
                torneosTable.innerHTML += `
                    <tr>
                        <td class="px-6 py-4">${torneo.nombre || "Sin nombre"}</td>
                        <td class="px-6 py-4">${fecha}</td>
                        <td class="px-6 py-4">${inscritos}</td>
                        <td class="px-6 py-4"><span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${estadoClase}">${estadoTexto}</span></td>
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
