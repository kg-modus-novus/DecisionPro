import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CountDisclosure, SUPPRESSED_DISPLAY } from './simpleMode/countDisclosureProgram.js';
import { PlanComparison } from './simpleMode/planComparisonProgram.js';
import {
  PINNED_TILES_MAX,
  PINNED_TILES_STORAGE_KEY,
  normalizePinnedTiles,
  orderTilesByPins,
  readPinnedTiles,
  storePinnedTiles,
  togglePinnedTile,
} from './simpleMode/pinnedTiles.js';
import {
  KY_COUNTY_ROWS,
  KY_MEMBERS_TOTAL,
  MCO_MEASURES,
  MCO_ROWS,
  MCO_UNIFORM_MEASURE_IDS,
  MEMBER_BANDS,
  bandIndexFor,
  compareMcos,
  quantileBands,
} from './simpleMode/simpleModeData.js';
import { MCPAR_PLAN_PERIOD } from '../data/alp/mcparPlanPeriod.js';
import { KY_COUNTY_SHAPES } from '../data/alp/kyCountyShapes.js';
import { PROHIBITED_HEADLINE_TERMS } from '../data/operationalBriefings.js';

function disclose(rows, { totalShown = false } = {}) {
  const d = new CountDisclosure();
  d.CountRows = rows;
  d.GroupTotalIsShown = totalShown;
  d.DiscloseAggregateCounts();
  return d;
}

describe('CountDisclosure', () => {
  it('suppresses counts from 1 to 10 and shows zero and 11+', () => {
    const d = disclose([
      { key: 'a', count: 0 }, { key: 'b', count: 1 }, { key: 'c', count: 10 }, { key: 'd', count: 11 },
    ]);
    expect(d.DisclosedRows.map((r) => r.display)).toEqual(['0', SUPPRESSED_DISPLAY, SUPPRESSED_DISPLAY, '11']);
    expect(d.SmallCellCount).toBe(2);
  });

  it('adds a complementary suppression when one cell is hidden and the total is shown', () => {
    const d = disclose([
      { key: 'a', count: 4 }, { key: 'b', count: 40 }, { key: 'c', count: 25 }, { key: 'd', count: 0 },
    ], { totalShown: true });
    const byKey = Object.fromEntries(d.DisclosedRows.map((r) => [r.key, r]));
    expect(byKey.a.reason).toBe('small-count');
    expect(byKey.c.reason).toBe('complementary');
    expect(byKey.b.suppressed).toBe(false);
    expect(byKey.d.display).toBe('0');
    expect(d.GroupTotalIsWithheld).toBe(false);
  });

  it('withholds the total when the hidden cell has no count to pair with', () => {
    const d = disclose([{ key: 'a', count: 4 }, { key: 'b', count: 0 }], { totalShown: true });
    expect(d.GroupTotalIsWithheld).toBe(true);
    expect(d.DisclosedRows[1].display).toBe('0');
  });

  it('needs no complementary suppression without a shown total', () => {
    const d = disclose([{ key: 'a', count: 4 }, { key: 'b', count: 40 }]);
    expect(d.ComplementarySuppressionIsNeeded).toBe(false);
    expect(d.DisclosedRows[1].suppressed).toBe(false);
  });

  it('starts each run from its INITIAL state when reused', () => {
    const d = disclose([{ key: 'a', count: 4 }, { key: 'b', count: 0 }], { totalShown: true });
    d.InitializeCountDisclosure();
    d.CountRows = [{ key: 'z', count: 99 }];
    d.DiscloseAggregateCounts();
    expect(d.GroupTotalIsWithheld).toBe(false);
    expect(d.DisclosedRows.map((r) => r.display)).toEqual(['99']);
  });
});

