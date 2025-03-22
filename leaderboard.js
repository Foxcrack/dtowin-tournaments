// leaderboard.js - Script para la visualización del leaderboard global
import { db } from './firebase.js';
import { 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    limit 
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Cargar leaderboard global
export async function loadLeaderboard(limitCount = 10) {
    try {
        console.log("Cargando leaderboard global...");
        
        const leaderboardContainer = document.getElementById('leaderboardBody');
        if (!leaderboardContainer) {
            console.error("No se encontró el contenedor del leaderboard");
            return;
        }
        
        // Mostrar indicador de carga
        leaderboardContainer.innerHTML = `
            <div class="col-span-12 p-4 text-center">
                <div class="spinner w-8 h-8 border-t-4 border-b-4 border-blue-500 rounded-full mx-auto mb-2"></div>
                <p class="text-gray-500">Cargando leaderboard...</p>
            </div>
        `;
        
        // Obtener usuarios ordenados por puntos (de mayor a menor)
        const usersRef = collection(db, "usuarios");
        const q = query(usersRef, orderBy("puntos", "desc"), limit(limitCount));
        const querySnapshot = await getDocs(q);
        
        // Si no hay usuarios
        if (querySnapshot.empty) {
            leaderboardContainer.innerHTML = `
                <div class="col-span-12 p-4 text-center">
                    <p class="text-gray-500">No hay usuarios registrados en el leaderboard</p>
                </div>
            `;
            return;
        }
        
        // Procesar usuarios
        let html = '';
        let position = 1;
        
        querySnapshot.forEach(doc => {
            const userData = doc.data();
            const nombre = userData.nombre || 'Usuario';
            const puntos = userData.puntos || 0;
            const photoURL = userData.photoURL || 'https://via.placeholder.com/50';
            const torneos = userData.torneos ? userData.torneos.length : 0;
            
            // Determinar clases para destacar los primeros lugares
            let rowClass = '';
            let positionClass = 'text-center font-bold text-xl';
            
            if (position === 1) {
                rowClass = 'bg-yellow-50';
                positionClass += ' text-yellow-500';
            } else if (position === 2) {
                rowClass = 'bg-gray-50';
                positionClass += ' text-gray-500';
            } else if (position === 3) {
                rowClass = 'bg-orange-50';
                positionClass += ' text-orange-500';
            }
            
            // Generar HTML para los badges del usuario
            let badgesHTML = '';
            if (userData.badges) {
                const badges = Object.entries(userData.badges);
                badges.slice(0, 3).forEach(([badgeId, badgeData]) => {
                    // En un caso real, aquí consultaríamos la info del badge
                    // Para simplificar, usamos íconos genéricos
                    let iconClass = 'fas fa-trophy';
                    let bgColor = 'bg-yellow-500';
                    
                    if (badgeId.includes('especial')) {
                        iconClass = 'fas fa-star';
                        bgColor = 'bg-purple-500';
                    } else if (badgeId.includes('medalla')) {
                        iconClass = 'fas fa-medal';
                        bgColor = 'bg-blue-500';
                    }
                    
                    badgesHTML += `<span class="badge ${bgColor}" title="Badge ${badgeId}"><i class="${iconClass}"></i></span>`;
                });
            }
            
            if (!badgesHTML) {
                badgesHTML = '<span class="text-gray-400 text-xs">Sin badges</span>';
            }
            
            // Añadir fila
            html += `
                <div class="grid grid-cols-12 p-4 items-center ${rowClass}">
                    <div class="col-span-1 ${positionClass}">${position}</div>
                    <div class="col-span-6 flex items-center">
                        <img src="${photoURL}" alt="Player" class="w-10 h-10 rounded-full mr-3">
                        <div>
                            <h3 class="font-semibold">${nombre}</h3>
                            <div class="flex">
                                ${badgesHTML}
                            </div>
                        </div>
                    </div>
                    <div class="col-span-2 text-center">${torneos}</div>
                    <div class="col-span-3 text-center font-bold text-lg">${puntos}</div>
                </div>
            `;
            
            position++;
        });
        
        // Si hay más usuarios, mostrar botón para ver tabla completa
        html += `
            <div class="p-4 text-center">
                <button class="text-orange-500 hover:text-orange-700 font-semibold" id="viewMoreBtn">
                    Ver tabla completa
                </button>
            </div>
        `;
        
        leaderboardContainer.innerHTML = html;
        
        // Configurar botón "Ver tabla completa"
        const viewMoreBtn = document.getElementById('viewMoreBtn');
        if (viewMoreBtn) {
            viewMoreBtn.addEventListener('click', () => {
                loadMoreLeaderboard(limitCount * 2); // Cargar el doble de usuarios
            });
        }
        
        console.log("Leaderboard cargado correctamente");
        
    } catch (error) {
        console.error("Error al cargar leaderboard:", error);
        const leaderboardContainer = document.getElementById('leaderboardBody');
        if (leaderboardContainer) {
            leaderboardContainer.innerHTML = `
                <div class="col-span-12 p-4 text-center">
                    <p class="text-red-500">Error al cargar el leaderboard</p>
                    <button class="text-blue-500 underline mt-2" onclick="window.loadLeaderboard()">
                        Intentar de nuevo
                    </button>
                </div>
            `;
        }
    }
}

// Cargar más usuarios en el leaderboard
async function loadMoreLeaderboard(count) {
    // Esta función podría cargar más usuarios o redirigir a una página específica
    // Para simplificar, solo recargamos con un límite mayor
    await loadLeaderboard(count);
}
