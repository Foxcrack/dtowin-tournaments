// leaderboard.js - Script para la gestión del leaderboard global
import { auth, db } from '../../firebase.js';
import { 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    limit 
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Función para cargar el leaderboard
export async function loadLeaderboard() {
    try {
        console.log("Cargando leaderboard...");
        
        const leaderboardContainer = document.getElementById('leaderboardBody');
        if (!leaderboardContainer) {
            console.error("No se encontró el contenedor del leaderboard");
            return;
        }
        
        // Mostrar indicador de carga
        leaderboardContainer.innerHTML = `
            <div class="p-4 text-center">
                <div class="spinner w-8 h-8 border-t-4 border-b-4 border-blue-500 rounded-full mx-auto mb-2"></div>
                <p class="text-gray-500">Cargando leaderboard...</p>
            </div>
        `;
        
        try {
            // Obtener usuarios ordenados por puntaje (de mayor a menor)
            const usersRef = collection(db, "usuarios");
            const q = query(usersRef, orderBy("puntos", "desc"), limit(8)); // Limitar a 8 para la vista previa
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                leaderboardContainer.innerHTML = `
                    <div class="p-4 text-center">
                        <p class="text-gray-500">No hay datos disponibles en el leaderboard</p>
                    </div>
                `;
                return;
            }
            
            // Generar filas del leaderboard
            let html = '';
            let position = 1;
            
            querySnapshot.forEach(doc => {
                const userData = doc.data();
                const userId = doc.id;
                const username = userData.nombre || 'Usuario';
                const photoURL = userData.photoURL || 'dtowin.png';
                const puntos = userData.puntos || 0;
                const torneos = userData.torneos ? userData.torneos.length : 0;
                const badgesCount = userData.badges ? Object.keys(userData.badges).length : 0;
                
                // Definir clase de posición para destacar los primeros lugares
                let positionClass = '';
                if (position === 1) {
                    positionClass = 'bg-yellow-100'; // Fondo para primer lugar
                } else if (position === 2) {
                    positionClass = 'bg-gray-100'; // Fondo para segundo lugar
                } else if (position === 3) {
                    positionClass = 'bg-red-100'; // Fondo ROJO para tercer lugar (según solicitud)
                }
                
                html += `
                    <a href="../../perfil.html?uid=${userData.uid}" class="block hover:bg-gray-50 transition cursor-pointer">
                        <div class="grid grid-cols-12 py-3 px-4 items-center ${positionClass}">
                            <div class="col-span-1 text-center font-bold text-lg">${position}</div>
                            <div class="col-span-6 flex items-center">
                                <img src="${photoURL}" alt="${username}" class="w-8 h-8 rounded-full mr-3">
                                <div>
                                    <p class="font-medium">${username}</p>
                                    <p class="text-xs text-gray-500">
                                        ${badgesCount > 0 ? `${badgesCount} badges` : 'Sin badges'}
                                    </p>
                                </div>
                            </div>
                            <div class="col-span-2 text-center">${torneos}</div>
                            <div class="col-span-3 text-center font-bold">${puntos}</div>
                        </div>
                    </a>
                `;
                
                position++;
            });
            
            // Agregar botón para ver tabla completa
            html += `
                <div class="p-4 text-center">
                    <a href="leaderboard-completo.html" class="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                        Ver tabla completa
                    </a>
                </div>
            `;
            
            leaderboardContainer.innerHTML = html;
            console.log("Leaderboard cargado correctamente");
        } catch (error) {
            console.error("Error al consultar leaderboard:", error);
            leaderboardContainer.innerHTML = `
                <div class="p-4 text-center">
                    <p class="text-red-500">Error al cargar el leaderboard. Inténtalo de nuevo.</p>
                    <button class="mt-2 text-blue-500 underline" onclick="window.location.reload()">
                        Reintentar
                    </button>
                </div>
            `;
        }
        
    } catch (error) {
        console.error("Error al cargar leaderboard:", error);
        
        const leaderboardContainer = document.getElementById('leaderboardBody');
        if (leaderboardContainer) {
            leaderboardContainer.innerHTML = `
                <div class="p-4 text-center">
                    <p class="text-red-500">Error al cargar el leaderboard. Inténtalo de nuevo.</p>
                    <button class="mt-2 text-blue-500 underline" onclick="window.location.reload()">
                        Reintentar
                    </button>
                </div>
            `;
        }
    }
}

