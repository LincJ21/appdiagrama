import { dom } from './dom.js';
import { NODE_DIMS, HORIZONTAL_SPACING, VERTICAL_SPACING, NODE_MIN_WIDTH, NODE_MIN_HEIGHT, NODE_MAX_WIDTH, NODE_MAX_HEIGHT } from './config.js';
import { renderAll, renderCanvas } from './render.js';

export const state = {
  company: '',
  updatedAt: null,
  nodes: [],
  links: [],
  selectedNodeId: null,
  selectedLinkId: null,
  searchTerm: '',
  collapsed: new Set(),
  view: { x: 120, y: 60, scale: 1 },
  panState: null,
  nodeDragState: null,
  resizeState: null,
  connectorType: 'curved',
  linkStyle: 'straight', // 'straight' (línea negra) | 'cable' (curvo)
  autoLayout: true,
  connectMode: false,
  connectSourceId: null,
  history: [],
  future: [],
};

export function normalizeState(raw) {
  const nodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const links = Array.isArray(raw?.links) ? raw.links : [];

  return {
    company: raw?.company || '',
    updatedAt: raw?.updatedAt || null,
    nodes: nodes.map(node => ({
      id: node.id || crypto.randomUUID(),
      parentId: node.parentId || '',
      name: node.name || '',
      title: node.title || '',
      area: node.area || '',
      email: node.email || '',
      phone: node.phone || '',
      x: typeof node.x === 'number' ? node.x : 0,
      y: typeof node.y === 'number' ? node.y : 0,
      width: typeof node.width === 'number' && node.width > 0 ? node.width : NODE_DIMS.width,
      height: typeof node.height === 'number' && node.height > 0 ? node.height : NODE_DIMS.height,
      rotation: typeof node.rotation === 'number' ? node.rotation : 0,
    })),
    links: links.map(link => ({
      id: link.id || crypto.randomUUID(),
      fromId: link.fromId || '',
      toId: link.toId || '',
      style: link.style === 'cable' ? 'cable' : 'straight',
      color: link.color || '#111827',
      thickness: typeof link.thickness === 'number' ? link.thickness : 2.5,
    })),
  };
}

export const getNode = id => state.nodes.find(node => node.id === id) || null;
export const getRoots = () => state.nodes.filter(node => !node.parentId || !getNode(node.parentId));
export const getChildren = parentId => state.nodes.filter(node => node.parentId === parentId);
export const getLink = id => state.links.find(link => link.id === id) || null;

export function getLevel(nodeId) {
  let level = 0;
  let current = getNode(nodeId);
  const visited = new Set();

  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    current = getNode(current.parentId);
    if (current) level++;
  }

  return level;
}

export const getMaxDepth = () => !state.nodes.length ? 0 : Math.max(...state.nodes.map(node => getLevel(node.id))) + 1;

function serializeSnapshot() {
  return JSON.stringify({
    company: state.company,
    updatedAt: state.updatedAt,
    nodes: state.nodes,
    links: state.links,
    selectedNodeId: state.selectedNodeId,
    connectorType: state.connectorType,
    linkStyle: state.linkStyle,
    autoLayout: state.autoLayout,
  });
}

export function snapshotState() {
  state.history.push(serializeSnapshot());
  if (state.history.length > 80) state.history.shift();
  state.future = [];
}

export function restoreFromSnapshot(serialized) {
  const parsed = JSON.parse(serialized);
  state.company = parsed.company || '';
  state.updatedAt = parsed.updatedAt || null;
  state.nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  state.links = Array.isArray(parsed.links) ? parsed.links : [];
  state.selectedNodeId = parsed.selectedNodeId || null;
  state.connectorType = parsed.connectorType || 'curved';
  state.linkStyle = parsed.linkStyle || 'straight';
  state.autoLayout = typeof parsed.autoLayout === 'boolean' ? parsed.autoLayout : true;
  renderAll();
}

export function undo() {
  if (!state.history.length) return;
  state.future.push(serializeSnapshot());
  restoreFromSnapshot(state.history.pop());
}

export function redo() {
  if (!state.future.length) return;
  state.history.push(serializeSnapshot());
  restoreFromSnapshot(state.future.pop());
}

export function addNode(parentId = '') {
  snapshotState();

  let x = 220;
  let y = 120;

  if (parentId) {
    const parentNode = getNode(parentId);
    if (parentNode) {
      x = parentNode.x;
      y = parentNode.y + (parentNode.height || NODE_DIMS.height) + 86;
    }
  } else {
    const rect = dom.canvasViewport.getBoundingClientRect();
    x = (rect.width / 2 - state.view.x) / state.view.scale;
    y = (rect.height / 2 - state.view.y) / state.view.scale;
  }

  const node = {
    id: crypto.randomUUID(),
    parentId,
    name: parentId ? 'Nuevo colaborador' : 'Dirección principal',
    title: parentId ? 'Cargo' : 'Nivel estratégico',
    area: '',
    email: '',
    phone: '',
    x,
    y,
    width: NODE_DIMS.width,
    height: NODE_DIMS.height,
    rotation: 0,
  };

  state.nodes.push(node);
  state.selectedNodeId = node.id;
  if (state.autoLayout) applyLayout();
  renderAll();
}

