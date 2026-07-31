import {
  NODE_DIMS,
  HORIZONTAL_SPACING,
  VERTICAL_SPACING,
  NODE_MIN_WIDTH,
  NODE_MIN_HEIGHT,
  NODE_MAX_WIDTH,
  NODE_MAX_HEIGHT,
  GRID_SIZE,
} from './config.js';

export const state = {
  company: 'Mi Organigrama',
  updatedAt: null,
  nodes: [],
  links: [],
  selectedNodeId: null,
  selectedLinkId: null,
  multiSelectedNodeIds: [],
  activeAnchor: null,
  edgeDragState: null,
  segmentDragState: null,
  portDragState: null,
  searchTerm: '',
  autoLayout: false,
  connectMode: false,
  connectSourceId: null,
  linkStyle: 'orthogonal',
  connectorType: 'orthogonal',
  view: { x: 0, y: 0, scale: 1 },
  history: [],
  future: [],
  panState: null,
  nodeDragState: null,
  resizeState: null,
  selectionBox: null,
  clipboard: null,
  snapToGrid: true,
  gridSize: GRID_SIZE,
  showGrid: true,
  showMiniMap: true,
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clone = value => JSON.parse(JSON.stringify(value));

function snapshot() {
  return clone({
    company: state.company,
    nodes: state.nodes,
    links: state.links,
  });
}

function pushHistory() {
  state.history.push(snapshot());
  if (state.history.length > 50) state.history.shift();
  state.future = [];
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeState(data = {}) {
  return {
    company: data.company || 'Mi Organigrama',
    updatedAt: data.updatedAt || null,
    nodes: (data.nodes || []).map((node, index) => {
      const hasX = node && node.x !== undefined && node.x !== null && node.x !== '';
      const hasY = node && node.y !== undefined && node.y !== null && node.y !== '';

      return {
        id: node.id || uid(),
        parentId: node.parentId || '',
        name: node.name || 'Nuevo nodo',
        employees: node.employees || '',
        x: hasX ? toNumber(node.x, index * HORIZONTAL_SPACING) : index * HORIZONTAL_SPACING,
        y: hasY ? toNumber(node.y, 80) : 80,
        width: toNumber(node.width, NODE_DIMS.width) || NODE_DIMS.width,
        height: toNumber(node.height, NODE_DIMS.height) || NODE_DIMS.height,
        rotation: toNumber(node.rotation, 0),
        style: node.style || 'classic',
        bgColor: node.bgColor,
        bgOpacity: node.bgOpacity,
        color: node.color || '',
        textAlign: node.textAlign || 'left',
        fontWeight: node.fontWeight || '',
        fontStyle: node.fontStyle || '',
        textDecoration: node.textDecoration || '',
      };
    }),
    links: (data.links || []).map(link => ({
      id: link.id || uid(),
      fromId: link.fromId || '',
      toId: link.toId || '',
      style: link.style || 'orthogonal',
      color: link.color || '#111827',
      thickness: toNumber(link.thickness, 2) || 2,
      points: Array.isArray(link.points) ? link.points : [],
      fromSide: link.fromSide || '',
      toSide: link.toSide || '',
      fromOffset: toNumber(link.fromOffset, 0),
      toOffset: toNumber(link.toOffset, 0),
      manual: !!link.manual,
      label: link.label || '',
    })),
  };
}

export function applyLayout() {
  const roots = state.nodes.filter(n => !n.parentId);
  let rootX = 80;

  const walk = (node, depth) => {
    const children = state.nodes.filter(n => n.parentId === node.id);

    if (!children.length) {
      node.x = rootX;
      node.y = 60 + depth * VERTICAL_SPACING;
      rootX += HORIZONTAL_SPACING;
      return node.x;
    }

    const xs = children.map(child => walk(child, depth + 1));
    node.x = (Math.min(...xs) + Math.max(...xs)) / 2;
    node.y = 60 + depth * VERTICAL_SPACING;
    return node.x;
  };

  roots.forEach(root => walk(root, 0));
}

export function addNode(parentId = '', options = {}) {
  pushHistory();

  const parent = parentId ? state.nodes.find(n => n.id === parentId) : null;

  const node = {
    id: uid(),
    parentId: parentId || '',
    name: options.name || 'Nuevo nodo',
    employees: '',
    x: options.x ?? (parent ? parent.x + 20 : 120),
    y: options.y ?? (parent ? parent.y + (parent.height || NODE_DIMS.height) + 80 : 120),
    width: options.width || NODE_DIMS.width,
    height: options.height || NODE_DIMS.height,
    rotation: 0,
    style: options.style || 'classic',
    bgColor: options.bgColor || '#ffffff',
    bgOpacity: options.bgOpacity || '1',
    color: '',
    textAlign: 'left',
    fontWeight: '',
    fontStyle: '',
    textDecoration: '',
  };

  state.nodes.push(node);
  state.selectedNodeId = node.id;
  state.selectedLinkId = null;
  state.multiSelectedNodeIds = [];

  if (state.autoLayout && options.x === undefined) {
    applyLayout();
  }
  return node;
}

export function updateNode(id, field, value) {
  const node = state.nodes.find(n => n.id === id);
  if (!node) return;
  pushHistory();
  node[field] = value;
}

export function updateMultipleNodes(updates) {
  // updates: array of {id, field, value}
  pushHistory();
  for (const u of updates) {
    const node = state.nodes.find(n => n.id === u.id);
    if (node) node[u.field] = u.value;
  }
}

export function removeNode(id) {
  pushHistory();

  const idsToRemove = new Set([id]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const node of state.nodes) {
      if (!idsToRemove.has(node.id) && idsToRemove.has(node.parentId)) {
        idsToRemove.add(node.id);
        changed = true;
      }
    }
  }

  state.nodes = state.nodes.filter(n => !idsToRemove.has(n.id));
  state.links = state.links.filter(
    l => !idsToRemove.has(l.fromId) && !idsToRemove.has(l.toId)
  );

  if (state.selectedNodeId && idsToRemove.has(state.selectedNodeId)) {
    state.selectedNodeId = state.nodes[0]?.id || null;
  }
  state.multiSelectedNodeIds = state.multiSelectedNodeIds.filter(
    id => !idsToRemove.has(id)
  );

  if (state.selectedLinkId && !state.links.some(l => l.id === state.selectedLinkId)) {
    state.selectedLinkId = null;
  }
}

export function duplicateNode(id) {
  const node = state.nodes.find(n => n.id === id);
  if (!node) return null;

  pushHistory();

  const copy = {
    ...clone(node),
    id: uid(),
    x: node.x + 40,
    y: node.y + 40,
    name: `${node.name} (copia)`,
  };

  state.nodes.push(copy);
  state.selectedNodeId = copy.id;
  state.selectedLinkId = null;
  state.multiSelectedNodeIds = [];
  return copy;
}

export function copyNodes(nodeIds) {
  const nodes = state.nodes.filter(n => nodeIds.includes(n.id));
  if (!nodes.length) return;

  // Also copy links that connect between copied nodes
  const idSet = new Set(nodeIds);
  const links = state.links.filter(l => idSet.has(l.fromId) && idSet.has(l.toId));

  state.clipboard = {
    nodes: clone(nodes),
    links: clone(links),
    offsetX: 40,
    offsetY: 40,
  };
}

export function pasteNodes() {
  if (!state.clipboard) return [];
  pushHistory();

  const { nodes, links } = state.clipboard;
  const idMap = new Map();
  const newNodes = [];

  for (const node of nodes) {
    const newId = uid();
    idMap.set(node.id, newId);
    const copy = {
      ...clone(node),
      id: newId,
      x: node.x + state.clipboard.offsetX,
      y: node.y + state.clipboard.offsetY,
      name: node.name,
    };
    state.nodes.push(copy);
    newNodes.push(copy);
  }

  for (const link of links) {
    const newFromId = idMap.get(link.fromId);
    const newToId = idMap.get(link.toId);
    if (newFromId && newToId) {
      state.links.push({
        ...clone(link),
        id: uid(),
        fromId: newFromId,
        toId: newToId,
      });
    }
  }

  state.clipboard.offsetX += 20;
  state.clipboard.offsetY += 20;

  if (newNodes.length === 1) {
    state.selectedNodeId = newNodes[0].id;
    state.multiSelectedNodeIds = [];
  } else {
    state.selectedNodeId = null;
    state.multiSelectedNodeIds = newNodes.map(n => n.id);
  }
  state.selectedLinkId = null;

  return newNodes;
}

export function alignNodes(nodeIds, direction) {
  if (nodeIds.length < 2) return;
  pushHistory();

  const nodes = state.nodes.filter(n => nodeIds.includes(n.id));
  if (!nodes.length) return;

  let value;
  switch (direction) {
    case 'left':
      value = Math.min(...nodes.map(n => n.x));
      nodes.forEach(n => n.x = value);
      break;
    case 'center':
      value = nodes.reduce((sum, n) => sum + n.x + n.width / 2, 0) / nodes.length;
      nodes.forEach(n => n.x = value - n.width / 2);
      break;
    case 'right':
      value = Math.max(...nodes.map(n => n.x + n.width));
      nodes.forEach(n => n.x = value - n.width);
      break;
    case 'top':
      value = Math.min(...nodes.map(n => n.y));
      nodes.forEach(n => n.y = value);
      break;
    case 'middle':
      value = nodes.reduce((sum, n) => sum + n.y + n.height / 2, 0) / nodes.length;
      nodes.forEach(n => n.y = value - n.height / 2);
      break;
    case 'bottom':
      value = Math.max(...nodes.map(n => n.y + n.height));
      nodes.forEach(n => n.y = value - n.height);
      break;
  }
}

export function distributeNodes(nodeIds, axis) {
  if (nodeIds.length < 3) return;
  pushHistory();

  const nodes = state.nodes.filter(n => nodeIds.includes(n.id));
  if (nodes.length < 3) return;

  if (axis === 'horizontal') {
    nodes.sort((a, b) => a.x - b.x);
    const min = nodes[0].x;
    const max = nodes[nodes.length - 1].x;
    const step = (max - min) / (nodes.length - 1);
    nodes.forEach((n, i) => n.x = min + step * i);
  } else {
    nodes.sort((a, b) => a.y - b.y);
    const min = nodes[0].y;
    const max = nodes[nodes.length - 1].y;
    const step = (max - min) / (nodes.length - 1);
    nodes.forEach((n, i) => n.y = min + step * i);
  }
}

export function undo() {
  const previous = state.history.pop();
  if (!previous) return;

  state.future.push(snapshot());
  state.company = previous.company;
  state.nodes = previous.nodes;
  state.links = previous.links;
}

export function redo() {
  const next = state.future.pop();
  if (!next) return;

  state.history.push(snapshot());
  state.company = next.company;
  state.nodes = next.nodes;
  state.links = next.links;
}

export function patchNodePosition(id, x, y) {
  const node = state.nodes.find(n => n.id === id);
  if (!node) return;
  node.x = x;
  node.y = y;
}

export function patchNodeSize(id, width, height) {
  const node = state.nodes.find(n => n.id === id);
  if (!node) return;

  node.width = Math.max(NODE_MIN_WIDTH, Math.min(NODE_MAX_WIDTH, width));
  node.height = Math.max(NODE_MIN_HEIGHT, Math.min(NODE_MAX_HEIGHT, height));
}

export function commitTransientChange() {
  pushHistory();
}

export function importChart(payload) {
  pushHistory();

  const normalized = normalizeState(payload);
  state.company = normalized.company;
  state.updatedAt = normalized.updatedAt;
  state.nodes = normalized.nodes;
  state.links = normalized.links;
  state.selectedNodeId = state.nodes[0]?.id || null;
  state.selectedLinkId = null;
  state.multiSelectedNodeIds = [];

  const hasPos = state.nodes.every(n => Number.isFinite(Number(n.x)) && Number.isFinite(Number(n.y)));
  if (state.autoLayout && !hasPos) applyLayout();
}

export function addLink(fromId, toId) {
  pushHistory();

  const link = {
    id: uid(),
    fromId,
    toId,
    style: 'orthogonal',
    color: '#111827',
    thickness: 2,
    points: [],
    fromSide: '',
    toSide: '',
    fromOffset: 0,
    toOffset: 0,
    manual: true,
    label: '',
  };

  state.links.push(link);
  state.selectedLinkId = link.id;
  state.selectedNodeId = null;
  state.multiSelectedNodeIds = [];
  return link;
}

export function removeLink(id) {
  pushHistory();
  state.links = state.links.filter(link => link.id !== id);
  if (state.selectedLinkId === id) state.selectedLinkId = null;
}

export function selectLink(id) {
  state.selectedLinkId = id;
  state.selectedNodeId = null;
  state.multiSelectedNodeIds = [];
}

export function clearLinkPoints(id) {
  const link = state.links.find(l => l.id === id);
  if (!link) return;
  pushHistory();
  link.points = [];
  link.manual = false;
}

export function ensureLinkAnchor(id, pointIndex, point) {
  const link = state.links.find(l => l.id === id);
  if (!link) return;
  if (!Array.isArray(link.points)) link.points = [];
  if (!link.points[pointIndex]) link.points[pointIndex] = { x: point.x, y: point.y };
}

export function updateLinkAnchor(id, pointIndex, x, y) {
  const link = state.links.find(l => l.id === id);
  if (!link) return;
  if (!Array.isArray(link.points)) link.points = [];
  link.points[pointIndex] = { x, y };
}

export default state;