import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MEASURES, SOURCED_AREAS } from './simpleMode/sourcedData.js';
import { PAGES } from './simpleMode/simpleAreas.js';
import { TILE_CATALOG, DEFAULT_TILE_IDS } from './simpleMode/simpleTiles.js';
import { SIMPLE_BRIEFINGS } from './simpleMode/simpleBriefings.js';
import { ORDERABLE_COLUMNS, SCORECARD_COLUMNS, planKey } from './simpleMode/planScorecard.js';
import { formatMeasureValue, formatNumber, trendOf, visualFor } from './simpleMode/measureModel.js';
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

  it('keeps internal load notes and research notes out of the public module', () => {
    const generated = readFileSync(new URL('./simpleMode/sourcedDisplay.generated.js', import.meta.url), 'utf8');
    expect(generated).not.toMatch(/"loadNote"|"unresolved"|INTERNAL:/);
    expect(generated).not.toMatch(/this session|reviewData|hand-entered|entered by hand|BW export|wireframe V1|"repo:|LOW CONFIDENCE/i);
  });

  it('does not read a change across a method break as improving or worsening', () => {
    const m = MEASURES.get('cs-hbd-a1c-poor-control-ffy2024');
    expect(m.methodBreak).toBe('FFY 2024');
    expect(trendOf(m).improving).toBeNull();
    expect(MEASURES.get('pa-standard-denied-pct').series).toHaveLength(0);
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