describe('PlanComparison', () => {
  const rows = [
    { plan: 'A', values: { r: 2, c: 10 } },
    { plan: 'B', values: { r: 50, c: 30 } },
    { plan: 'C', values: { r: null, c: 20 } },
  ];

  function order(measureId, derived, verdict = false, planRows = rows) {
    const p = new PlanComparison();
    p.PlanRows = planRows;
    p.MeasureId = measureId;
    p.MeasureIsDerivedRatio = derived;
    p.ExportedComparabilityVerdict = verdict;
    p.OrderPlansOnComparableMeasure();
    return p;
  }

  it('orders on a reported measure, highest first', () => {
    expect(order('c', false).OrderedPlanRows.map((r) => r.plan)).toEqual(['B', 'C', 'A']);
  });

  it('orders a derived ratio only with a comparable export verdict, missing values last', () => {
    expect(order('r', true, false).MeasureIsComparable).toBe(false);
    expect(order('r', true, false).OrderedPlanRows.map((r) => r.plan)).toEqual(['A', 'B', 'C']);
    expect(order('r', true, true).OrderedPlanRows.map((r) => r.plan)).toEqual(['B', 'A', 'C']);
  });

  it('keeps plans that both lack a value in their relative order', () => {
    const sparse = [{ plan: 'X', values: {} }, { plan: 'Y', values: { m: 1 } }, { plan: 'Z', values: {} }, { plan: 'W', values: { m: 5 } }];
    expect(order('m', false, false, sparse).OrderedPlanRows.map((r) => r.plan)).toEqual(['W', 'Y', 'X', 'Z']);
  });

  it('follows the exported MCPAR comparability verdicts', () => {
    const exported = MCPAR_PLAN_PERIOD.byState.KY.programs[0].comparability;
    for (const [measureId, verdict] of Object.entries(exported)) {
      if (!MCO_MEASURES.some((m) => m.id === measureId)) continue;
      expect(compareMcos(measureId).comparable, measureId).toBe(verdict.comparable);
    }
  });
});

describe('pinned tiles', () => {
  function memoryStorage() {
    const map = new Map();
    return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  }

  it('caps pins, ignores duplicates and unknown ids', () => {
    expect(normalizePinnedTiles(['a', 'a', 'x', 'b'], ['a', 'b'])).toEqual(['a', 'b']);
    let pins = [];
    for (let i = 0; i < PINNED_TILES_MAX + 2; i += 1) pins = togglePinnedTile(pins, `t${i}`);
    expect(pins).toHaveLength(PINNED_TILES_MAX);
    expect(togglePinnedTile(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('round-trips through storage and survives bad JSON', () => {
    const storage = memoryStorage();
    storePinnedTiles(['b', 'a'], storage);
    expect(readPinnedTiles(['a', 'b'], storage)).toEqual(['b', 'a']);
    storage.setItem(PINNED_TILES_STORAGE_KEY, '{not json');
    expect(readPinnedTiles(null, storage)).toEqual([]);
  });

  it('puts pinned tiles first in pin order', () => {
    const tiles = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(orderTilesByPins(tiles, ['c', 'a']).map((t) => t.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('simple mode data', () => {
  it('joins every Kentucky county to a map shape', () => {
    expect(KY_COUNTY_ROWS).toHaveLength(120);
    expect(KY_COUNTY_SHAPES.counties).toHaveLength(120);
    expect(KY_COUNTY_ROWS.every((row) => row.shape)).toBe(true);
  });

  it('builds five ordered quantile bands that cover every county', () => {
    expect(MEMBER_BANDS).toHaveLength(5);
    for (const row of KY_COUNTY_ROWS) expect(bandIndexFor(row.members, MEMBER_BANDS)).not.toBeNull();
    expect(quantileBands([])).toEqual([]);
    expect(bandIndexFor(null, MEMBER_BANDS)).toBeNull();
  });

  it('members total equals the sum of county counts', () => {
    const sum = KY_COUNTY_ROWS.reduce((s, r) => s + (r.members || 0), 0);
    expect(KY_MEMBERS_TOTAL).toBe(sum);
  });

  it('keeps every MCPAR plan and asserts no plan status the export does not carry', () => {
    expect(MCO_ROWS).toHaveLength(MCPAR_PLAN_PERIOD.byState.KY.programs[0].plans.length);
  });

  it('never offers an app-computed ratio for ordering plans', () => {
    expect(MCO_MEASURES.map((m) => m.id)).not.toContain('premiumPerEnrollee');
    expect(MCO_UNIFORM_MEASURE_IDS).toContain('mlrPercent');
  });

  it('uses no verdict wording in measure labels or page copy', () => {
    const pageCopy = ['SimpleHome.jsx', 'KyCountyHeatMap.jsx', 'simple/SimpleBlocks.jsx', 'simple/SimpleWidgets.jsx']
      .map((f) => readFileSync(new URL(`../components/${f}`, import.meta.url), 'utf8')).join(' ');
    const text = [...MCO_MEASURES.map((m) => m.label), pageCopy].join(' ').toLowerCase();
    for (const term of PROHIBITED_HEADLINE_TERMS) expect(text, term).not.toMatch(new RegExp(`\\b${term}`));
  });
});
