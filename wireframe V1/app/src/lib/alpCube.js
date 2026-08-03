/**
 * Evidence Room cube engine — public REAL / Gap rows from XenoDroid BW export.
 * Synthetic hash expansion is disabled on the demo path (DP-DEC-001 revised).
 */

import { ROOM_CUBES_REAL } from '../data/alp/roomCubes.real.js';
import { primarySourcesForRoom } from '../data/alp/primarySources.js';
import { PERIODS } from '../data/alp/dimensions.js';
import { SEED_CUBES } from '../data/alp/seedCubes.js';
import { periodMatchesFilter } from './periodScale.js';

const cache = new Map();

export function getSessionSeed() {
  return 0;
}

export function clearCubeCache() {
  cache.clear();
}

function memo(key, factory) {
  if (cache.has(key)) return cache.get(key);
  const value = factory();
  cache.set(key, value);
  return value;
}

/** Normalize a dimension filter value to a sorted unique id list. */
export function asFilterIds(value) {
  if (value == null || value === '' || value === 'all') return [];
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.filter((v) => v != null && v !== '' && v !== 'all'))].sort();
}

/**
 * Toggle a dimension value for Fiori-style additive visual filters.
 * First click adds; second click removes; empty clears the dimension.
 */
export function toggleDimensionFilter(filters = {}, key, id) {
  if (!key || id == null || id === '' || id === 'all') return { ...filters };
  const current = asFilterIds(filters[key]);
  const nextIds = current.includes(id) ? current.filter((x) => x !== id) : [...current, id].sort();
  const next = { ...filters };
  if (!nextIds.length) delete next[key];
  else if (nextIds.length === 1) next[key] = nextIds[0];
  else next[key] = nextIds;
  return next;
}

/** Filters for a visual-filter chart — omit its own dimension so selection highlights instead of collapsing the series. */
export function filtersExcludingDimension(filters = {}, dimensionKey) {
  if (!dimensionKey) return { ...(filters || {}) };
  const next = { ...(filters || {}) };
  delete next[dimensionKey];
  return next;
}

function activeFilters(filters = {}) {
  const out = {};
  for (const [k, v] of Object.entries(filters || {})) {
    const ids = asFilterIds(v);
    if (!ids.length) continue;
    out[k] = ids.length === 1 ? ids[0] : ids;
  }
  return out;
}

function filterKey(filters) {
  const active = activeFilters(filters);
  const normalized = Object.fromEntries(
    Object.keys(active)
      .sort()
      .map((k) => [k, asFilterIds(active[k])]),
  );
  return JSON.stringify(normalized);
}

function roomRows(roomId) {
  return ROOM_CUBES_REAL?.rooms?.[roomId] || [];
}

