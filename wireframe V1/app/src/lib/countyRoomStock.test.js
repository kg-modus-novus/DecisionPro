import { describe, expect, it } from 'vitest';
import { clearCubeCache, getObject, listChildLineItems, queryAggregates } from './alpCube.js';
import { rollupSeriesByYear } from './periodScale.js';
import { PERIODS } from '../data/alp/dimensions.js';
import { ROOM_CONFIGS } from '../data/alp/roomConfigs.js';

const PIT = { pointInTime: true };

describe('County & District room: membership is a point-in-time stock', () => {
  it('(a) reads each county at the latest period instead of summing months', () => {
    clearCubeCache();
    expect(ROOM_CONFIGS.county.metricPointInTime).toBe(true);
    const byCounty = queryAggregates('county', {}, 'county', 'metric', PIT);
    const fayette = byCounty.find((b) => b.id === 'fayette');
    expect(fayette).toMatchObject({ value: 73210, count: 1 }); // ky202607 only
    const total = byCounty.reduce((a, b) => a + b.value, 0);
    expect(total).toBe(422715); // six counties at ky202607, not 5,851,460
    // Default (flow) behaviour is unchanged for other rooms.
    expect(queryAggregates('county', {}, 'county', 'metric').find((b) => b.id === 'fayette').value).toBe(1012708);
  });

  it('(a) a year filter reads the latest month inside that year', () => {
    clearCubeCache();
    const y2025 = queryAggregates('county', { period: 'y2025' }, 'county', 'metric', PIT);
    expect(y2025.find((b) => b.id === 'fayette').value).toBe(78748); // ky202510
  });

  it('(b) year rollup of a stock takes the last month, and Gap-only buckets are omitted (no "Latest 0")', () => {
    clearCubeCache();
    const byPeriod = queryAggregates('county', {}, 'period', 'metric', PIT);
    expect(byPeriod.some((b) => b.id === 'latest')).toBe(false);
    const years = rollupSeriesByYear(byPeriod, PERIODS, PIT);
    expect(years.map((y) => y.id)).toEqual(['y2024', 'y2025', 'y2026']);
    expect(years.find((y) => y.id === 'y2026').value).toBe(422715); // not 3,007,779
  });

  it('(b) rollupSeriesByYear keeps summing for flow measures', () => {
    const cat = [
      { id: 'pi201901', sort: 201901 },
      { id: 'pi201902', sort: 201902 },
    ];
    const series = [
      { id: 'pi201902', value: 5 },
      { id: 'pi201901', value: 10 },
    ];
    expect(rollupSeriesByYear(series, cat)[0].value).toBe(15);
    expect(rollupSeriesByYear(series, cat, PIT)[0].value).toBe(5);
  });

  it('(c) Fayette object page lists only Fayette rows, newest first', () => {
    clearCubeCache();
    const row = getObject('county', 'county-fayette-ky202607');
    const lines = listChildLineItems(row, 8, { entityKey: ROOM_CONFIGS.county.childLineEntityKey });
    expect(lines).toHaveLength(8);
    expect(lines.every((l) => l.sourceRow.county === 'fayette')).toBe(true);
    expect(lines.some((l) => /Boone/.test(l.label))).toBe(false);
    expect(lines[0].sourceRow.period).toBe('ky202606');
  });
});
