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
  exportPngBtn: document.getElementById('exportPngBtn'),
  downloadJsonBtn: document.getElementById('downloadJsonBtn'),
  importJsonInput: document.getElementById('importJsonInput'),

  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomResetBtn: document.getElementById('zoomResetBtn'),
  centerBtn: document.getElementById('centerBtn'),
  fitBtn: document.getElementById('fitBtn'),
  toggleConnectorsBtn: document.getElementById('toggleConnectorsBtn'),
  autoLayoutBtn: document.getElementById('autoLayoutBtn'),
  undoBtn: document.getElementById('undoBtn'),
  redoBtn: document.getElementById('redoBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
};

export const getCanvasCreateRootBtn = () => document.getElementById('canvasCreateRoot');