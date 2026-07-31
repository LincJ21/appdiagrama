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
  copyNodes,
  pasteNodes,
  alignNodes,
  distributeNodes,
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
  GRID_SIZE,
} from './config.js';

let statusTimeout = null;

export function showToast(message, type = 'info', duration = 3000) {
  const container = dom.toastContainer;
  if (!container) {
    dom.statusBox.textContent = message;
    dom.statusBox.className = `status ${type}`;
    clearTimeout(statusTimeout);
    if (duration > 0) {
      statusTimeout = setTimeout(() => {
        dom.statusBox.textContent = '';
        dom.statusBox.className = 'status info';
      }, duration);
    }
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  };

  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  if (duration > 0) {
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

export function setStatus(message, type = 'info', duration = 3200) {
  showToast(message, type, duration);
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

  if (dom.createFirstNodeBtn) {
    dom.createFirstNodeBtn.addEventListener('click', () => {
      addNode();
      renderAll();
    });
  }

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

  // Grid controls
  dom.snapGridBtn?.addEventListener('click', () => {
    state.snapToGrid = !state.snapToGrid;
    dom.snapGridBtn.classList.toggle('active', state.snapToGrid);
    setStatus(state.snapToGrid ? 'Ajuste a cuadrícula activado' : 'Ajuste a cuadrícula desactivado', 'info');
  });

  dom.toggleGridBtn?.addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    dom.toggleGridBtn.classList.toggle('active', state.showGrid);
    renderCanvas();
  });

  dom.gridSizeInput?.addEventListener('change', e => {
    state.gridSize = Math.max(5, Math.min(100, parseInt(e.target.value) || GRID_SIZE));
    renderCanvas();
  });

  // Shortcuts modal
  dom.shortcutsBtn?.addEventListener('click', () => {
    dom.shortcutsModal?.classList.add('active');
  });
  dom.closeShortcutsBtn?.addEventListener('click', () => {
    dom.shortcutsModal?.classList.remove('active');
  });
  dom.shortcutsModal?.addEventListener('click', e => {
    if (e.target === dom.shortcutsModal) dom.shortcutsModal.classList.remove('active');
  });

  // Alignment buttons (delegated since they are in inspector)
  dom.inspectorContent.addEventListener('click', e => {
    const alignBtn = e.target.closest('#alignLeftBtn, #alignCenterBtn, #alignRightBtn, #alignTopBtn, #alignMiddleBtn, #alignBottomBtn');
    if (alignBtn && state.multiSelectedNodeIds.length > 1) {
      const map = {
        'alignLeftBtn': 'left',
        'alignCenterBtn': 'center',
        'alignRightBtn': 'right',
        'alignTopBtn': 'top',
        'alignMiddleBtn': 'middle',
        'alignBottomBtn': 'bottom',
      };
      const direction = map[alignBtn.id];
      if (direction) {
        alignNodes(state.multiSelectedNodeIds, direction);
        renderAll();
        setStatus(`Nodos alineados ${direction}`, 'success');
      }
      return;
    }

    const distBtn = e.target.closest('#distributeHBtn, #distributeVBtn');
    if (distBtn && state.multiSelectedNodeIds.length > 2) {
      const axis = distBtn.id === 'distributeHBtn' ? 'horizontal' : 'vertical';
      distributeNodes(state.multiSelectedNodeIds, axis);
      renderAll();
      setStatus(`Nodos distribuidos ${axis === 'horizontal' ? 'horizontalmente' : 'verticalmente'}`, 'success');
      return;
    }
  });

  dom.chartStage.addEventListener('click', handleStageClick);
  dom.chartStage.addEventListener('pointerdown', startInteraction);
  dom.chartStage.addEventListener('dblclick', handleDoubleClick);
  dom.canvasViewport.addEventListener('pointerdown', startPan);
  dom.canvasViewport.addEventListener('wheel', handleZoom, { passive: false });
  dom.canvasViewport.addEventListener('contextmenu', handleContextMenu);

  window.addEventListener('pointermove', movePointer);
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('resize', () => { drawConnectors(); renderMiniMap(); });
  window.addEventListener('keydown', handleKeydown);

  // Close context menu on click elsewhere
  document.addEventListener('click', () => {
    if (dom.contextMenu) dom.contextMenu.classList.remove('active');
  });

  dom.nodeList.addEventListener('click', e => {
    const button = e.target.closest('[data-select-node]');
    if (!button) return;
    const id = button.dataset.selectNode;
    if (e.shiftKey) {
      toggleMultiSelect(id);
    } else {
      state.selectedNodeId = id;
      state.selectedLinkId = null;
      state.multiSelectedNodeIds = [];
    }
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

      if (['fontWeight', 'fontStyle', 'textDecoration'].includes(property)) {
        const newValue = node[property] === value ? '' : value;
        updateNode(state.selectedNodeId, property, newValue);
      } else if (property === 'textAlign') {
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
    if (!actionEl) return;

    const action = actionEl.dataset.inspectorAction;

    if (action === 'remove-multi') {
      const ids = [...state.multiSelectedNodeIds];
      ids.forEach(id => removeNode(id));
      state.multiSelectedNodeIds = [];
      renderAll();
      setStatus(`${ids.length} nodos eliminados.`, 'success');
      return;
    }

    if (!state.selectedNodeId) return;
    const id = state.selectedNodeId;

    if (action === 'clear-color') {
      updateNode(id, 'bgColor', '#ffffff');
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
    if (input.type === 'color' && e.type === 'input') return;
    if (input.tagName === 'SELECT' && e.type === 'input') return;

    if (input.dataset.linkField && state.selectedLinkId) {
      const link = state.links.find(item => item.id === state.selectedLinkId);
      if (!link) return;

      if (input.dataset.linkField === 'thickness') {
        link.thickness = Math.max(1, Number(input.value || 2));
      }
      if (input.dataset.linkField === 'color') {
        link.color = input.value;
      }
      if (input.dataset.linkField === 'label') {
        link.label = input.value;
      }

      drawConnectors();
      return;
    }

    if (!input.dataset.nodeField || !state.selectedNodeId) return;

    if (input.dataset.nodeField === 'bgColor' || input.dataset.nodeField === 'bgOpacity') {
      updateNode(state.selectedNodeId, input.dataset.nodeField, input.value);
      renderCanvas();
      return;
    }

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

  dom.inspectorContent.addEventListener('change', e => {
    const input = e.target;
    if (
      (input.tagName === 'SELECT' || input.type === 'color') &&
      input.dataset.nodeField &&
      state.selectedNodeId
    ) {
      updateNode(state.selectedNodeId, input.dataset.nodeField, input.value);
      commitTransientChange();
      renderCanvas();
    }
  });
}

function toggleMultiSelect(id) {
  const idx = state.multiSelectedNodeIds.indexOf(id);
  if (idx >= 0) {
    state.multiSelectedNodeIds.splice(idx, 1);
  } else {
    state.multiSelectedNodeIds.push(id);
  }
  if (state.selectedNodeId === id && state.multiSelectedNodeIds.length > 0) {
    state.selectedNodeId = null;
  }
}

function handleContextMenu(event) {
  event.preventDefault();
  if (!dom.contextMenu) return;

  const nodeEl = event.target.closest('.chart-node');
  const linkPath = event.target.closest('[data-link-id]');

  let items = [];

  if (nodeEl) {
    const id = nodeEl.dataset.id;
    items = [
      { label: 'Editar nombre', action: () => startInlineEdit(id) },
      { label: 'Duplicar', action: () => { duplicateNode(id); renderAll(); } },
      { label: 'Agregar hijo', action: () => { addNode(id); renderAll(); } },
      { label: 'Eliminar', action: () => { removeNode(id); renderAll(); }, danger: true },
    ];
  } else if (linkPath) {
    const id = linkPath.dataset.linkId;
    items = [
      { label: 'Restablecer ruta', action: () => {
        const link = state.links.find(l => l.id === id);
        if (link) { link.points = []; link.fromSide = ''; link.toSide = ''; commitTransientChange(); renderAll(); }
      }},
      { label: 'Eliminar conector', action: () => { removeLink(id); renderAll(); }, danger: true },
    ];
  } else {
    items = [
      { label: 'Agregar nodo raíz', action: () => { addNode(); renderAll(); } },
      { label: 'Centrar vista', action: () => centerChart(false) },
      { label: 'Ajustar a pantalla', action: () => fitChart() },
    ];
  }

  dom.contextMenu.innerHTML = items.map(item => 
    `<button class="${item.danger ? 'danger' : ''}" type="button">${item.label}</button>`
  ).join('');

  const buttons = dom.contextMenu.querySelectorAll('button');
  buttons.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      items[i].action();
      dom.contextMenu.classList.remove('active');
    });
  });

  dom.contextMenu.style.left = `${event.clientX}px`;
  dom.contextMenu.style.top = `${event.clientY}px`;
  dom.contextMenu.classList.add('active');
}

