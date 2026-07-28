import { loadInitialData } from './api.js';
import { setupEventListeners } from './events.js';

async function main() {
  // Configura todos los manejadores de eventos de la UI
  setupEventListeners();
  // Carga los datos iniciales del servidor y renderiza la aplicación
  await loadInitialData();
}

main();