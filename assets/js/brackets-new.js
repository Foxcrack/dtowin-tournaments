// brackets-new.js - Sistema mejorado de brackets para torneos

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, doc, getDoc, addDoc, setDoc, where, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";

// Configuración de Firebase (usando la misma configuración)
const firebaseConfig = {
    apiKey: "AIzaSyBHW2HsP2T6DOwLaOYloqZFerFmU_UA4kE",
    authDomain: "dtowin-tournament.firebaseapp.com",
    projectId: "dtowin-tournament",
    storageBucket: "dtowin-tournament.appspot.com",
    messagingSenderId: "991226820083",
    appId: "1:991226820083:web:6387773cf8c76a0f6ace86",
    measurementId: "G-R4Q5YKZXGY"
};

// Solo inicializar si no está ya inicializado
let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    // Si ya está inicializado, usar las instancias existentes
    app = firebase.app();
    db = firebase.firestore();
    auth = firebase.auth();
}

// Función para verificar permisos de admin
function verifyAdminPermissions() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.log('❌ Usuario no autenticado');
        return false;
    }
    
    const adminUID = "DSopXXULUrR39GeQJgVEAx3nFoi2";
    const isAdmin = currentUser.uid === adminUID;
    
    console.log('🔐 Verificación de admin en brackets:');
    console.log('  - UID actual:', currentUser.uid);
    console.log('  - Es admin:', isAdmin);
    
    return isAdmin;
}

// Función principal para generar bracket del torneo - CON VERIFICACIÓN DE ADMIN
export async function generateTournamentBracket(torneoId) {
    try {
        // Verificar permisos de admin
        if (!verifyAdminPermissions()) {
            throw new Error('Solo el administrador puede generar brackets');
        }
        
        console.log('🎯 Generando bracket para torneo:', torneoId);
        
        // Obtener participantes confirmados (ya incluye bots si los hay)
        const participantesConfirmados = await getConfirmedParticipants(torneoId);

        // Mostrar participantes confirmados en consola
        console.log("👥 Lista de participantes confirmados:");
        participantesConfirmados.forEach((p, idx) => {
            console.log(`  ${idx + 1}. ${p.userName} (${p.userId})`);
        });

        console.log(`📊 Participantes confirmados encontrados: ${participantesConfirmados.length}`);
        
        if (participantesConfirmados.length < 2) {
            throw new Error('Se necesitan al menos 2 participantes confirmados para generar un bracket');
        }
        
        console.log(`🎮 Generando bracket con ${participantesConfirmados.length} participantes`);
        
        // Mezclar participantes aleatoriamente
        const participantesMezclados = shuffleArray([...participantesConfirmados]);
        
        // Generar estructura del bracket
        const bracketData = generateBracketStructure(participantesMezclados);
        
        // Verificar si hay bots en los participantes
        const hayBots = participantesConfirmados.some(p => p.userId.startsWith('bot_'));
        
        console.log('💾 Guardando bracket en Firestore...');
        
        // Guardar bracket en Firestore
        const bracketRef = await addDoc(collection(db, "brackets"), {
            torneoId: torneoId,
            participantes: participantesConfirmados.map(p => p.userId),
            rondas: bracketData.rondas,
            partidos: bracketData.partidos,
            estado: "activo",
            fechaCreacion: serverTimestamp(),
            fechaActualizacion: serverTimestamp(),
            rondaActual: 1,
            totalRondas: bracketData.totalRondas,
            esPrueba: hayBots,
            participantesReales: participantesConfirmados.filter(p => !p.userId.startsWith('bot_')).length,
            participantesBots: participantesConfirmados.filter(p => p.userId.startsWith('bot_')).length
        });
        
        console.log('🔄 Actualizando estado del torneo...');
        
        // Actualizar torneo con el ID del bracket
        const torneoRef = doc(db, "torneos", torneoId);
        await updateDoc(torneoRef, {
            bracketId: bracketRef.id,
            estado: "En Progreso",
            fechaActualizacion: serverTimestamp()
        });
        
        console.log('✅ Bracket generado exitosamente con ID:', bracketRef.id);
        console.log('👥 Participantes en el bracket:', participantesConfirmados.map(p => p.userName));
        
        return bracketRef.id;
        
    } catch (error) {
        console.error('❌ Error generando bracket:', error);
        
        if (error.code === 'permission-denied') {
            throw new Error('Sin permisos para generar bracket - Solo el admin puede hacerlo');
        }
        
        throw error;
    }
}

