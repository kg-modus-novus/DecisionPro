/**
 * Session-cached procedural cube engine.
 * High-level seeds expand into aggregates, list rows, and object pages on demand.
 */

import {
  ATTENTION,
  CONTRACT_CLASSES,
  COUNTIES,
  FRESHNESS,
  MCOS,
  MEASURE_TYPES,
  PERIODS,
  POPULATIONS,
  PROVIDER_GROUPS,
  REGIONS,
  SERVICE_CATEGORIES,
  labelOf,
} from '../data/alp/dimensions.js';
import { BENCHMARK_TYPES, SEED_CUBES } from '../data/alp/seedCubes.js';
import {
  primarySourcesForRoom,
  primarySourcesForSourceLabel,
} from '../data/alp/primarySources.js';

const SESSION_SEED = (Math.floor(Math.random() * 1e9) + 1) >>> 0;
const cache = new Map();

const DIM_OPTIONS = {
  population: POPULATIONS,
  region: REGIONS,
  period: PERIODS,
  mco: MCOS,
  service: SERVICE_CATEGORIES,
  attention: ATTENTION,
  freshness: FRESHNESS,
  measureType: MEASURE_TYPES,
  contractClass: CONTRACT_CLASSES,
  providerGroup: PROVIDER_GROUPS,
  county: COUNTIES,
  benchmarkType: BENCHMARK_TYPES,
};

