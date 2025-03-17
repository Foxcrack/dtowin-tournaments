// tournaments.js - Funciones para gestión de torneos
import { db, auth, storage } from './firebase.js';
import { collection, addDoc, getDocs, doc, updateDoc, query, where, orderBy, limit, arrayUnion, increment } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

// Obtener lista de torneos
export async function getTournaments() {
  try {
    const tournamentsCollection = collection(db, "torneos");
    const tournamentsSnapshot = await getDocs(tournamentsCollection);
    const tournamentsList = tournamentsSnapshot.docs.map(doc => {
      return { id: doc.id, ...doc.data() };
    });
    return tournamentsList;
  } catch (error) {
    console.error("Error al obtener torneos:", error);
    throw error;
  }
}

// Crear un nuevo torneo (solo para el host)
export async function createTournament(tournamentData, imageFile) {
  try {
    const user = auth.currentUser;
    
    // Verificar si el usuario es host (deberías tener un campo en tu base de datos)
    const usersCollection = collection(db, "usuarios");
    const q = query(usersCollection, where("uid", "==", user.uid), where("isHost", "==", true));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error("Solo el host puede crear torneos");
    }
    
    // Preparar datos del torneo
    const tournamentInfo = {
      ...tournamentData,
      createdBy: user.uid,
      createdAt: new Date(),
      participants: [],
      imageUrl: null
    };
    
    // Añadir torneo a Firestore primero sin imagen
    const tournamentRef = await addDoc(collection(db, "torneos"), tournamentInfo);
    
    // Si hay una imagen, subirla a Storage
    if (imageFile) {
      try {
        // Sanitizar nombre de archivo
        const fileName = `events/${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const storageRef = ref(storage, fileName);
        
        // Crear blob para evitar problemas de CORS
        const arrayBuffer = await imageFile.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: imageFile.type });
        
        // Subir a Storage
        await uploadBytes(storageRef, blob);
        const imageUrl = await getDownloadURL(storageRef);
        
        // Actualizar documento con URL de imagen
        await updateDoc(doc(db, "torneos", tournamentRef.id), {
          imageUrl: imageUrl
        });
        
        return { 
          id: tournamentRef.id,
          imageUrl: imageUrl,
          success: true
        };
      } catch (imgError) {
        console.error("Error al subir imagen:", imgError);
        // Devolver éxito aunque falle la imagen
        return { 
          id: tournamentRef.id,
          success: true,
          imageWarning: true
        };
      }
    }
    
    return { 
      id: tournamentRef.id,
      success: true
    };
  } catch (error) {
    console.error("Error al crear torneo:", error);
    throw error;
  }
}

// Inscribirse a un torneo
export async function registerToTournament(tournamentId) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Debes iniciar sesión para inscribirte");
    
    // Obtener referencia al documento del torneo
    const tournamentRef = doc(db, "torneos", tournamentId);
    
    // Actualizar el array de participantes
    await updateDoc(tournamentRef, {
      participants: arrayUnion(user.uid)
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error al inscribirse al torneo:", error);
    throw error;
  }
}

// Asignar puntos a un participante (solo host)
export async function assignPoints(tournamentId, userId, points) {
  try {
    const currentUser = auth.currentUser;
    
    // Verificar si es host
    const usersCollection = collection(db, "usuarios");
    const q = query(usersCollection, where("uid", "==", currentUser.uid), where("isHost", "==", true));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error("Solo el host puede asignar puntos");
    }
    
    // Actualizar puntos del usuario
    const userRef = doc(db, "usuarios", userId);
    await updateDoc(userRef, {
      puntos: increment(points)
    });
    
    // Registrar en historial
    await addDoc(collection(db, "historial_puntos"), {
      userId: userId,
      tournamentId: tournamentId,
      points: points,
      assignedBy: currentUser.uid,
      assignedAt: new Date()
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error al asignar puntos:", error);
    throw error;
  }
}

// Obtener leaderboard
export async function getLeaderboard(limitSize = 10) {
  try {
    const usersCollection = collection(db, "usuarios");
    const q = query(usersCollection, orderBy("puntos", "desc"), limit(limitSize));
    const querySnapshot = await getDocs(q);
    
    const leaderboard = querySnapshot.docs.map((doc, index) => {
      const data = doc.data();
      return {
        position: index + 1,
        id: doc.id,
        name: data.nombre,
        points: data.puntos,
        photoURL: data.photoURL
      };
    });
    
    return leaderboard;
  } catch (error) {
    console.error("Error al obtener leaderboard:", error);
    throw error;
  }
}
