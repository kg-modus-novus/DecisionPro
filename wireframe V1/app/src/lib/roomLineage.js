/**
 * Filter-aware Data Lineage & Provenance model for Evidence Room ALPs.
 * Bottom-up stack: PSA sources → Transformation → Detail DSO → Aggregate → Query.
 * Record counts reflect the current visual-filter criteria (REAL/Gap cube rows).
 */

import { ROOM_CONFIGS } from '../data/alp/roomConfigs.js';
import { asFilterIds, listSlice } from './alpCube.js';

const ROOM_TECH = {
  'command-center': {
    dso: 'DSO_COMMAND_FINDINGS',
    cube: 'CUBE_COMMAND_CENTER',
    query: 'Q_COMMAND_CENTER',
    trfn: 'TRFN_COMMAND_CLEANSE',
  },
  'cost-drivers': {
    dso: 'DSO_COST_DRIVERS',
    cube: 'CUBE_COST_DRIVERS',
    query: 'Q_COST_DRIVERS',
    trfn: 'TRFN_COST_CLEANSE',
  },
  utilization: {
    dso: 'DSO_UTILIZATION_ACCESS',
    cube: 'CUBE_UTILIZATION',
    query: 'Q_UTILIZATION',
    trfn: 'TRFN_UTIL_CLEANSE',
  },
  outcomes: {
    dso: 'DSO_OUTCOMES_QUALITY',
    cube: 'CUBE_OUTCOMES',
    query: 'Q_OUTCOMES',
    trfn: 'TRFN_OUTCOMES_CLEANSE',
  },
  mco: {
    dso: 'DSO_MCO_ROSTER',
    cube: 'CUBE_MCO_ACCOUNTABILITY',
    query: 'Q_MCO_ACCOUNTABILITY',
    trfn: 'TRFN_MCO_ROSTER',
  },
  provider: {
    dso: 'DSO_PROVIDER_DELIVERY',
    cube: 'CUBE_PROVIDER',
    query: 'Q_PROVIDER',
    trfn: 'TRFN_PROVIDER_CLEANSE',
  },
  county: {
    dso: 'DSO_COUNTY_MEMBERSHIP',
    cube: 'CUBE_COUNTY_DISTRICT',
    query: 'Q_COUNTY_DISTRICT',
    trfn: 'TRFN_COUNTY_CLEANSE',
  },
  benchmarks: {
    dso: 'DSO_BENCHMARKS',
    cube: 'CUBE_BENCHMARKS',
    query: 'Q_BENCHMARKS',
    trfn: 'TRFN_BENCH_CLEANSE',
  },
  'measure-definitions': {
    dso: 'DSO_MEASURE_DEFS',
    cube: 'CUBE_MEASURE_DEFS',
    query: 'Q_MEASURE_DEFS',
    trfn: 'TRFN_DEFS_CLEANSE',
  },
};

function techFor(roomId) {
  return (
    ROOM_TECH[roomId] || {
      dso: `DSO_${String(roomId).toUpperCase().replace(/-/g, '_')}`,
      cube: `CUBE_${String(roomId).toUpperCase().replace(/-/g, '_')}`,
      query: `Q_${String(roomId).toUpperCase().replace(/-/g, '_')}`,
      trfn: `TRFN_${String(roomId).toUpperCase().replace(/-/g, '_')}_CLEANSE`,
    }
  );
}

function filterSummary(filters = {}) {
  const parts = Object.entries(filters || {}).flatMap(([key, value]) =>
    asFilterIds(value).map((id) => `${key}=${id}`),
  );
  return parts.length ? parts.join(' · ') : 'No adapted filters (full room cube)';
}

/**
 * Build a bottom-up lineage graph for an Evidence Room under current filters.
 */
