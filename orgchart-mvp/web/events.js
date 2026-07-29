import { dom } from './dom.js';
import state, {
  addNode,
  updateNode,
  removeNode,
  duplicateNode,
  applyLayout,
  undo,
  redo,
  patchNodePosition,
  patchNodeSize,
  commitTransientChange,
  importChart,
  addLink,
  removeLink,
  selectLink,
} from './state.js';

import {
  renderAll,
  renderNodeList,
  renderCanvas,
  drawConnectors,
  applyStageTransform,
  ensureEditableLink,
  nearestPortSide,
  portPoint,
} from './render.js';

import {
  saveAll,
  regenerateHTML,
  exportPDF,
  exportPNG,
  downloadJSON,
} from './api.js';

import {
  ZOOM_IN_FACTOR,
  WHEEL_ZOOM_FACTOR,
  MIN_SCALE,
  MAX_SCALE,
  NODE_DIMS,
  NODE_MIN_WIDTH,
  NODE_MIN_HEIGHT,
} from './config.js';

let statusTimeout = null;

export function setStatus(message, type = 'info', duration = 3200) {
  dom.statusBox.textContent = message;
  dom.statusBox.className = `status ${type}`;
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
  dom.addRootBtn.addEventListener('click', () => {
    addNode();
    renderAll();
  });

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
      renderAll();
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
    renderAll();
  });

  dom.redoBtn.addEventListener('click', () => {
    redo();
    dom.companyInput.value = state.company;
    renderAll();
  });

  dom.autoLayoutBtn.addEventListener('click', () => {
    state.autoLayout = !state.autoLayout;
    dom.autoLayoutBtn.textContent = `Auto layout ${state.autoLayout ? 'ON' : 'OFF'}`;
    if (state.autoLayout) applyLayout();
    renderCanvas();
  });

  dom.zoomInBtn.addEventListener('click', () => zoomAtCenter(ZOOM_IN_FACTOR));
  dom.zoomOutBtn.addEventListener('click', () => zoomAtCenter(1 / ZOOM_IN_FACTOR));
  dom.zoomResetBtn.addEventListener('click', () => {
    state.view.scale = 1;
    centerChart(true);
  });
  dom.centerBtn.addEventListener('click', () => centerChart(false));
  dom.fitBtn.addEventListener('click', fitChart);
  dom.themeToggleBtn?.addEventListener('click', toggleTheme);

  dom.chartStage.addEventListener('click', handleStageClick);
  dom.chartStage.addEventListener('pointerdown', startInteraction);
  dom.canvasViewport.addEventListener('pointerdown', startPan);
  dom.canvasViewport.addEventListener('wheel', handleZoom, { passive: false });

  window.addEventListener('pointermove', movePointer);
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('resize', drawConnectors);
  window.addEventListener('keydown', handleKeydown);

  dom.nodeList.addEventListener('click', e => {
    const button = e.target.closest('[data-select-node]');
    if (!button) return;
    state.selectedNodeId = button.dataset.selectNode;
    state.selectedLinkId = null;
    renderAll();
  });

  dom.inspectorContent.addEventListener('click', e => {
    const selectLinkBtn = e.target.closest('[data-select-link]');
    if (selectLinkBtn) {
      selectLink(selectLinkBtn.dataset.selectLink);
      renderAll();
      return;
    }

    const textStyleBtn = e.target.closest('[data-text-style]');
    if (textStyleBtn && state.selectedNodeId) {
      const { textStyle: property, value } = textStyleBtn.dataset;
      const node = state.nodes.find(n => n.id === state.selectedNodeId);
      if (!node) return;

      // Propiedades de tipo 'toggle' (bold, italic, underline)
      if (['fontWeight', 'fontStyle', 'textDecoration'].includes(property)) {
        const newValue = node[property] === value ? '' : value;
        updateNode(state.selectedNodeId, property, newValue);
      }
      // Propiedades exclusivas (text-align)
      else if (property === 'textAlign') {
        updateNode(state.selectedNodeId, property, value);
      }

      commitTransientChange();
      renderAll();
      return;
    }

    const linkAction = e.target.closest('[data-link-action]');
    if (linkAction && state.selectedLinkId) {
      const link = state.links.find(item => item.id === state.selectedLinkId);
      if (!link) return;

      if (linkAction.dataset.linkAction === 'reset-points') {
        link.points = [];
        link.fromSide = '';
        link.toSide = '';
        link.manual = false;
        commitTransientChange();
        renderAll();
        setStatus('Ruta restablecida.', 'success');
        return;
      }

      if (linkAction.dataset.linkAction === 'remove') {
        removeLink(state.selectedLinkId);
        renderAll();
        setStatus('Conector eliminado.', 'success');
        return;
      }
    }

    const actionEl = e.target.closest('[data-inspector-action]');
    if (!actionEl || !state.selectedNodeId) return;

    const action = actionEl.dataset.inspectorAction;
    const id = state.selectedNodeId;

    if (action === 'clear-color') {
      updateNode(id, 'color', '');
      renderAll();
      return;
    }

    if (action === 'add-child') addNode(id);
    if (action === 'duplicate') duplicateNode(id);
    if (action === 'remove') removeNode(id);

    renderAll();
  });

  dom.inspectorContent.addEventListener('input', e => {
    const input = e.target;
    // Los cambios de color y select se manejan en el evento 'change' para confirmar el valor final.
    if (input.type === 'color' || input.tagName === 'SELECT') return;

    if (input.dataset.linkField && state.selectedLinkId) {
      const link = state.links.find(item => item.id === state.selectedLinkId);
      if (!link) return;

      if (input.dataset.linkField === 'thickness') {
        link.thickness = Math.max(1, Number(input.value || 2));
      }

      if (input.dataset.linkField === 'color') {
        link.color = input.value;
      }

      drawConnectors();
      return;
    }

    if (!input.dataset.nodeField || !state.selectedNodeId) return;

    if (input.dataset.nodeField === 'width' || input.dataset.nodeField === 'height') {
      const node = state.nodes.find(n => n.id === state.selectedNodeId);
      if (!node) return;

      const value = Math.max(
        Number(input.value || 0),
        input.dataset.nodeField === 'width' ? NODE_MIN_WIDTH : NODE_MIN_HEIGHT
      );

      node[input.dataset.nodeField] = value;
      updateConnectedLinksForNode(node.id);
      renderCanvas();
      return;
    }

    updateNode(state.selectedNodeId, input.dataset.nodeField, input.value);
    renderCanvas();
  });

  // Escucha los cambios "confirmados", como la selección en un <select>
  dom.inspectorContent.addEventListener('change', e => {
    const input = e.target;

    // Manejar el cambio de estilo del nodo y el color
    if (
      (input.tagName === 'SELECT' || input.type === 'color') &&
      input.dataset.nodeField &&
      state.selectedNodeId
    ) {
      updateNode(state.selectedNodeId, input.dataset.nodeField, input.value);
      commitTransientChange(); // Asegura que el cambio se consolide para el guardado
      renderCanvas();
    }
  });
}

