// badges.js - Añadiendo función de edición
// Importar las funciones necesarias de Firebase
import { db, auth, storage } from '../../firebase.js';
import { collection, addDoc, getDocs, doc, updateDoc, query, where, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

// Función para verificar si el usuario actual es host
export async function isUserHost() {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      console.error("No hay usuario autenticado");
      return false;
    }
    
    // Verificar si el usuario es host
    const usersCollection = collection(db, "usuarios");
    const q = query(usersCollection, where("uid", "==", user.uid));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.error("Usuario no encontrado en la base de datos");
      return false;
    }
    
    const userData = querySnapshot.docs[0].data();
    
    // Si el usuario no tiene la propiedad isHost o es false
    if (!userData.isHost) {
      // Intentar actualizar al primer usuario como host si no existe ningún host
      // Esto es útil para el primer usuario que se registra en la aplicación
      const hostQuery = query(usersCollection, where("isHost", "==", true));
      const hostSnapshot = await getDocs(hostQuery);
      
      if (hostSnapshot.empty && querySnapshot.docs[0].id) {
        // Si no existe ningún host, convertir a este usuario en host
        console.log("No se encontró ningún host. Convirtiendo al usuario actual en host...");
        await updateDoc(doc(db, "usuarios", querySnapshot.docs[0].id), {
          isHost: true
        });
        return true;
      }
      
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error al verificar si el usuario es host:", error);
    return false;
  }
}

// Función para crear un badge con imagen PNG
export async function createBadge(badgeData, imageFile) {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error("Debes iniciar sesión para crear un badge");
    }
    
    // Verificar si el usuario es host
    const userIsHost = await isUserHost();
    
    if (!userIsHost) {
      throw new Error("Solo el host puede crear badges. Si eres el administrador, contacta con soporte.");
    }
    
    // Validar datos del badge
    if (!badgeData.nombre) {
      throw new Error("El nombre del badge es obligatorio");
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
      
      try {
        // Subir el archivo
        await uploadBytes(storageRef, imageFile);
        
        // Obtener la URL de descarga
        imageUrl = await getDownloadURL(storageRef);
        console.log("Imagen subida correctamente:", imageUrl);
      } catch (uploadError) {
        console.error("Error al subir la imagen:", uploadError);
        throw new Error("Error al subir la imagen. Verifica tu conexión e inténtalo de nuevo.");
      }
    }
    
    // Añadir badge con imagen PNG a Firestore
    const badgeRef = await addDoc(collection(db, "badges"), {
      nombre: badgeData.nombre,
      descripcion: badgeData.descripcion || "",
      imageUrl: imageUrl,
      color: badgeData.color || "#ff6b1a", // Color de fondo opcional para badges sin transparencia
      icono: badgeData.icono || "trophy", // Icono por defecto
      createdBy: user.uid,
      createdAt: new Date()
    });
    
    console.log("Badge creado con éxito:", badgeRef.id);
    
    return { 
      id: badgeRef.id,
      success: true,
      message: "Badge creado con éxito"
    };
  } catch (error) {
    console.error("Error al crear badge:", error);
    throw error;
  }
}

