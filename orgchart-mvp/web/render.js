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
    return String(node.name || '')
      .toLowerCase()
      .includes(term);
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
        <span>Empleados (opcional)</span>
        <textarea
          rows="3"
          data-node-field="employees"
          placeholder="Nombres de los empleados en este puesto..."
        >${esc(node.employees || '')}</textarea>
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

      <label>
        <span>Rotación (°)</span>
        <input
          type="number"
          step="5"
          value="${node.rotation || 0}"
          data-node-field="rotation"
        >
      </label>

      <label>
        <span>Color de Fondo y Opacidad</span>
        <div class="flex gap-2">
          <input
            type="color"
            value="${esc(node.bgColor || '#ffffff')}"
            data-node-field="bgColor"
            class="h-8 w-1/2 p-0 border-0 rounded cursor-pointer bg-transparent"
          >
          <select data-node-field="bgOpacity" class="w-1/2">
            <option value="1" ${(!node.bgOpacity || node.bgOpacity === '1') ? 'selected' : ''}>Sólido</option>
            <option value="0.75" ${node.bgOpacity === '0.75' ? 'selected' : ''}>Transparente (75%)</option>
            <option value="0.5" ${node.bgOpacity === '0.5' ? 'selected' : ''}>Cristal (50%)</option>
            <option value="0" ${node.bgOpacity === '0' ? 'selected' : ''}>Oculto (0%)</option>
          </select>
        </div>
      </label>

      <label>
        <span>Diseño del Nodo</span>
        <select data-node-field="style">
          <option value="classic" ${!node.style || node.style === 'classic' ? 'selected' : ''}>Rectángulo</option>
          <option value="circle" ${node.style === 'circle' ? 'selected' : ''}>Círculo</option>
          <option value="triangle" ${node.style === 'triangle' ? 'selected' : ''}>Triángulo</option>
          <option value="rhombus" ${node.style === 'rhombus' ? 'selected' : ''}>Rombo</option>
          <option value="hexagon" ${node.style === 'hexagon' ? 'selected' : ''}>Hexágono</option>
          <option value="default" ${node.style === 'default' ? 'selected' : ''}>Moderno</option>
          <option value="lined" ${node.style === 'lined' ? 'selected' : ''}>Clásico (Líneas)</option>
        </select>
      </label>

      <div class="inspector-section">
        <span>Estilo de Texto</span>
        <div class="button-group">
          <button
            type="button"
            class="style-btn ${!node.textAlign || node.textAlign === 'left' ? 'active' : ''}"
            data-text-style="textAlign"
            data-value="left"
            title="Alinear a la izquierda"
          >Izquierda</button>
          <button
            type="button"
            class="style-btn ${node.textAlign === 'center' ? 'active' : ''}"
            data-text-style="textAlign"
            data-value="center"
            title="Centrar"
          >Centro</button>
          <button
            type="button"
            class="style-btn ${node.textAlign === 'right' ? 'active' : ''}"
            data-text-style="textAlign"
            data-value="right"
            title="Alinear a la derecha"
          >Derecha</button>
        </div>
        <div class="button-group">
          <button type="button" class="style-btn ${node.fontWeight === 'bold' ? 'active' : ''}" data-text-style="fontWeight" data-value="bold" title="Negrita"><b>B</b></button>
          <button type="button" class="style-btn ${node.fontStyle === 'italic' ? 'active' : ''}" data-text-style="fontStyle" data-value="italic" title="Cursiva"><i>I</i></button>
          <button type="button" class="style-btn ${node.textDecoration === 'underline' ? 'active' : ''}" data-text-style="textDecoration" data-value="underline" title="Subrayado"><u>U</u></button>
        </div>
      </div>

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

  // --- Nodos ---
  // Mantiene un registro de los nodos existentes para evitar recrear el DOM
  const existingNodeEls = new Map();
  stage.querySelectorAll('.chart-node').forEach(el => {
    existingNodeEls.set(el.dataset.id, el);
  });

  const renderedNodeIds = new Set();

  // Actualiza o crea nodos
  for (const node of state.nodes) {
    renderedNodeIds.add(node.id);
    let el = existingNodeEls.get(node.id);

    if (!el) {
      // El nodo no existe en el DOM, lo crea
      el = document.createElement('div');
      el.className = 'chart-node';
      el.dataset.id = node.id;
      stage.appendChild(el);
    }

    // Actualiza propiedades
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.width}px`;
    el.style.minHeight = `${node.height}px`;
    el.style.transform = `rotate(${node.rotation || 0}deg)`;

    // Estilos de texto
    const textAlign = node.textAlign || 'left';
    el.classList.remove('text-align-left', 'text-align-center', 'text-align-right');
    el.classList.add(`text-align-${textAlign}`);

    el.classList.toggle('font-weight-bold', node.fontWeight === 'bold');
    el.classList.toggle('font-style-italic', node.fontStyle === 'italic');
    el.classList.toggle('text-decoration-underline', node.textDecoration === 'underline');

    if (node.color) {
      el.style.setProperty('--node-bg-color', node.color);
      // Lógica de contraste simple para el color del texto
      const hex = node.color.replace('#', '');
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        el.style.setProperty('--node-text-color', yiq < 128 ? '#ffffff' : 'var(--text)');
      }
      el.classList.add('has-custom-color');
    } else {
      el.style.removeProperty('--node-bg-color');
      el.style.removeProperty('--node-text-color');
      el.classList.remove('has-custom-color');
    }


    // Efectos de color de fondo y opacidad
    const bgColor = node.bgColor || 'var(--surface)';
    const bgOpacity = node.bgOpacity !== undefined ? parseFloat(node.bgOpacity) : 1.0;

    if (bgColor.startsWith('var')) {
       el.style.backgroundColor = bgColor;
       el.style.opacity = bgOpacity;
       el.style.color = 'var(--text)'; // Default
    } else {
       el.style.backgroundColor = bgColor;

       if (bgOpacity < 1) {
           el.style.backgroundColor = `${bgColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`;
           if (bgOpacity > 0 && bgOpacity < 1) {
               el.style.backdropFilter = 'blur(8px)';
           } else {
               el.style.backdropFilter = 'none';
           }
       } else {
           el.style.backdropFilter = 'none';
       }

       // Simple contrast detection for text
       const hex = bgColor.replace('#', '');
       const r = parseInt(hex.substr(0, 2), 16) || 255;
       const g = parseInt(hex.substr(2, 2), 16) || 255;
       const b = parseInt(hex.substr(4, 2), 16) || 255;
       const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

       // Apply only if opacity is high enough to affect legibility significantly
       if (bgOpacity > 0.4) {
           el.style.color = (yiq >= 128) ? '#0f172a' : '#f8fafc';
       } else {
           el.style.color = 'var(--text)';
       }
    }

    const nodeStyle = node.style || 'classic'; // default, classic, lined
    el.classList.toggle('node-style-default', nodeStyle === 'default');
    el.classList.toggle('node-style-classic', nodeStyle === 'classic');
    el.classList.toggle('node-style-lined', nodeStyle === 'lined');
    el.classList.toggle('node-style-circle', nodeStyle === 'circle');
    el.classList.toggle('node-style-triangle', nodeStyle === 'triangle');
    el.classList.toggle('node-style-rhombus', nodeStyle === 'rhombus');
    el.classList.toggle('node-style-hexagon', nodeStyle === 'hexagon');

    el.classList.toggle('selected', node.id === state.selectedNodeId);

    // Actualiza contenido interno (se puede optimizar aún más si es necesario)
    el.innerHTML = `
      <div class="node-head">
        <div class="node-content">
          <h3>${esc(node.name || 'Sin nombre')}</h3>
        </div>
        <div class="node-actions">
          <button
            type="button"
            data-node-action="add-child"
            data-id="${esc(node.id)}"
          >
            +
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
  }

  // Elimina nodos que ya no están en el estado
  for (const [id, el] of existingNodeEls.entries()) {
    if (!renderedNodeIds.has(id)) {
      el.remove();
    }
  }

  // --- Conectores ---
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
  const angle = (node.rotation || 0) * Math.PI / 180;

  // Center of rotation
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;

  // Port position relative to center, before rotation
  let relX, relY;
  switch (side) {
    case 'top':
      relX = 0;
      relY = -node.height / 2;
      break;
    case 'bottom':
      relX = 0;
      relY = node.height / 2;
      break;
    case 'left':
      relX = -node.width / 2;
      relY = 0;
      break;
    case 'right':
    default:
      relX = node.width / 2;
      relY = 0;
      break;
  }

  // Apply rotation
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotX = relX * cos - relY * sin;
  const rotY = relX * sin + relY * cos;

  // Final absolute position
  return { x: cx + rotX, y: cy + rotY };
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