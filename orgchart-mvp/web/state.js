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
  let currentX = 50; // Posición X inicial para la primera raíz

  roots.forEach(root => {
    const subtreeWidth = getSubtreeWidth(root.id);
    // Centrar la raíz sobre su subárbol
    root.x = currentX + (subtreeWidth / 2) - (NODE_DIMS.width / 2);
    root.y = 50; // Posición Y fija para las raíces

    layoutChildrenRecursive(root.id, root.x, root.y, currentX);

    currentX += subtreeWidth + HORIZONTAL_SPACING; // Mover a la siguiente posición X para la próxima raíz
  });
  renderCanvas();
}

// Helper para obtener el ancho total de un subárbol
function getSubtreeWidth(nodeId) {
  const children = getChildren(nodeId);
  if (children.length === 0) {
    return NODE_DIMS.width; // El ancho de un solo nodo
  }

  let totalChildrenWidth = 0;
  for (const child of children) {
    totalChildrenWidth += getSubtreeWidth(child.id);
  }
  // Añadir el espaciado entre los hijos
  return totalChildrenWidth + (children.length - 1) * HORIZONTAL_SPACING;
}

// Función recursiva para organizar los hijos
function layoutChildrenRecursive(parentId, parentX, parentY, startXForChildren) {
  const children = getChildren(parentId);
  if (!children.length) return;

  let currentChildX = startXForChildren;
  const childrenY = parentY + VERTICAL_SPACING;

  children.forEach((child, index) => {
    const childSubtreeWidth = getSubtreeWidth(child.id);
    // Posicionar el nodo hijo
    child.x = currentChildX + (childSubtreeWidth / 2) - (NODE_DIMS.width / 2);
    child.y = childrenY;

    // Llamada recursiva para los hijos de este nodo
    layoutChildrenRecursive(child.id, child.x, child.y, currentChildX);

    currentChildX += childSubtreeWidth + HORIZONTAL_SPACING;
  });
}