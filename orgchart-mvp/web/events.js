import { dom } from './dom.js';
import {
  state,
  addNode,
  updateNode,
  removeNode,
  duplicateNode,
  toggleCollapse,
  applyLayout,
  undo,
  redo,
  patchNodePosition,
  commitNodePositionChange,
  importChart,
} from './state.js';
import { renderAll, renderNodeList, renderCanvas, drawConnectors } from './render.js';
import { saveAll, regenerateHTML, exportPDF, exportPNG, downloadJSON } from './api.js';
import { ZOOM_IN_FACTOR, WHEEL_ZOOM_FACTOR, MIN_SCALE, MAX_SCALE, NODE_DIMS } from './config.js';

let statusTimeout = null;

export function setStatus(message, type = 'info', duration = 3200) {
  dom.statusBox.textContent = message;
  dom.statusBox.className = 'status';
  dom.statusBox.classList.add(type);

  clearTimeout(statusTimeout);
  if (duration > 0) {
    statusTimeout = setTimeout(() => {
      dom.statusBox.textContent = '';
      dom.statusBox.className = 'status info';
    }, duration);
  }
}

export function setupEventListeners() {
  dom.companyInput.addEventListener('input', e => {
    state.company = e.target.value;
  });

  dom.searchInput.addEventListener('input', e => {
    state.searchTerm = e.target.value.trim().toLowerCase();
    renderNodeList();
  });

  dom.saveBtn.addEventListener('click', saveAll);
  dom.addRootBtn.addEventListener('click', () => addNode(''));
  dom.exportHtmlBtn.addEventListener('click', regenerateHTML);
  dom.exportPdfBtn.addEventListener('click', exportPDF);
  dom.exportPngBtn.addEventListener('click', exportPNG);
  dom.downloadJsonBtn.addEventListener('click', downloadJSON);

  dom.importJsonInput.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      importChart(JSON.parse(text));
      dom.companyInput.value = state.company;
      setStatus('Archivo JSON importado correctamente.', 'success');
      requestAnimationFrame(() => fitChart());
    } catch (error) {
      console.error(error);
      setStatus('No se pudo importar el archivo JSON.', 'error');
    } finally {
      dom.importJsonInput.value = '';
    }
  });

  dom.undoBtn.addEventListener('click', () => {
    undo();
    dom.companyInput.value = state.company;
    setStatus('Se deshizo el último cambio.', 'info');
  });

  dom.redoBtn.addEventListener('click', () => {
    redo();
    dom.companyInput.value = state.company;
    setStatus('Se rehizo el cambio.', 'info');
  });

  dom.autoLayoutBtn.addEventListener('click', () => {
    state.autoLayout = !state.autoLayout;
    dom.autoLayoutBtn.textContent = `Auto layout: ${state.autoLayout ? 'ON' : 'OFF'}`;
    if (state.autoLayout) applyLayout();
    else setStatus('Modo manual activado.', 'info');
  });

  dom.zoomInBtn.addEventListener('click', () => zoomAtCenter(ZOOM_IN_FACTOR));
  dom.zoomOutBtn.addEventListener('click', () => zoomAtCenter(1 / ZOOM_IN_FACTOR));
  dom.zoomResetBtn.addEventListener('click', () => {
    state.view.scale = 1;
    updateZoomLabel();
    centerChart(true);
  });

  dom.centerBtn.addEventListener('click', () => centerChart(false));
  dom.fitBtn.addEventListener('click', fitChart);
  dom.toggleConnectorsBtn.addEventListener('click', toggleConnectorType);
  dom.themeToggleBtn.addEventListener('click', toggleTheme);

  dom.chartStage.addEventListener('click', handleStageClick);
  dom.canvasViewport.addEventListener('pointerdown', startPan);
  window.addEventListener('pointermove', movePan);
  window.addEventListener('pointerup', endPan);
  dom.canvasViewport.addEventListener('wheel', handleZoom, { passive: false });
  window.addEventListener('resize', drawConnectors);

  window.addEventListener('keydown', e => {
    const meta = e.ctrlKey || e.metaKey;

    if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      dom.companyInput.value = state.company;
      return;
    }

    if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
      dom.companyInput.value = state.company;
      return;
    }

    if (e.key === 'Delete' && state.selectedNodeId) {
      removeNode(state.selectedNodeId);
      setStatus('Nodo eliminado.', 'success');
    }
  });

  dom.nodeList.addEventListener('click', e => {
    const button = e.target.closest('[data-select-node]');
    if (!button) return;
    state.selectedNodeId = button.dataset.selectNode;
    renderAll();
    requestAnimationFrame(() => focusNode(state.selectedNodeId));
  });

  dom.inspectorContent.addEventListener('click', e => {
    const actionEl = e.target.closest('[data-inspector-action]');
    if (!actionEl || !state.selectedNodeId) return;

    const action = actionEl.dataset.inspectorAction;
    const id = state.selectedNodeId;

    if (action === 'add-child') {
      addNode(id);
      setStatus('Nodo hijo agregado.', 'success');
    }
    if (action === 'duplicate') {
      duplicateNode(id);
      setStatus('Nodo duplicado.', 'success');
    }
    if (action === 'remove') {
      removeNode(id);
      setStatus('Nodo eliminado.', 'success');
    }
  });

  dom.inspectorContent.addEventListener('input', e => {
    const input = e.target;
    if (input.dataset.nodeField && state.selectedNodeId && input.tagName !== 'SELECT') {
      updateNode(state.selectedNodeId, input.dataset.nodeField, input.value);
    }
  });

  dom.inspectorContent.addEventListener('change', e => {
    const input = e.target;
    if (input.dataset.nodeField && state.selectedNodeId && input.tagName === 'SELECT') {
      updateNode(state.selectedNodeId, input.dataset.nodeField, input.value);
    }
  });
}

