import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type pg from 'pg';
import { ShareAndSurgeCandidateOwner, type KnownCase } from './ShareAndSurgeCandidateOwner.js';

// Specification-derived test of the screen's rules and its absent -> detected arrow
// (plan: docs/planning/share-and-surge-screen-codexen-plan.md). A stub client answers
// the owner's reads with a synthetic twelve-state world and records its writes.
// Run: node --import tsx --test src/molecules/ShareAndSurgeCandidateOwner.test.ts

const STATES = ['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG', 'HH', 'II', 'JJ', 'KK', 'LL'];
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024];

/** Every state pays the baseline on a code; the named state pays the override in the named years. */
function spending(hcpcs: string, baseline: number, overrides: Record<string, Partial<Record<number, number>>> = {}, states = STATES) {
  const rows: Array<Record<string, unknown>> = [];
  for (const state of states) {
    for (const year of YEARS) {
      const paid = overrides[state]?.[year] ?? baseline;
      rows.push({ state_code: state, hcpcs, year, paid: String(paid), billing_npis: 20, new_billing_npis: year === 2024 ? 12 : 1, top10_paid: String(paid * 0.6) });
    }
  }
  return rows;
}

function world() {
  // Twelve equal states: each is 1/12 (8.33%) of enrollment. Far above = 5 x 8.33% = 41.7% of national.
  const enrollment: Array<Record<string, unknown>> = [];
  for (const state of STATES) for (const year of YEARS) for (let m = 1; m <= 12; m += 1) enrollment.push({ state_code: state, period_ym: `${year}${String(m).padStart(2, '0')}`, total_enrollment: '1000000' });
  const months: Array<Record<string, unknown>> = [];
  for (const state of STATES) for (const year of YEARS) for (let m = 1; m <= 12; m += 1) months.push({ state_code: state, month_ym: `${year}-${String(m).padStart(2, '0')}`, paid: state === 'LL' && year === 2024 && m === 12 ? '1000' : '1000000' });
  const rows = [
    // SURGE: AA's share jumps from 1/12 to the lion's share in 2023 (others stay at 2M).
    ...spending('S0001', 2_000_000, { AA: { 2023: 60_000_000, 2024: 60_000_000 } }),
    // TRIPLE: BB grows 10M -> 20M -> 40M over 2022-2024 with no down year, share 40/62 = 65%.
    ...spending('T0002', 2_000_000, { BB: { 2022: 10_000_000, 2023: 20_000_000, 2024: 40_000_000 } }),
    // COLLAPSE: CC held 60M (73% share) in 2021-2022 then fell to 2M by 2024.
    ...spending('C0003', 2_000_000, { CC: { 2021: 60_000_000, 2022: 60_000_000, 2023: 4_000_000, 2024: 2_000_000 } }),
    // PERSISTENT: DD at 40M (65% share) every year since 2019.
    ...spending('P0004', 2_000_000, { DD: { 2019: 40_000_000, 2020: 40_000_000, 2021: 40_000_000, 2022: 40_000_000, 2023: 40_000_000, 2024: 40_000_000 } }),
    // CONVENTION: only five states bill this code; EE takes nearly all of it. The ten-state filter must set it aside.
    ...spending('V0005', 2_000_000, { EE: { 2023: 60_000_000, 2024: 60_000_000 } }, STATES.slice(0, 5)),
    // SMALL: FF's share surges but the dollars stay under the minimum state paid.
    ...spending('M0006', 20_000, { FF: { 2024: 600_000 } }),
  ];
  return { rows, enrollment, months };
}

type Query = { sql: string; params: unknown[] };

