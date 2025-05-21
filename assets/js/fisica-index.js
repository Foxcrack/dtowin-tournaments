document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("Dirigir_a_Mortero").addEventListener("click", () => {
        window.location.href = "mortero.html";
    });

    document.getElementById("Dirigir_a_MRU").addEventListener("click", () => {
        window.location.href = "calcu-mru.html";
    });

    document.getElementById("Dirigir_a_MRUV").addEventListener("click", () => {
        window.location.href = "calcu-mruv.html";
    });

});