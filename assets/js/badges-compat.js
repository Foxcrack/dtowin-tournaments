// badges-compat.js - Versión compatible de las funciones de badges para usar con la API de Firebase compat

// Obtener todos los badges asignados a un torneo - Versión compatible
export async function getTournamentBadges(tournamentId) {
    try {
        if (!tournamentId) {
            throw new Error("Se requiere un ID de torneo");
        }
        
        // Usar la API compatible de Firebase
        const badgesSnapshot = await firebase.firestore()
            .collection("tournament_badges")
            .where("tournamentId", "==", tournamentId)
            .get();
        
        // Si no hay badges asignados, retornar array vacío
        if (badgesSnapshot.empty) return [];
        
        // Obtener los detalles de cada badge
        const badgesData = [];
        
        for (const doc of badgesSnapshot.docs) {
            const badgeAssignment = doc.data();
            const badgeRef = await firebase.firestore()
                .collection("badges")
                .doc(badgeAssignment.badgeId)
                .get();
            
            if (badgeRef.exists) {
                badgesData.push({
                    id: doc.id,
                    ...badgeAssignment,
                    badge: {
                        id: badgeAssignment.badgeId,
                        ...badgeRef.data()
                    }
                });
            }
        }
        
        return badgesData;
    } catch (error) {
        console.error("Error al obtener badges del torneo:", error);
        return [];
    }
}

// Obtener todos los badges - Versión compatible
export async function getAllBadges() {
    try {
        const badgesSnapshot = await firebase.firestore()
            .collection("badges")
            .get();
        
        if (badgesSnapshot.empty) {
            return [];
        }
        
        const badges = [];
        badgesSnapshot.forEach(doc => {
            badges.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return badges;
    } catch (error) {
        console.error("Error loading badges:", error);
        return [];
    }
}