function stubClient(w: ReturnType<typeof world>, writes: Query[]) {
  return {
    async query(sql: string, params: unknown[] = []) {
      if (/FROM bw_ctl\.load_history WHERE data_request_id = \$1/.test(sql)) return { rows: [{ load_history_id: params[0] === 'DR-REAL-TMSIS-STATE-CODE-SPENDING' ? 'LH-SPEND-TEST' : 'LH-ENR-TEST' }] };
      if (/FROM bw_dso\.dso_tmsis_state_code_year/.test(sql)) return { rows: w.rows };
      if (/FROM bw_dso\.dso_tmsis_state_month/.test(sql)) return { rows: w.months };
      if (/FROM bw_dso\.dso_enrollment_state/.test(sql)) return { rows: w.enrollment };
      writes.push({ sql, params });
      if (/INSERT INTO bw_dso\.dso_share_surge_candidate/.test(sql)) return { rowCount: (sql.match(/\(\$/g) || []).length, rows: [] };
      return { rowCount: 0, rows: [] };
    },
  } as unknown as pg.PoolClient;
}

const KNOWN: KnownCase[] = [
  { id: 'aa-surge', state_code: 'AA', hcpcs: 'S0001', year: 2023, pattern: 'share-surge', expected: 'detected', note: '' },
  { id: 'bb-triple', state_code: 'BB', hcpcs: 'T0002', year: 2024, pattern: 'tripled-and-growing', expected: 'detected', note: '' },
  { id: 'cc-collapse', state_code: 'CC', hcpcs: 'C0003', year: 2024, pattern: 'share-collapse', expected: 'detected', note: '' },
  { id: 'dd-persistent', state_code: 'DD', hcpcs: 'P0004', year: 2024, pattern: 'persistent-excess', expected: 'detected', note: '' },
  { id: 'ee-convention', state_code: 'EE', hcpcs: 'V0005', year: 0, pattern: '', expected: 'not-detected', note: '' },
  { id: 'ff-small', state_code: 'FF', hcpcs: 'M0006', year: 0, pattern: '', expected: 'not-detected', note: '' },
];

describe('ShareAndSurgeCandidateOwner.DetectShareAndSurgeCandidates', () => {
  it('answers the four pattern questions, sets one-state conventions aside, and writes every candidate as detected', async () => {
    const writes: Query[] = [];
    const owner = new ShareAndSurgeCandidateOwner(stubClient(world(), writes));
    owner.KnownCases = KNOWN;
    await owner.DetectShareAndSurgeCandidates();
    assert.equal(owner.Status, 'SUCCEEDED', owner.ErrorMessage);

    const has = (state: string, hcpcs: string, year: number, pattern: string) => owner.Candidates.some((c) => c.state_code === state && c.hcpcs === hcpcs && c.year === year && c.pattern === pattern);
    assert.ok(has('AA', 'S0001', 2023, 'share-surge'), 'share surge');
    assert.ok(has('BB', 'T0002', 2024, 'tripled-and-growing'), 'tripled and growing');
    assert.ok(has('CC', 'C0003', 2024, 'share-collapse'), 'share collapse');
    assert.ok(has('DD', 'P0004', 2024, 'persistent-excess'), 'persistent excess');
    assert.ok(!owner.Candidates.some((c) => c.hcpcs === 'V0005'), 'five-state convention set aside by the ten-state filter');
    assert.ok(!owner.Candidates.some((c) => c.hcpcs === 'M0006'), 'under the minimum state paid');
    assert.ok(!owner.Candidates.some((c) => c.state_code !== 'AA' && c.hcpcs === 'S0001'), 'the other eleven states on the surge code do not fire');
    assert.ok(owner.BacktestResults.every((b) => b.ok), JSON.stringify(owner.BacktestResults));

    // The share and the excess multiple are the owner's definitions: AA 2023 = 60 / (60 + 11 x 2) of national, over 1/12 enrollment.
    const aa = owner.Candidates.find((c) => c.state_code === 'AA' && c.year === 2023 && c.pattern === 'share-surge')!;
    assert.ok(Math.abs(aa.share - 60 / 82) < 1e-9);
    assert.ok(Math.abs(aa.excessMultiple - (60 / 82) * 12) < 1e-9);
    assert.ok(Math.abs(aa.leadScore - aa.paid * aa.excessMultiple) < 1e-6);
    // Leveling what-if: AA 2023 above its enrollment line = 60M - 82M / 12; its 2022 share was 1/12 too, so the prior-share line is the same.
    assert.ok(Math.abs(aa.paidAboveEnrollmentLevel - (60_000_000 - 82_000_000 / 12)) < 1e-3);
    assert.ok(Math.abs(aa.paidAbovePriorShareLevel - (60_000_000 - 82_000_000 / 12)) < 1e-3);
    // CC's collapse year sits below both lines, so the what-if floors at zero.
    const cc = owner.Candidates.find((c) => c.state_code === 'CC' && c.year === 2024 && c.pattern === 'share-collapse')!;
    assert.equal(cc.paidAboveEnrollmentLevel, 0);
    assert.equal(cc.paidAbovePriorShareLevel, 0);
    // Peak context: the earlier year with the highest share, the first on a tie (CC 2021 and 2022 both at 60 / 82).
    assert.equal(cc.peakShareYear, 2021);
    assert.ok(Math.abs(cc.peakShare - 60 / 82) < 1e-9);
    assert.equal(aa.statesBilling, 12);
    assert.equal(aa.reportingComplete, true);
    // LL's December 2024 is a reporting tail, so LL 2024 is labeled incomplete (and kept).
    assert.equal(owner.ReportingCompleteByStateYear['LL|2024'], false);
    assert.equal(owner.ReportingCompleteByStateYear['LL|2023'], true);

    // absent -> detected: the replace runs in one transaction and every inserted row carries status 'detected' and the spending load.
    const candidateWrites = writes.filter((w) => /^(BEGIN|COMMIT|ROLLBACK)$/.test(w.sql.trim()) || /bw_dso\.dso_share_surge_candidate/.test(w.sql)).map((w) => w.sql.trim().split(/\s+/)[0]);
    assert.deepEqual(candidateWrites, ['BEGIN', 'DELETE', 'INSERT', 'COMMIT']);
    const insert = writes.find((w) => /INSERT INTO bw_dso\.dso_share_surge_candidate/.test(w.sql))!;
    const perRow = 29;
    for (let i = 0; i < insert.params.length; i += perRow) {
      assert.equal(insert.params[i + 4], 'detected');
      assert.equal(insert.params[i + 24], 'LH-SPEND-TEST');
    }
    assert.equal(owner.CandidatesInserted, owner.Candidates.length);
  });

  it('fails the run before any write when a known case is not reproduced', async () => {
    const writes: Query[] = [];
    const owner = new ShareAndSurgeCandidateOwner(stubClient(world(), writes));
    owner.KnownCases = [{ id: 'never', state_code: 'ZZ', hcpcs: 'S0001', year: 2023, pattern: 'share-surge', expected: 'detected', note: '' }];
    await owner.DetectShareAndSurgeCandidates();
    assert.equal(owner.Status, 'FAILED');
    assert.match(owner.ErrorMessage, /backtest failed/);
    assert.ok(!writes.some((w) => /INSERT INTO bw_dso\.dso_share_surge_candidate|DELETE FROM/.test(w.sql)), 'no candidate row replaced');
  });
});
