import { describe, expect, it } from 'vitest';
import { areaUnits, byVulnerabilityQuartile, countiesForZips, isCombined, quartileOf, summedCount, weightedPercent } from './localArea.js';
import { HOUSE_DISTRICTS } from './geography.js';

const pct = { rows: [{ key: 'a', value: 10, pop18: 100, ciLow: 8, ciHigh: 12 }, { key: 'b', value: 20, pop18: 300 }] };

describe('localArea', () => {
  it('weights percentages by population and keeps a single area’s interval', () => {
    expect(weightedPercent(pct, [{ key: 'a', share: 1 }])).toMatchObject({ value: 10, ciLow: 8, ciHigh: 12, combined: false });
    const both = weightedPercent(pct, [{ key: 'a', share: 1 }, { key: 'b', share: 1 }]);
    expect(both.value).toBe(17.5);
    expect(both.combined).toBe(true);
    expect(both.ciLow).toBeUndefined();
  });

  it('sums counts with a combined margin of error', () => {
    const counts = { rows: [{ key: 'a', value: 100, moe: 30 }, { key: 'b', value: 50, moe: 40 }] };
    expect(summedCount(counts, [{ key: 'a', share: 1 }, { key: 'b', share: 0.5 }])).toMatchObject({ value: 125, moe: 36 });
  });

  it('splits a legislative district’s counties by their share of residents', () => {
    const district = HOUSE_DISTRICTS.find((d) => d.counties.some((c) => !c.whole));
    const units = areaUnits({ kind: 'house', key: district.key });
    expect(units.length).toBe(district.counties.length);
    expect(units.some((u) => u.share < 1)).toBe(true);
    expect(isCombined(units)).toBe(true);
  });

  it('finds the counties a set of zip codes touches', () => {
    const crosswalk = { rows: [{ key: '40203', counties: [{ fips: '21111', share: 1 }] }, { key: '40014', counties: [{ fips: '21185', share: 0.9 }, { fips: '21111', share: 0.1 }] }] };
    expect(countiesForZips(crosswalk, ['40203', '40014']).sort()).toEqual(['21111', '21185']);
  });

  it('groups counties into vulnerability quarters', () => {
    expect(quartileOf(0.1, [0.1, 0.2, 0.3, 0.4])).toBe(1);
    expect(quartileOf(0.4, [0.1, 0.2, 0.3, 0.4])).toBe(4);
    const svi = { rows: [1, 2, 3, 4].map((i) => ({ key: `c${i}`, fips: `c${i}`, value: i / 10 })) };
    const measure = { rows: [1, 2, 3, 4].map((i) => ({ key: `c${i}`, fips: `c${i}`, value: i * 10 })) };
    expect(byVulnerabilityQuartile(measure, svi).map((g) => g.mean)).toEqual([10, 20, 30, 40]);
  });
});
