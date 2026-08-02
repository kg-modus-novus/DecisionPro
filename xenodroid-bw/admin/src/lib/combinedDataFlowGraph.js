/**
 * Merge selected Data Flow catalog rows into one bottom-up graph:
 * Evidence Rooms (top) → Cubes → DTP / Detail DSO / Transformation / PSA (bottom).
 */
import { EVIDENCE_ROOM_TITLES, roomsForMeasures } from './measureRoomConsumers.js';

export const LAYER_ORDER = ['psa', 'transformation', 'detailDso', 'dtp', 'cube', 'evidenceRoom'];

function statusRank(status) {
  if (status === 'error') return 4;
  if (status === 'active') return 3;
  if (status === 'completed') return 2;
  return 1;
}

function mergeStatus(a, b) {
  return statusRank(a) >= statusRank(b) ? a : b;
}

function nodeKey(node) {
  return `${node.type}::${node.technicalName || node.id}`;
}

function synthesizePlannedChain(row) {
  const src = row.sourceSystem || 'UNKNOWN';
  const status = 'upcoming';
  return [
    {
      id: `psa-${row.id}`,
      type: 'psa',
      technicalName: `PSA_${src}`,
      titleKey: 'psa',
      title: `PSA · ${src}`,
      meta: row.status === 'planned' ? 'Planned path' : 'Catalog stub',
      status,
      detail: { layer: 'PSA', fromSysId: src, planned: true },
    },
    {
      id: `trfn-${row.id}`,
      type: 'transformation',
      technicalName: `TRFN_${row.id.toUpperCase().replace(/-/g, '_')}`,
      titleKey: 'transformation',
      title: `TRFN_${row.id}`,
      meta: 'Not yet modeled',
      status,
      detail: { layer: 'Transformation', planned: true },
    },
    {
      id: `dso-${row.id}`,
      type: 'detailDso',
      technicalName: `DSO_${row.id.toUpperCase().replace(/-/g, '_')}`,
      titleKey: 'detailDso',
      title: `DSO_${row.id}`,
      meta: 'Planned Detail DSO',
      status,
      detail: { layer: 'Detail DSO', planned: true },
    },
    {
      id: `dtp-${row.id}`,
      type: 'dtp',
      technicalName: `DTP_${row.id.toUpperCase().replace(/-/g, '_')}`,
      titleKey: 'dtp',
      title: `DTP_${row.id}`,
      meta: 'Planned DTP',
      status,
      detail: { layer: 'DTP', planned: true },
    },
    {
      id: `cube-${row.id}`,
      type: 'cube',
      technicalName: row.targetCube || 'CUBE_EXEC_LANDING',
      titleKey: 'cube',
      title: row.targetCube || 'CUBE_EXEC_LANDING',
      meta: (row.measures || []).join(' · ') || 'measures TBD',
      status,
      detail: { layer: 'Cube', measures: row.measures || [], planned: true },
    },
  ];
}

function chainNodesForRow(row, dataFlows) {
  const canvasId = row.canvasId || row.id;
  const flow = dataFlows?.[canvasId];
  if (flow?.nodes?.length) {
    return flow.nodes
      .filter((n) => n.type !== 'report')
      .map((n) => ({
        ...n,
        flowId: row.id,
        flowTitle: row.title || flow.title,
      }));
  }
  return synthesizePlannedChain(row).map((n) => ({
    ...n,
    flowId: row.id,
    flowTitle: row.title,
  }));
}

function ensureRoomPair(upsertNode, roomId) {
  const roomCubeTech = `CUBE_ROOM_${roomId.toUpperCase().replace(/-/g, '_')}`;
  const roomCubeId = upsertNode({
    id: `cube-room-${roomId}`,
    type: 'cube',
    technicalName: roomCubeTech,
    titleKey: 'cube',
    title: `Cube · ${roomId}`,
    meta: 'Evidence Room cube',
    status: 'completed',
    detail: { layer: 'Cube', roomId, kind: 'room' },
  });
  const roomNodeId = upsertNode({
    id: `room-${roomId}`,
    type: 'evidenceRoom',
    technicalName: `ROOM_${roomId}`,
    titleKey: 'evidenceRoom',
    title: EVIDENCE_ROOM_TITLES[roomId] || roomId,
    meta: roomId,
    status: 'completed',
    detail: { layer: 'Evidence Room', roomId },
  });
  return { roomCubeId, roomNodeId };
}