function handleStageClick(event) {
  const linkPath = event.target.closest('[data-link-id]');
  if (linkPath) {
    selectLink(linkPath.dataset.linkId);
    renderAll();
    return;
  }

  const quickAction = event.target.closest('[data-node-action]');
  if (quickAction) {
    event.stopPropagation();
    const id = quickAction.dataset.id;
    const action = quickAction.dataset.nodeAction;

    if (action === 'add-child') addNode(id);

    renderAll();
    return;
  }

  const nodeEl = event.target.closest('.chart-node');
  if (nodeEl && !event.target.closest('.node-port, [data-resize-handle], [data-node-action]')) {
    state.selectedNodeId = nodeEl.dataset.id;
    state.selectedLinkId = null;
    renderAll();
    return;
  }

  state.selectedNodeId = null;
  state.selectedLinkId = null;
  renderAll();
}

function toggleTheme() {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
}

function startInteraction(event) {
  const port = event.target.closest('.node-port');
  if (port) {
    event.stopPropagation();
    state.portDragState = {
      pointerId: event.pointerId,
      fromNodeId: port.dataset.nodeId,
      fromSide: port.dataset.port,
      current: getSvgPoint(event),
    };
    return;
  }

  const edgeHandle = event.target.closest('.edge-handle');
  if (edgeHandle) {
    event.stopPropagation();
    state.edgeDragState = {
      pointerId: event.pointerId,
      linkId: edgeHandle.dataset.linkId,
      edge: edgeHandle.dataset.edge,
    };
    return;
  }

  const segmentHandle = event.target.closest('.segment-handle');
  if (segmentHandle) {
    event.stopPropagation();
    const orientation = segmentHandle.classList.contains('segment-h') ? 'horizontal' : 'vertical';
    const link = state.links.find(item => item.id === segmentHandle.dataset.linkId);
    if (link) link.manual = true;

    state.segmentDragState = {
      pointerId: event.pointerId,
      linkId: segmentHandle.dataset.linkId,
      segIndex: Number(segmentHandle.dataset.segIndex),
      orientation,
    };
    return;
  }

  const handle = event.target.closest('[data-resize-handle]');
  if (handle) {
    event.stopPropagation();
    const nodeEl = event.target.closest('.chart-node');
    if (!nodeEl) return;
    startNodeResize(event, nodeEl.dataset.id);
    return;
  }

  const nodeEl = event.target.closest('.chart-node');
  if (nodeEl && !event.target.closest('[data-node-action]') && !state.autoLayout) {
    startNodeDrag(event, nodeEl);
  }
}

