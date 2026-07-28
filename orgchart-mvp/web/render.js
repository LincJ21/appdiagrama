import { dom, getCanvasCreateRootBtn } from './dom.js';
import { state, getNode, getRoots, getChildren, getLevel, getMaxDepth, getAvailableParents, collectDescendants } from './state.js';
import { NODE_DIMS } from './config.js';
import { addNode } from './state.js';

const escapeHtml = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return 'ND';
  return parts.map(part => part[0].toUpperCase()).join('');
};

export function renderAll() {
  renderStats();
  renderNodeList();
  renderInspector();
  renderCanvas();
}

export function renderStats() {
  const updated = state.updatedAt ? new Date(state.updatedAt).toLocaleString('es-CO') : 'Sin guardar';
  dom.statsGrid.innerHTML = `
    <div class="stat-card"><span class="stat-label">Nodos</span><div class="stat-value">${state.nodes.length}</div></div>
    <div class="stat-card"><span class="stat-label">Raíces</span><div class="stat-value">${getRoots().length}</div></div>
    <div class="stat-card"><span class="stat-label">Niveles</span><div class="stat-value">${getMaxDepth()}</div></div>
    <div class="stat-card"><span class="stat-label">Actualización</span><div class="stat-value" style="font-size:14px;line-height:1.3">${escapeHtml(updated)}</div></div>
  `;
}

export function renderNodeList() {
  const filtered = state.nodes.filter(node => {
    if (!state.searchTerm) return true;
    const target = `${node.name} ${node.title} ${node.area} ${node.email}`.toLowerCase();
    return target.includes(state.searchTerm);
  });

  if (!filtered.length) {
    dom.nodeList.innerHTML = `<div class="empty-state"><strong>Sin coincidencias</strong><span>Ajusta la búsqueda.</span></div>`;
    return;
  }

  dom.nodeList.innerHTML = filtered.map(node => `
    <div class="node-list-item ${node.id === state.selectedNodeId ? 'active' : ''}">
      <button class="node-list-button" data-select-node="${node.id}">
        <div class="node-list-top">
          <strong>${escapeHtml(node.name || 'Sin nombre')}</strong>
          <span class="role-badge">${!node.parentId ? 'Raíz' : 'Nodo'}</span>
        </div>
        <div class="node-list-bottom">
          <span>${escapeHtml(node.title || 'Sin cargo')}</span>
          <span class="level-badge">Nivel ${getLevel(node.id) + 1}</span>
        </div>
      </button>
    </div>
  `).join('');
}

export function renderInspector() {
  const node = getNode(state.selectedNodeId);
  if (!node) {
    dom.inspectorContent.innerHTML = `<div class="empty-state"><strong>No hay nodo seleccionado</strong><span>Selecciona un bloque o crea uno nuevo.</span></div>`;
    return;
  }

  const parentOptions = getAvailableParents(node.id).map(option =>
    `<option value="${option.id}" ${option.id === node.parentId ? 'selected' : ''}>${escapeHtml(option.name || option.title || option.id)}</option>`
  ).join('');

  dom.inspectorContent.innerHTML = `
    <div class="inspector-card">
      <div class="inspector-title">
        <div><h3>${escapeHtml(node.name || 'Sin nombre')}</h3><p class="node-subline">${escapeHtml(node.title || 'Sin cargo')}</p></div>
        <span class="mini-chip">${getChildren(node.id).length} hijo(s)</span>
      </div>
      <div class="inspector-meta">
        <span class="mini-chip">Nivel ${getLevel(node.id) + 1}</span>
        <span class="mini-chip">${node.parentId ? 'Con dependencia' : 'Nodo raíz'}</span>
      </div>
    </div>
    <div class="inspector-card">
      <div class="inspector-grid">
        <div class="full"><label>Nombre</label><input data-node-field="name" value="${escapeHtml(node.name)}" /></div>
        <div class="full"><label>Cargo</label><input data-node-field="title" value="${escapeHtml(node.title)}" /></div>
        <div><label>Área</label><input data-node-field="area" value="${escapeHtml(node.area)}" /></div>
        <div><label>Jefe</label><select data-node-field="parentId"><option value="">Sin jefe</option>${parentOptions}</select></div>
        <div><label>Rotación</label><input type="number" min="-45" max="45" step="1" data-node-field="rotation" value="${Number(node.rotation || 0)}" /></div>
        <div><label>Email</label><input data-node-field="email" value="${escapeHtml(node.email)}" /></div>
        <div><label>Teléfono</label><input data-node-field="phone" value="${escapeHtml(node.phone)}" /></div>
      </div>
    </div>
    <div class="inspector-card">
      <div class="inspector-actions">
        <button class="btn btn-ghost" data-inspector-action="add-child">Agregar hijo</button>
        <button class="btn btn-ghost" data-inspector-action="duplicate">Duplicar</button>
        <button class="btn btn-danger" data-inspector-action="remove">Eliminar</button>
      </div>
    </div>
  `;
}

