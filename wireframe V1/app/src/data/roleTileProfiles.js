/**
 * Per-role Accurate Landing selection + presentation styles.
 * Matrix: docs/planning/smart-tile-style-catalog.md
 * Same measure can use different visuals by role. No invented magnitudes.
 */

import { ACCURATE_LANDING } from './alp/accurateLanding.js';
import { AUTHORITATIVE_SOURCES } from './alp/authoritativeSources.js';
import { COUNTIES, labelOf } from './alp/dimensions.js';
import { GAP_OBJECTS } from './alp/gapObjects.js';
import { ROOM_CUBES_REAL } from './alp/roomCubes.real.js';
import { formatMeasureComparison, formatMeasurePeriodLabel } from '../lib/measurePeriodLabel.js';

function measureById(id) {
  return (ACCURATE_LANDING.measures || []).find((m) => m.measureId === id);
}

/** Cap dense PI history on tiles; full series remains in ACCURATE_LANDING / Evidence Rooms. */
const TILE_SERIES_MAX_POINTS = 36;

/** REAL multi-period rows for a measure, oldest → newest. */
export function measureSeriesPoints(measureId) {
  let rows = (ACCURATE_LANDING.measureSeries || [])
    .filter((r) => r.measureId === measureId && Number.isFinite(Number(r.numericValue)))
    .slice()
    .sort((a, b) => String(a.asOfDate || '').localeCompare(String(b.asOfDate || '')));
  if (rows.length < 2) return null;
  if (rows.length > TILE_SERIES_MAX_POINTS) {
    rows = rows.slice(-TILE_SERIES_MAX_POINTS);
  }
  return {
    series: rows.map((r) => Number(r.numericValue)),
    seriesLabels: rows.map((r) => {
      const d = String(r.asOfDate || '');
      if (/^\d{4}-\d{2}/.test(d)) return d.slice(0, 7);
      return d || '';
    }),
  };
}

function catalogueCounts() {
  const sources = AUTHORITATIVE_SOURCES.sources || [];
  const loaded = sources.filter((s) => s.loadStatus === 'LOADED').length;
  const blocked = sources.filter((s) => s.loadStatus === 'BLOCKED').length;
  const catalogued = sources.filter((s) => s.loadStatus === 'CATALOGUED').length;
  const gaps = (GAP_OBJECTS.gaps || []).length;
  return { loaded, blocked, catalogued, gaps, total: sources.length };
}

function attachSeries(base, measureId) {
  const pts = measureSeriesPoints(measureId);
  if (!pts) return base;
  return { ...base, series: pts.series, seriesLabels: pts.seriesLabels };
}

const COUNTY_TOP_TONES = ['positive', 'warning', 'info'];
const COUNTY_BOTTOM_TONES = ['info', 'warning', 'warning'];

/** REAL county membership rows for the measure as-of (from County Evidence Room cube). */
function countyEnrollmentRows(measure) {
  const asOf = String(measure?.asOfDate || '');
  const rows = (ROOM_CUBES_REAL.rooms?.county || []).filter(
    (r) =>
      r.rowKind === 'REAL' &&
      r.measureId === 'M-003' &&
      Number.isFinite(Number(r.value ?? r.metricValue)) &&
      (!asOf || String(r.asOfDate || '') === asOf),
  );
  const byCounty = new Map();
  for (const row of rows) {
    const id = String(row.county || '');
    if (!id) continue;
    const value = Number(row.value ?? row.metricValue);
    const prev = byCounty.get(id);
    if (!prev || value > prev.value) {
      byCounty.set(id, {
        countyId: id,
        label: labelOf(COUNTIES, id) || row.title?.replace(/\s+County.*/i, '') || id,
        value,
      });
    }
  }
  return [...byCounty.values()];
}

/**
 * Ranked REAL county membership bars.
 * @param {'top'|'bottom'} [direction='top']
 */