/** Distinct catalogue FromSysIDs feeding REAL/Gap rows in an Evidence Room cube. */
export function catalogueFromSysIdsForRoom(roomId) {
  const ids = new Set();
  for (const row of roomRows(roomId)) {
    const id = String(row?.fromSysId || '').trim();
    if (id) ids.add(id);
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function rowMatchesFilters(row, filters) {
  const active = activeFilters(filters);
  for (const [dim, value] of Object.entries(active)) {
    const ids = asFilterIds(value);
    if (!ids.length) continue;
    const rowVal = row[dim];
    if (rowVal == null || rowVal === '' || rowVal === 'all') continue;
    if (dim === 'period') {
      if (!periodMatchesFilter(rowVal, ids, PERIODS)) return false;
      continue;
    }
    if (!ids.includes(rowVal)) return false;
  }
  return true;
}

function enrichRow(row, roomId) {
  const seedMeta = SEED_CUBES[roomId] || {};
  return {
    ...row,
    owner: row.owner || seedMeta.owner || row.fromSysId || 'XenoDroid BW',
    actions: seedMeta.actions || ['Open provenance', 'Blend finding'],
    primarySources: primarySourcesForRoom(roomId),
    explanation:
      row.rowKind === 'GAP'
        ? `${row.title}: labeled Gap — ${row.displayValue || 'requires authorized data'}. No synthetic magnitude.`
        : `${row.title}: public REAL aggregate/meta from ${row.fromSysId || 'catalog'} as of ${row.asOfDate || 'n/a'}.`,
    dollarImpactM: row.metricKey === 'dollarImpactM' ? row.metricValue : row.dollarImpactM,
    contributionM: row.contributionM ?? (row.metricKey === 'contributionM' ? row.metricValue : undefined),
    spendM: row.spendM,
    rate: row.rate ?? (row.metricKey === 'rate' ? row.metricValue : undefined),
    peerRate: row.peerRate ?? row.peerPct ?? null,
    peerPct: row.peerPct ?? row.peerRate ?? null,
    trendPts: row.trendPts ?? null,
    kyValue: row.kyValue ?? row.rate ?? null,
    withholdingM: row.withholdingM ?? (row.metricKey === 'withholdingM' ? row.metricValue : undefined),
    riskAdjPct: row.riskAdjPct ?? (row.metricKey === 'riskAdjPct' ? row.metricValue : undefined),
    value: row.value ?? (row.metricKey === 'value' ? row.metricValue : undefined),
    gapPts: row.gapPts ?? (row.metricKey === 'gapPts' ? row.metricValue : undefined),
    count: row.metricKey === 'count' ? 1 : row.count,
  };
}

/** Retained for TEST harness imports; not used for demo magnitudes. */
export function hashUnit() {
  return 0;
}

export function splitTotal(total, keys) {
  if (!keys.length) return [];
  const each = total / keys.length;
  return keys.map((id) => ({ id, value: Math.round(each * 100) / 100 }));
}

export function queryAggregates(roomId, filters, dimensionKey, metricMode = 'metric') {
  const key = `agg|${roomId}|${filterKey(filters)}|${dimensionKey}|${metricMode}`;
  return memo(key, () => {
    const rows = roomRows(roomId).filter((r) => rowMatchesFilters(r, filters));
    const buckets = new Map();
    for (const row of rows) {
      const dimVal = row[dimensionKey] || 'all';
      if (!buckets.has(dimVal)) buckets.set(dimVal, { id: dimVal, value: 0, count: 0 });
      const b = buckets.get(dimVal);
      b.count += 1;
      if (metricMode === 'count') b.value += 1;
      else if (row.metricValue != null && !Number.isNaN(Number(row.metricValue))) {
        b.value += Number(row.metricValue);
      }
    }
    return [...buckets.values()].filter((b) => b.id !== 'all' && b.id !== 'statewide');
  });
}

export function listSlice(roomId, filters, { page = 0, pageSize = 50 } = {}) {
  const key = `list|${roomId}|${filterKey(filters)}|${page}|${pageSize}`;
  return memo(key, () => {
    const all = roomRows(roomId)
      .filter((r) => rowMatchesFilters(r, filters))
      .map((r) => enrichRow(r, roomId));
    const totalCount = all.length;
    const start = page * pageSize;
    const rows = all.slice(start, start + pageSize);
    return {
      rows,
      totalCount,
      representedClaimLines: 0,
      page,
      pageSize,
      realHydration: true,
    };
  });
}

export function getObject(roomId, id) {
  const key = `obj|${roomId}|${id}`;
  return memo(key, () => {
    const found = roomRows(roomId).find((r) => r.id === id);
    if (found) return enrichRow(found, roomId);
    return null;
  });
}

export function decodeId(id) {
  return { roomId: null, id };
}

/**
 * Related items for Gap/REAL object pages — only other REAL/Gap rows, never synthetic claim lines.
 */
export function listChildLineItems(row, count = 8) {
  if (!row?.roomId) return [];
  const siblings = roomRows(row.roomId)
    .filter((r) => r.id !== row.id)
    .slice(0, count)
    .map((r, i) => ({
      id: `${row.id}::rel::${i}`,
      parentId: row.id,
      lineNo: i + 1,
      kind: r.rowKind === 'GAP' ? 'Gap object' : 'Related REAL row',
      label: r.title,
      amount: r.metricValue,
      sharePct: null,
      period: r.asOfDate || r.period || '',
      owner: r.fromSysId || '',
      status: r.rowKind,
    }));
  return siblings;
}

export function scaleCue(roomId, filters) {
  const { totalCount } = listSlice(roomId, filters, { page: 0, pageSize: 1 });
  const real = roomRows(roomId).filter((r) => r.rowKind === 'REAL' && rowMatchesFilters(r, filters)).length;
  const gaps = roomRows(roomId).filter((r) => r.rowKind === 'GAP' && rowMatchesFilters(r, filters)).length;
  return {
    totalCount,
    representedClaimLines: 0,
    realCount: real,
    gapCount: gaps,
  };
}