export function renderCanvas() {
  if (!state.nodes.length) {
    dom.chartStage.innerHTML = `
      <div class="canvas-empty"><div class="canvas-empty-card">
        <span class="mini-chip">Editor listo</span><h3>Crea tu primer nodo</h3>
        <p>Empieza con una raíz para construir el organigrama.</p>
        <div style="margin-top:18px"><button class="btn btn-primary" id="canvasCreateRoot">Crear raíz</button></div>
      </div></div>`;
    getCanvasCreateRootBtn().addEventListener('click', () => addNode(''));
    return;
  }

  dom.chartStage.innerHTML = `
    <svg class="connector-layer" id="connectorLayer"></svg>
    ${state.nodes.map(renderNode).join('')}
  `;
  drawConnectors();
}

function renderNode(node) {
  const isRoot = !node.parentId;
  return `
    <div 
      class="chart-node ${state.selectedNodeId === node.id ? 'selected' : ''} ${isRoot ? 'root-node' : ''}" 
      data-id="${node.id}" 
      style="left: ${node.x}px; top: ${node.y}px; transform: rotate(${(node.rotation || 0)}deg);"
    >
      <div class="node-top">
        <div class="node-avatar">${getInitials(node.name)}</div>
        <div class="node-content">
          <div class="node-label-row">
            <div class="node-name">${escapeHtml(node.name || 'Sin nombre')}</div>
            <span class="node-type">${isRoot ? 'principal' : `nivel ${getLevel(node.id) + 1}`}</span>
          </div>
          <div class="node-title">${escapeHtml(node.title || 'Sin cargo')}</div>
          <div class="node-subline">${escapeHtml(node.area || 'Área sin definir')}</div>
          <div class="node-meta">${node.email ? `<span>${escapeHtml(node.email)}</span>` : ''}${node.phone ? `<span>${escapeHtml(node.phone)}</span>` : ''}</div>
        </div>
      </div>
      <div class="node-quickbar">
        <button class="node-quick" data-node-action="add-child" data-id="${node.id}" title="Agregar hijo">＋</button>
        ${getChildren(node.id).length > 0 ? `<button class="node-quick" data-node-action="toggle" data-id="${node.id}" title="Expandir/Contraer">${state.collapsed.has(node.id) ? '▸' : '▾'}</button>` : ''}
      </div>
    </div>
  `;
}

export function drawConnectors() {
  const svg = document.getElementById('connectorLayer');
  if (!svg) return;

  svg.innerHTML = state.nodes.map(node => {
    if (!node.parentId) return '';
    const parent = getNode(node.parentId);
    if (!parent || state.collapsed.has(parent.id)) return '';

    const { start, end } = findOptimalConnectionPoints(parent, node);
    const pathD = getPathD(start, end);

    return `<path d="${pathD}" />`;
  }).join('');
}

function getPathD(start, end) {
  if (state.connectorType === 'straight') {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }
  // Curved
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let path;
  if (start.type === 'bottom' && end.type === 'top') {
    const c1x = start.x;
    const c1y = start.y + dy * 0.6;
    const c2x = end.x;
    const c2y = end.y - dy * 0.6;
    path = `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
  } else if (start.type === 'right' && end.type === 'left') {
    const c1x = start.x + dx * 0.6;
    const c1y = start.y;
    const c2x = end.x - dx * 0.6;
    const c2y = end.y;
    path = `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
  } else { // Fallback for other connections
    const c1x = start.x;
    const c1y = start.y + dy / 2;
    const c2x = end.x;
    const c2y = end.y - dy / 2;
    path = `M ${start.x} ${start.y} Q ${start.x} ${start.y + dy/2}, ${start.x + dx/2} ${start.y + dy/2} T ${end.x} ${end.y}`;
  }
  return path;
}

function findOptimalConnectionPoints(parentNode, childNode) {
  const getAnchors = (node) => {
    const hw = NODE_DIMS.width / 2;
    const hh = NODE_DIMS.height / 2;
    return [
      { x: node.x + hw, y: node.y, type: 'top' },
      { x: node.x + NODE_DIMS.width, y: node.y + hh, type: 'right' },
      { x: node.x + hw, y: node.y + NODE_DIMS.height, type: 'bottom' },
      { x: node.x, y: node.y + hh, type: 'left' }
    ];
  };

  const parentAnchors = getAnchors(parentNode);
  const childAnchors = getAnchors(childNode);
  let minDistance = Infinity;
  let bestPair = { start: parentAnchors[2], end: childAnchors[0] };

  for (const pA of parentAnchors) {
    for (const pC of childAnchors) {
      const dist = Math.sqrt(Math.pow(pC.x - pA.x, 2) + Math.pow(pC.y - pA.y, 2));
      if (dist < minDistance) {
        minDistance = dist;
        bestPair = { start: pA, end: pC };
      }
    }
  }
  return bestPair;
}