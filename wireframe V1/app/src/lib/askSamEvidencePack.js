/**
 * Compact session evidence pack for Ask Sam (client → server).
 * REAL public aggregates or Explicit Gaps only — no PHI, no PSA dumps.
 */

import { AUTHORITATIVE_SOURCES } from '../data/alp/authoritativeSources.js';
import { GAP_OBJECTS } from '../data/alp/gapObjects.js';
import { getHomeSmartTiles } from '../data/homeSmartTiles.js';
import { getRoleLandingTiles } from '../data/roleTileProfiles.js';
import { FL_OPERATIONAL_SOURCES } from '../data/alp/flOperationalSources.js';
import { FL_OPERATIONAL_GOALS } from '../data/flOperationalGoals.js';

const SERIES_PACK_MAX = 8;
const SOURCES_INDEX_MAX = 12;

/** Strip PSA object keys and bulky fields from provenance for chat context. */
export function slimProvenance(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw;
  const out = {};
  for (const key of [
    'asOfDate',
    'periodId',
    'periodYm',
    'fromSysId',
    'loadClass',
    'loadHistoryId',
    'sourceUri',
    'sourcePageUri',
    'note',
    'derivedFrom',
  ]) {
    if (p[key] != null && p[key] !== '') out[key] = p[key];
  }
  if (Array.isArray(p.measureFlow) && p.measureFlow.length) {
    out.measureFlow = p.measureFlow.slice(0, 8);
  }
  return Object.keys(out).length ? out : null;
}

function slimSeries(series, labels) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const start = Math.max(0, series.length - SERIES_PACK_MAX);
  return {
    series: series.slice(start),
    seriesLabels: Array.isArray(labels) ? labels.slice(start) : undefined,
  };
}

function packLandingTile(tile) {
  if (!tile) return null;
  const measure = tile.measure;
  const packed = {
    id: tile.id || tile.measureId || null,
    title: tile.title || measure?.name || null,
    value: tile.value ?? measure?.displayValue ?? null,
    visual: tile.visual || null,
    semantic: tile.semantic || null,
    kind: tile.kind || null,
    measureId: tile.measureId || measure?.measureId || null,
    asOfDate: measure?.asOfDate || null,
    fromSysId: measure?.fromSysId || null,
    loadHistoryId: measure?.loadHistoryId || null,
    loadClass: measure?.provenance?.loadClass || (tile.gap ? 'GAP' : 'REAL'),
    provenance: slimProvenance(measure?.provenance),
  };
  const pts = slimSeries(tile.series, tile.seriesLabels);
  if (pts) {
    packed.series = pts.series;
    packed.seriesLabels = pts.seriesLabels;
  }
  if (tile.gap) {
    packed.gap = {
      gapId: tile.gap.gapId || null,
      accessPath: tile.gap.accessPath || null,
    };
    packed.loadClass = 'GAP';
  }
  if (tile.comparison) packed.comparison = String(tile.comparison).slice(0, 200);
  return packed;
}

function packHomeTile(tile) {
  if (!tile) return null;
  const packed = {
    id: tile.id || null,
    title: tile.title || null,
    value: tile.value || null,
    visual: tile.visual || null,
    semantic: tile.semantic || null,
    kind: tile.kind || null,
    measureId: tile.measureId || tile.measure?.measureId || null,
    loadClass: tile.gap ? 'GAP' : tile.disposition || 'REAL',
  };
  const pts = slimSeries(tile.series, tile.seriesLabels);
  if (pts) {
    packed.series = pts.series;
    packed.seriesLabels = pts.seriesLabels;
  }
  if (tile.gap) {
    packed.gap = {
      gapId: tile.gap.gapId || null,
      accessPath: tile.gap.accessPath || null,
    };
  }
  if (tile.measure) {
    packed.asOfDate = tile.measure.asOfDate || null;
    packed.fromSysId = tile.measure.fromSysId || null;
    packed.loadHistoryId = tile.measure.loadHistoryId || null;
    packed.provenance = slimProvenance(tile.measure.provenance);
  }
  if (tile.comparison) packed.comparison = String(tile.comparison).slice(0, 200);
  return packed;
}

function collectGapIdsFromTiles(tiles) {
  const ids = new Set();
  for (const t of tiles) {
    if (t?.gap?.gapId) ids.add(t.gap.gapId);
  }
  return ids;
}

function packGaps(gapIds) {
  const all = GAP_OBJECTS.gaps || [];
  if (!gapIds.size) {
    return all.slice(0, 8).map((g) => ({
      gapId: g.gapId,
      title: g.title,
      rooms: g.rooms || [],
    }));
  }
  return all
    .filter((g) => gapIds.has(g.gapId))
    .map((g) => ({
      gapId: g.gapId,
      title: g.title,
      need: g.need ? String(g.need).slice(0, 240) : undefined,
      rooms: g.rooms || [],
      findingIds: g.findingIds || [],
    }));
}