function getSvgPoint(event) {
  const rect = dom.chartStage.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / state.view.scale,
    y: (event.clientY - rect.top) / state.view.scale,
  };
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
}

function startNodeResize(event, nodeId) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;

  state.resizeState = {
    pointerId: event.pointerId,
    nodeId,
    startX: event.clientX,
    startY: event.clientY,
    originWidth: node.width,
    originHeight: node.height,
  };
}

function startPan(event) {
  if (event.target.closest('.chart-node, [data-resize-handle], .node-port, .edge-handle, .segment-handle')) return;
  if (event.target.closest('button, input, select, label')) return;

  state.panState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: state.view.x,
    originY: state.view.y,
  };
}

function movePointer(event) {
  if (state.portDragState && event.pointerId === state.portDragState.pointerId) {
    state.portDragState.current = getSvgPoint(event);
    drawTempConnector();
    return;
  }

  if (state.edgeDragState && event.pointerId === state.edgeDragState.pointerId) {
    const drag = state.edgeDragState;
    const link = state.links.find(item => item.id === drag.linkId);
    if (!link) return;

    link.manual = true;

    const nodeId = drag.edge === 'from' ? link.fromId : link.toId;
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const side = nearestPortSide(node, getSvgPoint(event));
    if (drag.edge === 'from') link.fromSide = side;
    else link.toSide = side;

    link.points = [];
    const from = state.nodes.find(n => n.id === link.fromId);
    const to = state.nodes.find(n => n.id === link.toId);
    if (from && to) ensureEditableLink(link, from, to);

    drawConnectors();
    return;
  }

  if (state.segmentDragState && event.pointerId === state.segmentDragState.pointerId) {
    const drag = state.segmentDragState;
    const link = state.links.find(item => item.id === drag.linkId);
    if (!link) return;

    link.manual = true;

    const point = getSvgPoint(event);
    const a = link.points[drag.segIndex];
    const b = link.points[drag.segIndex + 1];
    if (!a || !b) return;

    if (drag.orientation === 'horizontal') {
      a.y = point.y;
      b.y = point.y;
    } else {
      a.x = point.x;
      b.x = point.x;
    }

    drawConnectors();
    return;
  }

  if (state.activeAnchor && event.pointerId === state.activeAnchor.pointerId) return;

  if (state.resizeState && event.pointerId === state.resizeState.pointerId) {
    const resize = state.resizeState;
    const deltaX = (event.clientX - resize.startX) / state.view.scale;
    const deltaY = (event.clientY - resize.startY) / state.view.scale;

    patchNodeSize(
      resize.nodeId,
      resize.originWidth + deltaX,
      resize.originHeight + deltaY
    );

    updateConnectedLinksForNode(resize.nodeId);

    const nodeEl = dom.chartStage.querySelector(`.chart-node[data-id="${resize.nodeId}"]`);
    const node = state.nodes.find(n => n.id === resize.nodeId);
    if (nodeEl && node) {
      nodeEl.style.width = `${node.width}px`;
      nodeEl.style.minHeight = `${node.height}px`;
    }

    drawConnectors();
    return;
  }

  if (state.nodeDragState && event.pointerId === state.nodeDragState.pointerId) {
    const drag = state.nodeDragState;
    const nextX = drag.originX + (event.clientX - drag.startX) / state.view.scale;
    const nextY = drag.originY + (event.clientY - drag.startY) / state.view.scale;

    patchNodePosition(drag.nodeId, nextX, nextY);
    updateConnectedLinksForNode(drag.nodeId);
    drag.moved = true;

    const nodeEl = dom.chartStage.querySelector(`.chart-node[data-id="${drag.nodeId}"]`);
    if (nodeEl) {
      nodeEl.style.left = `${nextX}px`;
      nodeEl.style.top = `${nextY}px`;
    }

    drawConnectors();
    return;
  }

  if (state.panState && event.pointerId === state.panState.pointerId) {
    state.view.x = state.panState.originX + (event.clientX - state.panState.startX);
    state.view.y = state.panState.originY + (event.clientY - state.panState.startY);
    applyView();
  }
}

function drawTempConnector() {
  const svg = dom.chartStage.querySelector('#connectorsLayer');
  if (!svg || !state.portDragState) return;

  const from = state.nodes.find(n => n.id === state.portDragState.fromNodeId);
  if (!from) return;

  const start = portPoint(from, state.portDragState.fromSide);
  const end = state.portDragState.current;

  let temp = svg.querySelector('#tempConnector');
  if (!temp) {
    temp = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    temp.id = 'tempConnector';
    temp.setAttribute('class', 'temp-connector');
    svg.appendChild(temp);
  }

  temp.setAttribute('x1', start.x);
  temp.setAttribute('y1', start.y);
  temp.setAttribute('x2', end.x);
  temp.setAttribute('y2', end.y);
}

