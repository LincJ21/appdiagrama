import { API_URL } from './config.js';
import { state, normalizeState, applyLayout } from './state.js';
import { renderAll } from './render.js';
import { setStatus, centerChart } from './events.js';
import { dom } from './dom.js';

export async function loadInitialData() {
  try {
    const res = await fetch(`${API_URL}/orgchart`);
    const data = normalizeState(await res.json());

    Object.assign(state, data);
    state.selectedNodeId = (state.nodes.find(n => !n.parentId) || state.nodes[0] || {}).id || null;

    dom.companyInput.value = state.company || '';

    if (state.autoLayout && state.nodes.length) applyLayout();
    else renderAll();

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

    const payload = { company: state.company, nodes: state.nodes, links: state.links };

    const res = await fetch(`${API_URL}/orgchart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error('Error al guardar');

    const data = await res.json();
    state.updatedAt = data.updatedAt;
    renderAll();

    setStatus('Cambios guardados correctamente.', 'success');
  } catch (error) {
    console.error(error);
    setStatus('No se pudo guardar el organigrama.', 'error');
  }
}

export async function regenerateHTML() {
  try {
    const res = await fetch(`${API_URL}/export/html`);
    if (!res.ok) throw new Error('Error al regenerar HTML');
    await res.json();
    setStatus('Exportación HTML regenerada.', 'success');
  } catch (error) {
    console.error(error);
    setStatus('No se pudo regenerar el HTML.', 'error');
  }
}

export function exportPDF() {
  const company = (dom.companyInput.value || 'organigrama').replace(/\s+/g, '-').toLowerCase();

  html2pdf().set({
    margin: [8, 8, 8, 8],
    filename: `${company}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, backgroundColor: '#eef4fc' },
    jsPDF: { unit: 'mm', format: 'a3', orientation: 'landscape' },
  }).from(dom.chartStage).save();

  setStatus('PDF exportado desde el navegador.', 'success');
}

export async function exportPNG() {
  try {
    const scale = 2;
    const bounds = dom.chartStage.getBoundingClientRect();

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1200, Math.floor(bounds.width * scale));
    canvas.height = Math.max(800, Math.floor(bounds.height * scale));

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#eef4fc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const data = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="transform: scale(${scale}); transform-origin: top left;">
            ${dom.chartStage.outerHTML}
          </div>
        </foreignObject>
      </svg>
    `;

    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      ctx.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${(state.company || 'organigrama').replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
      setStatus('PNG exportado correctamente.', 'success');
    };

    image.onerror = () => { URL.revokeObjectURL(url); setStatus('No se pudo exportar el PNG.', 'error'); };
    image.src = url;
  } catch (error) {
    console.error(error);
    setStatus('No se pudo exportar el PNG.', 'error');
  }
}

export function downloadJSON() {
  const payload = {
    company: dom.companyInput.value.trim() || state.company || 'Mi Organigrama',
    updatedAt: state.updatedAt,
    nodes: state.nodes,
    links: state.links,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(payload.company || 'organigrama').replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);

  setStatus('JSON descargado correctamente.', 'success');
}