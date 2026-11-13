import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MEASURES, SOURCED_AREAS } from './simpleMode/sourcedData.js';
import { PAGES } from './simpleMode/simpleAreas.js';
import { TILE_CATALOG, DEFAULT_TILE_IDS } from './simpleMode/simpleTiles.js';
import { SIMPLE_BRIEFINGS } from './simpleMode/simpleBriefings.js';
import { ORDERABLE_COLUMNS, SCORECARD_COLUMNS, planKey } from './simpleMode/planScorecard.js';
import { formatComparison, formatMeasureValue, formatNumber, periodKey, seriesBeforeBreak, trendOf, visualFor } from './simpleMode/measureModel.js';
import { addTile, moveTileTo, nudgeTile, normalizeLayout, orderedTileIds, removeTile, togglePin } from './simpleMode/tileLayout.js';
import { PRODUCT_COMMENTARY_TERMS, PROHIBITED_HEADLINE_TERMS } from '../data/operationalBriefings.js';

const all = [...MEASURES.values()];

describe('sourced measures', () => {
  it('loads all six research areas', () => {
    expect(Object.keys(SOURCED_AREAS).sort()).toEqual(['access', 'longterm', 'outcomes', 'plans', 'population', 'spending']);
    expect(all.length).toBeGreaterThan(200);
  });

  it('every measure names a source with a link, a period and a number', () => {
    for (const m of all) {
      expect(m.source?.url, m.id).toMatch(/^https?:\/\//);
      expect(m.period, m.id).toBeTruthy();
      const hasNumber = Number.isFinite(m.value) || m.series.length > 0 || m.rows.some((r) => Number.isFinite(r.value));
      expect(hasNumber, m.id).toBe(true);
    }
  });

  it('every estimate explains its method', () => {
    for (const m of all.filter((x) => x.method === 'estimate')) expect(m.methodNote, m.id).toBeTruthy();
  });

  it.each([
    './simpleMode/sourcedDisplay.generated.js',
    ...readdirSync(new URL('./simpleMode/lazy/', import.meta.url)).map((f) => `./simpleMode/lazy/${f}`),
  ])('keeps internal load notes and research notes out of %s', (file) => {
    const generated = readFileSync(new URL(file, import.meta.url), 'utf8');
    expect(generated).not.toMatch(/"loadNote"|"unresolved"|INTERNAL:/);
    expect(generated).not.toMatch(/this session|reviewData|hand-entered|entered by hand|BW export|wireframe V1|"repo:|LOW CONFIDENCE/i);
  });

  it('does not read a change across a method break as improving or worsening', () => {
    const m = MEASURES.get('cs-hbd-a1c-poor-control-ffy2024');
    expect(m.methodBreak).toBe('FFY 2024');
    expect(trendOf(m).improving).toBeNull();
    expect(MEASURES.get('pa-standard-denied-pct').series).toHaveLength(0);
  });

  it('charts and reads a trend only from the years on the new method after a break', () => {
    const m = MEASURES.get('cs-cis-combo3');
    expect(m.methodBreak).toBe('FFY 2024');
    const v = visualFor(m);
    expect(v.seriesLabels).toEqual(['FFY24', 'FFY25']);
    expect(v.series).toEqual([19.2, 49.5]);
    const t = trendOf(m);
    // The chart rises from FFY 2024 to FFY 2025, and the trend line says the same.
    expect(t.direction).toBe('up');
    expect(v.direction).toBe('up');
    expect(t.from).toBe('FFY 2024');
    expect(seriesBeforeBreak(m).map((p) => p.period)).toEqual(['FFY 2020', 'FFY 2021', 'FFY 2022']);
    // A measure with fewer than two new-method years keeps its full series and reads no trend direction.
    const hbd = MEASURES.get('cs-hbd-a1c-poor-control-ffy2024');
    expect(seriesBeforeBreak(hbd)).toHaveLength(0);
  });

  it('reads each trend into the headline period, not past it', () => {
    expect(periodKey('SFY 2027 enacted')).toBe('SFY 2027');
    expect(periodKey('FFY 2023 Q3')).toBe('FFY 2023 Q3');
    expect(periodKey('FFY 2022 to FFY 2024')).toBe('FFY 2024');
    // FMAP: the headline is FFY 2026; the series runs on to FFY 2027.
    expect(trendOf(MEASURES.get('fmap')).from).toBe('FFY 2025');
    // Quarters keep their own chart labels instead of repeating the year.
    expect(visualFor(MEASURES.get('fmap')).seriesLabels.slice(0, 3)).toEqual(['FFY23 Q1-2', 'FFY23 Q3', 'FFY23 Q4']);
    expect(trendOf(MEASURES.get('enacted-budget-2026-2028')).from).toBe('SFY 2026 revised');
    expect(trendOf(MEASURES.get('budgeted-enrollment')).from).toMatch(/^SFY 2025/);
    // The headline is the first year charted: there is nothing earlier to compare with.
    expect(trendOf(MEASURES.get('enacted-budget-2024-2026'))).toBeNull();
    // No trend line ever reads "since" the headline's own period.
    for (const m of all) {
      const t = trendOf(m);
      if (!t || !m.series.some((p) => periodKey(p.period) === periodKey(m.period))) continue;
      expect(periodKey(t.from), m.id).not.toBe(periodKey(m.period));
    }
  });

  it('lists the MCO contract dates as years only, with the renewals the current contract allows', () => {
    const m = MEASURES.get('mco-contract-term');
    // Every row is a year; the renewal count is part of the current term's label, not a bar beside years.
    for (const r of m.rows) expect(r.value, r.key).toBeGreaterThan(2000);
    expect(m.rows.find((r) => r.key === 'current-expiration').label).toMatch(/five more two-year renewals/);
  });

  it('names the waiver beside each county in the waiver-by-county card', () => {
    const v = visualFor(MEASURES.get('waiver-participants-top-counties'));
    const labels = v.compareRows.map((p) => p.label);
    // One entry per waiver (its largest county), largest first, each naming its waiver.
    expect([...labels].sort()).toEqual(['Home and Community Based: Jefferson', 'Michelle P.: Jefferson', 'Supports for Community Living: Jefferson']);
    expect(labels[0]).toBe('Home and Community Based: Jefferson');
  });

  it('never draws dollars, percents and staff counts on one bar scale', () => {
    const staff = visualFor(MEASURES.get('dms-staff-fte-estimate'));
    expect(staff.visual).toBe('heroBreakdown');
    for (const r of staff.breakdown) {
      expect(r.display, r.label).toMatch(/^\$/);
      expect(r.track, r.label).toBe(false);
    }
    const why = visualFor(MEASURES.get('spending-growth-decomposition'));
    expect(why.breakdown.some((r) => r.display.endsWith('%'))).toBe(true);
    for (const r of why.breakdown) expect(r.track, r.label).toBe(false);
    // A true breakdown (every row in the headline's unit) keeps its bars.
    const byType = visualFor(MEASURES.get('ltc-ffs-by-type'));
    for (const r of byType.breakdown) expect(r.track, r.label).toBeUndefined();
  });

  it('states drive-time map layers in minutes, as the county panel does', () => {
    expect(formatNumber(0.004, 'drive_hours')).toBe('0 min');
    expect(formatNumber(0.67, 'drive_hours')).toBe('40 min');
    const travel = Object.values(PAGES).flatMap((p) => p.sections).find((s) => s.id === 'travel');
    for (const o of travel.map.options) {
      expect(o.unit, o.measureId).toBe('drive_hours');
      expect(o.legend, o.measureId).toMatch(/^minutes /);
    }
  });

  it('compares against published figures, never against a named person', () => {
    const possessiveName = /\b[A-Z][a-z]+ [A-Z][a-z]+['’]s\b/;
    for (const m of all) {
      for (const ref of [m.comparison, m.target]) if (ref?.label) expect(ref.label, m.id).not.toMatch(possessiveName);
    }
    expect(MEASURES.get('nursing-facility-ffs-share').comparison.label).toMatch(/^Commonly cited figure/);
  });

  it('formats a comparison in its own unit when it differs from the measure', () => {
    const m = MEASURES.get('ltc-ffs-by-type');
    expect(m.unit).toBe('usd');
    expect(formatComparison(m)).toMatch(/: 25%$/);
    expect(formatComparison(m)).not.toMatch(/\$/);
    // A dollar measure is never drawn as a pill pair against a percent.
    const pills = visualFor({ ...m, rows: [] }).compareRows || [];
    expect(pills.some((p) => p.label === m.comparison.label)).toBe(false);
  });

  it('never charts a long-term care headline over a series on another basis', () => {
    for (const id of ['nf-facility-count', 'nf-certified-beds', 'nf-occupancy']) {
      expect(MEASURES.get(id).series, id).toHaveLength(0);
      expect(visualFor(MEASURES.get(id)).visual, id).not.toBe('areaTrend');
    }
    // Every long-term care chart that remains ends on, or passes through, its headline figure.
    for (const m of all.filter((x) => x.area === 'longterm' && x.series.length >= 2 && Number.isFinite(x.value))) {
      expect(m.series.some((p) => Math.abs(p.value - m.value) < 1e-9), m.id).toBe(true);
    }
  });

  it('every page, tile and briefing points at measures that exist', () => {
    for (const page of Object.values(PAGES)) {
      for (const section of page.sections) {
        for (const id of [...(section.measures || []), ...(section.table?.measures || []), ...(section.map?.options || []).map((o) => o.measureId)]) {
          expect(MEASURES.has(id), `${section.id}: ${id}`).toBe(true);
        }
      }
    }
    expect(TILE_CATALOG.length).toBeGreaterThan(DEFAULT_TILE_IDS.length);
    expect(DEFAULT_TILE_IDS).toHaveLength(13);
  });
});

describe('briefings', () => {
  it('builds at least four, each with an owner, next action and as-of', () => {
    expect(SIMPLE_BRIEFINGS.length).toBeGreaterThanOrEqual(4);
    for (const b of SIMPLE_BRIEFINGS) {
      expect(b.responsible && b.nextAction && b.asOf && b.affected, b.id).toBeTruthy();
      expect(b.headline.trim().endsWith('?'), b.id).toBe(true);
    }
  });

  it('headlines and ledes state no verdict and no product commentary', () => {
    for (const b of SIMPLE_BRIEFINGS) {
      const text = `${b.headline} ${b.lede}`.toLowerCase();
      for (const term of PROHIBITED_HEADLINE_TERMS) expect(text, `${b.id}: ${term}`).not.toMatch(new RegExp(`\\b${term}`));
      for (const term of PRODUCT_COMMENTARY_TERMS) expect(text, `${b.id}: ${term}`).not.toContain(term);
      expect(text).not.toMatch(/\bnan\b|undefined|—|\ba 8\d%|\ba 11%/);
    }
  });
});

describe('plan scorecard', () => {
  it('recognizes every plan name spelling the sources use', () => {
    expect(['WellCare of KY', 'Molina-Passport', 'Passport by Molina Healthcare', 'United Healthcare Community Plan', 'Anthem Blue Cross/Blue Shield'].map(planKey))
      .toEqual(['wellcare', 'passport', 'passport', 'united', 'anthem']);
  });

  it('never orders plans on an estimate', () => {
    expect(ORDERABLE_COLUMNS.some((c) => c.estimate)).toBe(false);
    expect(SCORECARD_COLUMNS.map((c) => c.id)).not.toContain('claim-denial-rate-estimate');
  });

  it('every column has a value for at least four current plans', () => {
    for (const c of SCORECARD_COLUMNS) {
      const present = ['wellcare', 'passport', 'aetna', 'humana', 'united'].filter((k) => Number.isFinite(c.values.get(k)));
      expect(present.length, c.id).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('measure model', () => {
  it('formats units', () => {
    expect(formatNumber(18302000000, 'usd', { compact: true })).toBe('$18.3 billion');
    expect(formatNumber(1032.86, 'usd_pmpm')).toBe('$1,033 PMPM');
    expect(formatNumber(26.1, 'percent')).toBe('26.1%');
    expect(formatNumber(1182.2, 'per_1000')).toBe('1,182.2 per 1,000');
  });

  it('shows a range for breakdown-only measures', () => {
    expect(formatMeasureValue({ unit: 'percent', rows: [{ value: 8 }, { value: 19.46 }] })).toBe('8%–19.5%');
  });

  it('picks a trend chart for a series and a bullet for a percent with a comparison', () => {
    expect(visualFor({ unit: 'usd', value: 2, series: [{ period: 'FFY 2023', value: 1 }, { period: 'FFY 2024', value: 2 }], rows: [] }).visual).toBe('areaTrend');
    expect(visualFor({ unit: 'percent', value: 26, comparison: { label: 'US median', value: 28 }, rows: [], series: [] }).visual).toBe('bullet');
  });
});

describe('tile layout', () => {
  const base = { shown: ['a', 'b', 'c'], pinned: [] };
  it('adds, removes, pins and orders', () => {
    expect(orderedTileIds(togglePin(base, 'c'))).toEqual(['c', 'a', 'b']);
    expect(removeTile(togglePin(base, 'b'), 'b')).toEqual({ shown: ['a', 'c'], pinned: [] });
    expect(addTile(base, 'd').shown).toEqual(['a', 'b', 'c', 'd']);
  });
  it('moves by drag and by keyboard', () => {
    expect(moveTileTo(base, 'a', 'c').shown).toEqual(['b', 'c', 'a']);
    expect(moveTileTo(base, 'c', 'a').shown).toEqual(['c', 'a', 'b']);
    expect(nudgeTile(base, 'b', -1).shown).toEqual(['b', 'a', 'c']);
    expect(nudgeTile(base, 'a', -1)).toBe(base);
  });
  it('drops unknown ids from a stored layout', () => {
    expect(normalizeLayout({ shown: ['a', 'zz'], pinned: ['zz', 'a'] }, ['a', 'b'], ['a', 'b'])).toEqual({ shown: ['a'], pinned: ['a'] });
  });
});
