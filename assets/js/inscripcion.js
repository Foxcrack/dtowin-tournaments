
import { getFirestore, doc, setDoc, deleteDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";

const firebaseConfig = {
  // REEMPLAZA ESTO CON TU CONFIG DE FIREBASE
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function configurarBotonesInscripcion() {
  const botones = document.querySelectorAll('.inscribirse-btn');
  
  onAuthStateChanged(auth, async user => {
    if (!user) return;

    for (const boton of botones) {
      const torneoId = boton.dataset.torneoId;
      const docRef = doc(db, `torneos/${torneoId}/participantes/${user.uid}`);
      const docSnap = await getDoc(docRef);

      actualizarEstadoBoton(boton, docSnap.exists());

      boton.addEventListener('click', async () => {
        const estaInscrito = boton.classList.contains('inscrito');

        if (estaInscrito) {
          await deleteDoc(docRef);
          actualizarEstadoBoton(boton, false);
        } else {
          await setDoc(docRef, {
            uid: user.uid,
            nombre: user.displayName || "Anónimo",
            email: user.email || "",
            timestamp: new Date()
          });
          actualizarEstadoBoton(boton, true);
        }

        mostrarParticipantes(torneoId);
      });
    }
  });
}

function actualizarEstadoBoton(boton, inscrito) {
  const texto = inscrito ? "Desinscribirse" : "Inscribirse";
  boton.classList.toggle("inscrito", inscrito);
  boton.querySelector(".front span").textContent = texto;
}

async function mostrarParticipantes(torneoId) {
  const lista = document.getElementById(`lista-${torneoId}`);
  if (!lista) return;

  const snapshot = await getDocs(collection(db, `torneos/${torneoId}/participantes`));
  lista.innerHTML = "";

  snapshot.forEach(doc => {
    const data = doc.data();
    const item = document.createElement("li");
    item.textContent = `${data.nombre || "Sin nombre"} (${data.email || ""})`;
    lista.appendChild(item);
  });
}

setTimeout(configurarBotonesInscripcion, 1000);
