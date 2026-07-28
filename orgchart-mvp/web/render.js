import { dom, getCanvasCreateRootBtn } from './dom.js';
import { state, getNode, getRoots, getChildren, getLevel, getMaxDepth, getAvailableParents, addNode } from './state.js';
import { NODE_DIMS } from './config.js';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

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
    <div class="stat-card"><span class="stat-label">Conexiones</span><div class="stat-value">${state.links.length}</div></div>
    <div class="stat-card"><span class="stat-label">Niveles</span><div class="stat-value">${getMaxDepth()}</div></div>
    <div class="stat-card"><span class="stat-label">Actualización</span><div class="stat-value" style="font-size:14px;line-height:1.35;">${escapeHtml(updated)}</div></div>
  `;
}

export function renderNodeList() {
  const filtered = state.nodes.filter(node => {
    if (!state.searchTerm) return true;
    const target = `${node.name} ${node.title} ${node.area} ${node.email} ${node.phone}`.toLowerCase();
    return target.includes(state.searchTerm);
  });

  if (!filtered.length) {
    dom.nodeList.innerHTML = `
      <div class="empty-card">
        <div class="mini-chip">Sin coincidencias</div>
        <h3>No se encontraron nodos</h3>
        <p>Ajusta tu búsqueda o crea un nuevo bloque dentro de la estructura.</p>
      </div>
    `;
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
    dom.inspectorContent.innerHTML = `
      <div class="empty-card">
        <div class="mini-chip">Inspector</div>
        <h3>Selecciona un nodo</h3>
        <p>Haz clic sobre un bloque en el lienzo o desde la lista lateral para editar su información.</p>
      </div>
    `;
    return;
  }

  const parentOptions = getAvailableParents(node.id)
    .map(option => `<option value="${option.id}" ${option.id === node.parentId ? 'selected' : ''}>${escapeHtml(option.name || option.title || option.id)}</option>`)
    .join('');

  const nodeLinks = state.links.filter(link => link.fromId === node.id || link.toId === node.id);

  dom.inspectorContent.innerHTML = `
    <div class="inspector-card">
      <div class="inspector-title">
        <div>
          <h3>${escapeHtml(node.name || 'Sin nombre')}</h3>
          <p class="node-subline">${escapeHtml(node.title || 'Sin cargo')}</p>
        </div>
        <span class="mini-chip">${getChildren(node.id).length} hijo(s)</span>
      </div>
      <div class="inspector-meta">
        <span class="mini-chip">Nivel ${getLevel(node.id) + 1}</span>
        <span class="mini-chip">${node.parentId ? 'Con dependencia' : 'Nodo raíz'}</span>
        <span class="mini-chip">${Math.round(node.width)}×${Math.round(node.height)} px</span>
      </div>
    </div>

    <div class="inspector-card">
      <div class="inspector-grid">
        <div class="full"><label class="form-label">Nombre</label><input data-node-field="name" value="${escapeHtml(node.name)}" /></div>
        <div class="full"><label class="form-label">Cargo</label><input data-node-field="title" value="${escapeHtml(node.title)}" /></div>
        <div><label class="form-label">Área</label><input data-node-field="area" value="${escapeHtml(node.area)}" /></div>
        <div><label class="form-label">Jefe</label>
          <select data-node-field="parentId"><option value="">Sin jefe</option>${parentOptions}</select>
        </div>
        <div><label class="form-label">Correo</label><input data-node-field="email" value="${escapeHtml(node.email)}" /></div>
        <div><label class="form-label">Teléfono</label><input data-node-field="phone" value="${escapeHtml(node.phone)}" /></div>
        <div><label class="form-label">Ancho (px)</label><input type="number" min="220" max="560" step="10" data-node-field="width" value="${Math.round(node.width)}" /></div>
        <div><label class="form-label">Alto (px)</label><input type="number" min="120" max="420" step="10" data-node-field="height" value="${Math.round(node.height)}" /></div>
        <div class="full"><label class="form-label">Rotación</label><input type="number" min="-45" max="45" step="1" data-node-field="rotation" value="${Number(node.rotation || 0)}" /></div>
      </div>
    </div>

    ${nodeLinks.length ? `
    <div class="inspector-card">
      <div class="panel-heading"><h2 style="font-size:14px;">Conexiones manuales</h2></div>
      <div class="link-list">
        ${nodeLinks.map(link => {
          const other = getNode(link.fromId === node.id ? link.toId : link.fromId);
          return `
            <div class="link-item">
              <span>↔ ${escapeHtml(other?.name || 'Nodo eliminado')}</span>
              <button class="btn btn-danger btn-small" data-remove-link="${link.id}">Quitar</button>
            </div>
          `;
        }).join('')}
      </div>
    </div>` : ''}

    <div class="inspector-card">
      <div class="inspector-actions">
        <button class="btn btn-secondary" data-inspector-action="add-child">Agregar hijo</button>
        <button class="btn btn-secondary" data-inspector-action="duplicate">Duplicar</button>
        <button class="btn btn-danger" data-inspector-action="remove">Eliminar</button>
      </div>
    </div>
  `;
}

export function renderCanvas() {
  if (!state.nodes.length) {
    dom.chartStage.innerHTML = `
      <div class="canvas-empty">
        <div class="canvas-empty-card">
          <div class="mini-chip">Editor listo</div>
          <h3>Crea tu primer nodo principal</h3>
          <p>Empieza con la dirección o presidencia de la organización y construye el organigrama desde ahí.</p>
          <div style="margin-top:18px;"><button class="btn btn-primary" id="canvasCreateRoot">Crear raíz</button></div>
        </div>
      </div>
    `;
    getCanvasCreateRootBtn()?.addEventListener('click', () => addNode(''));
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
  const isConnectSource = state.connectMode && state.connectSourceId === node.id;

  return `
    <div
      class="chart-node ${state.selectedNodeId === node.id ? 'selected' : ''} ${isRoot ? 'root-node' : ''} ${state.connectMode ? 'connect-mode' : ''} ${isConnectSource ? 'connect-source' : ''}"
      data-id="${node.id}"
      style="left:${node.x}px;top:${node.y}px;width:${node.width}px;min-height:${node.height}px;transform:rotate(${node.rotation || 0}deg);"
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
          <div class="node-meta">
            ${node.email ? `<span>${escapeHtml(node.email)}</span>` : ''}
            ${node.phone ? `<span>${escapeHtml(node.phone)}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="node-quickbar">
        <button class="node-quick" data-node-action="add-child" data-id="${node.id}" title="Agregar hijo">+</button>
        <button class="node-quick" data-node-action="toggle" data-id="${node.id}" title="Expandir o contraer">
          ${state.collapsed.has(node.id) ? '▸' : '▾'}
        </button>
      </div>

      <div class="resize-handle" data-resize-handle="${node.id}" title="Cambiar tamaño"></div>
    </div>
  `;
}