function handleDoubleClick(event) {
  const nodeEl = event.target.closest('.chart-node');
  if (nodeEl) {
    startInlineEdit(nodeEl.dataset.id);
  }
}

function startInlineEdit(nodeId) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const nodeEl = dom.chartStage.querySelector(`.chart-node[data-id="${nodeId}"]`);
  if (!nodeEl) return;

  nodeEl.dataset.editing = 'true';
  renderCanvas();

  const input = nodeEl.querySelector('.inline-edit');
  if (!input) return;

  input.focus();
  input.select();

  const finish = () => {
    if (input.value.trim() && input.value !== node.name) {
      updateNode(nodeId, 'name', input.value.trim());
      commitTransientChange();
    }
    nodeEl.dataset.editing = 'false';
    renderAll();
  };

  input.addEventListener('blur', finish, { once: true });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
    if (e.key === 'Escape') {
      input.value = node.name;
      input.blur();
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
  if (nodeEl && !event.target.closest('.node-port, [data-resize-handle], [data-node-action], .inline-edit')) {
    const id = nodeEl.dataset.id;
    if (event.shiftKey) {
      toggleMultiSelect(id);
    } else {
      state.selectedNodeId = id;
      state.selectedLinkId = null;
      state.multiSelectedNodeIds = [];
    }
    renderAll();
    return;
  }

  if (!event.shiftKey && !event.target.closest('.node-port, [data-resize-handle], .edge-handle, .segment-handle')) {
    state.selectedNodeId = null;
    state.selectedLinkId = null;
    state.multiSelectedNodeIds = [];
    renderAll();
  }
}

