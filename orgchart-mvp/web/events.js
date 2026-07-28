import { dom, getAutoLayoutBtn, getLayoutModeBtn, getCanvasCreateRootBtn } from './dom.js';
import { state, addNode, updateNode, removeNode, duplicateNode, toggleCollapse, applyLayout } from './state.js';
import { renderAll, renderNodeList, renderCanvas, drawConnectors } from './render.js';
import { saveAll, regenerateHTML, exportPDF } from './api.js';
import { ZOOM_IN_FACTOR, WHEEL_ZOOM_FACTOR, MIN_SCALE, MAX_SCALE } from './config.js';

let statusTimeout = null;

export function setStatus(message, type = 'info', duration = 5000) {
  dom.statusBox.textContent = message;
  dom.statusBox.className = 'status';
  if (type) dom.statusBox.classList.add(type);

  clearTimeout(statusTimeout);
  if (duration > 0) {
    statusTimeout = setTimeout(() => {
      dom.statusBox.textContent = '';
      dom.statusBox.classList.remove(type);
    }, duration);
  }
}

export function setupEventListeners() {
  dom.companyInput.addEventListener('input', e => {
    state.company = e.target.value;
    renderCanvas();
  });

  dom.searchInput.addEventListener('input', e => {
    state.searchTerm = e.target.value.trim().toLowerCase();
    renderNodeList();
  });

  dom.saveBtn.addEventListener('click', saveAll);
  dom.addRootBtn.addEventListener('click', () => addNode(''));
  dom.exportHtmlBtn.addEventListener('click', regenerateHTML);
  dom.exportPdfBtn.addEventListener('click', exportPDF);

  dom.zoomInBtn.addEventListener('click', () => zoomAtCenter(ZOOM_IN_FACTOR));
  dom.zoomOutBtn.addEventListener('click', () => zoomAtCenter(1 / ZOOM_IN_FACTOR));
  dom.zoomResetBtn.addEventListener('click', () => {
    state.view.scale = 1;
    updateZoomLabel();
    centerChart(true);
  });
  dom.centerBtn.addEventListener('click', () => centerChart(true));
  dom.toggleConnectorsBtn.addEventListener('click', toggleConnectorType);

  dom.chartStage.addEventListener('click', handleStageClick);
  dom.canvasViewport.addEventListener('pointerdown', startPan);
  window.addEventListener('pointermove', movePan);
  window.addEventListener('pointerup', endPan);
  dom.canvasViewport.addEventListener('wheel', handleZoom, { passive: false });
  window.addEventListener('resize', drawConnectors);
  window.addEventListener('keydown', e => {
    if (e.key === 'Delete' && state.selectedNodeId) {
      removeNode(state.selectedNodeId);
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
    if (action === 'add-child') addNode(id);
    if (action === 'duplicate') duplicateNode(id);
    if (action === 'remove') removeNode(id);
  });

  dom.inspectorContent.addEventListener('input', e => {
    const input = e.target;
    if (input.tagName !== 'SELECT' && input.dataset.nodeField && state.selectedNodeId) {
      updateNode(state.selectedNodeId, input.dataset.nodeField, input.value);
    }
  });
  dom.inspectorContent.addEventListener('change', e => {
    const input = e.target;
    if (input.tagName === 'SELECT' && input.dataset.nodeField && state.selectedNodeId) {
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
    if (action === 'add-child') addNode(id);
    if (action === 'toggle') toggleCollapse(id);
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
  dom.toggleConnectorsBtn.textContent = state.connectorType === 'curved' ? 'Curva' : 'Recta';
  drawConnectors();
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
    startNodeDrag(event, nodeEl);
    return;
  }
  if (event.target.closest('button, input, select')) return;

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
    const node = state.nodes.find(n => n.id === drag.nodeId);
    if (!node) return;
    node.x = drag.originX + (event.clientX - drag.startX) / state.view.scale;
    node.y = drag.originY + (event.clientY - drag.startY) / state.view.scale;
    const nodeEl = dom.chartStage.querySelector(`.chart-node[data-id="${drag.nodeId}"]`);
    if (nodeEl) {
      nodeEl.style.left = `${node.x}px`;
      nodeEl.style.top = `${node.y}px`;
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
    state.nodeDragState = null;
    dom.canvasViewport.classList.remove('dragging-node');
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
  const viewportRect = dom.canvasViewport.getBoundingClientRect();
  const width = Math.max(dom.chartStage.scrollWidth, 680);
  const height = Math.max(dom.chartStage.scrollHeight, 480);
  state.view.x = Math.max(36, (viewportRect.width - width * state.view.scale) / 2);
  state.view.y = Math.max(28, (viewportRect.height - height * state.view.scale) / 2 + 18);
  applyView();
  drawConnectors();
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