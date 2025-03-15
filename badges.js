// badges.js - Funciones para gestión de badges
import { db, auth, storage } from './firebase.js';
import { collection, addDoc, getDocs, doc, updateDoc, query, where, getDoc } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

// Función para crear un badge con imagen PNG
export async function createBadge(badgeData, imageFile) {
  try {
    const user = auth.currentUser;
    
    // Verificar si el usuario es host
    const usersCollection = collection(db, "usuarios");
    const q = query(usersCollection, where("uid", "==", user.uid), where("isHost", "==", true));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error("Solo el host puede crear badges");
    }
    
    // Subir imagen del badge (PNG)
    let imageUrl = null;
    if (imageFile) {
      // Verificar que sea un archivo de imagen (PNG preferiblemente)
      if (!imageFile.type.startsWith('image/')) {
        throw new Error("El archivo debe ser una imagen");
      }
      
      // Referencia única para el archivo en Storage
      const storageRef = ref(storage, `badges/${Date.now()}_${imageFile.name}`);
      
      // Subir el archivo
      await uploadBytes(storageRef, imageFile);
      
      // Obtener la URL de descarga
      imageUrl = await getDownloadURL(storageRef);
    }
    
    // Añadir badge con imagen PNG a Firestore
    const badgeRef = await addDoc(collection(db, "badges"), {
      nombre: badgeData.nombre,
      descripcion: badgeData.descripcion,
      imageUrl: imageUrl,
      color: badgeData.color || "#ff6b1a", // Color de fondo opcional para badges sin transparencia
      createdBy: user.uid,
      createdAt: new Date()
    });
    
    return { id: badgeRef.id };
  } catch (error) {
    console.error("Error al crear badge:", error);
    throw error;
  }
}

// Obtener todos los badges
export async function getAllBadges() {
  try {
    const badgesCollection = collection(db, "badges");
    const badgesSnapshot = await getDocs(badgesCollection);
    const badgesList = badgesSnapshot.docs.map(doc => {
      return { id: doc.id, ...doc.data() };
    });
    return badgesList;
  } catch (error) {
    console.error("Error al obtener badges:", error);
    throw error;
  }
}

// Asignar un badge a un usuario (solo host)
export async function assignBadgeToUser(badgeId, userId) {
  try {
    const currentUser = auth.currentUser;
    
    // Verificar si es host
    const usersCollection = collection(db, "usuarios");
    const q = query(usersCollection, where("uid", "==", currentUser.uid), where("isHost", "==", true));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error("Solo el host puede asignar badges");
    }
    
    // Verificar que el badge existe
    const badgeRef = doc(db, "badges", badgeId);
    const badgeSnap = await getDoc(badgeRef);
    
    if (!badgeSnap.exists()) {
      throw new Error("El badge no existe");
    }
    
    // Asignar badge al usuario
    await addDoc(collection(db, "user_badges"), {
      userId: userId,
      badgeId: badgeId,
      assignedBy: currentUser.uid,
      assignedAt: new Date()
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error al asignar badge:", error);
    throw error;
  }
}

// Obtener badges de un usuario
export async function getUserBadges(userId) {
  try {
    const userBadgesCollection = collection(db, "user_badges");
    const q = query(userBadgesCollection, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    
    // Obtener los IDs de los badges
    const badgeIds = querySnapshot.docs.map(doc => doc.data().badgeId);
    
    // Si no hay badges, retornar array vacío
    if (badgeIds.length === 0) return [];
    
    // Obtener los detalles de cada badge
    const badgesData = [];
    for (const badgeId of badgeIds) {
      const badgeRef = doc(db, "badges", badgeId);
      const badgeSnap = await getDoc(badgeRef);
      if (badgeSnap.exists()) {
        badgesData.push({
          id: badgeId,
          ...badgeSnap.data()
        });
      }
    }
    
    return badgesData;
  } catch (error) {
    console.error("Error al obtener badges del usuario:", error);
    throw error;
  }
}

// Asignar badge a un torneo (para configurarlo previamente)
export async function assignBadgeToTournament(badgeId, tournamentId, position) {
  try {
    const currentUser = auth.currentUser;
    
    // Verificar si es host
    const usersCollection = collection(db, "usuarios");
    const q = query(usersCollection, where("uid", "==", currentUser.uid), where("isHost", "==", true));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error("Solo el host puede asignar badges a torneos");
    }
    
    // Añadir asignación a la colección de badges de torneos
    await addDoc(collection(db, "tournament_badges"), {
      tournamentId: tournamentId,
      badgeId: badgeId,
      position: position, // Por ejemplo: "first", "all", etc.
      createdBy: currentUser.uid,
      createdAt: new Date()
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error al asignar badge al torneo:", error);
    throw error;
  }
}
