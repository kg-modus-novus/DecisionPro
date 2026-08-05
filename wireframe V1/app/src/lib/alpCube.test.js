import { describe, expect, it } from 'vitest';
import {
  asFilterIds,
  clearCubeCache,
  filtersExcludingDimension,
  getObject,
  listChildLineItems,
  listSlice,
  queryAggregates,
  splitTotal,
  toggleDimensionFilter,
} from './alpCube.js';
import { ROOM_CUBES_REAL } from '../data/alp/roomCubes.real.js';
import { ROOM_CONFIGS } from '../data/alp/roomConfigs.js';

describe('alpCube REAL hydration engine', () => {
  it('has REAL/Gap rows for every room config', () => {
    for (const id of Object.keys(ROOM_CONFIGS)) {
      const rows = ROOM_CUBES_REAL.rooms?.[id] || [];
      expect(rows.length, id).toBeGreaterThan(0);
      expect(rows.every((r) => r.rowKind === 'REAL' || r.rowKind === 'GAP')).toBe(true);
    }
  });

  it('never invents synthetic claim-line expansions', () => {
    clearCubeCache();
    const slice = listSlice('cost-drivers', {}, { page: 0, pageSize: 50 });
    expect(slice.representedClaimLines).toBe(0);
    expect(slice.realHydration).toBe(true);
  });

  it('reconciles splitTotal children to the parent', () => {
    const keys = ['a', 'b', 'c', 'd'];
    const parts = splitTotal(1000, keys);
    const sum = parts.reduce((acc, p) => acc + p.value, 0);
    expect(sum).toBeCloseTo(1000, 1);
  });

  it('returns stable aggregates for the same filters in-session', () => {
    clearCubeCache();
    const a = queryAggregates('cost-drivers', {}, 'service', 'metric');
    const b = queryAggregates('cost-drivers', {}, 'service', 'metric');
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('listSlice is stable and filter-sensitive', () => {
    clearCubeCache();
    const open = listSlice('command-center', {}, { page: 0, pageSize: 50 });
    const again = listSlice('command-center', {}, { page: 0, pageSize: 50 });
    expect(open.rows.map((r) => r.id)).toEqual(again.rows.map((r) => r.id));
    expect(open.totalCount).toBeGreaterThan(0);
    // Full PI monthly history injects one command-center row per loaded period.
    expect(open.totalCount).toBeLessThan(250);

    const filtered = listSlice('command-center', { attention: 'data-incomplete' }, { page: 0, pageSize: 50 });
    expect(filtered.totalCount).toBeLessThanOrEqual(open.totalCount);
    if (filtered.rows[0]) {
      expect(filtered.rows[0].attention).toBe('data-incomplete');
    }
  });

  it('getObject round-trips a list row id', () => {
    clearCubeCache();
    const { rows } = listSlice('utilization', {}, { page: 0, pageSize: 10 });
    expect(rows.length).toBeGreaterThan(0);
    const obj = getObject('utilization', rows[0].id);
    expect(obj.id).toBe(rows[0].id);
    expect(obj.title).toBe(rows[0].title);
  });

  it('builds related REAL/Gap items under an object', () => {
    clearCubeCache();
    const { rows } = listSlice('cost-drivers', {}, { page: 0, pageSize: 5 });
    const lines = listChildLineItems(rows[0], 6);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].parentId).toBe(rows[0].id);
    expect(['Gap object', 'Related REAL row']).toContain(lines[0].kind);
    expect(lines[0].sourceRowId).toBeTruthy();
    expect(lines[0].sourceRow?.id).toBe(lines[0].sourceRowId);
    expect(getObject('cost-drivers', lines[0].sourceRowId)?.id).toBe(lines[0].sourceRowId);
  });

  it('toggles dimension filters additively', () => {
    let filters = {};
    filters = toggleDimensionFilter(filters, 'region', 'central');
    expect(filters).toEqual({ region: 'central' });
    filters = toggleDimensionFilter(filters, 'region', 'east');
    expect(asFilterIds(filters.region)).toEqual(['central', 'east']);
    filters = toggleDimensionFilter(filters, 'region', 'central');
    expect(filters).toEqual({ region: 'east' });
    filters = toggleDimensionFilter(filters, 'region', 'east');
    expect(filters).toEqual({});
  });

  it('keeps visual-filter series full when excluding its own dimension', () => {
    clearCubeCache();
    const open = queryAggregates('benchmarks', {}, 'period', 'metric');
    const filteredSelf = queryAggregates('benchmarks', { period: 'y2023' }, 'period', 'metric');
    const vfSeries = queryAggregates(
      'benchmarks',
      filtersExcludingDimension({ period: 'y2023', population: 'adult' }, 'period'),
      'period',
      'metric',
    );
    expect(filteredSelf.length).toBeLessThan(open.length);
    expect(vfSeries.length).toBeGreaterThanOrEqual(open.length);
    expect(filtersExcludingDimension({ period: 'y2023', mco: 'aetna' }, 'period')).toEqual({
      mco: 'aetna',
    });
  });

  it('list rows respect multi-value OR filters within a dimension', () => {
    clearCubeCache();
    const multi = listSlice('county', { county: ['kenton', 'jefferson'] }, { page: 0, pageSize: 40 });
    expect(multi.totalCount).toBeGreaterThan(0);
    expect(multi.rows.every((r) => r.county === 'kenton' || r.county === 'jefferson' || r.rowKind === 'GAP')).toBe(
      true,
    );
  });

  it('expands year-token period filters to native CMS PI months', () => {
    clearCubeCache();
    const open = listSlice('command-center', {}, { page: 0, pageSize: 500 });
    const year = listSlice('command-center', { period: 'y2019' }, { page: 0, pageSize: 500 });
    expect(year.totalCount).toBeGreaterThan(0);
    expect(year.totalCount).toBeLessThan(open.totalCount);
    expect(
      year.rows.every(
        (r) =>
          r.rowKind === 'GAP' ||
          r.period === 'all' ||
          !r.period ||
          String(r.period).startsWith('pi2019') ||
          String(r.period).startsWith('cy2019'),
      ),
    ).toBe(true);
  });
});
