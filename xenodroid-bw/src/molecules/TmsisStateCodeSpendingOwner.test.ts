import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type pg from 'pg';
import { psaStore } from '../psa/filesystemPsa.js';
import {
  EXPECTED_TAXONOMY_PAID_COVERAGE, NPPES_RULE_NOTE_PREFIX, ParseStagedStateCodeYearCsv, ParseStagedStateMonthCsv, RECENT_ENUMERATION_WINDOW_YEARS, TmsisStateCodeSpendingOwner,
} from './TmsisStateCodeSpendingOwner.js';

// Run: node --import tsx --test src/molecules/TmsisStateCodeSpendingOwner.test.ts

describe('ParseStagedStateCodeYearCsv', () => {
  it('types every column and marks UNMATCHED rows as attribution none', () => {
    const rows = ParseStagedStateCodeYearCsv([
      'yr,hcpcs,state,attribution,lines,paid,patient_cells,cells,billing_npis,new_billing_npis,top10_paid,zero_paid_lines,new_billing_npis_enumeration_known,new_billing_npis_recently_enumerated,new_billing_recently_enumerated_paid,taxonomy_known_billing_npis,taxonomy_known_paid,off_taxonomy_billing_npis,off_taxonomy_paid,expected_taxonomies',
      '2024,H2027,KY,billing-or-servicing,571102,142998855.11,103980,2200,171,124,83200000.00,0,120,61,30500000.25,168,142000000.00,40,51000000.00,3',
      '2024,H2027,UNMATCHED,none,12,1000.50,12,1,1,1,1000.50,0,0,0,0,0,0,0,0,3',
    ].join('\n'));
    assert.equal(rows.length, 2);
    assert.equal(rows[0].year, 2024);
    assert.equal(rows[0].paid, 142998855.11);
    assert.equal(rows[0].new_billing_npis, 124);
    assert.equal(rows[0].new_billing_npis_recently_enumerated, 61);
    assert.equal(rows[0].new_billing_recently_enumerated_paid, 30500000.25);
    assert.equal(rows[0].off_taxonomy_paid, 51000000);
    assert.equal(rows[0].expected_taxonomies, 3);
    assert.equal(rows[0].attribution, 'billing-or-servicing');
    assert.equal(rows[1].attribution, 'none');
  });

  it('rejects a non-numeric amount instead of loading a null', () => {
    assert.throws(() => ParseStagedStateCodeYearCsv([
      'yr,hcpcs,state,attribution,lines,paid,patient_cells,cells,billing_npis,new_billing_npis,top10_paid,zero_paid_lines,new_billing_npis_enumeration_known,new_billing_npis_recently_enumerated,new_billing_recently_enumerated_paid,taxonomy_known_billing_npis,taxonomy_known_paid,off_taxonomy_billing_npis,off_taxonomy_paid,expected_taxonomies',
      '2024,H2027,KY,billing-or-servicing,571102,,103980,2200,171,124,83200000.00,0,120,61,30500000.25,168,142000000.00,40,51000000.00,3',
    ].join('\n')), /non-numeric paid/);
  });

  it('rejects a stage made before the NPPES counts instead of loading zeros', () => {
    assert.throws(() => ParseStagedStateCodeYearCsv([
      'yr,hcpcs,state,attribution,lines,paid,patient_cells,cells,billing_npis,new_billing_npis,top10_paid,zero_paid_lines',
      '2024,H2027,KY,billing-or-servicing,571102,142998855.11,103980,2200,171,124,83200000.00,0',
    ].join('\n')), /non-numeric new_billing_npis_enumeration_known/);
  });
});

describe('ParseStagedStateMonthCsv', () => {
  it('requires a YYYY-MM month', () => {
    assert.deepEqual(ParseStagedStateMonthCsv('month,state,lines,paid\n2024-12,KY,10,108523255.30'), [
      { state_code: 'KY', month_ym: '2024-12', claim_lines: 10, paid: 108523255.3 },
    ]);
    assert.throws(() => ParseStagedStateMonthCsv('month,state,lines,paid\n202412,KY,10,1'), /bad row/);
  });
});

// The load molecule end to end: a temporary stage directory and PSA root, and a stub client that
// records every statement. The owner refuses a stage made under another NPPES rule, with a count
// above its base, or with two expected-taxonomy counts for one code, and replaces nothing.
const HEADER = 'yr,hcpcs,state,attribution,lines,paid,patient_cells,cells,billing_npis,new_billing_npis,top10_paid,zero_paid_lines,new_billing_npis_enumeration_known,new_billing_npis_recently_enumerated,new_billing_recently_enumerated_paid,taxonomy_known_billing_npis,taxonomy_known_paid,off_taxonomy_billing_npis,off_taxonomy_paid,expected_taxonomies';
const KY = '2024,H2027,KY,billing-or-servicing,100,1000.00,10,2,20,8,600.00,0,8,4,300.00,18,900.00,5,200.00,3';
const AZ = '2024,H2027,AZ,billing-or-servicing,50,500.00,5,1,10,2,400.00,0,2,1,50.00,9,450.00,1,20.00,3';