export function rankedCountyEnrollmentBars(measure, { limit = 3, direction = 'top' } = {}) {
  const ranked = countyEnrollmentRows(measure).sort((a, b) =>
    direction === 'bottom' ? a.value - b.value : b.value - a.value,
  );
  const tones = direction === 'bottom' ? COUNTY_BOTTOM_TONES : COUNTY_TOP_TONES;
  return ranked.slice(0, limit).map((row, i) => ({
    label: row.label,
    value: row.value,
    display: row.value.toLocaleString(),
    tone: tones[i] || 'info',
    countyId: row.countyId,
  }));
}

/** @deprecated Prefer rankedCountyEnrollmentBars — kept for call-site clarity. */
export function topCountyEnrollmentBars(measure, limit = 3) {
  return rankedCountyEnrollmentBars(measure, { limit, direction: 'top' });
}

/**
 * Evidence Room drill-down for Accurate Landing body clicks.
 * Period year tokens expand in alpCube; county/service filters match REAL rows.
 */
export const MEASURE_EVIDENCE_DESTINATION = {
  'M-001': {
    view: 'evidence',
    roomId: 'command-center',
    filters: { period: 'y2026' },
    label: 'Open Command Center enrollment series',
  },
  'M-002': {
    view: 'evidence',
    roomId: 'command-center',
    filters: { period: 'y2026' },
    label: 'Open Command Center YoY enrollment',
  },
  'M-003': {
    view: 'evidence',
    roomId: 'county',
    filters: {},
    label: 'Open County & District (top counties)',
  },
  'M-004': {
    view: 'evidence',
    roomId: 'command-center',
    filters: {},
    label: 'Open Command Center expenditure row',
  },
  'M-007': {
    view: 'evidence',
    roomId: 'mco',
    filters: {},
    label: 'Open MCO Accountability roster',
  },
  'M-010': {
    view: 'evidence',
    roomId: 'outcomes',
    filters: { population: 'child', measureType: 'quality' },
    label: 'Open Outcomes (child quality)',
  },
  'M-011': {
    view: 'evidence',
    roomId: 'outcomes',
    filters: { population: 'adult', measureType: 'quality' },
    label: 'Open Outcomes (adult quality)',
  },
  'M-012': {
    view: 'evidence',
    roomId: 'outcomes',
    filters: { population: 'maternal', measureType: 'quality' },
    label: 'Open Outcomes (maternal quality)',
  },
  'M-014': {
    view: 'evidence',
    roomId: 'outcomes',
    filters: { measureType: 'quality' },
    label: 'Open Outcomes & Quality',
  },
  'M-017': {
    view: 'evidence',
    roomId: 'cost-drivers',
    filters: { service: 'pharmacy' },
    label: 'Open Cost Drivers (pharmacy)',
  },
  'M-020': {
    view: 'evidence',
    roomId: 'utilization',
    filters: { measureType: 'access' },
    label: 'Open Utilization & Access (HPSA context)',
  },
  'M-021': {
    view: 'evidence',
    roomId: 'measure-definitions',
    filters: {},
    label: 'Open Measure Definitions (ACS context)',
  },
  'M-022': {
    view: 'evidence',
    roomId: 'provider',
    filters: {},
    label: 'Open Provider & Delivery-System',
  },
  'M-023': {
    view: 'evidence',
    roomId: 'utilization',
    filters: {},
    label: 'Open Utilization & Access',
  },
  'M-028': {
    view: 'evidence',
    roomId: 'benchmarks',
    filters: {},
    label: 'Open Benchmarks',
  },
};

export function evidenceDestinationForMeasure(measureId, measure) {
  const mapped = MEASURE_EVIDENCE_DESTINATION[measureId];
  if (mapped) {
    return {
      destination: {
        view: mapped.view,
        roomId: mapped.roomId,
        filters: { ...(mapped.filters || {}) },
      },
      destinationLabel: mapped.label,
    };
  }
  const period = measure?.provenance?.periodId;
  return {
    destination: {
      view: 'evidence',
      roomId: 'command-center',
      filters: period ? { period } : {},
    },
    destinationLabel: 'Open related Evidence Room',
  };
}

