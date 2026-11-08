import { describe, expect, it } from 'vitest';
import { caseYearPoint, groupKnownCases } from './BacktestPage.jsx';
import { BACKTEST_SERVICE_TITLES, KNOWN_CASE_ENFORCEMENT_YEARS, PROGRAM_EVENTS, STATE_NAMES } from '../../data/potentialFraudCatalog.js';
import { POTENTIAL_FRAUD_RADAR } from '../../data/alp/potentialFraudRadar.js';

describe('backtests page', () => {
  const { cards, conventions } = groupKnownCases(POTENTIAL_FRAUD_RADAR.backtest);

  it('groups the shipped backtest into one card per known state and code, most recent first', () => {
    expect(cards.map((c) => [c.key, c.cases.map((b) => b.year), c.passed])).toEqual([
      ['KY|H2027', [2023, 2024], 2],
      ['AZ|H2027', [2022, 2024], 2],
      ['DC|H0036', [2022], 1],
    ]);
    expect(cards.flatMap((c) => c.cases).every((b) => b.expected === 'detected')).toBe(true);
  });

  it('draws the conventions from the screen counts, against the exported ten-state filter', () => {
    expect(conventions.map((b) => [b.hcpcs, b.mostStatesBilling, b.ok])).toEqual([['S5108', 5, true], ['G2087', 7, true]]);
    expect(POTENTIAL_FRAUD_RADAR.minimumStatesBilling).toBe(10);
    expect(POTENTIAL_FRAUD_RADAR.stateBillingThreshold).toBe(100_000);
    for (const b of POTENTIAL_FRAUD_RADAR.backtest) expect(Number.isInteger(b.mostStatesBilling), b.id).toBe(true);
    // A detected known case's code passed the filter, so it was billed in at least ten states.
    for (const c of cards) for (const b of c.cases) expect(b.mostStatesBilling).toBeGreaterThanOrEqual(POTENTIAL_FRAUD_RADAR.minimumStatesBilling);
  });

  it('counts a missed case and a fired convention as failures on their cards', () => {
    const backtest = [
      { id: 'a', state_code: 'KY', hcpcs: 'H2027', year: 2023, expected: 'detected', detected: false, ok: false, mostStatesBilling: 16 },
      { id: 'b', state_code: 'KY', hcpcs: 'H2027', year: 2024, expected: 'detected', detected: true, ok: true, mostStatesBilling: 16 },
      { id: 'c', state_code: 'KY', hcpcs: 'S5108', year: 0, expected: 'not-detected', detected: true, ok: false, mostStatesBilling: 5 },
    ];
    const g = groupKnownCases(backtest);
    expect(g.cards).toHaveLength(1);
    expect(g.cards[0].passed).toBe(1);
    expect(g.conventions.map((b) => b.ok)).toEqual([false]);
  });

  it('labels a case-year point from the export verdict alone', () => {
    const scored = { score: 93, tier: { key: 'high', shortLabel: 'HIGH' } };
    expect(caseYearPoint({ detected: true }, scored)).toEqual({ label: 'HIGH 93', tierKey: 'high', filled: true });
    expect(caseYearPoint({ detected: true }, { score: 0, tier: { key: 'closed', shortLabel: 'CLOSED' } }).label).toBe('CLOSED');
    // Detected by the screen but with no scored row: still flagged, never MISSED.
    expect(caseYearPoint({ detected: true }, undefined)).toEqual({ label: 'FLAGGED', tierKey: '', filled: true });
    expect(caseYearPoint({ detected: false }, scored)).toEqual({ label: 'MISSED', tierKey: '', filled: false });
  });

  it('draws the convention bars out of the jurisdictions the export carries', () => {
    const exported = new Set(Object.keys(POTENTIAL_FRAUD_RADAR.enrollmentShare).map((k) => k.split('|')[0]));
    expect([...exported].sort()).toEqual(Object.keys(STATE_NAMES).sort());
  });

  it('takes enforcement years from the program events and titles every backtest code', () => {
    // Each year is the start of an enforcement event on the same state and code, not just any event that year.
    for (const [key, year] of Object.entries(KNOWN_CASE_ENFORCEMENT_YEARS)) {
      expect(PROGRAM_EVENTS[key].some((e) => e.date.startsWith(`${year}-`) && /enforcement|suspen/i.test(e.event)), key).toBe(true);
    }
    for (const b of POTENTIAL_FRAUD_RADAR.backtest) expect(BACKTEST_SERVICE_TITLES[b.hcpcs], b.hcpcs).toBeTruthy();
  });
});