// Nueva función para editar un badge existente
export async function editBadge(badgeId, badgeData, imageFile) {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error("Debes iniciar sesión para editar un badge");
    }
    
    // Verificar si el usuario es host
    const userIsHost = await isUserHost();
    
    if (!userIsHost) {
      throw new Error("Solo el host puede editar badges");
    }
    
    // Validar datos del badge
    if (!badgeData.nombre) {
      throw new Error("El nombre del badge es obligatorio");
    }
    
    // Obtener referencia al badge
    const badgeRef = doc(db, "badges", badgeId);
    const badgeSnap = await getDoc(badgeRef);
    
    if (!badgeSnap.exists()) {
      throw new Error("El badge no existe");
    }
    
    const badgeActual = badgeSnap.data();
    
    // Preparar objeto de actualización
    const updateData = {
      nombre: badgeData.nombre,
      descripcion: badgeData.descripcion || "",
      color: badgeData.color || "#ff6b1a",
      icono: badgeData.icono || "trophy",
      updatedBy: user.uid,
      updatedAt: new Date()
    };
    
    // Si hay una nueva imagen, subirla
    if (imageFile) {
      // Verificar que sea un archivo de imagen
      if (!imageFile.type.startsWith('image/')) {
        throw new Error("El archivo debe ser una imagen");
      }
      
      // Si el badge tenía una imagen previa, intentar eliminarla
      if (badgeActual.imageUrl) {
        try {
          // Extraer la ruta del archivo de la URL
          const urlPath = badgeActual.imageUrl.split('?')[0]; // Eliminar query params
          const fileName = urlPath.split('/').pop(); // Obtener el nombre del archivo
          const storagePath = `badges/${fileName}`;
          
          // Crear referencia al archivo en Storage
          const oldImageRef = ref(storage, storagePath);
          
          // Eliminar el archivo
          await deleteObject(oldImageRef);
          console.log("Imagen anterior eliminada:", storagePath);
        } catch (deleteError) {
          console.warn("No se pudo eliminar la imagen anterior:", deleteError);
          // Continuamos con la actualización aunque falle la eliminación
        }
      }
      
      // Subir la nueva imagen
      try {
        const storageRef = ref(storage, `badges/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        updateData.imageUrl = await getDownloadURL(storageRef);
        console.log("Nueva imagen subida correctamente:", updateData.imageUrl);
      } catch (uploadError) {
        console.error("Error al subir la nueva imagen:", uploadError);
        throw new Error("Error al subir la imagen. Verifica tu conexión e inténtalo de nuevo.");
      }
    }
    
    // Actualizar el documento en Firestore
    await updateDoc(badgeRef, updateData);
    
    return {
      id: badgeId,
      success: true,
      message: "Badge actualizado correctamente"
    };
  } catch (error) {
    console.error("Error al editar badge:", error);
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
    
    // Ordenar por fecha de creación (más reciente primero)
    badgesList.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt.seconds * 1000) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt.seconds * 1000) : new Date(0);
      return dateB - dateA;
    });
    
    return badgesList;
  } catch (error) {
    console.error("Error al obtener badges:", error);
    throw error;
  }
}

// Eliminar un badge
export async function deleteBadge(badgeId) {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error("Debes iniciar sesión para eliminar un badge");
    }
    
    // Verificar si el usuario es host
    const userIsHost = await isUserHost();
    
    if (!userIsHost) {
      throw new Error("Solo el host puede eliminar badges");
    }
    
    // Obtener el badge para verificar si tiene imagen
    const badgeRef = doc(db, "badges", badgeId);
    const badgeSnap = await getDoc(badgeRef);
    
    if (!badgeSnap.exists()) {
      throw new Error("El badge no existe");
    }
    
    const badgeData = badgeSnap.data();
    
    // Si tiene imagen, eliminarla del storage
    if (badgeData.imageUrl) {
      try {
        // Extraer la ruta del archivo de la URL
        const urlPath = badgeData.imageUrl.split('?')[0]; // Eliminar query params
        const fileName = urlPath.split('/').pop(); // Obtener el nombre del archivo
        const storagePath = `badges/${fileName}`;
        
        // Crear referencia al archivo en Storage
        const imageRef = ref(storage, storagePath);
        
        // Eliminar el archivo
        await deleteObject(imageRef);
        console.log("Imagen del badge eliminada:", storagePath);
      } catch (deleteImageError) {
        console.error("Error al eliminar la imagen del badge:", deleteImageError);
        // Continuamos con la eliminación del badge aunque falle la eliminación de la imagen
      }
    }
    
    // Verificar si el badge está siendo usado en torneos
    const tournamentBadgesCollection = collection(db, "tournament_badges");
    const q = query(tournamentBadgesCollection, where("badgeId", "==", badgeId));
    const tournamentBadgesSnapshot = await getDocs(q);
    
    if (!tournamentBadgesSnapshot.empty) {
      // Eliminar las referencias en torneos
      for (const docRef of tournamentBadgesSnapshot.docs) {
        await deleteDoc(doc(db, "tournament_badges", docRef.id));
      }
      console.log(`Se eliminaron ${tournamentBadgesSnapshot.size} referencias a este badge en torneos`);
    }
    
    // Verificar si el badge está asignado a usuarios
    const userBadgesCollection = collection(db, "user_badges");
    const userBadgesQuery = query(userBadgesCollection, where("badgeId", "==", badgeId));
    const userBadgesSnapshot = await getDocs(userBadgesQuery);
    
    if (!userBadgesSnapshot.empty) {
      // Eliminar las asignaciones a usuarios
      for (const docRef of userBadgesSnapshot.docs) {
        await deleteDoc(doc(db, "user_badges", docRef.id));
      }
      console.log(`Se eliminaron ${userBadgesSnapshot.size} asignaciones de este badge a usuarios`);
    }
    
    // Eliminar el badge de Firestore
    await deleteDoc(badgeRef);
    
    return { 
      success: true,
      message: "Badge eliminado correctamente"
    };
  } catch (error) {
    console.error("Error al eliminar badge:", error);
    throw error;
  }
}

// Asignar un badge a un usuario (solo host)
export async function assignBadgeToUser(badgeId, userId) {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error("Debes iniciar sesión para asignar badges");
    }
    
    // Verificar si es host
    const userIsHost = await isUserHost();
    
    if (!userIsHost) {
      throw new Error("Solo el host puede asignar badges");
    }
    
    // Verificar que el badge existe
    const badgeRef = doc(db, "badges", badgeId);
    const badgeSnap = await getDoc(badgeRef);
    
    if (!badgeSnap.exists()) {
      throw new Error("El badge no existe");
    }
    
    // Verificar que el usuario existe
    const userQuery = query(collection(db, "usuarios"), where("uid", "==", userId));
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      throw new Error("El usuario no existe");
    }
    
    // Verificar si el usuario ya tiene este badge
    const userBadgesQuery = query(
      collection(db, "user_badges"),
      where("userId", "==", userId),
      where("badgeId", "==", badgeId)
    );
    const userBadgesSnapshot = await getDocs(userBadgesQuery);
    
    if (!userBadgesSnapshot.empty) {
      console.log("El usuario ya tiene este badge");
      return { 
        success: true,
        message: "El usuario ya tiene este badge",
        alreadyAssigned: true
      };
    }
    
    // Asignar badge al usuario
    await addDoc(collection(db, "user_badges"), {
      userId: userId,
      badgeId: badgeId,
      assignedBy: currentUser.uid,
      assignedAt: new Date()
    });
    
    return { 
      success: true,
      message: "Badge asignado correctamente"
    };
  } catch (error) {
    console.error("Error al asignar badge:", error);
    throw error;
  }
}

// Obtener badges de un usuario
export async function getUserBadges(userId) {
  try {
    if (!userId) {
      throw new Error("Se requiere un ID de usuario");
    }
    
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
    
    if (!currentUser) {
      throw new Error("Debes iniciar sesión para asignar badges a torneos");
    }
    
    // Verificar si es host
    const userIsHost = await isUserHost();
    
    if (!userIsHost) {
      throw new Error("Solo el host puede asignar badges a torneos");
    }
    
    // Verificar que el badge existe
    const badgeRef = doc(db, "badges", badgeId);
    const badgeSnap = await getDoc(badgeRef);
    
    if (!badgeSnap.exists()) {
      throw new Error("El badge no existe");
    }
    
    // Verificar que el torneo existe
    const tournamentRef = doc(db, "torneos", tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (!tournamentSnap.exists()) {
      throw new Error("El torneo no existe");
    }
    
    // Verificar si ya existe esta asignación
    const tournamentBadgesQuery = query(
      collection(db, "tournament_badges"),
      where("tournamentId", "==", tournamentId),
      where("badgeId", "==", badgeId),
      where("position", "==", position)
    );
    const tournamentBadgesSnapshot = await getDocs(tournamentBadgesQuery);
    
    if (!tournamentBadgesSnapshot.empty) {
      console.log("Esta asignación de badge ya existe para este torneo");
      return { 
        success: true,
        message: "Esta asignación de badge ya existe para este torneo",
        alreadyAssigned: true
      };
    }
    
    // Añadir asignación a la colección de badges de torneos
    await addDoc(collection(db, "tournament_badges"), {
      tournamentId: tournamentId,
      badgeId: badgeId,
      position: position, // Por ejemplo: "first", "all", etc.
      createdBy: currentUser.uid,
      createdAt: new Date()
    });
    
    return { 
      success: true,
      message: "Badge asignado al torneo correctamente"
    };
  } catch (error) {
    console.error("Error al asignar badge al torneo:", error);
    throw error;
  }
}

// Remover badge de un torneo
export async function removeBadgeFromTournament(tournamentBadgeId) {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error("Debes iniciar sesión para remover badges de torneos");
    }
    
    // Verificar si el usuario es host
    const userIsHost = await isUserHost();
    
    if (!userIsHost) {
      throw new Error("Solo el host puede remover badges de torneos");
    }
    
    // Eliminar la asignación
    const tournamentBadgeRef = doc(db, "tournament_badges", tournamentBadgeId);
    await deleteDoc(tournamentBadgeRef);
    
    return {
      success: true,
      message: "Badge removido del torneo correctamente"
    };
  } catch (error) {
    console.error("Error al remover badge del torneo:", error);
    throw error;
  }
}

// Obtener todos los badges asignados a un torneo
export async function getTournamentBadges(tournamentId) {
  try {
    if (!tournamentId) {
      throw new Error("Se requiere un ID de torneo");
    }
    
    const tournamentBadgesCollection = collection(db, "tournament_badges");
    const q = query(tournamentBadgesCollection, where("tournamentId", "==", tournamentId));
    const querySnapshot = await getDocs(q);
    
    // Si no hay badges asignados, retornar array vacío
    if (querySnapshot.empty) return [];
    
    // Obtener los detalles de cada badge
    const badgesData = [];
    for (const doc of querySnapshot.docs) {
      const badgeAssignment = doc.data();
      const badgeRef = await getDoc(doc(db, "badges", badgeAssignment.badgeId));
      
      if (badgeRef.exists()) {
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
    throw error;
  }
}
