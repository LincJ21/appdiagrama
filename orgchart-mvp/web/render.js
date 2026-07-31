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
  renderMiniMap();
  renderWelcomeScreen();
}

function renderWelcomeScreen() {
  const screen = dom.welcomeScreen;
  if (!screen) return;
  if (state.nodes.length === 0) {
    screen.style.display = 'flex';
  } else {
    screen.style.display = 'none';
  }
}

export function renderNodeList() {
  const term = state.searchTerm;
  const nodes = state.nodes.filter(node => {
    if (!term) return true;
    return String(node.name || '').toLowerCase().includes(term) ||
           String(node.employees || '').toLowerCase().includes(term);
  });

  dom.nodeList.innerHTML = nodes
    .map(
      node => `
      <button
        class="node-list-item ${node.id === state.selectedNodeId || state.multiSelectedNodeIds.includes(node.id) ? 'active' : ''}"
        type="button"
        data-select-node="${esc(node.id)}"
      >
        <strong>${esc(node.name || 'Sin nombre')}</strong>
        ${node.employees ? `<small>${esc(node.employees.substring(0, 40))}${node.employees.length > 40 ? '...' : ''}</small>` : ''}
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

export function renderInspector() {
  const container = dom.inspectorContent;

  if (!state.selectedNodeId && !state.selectedLinkId && state.multiSelectedNodeIds.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.042 21.672 13.684 28.5m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59"/></svg>
        <p>Selecciona un nodo o un conector para editarlo.</p>
        <p class="hint">Shift + clic para selección múltiple</p>
      </div>
    `;
    return;
  }

  // Multi-selection inspector
  if (state.multiSelectedNodeIds.length > 1) {
    container.innerHTML = `
      <section class="inspector-fields">
        <h3>${state.multiSelectedNodeIds.length} nodos seleccionados</h3>

        <div class="inspector-section">
          <span>Alinear</span>
          <div class="button-group">
            <button type="button" id="alignLeftBtn" title="Alinear izquierda"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h12M3 18h15"/></svg></button>
            <button type="button" id="alignCenterBtn" title="Alinear centro"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12M4 18h16"/></svg></button>
            <button type="button" id="alignRightBtn" title="Alinear derecha"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M9 12h12M6 18h15"/></svg></button>
          </div>
          <div class="button-group">
            <button type="button" id="alignTopBtn" title="Alinear arriba"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v18M12 3v12M18 3v15"/></svg></button>
            <button type="button" id="alignMiddleBtn" title="Alinear medio"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v18M12 8v8M18 5v14"/></svg></button>
            <button type="button" id="alignBottomBtn" title="Alinear abajo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v18M12 9v12M18 6v15"/></svg></button>
          </div>
        </div>

        <div class="inspector-section">
          <span>Distribuir</span>
          <div class="button-group">
            <button type="button" id="distributeHBtn" title="Distribuir horizontalmente"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h2v12H4zm7 3h2v6h-2zm7-5h2v16h-2z"/></svg> H</button>
            <button type="button" id="distributeVBtn" title="Distribuir verticalmente"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h12v2H6zm3 7h6v2H9zm-2 7h10v2H7z"/></svg> V</button>
          </div>
        </div>

        <div class="inspector-actions">
          <button type="button" class="danger" data-inspector-action="remove-multi">
            Eliminar ${state.multiSelectedNodeIds.length} nodos
          </button>
        </div>
      </section>
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

        <p class="link-info">
          <span><strong>Salida:</strong> ${esc(link.fromSide || 'auto')}</span>
          <span><strong>Entrada:</strong> ${esc(link.toSide || 'auto')}</span>
        </p>

        <div class="tip-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg>
          <span>Arrastra los puntos verdes de los extremos o los puntos azules del centro de cada tramo para editar la ruta.</span>
        </div>

        <label>
          <span>Etiqueta</span>
          <input type="text" value="${esc(link.label || '')}" data-link-field="label" placeholder="Texto del conector...">
        </label>

        <label>
          <span>Grosor (px)</span>
          <input type="number" min="1" step="1" value="${link.thickness ?? 2}" data-link-field="thickness">
        </label>

        <label>
          <span>Color</span>
          <input type="color" value="${esc(link.color || '#111827')}" data-link-field="color">
        </label>

        <div class="inspector-actions">
          <button type="button" data-link-action="reset-points">Restablecer ruta</button>
          <button type="button" class="danger" data-link-action="remove">Eliminar conector</button>
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
      <h3>${esc(node.name || 'Nodo')}</h3>

      <label>
        <span>Nombre</span>
        <input type="text" value="${esc(node.name || '')}" data-node-field="name">
      </label>

      <label>
        <span>Empleados / Descripción</span>
        <textarea rows="3" data-node-field="employees" placeholder="Nombres de los empleados en este puesto...">${esc(node.employees || '')}</textarea>
      </label>

      <div class="flex gap-2">
        <label class="flex-1">
          <span>Ancho</span>
          <input type="number" min="120" step="10" value="${node.width}" data-node-field="width">
        </label>
        <label class="flex-1">
          <span>Alto</span>
          <input type="number" min="80" step="10" value="${node.height}" data-node-field="height">
        </label>
      </div>

      <label>
        <span>Rotación (°)</span>
        <input type="range" min="-180" max="180" step="5" value="${node.rotation || 0}" data-node-field="rotation" oninput="this.nextElementSibling.value = this.value + '°'">
        <output class="text-xs text-muted">${node.rotation || 0}°</output>
      </label>

      <label>
        <span>Color de Fondo</span>
        <div class="flex gap-2 items-center">
          <input type="color" value="${esc(node.bgColor || '#ffffff')}" data-node-field="bgColor" class="h-10 w-16 p-0 border-0 rounded cursor-pointer">
          <button type="button" class="text-xs px-2 py-1" data-inspector-action="clear-color">Quitar</button>
        </div>
      </label>

      <label>
        <span>Opacidad</span>
        <select data-node-field="bgOpacity">
          <option value="1" ${(!node.bgOpacity || node.bgOpacity === '1') ? 'selected' : ''}>Sólido</option>
          <option value="0.75" ${node.bgOpacity === '0.75' ? 'selected' : ''}>Transparente (75%)</option>
          <option value="0.5" ${node.bgOpacity === '0.5' ? 'selected' : ''}>Cristal (50%)</option>
          <option value="0" ${node.bgOpacity === '0' ? 'selected' : ''}>Oculto (0%)</option>
        </select>
      </label>

      <label>
        <span>Forma del Nodo</span>
        <select data-node-field="style">
          <option value="classic" ${!node.style || node.style === 'classic' ? 'selected' : ''}>Rectángulo</option>
          <option value="rounded" ${node.style === 'rounded' ? 'selected' : ''}>Redondeado</option>
          <option value="circle" ${node.style === 'circle' ? 'selected' : ''}>Círculo</option>
          <option value="pill" ${node.style === 'pill' ? 'selected' : ''}>Píldora</option>
          <option value="triangle" ${node.style === 'triangle' ? 'selected' : ''}>Triángulo</option>
          <option value="rhombus" ${node.style === 'rhombus' ? 'selected' : ''}>Rombo</option>
          <option value="hexagon" ${node.style === 'hexagon' ? 'selected' : ''}>Hexágono</option>
          <option value="lined" ${node.style === 'lined' ? 'selected' : ''}>Clásico (Líneas)</option>
        </select>
      </label>

      <div class="inspector-section">
        <span>Estilo de Texto</span>
        <div class="button-group">
          <button type="button" class="style-btn ${!node.textAlign || node.textAlign === 'left' ? 'active' : ''}" data-text-style="textAlign" data-value="left" title="Alinear a la izquierda">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h10M3 18h14"/></svg>
          </button>
          <button type="button" class="style-btn ${node.textAlign === 'center' ? 'active' : ''}" data-text-style="textAlign" data-value="center" title="Centrar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12M4 18h16"/></svg>
          </button>
          <button type="button" class="style-btn ${node.textAlign === 'right' ? 'active' : ''}" data-text-style="textAlign" data-value="right" title="Alinear a la derecha">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M11 12h10M7 18h14"/></svg>
          </button>
        </div>
        <div class="button-group">
          <button type="button" class="style-btn ${node.fontWeight === 'bold' ? 'active' : ''}" data-text-style="fontWeight" data-value="bold" title="Negrita"><b>B</b></button>
          <button type="button" class="style-btn ${node.fontStyle === 'italic' ? 'active' : ''}" data-text-style="fontStyle" data-value="italic" title="Cursiva"><i>I</i></button>
          <button type="button" class="style-btn ${node.textDecoration === 'underline' ? 'active' : ''}" data-text-style="textDecoration" data-value="underline" title="Subrayado"><u>U</u></button>
        </div>
      </div>

      <div class="inspector-actions">
        <button type="button" data-inspector-action="add-child">Agregar hijo</button>
        <button type="button" data-inspector-action="duplicate">Duplicar</button>
        <button type="button" class="danger" data-inspector-action="remove">Eliminar nodo</button>
      </div>
    </section>
  `;
}

export function renderCanvas() {
  const stage = dom.chartStage;
  if (!stage) return;

  // Grid
  renderGrid();

  // Selection box
  renderSelectionBox();

  // Nodos - diffing básico
  const existingNodeEls = new Map();
  stage.querySelectorAll('.chart-node').forEach(el => {
    existingNodeEls.set(el.dataset.id, el);
  });

  const renderedNodeIds = new Set();

  for (const node of state.nodes) {
    renderedNodeIds.add(node.id);
    let el = existingNodeEls.get(node.id);

    if (!el) {
      el = document.createElement('div');
      el.className = 'chart-node';
      el.dataset.id = node.id;
      stage.appendChild(el);
    }

    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.width}px`;
    el.style.minHeight = `${node.height}px`;
    el.style.transform = `rotate(${node.rotation || 0}deg)`;

    const textAlign = node.textAlign || 'left';
    el.classList.remove('text-align-left', 'text-align-center', 'text-align-right');
    el.classList.add(`text-align-${textAlign}`);

    el.classList.toggle('font-weight-bold', node.fontWeight === 'bold');
    el.classList.toggle('font-style-italic', node.fontStyle === 'italic');
    el.classList.toggle('text-decoration-underline', node.textDecoration === 'underline');

    // Background & opacity
    const bgOpacity = node.bgOpacity !== undefined ? parseFloat(node.bgOpacity) : 1.0;
    if (node.bgColor && node.bgColor !== 'var(--surface)') {
      const hex = node.bgColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) || 255;
      const g = parseInt(hex.substr(2, 2), 16) || 255;
      const b = parseInt(hex.substr(4, 2), 16) || 255;
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

      if (bgOpacity < 1) {
        const alpha = Math.round(bgOpacity * 255).toString(16).padStart(2, '0');
        el.style.backgroundColor = `${node.bgColor}${alpha}`;
        el.style.backdropFilter = bgOpacity > 0 ? 'blur(8px)' : 'none';
      } else {
        el.style.backgroundColor = node.bgColor;
        el.style.backdropFilter = 'none';
      }
      el.style.color = (yiq >= 128) ? '#0f172a' : '#f8fafc';
      el.classList.add('has-custom-color');
    } else {
      el.style.backgroundColor = '';
      el.style.backdropFilter = '';
      el.style.color = '';
      el.classList.remove('has-custom-color');
    }

    const nodeStyle = node.style || 'classic';
    const styleClasses = [
      'node-style-classic', 'node-style-rounded', 'node-style-circle',
      'node-style-pill', 'node-style-triangle', 'node-style-rhombus',
      'node-style-hexagon', 'node-style-lined'
    ];
    styleClasses.forEach(c => el.classList.remove(c));
    el.classList.add(`node-style-${nodeStyle}`);

    const isSelected = node.id === state.selectedNodeId || state.multiSelectedNodeIds.includes(node.id);
    el.classList.toggle('selected', isSelected);
    el.classList.toggle('multi-selected', state.multiSelectedNodeIds.includes(node.id) && node.id !== state.selectedNodeId);

    // Inner HTML
    const isEditing = el.dataset.editing === 'true';
    const nameContent = isEditing
      ? `<input type="text" class="inline-edit" value="${esc(node.name || '')}" />`
      : `<h3>${esc(node.name || 'Sin nombre')}</h3>`;

    el.innerHTML = `
      <div class="node-head">
        <div class="node-content">
          ${nameContent}
          ${node.employees ? `<p>${esc(node.employees)}</p>` : ''}
        </div>
        <div class="node-actions">
          <button type="button" data-node-action="add-child" data-id="${esc(node.id)}" title="Agregar hijo">+</button>
        </div>
      </div>
      <div class="resize-handle" data-resize-handle="bottom-right"></div>
      <div class="node-port node-port-top" data-node-id="${esc(node.id)}" data-port="top"></div>
      <div class="node-port node-port-bottom" data-node-id="${esc(node.id)}" data-port="bottom"></div>
      <div class="node-port node-port-left" data-node-id="${esc(node.id)}" data-port="left"></div>
      <div class="node-port node-port-right" data-node-id="${esc(node.id)}" data-port="right"></div>
    `;
  }

  for (const [id, el] of existingNodeEls.entries()) {
    if (!renderedNodeIds.has(id)) {
      el.remove();
    }
  }

  drawConnectors();
}

function renderGrid() {
  let grid = dom.chartStage.querySelector('#gridLayer');
  if (!grid) {
    grid = document.createElement('div');
    grid.id = 'gridLayer';
    grid.className = 'grid-layer';
    dom.chartStage.insertBefore(grid, dom.chartStage.firstChild);
  }

  if (!state.showGrid) {
    grid.style.display = 'none';
    dom.canvasViewport.style.backgroundImage = 'none';
    return;
  }

  grid.style.display = 'block';
  const size = state.gridSize || 20;
  dom.canvasViewport.style.backgroundSize = `${size}px ${size}px`;
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

export function applyStageTransform() {
  const { x, y, scale } = state.view;
  dom.chartStage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  dom.chartStage.style.transformOrigin = '0 0';
}

export function portPoint(node, side) {
  const angle = (node.rotation || 0) * Math.PI / 180;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;

  let relX, relY;
  switch (side) {
    case 'top': relX = 0; relY = -node.height / 2; break;
    case 'bottom': relX = 0; relY = node.height / 2; break;
    case 'left': relX = -node.width / 2; relY = 0; break;
    case 'right': default: relX = node.width / 2; relY = 0; break;
  }

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotX = relX * cos - relY * sin;
  const rotY = relX * sin + relY * cos;

  return { x: cx + rotX, y: cy + rotY };
}

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

export function ensureEditableLink(link, fromNode, toNode) {
  const fromSide = link.fromSide || 'right';
  const toSide = link.toSide || 'left';

  const start = portPoint(fromNode, fromSide);
  const end = portPoint(toNode, toSide);

  const points = [];
  points.push({ x: start.x, y: start.y });

  const midX = (start.x + end.x) / 2;
  points.push({ x: midX, y: start.y });
  points.push({ x: midX, y: end.y });
  points.push({ x: end.x, y: end.y });

  link.points = points;
}

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

  // Defs for arrow markers
  const defs = document.createElementNS(SVG_NS, 'defs');
  const marker = document.createElementNS(SVG_NS, 'marker');
  marker.setAttribute('id', 'arrowhead');
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '3.5');
  marker.setAttribute('orient', 'auto');
  const polygon = document.createElementNS(SVG_NS, 'polygon');
  polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
  polygon.setAttribute('fill', '#111827');
  marker.appendChild(polygon);
  defs.appendChild(marker);
  svg.appendChild(defs);

  for (const link of state.links) {
    if (!Array.isArray(link.points) || link.points.length < 2) continue;

    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('data-link-id', link.id);
    group.classList.toggle('selected-link', link.id === state.selectedLinkId);

    // Path principal
    const path = document.createElementNS(SVG_NS, 'path');
    const d = link.points
      .map((p, index) => index === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)
      .join(' ');
    path.setAttribute('d', d);
    path.setAttribute('stroke', link.color || '#111827');
    path.setAttribute('stroke-width', link.thickness || 2);
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    path.setAttribute('class', 'manual-link manual-link-hit');
    path.setAttribute('data-link-id', link.id);

    group.appendChild(path);

    // Label
    if (link.label) {
      const midIndex = Math.floor(link.points.length / 2);
      const midPoint = link.points[midIndex];
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', midPoint.x);
      text.setAttribute('y', midPoint.y - 8);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'link-label');
      text.textContent = link.label;
      group.appendChild(text);

      const bg = document.createElementNS(SVG_NS, 'rect');
      const bboxWidth = link.label.length * 7 + 8;
      bg.setAttribute('x', midPoint.x - bboxWidth / 2);
      bg.setAttribute('y', midPoint.y - 22);
      bg.setAttribute('width', bboxWidth);
      bg.setAttribute('height', '18');
      bg.setAttribute('rx', '4');
      bg.setAttribute('class', 'link-label-bg');
      group.insertBefore(bg, text);
    }

    // Extremos
    const start = link.points[0];
    const end = link.points[link.points.length - 1];

    const startRing = document.createElementNS(SVG_NS, 'circle');
    startRing.setAttribute('cx', start.x);
    startRing.setAttribute('cy', start.y);
    startRing.setAttribute('r', '14');
    startRing.setAttribute('class', 'edge-handle-ring');
    group.appendChild(startRing);

    const startHandle = document.createElementNS(SVG_NS, 'circle');
    startHandle.setAttribute('cx', start.x);
    startHandle.setAttribute('cy', start.y);
    startHandle.setAttribute('r', '7');
    startHandle.setAttribute('class', 'edge-handle');
    startHandle.dataset.linkId = link.id;
    startHandle.dataset.edge = 'from';
    group.appendChild(startHandle);

    const endRing = document.createElementNS(SVG_NS, 'circle');
    endRing.setAttribute('cx', end.x);
    endRing.setAttribute('cy', end.y);
    endRing.setAttribute('r', '14');
    endRing.setAttribute('class', 'edge-handle-ring');
    group.appendChild(endRing);

    const endHandle = document.createElementNS(SVG_NS, 'circle');
    endHandle.setAttribute('cx', end.x);
    endHandle.setAttribute('cy', end.y);
    endHandle.setAttribute('r', '7');
    endHandle.setAttribute('class', 'edge-handle');
    endHandle.dataset.linkId = link.id;
    endHandle.dataset.edge = 'to';
    group.appendChild(endHandle);

    // Segment handles
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
      ring.setAttribute('r', '10');
      ring.setAttribute('class', 'segment-ring');
      group.appendChild(ring);

      const handle = document.createElementNS(SVG_NS, 'circle');
      handle.setAttribute('cx', midX);
      handle.setAttribute('cy', midY);
      handle.setAttribute('r', '6');
      handle.setAttribute('class', `segment-handle ${isHorizontal ? 'segment-h' : 'segment-v'}`);
      handle.dataset.linkId = link.id;
      handle.dataset.segIndex = String(i);
      group.appendChild(handle);
    }

    svg.appendChild(group);
  }
}

export function renderMiniMap() {
  if (!dom.miniMap || !state.showMiniMap) return;
  if (state.nodes.length === 0) {
    dom.miniMap.style.display = 'none';
    return;
  }
  dom.miniMap.style.display = 'block';

  const canvas = dom.miniMap.querySelector('canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const padding = 20;

  const xs = state.nodes.map(n => n.x);
  const ys = state.nodes.map(n => n.y);
  const maxX = Math.max(...xs, ...state.nodes.map(n => n.x + n.width)) + padding;
  const maxY = Math.max(...ys, ...state.nodes.map(n => n.y + n.height)) + padding;
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;

  const contentW = Math.max(maxX - minX, 400);
  const contentH = Math.max(maxY - minY, 300);

  const mapW = 180;
  const mapH = 120;
  const scale = Math.min(mapW / contentW, mapH / contentH);

  canvas.width = mapW;
  canvas.height = mapH;
  ctx.clearRect(0, 0, mapW, mapH);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f0f9ff';
  ctx.fillRect(0, 0, mapW, mapH);

  // Draw links
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  for (const link of state.links) {
    if (!link.points || link.points.length < 2) continue;
    ctx.beginPath();
    link.points.forEach((p, i) => {
      const x = (p.x - minX) * scale;
      const y = (p.y - minY) * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Draw nodes
  for (const node of state.nodes) {
    const x = (node.x - minX) * scale;
    const y = (node.y - minY) * scale;
    const w = node.width * scale;
    const h = node.height * scale;

    const isSelected = node.id === state.selectedNodeId || state.multiSelectedNodeIds.includes(node.id);
    ctx.fillStyle = isSelected ? '#6366f1' : (node.bgColor || '#ffffff');
    ctx.fillRect(x, y, Math.max(w, 4), Math.max(h, 3));

    if (isSelected) {
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, Math.max(w, 4), Math.max(h, 3));
    }
  }

  // Viewport indicator
  const vpRect = dom.canvasViewport.getBoundingClientRect();
  const stageRect = dom.chartStage.getBoundingClientRect();
  const vpX = (state.view.x - minX * state.view.scale) * scale / state.view.scale;
  const vpY = (state.view.y - minY * state.view.scale) * scale / state.view.scale;
  const vpW = (vpRect.width / state.view.scale) * scale;
  const vpH = (vpRect.height / state.view.scale) * scale;

  ctx.strokeStyle = '#4f46e5';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(vpX, vpY, vpW, vpH);
}