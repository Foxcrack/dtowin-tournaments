// fix-tournaments-image.js - Script para corregir problemas con imageUrl en torneos
import { db, storage } from './firebase.js';
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

/**
 * Este script está diseñado para corregir problemas con el campo imageUrl en los torneos
 * Puede ejecutarse desde la consola del navegador o como un script independiente
 */

// Función principal para corregir todos los torneos
export async function fixAllTournamentsImageUrls() {
    try {
        console.log("Iniciando corrección de imageUrl en torneos...");
        
        // Obtener todos los torneos
        const torneosRef = collection(db, "torneos");
        const torneosSnapshot = await getDocs(torneosRef);
        
        if (torneosSnapshot.empty) {
            console.log("No se encontraron torneos para corregir.");
            return;
        }
        
        console.log(`Encontrados ${torneosSnapshot.size} torneos. Procesando...`);
        
        // Procesar cada torneo
        let correctedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        for (const torneoDoc of torneosSnapshot.docs) {
            try {
                const torneoId = torneoDoc.id;
                const torneoData = torneoDoc.data();
                
                // Verificar si el campo imageUrl es undefined
                if (torneoData.imageUrl === undefined) {
                    console.log(`Corrigiendo torneo: ${torneoId} (${torneoData.nombre || "Sin nombre"})`);
                    
                    // Actualizar el documento con imageUrl = null (valor seguro)
                    await updateDoc(doc(db, "torneos", torneoId), {
                        imageUrl: null
                    });
                    
                    console.log(`✅ Torneo ${torneoId} corregido (imageUrl: undefined -> null)`);
                    correctedCount++;
                } else {
                    console.log(`Torneo ${torneoId} ya tiene un valor válido para imageUrl: ${torneoData.imageUrl !== null ? "tiene URL" : "null"}`);
                    skippedCount++;
                }
            } catch (torneoError) {
                console.error(`Error al procesar torneo ${torneoDoc.id}:`, torneoError);
                errorCount++;
            }
        }
        
        console.log("Corrección de torneos completada:");
        console.log(`- Torneos corregidos: ${correctedCount}`);
        console.log(`- Torneos sin cambios: ${skippedCount}`);
        console.log(`- Errores: ${errorCount}`);
        
        return {
            correctedCount,
            skippedCount,
            errorCount,
            total: torneosSnapshot.size
        };
        
    } catch (error) {
        console.error("Error al corregir torneos:", error);
        throw error;
    }
}

// Función para corregir un torneo específico
export async function fixTournamentImageUrl(tournamentId) {
    try {
        console.log(`Intentando corregir torneo ${tournamentId}...`);
        
        // Obtener datos del torneo
        const tournamentRef = doc(db, "torneos", tournamentId);
        const tournamentSnap = await getDoc(tournamentRef);
        
        if (!tournamentSnap.exists()) {
            console.error(`El torneo ${tournamentId} no existe`);
            return false;
        }
        
        const tournamentData = tournamentSnap.data();
        
        // Verificar si el campo imageUrl es undefined
        if (tournamentData.imageUrl === undefined) {
            // Actualizar el documento con imageUrl = null (valor seguro)
            await updateDoc(tournamentRef, {
                imageUrl: null
            });
            
            console.log(`✅ Torneo ${tournamentId} corregido (imageUrl: undefined -> null)`);
            return true;
        } else {
            console.log(`Torneo ${tournamentId} ya tiene un valor válido para imageUrl`);
            return false;
        }
        
    } catch (error) {
        console.error(`Error al corregir torneo ${tournamentId}:`, error);
        throw error;
    }
}

// Ejecutar automáticamente si se usa como script independiente
if (typeof window !== 'undefined' && window.location.href.includes('admin-torneos.html')) {
    console.log("Script fix-tournaments-image.js cargado en página de torneos");
    console.log("Puedes ejecutar fixAllTournamentsImageUrls() para corregir todos los torneos");
    console.log("O fixTournamentImageUrl('ID_DEL_TORNEO') para corregir un torneo específico");
    
    // Exponer funciones globalmente para uso en consola
    window.fixAllTournamentsImageUrls = fixAllTournamentsImageUrls;
    window.fixTournamentImageUrl = fixTournamentImageUrl;
}