function percentRadial(measure, base, caption) {
  const n = Number(measure.numericValue);
  if (!Number.isFinite(n)) return base;
  return {
    ...base,
    visual: 'radial',
    value: measure.displayValue?.includes('%') ? measure.displayValue : `${measure.displayValue}%`,
    unit: '',
    radial: { percent: n, caption: caption || 'of 100%' },
  };
}

/**
 * Build presentation props for a landing measure under a role visual.
 */
export function styleLandingMeasure(measure, visual, roleId, options = {}) {
  if (!measure) return null;
  const countyRank = options.countyRank === 'bottom' ? 'bottom' : 'top';
  // Prefer trend when REAL history exists, unless the profile uses a specialized non-trend visual.
  const seriesPts = measureSeriesPoints(measure.measureId);
  const keepSpecialMetric = ['M-003', 'M-004', 'M-007', 'M-014', 'M-022', 'M-023', 'M-028'].includes(
    measure.measureId,
  );
  let resolvedVisual = visual;
  if (
    seriesPts?.series?.length >= 2 &&
    (visual === 'areaTrend' || (visual === 'metric' && !keepSpecialMetric))
  ) {
    resolvedVisual = 'areaTrend';
  }
  const drill = evidenceDestinationForMeasure(measure.measureId, measure);
  const base = {
    measureId: measure.measureId,
    kind: `Accurate · REAL · ${measure.measureId}`,
    title: measure.name,
    semantic:
      measure.measureId === 'M-002' && typeof measure.numericValue === 'number' && measure.numericValue < 0
        ? 'negative'
        : measure.measureId === 'M-007'
          ? 'info'
          : measure.measureId === 'M-017'
            ? 'negative'
            : 'positive',
    visual: resolvedVisual,
    value: measure.displayValue,
    unit: measure.unit,
    comparison: formatMeasureComparison(measure) || `As of ${measure.asOfDate} · ${measure.fromSysId}`,
    why: measure.definition || 'Published public source loaded through XenoDroid BW — not a synthetic fixture.',
    destination: drill.destination,
    destinationLabel: drill.destinationLabel,
    trustLabel: 'Why trust this number?',
    measure,
  };

  if (resolvedVisual === 'areaTrend') {
    const withSeries = attachSeries(base, measure.measureId);
    if (!withSeries.series) {
      return { ...base, visual: 'metric' };
    }
    if (measure.measureId === 'M-002') {
      return {
        ...withSeries,
        direction: Number(measure.numericValue) < 0 ? 'down' : 'up',
      };
    }
    return withSeries;
  }

  if (resolvedVisual === 'radial') {
    return percentRadial(measure, base, measure.unit === 'percent' ? 'published rate' : undefined);
  }

  if (visual === 'bullet' && measure.measureId === 'M-002') {
    const yoy = Number(measure.numericValue);
    return {
      ...base,
      direction: yoy < 0 ? 'down' : yoy > 0 ? 'up' : 'stable',
      bullet: {
        current: yoy,
        target: 0,
        min: Math.min(yoy, -10),
        max: Math.max(yoy, 10),
        label: 'YoY vs 0% (flat)',
        targetLabel: '0%',
        minLabel: `${Math.min(yoy, -10)}%`,
        maxLabel: `${Math.max(yoy, 10)}%`,
      },
    };
  }

  if (visual === 'bullet' && measure.measureId === 'M-007') {
    const n = Number(measure.numericValue) || 5;
    return {
      ...base,
      visual: 'bullet',
      unit: 'MCOs',
      bullet: {
        current: n,
        target: n,
        min: 0,
        max: 8,
        label: 'Active MCO roster',
        targetLabel: 'current',
        minLabel: '0',
        maxLabel: '8',
      },
    };
  }

  if (visual === 'heroBreakdown' && measure.measureId === 'M-001') {
    const m002 = measureById('M-002');
    const m003 = measureById('M-003');
    return attachSeries(
      {
        ...base,
        visual: 'heroBreakdown',
        breakdown: [
          m002
            ? { label: 'YoY change', display: m002.displayValue, bar: false, tone: 'negative' }
            : { label: 'YoY change', display: '—', bar: false },
          m003
            ? {
                label: 'Lead county',
                display: m003.displayValue,
                value: Number(m003.numericValue),
                tone: 'positive',
              }
            : { label: 'County', display: 'Gap — HD spend', isGap: true },
        ],
      },
      'M-001',
    );
  }

  if (visual === 'heroBreakdown' && measure.measureId === 'M-017') {
    const m004 = measureById('M-004');
    return {
      ...base,
      value: measure.displayValue?.startsWith('$') ? measure.displayValue : `$${measure.displayValue}`,
      unit: '',
      scale: 'M',
      semantic: 'negative',
      breakdown: [
        {
          label: 'Pharmacy pub.',
          display: `$${measure.displayValue}M`,
          value: Number(measure.numericValue),
          tone: 'negative',
        },
        m004
          ? {
              label: 'Fed KY total',
              display: `${m004.displayValue}M`,
              value: Number(m004.numericValue),
              tone: 'warning',
            }
          : { label: 'Fed KY total', display: '—', bar: false },
        { label: 'Claim-grain $', display: 'Gap', isGap: true },
      ],
    };
  }

  if (visual === 'barCompare' && ['M-010', 'M-011', 'M-012'].includes(measure.measureId)) {
    const rates = ['M-010', 'M-011', 'M-012']
      .map((id) => measureById(id))
      .filter(Boolean)
      .map((m) => ({
        label: m.measureId.replace('M-0', 'M'),
        value: Number(m.numericValue) || 0,
        display: `${m.displayValue}%`,
        tone: m.measureId === measure.measureId ? 'critical' : 'warning',
      }));
    return {
      ...base,
      visual: 'barCompare',
      value: `${measure.displayValue}%`,
      unit: '',
      bars: rates,
      comparison: formatMeasureComparison(measure) || `Core Set / Scorecard · ${formatMeasurePeriodLabel(measure)}`,
    };
  }

  if (visual === 'status' && measure.measureId === 'M-014') {
    return {
      ...base,
      visual: 'status',
      semantic: 'info',
      value: measure.displayValue || 'Published',
      status: {
        tone: 'info',
        detail: 'EQRO / evaluation themes — withholding $ remains Gap',
        chips: [measure.fromSysId, `as of ${measure.asOfDate}`],
      },
    };
  }

  if (measure.measureId === 'M-020') {
    const designated = Number(measure.numericValue);
    const universe = 120;
    const pct = Number.isFinite(designated) ? Math.round((designated / universe) * 1000) / 10 : null;
    const comparison =
      formatMeasurePeriodLabel(measure) ||
      `CY${String(measure.asOfDate || '').slice(0, 4)} · ${measure.fromSysId}`;
    const why =
      measure.definition ||
      'Kentucky counties with Primary Care HPSA designation (whole or partial) from public HRSA AHRF. Miles-to-care remains an Explicit Gap.';
    if (visual === 'status') {
      return {
        ...base,
        visual: 'status',
        semantic: 'warning',
        value: measure.displayValue,
        comparison,
        why,
        status: {
          tone: 'warning',
          detail: pct != null ? `${pct}% of KY counties designated · miles-to-care still Gap` : 'HPSA context · miles-to-care still Gap',
          chips: [measure.fromSysId, `as of ${measure.asOfDate}`],
        },
      };
    }
    const withSeries = attachSeries(
      {
        ...base,
        semantic: 'warning',
        value: measure.displayValue,
        unit: '',
        comparison,
        why,
      },
      'M-020',
    );
    if (resolvedVisual === 'radial' && pct != null) {
      return {
        ...withSeries,
        visual: 'radial',
        radial: { percent: pct, caption: `${designated} of ${universe} counties` },
      };
    }
    if (withSeries.series?.length >= 2) {
      return { ...withSeries, visual: 'areaTrend', direction: 'up' };
    }
    return { ...withSeries, visual: 'metric' };
  }

  if (visual === 'status' && measure.measureId === 'M-010' && roleId === 'oversight-auditor') {
    return {
      ...base,
      visual: 'status',
      semantic: 'critical',
      value: 'Lagged',
      status: {
        tone: 'critical',
        detail: `${measure.displayValue}% · reconcile owner/source before audit use`,
        chips: ['Scorecard vintage', measure.asOfDate],
      },
    };
  }

  if (
    (visual === 'barCompare' || visual === 'metric') &&
    measure.measureId === 'M-003'
  ) {
    const bars = rankedCountyEnrollmentBars(measure, { limit: 3, direction: countyRank });
    if (bars.length >= 2) {
      const isBottom = countyRank === 'bottom';
      return {
        ...base,
        measureId: isBottom ? 'M-003-BOTTOM' : 'M-003',
        kind: isBottom
          ? `Accurate · REAL · M-003 · Bottom 3`
          : `Accurate · REAL · M-003 · Top 3`,
        visual: 'barCompare',
        title: isBottom
          ? 'Bottom 3 counties by Medicaid enrollment'
          : 'Top 3 counties by Medicaid enrollment',
        value: bars[0].display,
        unit: measure.unit || 'persons',
        bars,
        stackBars: true,
        comparison: `As of ${measure.asOfDate} · ${measure.fromSysId} · curated county set`,
        destinationLabel: isBottom
          ? 'Open County & District (lowest counties)'
          : 'Open County & District (top counties)',
      };
    }
  }

  if (visual === 'metric' && measure.measureId === 'M-002') {
    return {
      ...base,
      direction: Number(measure.numericValue) < 0 ? 'down' : 'up',
      ...(measureSeriesPoints('M-002') || {}),
    };
  }

  if (visual === 'metric' && measure.measureId === 'M-004') {
    const m017 = measureById('M-017');
    return {
      ...base,
      value: measure.displayValue,
      unit: 'USD millions',
      scale: 'M',
      compareRows: [
        {
          label: 'Fed KY total',
          display: `${measure.displayValue}M`,
          value: Number(measure.numericValue),
          tone: 'warning',
        },
        m017
          ? {
              label: 'Pharmacy pub.',
              display: `$${m017.displayValue}M`,
              value: Number(m017.numericValue),
              tone: 'negative',
            }
          : null,
        { label: 'Claim-grain $', display: 'Gap', isGap: true },
      ].filter(Boolean),
    };
  }

  return base;
}

