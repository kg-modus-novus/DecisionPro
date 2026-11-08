import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type pg from 'pg';
import { ExportPotentialFraudRadarForUi } from './ExportPotentialFraudRadarForUi.js';
import { NPPES_RULE_NOTE_PREFIX } from './TmsisStateCodeSpendingOwner.js';
import { BACKTEST_NOTE_PREFIX, KNOWN_CASES, MINIMUM_STATES_BILLING, STATE_BILLING_THRESHOLD } from './ShareAndSurgeCandidateOwner.js';

// The export passes the screen owner's backtest verdicts through as recorded, with the
// states-billing count, and refuses a screen run whose verdicts predate that count.
// A stub client answers the screen load and one candidate row; every other read is empty.
// Run: node --import tsx --test src/molecules/ExportPotentialFraudRadarForUi.test.ts

const SPEND_ROW = {
  state_code: 'KY', hcpcs: 'H2027', year: 2024, paid: '1000000.40', billing_npis: 20, new_billing_npis: 5, top10_paid: '600000',
  new_billing_npis_enumeration_known: 4, new_billing_npis_recently_enumerated: 3, new_billing_recently_enumerated_paid: '150000.60',
  taxonomy_known_billing_npis: 18, taxonomy_known_paid: '900000', off_taxonomy_billing_npis: 6, off_taxonomy_paid: '300000', expected_taxonomies: 4,
};

const RULE_NOTE = `staged 1 rows | ${NPPES_RULE_NOTE_PREFIX}{"recentEnumerationWindowYears":3,"expectedTaxonomyPaidCoverage":0.8,"source":"NPPES copy named by the load"}`;

function stubClient(notes: string, spendRows: unknown[] = [], spendingNotes = RULE_NOTE) {
  return {
    async query(sql: string) {
      if (/FROM bw_ctl\.load_history WHERE load_history_id = \$1/.test(sql)) return { rows: [{ notes: spendingNotes }] };
      if (/FROM bw_dso\.dso_tmsis_state_code_year\s+WHERE[^]*hcpcs = ANY/.test(sql)) return { rows: spendRows };
      if (/FROM bw_ctl\.load_history WHERE data_request_id = \$1/.test(sql)) {
        return { rows: [{ load_history_id: 'LH-SCREEN-TEST', started_at: '2026-11-08T00:00:00Z', completed_at: '2026-11-08T00:01:00Z', notes, row_count: 1 }] };
      }
      if (/FROM bw_dso\.dso_share_surge_candidate/.test(sql)) {
        return { rows: [{
          state_code: 'KY', hcpcs: 'H2027', year: 2024, pattern: 'share-surge', state_paid: '1000000', national_paid: '2000000', share_of_national: '0.5',
          enrollment_share: '0.02', excess_multiple: '25', prior_year_share: '0.1', prior_year_paid: '200000', two_years_prior_paid: '100000',
          peak_share: '0.1', peak_share_year: 2023, states_billing: 16, billing_npis: 20, new_billing_npis: 5, top10_share: '0.6',
          reporting_complete: true, known_case_id: null, paid_above_enrollment_level: '960000', paid_above_prior_share_level: '800000',
          spending_load_history_id: 'LH-SPEND-TEST',
        }] };
      }
      return { rows: [] };
    },
  } as unknown as pg.PoolClient;
}

const verdicts = (withCount: boolean) => `${BACKTEST_NOTE_PREFIX}${JSON.stringify(KNOWN_CASES.map((k, i) => ({
  id: k.id, expected: k.expected, detected: k.expected === 'detected', ok: true, ...(withCount ? { mostStatesBilling: 5 + i } : {}),
})))}`;

async function run(notes: string, spendRows: unknown[] = [], spendingNotes = RULE_NOTE) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pfd-export-'));
  const exporter = new ExportPotentialFraudRadarForUi(stubClient(notes, spendRows, spendingNotes));
  exporter.ExportPath = path.join(dir, 'potentialFraudRadar.js');
  await exporter.Run();
  const text = exporter.Status === 'SUCCEEDED' ? await fs.readFile(exporter.ExportPath, 'utf8') : '';
  await fs.rm(dir, { recursive: true, force: true });
  return { exporter, payload: text ? JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) : null };
}

describe('ExportPotentialFraudRadarForUi backtest', () => {
  it('carries each verdict with its states-billing count, the ten-state filter and the billing threshold', async () => {
    const { exporter, payload } = await run(`screened 1 state-code-years | ${verdicts(true)}`);
    assert.equal(exporter.Status, 'SUCCEEDED', exporter.ErrorMessage);
    assert.deepEqual(payload.backtest.map((b: { id: string; mostStatesBilling: number }) => [b.id, b.mostStatesBilling]), KNOWN_CASES.map((k, i) => [k.id, 5 + i]));
    assert.equal(payload.minimumStatesBilling, MINIMUM_STATES_BILLING);
    assert.equal(payload.stateBillingThreshold, STATE_BILLING_THRESHOLD);
    assert.equal(payload.screenRun.notes, 'screened 1 state-code-years');
  });

  it('carries the NPPES counts on the yearly series, each code\'s expected taxonomies and the rule its load recorded, with its source', async () => {
    const { exporter, payload } = await run(`screened 1 state-code-years | ${verdicts(true)}`, [SPEND_ROW]);
    assert.equal(exporter.Status, 'SUCCEEDED', exporter.ErrorMessage);
    const at = (name: string) => payload.seriesColumns.indexOf(name);
    const row = payload.series['KY|H2027'][0];
    assert.equal(row[at('statePaid')], 1000000);
    assert.equal(row[at('newBillingNpisRecentlyEnumerated')], 3);
    assert.equal(row[at('newBillingRecentlyEnumeratedPaid')], 150001);
    assert.equal(row[at('offTaxonomyBillingNpis')], 6);
    assert.equal(row[at('taxonomyKnownPaid')], 900000);
    assert.equal(row.length, payload.seriesColumns.length);
    assert.deepEqual(payload.expectedTaxonomiesByCode, { H2027: 4 });
    assert.deepEqual(payload.nppesRule, { recentEnumerationWindowYears: 3, expectedTaxonomyPaidCoverage: 0.8, source: 'NPPES copy named by the load' });
  });

  it('refuses a spending load that does not record its NPPES rule', async () => {
    const { exporter } = await run(`screened 1 state-code-years | ${verdicts(true)}`, [SPEND_ROW], 'staged 1 rows');
    assert.equal(exporter.Status, 'FAILED');
    assert.match(exporter.ErrorMessage, /does not record its NPPES rule/);
  });

  it('refuses a spending load made before the NPPES counts', async () => {
    const { exporter } = await run(`screened 1 state-code-years | ${verdicts(true)}`, [{ ...SPEND_ROW, new_billing_npis_enumeration_known: null }]);
    assert.equal(exporter.Status, 'FAILED');
    assert.match(exporter.ErrorMessage, /predates the NPPES counts/);
  });

  it('refuses a screen run whose verdicts predate the states-billing count', async () => {
    const { exporter } = await run(`screened 1 state-code-years | ${verdicts(false)}`);
    assert.equal(exporter.Status, 'FAILED');
    assert.match(exporter.ErrorMessage, /predates the states-billing count/);
  });
});
