// admin-torneos.js - Script para la gestión de torneos en el panel de administración
import { auth, db, isAuthenticated } from '../../firebase.js';
import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    addDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Referencia al contenedor de torneos
const torneosTableBody = document.querySelector('#torneos-table-body') || document.querySelector('table tbody');
// Botón para crear torneo
const crearTorneoBtn = document.getElementById('crear-torneo-btn');

// Inicializar el panel de administración
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Inicializando panel de administración de torneos...");

    // Verificar autenticación
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            // Verificar si el usuario es administrador
            const isAdmin = await checkUserIsAdmin(user.uid);

            if (isAdmin) {
                console.log("Usuario es administrador, cargando torneos...");
                await loadTorneos();
            } else {
                console.log("Usuario no es administrador");
                alert("No tienes permisos para acceder a esta página");
                window.location.href = "index.html";
            }
        } else {
            console.log("No hay usuario autenticado");
            window.location.href = "index.html";
        }
    });

    // Configurar botón de crear torneo
    if (crearTorneoBtn) {
        crearTorneoBtn.addEventListener('click', showCreateTournamentForm);
    }
});

// Verificar si el usuario es administrador
async function checkUserIsAdmin(uid) {
    try {
        // Lista de administradores fijos
        const adminUIDs = ["dvblFee1ZnVKJNWBOR22tSAsNet2"];

        // Si el UID está en la lista de administradores
        if (adminUIDs.includes(uid)) {
            return true;
        }

        // Verificar en la base de datos
        const usersRef = collection(db, "usuarios");
        const q = query(usersRef, where("uid", "==", uid), where("isHost", "==", true));
        const querySnapshot = await getDocs(q);

        return !querySnapshot.empty;
    } catch (error) {
        console.error("Error al verificar si el usuario es administrador:", error);
        return false;
    }
}

async function awardTournamentsPlayed(torneoId) {
    console.log(`Iniciando el registro del torneo ${torneoId} para los participantes...`);
    try {
        const inscripcionesRef = collection(db, "torneos", torneoId, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("asistenciaConfirmada", "==", true),
            where("estado", "==", "inscrito")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log(`No hay participantes confirmados para el torneo ${torneoId}.`);
            return;
        }

        console.log(`Registrando torneo para ${snapshot.size} participantes.`);
        const updatePromises = snapshot.docs.map(async (inscritoDoc) => {
            const participante = inscritoDoc.data();
            const userRef = doc(db, "usuarios", participante.userId);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const userTorneos = Array.isArray(userData.torneos) ? userData.torneos : [];
                if (!userTorneos.includes(torneoId)) {
                    userTorneos.push(torneoId);
                }
                
                await updateDoc(userRef, {
                    torneos: userTorneos
                });
            }
        });

        await Promise.all(updatePromises);
        console.log("Torneos jugados actualizados con éxito.");

    } catch (error) {
        console.error("Error al registrar torneos jugados:", error);
    }
}

async function updateTorneoEstado(torneoId, newEstado) {
    const torneoRef = doc(db, "torneos", torneoId);
    try {
        await updateDoc(torneoRef, { estado: newEstado });
        console.log(`Estado del torneo ${torneoId} actualizado a ${newEstado}`);

        // Si el estado cambia a "En Progreso" o "Finalizado", procesamos a los participantes
        if (newEstado === 'En Progreso' || newEstado === 'Finalizado') {
            await awardTournamentsPlayed(torneoId);
        }

        // Vuelve a cargar la lista de torneos para reflejar el cambio
        await loadTorneos();
        alert(`Estado del torneo actualizado a: ${newEstado}`);

    } catch (error) {
        console.error("Error al actualizar el estado del torneo:", error);
        alert("Error al actualizar el estado: " + error.message);
    }
}

