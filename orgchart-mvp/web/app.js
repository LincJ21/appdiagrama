import { loadInitialData } from './api.js';
import { setupEventListeners } from './events.js';
import { setupShapeDragAndDrop } from './dnd.js';

setupEventListeners();
setupShapeDragAndDrop();
loadInitialData();