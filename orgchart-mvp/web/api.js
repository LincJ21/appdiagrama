import { API_URL } from './config.js';
import { state, normalizeState, applyLayout } from './state.js';
import { renderAll } from './render.js';
import { setStatus, centerChart } from './events.js';
import { dom } from './dom.js';

function hasSavedPositions(nodes) {
  return Array.isArray(nodes)
    && nodes.length > 0
    && nodes.every(n => Number.isFinite(Number(n.x)) && Number.isFinite(Number(n.y)));
}

function serializeNodes(nodes) {
  return (nodes || []).map(n => ({
    id: n.id,
    parentId: n.parentId || '',
    name: n.name || '',
    employees: n.employees || '',
    x: Number(n.x) || 0,
    y: Number(n.y) || 0,
    width: Number(n.width) || 308,
    height: Number(n.height) || 148,
    rotation: Number(n.rotation) || 0,
    style: n.style || 'classic',
    bgColor: n.bgColor,
    bgOpacity: n.bgOpacity,
    color: n.color || '',
    textAlign: n.textAlign || 'left',
    fontWeight: n.fontWeight || '',
    fontStyle: n.fontStyle || '',
    textDecoration: n.textDecoration || '',
  }));
}

function serializeLinks(links) {
  return (links || []).map(l => ({
    id: l.id,
    fromId: l.fromId,
    toId: l.toId,
    style: l.style || 'orthogonal',
    color: l.color || '#111827',
    thickness: Number(l.thickness) || 2,
    points: Array.isArray(l.points)
      ? l.points.map(p => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 }))
      : [],
    fromSide: l.fromSide || '',
    toSide: l.toSide || '',
    fromOffset: Number(l.fromOffset) || 0,
    toOffset: Number(l.toOffset) || 0,
    manual: !!l.manual,
  }));
}

export async function loadInitialData() {
  try {
    const res = await fetch(`${API_URL}/orgchart`);
    if (!res.ok) throw new Error('Error al cargar datos');

    const data = normalizeState(await res.json());
    Object.assign(state, data);

    state.selectedNodeId = (state.nodes.find(n => !n.parentId) || state.nodes[0] || {}).id || null;
    state.selectedLinkId = null;
    dom.companyInput.value = state.company || '';

    if (state.autoLayout && state.nodes.length && !hasSavedPositions(state.nodes)) {
      applyLayout();
    }

    if (dom.autoLayoutBtn) {
      dom.autoLayoutBtn.textContent = `Auto layout ${state.autoLayout ? 'ON' : 'OFF'}`;
    }

    renderAll();
    setStatus('Organigrama cargado correctamente.', 'success');
    requestAnimationFrame(() => centerChart(true));
  } catch (error) {
    console.error(error);
    setStatus('No se pudo cargar el organigrama.', 'error');
  }
}

