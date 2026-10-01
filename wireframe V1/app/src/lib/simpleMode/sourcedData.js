// CodeXen: v1 not-applicable
// Loads the researched, sourced Kentucky measures behind simple mode and
// normalizes them for display. Director decision 2026-10-01: these figures
// appear in simple mode before they pass through the BW warehouse. The research
// files (sourced/*.json) carry an internal `loadNote` per measure; the build
// script strips those into docs/planning/simple-mode-data-load-backlog.md and
// emits display fields only (`npm run simple:sourced`). Presentation only.
import { SOURCED_DISPLAY } from './sourcedDisplay.generated.js';
import { prettyPeriod } from './measureModel.js';

export { prettyPeriod };

export const SOURCED_AREAS = SOURCED_DISPLAY;

function rowUnit(row, measure) {
  if (row.unit) return row.unit;
  if (/\(%\)|percent|share/i.test(row.label || '') && measure.unit !== 'percent') return 'percent';
  return undefined;
}

function sourceOf(measure) {
  if (measure.source?.url || measure.source?.title) return measure.source;
  const first = (measure.inputs || []).find((i) => i.source);
  return first ? { ...first.source, title: `Estimated from ${first.source.title || first.source.publisher}` } : null;
}

const isYear = (m) => /\byear\b/i.test(m.label || '') && Number.isInteger(m.value) && m.value > 1900 && m.value < 2100;

export function normalizeMeasure(measure, area) {
  const yearUnit = isYear(measure);
  return {
    ...measure,
    unit: yearUnit ? 'year' : measure.unit,
    period: prettyPeriod(measure.period),
    asOf: prettyPeriod(measure.asOf),
    area,
    source: sourceOf(measure),
    rows: (measure.rows || []).map((row) => ({ ...row, unit: yearUnit && row.value > 1900 ? 'year' : rowUnit(row, measure) })),
    series: (measure.series || []).filter((p) => Number.isFinite(p.value)),
    rawPeriod: measure.period,
  };
}

export const MEASURES = new Map();
for (const [area, data] of Object.entries(SOURCED_AREAS)) {
  for (const measure of data.measures || []) MEASURES.set(measure.id, normalizeMeasure(measure, area));
}

/** A measure by id; throws in development so a renamed id is caught by tests. */
export function measure(id) {
  const found = MEASURES.get(id);
  if (!found) throw new Error(`Unknown sourced measure: ${id}`);
  return found;
}

export function maybeMeasure(id) {
  return MEASURES.get(id) || null;
}

/** County rows of a county-dimension measure, keyed by FIPS. */
export function countyRows(id) {
  return (measure(id).rows || []).filter((r) => r.fips);
}

export function countyValue(id, fips) {
  return countyRows(id).find((r) => r.fips === fips) || null;
}
