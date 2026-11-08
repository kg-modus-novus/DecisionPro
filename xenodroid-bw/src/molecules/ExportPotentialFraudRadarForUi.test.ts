import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type pg from 'pg';
import { ExportPotentialFraudRadarForUi } from './ExportPotentialFraudRadarForUi.js';
import { BACKTEST_NOTE_PREFIX, KNOWN_CASES, MINIMUM_STATES_BILLING, STATE_BILLING_THRESHOLD } from './ShareAndSurgeCandidateOwner.js';

// The export passes the screen owner's backtest verdicts through as recorded, with the
// states-billing count, and refuses a screen run whose verdicts predate that count.
// A stub client answers the screen load and one candidate row; every other read is empty.
// Run: node --import tsx --test src/molecules/ExportPotentialFraudRadarForUi.test.ts

function stubClient(notes: string) {
  return {
    async query(sql: string) {
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

async function run(notes: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pfd-export-'));
  const exporter = new ExportPotentialFraudRadarForUi(stubClient(notes));
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

  it('refuses a screen run whose verdicts predate the states-billing count', async () => {
    const { exporter } = await run(`screened 1 state-code-years | ${verdicts(false)}`);
    assert.equal(exporter.Status, 'FAILED');
    assert.match(exporter.ErrorMessage, /predates the states-billing count/);
  });
});
