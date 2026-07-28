import { dom } from './dom.js';
import { NODE_DIMS, HORIZONTAL_SPACING, VERTICAL_SPACING } from './config.js';
import { renderAll, renderCanvas } from './render.js';

export const state = {
  company: '',
  updatedAt: null,
  nodes: [],
  selectedNodeId: null,
  searchTerm: '',
  collapsed: new Set(),
  view: { x: 120, y: 60, scale: 1 },
  panState: null,
  nodeDragState: null,
  connectorType: 'curved',
  autoLayout: true,
  history: [],
  future: [],
};

export function normalizeState(raw) {
  const nodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
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
      rotation: typeof node.rotation === 'number' ? node.rotation : 0,
    })),
  };
}

export const getNode = id => state.nodes.find(node => node.id === id) || null;
export const getRoots = () => state.nodes.filter(node => !node.parentId || !getNode(node.parentId));
export const getChildren = parentId => state.nodes.filter(node => node.parentId === parentId);

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

export function snapshotState() {
  state.history.push(JSON.stringify({
    company: state.company,
    updatedAt: state.updatedAt,
    nodes: state.nodes,
    selectedNodeId: state.selectedNodeId,
    connectorType: state.connectorType,
    autoLayout: state.autoLayout,
  }));

  if (state.history.length > 80) {
    state.history.shift();
  }

  state.future = [];
}

export function restoreFromSnapshot(serialized) {
  const parsed = JSON.parse(serialized);
  state.company = parsed.company || '';
  state.updatedAt = parsed.updatedAt || null;
  state.nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  state.selectedNodeId = parsed.selectedNodeId || null;
  state.connectorType = parsed.connectorType || 'curved';
  state.autoLayout = typeof parsed.autoLayout === 'boolean' ? parsed.autoLayout : true;
  renderAll();
}

export function undo() {
  if (!state.history.length) return;
  const current = JSON.stringify({
    company: state.company,
    updatedAt: state.updatedAt,
    nodes: state.nodes,
    selectedNodeId: state.selectedNodeId,
    connectorType: state.connectorType,
    autoLayout: state.autoLayout,
  });
  state.future.push(current);
  restoreFromSnapshot(state.history.pop());
}

export function redo() {
  if (!state.future.length) return;
  const current = JSON.stringify({
    company: state.company,
    updatedAt: state.updatedAt,
    nodes: state.nodes,
    selectedNodeId: state.selectedNodeId,
    connectorType: state.connectorType,
    autoLayout: state.autoLayout,
  });
  state.history.push(current);
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
      y = parentNode.y + NODE_DIMS.height + 86;
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

  const copy = {
    ...source,
    id: crypto.randomUUID(),
    name: `${source.name} copia`,
    x: source.x + 40,
    y: source.y + 40,
  };

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

  if (field === 'parentId' && state.autoLayout) {
    applyLayout();
  } else {
    renderAll();
  }
}

export function patchNodePosition(id, x, y) {
  const node = getNode(id);
  if (!node) return;
  node.x = x;
  node.y = y;
}

export function commitNodePositionChange() {
  snapshotState();
}

export function removeNode(id) {
  snapshotState();

  const idsToDelete = collectDescendants(id, new Set([id]));
  state.nodes = state.nodes.filter(node => !idsToDelete.has(node.id));

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

export function importChart(raw) {
  snapshotState();
  const normalized = normalizeState(raw);
  state.company = normalized.company;
  state.updatedAt = normalized.updatedAt;
  state.nodes = normalized.nodes;
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
    root.x = currentX + subtreeWidth / 2 - NODE_DIMS.width / 2;
    root.y = 60;
    layoutChildrenRecursive(root.id, root.y, currentX);
    currentX += subtreeWidth + HORIZONTAL_SPACING;
  });

  renderCanvas();
}

function getSubtreeWidth(nodeId) {
  const children = getChildren(nodeId).filter(child => !state.collapsed.has(nodeId));
  if (!children.length) return NODE_DIMS.width;

  let total = 0;
  for (const child of children) {
    total += getSubtreeWidth(child.id);
  }

  return total + (children.length - 1) * HORIZONTAL_SPACING;
}

function layoutChildrenRecursive(parentId, parentY, startXForChildren) {
  if (state.collapsed.has(parentId)) return;

  const children = getChildren(parentId);
  if (!children.length) return;

  let currentChildX = startXForChildren;
  const childrenY = parentY + VERTICAL_SPACING;

  children.forEach(child => {
    const childSubtreeWidth = getSubtreeWidth(child.id);
    child.x = currentChildX + childSubtreeWidth / 2 - NODE_DIMS.width / 2;
    child.y = childrenY;
    layoutChildrenRecursive(child.id, child.y, currentChildX);
    currentChildX += childSubtreeWidth + HORIZONTAL_SPACING;
  });
}