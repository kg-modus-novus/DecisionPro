import { describe, expect, it } from 'vitest';
import {
  asFilterIds,
  clearCubeCache,
  getObject,
  getSessionSeed,
  listChildLineItems,
  listSlice,
  queryAggregates,
  splitTotal,
  toggleDimensionFilter,
} from './alpCube.js';
import { SEED_CUBES } from '../data/alp/seedCubes.js';
import { ROOM_CONFIGS } from '../data/alp/roomConfigs.js';

describe('alpCube procedural engine', () => {
  it('has a seed cube for every room config', () => {
    for (const id of Object.keys(ROOM_CONFIGS)) {
      expect(SEED_CUBES[id]).toBeTruthy();
      expect(SEED_CUBES[id].baseTotal).toBeGreaterThan(0);
      expect(SEED_CUBES[id].listBaseCount).toBeGreaterThan(100);
    }
  });

  it('reconciles splitTotal children to the parent', () => {
    const keys = ['a', 'b', 'c', 'd'];
    const parts = splitTotal(1000, keys, getSessionSeed(), 'test-salt', {
      a: 0.4,
      b: 0.3,
      c: 0.2,
      d: 0.1,
    });
    const sum = parts.reduce((acc, p) => acc + p.value, 0);
    expect(sum).toBeCloseTo(1000, 1);
  });

  it('returns stable aggregates for the same filters in-session', () => {
    clearCubeCache();
    const a = queryAggregates('cost-drivers', { period: 'fy25q3' }, 'service', 'metric');
    const b = queryAggregates('cost-drivers', { period: 'fy25q3' }, 'service', 'metric');
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(3);
  });

  it('listSlice is stable and filter-sensitive', () => {
    clearCubeCache();
    const open = listSlice('command-center', {}, { page: 0, pageSize: 50 });
    const again = listSlice('command-center', {}, { page: 0, pageSize: 50 });
    expect(open.rows.map((r) => r.id)).toEqual(again.rows.map((r) => r.id));
    expect(open.totalCount).toBeGreaterThan(1000);
    expect(open.representedClaimLines).toBeGreaterThan(open.totalCount);

    const filtered = listSlice('command-center', { region: 'east' }, { page: 0, pageSize: 50 });
    expect(filtered.totalCount).toBeLessThan(open.totalCount);
    expect(filtered.rows[0].region).toBe('east');
  });

  it('getObject round-trips a list row id', () => {
    clearCubeCache();
    const { rows } = listSlice('utilization', { population: 'disabled' }, { page: 0, pageSize: 10 });
    const obj = getObject('utilization', rows[0].id);
    expect(obj.id).toBe(rows[0].id);
    expect(obj.title).toBe(rows[0].title);
    expect(obj.population).toBe('disabled');
  });

  it('keeps all dimension values when a filter on that dimension is selected', () => {
    clearCubeCache();
    const open = queryAggregates('mco', {}, 'mco', 'metric');
    const filtered = queryAggregates('mco', { mco: 'mco-a', region: 'central' }, 'mco', 'metric');
    expect(open.length).toBeGreaterThan(1);
    expect(filtered.length).toBe(open.length);
    expect(filtered.map((x) => x.id).sort()).toEqual(open.map((x) => x.id).sort());
  });

  it('builds child line items under an object', () => {
    clearCubeCache();
    const { rows } = listSlice('cost-drivers', {}, { page: 0, pageSize: 5 });
    const lines = listChildLineItems(rows[0], 6);
    expect(lines.length).toBe(6);
    expect(lines[0].parentId).toBe(rows[0].id);
    expect(lines[0].amount).toBeGreaterThan(0);
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

  it('list rows respect multi-value OR filters within a dimension', () => {
    clearCubeCache();
    const multi = listSlice('mco', { region: ['central', 'east'] }, { page: 0, pageSize: 40 });
    expect(multi.totalCount).toBeGreaterThan(120);
    expect(multi.rows.every((r) => r.region === 'central' || r.region === 'east')).toBe(true);
  });
});
