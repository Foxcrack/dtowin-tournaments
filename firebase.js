// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  deleteDoc,
  arrayRemove,
  Timestamp,
  limit,
  startAfter,
  documentId,
  FieldValue
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBHW2HsP2T6DOwLaOYloqZFerFmU_UA4kE",
  authDomain: "dtowin-tournament.firebaseapp.com",
  projectId: "dtowin-tournament",
  storageBucket: "dtowin-tournament.appspot.com", // Corregido
  messagingSenderId: "991226820083",
  appId: "1:991226820083:web:6387773cf8c76a0f6ace86",
  measurementId: "G-R4Q5YKZXGY"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// Colecciones
const usersCollection = collection(db, "usuarios");
const torneosCollection = collection(db, "torneos");
const badgesCollection = collection(db, "badges");
const resultsCollection = collection(db, "resultados");
const bannersCollection = collection(db, "banners");
const userBadgesCollection = collection(db, "user_badges");
const tournamentBadgesCollection = collection(db, "tournament_badges");

// Configurar persistencia de sesión
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Persistencia de sesión configurada correctamente");
  })
  .catch((error) => {
    console.error("Error al configurar persistencia de sesión:", error);
  });

// Configuración personalizada del provider
provider.setCustomParameters({
  prompt: 'select_account'
});

// Lista de administradores por defecto
const adminUIDs = [
  "dvblFee1ZnVKJNWBOR22tSAsNet2"  // UID del administrador principal
];

// Función simplificada de login con Google
export async function loginWithGoogle() {
  try {
    console.log("Iniciando proceso de login con Google...");
    
    // Intentar realizar el login con popup
    console.log("Abriendo popup de autenticación...");
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log("Autenticación exitosa con Google:", user.uid);
    
    console.log("UID del usuario:", user.uid);
    console.log("UID del administrador:", adminUIDs[0]);
    console.log("¿Es administrador?", adminUIDs.includes(user.uid));
    
    // Verificar si el usuario ya existe en la base de datos
    console.log("Verificando si el usuario existe en la base de datos...");
    const userQuery = query(collection(db, "usuarios"), where("uid", "==", user.uid));
    const querySnapshot = await getDocs(userQuery);
    
    // Si no existe, créalo
    if (querySnapshot.empty) {
      console.log("Usuario nuevo, creando perfil en la base de datos...");
      
      // Verificar si el usuario debe ser administrador
      const isAdmin = adminUIDs.includes(user.uid);
      console.log("¿El usuario será creado como administrador?", isAdmin);
      
      await addDoc(collection(db, "usuarios"), {
        uid: user.uid,
        nombre: user.displayName || "Usuario",
        email: user.email,
        photoURL: user.photoURL,
        puntos: 0,
        fechaRegistro: serverTimestamp(),
        ultimoLogin: serverTimestamp(),
        isHost: isAdmin // Asignar permisos de host según la lista
      });
      console.log("Perfil de usuario creado exitosamente");
    } else {
      console.log("Usuario ya existe en la base de datos");
      // Actualizar fecha de último login
      const userDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "usuarios", userDoc.id), {
        ultimoLogin: serverTimestamp()
      });
      
      // Si el usuario es administrador pero no tiene el flag, actualizarlo
      if (adminUIDs.includes(user.uid) && !querySnapshot.docs[0].data().isHost) {
        console.log("Actualizando permisos de administrador...");
        await updateDoc(doc(db, "usuarios", userDoc.id), {
          isHost: true
        });
      }
    }
    
    return user;
  } catch (error) {
    console.error("Error en loginWithGoogle:", error);
    alert("Error al iniciar sesión: " + (error.message || "Error desconocido"));
    throw error;
  }
}

// Función para cerrar sesión
export async function logoutUser() {
  try {
    console.log("Cerrando sesión...");
    await signOut(auth);
    console.log("Sesión cerrada exitosamente");
    return { success: true };
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    throw error;
  }
}