function toggleTheme() {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
}

function startInteraction(event) {
  if (event.button !== 0) return; // Only left click

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
    return;
  }

  // Start selection box
  if (!event.target.closest('.chart-node, .node-port, [data-resize-handle], .edge-handle, .segment-handle')) {
    startSelectionBox(event);
  }
}

function getSvgPoint(event) {
  const rect = dom.chartStage.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / state.view.scale,
    y: (event.clientY - rect.top) / state.view.scale,
  };
}

function snapToGrid(value) {
  if (!state.snapToGrid) return value;
  const grid = state.gridSize || GRID_SIZE;
  return Math.round(value / grid) * grid;
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

function startSelectionBox(event) {
  const point = getSvgPoint(event);
  state.selectionBox = {
    pointerId: event.pointerId,
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
  };
}

function startPan(event) {
  if (event.target.closest('.chart-node, [data-resize-handle], .node-port, .edge-handle, .segment-handle')) return;
  if (event.target.closest('button, input, select, label')) return;
  if (event.button !== 0 && event.button !== 1) return; // left or middle

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
    const node = state.nodes.find(n => n.id === resize.nodeId);
    if (!node) return;

    const deltaX = (event.clientX - resize.startX) / state.view.scale;
    const deltaY = (event.clientY - resize.startY) / state.view.scale;

    const angle = (node.rotation || 0) * Math.PI / 180;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);

    const localDeltaX = deltaX * cos - deltaY * sin;
    const localDeltaY = deltaX * sin + deltaY * cos;

    let newW = resize.originWidth + localDeltaX;
    let newH = resize.originHeight + localDeltaY;

    if (state.snapToGrid) {
      newW = snapToGrid(newW);
      newH = snapToGrid(newH);
    }

    patchNodeSize(resize.nodeId, newW, newH);
    updateConnectedLinksForNode(resize.nodeId);

    const nodeEl = dom.chartStage.querySelector(`.chart-node[data-id="${resize.nodeId}"]`);
    if (nodeEl && node) {
      nodeEl.style.width = `${node.width}px`;
      nodeEl.style.minHeight = `${node.height}px`;
    }

    drawConnectors();
    return;
  }

  if (state.nodeDragState && event.pointerId === state.nodeDragState.pointerId) {
    const drag = state.nodeDragState;
    let nextX = drag.originX + (event.clientX - drag.startX) / state.view.scale;
    let nextY = drag.originY + (event.clientY - drag.startY) / state.view.scale;

    if (state.snapToGrid) {
      nextX = snapToGrid(nextX);
      nextY = snapToGrid(nextY);
    }

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

  if (state.selectionBox && event.pointerId === state.selectionBox.pointerId) {
    const point = getSvgPoint(event);
    state.selectionBox.width = point.x - state.selectionBox.x;
    state.selectionBox.height = point.y - state.selectionBox.y;
    renderSelectionBox();
    return;
  }

  if (state.panState && event.pointerId === state.panState.pointerId) {
    state.view.x = state.panState.originX + (event.clientX - state.panState.startX);
    state.view.y = state.panState.originY + (event.clientY - state.panState.startY);
    applyView();
  }
}

