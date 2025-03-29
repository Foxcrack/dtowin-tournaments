// admin-torneos.js - Script para la gestión de torneos en el panel de administración
import { auth, db, isAuthenticated } from './firebase.js';
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

// Cargar torneos en la tabla
async function loadTorneos() {
    try {
        console.log("Cargando torneos para el panel de administración...");
        
        if (!torneosTableBody) {
            console.error("No se encontró el contenedor para la tabla de torneos");
            return;
        }
        
        // Mostrar indicador de carga
        torneosTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="inline-block spinner w-8 h-8 border-t-4 border-b-4 border-blue-500 rounded-full"></div>
                    <p class="mt-2 text-gray-600">Cargando torneos...</p>
                </td>
            </tr>
        `;
        
        // Consultar todos los torneos (sin filtro de visibilidad)
        const torneosRef = collection(db, "torneos");
        // Usar try/catch aquí también para manejar posibles errores en la consulta
        try {
            const querySnapshot = await getDocs(torneosRef);
            
            // Verificar si hay torneos
            if (querySnapshot.empty) {
                torneosTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center py-4">
                            <p class="text-gray-600">No hay torneos disponibles</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            // Procesar torneos
            const torneos = [];
            querySnapshot.forEach(doc => {
                torneos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Ordenar torneos (más recientes primero)
            torneos.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt.seconds * 1000) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt.seconds * 1000) : new Date(0);
                return dateB - dateA;
            });
            
            // Renderizar torneos en la tabla
            renderTorneosTable(torneos);
            
        } catch (queryError) {
            console.error("Error al consultar torneos:", queryError);
            torneosTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <p class="text-red-500">Error al cargar torneos: ${queryError.message}</p>
                        <button class="mt-2 text-blue-500 underline" onclick="window.location.reload()">Reintentar</button>
                    </td>
                </tr>
            `;
        }
        
    } catch (error) {
        console.error("Error general al cargar torneos:", error);
        if (torneosTableBody) {
            torneosTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <p class="text-red-500">Error al cargar torneos: ${error.message}</p>
                        <button class="mt-2 text-blue-500 underline" onclick="window.location.reload()">Reintentar</button>
                    </td>
                </tr>
            `;
        }
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
        button.addEventListener('click', function() {
            const torneoId = this.dataset.torneoId;
            editTorneo(torneoId);
        });
    });
    
    // Botones de eliminar
    document.querySelectorAll('.delete-torneo-btn').forEach(button => {
        button.addEventListener('click', function() {
            const torneoId = this.dataset.torneoId;
            deleteTorneo(torneoId);
        });
    });
    
    // Botones de ver bracket
    document.querySelectorAll('.view-bracket-btn').forEach(button => {
        button.addEventListener('click', function() {
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