export function drawConnectors() {
  const svg = document.getElementById('connectorLayer');
  if (!svg) return;

  const treeLines = state.nodes.map(node => {
    if (!node.parentId) return '';
    const parent = getNode(node.parentId);
    if (!parent || state.collapsed.has(parent.id)) return '';

    const { start, end } = findOptimalConnectionPoints(parent, node);
    const pathD = getPathD(start, end, state.connectorType);
    return `<path class="tree-link" d="${pathD}" />`;
  }).join('');

  const manualLines = state.links.map(link => {
    const from = getNode(link.fromId);
    const to = getNode(link.toId);
    if (!from || !to) return '';

    const { start, end } = findOptimalConnectionPoints(from, to);
    const pathD = getPathD(start, end, link.style === 'cable' ? 'curved' : 'straight');
    const dist = Math.hypot(end.x - start.x, end.y - start.y);

    return `<path
      class="manual-link"
      data-link-id="${link.id}"
      d="${pathD}"
      stroke="${link.color}"
      stroke-width="${link.thickness}"
      data-length="${dist.toFixed(1)}"
    />`;
  }).join('');

  svg.innerHTML = treeLines + manualLines;
}

function getPathD(start, end, mode) {
  if (mode === 'straight') {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (start.type === 'bottom' && end.type === 'top') {
    const c1y = start.y + dy * 0.6;
    const c2y = end.y - dy * 0.6;
    return `M ${start.x} ${start.y} C ${start.x} ${c1y}, ${end.x} ${c2y}, ${end.x} ${end.y}`;
  }

  if (start.type === 'right' && end.type === 'left') {
    const c1x = start.x + dx * 0.6;
    const c2x = end.x - dx * 0.6;
    return `M ${start.x} ${start.y} C ${c1x} ${start.y}, ${c2x} ${end.y}, ${end.x} ${end.y}`;
  }

  const midX = start.x + dx / 2;
  const midY = start.y + dy / 2;
  return `M ${start.x} ${start.y} Q ${midX} ${start.y}, ${midX} ${midY} T ${end.x} ${end.y}`;
}

function findOptimalConnectionPoints(fromNode, toNode) {
  const getAnchors = node => {
    const w = node.width || NODE_DIMS.width;
    const h = node.height || NODE_DIMS.height;
    const hw = w / 2;
    const hh = h / 2;

    return [
      { x: node.x + hw, y: node.y, type: 'top' },
      { x: node.x + w, y: node.y + hh, type: 'right' },
      { x: node.x + hw, y: node.y + h, type: 'bottom' },
      { x: node.x, y: node.y + hh, type: 'left' }
    ];
  };

  const fromAnchors = getAnchors(fromNode);
  const toAnchors = getAnchors(toNode);

  let minDistance = Infinity;
  let bestPair = { start: fromAnchors[2], end: toAnchors[0] };

  for (const a of fromAnchors) {
    for (const b of toAnchors) {
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (dist < minDistance) {
        minDistance = dist;
        bestPair = { start: a, end: b };
      }
    }
  }

  return bestPair;
}