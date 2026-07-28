import { API_URL } from './config.js';
import { state, normalizeState } from './state.js';
import { renderAll } from './render.js';
import { setStatus, centerChart } from './events.js';
import { dom } from './dom.js';

export async function loadInitialData() {
  try {
    const res = await fetch(`${API_URL}/orgchart`);
    const data = normalizeState(await res.json());
    Object.assign(state, data);

    state.selectedNodeId = (state.nodes.filter(n => !n.parentId)[0] || state.nodes[0] || {}).id || null;
    dom.companyInput.value = state.company || '';

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
      nodes: state.nodes
    };
    const res = await fetch(`${API_URL}/orgchart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Error al guardar');

    const data = await res.json();
    state.updatedAt = data.updatedAt;
    renderAll(); // Re-render para actualizar la fecha
    setStatus(`Guardado correcto. Exportación: ${data.htmlPath}`, 'success');
  } catch (error) {
    console.error(error);
    setStatus('No se pudo guardar el organigrama.', 'error');
  }
}

export async function regenerateHTML() {
  try {
    const res = await fetch(`${API_URL}/export/html`);
    if (!res.ok) throw new Error('Error al regenerar HTML');
    const data = await res.json();
    setStatus(`HTML regenerado en ${data.htmlPath}`, 'success');
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
    html2canvas: { scale: 2, backgroundColor: '#f4f8ff' },
    jsPDF: { unit: 'mm', format: 'a3', orientation: 'landscape' },
  }).from(dom.chartStage).save();
  setStatus('PDF exportado desde el navegador.', 'success');
}