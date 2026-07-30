import {
  NODE_DIMS,
  HORIZONTAL_SPACING,
  VERTICAL_SPACING,
  NODE_MIN_WIDTH,
  NODE_MIN_HEIGHT,
  NODE_MAX_WIDTH,
  NODE_MAX_HEIGHT,
} from './config.js';

export const state = {
  company: 'Mi Organigrama',
  updatedAt: null,
  nodes: [],
  links: [],
  selectedNodeId: null,
  selectedLinkId: null,
  activeAnchor: null,
  edgeDragState: null,
  segmentDragState: null,
  portDragState: null,
  searchTerm: '',
  // OFF por defecto para NO reordenar al recargar
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
};

const uid = () => Math.random().toString(36).slice(2, 10);
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
        // Respeta posiciones guardadas
        x: hasX ? toNumber(node.x, index * HORIZONTAL_SPACING) : index * HORIZONTAL_SPACING,
        y: hasY ? toNumber(node.y, 80) : 80,
        width: toNumber(node.width, NODE_DIMS.width) || NODE_DIMS.width,
        height: toNumber(node.height, NODE_DIMS.height) || NODE_DIMS.height,
        rotation: toNumber(node.rotation, 0),
        style: node.style || 'classic',
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

export function addNode(parentId = '') {
  pushHistory();

  const parent = parentId ? state.nodes.find(n => n.id === parentId) : null;

  const node = {
    id: uid(),
    parentId: parentId || '',
    name: 'Nuevo nodo',
    employees: '',
    x: parent ? parent.x : 120,
    y: parent ? parent.y + (parent.height || NODE_DIMS.height) + 80 : 120,
    width: NODE_DIMS.width,
    height: NODE_DIMS.height,
    rotation: 0,
    style: 'classic',
    color: '',
    textAlign: 'left',
    fontWeight: '',
    fontStyle: '',
    textDecoration: '',
  };

  state.nodes.push(node);
  state.selectedNodeId = node.id;
  state.selectedLinkId = null;

  if (state.autoLayout) applyLayout();
  return node;
}

export function updateNode(id, field, value) {
  const node = state.nodes.find(n => n.id === id);
  if (!node) return;
  pushHistory();
  node[field] = value;
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
  return copy;
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

  // Al importar, solo auto-layout si no hay posiciones
  const hasPos = state.nodes.every(n => Number.isFinite(Number(n.x)) && Number.isFinite(Number(n.y)));
  if (state.autoLayout && !hasPos) applyLayout();
}

export function addLink(fromId, toId) {
  pushHistory();

  // Al crear un enlace manual, se asume una nueva relación jerárquica.
  // Se actualiza el `parentId` del nodo de destino para evitar conectores duplicados
  // al exportar, asegurando que solo haya una fuente de verdad para la jerarquía.
  const toNode = state.nodes.find(n => n.id === toId);
  if (toNode) {
    toNode.parentId = fromId;
  }

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
  };

  state.links.push(link);
  state.selectedLinkId = link.id;
  state.selectedNodeId = null;
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