// Función para obtener perfil de usuario
export async function getUserProfile(uid) {
  try {
    console.log("Obteniendo perfil del usuario:", uid);
    
    if (!uid) {
      console.error("UID no proporcionado");
      return null;
    }
    
    const userQuery = query(collection(db, "usuarios"), where("uid", "==", uid));
    const querySnapshot = await getDocs(userQuery);
    
    if (!querySnapshot.empty) {
      const userData = {
        id: querySnapshot.docs[0].id,
        ...querySnapshot.docs[0].data()
      };
      console.log("Perfil de usuario obtenido:", userData.nombre);
      return userData;
    }
    
    // Si no existe el perfil pero existe el usuario, crearlo
    if (auth.currentUser && auth.currentUser.uid === uid) {
      // Verificar si el usuario debe ser administrador
      const isAdmin = adminUIDs.includes(uid);
      
      const userRef = await addDoc(collection(db, "usuarios"), {
        uid: uid,
        nombre: auth.currentUser.displayName || "Usuario",
        email: auth.currentUser.email,
        photoURL: auth.currentUser.photoURL,
        puntos: 0,
        fechaRegistro: serverTimestamp(),
        ultimoLogin: serverTimestamp(),
        isHost: isAdmin // Solo es host si está en la lista
      });
      
      const userDoc = await getDoc(userRef);
      return {
        id: userRef.id,
        ...userDoc.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error al obtener perfil de usuario:", error);
    return null;
  }
}

// Función para verificar si un usuario es host (simplificada para debugging)
export async function isUserHost() {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      console.error("No hay usuario autenticado");
      return false;
    }
    
    console.log("Verificando si el usuario es host:", user.uid);
    console.log("Lista de administradores:", adminUIDs);
    
    // Verificar directamente si está en la lista de administradores
    if (adminUIDs.includes(user.uid)) {
      console.log("Usuario es administrador por estar en la lista");
      return true;
    }
    
    // Verificar en la base de datos
    const userQuery = query(collection(db, "usuarios"), where("uid", "==", user.uid));
    const querySnapshot = await getDocs(userQuery);
    
    if (querySnapshot.empty) {
      console.error("No se encontró el perfil del usuario");
      return false;
    }
    
    const userData = querySnapshot.docs[0].data();
    console.log("Información del usuario:", userData);
    console.log("¿Es host según la base de datos?", userData.isHost === true);
    
    return userData.isHost === true;
  } catch (error) {
    console.error("Error al verificar si el usuario es host:", error);
    return false;
  }
}

// Función para obtener usuario por ID
export async function getUserById(userId) {
  try {
    const userQuery = query(usersCollection, where("uid", "==", userId));
    const querySnapshot = await getDocs(userQuery);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    return {
      id: querySnapshot.docs[0].id,
      ...querySnapshot.docs[0].data()
    };
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    return null;
  }
}

// Función para obtener banners activos ordenados por su campo 'orden'
export async function getActiveBanners() {
  try {
    const bannersQuery = query(
      bannersCollection,
      where("visible", "==", true),
      orderBy("orden", "asc")
    );
    
    const querySnapshot = await getDocs(bannersQuery);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error al obtener banners activos:", error);
    return [];
  }
}

// Función para obtener todos los banners
export async function getAllBanners() {
  try {
    const querySnapshot = await getDocs(query(bannersCollection, orderBy("orden", "asc")));
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error al obtener todos los banners:", error);
    return [];
  }
}

// Función para obtener un banner específico por su ID
export async function getBannerById(bannerId) {
  try {
    const bannerDoc = await getDoc(doc(db, "banners", bannerId));
    
    if (!bannerDoc.exists()) {
      return null;
    }
    
    return {
      id: bannerDoc.id,
      ...bannerDoc.data()
    };
  } catch (error) {
    console.error("Error al obtener banner:", error);
    return null;
  }
}

// ----- NUEVAS FUNCIONES PARA GESTIÓN DE PARTICIPANTES -----