let root = '';
const psaRootBefore = psaStore.root;
before(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'tmsis-owner-')); psaStore.root = path.join(root, 'psa'); });
after(async () => { psaStore.root = psaRootBefore; await fs.rm(root, { recursive: true, force: true }); });

async function load(rows: string[], rule = { recentEnumerationWindowYears: RECENT_ENUMERATION_WINDOW_YEARS, expectedTaxonomyPaidCoverage: EXPECTED_TAXONOMY_PAID_COVERAGE }) {
  const stage = await fs.mkdtemp(path.join(root, 'stage-'));
  const paid = rows.reduce((a, r) => a + Number(r.split(',')[5]), 0);
  await fs.writeFile(path.join(stage, 'state_code_year.csv'), [HEADER, ...rows].join('\n'));
  await fs.writeFile(path.join(stage, 'state_month.csv'), `month,state,lines,paid\n2024-01,KY,150,${paid.toFixed(2)}`);
  await fs.writeFile(path.join(stage, 'manifest.json'), JSON.stringify({
    version: '2026-02-09', parquetSha256: 'abc', publisherTotalPaid: paid, keptTotalPaid: paid, setAsideRule: 'none', setAsideRows: 0, setAsidePaid: 0,
    publisherRows: rows.length, stateCodeYearRows: rows.length, stateMonthRows: 1, attributionRule: 'test', nppesMirror: 'test', datasetUri: 'test', nppesSourceLabel: 'NPPES test copy', ...rule,
  }));
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const client = { async query(sql: string, values: unknown[] = []) { statements.push({ sql, values }); return { rows: [], rowCount: /^\s*INSERT INTO bw_dso/.test(sql) ? values.length / (/dso_tmsis_state_code_year/.test(sql) ? 24 : 8) : 1 }; } } as unknown as pg.PoolClient;
  const owner = new TmsisStateCodeSpendingOwner(client);
  owner.StageDirectory = stage;
  await owner.LoadStateCodeSpendingAggregate();
  return { owner, statements };
}
const replaced = (statements: Array<{ sql: string }>) => statements.some((s) => /^(BEGIN|DELETE)/.test(s.sql.trim()));

describe('TmsisStateCodeSpendingOwner NPPES counts', () => {
  it('loads a clean stage: 24 columns per row, the NPPES counts in place, and the rule recorded as a note', async () => {
    const { owner, statements } = await load([KY, AZ]);
    assert.equal(owner.Status, 'SUCCEEDED', owner.ErrorMessage);
    const insert = statements.find((s) => /INSERT INTO bw_dso\.dso_tmsis_state_code_year/.test(s.sql))!;
    assert.equal(insert.values.length, 2 * 24);
    assert.deepEqual(insert.values.slice(12, 20), [8, 4, 300, 18, 900, 5, 200, 3]);
    assert.equal(insert.values[21], '2026-02-09');
    assert.ok(owner.Checks.every((c) => c.ok));
    assert.ok(owner.Notes.includes(`${NPPES_RULE_NOTE_PREFIX}{"recentEnumerationWindowYears":${RECENT_ENUMERATION_WINDOW_YEARS},"expectedTaxonomyPaidCoverage":${EXPECTED_TAXONOMY_PAID_COVERAGE},"source":"NPPES test copy"}`));
  });

  it('refuses a stage made under another window or coverage and replaces nothing', async () => {
    const { owner, statements } = await load([KY], { recentEnumerationWindowYears: 3, expectedTaxonomyPaidCoverage: EXPECTED_TAXONOMY_PAID_COVERAGE });
    assert.equal(owner.Status, 'FAILED');
    assert.match(owner.ErrorMessage, /tmsis-nppes-rule-matches-owner/);
    assert.equal(replaced(statements), false);
  });

  it('refuses a stage that does not name the NPPES copy it joined', async () => {
    const { owner, statements } = await load([KY], { recentEnumerationWindowYears: RECENT_ENUMERATION_WINDOW_YEARS, expectedTaxonomyPaidCoverage: EXPECTED_TAXONOMY_PAID_COVERAGE, nppesSourceLabel: '' } as never);
    assert.equal(owner.Status, 'FAILED');
    assert.match(owner.ErrorMessage, /tmsis-nppes-rule-matches-owner/);
    assert.equal(replaced(statements), false);
  });

  it('refuses a count above the count it is drawn from', async () => {
    const { owner, statements } = await load([KY.replace(',8,4,300.00,', ',8,9,300.00,')]);
    assert.equal(owner.Status, 'FAILED');
    assert.match(owner.ErrorMessage, /tmsis-nppes-counts-within-base/);
    assert.equal(owner.NppesCountsOutsideTheirBoundsRows, 1);
    assert.equal(replaced(statements), false);
  });

  it('refuses two expected-taxonomy counts for one code', async () => {
    const { owner, statements } = await load([KY, AZ.replace(/,3$/, ',4')]);
    assert.equal(owner.Status, 'FAILED');
    assert.match(owner.ErrorMessage, /tmsis-nppes-expected-taxonomies-one-per-code/);
    assert.equal(owner.CodesWithSeveralExpectedTaxonomyCounts, 1);
    assert.equal(replaced(statements), false);
  });
});
