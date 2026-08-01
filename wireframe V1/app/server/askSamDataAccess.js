/**
 * Read-only data access for Ask Sam tools.
 * Exports under src/data/alp are required; live Postgres is optional.
 */

import { ACCURATE_LANDING } from '../src/data/alp/accurateLanding.js';
import { AUTHORITATIVE_SOURCES } from '../src/data/alp/authoritativeSources.js';
import { BLENDER_REAL } from '../src/data/alp/blenderFindings.real.js';
import { GAP_BRIEFINGS } from '../src/data/alp/gapBriefings.js';
import { GAP_OBJECTS } from '../src/data/alp/gapObjects.js';
import { SOURCE } from '../src/data/alp/primarySources.js';
import { ROOM_CUBES_REAL } from '../src/data/alp/roomCubes.real.js';
import { slimProvenance } from '../src/lib/askSamEvidencePack.js';

const SERIES_TOOL_MAX = 12;

function slimMeasure(m) {
  if (!m) return null;
  const series = (ACCURATE_LANDING.measureSeries || [])
    .filter((r) => r.measureId === m.measureId && Number.isFinite(Number(r.numericValue)))
    .slice()
    .sort((a, b) => String(a.asOfDate || '').localeCompare(String(b.asOfDate || '')));
  const tail = series.length > SERIES_TOOL_MAX ? series.slice(-SERIES_TOOL_MAX) : series;
  return {
    measureId: m.measureId,
    name: m.name,
    definition: m.definition,
    displayValue: m.displayValue,
    numericValue: m.numericValue,
    unit: m.unit,
    asOfDate: m.asOfDate,
    fromSysId: m.fromSysId,
    loadHistoryId: m.loadHistoryId,
    provenance: slimProvenance(m.provenance),
    series:
      tail.length >= 2
        ? tail.map((r) => ({
            asOfDate: r.asOfDate,
            displayValue: r.displayValue,
            numericValue: r.numericValue,
          }))
        : undefined,
  };
}

function roomRowsForMeasure(measureId) {
  const rooms = ROOM_CUBES_REAL.rooms || {};
  const hits = [];
  for (const [roomId, rows] of Object.entries(rooms)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row.measureId !== measureId) continue;
      hits.push({
        roomId,
        id: row.id,
        title: row.title,
        rowKind: row.rowKind,
        displayValue: row.displayValue,
        asOfDate: row.asOfDate,
        fromSysId: row.fromSysId,
        measureId: row.measureId || null,
        gapId: row.gapId || null,
      });
    }
  }
  return hits.slice(0, 20);
}

export function getMeasureDetail(measureId) {
  const id = String(measureId || '').trim();
  if (!id) return { ok: false, error: 'measureId is required' };
  const measure = (ACCURATE_LANDING.measures || []).find((m) => m.measureId === id);
  if (!measure) {
    const roomHits = roomRowsForMeasure(id);
    if (!roomHits.length) return { ok: false, error: `Measure ${id} not found in exports` };
    return { ok: true, measure: null, roomRows: roomHits };
  }
  return {
    ok: true,
    measure: slimMeasure(measure),
    roomRows: roomRowsForMeasure(id),
  };
}

export function listGaps({ roomId } = {}) {
  let gaps = GAP_OBJECTS.gaps || [];
  if (roomId) {
    const room = String(roomId);
    gaps = gaps.filter((g) => (g.rooms || []).includes(room));
  }
  return {
    ok: true,
    count: gaps.length,
    gaps: gaps.map((g) => ({
      gapId: g.gapId,
      title: g.title,
      need: g.need,
      rooms: g.rooms || [],
      findingIds: g.findingIds || [],
      paidFollowOn: g.paidFollowOn || '',
    })),
  };
}

export function getGapDetail(gapId) {
  const id = String(gapId || '').trim();
  if (!id) return { ok: false, error: 'gapId is required' };
  const gap = (GAP_OBJECTS.gaps || []).find((g) => g.gapId === id);
  if (!gap) return { ok: false, error: `Gap ${id} not found` };
  const briefing = GAP_BRIEFINGS[id] || null;
  return {
    ok: true,
    gap: {
      gapId: gap.gapId,
      title: gap.title,
      need: gap.need,
      rooms: gap.rooms || [],
      findingIds: gap.findingIds || [],
      paidFollowOn: gap.paidFollowOn || '',
    },
    briefing: briefing
      ? {
          whatItIs: briefing.whatItIs,
          whyUseful: briefing.whyUseful,
          publisher: briefing.publisher,
          cadence: briefing.cadence,
          detailLevel: briefing.detailLevel,
          accessConditions: briefing.accessConditions,
          whoRequests: briefing.whoRequests,
          incorporateSteps: (briefing.incorporateSteps || []).slice(0, 8),
          dashboardImpact: briefing.dashboardImpact,
          relatedFromSysIds: briefing.relatedFromSysIds || [],
        }
      : null,
  };
}

