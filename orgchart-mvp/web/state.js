import { dom } from './dom.js';
import { NODE_DIMS } from './config.js';
import { renderAll, renderCanvas, drawConnectors } from './render.js';

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
  layoutMode: 'tree',
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
      x: node.x || 0,
      y: node.y || 0,
      rotation: typeof node.rotation === 'number' ? node.rotation : 0,
    })),
  };
}

export const getNode = (id) => state.nodes.find(node => node.id === id) || null;
export const getRoots = () => state.nodes.filter(node => !node.parentId || !getNode(node.parentId));
export const getChildren = (parentId) => state.nodes.filter(node => node.parentId === parentId);

export function getLevel(nodeId) {
  let level = 0, current = getNode(nodeId), guard = new Set();
  while (current?.parentId && !guard.has(current.id)) {
    guard.add(current.id);
    current = getNode(current.parentId);
    if (current) level++;
  }
  return level;
}

export const getMaxDepth = () => !state.nodes.length ? 0 : Math.max(...state.nodes.map(node => getLevel(node.id))) + 1;

export function addNode(parentId = '') {
  let x = 200, y = 100;
  if (parentId) {
    const parentNode = getNode(parentId);
    if (parentNode) {
      x = parentNode.x;
      y = parentNode.y + NODE_DIMS.height + 80;
    }
  } else {
    const rect = dom.canvasViewport.getBoundingClientRect();
    x = (rect.width / 2 - state.view.x) / state.view.scale;
    y = (rect.height / 2 - state.view.y) / state.view.scale;
  }

  const node = {
    id: crypto.randomUUID(), parentId,
    name: parentId ? 'Nuevo colaborador' : 'Nueva dirección',
    title: parentId ? 'Cargo' : 'Cargo principal',
    area: '', email: '', phone: '', x, y, rotation: 0,
  };

  state.nodes.push(node);
  state.selectedNodeId = node.id;
  if (state.autoLayout) applyLayout();
  renderAll();
}

export function duplicateNode(id) {
  const source = getNode(id);
  if (!source) return;
  const copy = { ...source, id: crypto.randomUUID(), name: `${source.name} copia`, x: source.x + 40, y: source.y + 40 };
  state.nodes.push(copy);
  state.selectedNodeId = copy.id;
  if (state.autoLayout) applyLayout();
  renderAll();
}

export function updateNode(id, field, value) {
  const node = getNode(id);
  if (!node) return;
  node[field] = (field === 'rotation') ? Number(value) || 0 : value;
  if (field === 'parentId' && state.autoLayout) applyLayout();
  renderAll();
}

export function removeNode(id) {
  const idsToDelete = collectDescendants(id, new Set([id]));
  state.nodes = state.nodes.filter(node => !idsToDelete.has(node.id));
  state.collapsed.delete(id);
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

export const getAvailableParents = (nodeId) => {
  const descendants = collectDescendants(nodeId);
  return state.nodes.filter(node => node.id !== nodeId && !descendants.has(node.id));
};

export function toggleCollapse(id) {
  state.collapsed.has(id) ? state.collapsed.delete(id) : state.collapsed.add(id);
  renderCanvas();
}

export function applyLayout() {
  if (!state.autoLayout || !state.nodes.length) return;
  const roots = getRoots();
  const hSpacing = 340, vSpacing = 220;
  roots.forEach((root, index) => {
    root.x = 320 + index * hSpacing;
    root.y = 120;
    arrangeChildren(root.id, root.x, root.y, hSpacing, vSpacing);
  });
  renderCanvas();
}

function arrangeChildren(parentId, parentX, parentY, hSpacing, vSpacing) {
  const children = getChildren(parentId);
  if (!children.length) return;
  const isVertical = state.layoutMode === 'tree';
  const spread = Math.max(1, children.length - 1);
  children.forEach((child, index) => {
    const offset = (index - spread / 2) * (isVertical ? hSpacing : vSpacing);
    child.x = isVertical ? parentX + offset : parentX + hSpacing;
    child.y = isVertical ? parentY + vSpacing : parentY + offset;
    arrangeChildren(child.id, child.x, child.y, hSpacing, vSpacing);
  });
}