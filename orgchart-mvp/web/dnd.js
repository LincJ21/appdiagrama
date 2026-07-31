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

  // Click para agregar figura al centro de la vista
  shapeList.addEventListener('click', event => {
    const shapeItem = event.target.closest('.shape-item');
    if (!shapeItem) return;

    const shapeType = shapeItem.dataset.shapeType;
    if (!shapeType) return;

    const viewRect = canvasViewport.getBoundingClientRect();
    const { view } = state;

    const viewportCenterX = viewRect.width / 2;
    const viewportCenterY = viewRect.height / 2;

    const canvasX = (viewportCenterX - view.x) / view.scale;
    const canvasY = (viewportCenterY - view.y) / view.scale;

    const finalX = canvasX - NODE_DIMS.width / 2;
    const finalY = canvasY - NODE_DIMS.height / 2;

    addNode('', {
      style: shapeType,
      x: finalX,
      y: finalY,
      width: NODE_DIMS.width,
      height: (shapeType === 'circle' || shapeType === 'rhombus') ? NODE_DIMS.width : NODE_DIMS.height,
    });

    renderAll();
  });

  // Arrastrar y soltar figura
  shapeList.addEventListener('dragstart', (event) => {
    const shapeItem = event.target.closest('.shape-item');
    if (shapeItem) {
      event.dataTransfer.setData('text/plain', shapeItem.dataset.shapeType);
      event.dataTransfer.effectAllowed = 'copy';
      document.body.classList.add('is-dragging-shape');
    }
  });

  canvasViewport.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });

  canvasViewport.addEventListener('drop', (event) => {
    event.preventDefault();
    document.body.classList.remove('is-dragging-shape');

    const shapeType = event.dataTransfer.getData('text/plain');
    if (!shapeType) return;

    const viewRect = canvasViewport.getBoundingClientRect();
    const { view } = state;

    const viewportX = event.clientX - viewRect.left;
    const viewportY = event.clientY - viewRect.top;

    const canvasX = (viewportX - view.x) / view.scale;
    const canvasY = (viewportY - view.y) / view.scale;

    const finalX = canvasX - NODE_DIMS.width / 2;
    const finalY = canvasY - NODE_DIMS.height / 2;

    addNode('', {
      style: shapeType,
      x: finalX,
      y: finalY,
      width: NODE_DIMS.width,
      height: (shapeType === 'circle' || shapeType === 'rhombus') ? NODE_DIMS.width : NODE_DIMS.height,
    });

    renderAll();
  });

  shapeList.addEventListener('dragend', () => {
    document.body.classList.remove('is-dragging-shape');
  });
}