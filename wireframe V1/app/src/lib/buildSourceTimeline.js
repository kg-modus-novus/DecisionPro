/**
 * Build 10-year Source Timeline slots from Data Spectrum + availability research.
 * Cadence drives slot density (annual → 10; monthly → 120). Empty slots carry a reason.
 */
import availableResearch from '../../../../xenodroid-bw/src/fixtures/dataSpectrumAvailable.json';
import hydrationPack from '../../../../xenodroid-bw/src/fixtures/realPublicHydrationPack.json';
import { buildPsaPreview } from './psaPreview.js';

const YEAR_SPAN = 10;
const MONTH_SPAN = YEAR_SPAN * 12;

/**
 * @typedef {'monthly' | 'annual' | 'event' | 'none'} SlotCadence
 * @typedef {'loaded' | 'empty' | 'not-published' | 'blocked' | 'gap' | 'not-bound' | 'future' | 'event-idle'} SlotStatus
 */

/** Human labels for slot status (UI + legend). */
export const SOURCE_TIMELINE_STATUS_LABEL = {
  loaded: 'Loaded',
  empty: 'Missing',
  'not-published': 'Not published',
  blocked: 'Blocked',
  gap: 'Gap',
  'not-bound': 'Not bound',
  future: 'Future',
  'event-idle': 'No event',
};

export const SOURCE_TIMELINE_STATUS_HINT = {
  loaded: 'REAL data for this period is bound into DecisionPro PSA / cubes.',
  empty: 'Expected period with no bind and no stronger publisher/probe explanation yet.',
  'not-published':
    'Publisher evidence says this period is missing, 404, not yet released, or the current calendar year is still incomplete with no evidenced annual vintage.',
  blocked: 'Source is blocked by license / DUA / out-of-POC restriction.',
  gap: 'Explicit Gap — needs an authorized feed, not a public fill.',
  'not-bound':
    "DecisionPro's curated PSA bind skipped this period. This is DecisionPro bind scope — not a claim about the publisher's full catalog.",
  future: 'After the current date in this look-back window.',
  'event-idle':
    'Event/snapshot source: no observed roster, PDF, or page update was bound for this slot.',
};

/**
 * @param {string | null | undefined} cadence
 * @returns {SlotCadence}
 */
