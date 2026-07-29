import { dom } from './dom.js';
import state from './state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SIDES = ['top', 'right', 'bottom', 'left'];

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderAll() {
  renderNodeList();
  renderInspector();
  renderCanvas();
}

/**
 * Lista de nodos del panel izquierdo.
 * Compatible con el handler:
 *   dom.nodeList.addEventListener('click', ... [data-select-node] ...)
 */
export function renderNodeList() {
  const term = state.searchTerm;
  const nodes = state.nodes.filter(node => {
    if (!term) return true;
    return [node.name, node.title, node.area].some(v =>
      String(v || '').toLowerCase().includes(term)
    );
  });

  dom.nodeList.innerHTML = nodes
    .map(
      node => `
      <button
        class="node-list-item ${node.id === state.selectedNodeId ? 'active' : ''}"
        type="button"
        data-select-node="${esc(node.id)}"
      >
        <strong>${esc(node.name || 'Sin nombre')}</strong>
        <span>${esc(node.title || 'Sin cargo')}</span>
        <small>${esc(node.area || '')}</small>
      </button>
    `
    )
    .join('');

  if (dom.statsGrid) {
    const totalNodes = state.nodes.length;
    const totalLinks = state.links.length;

    dom.statsGrid.innerHTML = `
      <div class="stat-card">
        <span>Nodos</span>
        <strong>${totalNodes}</strong>
      </div>
      <div class="stat-card">
        <span>Conexiones</span>
        <strong>${totalLinks}</strong>
      </div>
    `;
  }
}

/**
 * Panel de inspector (lado derecho).
 * Compatible con handlers de events.js:
 *  - click: [data-select-link], [data-link-action], [data-inspector-action]
 *  - input: data-link-field, data-node-field
 */
export function renderInspector() {
  const container = dom.inspectorContent;

  if (!state.selectedNodeId && !state.selectedLinkId) {
    container.innerHTML = `
      <p class="empty">
        Selecciona un nodo o un conector para editarlo.
      </p>
    `;
    return;
  }

  // Inspector de conector
  if (state.selectedLinkId) {
    const link = state.links.find(item => item.id === state.selectedLinkId);
    if (!link) {
      container.innerHTML = `<p class="empty">Conector no encontrado.</p>`;
      return;
    }

    container.innerHTML = `
      <section class="inspector-fields">
        <h3>Conector seleccionado</h3>

        <p>
          <strong>Salida:</strong> ${esc(link.fromSide || 'auto')} ·
          <strong>Entrada:</strong> ${esc(link.toSide || 'auto')}
        </p>

        <p class="empty">
          Arrastra los puntos verdes de los extremos o los puntos azules
          del centro de cada tramo para editar la ruta.
        </p>

        <label>
          <span>Grosor (px)</span>
          <input
            type="number"
            min="1"
            step="1"
            value="${link.thickness ?? 2}"
            data-link-field="thickness"
          >
        </label>

        <label>
          <span>Color</span>
          <input
            type="color"
            value="${esc(link.color || '#111827')}"
            data-link-field="color"
          >
        </label>

        <div class="inspector-actions">
          <button
            type="button"
            data-link-action="reset-points"
          >
            Restablecer ruta
          </button>
          <button
            type="button"
            class="danger"
            data-link-action="remove"
          >
            Eliminar conector
          </button>
        </div>
      </section>
    `;
    return;
  }

  // Inspector de nodo
  const node = state.nodes.find(n => n.id === state.selectedNodeId);
  if (!node) {
    container.innerHTML = `<p class="empty">Nodo no encontrado.</p>`;
    return;
  }

  container.innerHTML = `
    <section class="inspector-fields">
      <h3>Nodo seleccionado</h3>

      <label>
        <span>Nombre</span>
        <input
          type="text"
          value="${esc(node.name || '')}"
          data-node-field="name"
        >
      </label>

      <label>
        <span>Cargo</span>
        <input
          type="text"
          value="${esc(node.title || '')}"
          data-node-field="title"
        >
      </label>

      <label>
        <span>Área</span>
        <input
          type="text"
          value="${esc(node.area || '')}"
          data-node-field="area"
        >
      </label>

      <label>
        <span>Email</span>
        <input
          type="email"
          value="${esc(node.email || '')}"
          data-node-field="email"
        >
      </label>

      <label>
        <span>Teléfono</span>
        <input
          type="text"
          value="${esc(node.phone || '')}"
          data-node-field="phone"
        >
      </label>

      <label>
        <span>Ancho</span>
        <input
          type="number"
          min="120"
          step="10"
          value="${node.width}"
          data-node-field="width"
        >
      </label>

      <label>
        <span>Alto</span>
        <input
          type="number"
          min="80"
          step="10"
          value="${node.height}"
          data-node-field="height"
        >
      </label>

      <div class="inspector-actions">
        <button
          type="button"
          data-inspector-action="add-child"
        >
          Agregar hijo
        </button>
        <button
          type="button"
          data-inspector-action="duplicate"
        >
          Duplicar
        </button>
        <button
          type="button"
          class="danger"
          data-inspector-action="remove"
        >
          Eliminar nodo
        </button>
      </div>
    </section>
  `;
}

