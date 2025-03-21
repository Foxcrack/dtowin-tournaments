// admin-panel-dashboard.js - Script para el dashboard principal

// Referencias a elementos del DOM
const totalUsuariosCounter = document.getElementById('totalUsuariosCounter');
const torneosActivosCounter = document.getElementById('torneosActivosCounter');
const badgesOtorgadosCounter = document.getElementById('badgesOtorgadosCounter');
const proximosTorneosTable = document.getElementById('proximosTorneosTable');

// Variable para controlar el estado de inicialización
let isInitialized = false;

// Inicializar dashboard
async function initDashboard() {
    // Evitar inicialización múltiple
    if (isInitialized) {
        console.log("El dashboard ya está inicializado");
        return;
    }
    
    try {
        console.log("Inicializando dashboard...");
        isInitialized = true;
        
        // Obtener el usuario autenticado actual
        const currentUser = firebase.auth().currentUser;
        
        // Cargar datos para el dashboard
        await Promise.all([
            loadEstadisticasGenerales(),
            loadProximosTorneos()
        ]);
        
        console.log("Dashboard inicializado correctamente");
        
    } catch (error) {
        console.error("Error al inicializar dashboard:", error);
        mostrarNotificacion("Error al cargar el dashboard. Inténtalo de nuevo.", "error");
    }
}

// Cargar estadísticas generales
async function loadEstadisticasGenerales() {
    try {
        console.log("Cargando estadísticas generales...");
        
        // Total de usuarios
        if (totalUsuariosCounter) {
            const usuariosSnapshot = await firebase.firestore().collection('usuarios').get();
            totalUsuariosCounter.textContent = usuariosSnapshot.size.toString();
        }
        
        // Torneos activos (estado = 'Abierto' o 'En Progreso')
        if (torneosActivosCounter) {
            const torneosActivosSnapshot = await firebase.firestore().collection('torneos')
                .where('estado', 'in', ['Abierto', 'En Progreso'])
                .get();
            torneosActivosCounter.textContent = torneosActivosSnapshot.size.toString();
        }
        
        // Badges otorgados
        if (badgesOtorgadosCounter) {
            let totalBadges = 0;
            
            // Obtener todos los usuarios
            const usuariosSnapshot = await firebase.firestore().collection('usuarios').get();
            
            // Contar badges para cada usuario
            usuariosSnapshot.forEach(doc => {
                const userData = doc.data();
                if (userData.badges) {
                    totalBadges += Object.keys(userData.badges).length;
                }
            });
            
            badgesOtorgadosCounter.textContent = totalBadges.toString();
        }
        
        console.log("Estadísticas generales cargadas correctamente");
        
    } catch (error) {
        console.error("Error al cargar estadísticas generales:", error);
        
        // Establecer valores por defecto en caso de error
        if (totalUsuariosCounter) totalUsuariosCounter.textContent = "--";
        if (torneosActivosCounter) torneosActivosCounter.textContent = "--";
        if (badgesOtorgadosCounter) badgesOtorgadosCounter.textContent = "--";
    }
}

// Cargar próximos torneos
async function loadProximosTorneos() {
    try {
        console.log("Cargando próximos torneos...");
        
        if (!proximosTorneosTable) {
            console.warn("No se encontró la tabla de próximos torneos");
            return;
        }
        
        // Mostrar spinner mientras carga
        proximosTorneosTable.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                    <div class="flex justify-center">
                        <div class="spinner rounded-full h-6 w-6 border-t-2 border-b-2 border-orange-500"></div>
                    </div>
                </td>
            </tr>
        `;
        
        // Obtener la fecha actual
        const fechaActual = new Date();
        const timestampActual = firebase.firestore.Timestamp.fromDate(fechaActual);
        
        // Obtener torneos que no estén en estado 'Finalizado' o 'Cerrado'
        const torneosSnapshot = await firebase.firestore().collection('torneos')
            .where('estado', 'in', ['Abierto', 'Próximamente', 'En Progreso', 'Próximo'])
            .orderBy('fecha', 'asc')
            .get();
        
        if (torneosSnapshot.empty) {
            proximosTorneosTable.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                        No hay torneos próximos o abiertos
                    </td>
                </tr>
            `;
            return;
        }
        
        // Generar las filas de la tabla
        let html = '';
        
        torneosSnapshot.forEach(doc => {
            const torneo = {
                id: doc.id,
                ...doc.data()
            };
            
            // Formatear fecha
            const fechaTorneo = torneo.fecha ? new Date(torneo.fecha.seconds * 1000) : null;
            const fechaFormateada = fechaTorneo ? formatearFecha(fechaTorneo) : 'Sin fecha';
            
            // Calcular inscritos/capacidad
            const inscritos = torneo.participants ? torneo.participants.length : 0;
            const capacidad = torneo.capacidad || '∞';
            const inscritosCapacidad = `${inscritos} / ${capacidad}`;
            
            // Determinar clase del estado
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
                case 'Próximo':
                case 'Próximamente':
                    estadoClase = 'bg-yellow-100 text-yellow-800';
                    estadoTexto = 'Próximo';
                    break;
                default:
                    estadoClase = 'bg-gray-100 text-gray-800';
                    estadoTexto = torneo.estado || 'Desconocido';
            }
            
            html += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="font-medium text-gray-900">${torneo.nombre || 'Sin nombre'}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${fechaFormateada}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${inscritosCapacidad}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${estadoClase}">
                            ${estadoTexto}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a href="admin-torneos.html?id=${torneo.id}" class="text-blue-600 hover:text-blue-900">
                            <i class="fas fa-eye"></i> Ver
                        </a>
                    </td>
                </tr>
            `;
        });
        
        proximosTorneosTable.innerHTML = html;
        
        console.log("Próximos torneos cargados correctamente");
        
    } catch (error) {
        console.error("Error al cargar próximos torneos:", error);
        
        proximosTorneosTable.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-4 text-center text-sm text-red-500">
                    Error al cargar los torneos. <button class="text-blue-500 underline" onclick="location.reload()">Reintentar</button>
                </td>
            </tr>
        `;
    }
}

// Formatear fecha para mostrar en la tabla
function formatearFecha(fecha) {
    const dia = fecha.getDate();
    const mes = obtenerNombreMes(fecha.getMonth());
    const anio = fecha.getFullYear();
    
    return `${dia} de ${mes}, ${anio}`;
}

// Obtener nombre del mes
function obtenerNombreMes(numeroMes) {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    return meses[numeroMes];
}

// Función para mostrar notificaciones (respaldo por si no está disponible la global)
function mostrarNotificacion(mensaje, tipo = "info") {
    if (window.mostrarNotificacion) {
        // Usar la función global si está disponible
        window.mostrarNotificacion(mensaje, tipo);
    } else {
        // Implementación de respaldo
        console.log(`Notificación (${tipo}): ${mensaje}`);
    }
}

// Exportar funciones necesarias
export {
    initDashboard
};
