
import { auth, db, isAuthenticated } from './firebase-config.js';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { registerForTournament, isUserRegistered } from './registration.js';

// Función para verificar si el usuario ha editado su información
export async function hasUserRegisteredWithInfo(tournamentId) {
    try {
        if (!isAuthenticated()) {
            return false;
        }

        const user = auth.currentUser;
        const isRegistered = await isUserRegistered(tournamentId);

        if (!isRegistered) {
            return false;
        }

        const participantInfoQuery = query(
            collection(db, "participant_info"),
            where("userId", "==", user.uid),
            where("tournamentId", "==", tournamentId),
            where("active", "==", true)
        );

        const participantInfoSnapshot = await getDocs(participantInfoQuery);

        return !participantInfoSnapshot.empty;

    } catch (error) {
        console.error("Error checking if user has register edit info:", error);
        return false;
    }
}

// Mostrar modal de inscripción
export function showRegistrationModal(tournamentId, tournamentName) {
    if (!isAuthenticated()) {
        window.mostrarNotificacion("Debes iniciar sesión para inscribirte", "error");
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) loginBtn.click();
        return;
    }

    let registrationModal = document.getElementById('tournamentRegistrationModal');

    if (!registrationModal) {
        const modalHTML = `
        <div id="tournamentRegistrationModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center p-4 z-50">
            <div class="bg-white rounded-xl max-w-md w-full p-6 relative">
                <button id="closeRegistrationModalBtn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
                <div class="text-center mb-6">
                    <h3 id="registrationTitle" class="text-2xl font-bold text-gray-800">Inscripción: ${tournamentName}</h3>
                    <p class="text-gray-600">Completa la información para participar</p>
                    <p id="registrationErrorMsg" class="text-red-500 mt-2 text-sm"></p>
                </div>
                <form id="tournamentRegistrationForm">
                    <input type="hidden" id="tournamentId" value="${tournamentId}">
                    <div class="mb-4">
                        <label for="playerName" class="block text-gray-700 text-sm font-bold mb-2">Nombre de Jugador *</label>
                        <input type="text" id="playerName" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Nombre que usarás en el torneo" required>
                        <p class="text-xs text-gray-500 mt-1">Este nombre se mostrará en la lista de participantes y brackets</p>
                    </div>
                    <div class="mb-6">
                        <label for="discordUsername" class="block text-gray-700 text-sm font-bold mb-2">Discord (opcional)</label>
                        <input type="text" id="discordUsername" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Tu usuario de Discord (ej: username#1234)">
                        <p class="text-xs text-gray-500 mt-1">Será utilizado para comunicación durante el torneo</p>
                    </div>
                    <div class="flex items-center justify-end">
                        <button type="button" id="cancelRegistrationBtn" class="text-gray-600 mr-4 hover:text-gray-800">
                            Cancelar
                        </button>
                        <button type="submit" id="registrationSubmitBtn" class="dtowin-blue text-white py-2 px-6 rounded-lg hover:opacity-90 transition font-semibold">
                            Confirmar Inscripción
                        </button>
                    </div>
                </form>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        registrationModal = document.getElementById('tournamentRegistrationModal');

        setTimeout(() => {
            const closeBtn = registrationModal.querySelector('#closeRegistrationModalBtn');
            const cancelBtn = registrationModal.querySelector('#cancelRegistrationBtn');
            const form = registrationModal.querySelector('#tournamentRegistrationForm');

            if (closeBtn) {
                closeBtn.onclick = () => {
                    registrationModal.classList.add('hidden');
                    registrationModal.classList.remove('flex');
                };
            }

            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    registrationModal.classList.add('hidden');
                    registrationModal.classList.remove('flex');
                };
            }

            if (form) {
                form.onsubmit = (e) => {
                    e.preventDefault();
                    handleRegistrationSubmit(e);
                };
            }

            registrationModal.classList.remove('hidden');
            registrationModal.classList.add('flex');

        }, 0);

    } else {
        const titleEl = document.getElementById('registrationTitle');
        const idInput = document.getElementById('tournamentId');
        if (titleEl) titleEl.textContent = `Inscripción: ${tournamentName}`;
        if (idInput) idInput.value = tournamentId;
        document.getElementById('registrationErrorMsg').textContent = '';
        document.getElementById('tournamentRegistrationForm').reset();

        registrationModal.classList.remove('hidden');
        registrationModal.classList.add('flex');
    }
}

// Manejar envío del formulario de inscripción
async function handleRegistrationSubmit(e) {
    e.preventDefault();
    
    const tournamentId = document.getElementById('tournamentId').value;
    const playerName = document.getElementById('playerName').value;
    const discordUsername = document.getElementById('discordUsername').value;
    const submitBtn = document.getElementById('registrationSubmitBtn');
    const errorMsg = document.getElementById('registrationErrorMsg');
    
    const originalBtnContent = submitBtn.innerHTML;

    if (!playerName) {
        errorMsg.textContent = "El nombre de jugador es obligatorio";
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner w-5 h-5 border-t-2 border-b-2 border-white rounded-full mx-auto"></div>';

    try {
        await registerForTournament(tournamentId, playerName, discordUsername);

        const modal = document.getElementById('tournamentRegistrationModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        window.mostrarNotificacion("¡Te has inscrito correctamente al torneo!", "success");

        setTimeout(() => window.location.reload(), 1500);

    } catch (error) {
        console.error("Error al inscribirse:", error);
        errorMsg.textContent = error.message || "Error al inscribirse al torneo";

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnContent;
    }
}
