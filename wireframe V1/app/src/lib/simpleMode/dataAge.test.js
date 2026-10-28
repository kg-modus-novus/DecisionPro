import { describe, expect, it } from 'vitest';
import { ageText, dataAge, freshnessRange, freshnessTone, periodEnd } from './dataAge.js';
import { MEASURES } from './sourcedData.js';

const iso = (d) => d?.toISOString().slice(0, 10) ?? null;
const NOW = new Date(Date.UTC(2026, 9, 28));

describe('periodEnd', () => {
  it.each([
    ['SFY 2024', '2024-06-30'],
    ['FFY 2024', '2024-09-30'],
    ['CY 2023', '2023-12-31'],
    ['2026-09', '2026-09-30'],
    ['2026-08-17', '2026-08-17'],
    ['FFY 2025 · MY 2024', '2024-12-31'],
    ['Core Set 2025', '2024-12-31'],
    ['Q3 2025', '2025-09-30'],
    ['Jan-Jun 2025', '2025-06-30'],
    ['Nov-Dec 2024 (FY 2025)', '2024-12-31'],
    ['10/1/2022-9/30/2024', '2024-09-30'],
    ['SFY 2025-2026', '2026-06-30'],
    ['FFY 2023 to FFY 2024', '2024-09-30'],
  ])('%s ends %s', (period, end) => {
    expect(iso(periodEnd(period))).toBe(end);
  });

  it('returns null for a release label with no data period', () => {
    expect(periodEnd('Care Compare Aug 2026 release')).toBeNull();
    expect(periodEnd('CHR 2025 release')).toBeNull();
  });
});

describe('dataAge', () => {
  it('reads age from the data period', () => {
    const age = dataAge({ rawPeriod: 'SFY 2024', asOfRaw: '2025-01-10' }, NOW);
    expect(age.basis).toBe('through');
    expect(age.months).toBe(27);
    expect(age.tone).toBe('old');
    expect(age.label).toBe('Data through Jun 2024 · 2 yr 3 mo old');
  });

  it('dates a release label or a future budget period by publication', () => {
    expect(dataAge({ rawPeriod: 'CHR 2025 release', asOfRaw: '2025-03-19' }, NOW).basis).toBe('published');
    const budget = dataAge({ rawPeriod: 'SFY 2027-2028', asOfRaw: '2026-04-15' }, NOW);
    expect(budget.basis).toBe('published');
    expect(budget.months).toBe(6);
  });

  it('gives every sourced measure an age', () => {
    const missing = [...MEASURES.values()].filter((m) => !dataAge(m, NOW)).map((m) => m.id);
    expect(missing).toEqual([]);
  });
});

describe('freshness helpers', () => {
  it('tones and words ages', () => {
    expect(freshnessTone(12)).toBe('fresh');
    expect(freshnessTone(13)).toBe('aging');
    expect(freshnessTone(25)).toBe('old');
    expect(ageText(0)).toBe('under a month old');
    expect(ageText(24)).toBe('2 yr old');
  });

  it('finds the oldest and newest data on a page', () => {
    const range = freshnessRange([{ rawPeriod: 'CY 2022' }, { rawPeriod: '2026-09' }], NOW);
    expect(iso(range.oldest.date)).toBe('2022-12-31');
    expect(iso(range.newest.date)).toBe('2026-09-30');
  });
});
