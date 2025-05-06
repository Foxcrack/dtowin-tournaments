
// ui-loader.js

/**
 * Muestra el loader global
 */
export function mostrarLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.remove('hidden');
        loader.classList.add('flex');
    }
}

/**
 * Oculta el loader global
 */
export function ocultarLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('hidden');
        loader.classList.remove('flex');
    }
}
