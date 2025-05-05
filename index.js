document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("Dirigir_a_TorneosIndex").addEventListener("click", () => {
        window.location.href = "secciones/index-torneos-folder/index-torneos.html";
    });

    document.getElementById("Dirigir_a_LeaderboardsIndex").addEventListener("click", () => {
        window.location.href = "secciones/index-leaderboards-folder/leaderboard-completo.html";
    });

    document.getElementById("Dirigir_a_CalculadorasIndex").addEventListener("click", () => {
        window.location.href = "secciones/index-calculadoras-folder/calculadoras-index.html";
    });



    document.getElementById("Dirigir_a_e621Index").addEventListener("click", () => {
        window.location.href = "e621.html";
    });
});