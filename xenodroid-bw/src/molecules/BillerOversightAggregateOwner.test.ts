import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type pg from 'pg';
import { psaStore } from '../psa/filesystemPsa.js';
import {
  BillerOversightAggregateOwner, OVERSIGHT_FILES, PROFILE_MEASURE_COLUMNS, ParseStagedCodeMonthCsv, ParseStagedProfileCsv, ParseStagedStateCodeMonthCsv,
} from './BillerOversightAggregateOwner.js';
import { MergeSmallAreas, SMALL_CELL_MINIMUM, WithheldCount, WithheldPaid } from './ExportOversightAggregatesForUi.js';

// Run: node --import tsx --test src/molecules/BillerOversightAggregateOwner.test.ts

const PROFILE_HEADER = 'state,hcpcs,yr,billers,paid,established_depends_billers,established_depends_paid,established_other_billers,established_other_paid,year_before_depends_billers,year_before_depends_paid,year_before_other_billers,year_before_other_paid,year_depends_billers,year_depends_paid,year_other_billers,year_other_paid,no_payment_before_billers,no_payment_before_paid,recently_enumerated_billers,recently_enumerated_paid,million_billers,million_billers_fast,million_median_months,shared_address_billers,shared_addresses,shared_address_paid,top10_paid,organization_billers,individual_billers';
// 20 billers: 2 + 3 established, 4 + 5 the year before, 6 + 0 this year.
const PROFILE_KY = 'KY,H2027,2024,20,1000.00,2,100.00,3,200.00,4,150.00,5,50.00,6,400.00,0,100.00,7,300.00,8,320.00,1,0,,2,1,90.00,800.00,18,2';

describe('staged file parsers', () => {
  it('reads months as YYYY-MM and refuses anything else', () => {
    assert.deepEqual(ParseStagedStateCodeMonthCsv('month,state,hcpcs,paid,billing_npis\n2023-07,KY,H2027,4679293.10,51'), [
      { state_code: 'KY', hcpcs: 'H2027', month_ym: '2023-07', paid: 4679293.1, billing_npis: 51 },
    ]);
    assert.throws(() => ParseStagedStateCodeMonthCsv('month,state,hcpcs,paid,billing_npis\n202307,KY,H2027,1,1'), /bad month/);
    assert.throws(() => ParseStagedCodeMonthCsv('month,hcpcs,paid\n2023-07,H2027,'), /non-numeric paid/);
  });

  it('turns one wide profile row into one row per measure, a blank median into 0', () => {
    const rows = ParseStagedProfileCsv(`${PROFILE_HEADER}\n${PROFILE_KY}`);
    assert.equal(rows.length, Object.keys(PROFILE_MEASURE_COLUMNS).length);
    const m = Object.fromEntries(rows.map((r) => [r.measure, [r.count_value, r.paid]]));
    assert.deepEqual(m.billers, [20, 1000]);
    assert.deepEqual(m['year-before-depends'], [4, 150]);
    assert.deepEqual(m['million-median-months'], [0, 0]);
    assert.deepEqual(m.top10, [10, 800]);
    assert.deepEqual(m.individual, [2, 0]);
  });
});

describe('small-cell rule at the export boundary', () => {
  it('withholds a count from 1 to 10 and the dollars it describes; 0 and 11 up are shown', () => {
    assert.equal(SMALL_CELL_MINIMUM, 11);
    assert.deepEqual([0, 1, 10, 11, 171].map(WithheldCount), [0, null, null, 11, 171]);
    assert.equal(WithheldPaid(10, 5_000_000), null);
    assert.equal(WithheldPaid(11, 5_000_000.4), 5_000_000);
  });

  it('merges areas under 11 billers, and areas with no ZIP, into one row, itself withheld when under 11', () => {
    assert.deepEqual(MergeSmallAreas([
      { zip3: '402', city: 'LOUISVILLE', billers: 54, paid: 30.7 }, { zip3: '405', city: 'LEXINGTON', billers: 10, paid: 9 },
      { zip3: '', city: '', billers: 3, paid: 2 }, { zip3: '427', city: 'ELIZABETHTOWN', billers: 11, paid: 40 },
    ]), [['427', 'ELIZABETHTOWN', 11, 40], ['402', 'LOUISVILLE', 54, 31], ['', 'all other areas', 13, 11]]);
    assert.deepEqual(MergeSmallAreas([{ zip3: '402', city: 'X', billers: 4, paid: 9 }]), [['', 'all other areas', null, null]]);
  });
});