// Simplificar getConfirmedParticipants - ya no necesita generar bots
async function getConfirmedParticipants(torneoId) {
    try {
        const inscripcionesRef = collection(db, "inscripciones");
        const q = query(
            inscripcionesRef,
            where("torneoId", "==", torneoId),
            where("estado", "==", "inscrito"),
            where("asistenciaConfirmada", "==", true)
        );
        
        const snapshot = await getDocs(q);
        
        const participantes = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            participantes.push({
                userId: data.userId,
                userName: data.userName,
                gameUsername: data.gameUsername,
                discordUsername: data.discordUsername,
                userPhoto: data.userPhoto || 'dtowin.png',
                esBot: data.esBot || false
            });
        });
        
        console.log('Participantes confirmados obtenidos:', participantes.length);
        return participantes;
        
    } catch (error) {
        console.error('Error obteniendo participantes confirmados:', error);
        return [];
    }
}

// Función para mezclar array aleatoriamente (Fisher-Yates)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Generar estructura del bracket
function generateBracketStructure(participantes) {
    const numParticipantes = participantes.length;
    
    // Calcular número de rondas necesarias
    const totalRondas = Math.ceil(Math.log2(numParticipantes));
    
    // Calcular el tamaño perfecto del bracket (próxima potencia de 2)
    const tamanioBracket = Math.pow(2, totalRondas);
    
    console.log(`Creando bracket de ${tamanioBracket} posiciones para ${numParticipantes} participantes en ${totalRondas} rondas`);
    
    // Generar partidos
    const partidos = [];
    const rondas = [];
    
    // Crear información de rondas
    for (let i = 1; i <= totalRondas; i++) {
        const partidosEnRonda = tamanioBracket / Math.pow(2, i);
        rondas.push({
            numero: i,
            nombre: getRoundName(i, totalRondas),
            partidosTotal: partidosEnRonda,
            partidosCompletados: 0
        });
    }
    
    // Generar partidos de la primera ronda
    const partidosPrimeraRonda = tamanioBracket / 2;
    
    for (let i = 0; i < partidosPrimeraRonda; i++) {
        const jugador1Index = i * 2;
        const jugador2Index = i * 2 + 1;
        
        const jugador1 = jugador1Index < participantes.length ? participantes[jugador1Index] : null;
        const jugador2 = jugador2Index < participantes.length ? participantes[jugador2Index] : null;
        
        const partidoId = `r1_p${i + 1}`;
        
        partidos.push({
            id: partidoId,
            ronda: 1,
            posicion: i + 1,
            jugador1: jugador1,
            jugador2: jugador2,
            puntuacionJugador1: 0,
            puntuacionJugador2: 0,
            ganador: null,
            estado: jugador1 && jugador2 ? "pendiente" : (jugador1 || jugador2 ? "walkover" : "bye"),
            siguientePartido: `r2_p${Math.ceil((i + 1) / 2)}`,
            fechaCreacion: new Date(),
            fechaActualizacion: null
        });
        
        // Si solo hay un jugador, avanzar automáticamente
        if ((jugador1 && !jugador2) || (!jugador1 && jugador2)) {
            partidos[partidos.length - 1].ganador = jugador1 || jugador2;
            partidos[partidos.length - 1].estado = "completado";
            partidos[partidos.length - 1].puntuacionJugador1 = jugador1 ? 1 : 0;
            partidos[partidos.length - 1].puntuacionJugador2 = jugador2 ? 1 : 0;
        }
    }
    
    // Generar partidos de rondas siguientes
    for (let ronda = 2; ronda <= totalRondas; ronda++) {
        const partidosEnRonda = tamanioBracket / Math.pow(2, ronda);
        
        for (let i = 0; i < partidosEnRonda; i++) {
            const partidoId = `r${ronda}_p${i + 1}`;
            const siguientePartido = ronda < totalRondas ? `r${ronda + 1}_p${Math.ceil((i + 1) / 2)}` : null;
            
            partidos.push({
                id: partidoId,
                ronda: ronda,
                posicion: i + 1,
                jugador1: null,
                jugador2: null,
                puntuacionJugador1: 0,
                puntuacionJugador2: 0,
                ganador: null,
                estado: "esperando",
                siguientePartido: siguientePartido,
                fechaCreacion: new Date(),
                fechaActualizacion: null
            });
        }
    }
    
    // Avanzar ganadores automáticos de la primera ronda
    propagateWalkoverWinners(partidos);
    
    return {
        partidos: partidos,
        rondas: rondas,
        totalRondas: totalRondas,
        participantesTotales: numParticipantes
    };
}