// Función para obtener todos los participantes
export async function getAllParticipants() {
  try {
    console.log("Obteniendo todos los participantes...");
    
    const usersSnapshot = await getDocs(usersCollection);
    
    if (usersSnapshot.empty) {
      console.log("No hay participantes registrados");
      return [];
    }
    
    const participants = [];
    usersSnapshot.forEach(doc => {
      participants.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Se encontraron ${participants.length} participantes`);
    return participants;
    
  } catch (error) {
    console.error("Error al obtener participantes:", error);
    throw error;
  }
}

// Función para obtener participantes de un torneo específico
export async function getTournamentParticipants(tournamentId) {
  try {
    console.log(`Obteniendo participantes del torneo ${tournamentId}...`);
    
    // Primero obtenemos el torneo para ver la lista de UIDs
    const tournamentDoc = await getDoc(doc(db, "torneos", tournamentId));
    
    if (!tournamentDoc.exists()) {
      console.error("El torneo no existe");
      return [];
    }
    
    const tournamentData = tournamentDoc.data();
    const participantUIDs = tournamentData.participants || [];
    
    if (participantUIDs.length === 0) {
      console.log("El torneo no tiene participantes");
      return [];
    }
    
    // Búsqueda por bloques para evitar limitaciones de Firestore
    const participants = [];
    
    // Firestore tiene un límite de 10 valores en cláusulas 'in' 
    const chunkSize = 10;
    for (let i = 0; i < participantUIDs.length; i += chunkSize) {
      const chunk = participantUIDs.slice(i, i + chunkSize);
      
      const q = query(usersCollection, where("uid", "in", chunk));
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach(doc => {
        participants.push({
          id: doc.id,
          ...doc.data()
        });
      });
    }
    
    console.log(`Se encontraron ${participants.length} participantes en el torneo`);
    return participants;
    
  } catch (error) {
    console.error(`Error al obtener participantes del torneo ${tournamentId}:`, error);
    throw error;
  }
}

// Función para actualizar puntos de un participante
export async function updateParticipantPoints(userId, points, add = true) {
  try {
    console.log(`${add ? 'Añadiendo' : 'Restando'} ${points} puntos al usuario ${userId}`);
    
    // Obtener usuario actual
    const userQuery = query(usersCollection, where("uid", "==", userId));
    const querySnapshot = await getDocs(userQuery);
    
    if (querySnapshot.empty) {
      throw new Error("No se encontró el usuario");
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    // Calcular nuevos puntos
    const currentPoints = userData.puntos || 0;
    const newPoints = add ? currentPoints + points : Math.max(0, currentPoints - points);
    
    // Actualizar puntos
    await updateDoc(doc(db, "usuarios", userDoc.id), {
      puntos: newPoints,
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      userId,
      previousPoints: currentPoints,
      newPoints,
      difference: add ? points : -points
    };
    
  } catch (error) {
    console.error(`Error al actualizar puntos del usuario ${userId}:`, error);
    throw error;
  }
}

// Función para asignar badge a participante
export async function assignBadgeToUser(userId, badgeId, reason = null) {
  try {
    console.log(`Asignando badge ${badgeId} al usuario ${userId}`);
    
    // Obtener usuario
    const userQuery = query(usersCollection, where("uid", "==", userId));
    const querySnapshot = await getDocs(userQuery);
    
    if (querySnapshot.empty) {
      throw new Error("No se encontró el usuario");
    }
    
    const userDoc = querySnapshot.docs[0];
    
    // Verificar que el badge existe
    const badgeDoc = await getDoc(doc(db, "badges", badgeId));
    
    if (!badgeDoc.exists()) {
      throw new Error("El badge especificado no existe");
    }
    
    // Preparar datos para la asignación
    const badgeData = {
      dateAwarded: serverTimestamp(),
      awardedBy: auth.currentUser.uid
    };
    
    if (reason) {
      badgeData.reason = reason;
    }
    
    // Actualizar usuario
    await updateDoc(doc(db, "usuarios", userDoc.id), {
      [`badges.${badgeId}`]: badgeData,
      updatedAt: serverTimestamp()
    });
    
    // Registrar asignación (opcional) para tener un registro centralizado
    await addDoc(userBadgesCollection, {
      userId: userId,
      badgeId: badgeId,
      ...badgeData
    });
    
    return {
      success: true,
      userId,
      badgeId,
      timestamp: new Date()
    };
    
  } catch (error) {
    console.error(`Error al asignar badge al usuario ${userId}:`, error);
    throw error;
  }
}

// Función para quitar badge a un participante
export async function removeBadgeFromUser(userId, badgeId) {
  try {
    console.log(`Quitando badge ${badgeId} al usuario ${userId}`);
    
    // Obtener usuario
    const userQuery = query(usersCollection, where("uid", "==", userId));
    const querySnapshot = await getDocs(userQuery);
    
    if (querySnapshot.empty) {
      throw new Error("No se encontró el usuario");
    }
    
    const userDoc = querySnapshot.docs[0];
    
    // Actualizar usuario - eliminar el badge
    await updateDoc(doc(db, "usuarios", userDoc.id), {
      [`badges.${badgeId}`]: deleteField(),
      updatedAt: serverTimestamp()
    });
    
    // Opcional: marcar como eliminado en el registro centralizado
    const badgeAssignmentQuery = query(
      userBadgesCollection, 
      where("userId", "==", userId), 
      where("badgeId", "==", badgeId)
    );
    
    const badgeAssignmentSnapshot = await getDocs(badgeAssignmentQuery);
    
    if (!badgeAssignmentSnapshot.empty) {
      await updateDoc(doc(db, "user_badges", badgeAssignmentSnapshot.docs[0].id), {
        removed: true,
        removedAt: serverTimestamp(),
        removedBy: auth.currentUser.uid
      });
    }
    
    return {
      success: true,
      userId,
      badgeId
    };
    
  } catch (error) {
    console.error(`Error al quitar badge al usuario ${userId}:`, error);
    throw error;
  }
}

// Función para eliminar participante de un torneo
export async function removeParticipantFromTournament(userId, tournamentId) {
  try {
    console.log(`Eliminando usuario ${userId} del torneo ${tournamentId}`);
    
    // Obtener torneo actual
    const tournamentDoc = await getDoc(doc(db, "torneos", tournamentId));
    
    if (!tournamentDoc.exists()) {
      throw new Error("El torneo no existe");
    }
    
    const tournamentData = tournamentDoc.data();
    
    // Verificar que el participante está en el torneo
    if (!tournamentData.participants || !tournamentData.participants.includes(userId)) {
      throw new Error("El participante no está registrado en este torneo");
    }
    
    // Eliminar participante del array
    const newParticipants = tournamentData.participants.filter(uid => uid !== userId);
    
    // Actualizar documento del torneo
    await updateDoc(doc(db, "torneos", tournamentId), {
      participants: newParticipants,
      updatedAt: serverTimestamp()
    });
    
    return {
      success: true,
      userId,
      tournamentId,
      previousCount: tournamentData.participants.length,
      newCount: newParticipants.length
    };
    
  } catch (error) {
    console.error(`Error al eliminar participante del torneo:`, error);
    throw error;
  }
}

// Función para cambiar rol de usuario (Host/Participante)
export async function updateUserRole(userId, isHost) {
  try {
    console.log(`Actualizando rol del usuario ${userId} a ${isHost ? 'Host' : 'Participante'}`);
    
    // Obtener usuario
    const userQuery = query(usersCollection, where("uid", "==", userId));
    const querySnapshot = await getDocs(userQuery);
    
    if (querySnapshot.empty) {
      throw new Error("No se encontró el usuario");
    }
    
    const userDoc = querySnapshot.docs[0];
    
    // Verificar que el usuario que realiza el cambio es admin
    const isAdmin = await isUserHost();
    
    if (!isAdmin) {
      throw new Error("No tienes permisos para cambiar roles de usuario");
    }
    
    // Actualizar rol
    await updateDoc(doc(db, "usuarios", userDoc.id), {
      isHost: isHost,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
    
    return {
      success: true,
      userId,
      isHost
    };
    
  } catch (error) {
    console.error(`Error al actualizar rol de usuario:`, error);
    throw error;
  }
}

// Función para obtener estadísticas de participantes
export async function getParticipantsStats() {
  try {
    console.log("Obteniendo estadísticas de participantes...");
    
    // Obtener todos los participantes
    const usersSnapshot = await getDocs(usersCollection);
    
    if (usersSnapshot.empty) {
      return {
        totalParticipants: 0,
        activeParticipants: 0,
        totalBadges: 0
      };
    }
    
    // Calcular estadísticas
    let totalParticipants = 0;
    let activeParticipants = 0;
    let totalBadges = 0;
    
    // Fecha de hace 30 días
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      totalParticipants++;
      
      // Participante activo si su último login fue en los últimos 30 días
      if (userData.ultimoLogin && userData.ultimoLogin > thirtyDaysAgoTimestamp) {
        activeParticipants++;
      }
      
      // Contar badges
      if (userData.badges) {
        totalBadges += Object.keys(userData.badges).length;
      }
    });
    
    return {
      totalParticipants,
      activeParticipants,
      totalBadges
    };
    
  } catch (error) {
    console.error("Error al obtener estadísticas de participantes:", error);
    throw error;
  }
}

// Función auxiliar para obtener un campo inexistente (para eliminar campos)
function deleteField() {
  return FieldValue.delete();
}

// Exporta las funciones y objetos que necesitas
export {
  auth,
  db,
  storage,
  usersCollection,
  torneosCollection,
  badgesCollection,
  resultsCollection,
  bannersCollection,
  userBadgesCollection,
  tournamentBadgesCollection
};