export function getSessionSeed() {
  return SESSION_SEED;
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

/** Stable unit float in [0, 1). */
export function hashUnit(seed, ...parts) {
  let h = seed >>> 0;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  h >>>= 0;
  return (h % 1000000) / 1000000;
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

function dimensionKeys(dim, weights) {
  const opts = DIM_OPTIONS[dim] || [];
  const fromWeights = weights?.[dim] ? Object.keys(weights[dim]) : [];
  if (fromWeights.length) return fromWeights;
  return opts.map((o) => o.id).filter((id) => id !== 'all' && id !== 'statewide');
}

/**
 * Split total across keys using weights * hash noise; last slice reconciles.
 */
export function splitTotal(total, keys, seed, salt, weightMap = {}) {
  if (!keys.length) return [];
  const raw = keys.map((key) => {
    const w = weightMap[key] ?? 1 / keys.length;
    const jitter = 0.55 + hashUnit(seed, salt, key) * 0.9;
    return Math.max(0.0001, w * jitter);
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  const values = raw.map((r) => (r / sum) * total);
  const rounded = values.map((v, i) => (i === values.length - 1 ? 0 : Math.round(v * 100) / 100));
  const used = rounded.reduce((a, b) => a + b, 0);
  rounded[rounded.length - 1] = Math.round((total - used) * 100) / 100;
  return keys.map((id, i) => ({ id, value: rounded[i] }));
}

function dimensionWeightFactor(cube, dim, ids) {
  if (!ids.length) return 1;
  let factor = 0;
  for (const value of ids) {
    const w = cube.weights?.[dim]?.[value];
    if (typeof w === 'number') factor += w;
    else factor += 0.12 + hashUnit(SESSION_SEED, cube.metricKey, dim, value) * 0.25;
  }
  return Math.max(0.02, Math.min(1, factor));
}

function filteredTotal(cube, filters) {
  let total = cube.baseTotal;
  const active = activeFilters(filters);
  for (const [dim, value] of Object.entries(active)) {
    total *= dimensionWeightFactor(cube, dim, asFilterIds(value));
  }
  return Math.max(1, total);
}

function filteredCount(cube, filters) {
  let count = cube.listBaseCount;
  const active = activeFilters(filters);
  // Narrow by filtered dimensions; multi-select within a dim is OR (less narrow).
  let narrow = 0;
  for (const [dim, value] of Object.entries(active)) {
    const ids = asFilterIds(value);
    narrow += 1 / Math.max(1, ids.length);
  }
  count = Math.round(count * Math.pow(0.42, narrow));
  count = Math.max(120, Math.min(cube.listBaseCount, count));
  const jitter = 0.85 + hashUnit(SESSION_SEED, 'count', filterKey(filters), cube.metricKey) * 0.3;
  return Math.round(count * jitter);
}

export function queryAggregates(roomId, filters, dimensionKey, metricMode = 'metric') {
  const cube = SEED_CUBES[roomId];
  if (!cube) return [];
  const key = `agg|${roomId}|${filterKey(filters)}|${dimensionKey}|${metricMode}|all`;
  return memo(key, () => {
    const keys = dimensionKeys(dimensionKey, cube.weights);
    const active = activeFilters(filters);
    // Fiori visual filters keep every dimension value visible; selection is a highlight only.
    // Exclude this dimension from the parent so selecting a value does not collapse the chart.
    const parentFilters = { ...active };
    delete parentFilters[dimensionKey];
    const parentTotal =
      metricMode === 'count' ? filteredCount(cube, parentFilters) : filteredTotal(cube, parentFilters);
    return splitTotal(
      parentTotal,
      keys,
      SESSION_SEED,
      `${roomId}|${dimensionKey}|${filterKey(parentFilters)}|${metricMode}`,
      cube.weights?.[dimensionKey] || {},
    );
  });
}

function pickKeyed(keys, seed, salt) {
  if (!keys.length) return null;
  const idx = Math.floor(hashUnit(seed, salt) * keys.length) % keys.length;
  return keys[idx];
}

function encodeId(roomId, filters, index) {
  const body = JSON.stringify({ roomId, filters: activeFilters(filters), index });
  return btoa(unescape(encodeURIComponent(body))).replace(/=+$/, '');
}

export function decodeId(id) {
  try {
    const padded = id + '='.repeat((4 - (id.length % 4)) % 4);
    const raw = decodeURIComponent(escape(atob(padded)));
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildRow(roomId, filters, index) {
  const cube = SEED_CUBES[roomId];
  const active = activeFilters(filters);
  const salt = `${roomId}|row|${filterKey(filters)}|${index}`;

  const dims = {};
  for (const dim of Object.keys(cube.weights || {})) {
    const selected = asFilterIds(active[dim]);
    if (selected.length) dims[dim] = pickKeyed(selected, SESSION_SEED, `${salt}|${dim}`);
    else dims[dim] = pickKeyed(dimensionKeys(dim, cube.weights), SESSION_SEED, `${salt}|${dim}`);
  }

  const titleBase = cube.titles[Math.floor(hashUnit(SESSION_SEED, salt, 'title') * cube.titles.length) % cube.titles.length];
  const popLabel = labelOf(POPULATIONS, dims.population) || dims.population || '';
  const regionLabel = labelOf(REGIONS, dims.region) || dims.region || '';
  const serviceLabel = labelOf(SERVICE_CATEGORIES, dims.service) || '';
  const title =
    roomId === 'cost-drivers'
      ? `${serviceLabel || titleBase} — ${popLabel}`
      : roomId === 'county'
        ? `${labelOf(COUNTIES, dims.county) || 'County'} (${COUNTIES.find((c) => c.id === dims.county)?.district || 'HD'}) — ${titleBase}`
        : roomId === 'mco'
          ? `${labelOf(MCOS, dims.mco)} — ${titleBase}`
          : roomId === 'provider'
            ? `${labelOf(PROVIDER_GROUPS, dims.providerGroup)} — ${popLabel}`
            : roomId === 'benchmarks'
              ? `${titleBase} vs ${labelOf(BENCHMARK_TYPES, dims.benchmarkType)}`
              : roomId === 'measure-definitions'
                ? titleBase
                : `${titleBase}${regionLabel ? ` (${regionLabel})` : ''}`;

  const metricTotal = filteredTotal(cube, filters);
  const listCount = filteredCount(cube, filters);
  const share = (0.35 + hashUnit(SESSION_SEED, salt, 'share')) / Math.max(20, Math.sqrt(listCount));
  const primary = Math.max(1, Math.round(metricTotal * share * 100) / 100);
  const deltaPct = Math.round((-12 + hashUnit(SESSION_SEED, salt, 'delta') * 28) * 10) / 10;

  const row = {
    id: encodeId(roomId, filters, index),
    roomId,
    title,
    ...dims,
    owner: cube.owner,
    explanation: '',
    actions: cube.actions,
  };

  // Room-specific metrics
  if (cube.metricKey === 'dollarImpactM') {
    row.dollarImpactM = primary;
    row.deltaPct = deltaPct;
    row.magnitude = Math.round(40 + hashUnit(SESSION_SEED, salt, 'mag') * 55);
  } else if (cube.metricKey === 'contributionM') {
    row.contributionM = primary;
    row.spendM = Math.round(primary * (8 + hashUnit(SESSION_SEED, salt, 'spend') * 20));
    row.growthPct = Math.round(deltaPct);
    row.pmpm = Math.round(250 + hashUnit(SESSION_SEED, salt, 'pmpm') * 1600);
    row.controllable = ['high', 'medium', 'low'][Math.floor(hashUnit(SESSION_SEED, salt, 'ctrl') * 3)];
  } else if (cube.metricKey === 'rate' && roomId === 'utilization') {
    row.rate = Math.round(primary);
    row.deltaPct = deltaPct;
    row.distanceMiles = Math.round(6 + hashUnit(SESSION_SEED, salt, 'miles') * 28);
  } else if (cube.metricKey === 'rate' && roomId === 'outcomes') {
    row.rate = Math.round(45 + hashUnit(SESSION_SEED, salt, 'rate') * 40);
    row.peerRate = row.rate - 6 + Math.round(hashUnit(SESSION_SEED, salt, 'peer') * 12);
    row.trendPts = Math.round((-3 + hashUnit(SESSION_SEED, salt, 'trend') * 8) * 10) / 10;
  } else if (cube.metricKey === 'withholdingM') {
    row.withholdingM = primary;
    row.enrollmentK = Math.round(180 + hashUnit(SESSION_SEED, salt, 'enr') * 140);
    row.pmpm = Math.round(620 + hashUnit(SESSION_SEED, salt, 'pmpm') * 120);
    row.earnedBack = ['earned', 'partial', 'not-earned'][Math.floor(hashUnit(SESSION_SEED, salt, 'earn') * 3)];
    row.missedCount = Math.floor(hashUnit(SESSION_SEED, salt, 'miss') * 8);
  } else if (cube.metricKey === 'riskAdjPct') {
    row.riskAdjPct = Math.round(55 + hashUnit(SESSION_SEED, salt, 'risk') * 35);
    row.unadjPct = row.riskAdjPct + Math.round(-8 + hashUnit(SESSION_SEED, salt, 'unadj') * 14);
    row.socialRisk = ['high', 'elevated', 'moderate'][Math.floor(hashUnit(SESSION_SEED, salt, 'soc') * 3)];
    row.readmitPct = Math.round(10 + hashUnit(SESSION_SEED, salt, 'read') * 10);
  } else if (cube.metricKey === 'value') {
    row.value = Math.round(primary);
    row.vsStatePct = Math.round((-14 + hashUnit(SESSION_SEED, salt, 'vs') * 28) * 10) / 10;
    row.district = COUNTIES.find((c) => c.id === dims.county)?.district || 'HD-00';
  } else if (cube.metricKey === 'gapPts') {
    row.kyValue = Math.round(55 + hashUnit(SESSION_SEED, salt, 'ky') * 25);
    row.benchmarkValue = Math.round(row.kyValue - 10 + hashUnit(SESSION_SEED, salt, 'bm') * 20);
    row.gapPts = Math.round((row.kyValue - row.benchmarkValue) * 10) / 10;
    row.measure = titleBase;
  } else if (cube.metricKey === 'count') {
    row.source = ['Claims warehouse', 'HEDIS-style', 'Contract files', 'Encounter feeds'][
      Math.floor(hashUnit(SESSION_SEED, salt, 'src') * 4)
    ];
    row.refreshCadence = hashUnit(SESSION_SEED, salt, 'cad') > 0.5 ? 'Monthly' : 'Quarterly';
    row.limitation = ['Run-out lag', 'Algorithm interpretive', 'National peer lag'][
      Math.floor(hashUnit(SESSION_SEED, salt, 'lim') * 3)
    ];
    row.owner = cube.owner;
    row.primarySources = primarySourcesForSourceLabel(row.source);
  }

  if (!row.primarySources?.length) {
    row.primarySources = cube.primarySources?.length
      ? cube.primarySources.map((s) => ({ ...s }))
      : primarySourcesForRoom(roomId);
  }

  row.explanation = `${row.title}: aggregate rollup under current filters. Owner ${cube.owner}. Values refresh per measure cadence from the Kentucky Medicaid claims warehouse and linked quality feeds. Primary government sources are listed on this object page for provenance.`;
  return row;
}

export function listSlice(roomId, filters, { page = 0, pageSize = 50 } = {}) {
  const cube = SEED_CUBES[roomId];
  if (!cube) {
    return { rows: [], totalCount: 0, representedClaimLines: 0, page, pageSize };
  }
  const key = `list|${roomId}|${filterKey(filters)}|${page}|${pageSize}`;
  return memo(key, () => {
    const totalCount = filteredCount(cube, filters);
    const start = page * pageSize;
    const end = Math.min(totalCount, start + pageSize);
    const rows = [];
    for (let i = start; i < end; i += 1) {
      rows.push(buildRow(roomId, filters, i));
    }
    const representedClaimLines = Math.round(
      totalCount * cube.claimLineFactor * (40 + hashUnit(SESSION_SEED, 'claims', roomId, filterKey(filters)) * 80),
    );
    return { rows, totalCount, representedClaimLines, page, pageSize };
  });
}

export function getObject(roomId, id) {
  const key = `obj|${roomId}|${id}`;
  return memo(key, () => {
    const decoded = decodeId(id);
    if (!decoded || decoded.roomId !== roomId) {
      // Fallback: treat as opaque and rebuild from hash only
      return buildRow(roomId, {}, Math.abs(id.length * 17) % 500);
    }
    return buildRow(decoded.roomId, decoded.filters, decoded.index);
  });
}

/**
 * Synthetic child / related line items under an aggregate object (Fiori object-page list area).
 */
export function listChildLineItems(row, count = 8) {
  if (!row?.roomId) return [];
  const cube = SEED_CUBES[row.roomId];
  if (!cube) return [];
  const n = Math.max(3, Math.min(12, count));
  const items = [];
  for (let i = 0; i < n; i += 1) {
    const salt = `${row.id}|child|${i}`;
    const share = 0.04 + hashUnit(SESSION_SEED, salt, 'share') * 0.18;
    const base =
      row.dollarImpactM ??
      row.contributionM ??
      row.spendM ??
      row.withholdingM ??
      row.value ??
      10;
    const amount = Math.round(Number(base) * share * 100) / 100;
    const kinds = [
      'Claim line rollup',
      'Encounter cluster',
      'Pharmacy fill group',
      'Provider invoice slice',
      'Utilization episode',
      'Quality event bundle',
      'Auth / referral set',
      'Adjustment batch',
    ];
    const kind = kinds[Math.floor(hashUnit(SESSION_SEED, salt, 'kind') * kinds.length) % kinds.length];
    items.push({
      id: `${row.id}::line::${i}`,
      parentId: row.id,
      lineNo: i + 1,
      kind,
      label: `${kind} ${i + 1} — ${row.title}`,
      amount,
      sharePct: Math.round(share * 1000) / 10,
      period: row.period || 'fy25q3',
      owner: row.owner || cube.owner,
      status: hashUnit(SESSION_SEED, salt, 'status') > 0.72 ? 'Watch' : 'In scope',
    });
  }
  return items;
}

export function scaleCue(roomId, filters) {
  const cube = SEED_CUBES[roomId];
  if (!cube) return '';
  const { totalCount, representedClaimLines } = listSlice(roomId, filters, { page: 0, pageSize: 1 });
  return {
    totalCount,
    representedClaimLines,
  };
}