// Propagar ganadores automáticos (walkovers)
function propagateWalkoverWinners(partidos) {
    const partidosPorId = {};
    partidos.forEach(partido => {
        partidosPorId[partido.id] = partido;
    });
    
    // Buscar partidos completados automáticamente
    const partidosCompletados = partidos.filter(p => p.estado === "completado");
    
    partidosCompletados.forEach(partido => {
        if (partido.siguientePartido && partido.ganador) {
            const siguientePartido = partidosPorId[partido.siguientePartido];
            
            if (siguientePartido) {
                // Determinar si va a la posición 1 o 2 del siguiente partido
                const esParImpar = partido.posicion % 2 !== 0;
                
                if (esParImpar) {
                    siguientePartido.jugador1 = partido.ganador;
                } else {
                    siguientePartido.jugador2 = partido.ganador;
                }
                
                // Si ambos jugadores están presentes, cambiar estado a pendiente
                if (siguientePartido.jugador1 && siguientePartido.jugador2) {
                    siguientePartido.estado = "pendiente";
                } else if (siguientePartido.jugador1 || siguientePartido.jugador2) {
                    // Si solo hay un jugador, mantener como walkover
                    siguientePartido.estado = "walkover";
                    siguientePartido.ganador = siguientePartido.jugador1 || siguientePartido.jugador2;
                    siguientePartido.puntuacionJugador1 = siguientePartido.jugador1 ? 1 : 0;
                    siguientePartido.puntuacionJugador2 = siguientePartido.jugador2 ? 1 : 0;
                    
                    // Propagar recursivamente
                    if (siguientePartido.estado === "completado") {
                        propagateWalkoverWinners([siguientePartido]);
                    }
                }
            }
        }
    });
}

// Obtener nombre de la ronda
function getRoundName(ronda, totalRondas) {
    if (totalRondas === 1) return "Final";
    if (ronda === totalRondas) return "Final";
    if (ronda === totalRondas - 1) return "Semifinal";
    if (ronda === totalRondas - 2) return "Cuartos de Final";
    if (ronda === totalRondas - 3) return "Octavos de Final";
    return `Ronda ${ronda}`;
}

