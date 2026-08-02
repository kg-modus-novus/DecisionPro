import { describe, expect, it } from 'vitest';
import {
  calendarYearFromPeriodId,
  expandPeriodFilterIds,
  isYearToken,
  monthScaleOptions,
  periodMatchesFilter,
  rollupSeriesByYear,
  selectedIdsForMonthScale,
  selectedIdsForYearScale,
  yearScaleOptions,
  yearToken,
} from './periodScale.js';

const CATALOG = [
  { id: 'cy2020', label: 'CY2020', shortLabel: 'CY20', sort: 2020 },
  { id: 'pi201901', label: 'CMS PI 2019-01', shortLabel: 'PI 2019-01', sort: 201901 },
  { id: 'pi201902', label: 'CMS PI 2019-02', shortLabel: 'PI 2019-02', sort: 201902 },
  { id: 'pi202001', label: 'CMS PI 2020-01', shortLabel: 'PI 2020-01', sort: 202001 },
  { id: 'latest', label: 'Latest available', shortLabel: 'Latest', sort: 9000 },
  { id: 'fy', label: 'Fiscal year', shortLabel: 'FY', sort: 9010 },
];

describe('periodScale', () => {
  it('derives calendar years from native period ids', () => {
    expect(calendarYearFromPeriodId('pi201903')).toBe(2019);
    expect(calendarYearFromPeriodId('cy2023')).toBe(2023);
    expect(calendarYearFromPeriodId('latest')).toBeNull();
    expect(isYearToken(yearToken(2019))).toBe(true);
  });

  it('expands year tokens to native catalog periods', () => {
    expect(expandPeriodFilterIds(['y2019'], CATALOG)).toEqual(['pi201901', 'pi201902']);
    expect(expandPeriodFilterIds(['y2020'], CATALOG)).toEqual(['cy2020', 'pi202001']);
  });

  it('matches rows by year token without inventing quarters', () => {
    expect(periodMatchesFilter('pi201902', ['y2019'], CATALOG)).toBe(true);
    expect(periodMatchesFilter('pi202001', ['y2019'], CATALOG)).toBe(false);
    expect(periodMatchesFilter('latest', ['latest'], CATALOG)).toBe(true);
    expect(periodMatchesFilter('fy', ['y2023'], CATALOG)).toBe(false);
  });

  it('builds year-scale options and rolls up series', () => {
    const opts = yearScaleOptions(CATALOG);
    expect(opts.map((o) => o.id)).toEqual(['y2019', 'y2020', 'latest', 'fy']);
    const rolled = rollupSeriesByYear(
      [
        { id: 'pi201901', value: 10 },
        { id: 'pi201902', value: 5 },
        { id: 'pi202001', value: 7 },
        { id: 'latest', value: 1 },
      ],
      CATALOG,
    );
    expect(rolled.find((r) => r.id === 'y2019')?.value).toBe(15);
    expect(rolled.find((r) => r.id === 'y2020')?.value).toBe(7);
    expect(rolled.find((r) => r.id === 'latest')?.value).toBe(1);
  });

  it('scopes month options to selected years', () => {
    const months = monthScaleOptions(CATALOG, ['y2019']);
    expect(months.map((m) => m.id)).toEqual(['pi201901', 'pi201902']);
  });

  it('highlights year tokens when native months are selected', () => {
    expect([...selectedIdsForYearScale(['pi201902', 'latest'])].sort()).toEqual(['latest', 'y2019']);
  });

  it('expands year filters to all months for month-scale highlight', () => {
    expect([...selectedIdsForMonthScale(['y2019'], CATALOG)].sort()).toEqual([
      'pi201901',
      'pi201902',
    ]);
    expect([...selectedIdsForMonthScale(['pi202001'], CATALOG)].sort()).toEqual([
      'pi202001',
    ]);
  });
});