// Cargar torneos en la tabla
async function loadTorneos() {
    console.log("Cargando lista de torneos para la administración...");
    if (!torneosTableBody) {
        console.error("No se encontró el cuerpo de la tabla de torneos.");
        return;
    }

    torneosTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Cargando torneos...</td></tr>';

    try {
        const torneosRef = collection(db, "torneos");
        const q = query(torneosRef, orderBy("fecha", "asc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            torneosTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500">No hay torneos registrados.</td></tr>';
            return;
        }

        torneosTableBody.innerHTML = '';
        const torneosPromises = querySnapshot.docs.map(async (docSnapshot) => {
            const torneoData = docSnapshot.data();
            const torneoId = docSnapshot.id;

            // Obtener el número de inscritos
            const inscritosCount = await countInscriptions(torneoId);

            // Crear la fila de la tabla
            const newRow = document.createElement('tr');
            newRow.classList.add('bg-white', 'border-b', 'hover:bg-gray-50');
            newRow.innerHTML = `
    <td class="py-3 px-6 text-center">${torneoData.nombre}</td>
    <td class="py-3 px-6 text-center">${new Date(torneoData.fecha.seconds * 1000).toLocaleDateString()}</td>
    <td class="py-3 px-6 text-center">${torneoData.juego}</td>
    <td class="py-3 px-6 text-center">${torneoData.estado}</td>
    <td class="py-3 px-6 text-center">${inscritosCount}</td>
    <td class="py-3 px-6 text-center">
        <select class="estado-select bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option value="Proximamente" ${torneoData.estado === 'Proximamente' ? 'selected' : ''}>Proximamente</option>
            <option value="Inscripciones Abiertas" ${torneoData.estado === 'Inscripciones Abiertas' ? 'selected' : ''}>Inscripciones Abiertas</option>
            <option value="Check In" ${torneoData.estado === 'Check In' ? 'selected' : ''}>Check In</option>
            <option value="En Progreso" ${torneoData.estado === 'En Progreso' ? 'selected' : ''}>En Progreso</option>
            <option value="Finalizado" ${torneoData.estado === 'Finalizado' ? 'selected' : ''}>Finalizado</option>
            <option value="Cancelado" ${torneoData.estado === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
        </select>
    </td>
    <td class="py-3 px-6 text-center">
        <button class="edit-btn text-blue-600 hover:text-blue-800" data-id="${torneoId}"><i class="fas fa-edit"></i></button>
        <button class="delete-btn text-red-600 hover:text-red-800 ml-2" data-id="${torneoId}"><i class="fas fa-trash-alt"></i></button>
    </td>
`;

            const estadoSelect = newRow.querySelector('.estado-select');
            estadoSelect.addEventListener('change', async (e) => {
                await updateTorneoEstado(torneoId, e.target.value);
            });

            return newRow;
        });

        const rows = await Promise.all(torneosPromises);
        rows.forEach(row => torneosTableBody.appendChild(row));

    } catch (error) {
        console.error("Error al cargar los torneos:", error);
        torneosTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-red-500">Error al cargar torneos.</td></tr>';
    }

    countInscriptions()
}

// Nueva función para contar inscritos
async function countInscriptions(torneoId) {
    try {
        const inscripcionesRef = collection(db, "torneos", torneoId, "inscripciones");
        const q = query(inscripcionesRef);
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error("Error al contar inscripciones:", error);
        return 0;
    }
}


// Renderizar torneos en la tabla
function renderTorneosTable(torneos) {
    if (!torneosTableBody) return;

    let html = '';

    torneos.forEach(torneo => {
        // Formatear fecha
        const fecha = torneo.fecha ? new Date(torneo.fecha.seconds * 1000) : new Date();
        const fechaFormateada = fecha.toLocaleDateString('es-ES');

        // Calcular número de inscritos
        const inscritos = torneo.participants ? torneo.participants.length : 0;

        // Estado del torneo con colores
        let estadoClass = '';
        switch (torneo.estado) {
            case 'Abierto':
                estadoClass = 'bg-green-100 text-green-700';
                break;
            case 'En Progreso':
                estadoClass = 'bg-yellow-100 text-yellow-700';
                break;
            case 'Finalizado':
                estadoClass = 'bg-gray-100 text-gray-700';
                break;
            case 'Próximamente':
                estadoClass = 'bg-blue-100 text-blue-700';
                break;
            default:
                estadoClass = 'bg-gray-100 text-gray-700';
        }

        // Visibilidad
        const visible = torneo.visible !== false;
        const visibilidadClass = visible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
        const visibilidadText = visible ? 'Visible' : 'Oculto';

        // Fila de la tabla
        html += `
            <tr class="hover:bg-gray-50" data-torneo-id="${torneo.id}">
                <td class="px-4 py-3 border-b">${torneo.nombre || 'Sin nombre'}</td>
                <td class="px-4 py-3 border-b text-center">${fechaFormateada}</td>
                <td class="px-4 py-3 border-b text-center">${inscritos}</td>
                <td class="px-4 py-3 border-b text-center">
                    <span class="px-2 py-1 rounded-full text-xs ${estadoClass}">
                        ${torneo.estado || 'Desconocido'}
                    </span>
                </td>
                <td class="px-4 py-3 border-b text-center">
                    <span class="px-2 py-1 rounded-full text-xs ${visibilidadClass}">
                        ${visibilidadText}
                    </span>
                </td>
                <td class="px-4 py-3 border-b text-center">
                    <button class="text-blue-500 hover:text-blue-700 edit-torneo-btn mx-1" data-torneo-id="${torneo.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-500 hover:text-red-700 delete-torneo-btn mx-1" data-torneo-id="${torneo.id}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                    ${torneo.estado === 'En Progreso' ? `
                        <button class="text-yellow-500 hover:text-yellow-700 view-bracket-btn mx-1" data-torneo-id="${torneo.id}" title="Ver Bracket">
                            <i class="fas fa-trophy"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    });

    torneosTableBody.innerHTML = html;

    // Agregar event listeners a los botones
    setupTorneoButtons();
}

// Configurar botones de acción para torneos
function setupTorneoButtons() {
    // Botones de editar
    document.querySelectorAll('.edit-torneo-btn').forEach(button => {
        button.addEventListener('click', function () {
            const torneoId = this.dataset.torneoId;
            editTorneo(torneoId);
        });
    });

    // Botones de eliminar
    document.querySelectorAll('.delete-torneo-btn').forEach(button => {
        button.addEventListener('click', function () {
            const torneoId = this.dataset.torneoId;
            deleteTorneo(torneoId);
        });
    });

    // Botones de ver bracket
    document.querySelectorAll('.view-bracket-btn').forEach(button => {
        button.addEventListener('click', function () {
            const torneoId = this.dataset.torneoId;
            window.open(`bracket.html?id=${torneoId}`, '_blank');
        });
    });
}

// Mostrar formulario para crear torneo (implementar según tus necesidades)
function showCreateTournamentForm() {
    console.log("Mostrando formulario para crear torneo");
    // Implementar según el diseño de tu aplicación
}

// Editar torneo (implementar según tus necesidades)
function editTorneo(torneoId) {
    console.log("Editando torneo:", torneoId);
    // Implementar según el diseño de tu aplicación
}

// Eliminar torneo
async function deleteTorneo(torneoId) {
    if (!confirm("¿Estás seguro de que deseas eliminar este torneo? Esta acción no se puede deshacer.")) {
        return;
    }

    try {
        // Buscar información del torneo primero para mostrar un mensaje más específico
        const torneoRef = doc(db, "torneos", torneoId);
        const torneoSnap = await getDoc(torneoRef);

        if (!torneoSnap.exists()) {
            alert("El torneo no existe");
            return;
        }

        const torneoData = torneoSnap.data();
        const nombreTorneo = torneoData.nombre || "Torneo sin nombre";

        // Eliminar el torneo
        await deleteDoc(torneoRef);

        alert(`El torneo "${nombreTorneo}" ha sido eliminado correctamente`);

        // Recargar la lista de torneos
        await loadTorneos();

    } catch (error) {
        console.error("Error al eliminar torneo:", error);
        alert("Error al eliminar el torneo: " + error.message);
    }
}

// Exportar funciones que puedan ser necesarias en otros archivos
export {
    loadTorneos,
    checkUserIsAdmin
};