export function getAuthoritativeSource(fromSysIdOrKey) {
  const key = String(fromSysIdOrKey || '').trim();
  if (!key) return { ok: false, error: 'fromSysId or primary source key is required' };

  const catalogue = (AUTHORITATIVE_SOURCES.sources || []).find(
    (s) => s.fromSysId === key || String(s.fromSysId).toLowerCase() === key.toLowerCase(),
  );
  if (catalogue) {
    return {
      ok: true,
      kind: 'authoritative',
      source: {
        fromSysId: catalogue.fromSysId,
        publisher: catalogue.publisher,
        tosGrade: catalogue.tosGrade,
        href: catalogue.href,
        fileHref: catalogue.fileHref || null,
        attributionNotes: catalogue.attributionNotes,
        paidFollowOnTodo: catalogue.paidFollowOnTodo,
        loadStatus: catalogue.loadStatus,
        measureIds: catalogue.measureIds || [],
        asOfDate: catalogue.asOfDate || null,
      },
    };
  }

  const primary = SOURCE[key] || Object.values(SOURCE).find((s) => s.id === key);
  if (primary) {
    return {
      ok: true,
      kind: 'primary',
      source: {
        id: primary.id,
        label: primary.label,
        href: primary.href,
        pageHref: primary.pageHref || null,
        publisher: primary.publisher,
        kind: primary.kind,
      },
    };
  }

  return { ok: false, error: `Source ${key} not found in authoritative or primary catalogues` };
}

/** Condensed load-history from export provenance (always available). */
export function summarizeLoadHistoryFromExports(loadHistoryId) {
  const id = String(loadHistoryId || '').trim();
  const measures = ACCURATE_LANDING.measures || [];
  const matched = id
    ? measures.filter((m) => m.loadHistoryId === id || m.provenance?.loadHistoryId === id)
    : measures.filter((m) => m.loadHistoryId);

  const byLh = new Map();
  for (const m of matched) {
    const lh = m.loadHistoryId || m.provenance?.loadHistoryId;
    if (!lh) continue;
    if (!byLh.has(lh)) {
      byLh.set(lh, {
        loadHistoryId: lh,
        fromSysIds: new Set(),
        asOfDates: new Set(),
        measureIds: [],
        sourcePageUri: m.provenance?.sourcePageUri || null,
        sourceUri: m.provenance?.sourceUri || null,
        loadClass: m.provenance?.loadClass || ACCURATE_LANDING.loadClass || null,
        measureFlow: m.provenance?.measureFlow || null,
      });
    }
    const row = byLh.get(lh);
    if (m.fromSysId) row.fromSysIds.add(m.fromSysId);
    if (m.asOfDate) row.asOfDates.add(m.asOfDate);
    if (m.measureId) row.measureIds.push(m.measureId);
  }

  const digests = [...byLh.values()].slice(0, 12).map((r) => ({
    loadHistoryId: r.loadHistoryId,
    fromSysIds: [...r.fromSysIds],
    asOfDates: [...r.asOfDates],
    measureIds: [...new Set(r.measureIds)].slice(0, 20),
    sourcePageUri: r.sourcePageUri,
    sourceUri: r.sourceUri,
    loadClass: r.loadClass,
    measureFlow: r.measureFlow,
  }));

  return {
    ok: true,
    source: 'exports',
    count: digests.length,
    digests,
    note: 'Condensed from UI export provenance — not a full PSA/cleanse dump.',
  };
}

/**
 * Optional live Postgres digest. Only when DECISIONPRO_BW_DATABASE_URL is set.
 * Returns structured unavailable payload when env/driver/connection missing.
 */