// The load molecule end to end: a temporary stage and PSA root, and a stub client that answers the
// owner's reads (latest screen, qualifying groups, screen state x codes, latest spending load and its
// yearly figures) and records every statement. A failed check replaces nothing.
let root = '';
const psaRootBefore = psaStore.root;
before(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'oversight-owner-')); psaStore.root = path.join(root, 'psa'); });
after(async () => { psaStore.root = psaRootBefore; await fs.rm(root, { recursive: true, force: true }); });

type Stage = Record<string, string>;
const cleanStage = (): Stage => ({
  'state_code_month.csv': 'month,state,hcpcs,paid,billing_npis\n2024-01,KY,H2027,600.00,12\n2024-02,KY,H2027,400.00,13',
  'code_month.csv': 'month,hcpcs,paid\n2024-01,H2027,700.00\n2024-02,H2027,500.00',
  'biller_group_year.csv': 'group_state,group_hcpcs,group_year,yr,members,members_billing,members_paid,members_code_paid\nKY,H2027,2024,2023,20,12,500.00,300.00\nKY,H2027,2024,2024,20,20,900.00,1000.00',
  'biller_group_service.csv': 'group_state,group_hcpcs,group_year,hcpcs,yr,members_billing,paid\nKY,H2027,2024,H0038,2024,12,80.00',
  'biller_profile.csv': `${PROFILE_HEADER}\n${PROFILE_KY}`,
  'biller_profile_area.csv': 'state,hcpcs,yr,zip3,city,billers,paid\nKY,H2027,2024,402,LOUISVILLE,20,1000.00',
  'code_labels.csv': 'hcpcs,label\nH2027,Psychoeducation',
});
const rowsOf = (text: string) => text.trim().split('\n').length - 1;

async function load(stage: Stage, opts: { screen?: string; groups?: string[]; manifestScreen?: string; badHash?: string } = {}) {
  const dir = await fs.mkdtemp(path.join(root, 'stage-'));
  const files: Record<string, { rows: number; sha256: string }> = {};
  for (const f of OVERSIGHT_FILES) {
    await fs.writeFile(path.join(dir, f), stage[f]);
    files[f] = { rows: rowsOf(stage[f]), sha256: opts.badHash === f ? '0'.repeat(64) : crypto.createHash('sha256').update(stage[f]).digest('hex') };
  }
  const { 'code_labels.csv': codeLabels, ...rest } = files;
  const screen = opts.screen ?? 'LH-SCREEN-1';
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ version: '2026-02-09', screenLoadHistoryId: opts.manifestScreen ?? screen, latestYear: 2024, nppes: 'test', parameters: {}, files: rest, codeLabels }));
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const groups = opts.groups ?? ['KY|H2027|2024'];
  const client = {
    async query(sql: string, values: unknown[] = []) {
      statements.push({ sql, values });
      if (/FROM bw_ctl\.load_history WHERE data_request_id/.test(sql)) return { rows: [{ load_history_id: values[0] === 'DR-REAL-SHARE-SURGE-SCREEN' ? screen : 'LH-TMSIS-1' }] };
      if (/SELECT DISTINCT state_code AS state, hcpcs, year/.test(sql)) return { rows: groups.map((g) => { const [state, hcpcs, year] = g.split('|'); return { state, hcpcs, year: Number(year) }; }) };
      if (/SELECT DISTINCT state_code AS state, hcpcs FROM/.test(sql)) return { rows: [{ state: 'KY', hcpcs: 'H2027' }] };
      if (/FROM bw_dso\.dso_tmsis_state_code_year/.test(sql)) return { rows: [{ state_code: 'KY', hcpcs: 'H2027', year: 2024, paid: 1000, billing_npis: 20 }, { state_code: 'UNMATCHED', hcpcs: 'H2027', year: 2024, paid: 200, billing_npis: 0 }] };
      const insert = /^\s*INSERT INTO bw_dso\.\S+ \(([^)]*)\)/.exec(sql);
      return { rows: [], rowCount: insert ? values.length / insert[1].split(',').length : 1 };
    },
  } as unknown as pg.PoolClient;
  const owner = new BillerOversightAggregateOwner(client);
  owner.StageDirectory = dir;
  await owner.LoadBillerOversightAggregate();
  return { owner, statements };
}
const replaced = (statements: Array<{ sql: string }>) => statements.some((s) => /^(BEGIN|DELETE)/.test(s.sql.trim()));