/** Synthetic catalogue status tiles for steward / oversight (counts only — not fake rates). */
function catalogueStatusTile(roleId) {
  const c = catalogueCounts();
  if (roleId === 'data-steward') {
    return {
      measureId: 'CATALOGUE-LOAD-MIX',
      kind: 'Catalogue · status',
      title: 'Authoritative source load mix',
      semantic: 'info',
      visual: 'barCompare',
      value: `${c.loaded}/${c.total}`,
      unit: 'loaded',
      bars: [
        { label: 'LOADED', value: c.loaded, display: String(c.loaded), tone: 'positive' },
        { label: 'CATALOGUED', value: c.catalogued, display: String(c.catalogued), tone: 'warning' },
        { label: 'BLOCKED', value: c.blocked, display: String(c.blocked), tone: 'critical' },
        { label: 'Gaps', value: c.gaps, display: String(c.gaps), tone: 'negative' },
      ],
      comparison: 'Export counts — not claim-grain completeness',
      why: 'Stewards watch REAL vs BLOCKED vs Explicit Gaps before role-facing claims.',
      destinationLabel: 'Browse authoritative sources',
      openSources: true,
    };
  }
  return {
    measureId: 'CATALOGUE-GAPS',
    kind: 'Catalogue · gaps',
    title: 'Explicit gaps on the accurate path',
    semantic: 'critical',
    visual: 'status',
    value: `${c.gaps} gaps`,
    status: {
      tone: 'critical',
      detail: `${c.blocked} blocked source(s) · ${c.loaded} loaded`,
      chips: ['Paid / DUA follow-on', 'No synthetic fill'],
    },
    comparison: 'Authoritative sources catalogue',
    why: 'Missing operational feeds stay labeled Gaps — not invented in cubes.',
    destinationLabel: 'Open gap catalogue',
    openSources: true,
  };
}

