import state, { addNode } from './state.js';
import { renderAll } from './render.js';
import { NODE_DIMS } from './config.js';

export function setupShapeDragAndDrop() {
  const shapeList = document.getElementById('shapeList');
  const canvasViewport = document.getElementById('canvasViewport');

  if (!shapeList || !canvasViewport) {
    console.warn('Shape drag and drop setup failed: elements not found.');
    return;
  }

  // --- Feature: Click para agregar figura ---
  // Al hacer clic en una figura de la barra de herramientas, se agrega al centro de la vista.
  shapeList.addEventListener('click', event => {
    const shapeItem = event.target.closest('.shape-item');
    if (!shapeItem) return;

    const shapeType = shapeItem.dataset.shapeType;
    if (!shapeType) return;

    const viewRect = canvasViewport.getBoundingClientRect();
    const { view } = state;

    // Calcular el centro del viewport en coordenadas del canvas
    const viewportCenterX = viewRect.width / 2;
    const viewportCenterY = viewRect.height / 2;

    const canvasX = (viewportCenterX - view.x) / view.scale;
    const canvasY = (viewportCenterY - view.y) / view.scale;

    // Centrar la figura en el punto calculado
    const finalX = canvasX - NODE_DIMS.width / 2;
    const finalY = canvasY - NODE_DIMS.height / 2;

    // Si auto layout está encendido, lo apagamos para que la figura no salga volando y se pueda arrastrar libremente
    if (state.autoLayout) {
        state.autoLayout = false;
        const btn = document.getElementById('autoLayoutBtn');
        if (btn) btn.innerHTML = btn.innerHTML.replace('ON', 'OFF');
    }

    addNode('', {
      style: shapeType,
      x: finalX,
      y: finalY,
      width: NODE_DIMS.width,
      height: (shapeType === 'circle' || shapeType === 'rhombus') ? NODE_DIMS.width : NODE_DIMS.height,
    });

    renderAll();
  });

  // --- Feature: Arrastrar y soltar figura ---

  // 1. Iniciar el arrastre desde la barra de herramientas
  shapeList.addEventListener('dragstart', (event) => {
    const shapeItem = event.target.closest('.shape-item');
    if (shapeItem) {
      event.dataTransfer.setData('text/plain', shapeItem.dataset.shapeType);
      event.dataTransfer.effectAllowed = 'copy';
      // Agrega una clase al body para indicar que se está arrastrando una figura.
      // Esto permite deshabilitar `pointer-events` en los nodos existentes.
      document.body.classList.add('is-dragging-shape');
    }
  });

  // 2. Permitir soltar sobre el lienzo
  canvasViewport.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });

  // 3. Manejar el evento de soltar para crear una nueva figura
  canvasViewport.addEventListener('drop', (event) => {
    event.preventDefault();
    // Limpia la clase del body, por si el evento `dragend` no se dispara.
    document.body.classList.remove('is-dragging-shape');

    const shapeType = event.dataTransfer.getData('text/plain');
    if (!shapeType) return;

    const viewRect = canvasViewport.getBoundingClientRect();
    const { view } = state;

    const viewportX = event.clientX - viewRect.left;
    const viewportY = event.clientY - viewRect.top;

    // Convertir coordenadas del viewport a coordenadas del canvas
    const canvasX = (viewportX - view.x) / view.scale;
    const canvasY = (viewportY - view.y) / view.scale;

    // Centrar la figura en el cursor
    const finalX = canvasX - NODE_DIMS.width / 2;
    const finalY = canvasY - NODE_DIMS.height / 2;

    // Si auto layout está encendido, lo apagamos para que la figura no salga volando y se pueda arrastrar libremente
    if (state.autoLayout) {
        state.autoLayout = false;
        const btn = document.getElementById('autoLayoutBtn');
        if (btn) btn.innerHTML = btn.innerHTML.replace('ON', 'OFF');
    }

    addNode('', {
      style: shapeType,
      x: finalX,
      y: finalY,
      width: NODE_DIMS.width,
      // Para un círculo, forzamos que sea un cuadrado para que se vea redondo
      height: (shapeType === 'circle' || shapeType === 'rhombus') ? NODE_DIMS.width : NODE_DIMS.height,
    });

    renderAll();
  });

  // 4. Limpiar al finalizar el arrastre (con o sin éxito)
  shapeList.addEventListener('dragend', () => {
    document.body.classList.remove('is-dragging-shape');
  });
}