// Función para cargar el leaderboard completo (para la página leaderboard-completo.html)
export async function loadFullLeaderboard() {
    try {
        console.log("Cargando leaderboard completo...");
        
        const fullLeaderboardContainer = document.getElementById('fullLeaderboardBody');
        if (!fullLeaderboardContainer) {
            console.error("No se encontró el contenedor del leaderboard completo");
            return;
        }
        
        // Mostrar indicador de carga
        fullLeaderboardContainer.innerHTML = `
            <div class="p-4 text-center">
                <div class="spinner w-8 h-8 border-t-4 border-b-4 border-blue-500 rounded-full mx-auto mb-2"></div>
                <p class="text-gray-500">Cargando todos los jugadores...</p>
            </div>
        `;
        
        try {
            // Obtener todos los usuarios ordenados por puntaje (sin límite)
            const usersRef = collection(db, "usuarios");
            const q = query(usersRef, orderBy("puntos", "desc"));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                fullLeaderboardContainer.innerHTML = `
                    <div class="p-4 text-center">
                        <p class="text-gray-500">No hay datos disponibles en el leaderboard</p>
                    </div>
                `;
                return;
            }
            
            // Generar filas del leaderboard completo
            let html = '';
            let position = 1;
            
            querySnapshot.forEach(doc => {
                const userData = doc.data();
                const userId = doc.id;
                const username = userData.nombre || 'Usuario';
                const photoURL = userData.photoURL || 'dtowin.png';
                const puntos = userData.puntos || 0;
                const torneos = userData.torneos ? userData.torneos.length : 0;
                const badgesCount = userData.badges ? Object.keys(userData.badges).length : 0;
                
                // Definir clase de posición para destacar los primeros lugares
                let positionClass = '';
                if (position === 1) {
                    positionClass = 'bg-yellow-100'; // Fondo para primer lugar
                } else if (position === 2) {
                    positionClass = 'bg-gray-100'; // Fondo para segundo lugar
                } else if (position === 3) {
                    positionClass = 'bg-red-100'; // Fondo para tercer lugar
                }
                
                html += `
                    <a href="../../perfil.html?uid=${userData.uid}" class="block hover:bg-gray-50 transition cursor-pointer">
                        <div class="grid grid-cols-12 py-3 px-4 items-center ${positionClass}">
                            <div class="col-span-1 text-center font-bold text-lg">${position}</div>
                            <div class="col-span-6 flex items-center">
                                <img src="${photoURL}" alt="${username}" class="w-8 h-8 rounded-full mr-3">
                                <div>
                                    <p class="font-medium">${username}</p>
                                    <p class="text-xs text-gray-500">
                                        ${badgesCount > 0 ? `${badgesCount} badges` : 'Sin badges'}
                                    </p>
                                </div>
                            </div>
                            <div class="col-span-2 text-center">${torneos}</div>
                            <div class="col-span-3 text-center font-bold">${puntos}</div>
                        </div>
                    </a>
                `;
                
                position++;
            });
            
            fullLeaderboardContainer.innerHTML = html;
            console.log("Leaderboard completo cargado correctamente");
        } catch (error) {
            console.error("Error al consultar leaderboard completo:", error);
            fullLeaderboardContainer.innerHTML = `
                <div class="p-4 text-center">
                    <p class="text-red-500">Error al cargar el leaderboard completo. Inténtalo de nuevo.</p>
                    <button class="mt-2 text-blue-500 underline" onclick="window.location.reload()">
                        Reintentar
                    </button>
                </div>
            `;
        }
        
    } catch (error) {
        console.error("Error al cargar leaderboard completo:", error);
        
        const fullLeaderboardContainer = document.getElementById('fullLeaderboardBody');
        if (fullLeaderboardContainer) {
            fullLeaderboardContainer.innerHTML = `
                <div class="p-4 text-center">
                    <p class="text-red-500">Error al cargar el leaderboard completo. Inténtalo de nuevo.</p>
                    <button class="mt-2 text-blue-500 underline" onclick="window.location.reload()">
                        Reintentar
                    </button>
                </div>
            `;
        }
    }
}