export async function summarizeLoadHistoryFromPostgres(loadHistoryId, env = process.env) {
  const databaseUrl = env.DECISIONPRO_BW_DATABASE_URL;
  if (!databaseUrl) {
    return {
      available: false,
      reason: 'DECISIONPRO_BW_DATABASE_URL is not set',
      fallbackHint: 'Use export provenance digests from summarize_load_history exports branch.',
    };
  }

  let pg;
  try {
    pg = await import('pg');
  } catch {
    return {
      available: false,
      reason: 'pg package is not installed (optionalDependency)',
      fallbackHint: 'Run npm install pg in wireframe V1/app, or rely on export provenance.',
    };
  }

  const { Client } = pg.default || pg;
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 2500 });
  try {
    await client.connect();
    const params = [];
    let sql = `
      SELECT load_history_id, data_request_id, started_at::text, completed_at::text,
             source_uri, as_of_date::text, row_count, status, load_class, notes
      FROM bw_ctl.load_history
    `;
    if (loadHistoryId) {
      params.push(String(loadHistoryId));
      sql += ` WHERE load_history_id = $1`;
    } else {
      sql += ` ORDER BY COALESCE(completed_at, started_at) DESC NULLS LAST LIMIT 15`;
    }
    const { rows } = await client.query(sql, params);
    return {
      available: true,
      source: 'postgres',
      count: rows.length,
      digests: rows.map((r) => ({
        loadHistoryId: r.load_history_id,
        dataRequestId: r.data_request_id,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        sourceUri: r.source_uri,
        asOfDate: r.as_of_date,
        rowCount: r.row_count,
        status: r.status,
        loadClass: r.load_class,
        notes: r.notes ? String(r.notes).slice(0, 240) : '',
      })),
      note: 'Aggregate load-history metadata only — no PSA row dumps.',
    };
  } catch (err) {
    return {
      available: false,
      reason: `Postgres query failed: ${err.message || err}`,
      fallbackHint: 'Use export provenance digests.',
    };
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

export async function summarizeLoadHistory(loadHistoryId, env = process.env) {
  const fromExports = summarizeLoadHistoryFromExports(loadHistoryId);
  const live = await summarizeLoadHistoryFromPostgres(loadHistoryId, env);
  return {
    ok: true,
    exports: fromExports,
    live,
  };
}

export function getUiGuidance({ view, evidenceId, roleId } = {}) {
  const screens = {
    'role-selector': 'Pick a legislative / analyst persona to open role-home smart tiles.',
    'role-home': 'Role-home smart tiles show REAL public signals or Explicit Gaps for this persona. Use I-button for interpret tips; open destinations for Evidence Rooms or sources.',
    home: 'Role-home smart tiles show REAL public signals or Explicit Gaps for this persona.',
    landing: 'Accurate Landing shows publicly available REAL measures. Gaps are labeled — never filled with synthetic magnitudes.',
    'accurate-landing': 'Accurate Landing shows publicly available REAL measures with smart-tile visuals.',
    sources: 'Authoritative sources catalogue + Explicit Gap objects. Check loadStatus, TOS grade, as-of, and paid/DUA follow-on notes.',
    evidence:
      'Evidence Rooms: filter → chart → list → object page. Rows are REAL public values or Explicit Gaps from room cube exports.',
    blender: 'Consideration Blender: select focus tabs, blend findings, adjust weights, unlock win-win-win packs, then open Consideration Brief.',
    pack: 'Win-win-win pack: examine trade-off options — not prescriptions.',
    brief: 'Consideration Brief summarizes the blended path for examination.',
    legislation: 'Legislative Analysis links law notes to blender focuses (blockers / openings).',
    'law-object': 'Legislation object page for a specific bill/note under examination.',
  };
  const key = view || 'unknown';
  return {
    ok: true,
    view: key,
    evidenceId: evidenceId || null,
    roleId: roleId || null,
    guidance: screens[key] || `You are on screen "${key}". Use Evidence Rooms, Accurate Landing, sources & Gaps, Blender, or Legislative Analysis as needed.`,
    tips: [
      'Ask about a measureId (e.g. M-001) for provenance and as-of.',
      'Ask about a gapId (e.g. GAP-HD-EXPENDITURE) for need and access path.',
      'Ask for loadHistoryId digests when checking lineage.',
      'Never expect person-level Medicaid data in DecisionPro.',
    ],
  };
}

export function getBlenderFinding(findingId) {
  const id = String(findingId || '').trim();
  if (!id) return { ok: false, error: 'findingId is required' };
  const finding = (BLENDER_REAL.findings || []).find((f) => f.id === id);
  if (!finding) return { ok: false, error: `Finding ${id} not found in blender REAL export` };
  return {
    ok: true,
    finding: {
      id: finding.id,
      focusId: finding.focusId,
      title: finding.title,
      magnitude: finding.magnitude,
      disposition: finding.disposition,
      measureId: finding.measureId || null,
      freshness: finding.freshness,
      confidence: finding.confidence,
      constituencyRelevance: finding.constituencyRelevance,
      sourceIncentiveNote: finding.sourceIncentiveNote,
      primarySourceKeys: finding.primarySourceKeys || [],
      gapId: finding.gapId || null,
    },
  };
}