export function normalizeSlotCadence(cadence) {
  const c = String(cadence || '').toLowerCase();
  if (!c || c === 'n/a' || c === 'none') return 'none';
  if (/\bmonthly\b/.test(c)) return 'monthly';
  if (/\bevent\b|\bsnapshot\b|\bsession\b|\bpage update\b/.test(c)) return 'event';
  if (/\bannual\b|\byear\b|\bperiodic\b|\bacs\b/.test(c)) return 'annual';
  return 'annual';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function lastDayOfMonth(year, monthIndex0) {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/**
 * @param {Date} [asOf]
 * @returns {{ year: number, month: number }}
 */
export function timelineWindowEnd(asOf = new Date()) {
  return { year: asOf.getFullYear(), month: asOf.getMonth() + 1 };
}

/**
 * @param {{ year: number, month: number }} end
 * @param {SlotCadence} cadence
 */
export function enumerateTimelineSlots(end, cadence) {
  /** @type {Array<{ slotId: string, year: number, month?: number, periodLabel: string, asOfDate: string }>} */
  const slots = [];
  if (cadence === 'none') return slots;

  if (cadence === 'monthly') {
    let y = end.year;
    let m = end.month;
    for (let i = 0; i < MONTH_SPAN; i += 1) {
      const asOfDate = `${y}-${pad2(m)}-${pad2(lastDayOfMonth(y, m - 1))}`;
      slots.push({
        slotId: `${y}-${pad2(m)}`,
        year: y,
        month: m,
        periodLabel: `${y}-${pad2(m)}`,
        asOfDate,
      });
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
    }
    return slots.reverse();
  }

  // annual + event: one slot per calendar year for the trailing YEAR_SPAN years
  const startYear = end.year - (YEAR_SPAN - 1);
  for (let y = startYear; y <= end.year; y += 1) {
    slots.push({
      slotId: String(y),
      year: y,
      periodLabel: String(y),
      asOfDate: `${y}-12-31`,
    });
  }
  return slots;
}

function indexLoadedKeys(row) {
  const d = row?.loadedDepth || {};
  const periodIds = new Set((d.periodIds || []).map(String));
  const asOfDates = new Set((d.asOfDates || []).map(String));
  const ymFromAsOf = new Set();
  const yearsFromAsOf = new Set();
  for (const a of asOfDates) {
    if (/^\d{4}-\d{2}/.test(a)) {
      ymFromAsOf.add(a.slice(0, 7));
      yearsFromAsOf.add(Number(a.slice(0, 4)));
    }
  }
  for (const p of periodIds) {
    const m = p.match(/(?:^|[^0-9])(\d{4})(\d{2})$/) || p.match(/^ffy(\d{4})$/i) || p.match(/^(\d{4})$/);
    if (m && m[2] && !/^ffy/i.test(p)) {
      ymFromAsOf.add(`${m[1]}-${m[2]}`);
    }
    if (m && m[1] && (!m[2] || /^ffy/i.test(p))) {
      yearsFromAsOf.add(Number(m[1]));
    }
  }
  return { periodIds, asOfDates, ymFromAsOf, yearsFromAsOf };
}

function findArchiveProbe(meta, slot) {
  const probes = meta?.archiveProbe || [];
  if (!probes.length) return null;
  if (slot.month != null) {
    const ym = `${slot.year}${pad2(slot.month)}`;
    return (
      probes.find((p) => String(p.periodId || '').includes(ym)) ||
      probes.find((p) => String(p.uri || '').includes(`${slot.year}${pad2(slot.month)}`)) ||
      null
    );
  }
  return probes.find((p) => String(p.periodId || '').includes(String(slot.year))) || null;
}

function findCoreSetUri(meta, year) {
  const uris = meta?.sourceCountUris || [];
  return uris.find((u) => String(u).includes(String(year))) || null;
}

function slotIsLoaded(row, slot, keys, fromSysId) {
  if (slot.month != null) {
    const ym = `${slot.year}-${pad2(slot.month)}`;
    if (keys.ymFromAsOf.has(ym)) return true;
    if (keys.asOfDates.has(slot.asOfDate)) return true;
    const compact = `${slot.year}${pad2(slot.month)}`;
    for (const p of keys.periodIds) {
      if (p.includes(compact)) return true;
    }
    return false;
  }

  // Core Set: periodId ffyYYYY maps to reporting year YYYY (asOf is MY = YYYY-1)
  if (fromSysId === 'CMS_MEDICAID_SCORECARD') {
    if (keys.periodIds.has(`ffy${slot.year}`)) return true;
    const myAsOf = `${slot.year - 1}-12-31`;
    if (keys.asOfDates.has(myAsOf)) return true;
    return false;
  }

  if (keys.periodIds.has(`ffy${slot.year}`)) return true;
  if (keys.periodIds.has(String(slot.year))) return true;
  if (keys.yearsFromAsOf.has(slot.year)) return true;
  if (keys.asOfDates.has(slot.asOfDate)) return true;
  if (keys.asOfDates.has(`${slot.year}-01-01`)) return true;
  return false;
}

function formatBoundPeriods(row) {
  const d = row?.loadedDepth || {};
  const periods = (d.periodIds || []).filter(Boolean);
  if (periods.length) {
    const shown = periods.slice(0, 8).join(', ');
    return periods.length > 8 ? `${shown}, … (${periods.length} periods)` : shown;
  }
  const asOfs = (d.asOfDates || []).filter(Boolean);
  if (asOfs.length) {
    const shown = asOfs.slice(0, 8).join(', ');
    return asOfs.length > 8 ? `${shown}, … (${asOfs.length} as-of dates)` : shown;
  }
  return 'none yet';
}

function cadenceConsistencyNote(cadence, cadenceLabel) {
  if (cadence === 'monthly') {
    return `Publishing cadence is monthly (${cadenceLabel || 'monthly'}) and is treated as consistent across the 10-year look-back: one expected slot per month.`;
  }
  if (cadence === 'event') {
    return `Publishing cadence is event/snapshot (${cadenceLabel || 'event'}) — irregular over the 10-year look-back. Empty years usually mean no observed update was bound, not that the publisher “owed” a file that year.`;
  }
  if (/periodic/i.test(String(cadenceLabel || ''))) {
    return `Publishing cadence is periodic (${cadenceLabel}). Releases are not guaranteed every calendar year; DecisionPro may bind a single curated vintage rather than a continuous yearly series.`;
  }
  return `Publishing cadence is annual/series (${cadenceLabel || 'annual'}) and is treated as one expected slot per calendar year across the 10-year look-back, unless the publisher or DecisionPro bind notes a break.`;
}

function dataFormNote(row, meta) {
  const unit = row?.loadedDepth?.sourceRecordUnit || meta?.sourceRecordUnit || '';
  const batches = row?.loadedDepth?.sourceScale?.batches || meta?.sourceScaleBatches || [];
  const batchBits = batches.map((b) => b.label || `${b.count} ${b.kind}`).filter(Boolean);
  if (batchBits.length) {
    return `Available form: ${batchBits.join('; ')}${unit ? ` (${unit})` : ''}.`;
  }
  if (/pdf/i.test(String(row?.provides?.cadence || meta?.cadence || ''))) {
    return 'Available form: published PDF documents on the agency statistics / reports site.';
  }
  if (unit) return `Available form: publisher ${unit} / open-data extract.`;
  return 'Available form: public web page and/or downloadable open-data file.';
}

/**
 * Source-level Description (never the same text as Why unavailable).
 * Covers: what it is, what it contains, why DecisionPro includes it, form, cadence consistency.
 */
export function buildSourceDescription(row, meta = {}, source = null) {
  const fromSysId = row?.fromSysId || source?.fromSysId || 'source';
  const publisher = row?.publisher || source?.publisher || meta?.publisher || 'Publisher';
  const cadenceLabel = row?.provides?.cadence || meta?.cadence || 'unspecified';
  const cadence = normalizeSlotCadence(cadenceLabel);
  const grain = row?.provides?.grain || meta?.grain || 'not recorded';
  const what =
    source?.attributionNotes ||
    meta?.availableDepth ||
    row?.availableDepth ||
    `${publisher} authoritative feed catalogued as ${fromSysId}.`;
  const contains =
    row?.loadedDepth?.sourceRecordNote ||
    meta?.sourceRecordNote ||
    `Grain: ${grain}. ${row?.availableDepth || meta?.availableDepth || ''}`.trim();
  const why =
    row?.loadedDepth?.psaBind?.why ||
    meta?.psaBind?.why ||
    (row?.howUsed?.consumers?.length
      ? `DecisionPro uses this source for: ${row.howUsed.consumers.slice(0, 6).join(', ')}.`
      : 'DecisionPro includes this source so legislative rooms can cite an attributable public SoT.');
  const form = dataFormNote(row, meta);
  const cadenceNote = cadenceConsistencyNote(cadence, cadenceLabel);

  return [
    `What it is. ${what}`,
    `What it contains. ${contains}`,
    `Why DecisionPro includes it. ${why}`,
    form,
    cadenceNote,
  ].join(' ');
}

function classifyEmptyReason(row, slot, meta, end, fromSysId) {
  const disposition = row?.disposition || '';
  const bound = formatBoundPeriods(row);

  if (disposition === 'BLOCKED') {
    return {
      status: 'blocked',
      reason:
        row.blockReason ||
        row.nextAction ||
        `DecisionPro cannot bind ${slot.periodLabel} while this source remains blocked (license / DUA / out of POC).`,
    };
  }
  if (disposition === 'GAP' || row?.kind === 'gap') {
    return {
      status: 'gap',
      reason: `No public fill exists for ${slot.periodLabel}. This catalogue entry is an Explicit Gap that needs an authorized feed.`,
    };
  }

  const slotPast =
    slot.month != null
      ? slot.year * 12 + slot.month > end.year * 12 + end.month
      : slot.year > end.year;
  if (slotPast) {
    return {
      status: 'future',
      reason: `${slot.periodLabel} is after the current date in this look-back window, so DecisionPro does not expect a bind yet.`,
    };
  }

  const probe = findArchiveProbe(meta, slot);
  if (probe && (probe.parseStatus === 'NOT_FOUND' || Number(probe.httpStatus) === 404)) {
    return {
      status: 'not-published',
      reason: `Publisher URI for ${probe.periodId || slot.periodLabel} returned HTTP ${probe.httpStatus || 404} (${probe.parseStatus || 'NOT_FOUND'}). DecisionPro treats that period as unpublished at the probed path — not as a deliberate DecisionPro bind skip.`,
      dataUri: probe.uri || null,
    };
  }
  if (probe && probe.parseStatus === 'LOADED' && Number(probe.httpStatus) === 200) {
    return {
      status: 'not-bound',
      reason: `The publisher file for ${probe.periodId || slot.periodLabel} is available, but DecisionPro's curated PSA bind did not select it. Currently bound periods: ${bound}. This is DecisionPro bind scope, not publisher unavailability.`,
      dataUri: probe.uri || null,
    };
  }

  const cadenceEarly = normalizeSlotCadence(row?.provides?.cadence);
  // Incomplete current calendar year (annual/periodic tracks): not a deliberate bind skip.
  if (slot.month == null && slot.year === end.year && cadenceEarly !== 'event') {
    return {
      status: 'not-published',
      reason: `Calendar year ${slot.year} is still in progress in this look-back (as of ${end.year}-${pad2(end.month)}). No complete ${slot.year} annual publisher vintage is evidenced in DecisionPro's inventory yet, so this slot is treated as not published / not yet releasable — not as a DecisionPro bind skip of an available file.`,
    };
  }

  if (fromSysId === 'CMS_MEDICAID_SCORECARD') {
    if (slot.year < 2020) {
      return {
        status: 'not-published',
        reason: `No public Child/Adult Core Set quality CSV for FFY ${slot.year} resolved on download.medicaid.gov / data.medicaid.gov uploaded_resources hosts (probed; HTTP 404). DecisionPro's earliest bound Core Set vintage is FFY 2020. Currently bound: ${bound}.`,
      };
    }
    if (slot.year > 2024) {
      return {
        status: 'not-published',
        reason: `FFY ${slot.year} Child/Adult Core Set CSV is not yet resolved on an authoritative public host in this catalogue, so DecisionPro has nothing to bind for that reporting year.`,
      };
    }
  }

  if (fromSysId === 'CENSUS_ACS' && slot.year === 2020) {
    return {
      status: 'not-published',
      reason:
        'The publisher tool omits calendar year 2020 for the Uninsured share series (ACS/KFF republish gap), so there is no 2020 cell to bind.',
    };
  }

  if (fromSysId === 'CENSUS_ACS' && slot.year > 2024) {
    return {
      status: 'not-published',
      reason: `KFF State Health Facts (ACS-based Uninsured share) is inventoried only through CY2024 in DecisionPro's catalogue. CY${slot.year} is not yet evidenced as a published timeframe — not a DecisionPro skip of available data. Currently bound: ${bound}.`,
    };
  }

  if (fromSysId === 'CENSUS_ACS' && slot.year < 2016) {
    return {
      status: 'not-bound',
      reason: `CY${slot.year} exists in the broader KFF timeframe set, but DecisionPro's Kentucky Uninsured bind starts at CY2016. Currently bound: ${bound}.`,
    };
  }

  if (fromSysId === 'HRSA_AHRF' && slot.year > 2025) {
    return {
      status: 'not-published',
      reason: `Public HRSA AHRF Primary Care HPSA county codes are inventoried in DecisionPro through CY2025 (May ${Math.min(slot.year, 2025)} vintage fields from county AHRF releases). CY${slot.year} is not yet evidenced as a published HPSA code year on the bound path — not a DecisionPro skip of an available file. Currently bound: ${bound}.`,
    };
  }

  if (fromSysId === 'CMS_DATA_MEDICAID_ENR' && slot.month != null) {
    const ym = slot.year * 12 + slot.month;
    const modernStart = 2018 * 12 + 10;
    if (ym < modernStart) {
      return {
        status: 'not-bound',
        reason: `${slot.periodLabel} is before the modern PI monthly series DecisionPro treats as continuous (~October 2018 forward). Sparse earlier months appear only when explicitly landed. Currently bound periods include: ${bound}.`,
      };
    }
  }

  if (fromSysId === 'CMS_DATA_MEDICAID') {
    const latest = row?.loadedDepth?.latestAsOf || row?.loadedDepth?.asOfDates?.[0] || null;
    const latestYear = latest && /^\d{4}/.test(latest) ? Number(latest.slice(0, 4)) : null;
    if (latestYear != null && slot.year > latestYear) {
      return {
        status: 'not-published',
        reason: `No newer attributable Kentucky expenditure vintage than ${latest} is evidenced on the public Financial Management path. DecisionPro policy is to bind the most recent available KY figure — not to invent later calendar years.`,
      };
    }
    // Open FM table on data.medicaid.gov currently inventories year=2016 only; 2017–(latest-1)
    // calendar years in the look-back are not present as published table years.
    if (slot.year >= 2017 && (latestYear == null || slot.year < latestYear)) {
      return {
        status: 'not-published',
        reason: `The public Medicaid Financial Management open table currently inventories year=2016 only (sampled nationally). CY${slot.year} is not present as a published table year, so there is no attributable KY expenditure series to bind for that slot. DecisionPro's curated KY aggregate remains ${latest || 'the loaded vintage'}.`,
      };
    }
    return {
      status: 'not-bound',
      reason: `DecisionPro's most recent KY expenditure bind is ${latest || 'the loaded vintage'}. ${slot.periodLabel} is earlier than that bind and was not selected into the curated aggregate history. Currently bound: ${bound}.`,
    };
  }

  if (fromSysId === 'CMS_MEDICAID_PHARMACY') {
    const latest = row?.loadedDepth?.latestAsOf || row?.loadedDepth?.asOfDates?.[0] || null;
    const latestYear = latest && /^\d{4}/.test(latest) ? Number(latest.slice(0, 4)) : null;
    if (latestYear != null && slot.year > latestYear) {
      return {
        status: 'not-published',
        reason: `No newer attributable Kentucky pharmacy program aggregate than ${latest} is evidenced. National Spending-by-Drug year columns are not rolled into KY totals.`,
      };
    }
    if (slot.year < 2020) {
      return {
        status: 'not-published',
        reason: `CMS Medicaid Spending by Drug public CSV exposes Tot_Spndng_2020…2024 national drug columns only. CY${slot.year} has no publisher year column, and DecisionPro will not invent a KY program total.`,
      };
    }
    // 2020–(latest-1): national columns exist, but no attributable KY program total in that file.
    return {
      status: 'not-published',
      reason: `CMS Spending by Drug publishes national brand/generic Tot_Spndng_${slot.year} columns, but not a Kentucky program total. DecisionPro will not invent KY attribution from national drug rows. Currently bound KY aggregate: ${bound}.`,
    };
  }

  if (fromSysId === 'KY_DMS_COUNTY_COUNTS' && slot.month != null) {
    return {
      status: 'not-published',
      reason: `No KYDWMMCCYYYYMMDD.pdf for ${slot.periodLabel} is evidenced on the public DMS stats path after DecisionPro's day-of-month filename sweep (DD is the publisher run day, not always 01). DMS keeps a sparse online archive — missing months are unpublished on that path, not intentional DecisionPro bind skips. Currently bound: ${bound}.`,
    };
  }

  const cadence = normalizeSlotCadence(row?.provides?.cadence);
  if (cadence === 'event') {
    return {
      status: 'event-idle',
      reason: `No observed roster, PDF, or page-update event for ${slot.periodLabel} was bound into DecisionPro. Event/snapshot sources do not require a publication every year; a fill appears only when an update is recorded. Currently bound: ${bound}.`,
    };
  }

  if (meta?.psaBind?.mode === 'document-select' || meta?.psaBind?.mode === 'curated-aggregate') {
    const mode = meta.psaBind.mode;
    return {
      status: 'not-bound',
      reason: `DecisionPro's ${mode} PSA bind did not include ${slot.periodLabel}. Policy is to keep the most recent available public period bound; this slot is either older than that bind or not yet confirmed on an attributable URI. Currently bound: ${bound}.`,
    };
  }

  if (disposition === 'CATALOGUED') {
    return {
      status: 'empty',
      reason: `Source is catalogued but not yet loaded into the accurate path for ${slot.periodLabel}. ${row.nextAction || ''}`.trim(),
    };
  }

  return {
    status: 'empty',
    reason: `No REAL DecisionPro bind exists for ${slot.periodLabel} in the current inventory. Currently bound: ${bound}.`,
  };
}

function resolveSlotUris(row, slot, meta, source, status) {
  const siteUri =
    source?.href ||
    source?.pageHref ||
    (row?.provides?.publicUris || [])[0] ||
    (meta?.publicUris || [])[0] ||
    null;

  let dataUri = null;
  if (status === 'loaded' || status === 'not-published' || status === 'not-bound') {
    const probe = findArchiveProbe(meta, slot);
    if (probe?.uri) dataUri = probe.uri;
    if (!dataUri && fromSysLooksLikeScorecard(row.fromSysId)) {
      dataUri = findCoreSetUri(meta, slot.year);
    }
    if (!dataUri && slot.month != null && row.fromSysId === 'KY_DMS_COUNTY_COUNTS') {
      // Fallback only when no probe URI exists; prefer day-sweep probe.uri above.
      dataUri = `https://www.chfs.ky.gov/agencies/dms/stats/KYDWMMCC${slot.year}${pad2(slot.month)}01.pdf`;
    }
    if (!dataUri) {
      dataUri = source?.fileHref || (row?.provides?.publicUris || [])[1] || null;
    }
  }
  return { siteUri, dataUri };
}

function fromSysLooksLikeScorecard(id) {
  return id === 'CMS_MEDICAID_SCORECARD';
}

/**
 * Filter PSA preview rows to the slot when period/as-of columns exist.
 */
export function buildSlotDataPreview(row, slot) {
  const preview = buildPsaPreview(row);
  if (!preview?.rows?.length) return preview;

  const cols = preview.columns.map((c) => String(c).toLowerCase());
  const periodIdx = cols.findIndex((c) => c.includes('period'));
  const asOfIdx = cols.findIndex((c) => c.includes('as_of') || c.includes('as-of') || c === 'as_of_date');

  const ym = slot.month != null ? `${slot.year}-${pad2(slot.month)}` : null;
  const compact = slot.month != null ? `${slot.year}${pad2(slot.month)}` : null;
  const ffy = `ffy${slot.year}`;
  const myAsOf = `${slot.year - 1}-12-31`;

  const filtered = preview.rows.filter((r) => {
    const period = periodIdx >= 0 ? String(r[periodIdx] || '') : '';
    const asOf = asOfIdx >= 0 ? String(r[asOfIdx] || '') : '';
    if (compact && (period.includes(compact) || period.includes(ym) || asOf.startsWith(ym))) return true;
    if (period.toLowerCase() === ffy || period.includes(String(slot.year))) return true;
    if (asOf === slot.asOfDate || asOf === myAsOf || asOf.startsWith(String(slot.year))) return true;
    return false;
  });

  if (!filtered.length) {
    // Fall back: hydration pack slice for this fromSys + period
    const measures = (hydrationPack.landingMeasures || []).filter((m) => {
      if (m.fromSysId !== row.fromSysId) return false;
      if (m.periodId && (m.periodId === ffy || String(m.periodId).includes(compact || String(slot.year)))) {
        return true;
      }
      if (m.asOfDate === slot.asOfDate || m.asOfDate === myAsOf) return true;
      if (ym && String(m.asOfDate || '').startsWith(ym)) return true;
      if (m.coreSetYear != null && Number(m.coreSetYear) === slot.year) return true;
      return false;
    });
    if (measures.length) {
      const columns = [
        'measure_id',
        'display_value',
        'numeric_value',
        'unit',
        'as_of_date',
        'period_id',
        'period_label',
        'source_uri',
        'note',
      ];
      const rows = measures.map((m) => [
        m.measureId,
        m.displayValue,
        m.numericValue,
        m.unit,
        m.asOfDate,
        m.periodId,
        m.periodLabel || '',
        m.sourceUri,
        m.note || '',
      ]);
      return {
        columns,
        rows,
        totalRowCount: rows.length,
        shownRowCount: rows.length,
        truncated: false,
        note: `REAL bind rows for ${row.fromSysId} · ${slot.periodLabel}.`,
      };
    }
    return {
      ...preview,
      note: `${preview.note || ''} Showing full source preview — no row-level filter matched ${slot.periodLabel}.`.trim(),
    };
  }

  return {
    columns: preview.columns,
    rows: filtered,
    totalRowCount: filtered.length,
    shownRowCount: filtered.length,
    truncated: false,
    note: `Filtered PSA / hydration preview for ${slot.periodLabel}.`,
  };
}

/**
 * @param {object} opts
 * @param {object[]} opts.spectrumRows
 * @param {object[]} [opts.sources]
 * @param {Date} [opts.asOf]
 * @param {object} [opts.available]
 */
export function buildSourceTimelines({
  spectrumRows,
  sources = [],
  asOf = new Date(),
  available = availableResearch,
} = {}) {
  const end = timelineWindowEnd(asOf);
  const sourceById = new Map((sources || []).map((s) => [s.fromSysId, s]));
  const metaById = available?.sources || {};

  const timelines = [];
  for (const row of spectrumRows || []) {
    if (!row?.fromSysId) continue;
    if (row.kind === 'gap' || row.disposition === 'GAP') continue;

    const cadence = normalizeSlotCadence(row.provides?.cadence);
    const rawSlots = enumerateTimelineSlots(end, cadence === 'none' ? 'annual' : cadence);
    const keys = indexLoadedKeys(row);
    const meta = metaById[row.fromSysId] || {};
    const source = sourceById.get(row.fromSysId) || null;
    const effectiveCadence = cadence === 'none' ? 'annual' : cadence;

    const sourceDescription = buildSourceDescription(row, meta, source);

    const slots = rawSlots.map((slot) => {
      const loaded = slotIsLoaded(row, slot, keys, row.fromSysId);
      if (loaded) {
        const uris = resolveSlotUris(row, slot, meta, source, 'loaded');
        const periodNote =
          row.fromSysId === 'CMS_MEDICAID_SCORECARD'
            ? `This slot is loaded: Core Set FFY ${slot.year} (measurement year ${slot.year - 1}).`
            : `This slot is loaded: REAL bind for ${slot.periodLabel} is present in PSA / Evidence Room cubes.`;
        return {
          ...slot,
          status: 'loaded',
          reason: null,
          description: sourceDescription,
          periodNote,
          siteUri: uris.siteUri,
          dataUri: uris.dataUri,
          measureIds: row.loadedDepth?.measureIds || [],
          preview: null,
        };
      }
      const empty = classifyEmptyReason(row, slot, meta, end, row.fromSysId);
      const uris = resolveSlotUris(row, slot, meta, source, empty.status);
      return {
        ...slot,
        status: empty.status,
        reason: empty.reason,
        description: sourceDescription,
        periodNote: null,
        siteUri: uris.siteUri,
        dataUri: empty.dataUri || uris.dataUri,
        measureIds: [],
        preview: null,
      };
    });

    const loadedCount = slots.filter((s) => s.status === 'loaded').length;
    timelines.push({
      fromSysId: row.fromSysId,
      publisher: row.publisher || source?.publisher || '',
      disposition: row.disposition,
      cadence: effectiveCadence,
      cadenceLabel: row.provides?.cadence || effectiveCadence,
      grain: row.provides?.grain || '',
      availableDepth: row.availableDepth || '',
      description: sourceDescription,
      siteUri: source?.href || (row.provides?.publicUris || [])[0] || null,
      slotCount: slots.length,
      loadedCount,
      emptyCount: slots.length - loadedCount,
      slots,
      spectrum: row,
      source,
    });
  }

  return {
    schema: 'decisionpro/source-timeline/v1',
    generatedAt: asOf.toISOString(),
    windowEnd: end,
    yearSpan: YEAR_SPAN,
    timelines,
    summary: {
      sources: timelines.length,
      slots: timelines.reduce((n, t) => n + t.slotCount, 0),
      loadedSlots: timelines.reduce((n, t) => n + t.loadedCount, 0),
      emptySlots: timelines.reduce((n, t) => n + t.emptyCount, 0),
    },
  };
}

export function attachSlotPreview(slot, spectrumRow) {
  if (!slot || slot.status !== 'loaded') return slot;
  return {
    ...slot,
    preview: buildSlotDataPreview(spectrumRow, slot),
  };
}