// Función para actualizar resultado de un partido
export async function updateMatchResult(bracketId, partidoId, puntuacionJugador1, puntuacionJugador2) {
    try {
        console.log('Actualizando resultado del partido:', partidoId);
        
        // Obtener bracket
        const bracketRef = doc(db, "brackets", bracketId);
        const bracketSnap = await getDoc(bracketRef);
        
        if (!bracketSnap.exists()) {
            throw new Error('Bracket no encontrado');
        }
        
        const bracketData = bracketSnap.data();
        const partidos = [...bracketData.partidos];
        
        // Encontrar el partido
        const partidoIndex = partidos.findIndex(p => p.id === partidoId);
        if (partidoIndex === -1) {
            throw new Error('Partido no encontrado');
        }
        
        const partido = partidos[partidoIndex];
        
        // Validar que el partido se puede actualizar
        if (partido.estado === "completado") {
            throw new Error('Este partido ya está completado');
        }
        
        if (!partido.jugador1 || !partido.jugador2) {
            throw new Error('El partido no tiene ambos jugadores asignados');
        }
        
        // Determinar ganador
        const ganador = puntuacionJugador1 > puntuacionJugador2 ? partido.jugador1 : partido.jugador2;
        
        // Actualizar partido
        partidos[partidoIndex] = {
            ...partido,
            puntuacionJugador1: puntuacionJugador1,
            puntuacionJugador2: puntuacionJugador2,
            ganador: ganador,
            estado: "completado",
            fechaActualizacion: new Date()
        };
        
        // Avanzar ganador al siguiente partido
        if (partido.siguientePartido) {
            const siguientePartidoIndex = partidos.findIndex(p => p.id === partido.siguientePartido);
            
            if (siguientePartidoIndex !== -1) {
                const siguientePartido = partidos[siguientePartidoIndex];
                
                // Determinar posición en el siguiente partido
                const esParImpar = partido.posicion % 2 !== 0;
                
                if (esParImpar) {
                    partidos[siguientePartidoIndex] = {
                        ...siguientePartido,
                        jugador1: ganador
                    };
                } else {
                    partidos[siguientePartidoIndex] = {
                        ...siguientePartido,
                        jugador2: ganador
                    };
                }
                
                // Cambiar estado del siguiente partido si ambos jugadores están presentes
                const siguienteActualizado = partidos[siguientePartidoIndex];
                if (siguienteActualizado.jugador1 && siguienteActualizado.jugador2) {
                    partidos[siguientePartidoIndex].estado = "pendiente";
                }
            }
        }
        
        // Verificar si el torneo ha terminado
        const esFinal = !partido.siguientePartido;
        let estadoTorneo = "En Progreso";
        
        if (esFinal) {
            estadoTorneo = "Finalizado";
            
            // Actualizar torneo con el ganador
            const torneoRef = doc(db, "torneos", bracketData.torneoId);
            await updateDoc(torneoRef, {
                estado: "Finalizado",
                ganador: ganador.userId,
                fechaFinalizacion: serverTimestamp(),
                fechaActualizacion: serverTimestamp()
            });
        }
        
        // Actualizar bracket
        await updateDoc(bracketRef, {
            partidos: partidos,
            fechaActualizacion: serverTimestamp(),
            estado: estadoTorneo
        });
        
        console.log('Resultado actualizado exitosamente');
        return true;
        
    } catch (error) {
        console.error('Error actualizando resultado:', error);
        throw error;
    }
}

// Función para obtener datos del bracket
export async function getBracketData(bracketId) {
    try {
        const bracketRef = doc(db, "brackets", bracketId);
        const bracketSnap = await getDoc(bracketRef);
        
        if (!bracketSnap.exists()) {
            throw new Error('Bracket no encontrado');
        }
        
        return {
            id: bracketSnap.id,
            ...bracketSnap.data()
        };
        
    } catch (error) {
        console.error('Error obteniendo datos del bracket:', error);
        throw error;
    }
}

// brackets-new.js
import { getFirestore, doc, getDoc } from "firebase/firestore";

const adminUIDs = [
    "dvblFee1ZnVKJNWBOR22tSAsNet2"
];

export async function isAdmin(user) {
    if (!user) return false;
    if (adminUIDs.includes(user.uid)) return true;

    const db = getFirestore();
    const userRef = doc(db, "usuarios", user.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.isHost === true;
    }
    return false;
}

// Almacenar bots en Firestore
export async function storeBotsInFirestore(torneoId, cantidadBots) {
    try {
        const botsGuardados = [];
        
        for (let i = 0; i < cantidadBots; i++) {
            const botId = `bot_${Date.now()}_${i}`;
            const botData = {
                userId: botId,
                userName: `Bot ${i + 1}`,
                gameUsername: `BotGame${i + 1}`,
                discordUsername: `BotDiscord${i + 1}`,
                userPhoto: 'dtowin.png',
                asistenciaConfirmada: true,
                esBot: true,
                estado: "inscrito",
                torneoId: torneoId,
                fechaCreacion: serverTimestamp(),
                fechaActualizacion: serverTimestamp()
            };
            
            // Guardar bot en Firestore
            const botRef = doc(collection(db, "inscripciones"));
            await setDoc(botRef, botData);
            botsGuardados.push(botData);
            
            console.log(`🤖 Bot guardado: ${botData.userName} (${botData.userId})`);
        }
        
        return botsGuardados;
        
    } catch (error) {
        console.error('Error almacenando bots en Firestore:', error);
        throw error;
    }
}