function endPointer(event) {
  if (state.portDragState && event.pointerId === state.portDragState.pointerId) {
    const dropTarget = document.elementFromPoint(event.clientX, event.clientY);
    const targetNodeEl = dropTarget?.closest('.chart-node');
    const targetPortEl = dropTarget?.closest('.node-port');

    if (targetNodeEl && targetNodeEl.dataset.id !== state.portDragState.fromNodeId) {
      const toId = targetNodeEl.dataset.id;
      const toSide = targetPortEl ? targetPortEl.dataset.port : null;
      const link = addLink(state.portDragState.fromNodeId, toId);
      link.fromSide = state.portDragState.fromSide;

      const toNode = state.nodes.find(n => n.id === toId);
      const fromNode = state.nodes.find(n => n.id === state.portDragState.fromNodeId);

      if (toSide) {
        link.toSide = toSide;
      }

      ensureAutomaticLinkDirection(link, fromNode, toNode);
      ensureEditableLink(link, fromNode, toNode);

      renderAll();
      setStatus('Conexión creada. Ahora puedes editar sus tramos.', 'success');
    } else {
      drawConnectors();
    }

    state.portDragState = null;
    return;
  }

  if (state.edgeDragState && event.pointerId === state.edgeDragState.pointerId) {
    state.edgeDragState = null;
    commitTransientChange();
    setStatus('Extremo del conector movido.', 'success', 1800);
    return;
  }

  if (state.segmentDragState && event.pointerId === state.segmentDragState.pointerId) {
    state.segmentDragState = null;
    commitTransientChange();
    setStatus('Tramo del conector ajustado.', 'success', 1800);
    return;
  }

  if (state.resizeState && event.pointerId === state.resizeState.pointerId) {
    state.resizeState = null;
    commitTransientChange();
    renderCanvas();
    return;
  }

  if (state.nodeDragState && event.pointerId === state.nodeDragState.pointerId) {
    const moved = state.nodeDragState.moved;
    state.nodeDragState = null;

    if (moved) {
      commitTransientChange();
      renderCanvas();
    }
    return;
  }

  if (state.panState && event.pointerId === state.panState.pointerId) {
    state.panState = null;
  }
}

function ensureAutomaticLinkDirection(link, fromNode, toNode) {
  if (!fromNode || !toNode) return;

  const fromCenterX = fromNode.x + fromNode.width / 2;
  const fromCenterY = fromNode.y + fromNode.height / 2;
  const toCenterX = toNode.x + toNode.width / 2;
  const toCenterY = toNode.y + toNode.height / 2;

  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    link.fromSide = dx >= 0 ? 'right' : 'left';
    link.toSide = dx >= 0 ? 'left' : 'right';
  } else {
    link.fromSide = dy >= 0 ? 'bottom' : 'top';
    link.toSide = dy >= 0 ? 'top' : 'bottom';
  }
}

function updateConnectedLinksForNode(nodeId) {
  const relatedLinks = state.links.filter(
    link => link.fromId === nodeId || link.toId === nodeId
  );

  for (const link of relatedLinks) {
    if (link.manual) continue;

    const fromNode = state.nodes.find(n => n.id === link.fromId);
    const toNode = state.nodes.find(n => n.id === link.toId);
    if (!fromNode || !toNode) continue;

    ensureAutomaticLinkDirection(link, fromNode, toNode);
    ensureEditableLink(link, fromNode, toNode);
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

  state.view.x =
    Math.max(40, viewportRect.width - contentWidth * state.view.scale) / 2 -
    bounds.minX * state.view.scale;
  state.view.y =
    Math.max(28, viewportRect.height - contentHeight * state.view.scale) / 2 -
    bounds.minY * state.view.scale;

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

  state.view.scale = Math.max(
    MIN_SCALE,
    Math.min(MAX_SCALE, Math.min(scaleX, scaleY))
  );

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

function applyView() {
  applyStageTransform();
  dom.zoomValue.textContent = `${Math.round(state.view.scale * 100)}%`;
}

function handleKeydown(e) {
  const meta = e.ctrlKey || e.metaKey;

  if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
    dom.companyInput.value = state.company;
    renderAll();
    return;
  }

  if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault();
    redo();
    dom.companyInput.value = state.company;
    renderAll();
    return;
  }

  if (e.key === 'Delete' && state.selectedNodeId) {
    removeNode(state.selectedNodeId);
    renderAll();
    setStatus('Nodo eliminado.', 'success');
  }
}