export function duplicateNode(id) {
  const source = getNode(id);
  if (!source) return;
  snapshotState();

  const copy = { ...source, id: crypto.randomUUID(), name: `${source.name} copia`, x: source.x + 40, y: source.y + 40 };
  state.nodes.push(copy);
  state.selectedNodeId = copy.id;
  if (state.autoLayout) applyLayout();
  renderAll();
}

export function updateNode(id, field, value) {
  const node = getNode(id);
  if (!node) return;

  const normalizedValue = field === 'rotation' ? Number(value) || 0 : value;
  if (node[field] === normalizedValue) return;

  snapshotState();
  node[field] = normalizedValue;

  if (field === 'parentId' && state.autoLayout) applyLayout();
  else renderAll();
}

export function patchNodePosition(id, x, y) {
  const node = getNode(id);
  if (!node) return;
  node.x = x;
  node.y = y;
}

export function patchNodeSize(id, width, height) {
  const node = getNode(id);
  if (!node) return;
  node.width = Math.max(NODE_MIN_WIDTH, Math.min(NODE_MAX_WIDTH, width));
  node.height = Math.max(NODE_MIN_HEIGHT, Math.min(NODE_MAX_HEIGHT, height));
}

export function commitTransientChange() {
  snapshotState();
}

export function removeNode(id) {
  snapshotState();

  const idsToDelete = collectDescendants(id, new Set([id]));
  state.nodes = state.nodes.filter(node => !idsToDelete.has(node.id));
  state.links = state.links.filter(link => !idsToDelete.has(link.fromId) && !idsToDelete.has(link.toId));

  idsToDelete.forEach(nodeId => state.collapsed.delete(nodeId));

  if (idsToDelete.has(state.selectedNodeId)) {
    state.selectedNodeId = getRoots()[0]?.id || state.nodes[0]?.id || null;
  }

  if (state.autoLayout) applyLayout();
  renderAll();
}

export const collectDescendants = (id, bucket = new Set()) => {
  getChildren(id).forEach(child => {
    if (bucket.has(child.id)) return;
    bucket.add(child.id);
    collectDescendants(child.id, bucket);
  });
  return bucket;
};

export const getAvailableParents = nodeId => {
  const descendants = collectDescendants(nodeId);
  return state.nodes.filter(node => node.id !== nodeId && !descendants.has(node.id));
};

export function toggleCollapse(id) {
  state.collapsed.has(id) ? state.collapsed.delete(id) : state.collapsed.add(id);
  renderCanvas();
}

export function addLink(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;

  const exists = state.links.some(
    link => (link.fromId === fromId && link.toId === toId) || (link.fromId === toId && link.toId === fromId)
  );
  if (exists) return;

  snapshotState();
  state.links.push({
    id: crypto.randomUUID(),
    fromId,
    toId,
    style: state.linkStyle,
    color: '#111827',
    thickness: 2.5,
  });
  renderCanvas();
}

export function removeLink(id) {
  snapshotState();
  state.links = state.links.filter(link => link.id !== id);
  if (state.selectedLinkId === id) state.selectedLinkId = null;
  renderCanvas();
}

export function importChart(raw) {
  snapshotState();
  const normalized = normalizeState(raw);
  state.company = normalized.company;
  state.updatedAt = normalized.updatedAt;
  state.nodes = normalized.nodes;
  state.links = normalized.links;
  state.selectedNodeId = normalized.nodes[0]?.id || null;
  if (state.autoLayout) applyLayout();
  renderAll();
}

export function applyLayout() {
  if (!state.nodes.length) {
    renderCanvas();
    return;
  }

  const roots = getRoots();
  let currentX = 60;

  roots.forEach(root => {
    const subtreeWidth = getSubtreeWidth(root.id);
    root.x = currentX + subtreeWidth / 2 - (root.width || NODE_DIMS.width) / 2;
    root.y = 60;
    layoutChildrenRecursive(root.id, root.y, currentX);
    currentX += subtreeWidth + HORIZONTAL_SPACING;
  });

  renderCanvas();
}

function getSubtreeWidth(nodeId) {
  const node = getNode(nodeId);
  const nodeWidth = node?.width || NODE_DIMS.width;
  const children = getChildren(nodeId).filter(() => !state.collapsed.has(nodeId));
  if (!children.length) return nodeWidth;

  let total = 0;
  for (const child of children) total += getSubtreeWidth(child.id);
  return Math.max(nodeWidth, total + (children.length - 1) * HORIZONTAL_SPACING);
}

function layoutChildrenRecursive(parentId, parentY, startXForChildren) {
  if (state.collapsed.has(parentId)) return;

  const children = getChildren(parentId);
  if (!children.length) return;

  let currentChildX = startXForChildren;
  const childrenY = parentY + VERTICAL_SPACING;

  children.forEach(child => {
    const childSubtreeWidth = getSubtreeWidth(child.id);
    child.x = currentChildX + childSubtreeWidth / 2 - (child.width || NODE_DIMS.width) / 2;
    child.y = childrenY;
    layoutChildrenRecursive(child.id, child.y, currentChildX);
    currentChildX += childSubtreeWidth + HORIZONTAL_SPACING;
  });
}