function packSourcesIndex(roomId) {
  const sources = AUTHORITATIVE_SOURCES.sources || [];
  const preferred = roomId
    ? sources.filter((s) => (s.measureIds || []).length || s.loadStatus === 'LOADED')
    : sources;
  const list = (preferred.length ? preferred : sources).slice(0, SOURCES_INDEX_MAX);
  return list.map((s) => ({
    fromSysId: s.fromSysId,
    publisher: s.publisher,
    loadStatus: s.loadStatus,
    asOfDate: s.asOfDate || null,
    href: s.href || null,
    measureIds: (s.measureIds || []).slice(0, 6),
  }));
}

/**
 * @param {object} session
 * @param {string} [session.view]
 * @param {string|null} [session.evidenceId]
 * @param {string|null} [session.roleId]
 * @param {string} [session.spineStep]
 * @param {boolean} [session.trustReviewed]
 * @param {boolean} [session.pathPinned]
 * @param {string|null} [session.askSamHint]
 * @param {string[]} [session.focuses]
 * @param {Array<{id?: string, title?: string, focusId?: string}>} [session.findings]
 * @param {{id?: string, title?: string, tags?: string[]}|null} [session.pack]
 */
export function buildAskSamEvidencePack(session = {}) {
  const stateCode = String(session.stateCode || 'KY').toUpperCase() === 'FL' ? 'FL' : 'KY';
  if (stateCode === 'FL') {
    return {
      schema: 'decisionpro/ask-sam-evidence-pack/v1',
      productState: 'FL',
      ui: { view: session.view || null, evidenceId: session.evidenceId || null, roleId: session.roleId || null, spineStep: session.spineStep || null, trustReviewed: Boolean(session.trustReviewed), pathPinned: Boolean(session.pathPinned), askSamHint: session.askSamHint || null },
      landing: {
        operationalGoals: FL_OPERATIONAL_GOALS.map((goal) => ({ id: goal.id, label: goal.label, objective: goal.objective, leadValue: goal.leadValue, leadLabel: goal.leadLabel, readiness: goal.readiness })),
        metrics: (FL_OPERATIONAL_SOURCES.metrics || []).slice(0, 20).map((item) => ({ metricId: item.metricId, label: item.label, value: item.displayValue, unit: item.unit, asOfDate: item.asOfDate, fromSysId: item.fromSysId, sourcePageUri: item.sourcePageUri, limitation: item.limitation })),
      },
      gaps: (FL_OPERATIONAL_SOURCES.gaps || []).map((gap) => ({ gapId: gap.gapId, title: gap.label, reason: gap.reason, unblock: gap.unblock })),
      blender: { focuses: session.focuses || [], findings: [], pack: null },
      sourcesIndex: (FL_OPERATIONAL_SOURCES.sources || []).map((item) => ({ fromSysId: item.fromSysId, publisher: item.publisher, loadStatus: item.status, exportAllowed: item.exportAllowed, asOfDate: item.workbookLastPublishedAt, href: item.sourcePageUri })),
      completionBoundary: FL_OPERATIONAL_SOURCES.completionBoundary,
    };
  }
  const roleId = session.roleId || null;
  const landingTiles = roleId ? getRoleLandingTiles(roleId).map(packLandingTile).filter(Boolean) : [];
  const homeTiles = roleId ? getHomeSmartTiles(roleId).map(packHomeTile).filter(Boolean) : [];
  const gapIds = new Set([
    ...collectGapIdsFromTiles(landingTiles),
    ...collectGapIdsFromTiles(homeTiles),
  ]);
  for (const f of session.findings || []) {
    if (f?.disposition === 'GAP' && f.gapId) gapIds.add(f.gapId);
  }

  return {
    schema: 'decisionpro/ask-sam-evidence-pack/v1',
    ui: {
      view: session.view || null,
      evidenceId: session.evidenceId || null,
      roleId,
      spineStep: session.spineStep || null,
      trustReviewed: Boolean(session.trustReviewed),
      pathPinned: Boolean(session.pathPinned),
      askSamHint: session.askSamHint || null,
    },
    landing: {
      accurateLandingTiles: landingTiles,
      roleHomeTiles: homeTiles,
    },
    gaps: packGaps(gapIds),
    blender: {
      focuses: session.focuses || [],
      findings: (session.findings || []).map((f) => ({
        id: f.id || null,
        title: f.title || null,
        focusId: f.focusId || null,
        disposition: f.disposition || null,
        magnitude: f.magnitude || null,
        measureId: f.measureId || null,
      })),
      pack: session.pack
        ? {
            id: session.pack.id || null,
            title: session.pack.title || null,
            tags: session.pack.tags || [],
          }
        : null,
    },
    sourcesIndex: packSourcesIndex(session.evidenceId),
  };
}