/**
 * @param {Array<object>} selectedRows catalog rows
 * @param {Record<string, object>} dataFlows canvas graphs by id
 */
export function buildCombinedDataFlowGraph(selectedRows, dataFlows) {
  const rows = selectedRows || [];
  if (!rows.length) {
    return {
      id: 'combined',
      title: 'Combined data flows',
      subtitle: 'Select one or more flows to diagram',
      nodes: [],
      edges: [],
      selectedFlowIds: [],
    };
  }

  const nodesByKey = new Map();
  const edges = [];

  function upsertNode(node) {
    const key = nodeKey(node);
    const existing = nodesByKey.get(key);
    if (!existing) {
      const created = {
        ...node,
        id: key.replace(/[^a-zA-Z0-9_-]/g, '_'),
        flows: node.flowId ? [node.flowId] : [],
      };
      nodesByKey.set(key, created);
      return created.id;
    }
    existing.status = mergeStatus(existing.status, node.status);
    if (node.meta && (!existing.meta || existing.meta.length < node.meta.length)) {
      existing.meta = node.meta;
    }
    if (node.flowId && !existing.flows.includes(node.flowId)) {
      existing.flows.push(node.flowId);
    }
    return existing.id;
  }

  const roomLinkKeys = new Set();

  for (const row of rows) {
    const chain = chainNodesForRow(row, dataFlows);
    const ids = chain.map((n) => upsertNode(n));
    for (let i = 0; i < ids.length - 1; i += 1) {
      edges.push({ from: ids[i], to: ids[i + 1], kind: 'pipeline' });
    }

    const feedId =
      [...ids].reverse().find((id) => {
        const n = [...nodesByKey.values()].find((x) => x.id === id);
        return n && (n.type === 'cube' || n.type === 'detailDso' || n.type === 'dtp');
      }) || ids[ids.length - 1];

    for (const roomId of roomsForMeasures(row.measures || [])) {
      const { roomCubeId, roomNodeId } = ensureRoomPair(upsertNode, roomId);
      const toCube = `${feedId}->${roomCubeId}`;
      const toRoom = `${roomCubeId}->${roomNodeId}`;
      if (!roomLinkKeys.has(toCube)) {
        roomLinkKeys.add(toCube);
        edges.push({ from: feedId, to: roomCubeId, kind: 'to-room-cube' });
      }
      if (!roomLinkKeys.has(toRoom)) {
        roomLinkKeys.add(toRoom);
        edges.push({ from: roomCubeId, to: roomNodeId, kind: 'feeds-room' });
      }
    }
  }

  const edgeKeys = new Set();
  const uniqueEdges = [];
  for (const e of edges) {
    const k = `${e.from}->${e.to}`;
    if (edgeKeys.has(k) || e.from === e.to) continue;
    edgeKeys.add(k);
    uniqueEdges.push(e);
  }

  const nodes = [...nodesByKey.values()].map((n) => ({
    ...n,
    meta:
      n.flows?.length > 1
        ? `${n.meta || ''}${n.meta ? ' · ' : ''}${n.flows.length} flows`.trim()
        : n.meta,
  }));

  const titles = rows.map((r) => r.technicalName || r.title).filter(Boolean);
  return {
    id: 'combined',
    title: 'Combined data flows',
    subtitle: `${titles.length} selected · ${titles.join(' · ')}`,
    nodes,
    edges: uniqueEdges,
    selectedFlowIds: rows.map((r) => r.id),
    layerOrder: LAYER_ORDER,
  };
}