/**
 * Canvas central: nodos + conectores.
 * Compatible con events.js:
 *  - .chart-node, .node-port, [data-resize-handle], [data-node-action]
 */
export function renderCanvas() {
  const stage = dom.chartStage;
  if (!stage) return;

  // Nodos
  stage.innerHTML = '';

  for (const node of state.nodes) {
    const el = document.createElement('div');
    el.className = 'chart-node';
    el.dataset.id = node.id;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.width}px`;
    el.style.minHeight = `${node.height}px`;

    if (node.id === state.selectedNodeId) {
      el.classList.add('selected');
    }

    el.innerHTML = `
      <div class="node-head">
        <div>
          <h3>${esc(node.name || 'Sin nombre')}</h3>
          <p>${esc(node.title || 'Sin cargo')}</p>
          <small>${esc(node.area || '')}</small>
        </div>
        <div class="node-actions">
          <button
            type="button"
            data-node-action="add-child"
            data-id="${esc(node.id)}"
          >
            +
          </button>
          <button
            type="button"
            data-node-action="toggle"
            data-id="${esc(node.id)}"
          >
            ${node.collapsed ? '↕' : '↧'}
          </button>
        </div>
      </div>

      <div class="resize-handle" data-resize-handle="bottom-right"></div>

      <!-- Puertos en cada lado -->
      <div
        class="node-port node-port-top"
        data-node-id="${esc(node.id)}"
        data-port="top"
      ></div>
      <div
        class="node-port node-port-bottom"
        data-node-id="${esc(node.id)}"
        data-port="bottom"
      ></div>
      <div
        class="node-port node-port-left"
        data-node-id="${esc(node.id)}"
        data-port="left"
      ></div>
      <div
        class="node-port node-port-right"
        data-node-id="${esc(node.id)}"
        data-port="right"
      ></div>
    `;

    stage.appendChild(el);
  }

  // Conectores
  drawConnectors();
}

/**
 * Transformación de zoom/pan del stage.
 * events.js usa applyStageTransform() desde applyView().
 */
export function applyStageTransform() {
  const { x, y, scale } = state.view;
  dom.chartStage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  dom.chartStage.style.transformOrigin = '0 0';
}

/**
 * Punto de puerto para un nodo y lado.
 */
export function portPoint(node, side) {
  const x = node.x;
  const y = node.y;
  const w = node.width;
  const h = node.height;

  switch (side) {
    case 'top':
      return { x: x + w / 2, y: y };
    case 'bottom':
      return { x: x + w / 2, y: y + h };
    case 'left':
      return { x: x, y: y + h / 2 };
    case 'right':
    default:
      return { x: x + w, y: y + h / 2 };
  }
}

/**
 * Encuentra el lado cuyo puerto está más cerca de un punto.
 */
export function nearestPortSide(node, point) {
  let bestSide = 'right';
  let bestDist = Infinity;

  for (const side of SIDES) {
    const p = portPoint(node, side);
    const dx = p.x - point.x;
    const dy = p.y - point.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestSide = side;
    }
  }

  return bestSide;
}

/**
 * Construye una ruta ortogonal editable (L/Z) entre dos nodos.
 * Se usa cuando:
 *  - se crea un nuevo link,
 *  - se mueve un extremo con edgeDragState.
 */
export function ensureEditableLink(link, fromNode, toNode) {
  const fromSide = link.fromSide || 'right';
  const toSide = link.toSide || 'left';

  const start = portPoint(fromNode, fromSide);
  const end = portPoint(toNode, toSide);

  const points = [];

  // inicio
  points.push({ x: start.x, y: start.y });

  // punto medio horizontal para el primer tramo
  const midX = (start.x + end.x) / 2;

  // tramo 1: horizontal
  points.push({ x: midX, y: start.y });

  // tramo 2: vertical
  points.push({ x: midX, y: end.y });

  // tramo 3: horizontal hasta el final
  points.push({ x: end.x, y: end.y });

  link.points = points;
}

/**
 * Dibuja conectores y handles:
 *  - extremos: edge-handle (verde)
 *  - tramos: segment-handle (azul), centrados en cada segmento recto.
 *
 * events.js:
 *  - mueve extremos con edgeDragState + nearestPortSide + ensureEditableLink
 *  - mueve tramos con segmentDragState actualizando link.points[i] e i+1
 */
export function drawConnectors() {
  let svg = dom.chartStage.querySelector('#connectorsLayer');
  if (!svg) {
    svg = document.createElementNS(SVG_NS, 'svg');
    svg.id = 'connectorsLayer';
    svg.setAttribute('class', 'connectors-layer');
    svg.setAttribute('width', '4000');
    svg.setAttribute('height', '2400');
    dom.chartStage.appendChild(svg);
  }

  svg.innerHTML = '';

  for (const link of state.links) {
    if (!Array.isArray(link.points) || link.points.length < 2) continue;

    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('data-link-id', link.id);

    // Path principal
    const path = document.createElementNS(SVG_NS, 'path');
    const d = link.points
      .map((p, index) =>
        index === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
      )
      .join(' ');
    path.setAttribute('d', d);
    path.setAttribute('stroke', link.color || '#111827');
    path.setAttribute('stroke-width', link.thickness || 2);
    path.setAttribute('fill', 'none');
    path.setAttribute('class', 'manual-link manual-link-hit');
    path.setAttribute('data-link-id', link.id);

    group.appendChild(path);

    // Extremos (from / to)
    const start = link.points[0];
    const end = link.points[link.points.length - 1];

    const startRing = document.createElementNS(SVG_NS, 'circle');
    startRing.setAttribute('cx', start.x);
    startRing.setAttribute('cy', start.y);
    startRing.setAttribute('r', 14);
    startRing.setAttribute('class', 'edge-handle-ring');
    group.appendChild(startRing);

    const startHandle = document.createElementNS(SVG_NS, 'circle');
    startHandle.setAttribute('cx', start.x);
    startHandle.setAttribute('cy', start.y);
    startHandle.setAttribute('r', 7);
    startHandle.setAttribute('class', 'edge-handle');
    startHandle.dataset.linkId = link.id;
    startHandle.dataset.edge = 'from';
    group.appendChild(startHandle);

    const endRing = document.createElementNS(SVG_NS, 'circle');
    endRing.setAttribute('cx', end.x);
    endRing.setAttribute('cy', end.y);
    endRing.setAttribute('r', 14);
    endRing.setAttribute('class', 'edge-handle-ring');
    group.appendChild(endRing);

    const endHandle = document.createElementNS(SVG_NS, 'circle');
    endHandle.setAttribute('cx', end.x);
    endHandle.setAttribute('cy', end.y);
    endHandle.setAttribute('r', 7);
    endHandle.setAttribute('class', 'edge-handle');
    endHandle.dataset.linkId = link.id;
    endHandle.dataset.edge = 'to';
    group.appendChild(endHandle);

    // Handles de tramo centrados en cada segmento recto
    for (let i = 0; i < link.points.length - 1; i++) {
      const a = link.points[i];
      const b = link.points[i + 1];

      const isHorizontal = Math.abs(a.y - b.y) < 0.5;
      const isVertical = Math.abs(a.x - b.x) < 0.5;
      if (!isHorizontal && !isVertical) continue;

      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;

      const ring = document.createElementNS(SVG_NS, 'circle');
      ring.setAttribute('cx', midX);
      ring.setAttribute('cy', midY);
      ring.setAttribute('r', 10);
      ring.setAttribute('class', 'segment-ring');
      group.appendChild(ring);

      const handle = document.createElementNS(SVG_NS, 'circle');
      handle.setAttribute('cx', midX);
      handle.setAttribute('cy', midY);
      handle.setAttribute('r', 6);
      handle.setAttribute(
        'class',
        `segment-handle ${isHorizontal ? 'segment-h' : 'segment-v'}`
      );
      handle.dataset.linkId = link.id;
      handle.dataset.segIndex = String(i);
      group.appendChild(handle);
    }

    svg.appendChild(group);
  }
}