function handleStageClick(event) {
  const quickAction = event.target.closest('[data-node-action]');
  if (quickAction) {
    event.stopPropagation();
    const id = quickAction.dataset.id;
    const action = quickAction.dataset.nodeAction;

    if (action === 'add-child') {
      addNode(id);
      setStatus('Nodo hijo agregado.', 'success');
    }

    if (action === 'toggle') {
      toggleCollapse(id);
    }
    return;
  }

  const nodeEl = event.target.closest('.chart-node');
  if (nodeEl) {
    state.selectedNodeId = nodeEl.dataset.id;
    renderAll();
  }
}

function toggleConnectorType() {
  state.connectorType = state.connectorType === 'curved' ? 'straight' : 'curved';
  dom.toggleConnectorsBtn.textContent = state.connectorType === 'curved' ? 'Conectores curvos' : 'Conectores rectos';
  drawConnectors();
}

function toggleTheme() {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  dom.themeToggleBtn.textContent = next === 'dark' ? 'Tema oscuro' : 'Tema claro';
}

function startNodeDrag(event, nodeEl) {
  event.stopPropagation();

  const nodeId = nodeEl.dataset.id;
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;

  state.nodeDragState = {
    pointerId: event.pointerId,
    nodeId,
    startX: event.clientX,
    startY: event.clientY,
    originX: node.x,
    originY: node.y,
    moved: false,
  };

  if (state.selectedNodeId !== nodeId) {
    state.selectedNodeId = nodeId;
    renderAll();
  }

  dom.canvasViewport.classList.add('dragging-node');
}

function startPan(event) {
  const nodeEl = event.target.closest('.chart-node');
  if (nodeEl && !event.target.closest('[data-node-action]')) {
    if (!state.autoLayout) {
      startNodeDrag(event, nodeEl);
      return;
    }
  }

  if (event.target.closest('button, input, select, label')) return;

  state.panState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: state.view.x,
    originY: state.view.y,
  };

  dom.canvasViewport.classList.add('dragging');
}