function renderSelectionBox() {
  let box = dom.chartStage.querySelector('#selectionBox');
  if (!state.selectionBox) {
    if (box) box.remove();
    return;
  }

  if (!box) {
    box = document.createElement('div');
    box.id = 'selectionBox';
    box.className = 'selection-box';
    dom.chartStage.appendChild(box);
  }

  const { x, y, width, height } = state.selectionBox;
  box.style.left = `${Math.min(x, x + width)}px`;
  box.style.top = `${Math.min(y, y + height)}px`;
  box.style.width = `${Math.abs(width)}px`;
  box.style.height = `${Math.abs(height)}px`;
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

      if (toSide) link.toSide = toSide;

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

  if (state.selectionBox && event.pointerId === state.selectionBox.pointerId) {
    const box = state.selectionBox;
    const minX = Math.min(box.x, box.x + box.width);
    const maxX = Math.max(box.x, box.x + box.width);
    const minY = Math.min(box.y, box.y + box.height);
    const maxY = Math.max(box.y, box.y + box.height);

    const selected = state.nodes.filter(n => 
      n.x >= minX && n.x + n.width <= maxX &&
      n.y >= minY && n.y + n.height <= maxY
    );

    if (selected.length > 0) {
      state.multiSelectedNodeIds = selected.map(n => n.id);
      state.selectedNodeId = null;
      state.selectedLinkId = null;
    }

    state.selectionBox = null;
    const boxEl = dom.chartStage.querySelector('#selectionBox');
    if (boxEl) boxEl.remove();
    renderAll();
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

  if (meta && e.key.toLowerCase() === 'c') {
    e.preventDefault();
    const ids = state.selectedNodeId ? [state.selectedNodeId] : state.multiSelectedNodeIds;
    if (ids.length) {
      copyNodes(ids);
      setStatus(`${ids.length} nodo(s) copiado(s)`, 'success');
    }
    return;
  }

  if (meta && e.key.toLowerCase() === 'v') {
    e.preventDefault();
    const pasted = pasteNodes();
    if (pasted.length) {
      renderAll();
      setStatus(`${pasted.length} nodo(s) pegado(s)`, 'success');
    }
    return;
  }

  if (meta && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    if (state.selectedNodeId) {
      duplicateNode(state.selectedNodeId);
      renderAll();
      setStatus('Nodo duplicado', 'success');
    }
    return;
  }

  if (meta && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    state.multiSelectedNodeIds = state.nodes.map(n => n.id);
    state.selectedNodeId = null;
    state.selectedLinkId = null;
    renderAll();
    return;
  }

  if (e.key === '?') {
    e.preventDefault();
    dom.shortcutsModal?.classList.toggle('active');
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

    if (state.selectedLinkId) {
      removeLink(state.selectedLinkId);
      renderAll();
      setStatus('Conector eliminado.', 'success');
      return;
    }

    if (state.selectedNodeId) {
      removeNode(state.selectedNodeId);
      renderAll();
      setStatus('Nodo eliminado.', 'success');
      return;
    }

    if (state.multiSelectedNodeIds.length) {
      const count = state.multiSelectedNodeIds.length;
      state.multiSelectedNodeIds.forEach(id => removeNode(id));
      state.multiSelectedNodeIds = [];
      renderAll();
      setStatus(`${count} nodos eliminados.`, 'success');
    }
  }
}