export function buildRoomLineage(roomId, filters = {}) {
  const config = ROOM_CONFIGS[roomId];
  const tech = techFor(roomId);
  const probe = listSlice(roomId, filters, { page: 0, pageSize: 1 });
  const slice = listSlice(roomId, filters, {
    page: 0,
    pageSize: Math.max(probe.totalCount, 1),
  });
  const scoped = slice.rows;
  const realRows = scoped.filter((r) => r.rowKind === 'REAL');
  const gapRows = scoped.filter((r) => r.rowKind === 'GAP');

  const bySource = new Map();
  for (const row of scoped) {
    const key =
      row.rowKind === 'GAP'
        ? row.gapId || row.fromSysId || 'GAP'
        : row.fromSysId || 'UNKNOWN_SOURCE';
    if (!bySource.has(key)) {
      bySource.set(key, {
        fromSysId: key,
        kind: row.rowKind === 'GAP' ? 'gap' : 'real',
        rows: [],
      });
    }
    bySource.get(key).rows.push(row);
  }

  const sourceNodes = [...bySource.entries()]
    .sort((a, b) => {
      if (a[1].kind !== b[1].kind) return a[1].kind === 'gap' ? 1 : -1;
      return a[0].localeCompare(b[0]);
    })
    .map(([key, bucket]) => {
      const count = bucket.rows.length;
      const isGap = bucket.kind === 'gap';
      return {
        id: `psa-${key}`,
        layer: 'psa',
        type: 'psa',
        title: isGap ? 'Gap object' : 'PSA',
        technicalName: isGap ? key : `PSA_${key}`,
        fromSysId: isGap ? null : key,
        recordCount: count,
        rows: bucket.rows,
        status: count > 0 ? (isGap ? 'gap' : 'completed') : 'upcoming',
        meta: isGap
          ? 'Labeled Gap — no synthetic magnitude'
          : `${key} · public REAL`,
        detail: {
          layer: 'PSA / Data source',
          fromSysId: key,
          loadClass: isGap ? 'GAP' : 'REAL',
          recordCount: count,
          note: isGap
            ? 'Authorized or non-public feed required; count is Gap row cardinality under filters.'
            : 'PSA landings that contribute cube rows in the current filter scope.',
        },
      };
    });

  if (!sourceNodes.length) {
    sourceNodes.push({
      id: 'psa-empty',
      layer: 'psa',
      type: 'psa',
      title: 'PSA',
      technicalName: 'PSA_(no matching sources)',
      fromSysId: null,
      recordCount: 0,
      rows: [],
      status: 'upcoming',
      meta: 'No cube rows match current filters',
      detail: {
        layer: 'PSA / Data source',
        recordCount: 0,
        note: 'Widen or clear visual filters to restore source contributions.',
      },
    });
  }

  const realCount = realRows.length;
  const gapCount = gapRows.length;
  const totalCount = slice.totalCount;
  const queryCount = slice.totalCount;

  const pipeline = [
    {
      id: 'trfn',
      layer: 'transformation',
      type: 'transformation',
      title: 'Transformation',
      technicalName: tech.trfn,
      recordCount: realCount,
      rows: realRows,
      status: realCount > 0 ? 'completed' : 'upcoming',
      meta: 'Cleanse · period quality · AsOfDate',
      detail: {
        layer: 'Transformation',
        recordCount: realCount,
        note: 'REAL rows after cleanse under current filters (Gaps bypass this stage).',
      },
    },
    {
      id: 'dso',
      layer: 'dso',
      type: 'detailDso',
      title: 'Detail DSO',
      technicalName: tech.dso,
      recordCount: realCount,
      rows: realRows,
      status: realCount > 0 ? 'completed' : gapCount > 0 ? 'active' : 'upcoming',
      meta: `${realCount.toLocaleString()} REAL · ${gapCount.toLocaleString()} Gap`,
      detail: {
        layer: 'Detail DSO',
        recordCount: realCount,
        gapCount,
        note: 'Detail store cardinality for REAL rows in scope.',
      },
    },
    {
      id: 'aggregate',
      layer: 'aggregate',
      type: 'cube',
      title: 'Aggregate',
      technicalName: tech.cube,
      recordCount: totalCount,
      rows: scoped,
      status: totalCount > 0 ? 'active' : 'upcoming',
      meta: 'Warehouse cube · REAL + labeled Gaps',
      detail: {
        layer: 'Aggregate / Cube',
        recordCount: totalCount,
        realCount,
        gapCount,
        note: 'Filtered list cardinality for this Evidence Room cube.',
      },
    },
    {
      id: 'query',
      layer: 'query',
      type: 'report',
      title: 'Query',
      technicalName: tech.query,
      recordCount: queryCount,
      rows: scoped,
      status: queryCount > 0 ? 'active' : 'upcoming',
      meta: config?.title || roomId,
      detail: {
        layer: 'Query / Report',
        recordCount: queryCount,
        roomId,
        note: 'Rows returned to the Analytical List Page for the active filter criteria.',
      },
    },
  ];

  const nodes = [...sourceNodes, ...pipeline];
  const edges = [];
  for (const src of sourceNodes) {
    edges.push({ from: src.id, to: 'trfn' });
  }
  edges.push(
    { from: 'trfn', to: 'dso' },
    { from: 'dso', to: 'aggregate' },
    { from: 'aggregate', to: 'query' },
  );

  return {
    roomId,
    title: 'Data Lineage & Provenance',
    subtitle: `${config?.title || roomId} · PSA → DSO → Aggregate → Query`,
    filterSummary: filterSummary(filters),
    realCount,
    gapCount,
    totalCount,
    layers: {
      psa: sourceNodes,
      transformation: pipeline[0],
      dso: pipeline[1],
      aggregate: pipeline[2],
      query: pipeline[3],
    },
    nodes,
    edges,
  };
}