function movePan(event) {
  if (state.nodeDragState && event.pointerId === state.nodeDragState.pointerId) {
    const drag = state.nodeDragState;
    const nextX = drag.originX + (event.clientX - drag.startX) / state.view.scale;
    const nextY = drag.originY + (event.clientY - drag.startY) / state.view.scale;

    patchNodePosition(drag.nodeId, nextX, nextY);
    drag.moved = true;

    const nodeEl = dom.chartStage.querySelector(`.chart-node[data-id="${drag.nodeId}"]`);
    if (nodeEl) {
      nodeEl.style.left = `${nextX}px`;
      nodeEl.style.top = `${nextY}px`;
    }

    drawConnectors();
    return;
  }

  if (!state.panState || event.pointerId !== state.panState.pointerId) return;

  state.view.x = state.panState.originX + (event.clientX - state.panState.startX);
  state.view.y = state.panState.originY + (event.clientY - state.panState.startY);
  applyView();
}

function endPan(event) {
  if (state.nodeDragState && event.pointerId === state.nodeDragState.pointerId) {
    const moved = state.nodeDragState.moved;
    state.nodeDragState = null;
    dom.canvasViewport.classList.remove('dragging-node');

    if (moved) {
      commitNodePositionChange();
      renderCanvas();
      setStatus('Posición actualizada.', 'success', 1800);
    }
  }

  if (state.panState && event.pointerId === state.panState.pointerId) {
    state.panState = null;
    dom.canvasViewport.classList.remove('dragging');
  }
}

function handleZoom(event) {
  event.preventDefault();
  const factor = event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
  zoomAtPoint(event.clientX, event.clientY, factor);
}

function zoomAtCenter(factor) {
  const rect = dom.canvasViewport.getBoundingClientRect();
  zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
}

function zoomAtPoint(clientX, clientY, factor) {
  const rect = dom.canvasViewport.getBoundingClientRect();
  const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.view.scale * factor));
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;

  state.view.x = localX - ((localX - state.view.x) / state.view.scale) * nextScale;
  state.view.y = localY - ((localY - state.view.y) / state.view.scale) * nextScale;
  state.view.scale = nextScale;

  applyView();
  drawConnectors();
}

export function centerChart(resetScale = false) {
  if (resetScale) state.view.scale = 1;

  const bounds = getChartBounds();
  const viewportRect = dom.canvasViewport.getBoundingClientRect();

  const contentWidth = Math.max(bounds.maxX - bounds.minX + NODE_DIMS.width, 680);
  const contentHeight = Math.max(bounds.maxY - bounds.minY + NODE_DIMS.height, 420);

  state.view.x = Math.max(40, (viewportRect.width - contentWidth * state.view.scale) / 2 - bounds.minX * state.view.scale);
  state.view.y = Math.max(28, (viewportRect.height - contentHeight * state.view.scale) / 2 - bounds.minY * state.view.scale);

  applyView();
  drawConnectors();
}

function fitChart() {
  const viewportRect = dom.canvasViewport.getBoundingClientRect();
  const bounds = getChartBounds();

  const contentWidth = Math.max(bounds.maxX - bounds.minX + NODE_DIMS.width + 120, 600);
  const contentHeight = Math.max(bounds.maxY - bounds.minY + NODE_DIMS.height + 120, 380);

  const scaleX = viewportRect.width / contentWidth;
  const scaleY = viewportRect.height / contentHeight;

  state.view.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleX, scaleY)));
  centerChart(false);
}

function getChartBounds() {
  if (!state.nodes.length) {
    return { minX: 0, minY: 0, maxX: 680, maxY: 420 };
  }

  const xs = state.nodes.map(n => n.x);
  const ys = state.nodes.map(n => n.y);

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function focusNode(id) {
  const nodeEl = dom.chartStage.querySelector(`.chart-node[data-id="${id}"]`);
  if (!nodeEl) return;

  const viewportRect = dom.canvasViewport.getBoundingClientRect();
  const nodeRect = nodeEl.getBoundingClientRect();

  state.view.x += (viewportRect.left + viewportRect.width / 2) - (nodeRect.left + nodeRect.width / 2);
  state.view.y += (viewportRect.top + viewportRect.height / 2) - (nodeRect.top + nodeRect.height / 2);
  applyView();
}

function applyView() {
  dom.chartStage.style.transform = `translate(${state.view.x}px, ${state.view.y}px) scale(${state.view.scale})`;
  updateZoomLabel();
}

function updateZoomLabel() {
  dom.zoomValue.textContent = `${Math.round(state.view.scale * 100)}%`;
}