describe('BillerOversightAggregateOwner', () => {
  it('loads a clean stage into every table in one transaction, with provenance on each row', async () => {
    const { owner, statements } = await load(cleanStage());
    assert.equal(owner.Status, 'SUCCEEDED', owner.ErrorMessage);
    assert.ok(owner.Checks.every((c) => c.ok), JSON.stringify(owner.Checks.filter((c) => !c.ok)));
    assert.equal(owner.ProfileMeasureRowsInserted, Object.keys(PROFILE_MEASURE_COLUMNS).length);
    assert.equal(owner.RowsInserted, 2 + 2 + 2 + 1 + Object.keys(PROFILE_MEASURE_COLUMNS).length + 1 + 1);
    const sqls = statements.map((s) => s.sql.trim());
    assert.ok(sqls.indexOf('BEGIN') < sqls.findIndex((s) => s.startsWith('DELETE')) && sqls.indexOf('COMMIT') > sqls.findIndex((s) => s.startsWith('INSERT INTO bw_dso.dso_hcpcs_label')));
    const succeeded = statements.findIndex((s) => s.sql.trim().startsWith('UPDATE bw_ctl.load_history') && s.values[1] === 'SUCCEEDED');
    assert.ok(succeeded > sqls.indexOf('BEGIN') && succeeded < sqls.indexOf('COMMIT'), 'the SUCCEEDED status commits with the rows');
    const month = statements.find((s) => /INSERT INTO bw_dso\.dso_tmsis_state_code_month/.test(s.sql))!;
    assert.deepEqual(month.values.slice(0, 9), ['KY', 'H2027', '2024-01', 600, 12, 'HHS_OPEN_DATA_TMSIS', '2026-02-09', 'REAL', owner.LoadHistoryID]);
  });

  it('refuses a stage drawn from another screen load', async () => {
    const { owner, statements } = await load(cleanStage(), { manifestScreen: 'LH-SCREEN-OLD' });
    assert.equal(owner.Status, 'FAILED');
    assert.match(owner.ErrorMessage, /oversight-stage-names-latest-screen/);
    assert.equal(replaced(statements), false);
  });

  it('refuses a file whose hash is not the manifest\'s', async () => {
    const { owner, statements } = await load(cleanStage(), { badHash: 'biller_group_year.csv' });
    assert.match(owner.ErrorMessage, /oversight-biller-group-year-matches-manifest/);
    assert.equal(replaced(statements), false);
  });

  it('refuses months that do not add up to the loaded year, state or national', async () => {
    const stage = cleanStage();
    stage['state_code_month.csv'] = stage['state_code_month.csv'].replace('400.00', '402.00');
    stage['code_month.csv'] = stage['code_month.csv'].replace('500.00', '505.00');
    const { owner, statements } = await load(stage);
    assert.match(owner.ErrorMessage, /oversight-months-add-up-to-years/);
    assert.match(owner.ErrorMessage, /oversight-code-months-add-up-to-years/);
    assert.equal(replaced(statements), false);
  });

  it('refuses groups that are not exactly the screen\'s qualifying groups', async () => {
    const { owner, statements } = await load(cleanStage(), { groups: ['KY|H2027|2024', 'AZ|H2027|2022'] });
    assert.match(owner.ErrorMessage, /oversight-groups-follow-the-rule/);
    assert.equal(owner.GroupsOffTheRule, 1);
    assert.equal(replaced(statements), false);
  });

  it('refuses a group not whole in its own year, or larger than the billers loaded', async () => {
    const stage = cleanStage();
    stage['biller_group_year.csv'] = stage['biller_group_year.csv'].replace('2024,2024,20,20,', '2024,2024,21,19,').replace('2024,2023,20,12,', '2024,2023,21,12,');
    const { owner } = await load(stage);
    assert.match(owner.ErrorMessage, /oversight-groups-within-billers/);
    assert.match(owner.ErrorMessage, /oversight-groups-whole-in-their-year/);
  });

  it('refuses a profile whose cohorts do not add up to its billers', async () => {
    const stage = cleanStage();
    stage['biller_profile.csv'] = `${PROFILE_HEADER}\n${PROFILE_KY.replace('KY,H2027,2024,20,', 'KY,H2027,2024,19,')}`;
    const { owner, statements } = await load(stage);
    assert.match(owner.ErrorMessage, /oversight-profile-cohorts-add-up/);
    assert.equal(replaced(statements), false);
  });
});