/**
 * Ordered Accurate Landing tiles for a role (typically 4).
 * Matrix: docs/planning/smart-tile-style-catalog.md §4
 */
export const ROLE_LANDING_PROFILES = {
  legislator: [
    { measureId: 'M-001', visual: 'areaTrend' },
    { measureId: 'M-003', visual: 'barCompare', countyRank: 'top' },
    { measureId: 'M-003', visual: 'barCompare', countyRank: 'bottom' },
    { measureId: 'M-012', visual: 'radial' },
    { measureId: 'M-020', visual: 'areaTrend' },
  ],
  'legislative-staff': [
    { measureId: 'M-012', visual: 'radial' },
    { measureId: 'M-014', visual: 'status' },
    { measureId: 'M-001', visual: 'areaTrend' },
    { measureId: 'M-020', visual: 'radial' },
  ],
  'budget-analyst': [
    { measureId: 'M-017', visual: 'heroBreakdown' },
    { measureId: 'M-002', visual: 'bullet' },
    { measureId: 'M-004', visual: 'metric' },
    { measureId: 'M-001', visual: 'areaTrend' },
  ],
  'medicaid-leadership': [
    { measureId: 'M-007', visual: 'bullet' },
    { measureId: 'M-014', visual: 'status' },
    { measureId: 'M-020', visual: 'areaTrend' },
    { measureId: 'M-001', visual: 'areaTrend' },
  ],
  'policy-analyst': [
    { measureId: 'M-010', visual: 'barCompare' },
    { measureId: 'M-012', visual: 'radial' },
    { measureId: 'M-017', visual: 'metric' },
    { measureId: 'M-020', visual: 'areaTrend' },
  ],
  'oversight-auditor': [
    { measureId: 'M-010', visual: 'status' },
    { measureId: 'M-007', visual: 'metric' },
    { measureId: 'M-020', visual: 'status' },
    { catalogue: true },
  ],
  'data-steward': [
    { catalogue: true },
    { measureId: 'M-001', visual: 'areaTrend' },
    { measureId: 'M-020', visual: 'areaTrend' },
    { measureId: 'M-021', visual: 'areaTrend' },
  ],
};

export function getRoleLandingTiles(roleId) {
  const profile = ROLE_LANDING_PROFILES[roleId] || ROLE_LANDING_PROFILES['budget-analyst'];
  const tiles = [];
  for (const entry of profile) {
    if (entry.catalogue) {
      tiles.push(catalogueStatusTile(roleId));
      continue;
    }
    const m = measureById(entry.measureId);
    if (!m) continue;
    const styled = styleLandingMeasure(m, entry.visual, roleId, {
      countyRank: entry.countyRank,
    });
    if (styled) tiles.push(styled);
  }
  return tiles;
}

export const ROLE_TILE_PROFILE_IDS = Object.keys(ROLE_LANDING_PROFILES);