export async function saveAll() {
  try {
    state.company = dom.companyInput.value.trim() || 'Mi Organigrama';

    const payload = {
      company: state.company,
      nodes: serializeNodes(state.nodes),
      links: serializeLinks(state.links),
    };

    const res = await fetch(`${API_URL}/orgchart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error('Error al guardar');

    const data = await res.json();
    const normalized = normalizeState(data);

    state.updatedAt = normalized.updatedAt;
    if (hasSavedPositions(normalized.nodes)) {
      state.nodes = normalized.nodes;
      state.links = normalized.links;
    }

    renderAll();
    setStatus('Guardado correctamente (incluye posiciones y rutas).', 'success');
  } catch (error) {
    console.error(error);
    setStatus('No se pudo guardar el organigrama.', 'error');
  }
}

export async function regenerateHTML() {
  try {
    await saveAll();
    const res = await fetch(`${API_URL}/export/html`);
    if (!res.ok) throw new Error('Error al regenerar HTML');
    await res.json();
    setStatus('HTML exportado con conexiones reales y área trabajada.', 'success');
  } catch (error) {
    console.error(error);
    setStatus('No se pudo regenerar el HTML.', 'error');
  }
}

/* =========================
   Helpers de geometría
   ========================= */

function portPoint(node, side) {
  const x = Number(node.x) || 0;
  const y = Number(node.y) || 0;
  const w = Number(node.width) || 308;
  const h = Number(node.height) || 148;

  if (side === 'left') return { x, y: y + h / 2 };
  if (side === 'right') return { x: x + w, y: y + h / 2 };
  if (side === 'top') return { x: x + w / 2, y };
  return { x: x + w / 2, y: y + h }; // bottom
}

function autoSide(a, b) {
  const ac = { x: a.x + (a.width || 308) / 2, y: a.y + (a.height || 148) / 2 };
  const bc = { x: b.x + (b.width || 308) / 2, y: b.y + (b.height || 148) / 2 };
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

function moveFromSide(point, side, distance) {
  if (side === 'left') return { x: point.x - distance, y: point.y };
  if (side === 'right') return { x: point.x + distance, y: point.y };
  if (side === 'top') return { x: point.x, y: point.y - distance };
  return { x: point.x, y: point.y + distance };
}

function defaultInteriorPoints(from, to, fromSide, toSide) {
  const start = portPoint(from, fromSide);
  const end = portPoint(to, toSide);
  const margin = 36;
  const stubStart = moveFromSide(start, fromSide, margin);
  const stubEnd = moveFromSide(end, toSide, margin);
  const horizontalFirst = fromSide === 'left' || fromSide === 'right';

  if (horizontalFirst) {
    const midX = stubStart.x + (stubEnd.x - stubStart.x) / 2;
    return [
      stubStart,
      { x: midX, y: stubStart.y },
      { x: midX, y: stubEnd.y },
      stubEnd,
    ];
  }

  const midY = stubStart.y + (stubEnd.y - stubStart.y) / 2;
  return [
    stubStart,
    { x: stubStart.x, y: midY },
    { x: stubEnd.x, y: midY },
    stubEnd,
  ];
}

function fullRoute(link, from, to) {
  const fromSide = link.fromSide || autoSide(from, to);
  const toSide = link.toSide || autoSide(to, from);
  const start = portPoint(from, fromSide);
  const end = portPoint(to, toSide);

  let points = Array.isArray(link.points) ? link.points : [];
  if (points.length !== 4) {
    points = defaultInteriorPoints(from, to, fromSide, toSide);
  }

  return [start, ...points, end];
}

function pointsToPath(points) {
  if (!points.length) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

function hierarchicalRoute(parent, child) {
  const start = portPoint(parent, 'bottom');
  const end = portPoint(child, 'top');
  const midY = start.y + (end.y - start.y) / 2;
  return [
    start,
    { x: start.x, y: midY },
    { x: end.x, y: midY },
    end,
  ];
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getWorkingBounds() {
  const xs = [];
  const ys = [];
  const byId = new Map(state.nodes.map(n => [n.id, n]));

  for (const n of state.nodes) {
    const w = Number(n.width) || 308;
    const h = Number(n.height) || 148;
    xs.push(Number(n.x) || 0, (Number(n.x) || 0) + w);
    ys.push(Number(n.y) || 0, (Number(n.y) || 0) + h);
  }

  // rutas manuales
  for (const link of state.links) {
    const from = byId.get(link.fromId);
    const to = byId.get(link.toId);
    if (!from || !to) continue;
    for (const p of fullRoute(link, from, to)) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }

  // rutas jerárquicas
  for (const n of state.nodes) {
    if (!n.parentId) continue;
    const parent = byId.get(n.parentId);
    if (!parent) continue;
    for (const p of hierarchicalRoute(parent, n)) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }

  if (!xs.length || !ys.length) {
    return { minX: 0, minY: 0, width: 800, height: 600 };
  }

  const pad = 40;
  const minX = Math.floor(Math.min(...xs) - pad);
  const minY = Math.floor(Math.min(...ys) - pad);
  const maxX = Math.ceil(Math.max(...xs) + pad);
  const maxY = Math.ceil(Math.max(...ys) + pad);

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

/**
 * Construye un DOM limpio SOLO con nodos + líneas.
 * Sin handles, puertos, botones ni selección.
 */
function buildCleanExportRoot(background) {
  const bounds = getWorkingBounds();
  const byId = new Map(state.nodes.map(n => [n.id, n]));

  const root = document.createElement('div');
  root.style.cssText = [
    'position:relative',
    `width:${bounds.width}px`,
    `height:${bounds.height}px`,
    `background:${background === null ? 'transparent' : background}`,
    'overflow:hidden',
    'font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
    'box-sizing:border-box',
  ].join(';');

  // SVG de líneas
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', String(bounds.width));
  svg.setAttribute('height', String(bounds.height));
  svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;';

  const shift = pts => pts.map(p => ({ x: p.x - bounds.minX, y: p.y - bounds.minY }));

  const addPath = (points, color, thickness) => {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', pointsToPath(shift(points)));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', String(thickness));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
  };

  // jerárquicas
  const manualPairs = new Set();
  for (const l of state.links) {
    manualPairs.add(`${l.fromId}|${l.toId}`);
    manualPairs.add(`${l.toId}|${l.fromId}`);
  }

  for (const n of state.nodes) {
    if (!n.parentId) continue;
    const parent = byId.get(n.parentId);
    if (!parent) continue;
    if (manualPairs.has(`${parent.id}|${n.id}`)) continue;
    addPath(hierarchicalRoute(parent, n), '#94a3b8', 2);
  }

  // manuales
  for (const link of state.links) {
    const from = byId.get(link.fromId);
    const to = byId.get(link.toId);
    if (!from || !to) continue;
    addPath(fullRoute(link, from, to), link.color || '#111827', Number(link.thickness) || 2);
  }

  root.appendChild(svg);

  // nodos limpios
  for (const n of state.nodes) {
    const el = document.createElement('div');
    const w = Number(n.width) || 308;
    const h = Number(n.height) || 148;

    const css = [
      'position:absolute',
      `left:${(Number(n.x) || 0) - bounds.minX}px`,
      `top:${(Number(n.y) || 0) - bounds.minY}px`,
      `width:${w}px`,
      `min-height:${h}px`,
      'box-sizing:border-box',
      'padding:14px 16px',
      'overflow:hidden',
      'color:#0f172a',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ];

    if (n.color) {
      css.push(`background:${esc(n.color)}`);
      const hex = n.color.replace('#', '');
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        css.push(yiq < 128 ? 'color:#ffffff' : 'color:#0f172a');
      }
    } else {
      const style = n.style || 'classic';
      switch (style) {
        case 'classic':
          css.push('background:#ffffff');
          break;
        case 'lined':
          css.push('background:#f8fbff');
          break;
        default: // 'default'
          css.push('background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)');
          break;
      }
    }

    // Aplicar bordes y sombras según el estilo, independientemente del color de fondo
    const style = n.style || 'classic';
    if (style === 'classic')
      css.push('border-radius:4px', 'border:3px solid #102033', 'box-shadow:0 1px 3px rgba(0, 0, 0, 0.05)');
    else if (style === 'lined')
      css.push('border-radius:8px', 'border:4px dashed #102033', 'box-shadow:none');
    else
      css.push('border:3px solid #dbe3f0', 'border-radius:14px', 'box-shadow:0 6px 16px rgba(15,23,42,0.08)');

    el.style.cssText = css.join(';');

    const textStyles = `text-align: ${n.textAlign || 'left'};`;
    const titleStyles = `font-size:22px; font-weight:${n.fontWeight === 'bold' ? '700' : '600'}; font-style:${n.fontStyle || 'normal'}; text-decoration:${n.textDecoration || 'none'}; margin-bottom:4px; line-height:1.25;`;
    const otherTextStyles = `font-weight:${n.fontWeight || 'normal'}; font-style:${n.fontStyle || 'normal'}; text-decoration:${n.textDecoration || 'none'};`;

    el.innerHTML = `
      <div class="node-content" style="${textStyles}">
        <div style="${titleStyles}">${esc(n.name || '')}</div>
      </div>
    `;
    root.appendChild(el);
  }

  return { root, bounds };
}

async function renderExportOffscreen(background) {
  const { root, bounds } = buildCleanExportRoot(background);

  const host = document.createElement('div');
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${bounds.width}px`,
    `height:${bounds.height}px`,
    'z-index:99999',
    'pointer-events:none',
    'margin:0',
    'padding:0',
    'overflow:hidden',
  ].join(';');

  host.appendChild(root);
  document.body.appendChild(host);

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return { host, root, bounds };
}

function companySlug() {
  return (dom.companyInput.value || state.company || 'organigrama')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '');
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* =========================
   Exportaciones
   ========================= */

export async function exportPNG() {
  let host = null;
  try {
    await saveAll();

    if (!window.htmlToImage) {
      setStatus('html-to-image no está disponible.', 'error');
      return;
    }
    if (!state.nodes.length) {
      setStatus('No hay nodos para exportar.', 'error');
      return;
    }

    const withWhite = window.confirm(
      'Exportar PNG\n\nAceptar = fondo blanco\nCancelar = fondo transparente'
    );

    setStatus(withWhite ? 'Generando PNG blanco...' : 'Generando PNG transparente...', 'info', 0);

    const bg = withWhite ? '#ffffff' : null;
    const built = await renderExportOffscreen(bg === null ? 'transparent' : bg);
    host = built.host;

    const dataUrl = await window.htmlToImage.toPng(built.root, {
      backgroundColor: bg,
      pixelRatio: 2,
      cacheBust: true,
      width: built.bounds.width,
      height: built.bounds.height,
      style: {
        transform: 'none',
        width: `${built.bounds.width}px`,
        height: `${built.bounds.height}px`,
      },
    });

    downloadDataUrl(dataUrl, `${companySlug()}${withWhite ? '' : '-transparent'}.png`);
    setStatus(
      withWhite
        ? 'PNG exportado (fondo blanco, sin handles).'
        : 'PNG exportado (transparente, sin handles).',
      'success'
    );
  } catch (error) {
    console.error(error);
    setStatus('No se pudo exportar el PNG.', 'error');
  } finally {
    if (host) host.remove();
  }
}

export async function exportPDF() {
  let host = null;
  try {
    await saveAll();

    if (!window.htmlToImage) {
      setStatus('html-to-image no está disponible.', 'error');
      return;
    }

    // jsPDF viene con html2pdf o como jspdf global
    const JsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!JsPDF && !window.html2pdf) {
      setStatus('jsPDF / html2pdf no está disponible.', 'error');
      return;
    }

    if (!state.nodes.length) {
      setStatus('No hay nodos para exportar.', 'error');
      return;
    }

    setStatus('Generando PDF del área trabajada...', 'info', 0);

    // 1) Render limpio → PNG (sin handles)
    const built = await renderExportOffscreen('#ffffff');
    host = built.host;

    const dataUrl = await window.htmlToImage.toPng(built.root, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
      width: built.bounds.width,
      height: built.bounds.height,
      style: {
        transform: 'none',
        width: `${built.bounds.width}px`,
        height: `${built.bounds.height}px`,
      },
    });

    // 2) Una sola página del tamaño exacto del área
    const w = built.bounds.width;
    const h = built.bounds.height;

    if (JsPDF) {
      const pdf = new JsPDF({
        orientation: w >= h ? 'landscape' : 'portrait',
        unit: 'px',
        format: [w, h],
        hotfixes: ['px_scaling'],
      });
      pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
      pdf.save(`${companySlug()}.pdf`);
    } else {
      // fallback html2pdf usando solo la imagen
      const img = document.createElement('img');
      img.src = dataUrl;
      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
      img.style.display = 'block';

      const box = document.createElement('div');
      box.style.width = `${w}px`;
      box.style.height = `${h}px`;
      box.appendChild(img);
      document.body.appendChild(box);

      await window.html2pdf().set({
        margin: 0,
        filename: `${companySlug()}.pdf`,
        image: { type: 'png', quality: 1 },
        html2canvas: {
          scale: 1,
          backgroundColor: '#ffffff',
          width: w,
          height: h,
          windowWidth: w,
          windowHeight: h,
        },
        jsPDF: {
          unit: 'px',
          format: [w, h],
          orientation: w >= h ? 'landscape' : 'portrait',
          hotfixes: ['px_scaling'],
        },
        pagebreak: { mode: [] },
      }).from(box).save();

      box.remove();
    }

    setStatus('PDF exportado en 1 hoja (solo área trabajada, sin handles).', 'success');
  } catch (error) {
    console.error(error);
    setStatus('No se pudo exportar el PDF.', 'error');
  } finally {
    if (host) host.remove();
  }
}

export function downloadJSON() {
  const payload = {
    company: dom.companyInput.value.trim() || state.company || 'Mi Organigrama',
    updatedAt: state.updatedAt,
    nodes: serializeNodes(state.nodes),
    links: serializeLinks(state.links),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${companySlug()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus('JSON descargado correctamente.', 'success');
}