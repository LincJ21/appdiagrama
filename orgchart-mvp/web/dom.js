export const dom = {
  companyInput: document.getElementById('companyInput'),
  searchInput: document.getElementById('searchInput'),
  nodeList: document.getElementById('nodeList'),
  statsGrid: document.getElementById('statsGrid'),
  chartStage: document.getElementById('chartStage'),
  canvasViewport: document.getElementById('canvasViewport'),
  inspectorContent: document.getElementById('inspectorContent'),
  statusBox: document.getElementById('status'),
  zoomValue: document.getElementById('zoomValue'),
  saveBtn: document.getElementById('saveBtn'),
  addRootBtn: document.getElementById('addRootBtn'),
  exportHtmlBtn: document.getElementById('exportHtmlBtn'),
  exportPdfBtn: document.getElementById('exportPdfBtn'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomResetBtn: document.getElementById('zoomResetBtn'),
  centerBtn: document.getElementById('centerBtn'),
  toggleConnectorsBtn: document.getElementById('toggleConnectorsBtn'),
};

// Estos botones no existen al inicio, se crean dinámicamente
export const getAutoLayoutBtn = () => document.getElementById('autoLayoutBtn');
export const getLayoutModeBtn = () => document.getElementById('layoutModeBtn');
export const getCanvasCreateRootBtn = () => document.getElementById('canvasCreateRoot');