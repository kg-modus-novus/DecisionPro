// MeasureTargetOwner: every arrow of the state diagram and every rejection.
//   absent ──Set──▶ active; active ──Revise──▶ active; active ──Retire──▶ retired; retired ──Set──▶ active

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import { loadMeasureCatalog } from '../src/app.mjs';
import { MeasureTargetOwner } from '../src/domain/MeasureTarget.mjs';
import { NO_TRANSACTION } from '../src/platform/db.mjs';
import { migrate } from '../src/platform/migrate.mjs';
import { createFaultyDatabase, createTestClock, createTestDatabase } from './helpers.mjs';

const PERCENT_MEASURE = '988-in-state-answer-rate';
const COUNT_MEASURE = '988-calls-routed';
const ACCOUNT = 'google:subject-a';
const OTHER_ACCOUNT = 'google:subject-b';
const catalog = loadMeasureCatalog();

let database;
let clock;

beforeEach(async () => {
  database = createTestDatabase();
  clock = createTestClock();
  await migrate(database);
});

function newOwner() {
  return new MeasureTargetOwner({ Database: database, MeasureCatalog: catalog, Clock: clock });
}

// Runs one owner action in its own transaction, the way MyTargetsEditing does, committing when the
// owner reports no errors.
async function runAction(action, { ownerScope = ACCOUNT, measureId = PERCENT_MEASURE, value = 80, note = '', noteChange = 'replace', database: actionDatabase = database } = {}) {
  const owner = newOwner();
  owner.OwnerScope = ownerScope;
  owner.MeasureId = measureId;
  owner.TargetValue = value;
  owner.TargetNote = note;
  owner.TargetNoteChange = noteChange;
  owner.TransactionHandle = await actionDatabase.beginTransaction();
  await owner[action]();
  if (owner.Errors.length === 0) await owner.TransactionHandle.commit();
  else await owner.TransactionHandle.rollback();
  return owner;
}

async function currentRow(ownerScope = ACCOUNT, measureId = PERCENT_MEASURE) {
  const result = await database.query('SELECT * FROM measure_target WHERE owner_account_id = $1 AND measure_id = $2', [ownerScope, measureId]);
  return result.rows;
}

async function revisionRows(ownerScope = ACCOUNT, measureId = PERCENT_MEASURE) {
  const result = await database.query(
    'SELECT target_revision, target_status, target_value FROM measure_target_revision WHERE owner_account_id = $1 AND measure_id = $2 ORDER BY target_revision',
    [ownerScope, measureId],
  );
  return result.rows;
}

describe('SetMeasureTarget', () => {
  test('arrow absent → active writes revision 1 and its log entry', async () => {
    const owner = await runAction('SetMeasureTarget', { value: 85, note: 'Match the national rate' });
    assert.deepEqual(owner.Errors, []);
    assert.equal(owner.CurrentTargetStatus, 'absent');
    assert.equal(owner.NextTargetStatus, 'active');
    assert.equal(owner.NextTargetRevision, 1);
    const [row] = await currentRow();
    assert.equal(row.target_status, 'active');
    assert.equal(row.target_value, 85);
    assert.equal(row.target_unit, 'percent');
    assert.equal(row.better_direction, 'higher');
    assert.equal(row.target_note, 'Match the national rate');
    assert.equal(row.effective_date, '2026-10-28');
    assert.deepEqual(await revisionRows(), [{ target_revision: 1, target_status: 'active', target_value: 85 }]);
  });

  test('arrow retired → active keeps the identity and advances the revision', async () => {
    await runAction('SetMeasureTarget', { value: 70 });
    await runAction('RetireMeasureTarget');
    const owner = await runAction('SetMeasureTarget', { value: 90 });
    assert.deepEqual(owner.Errors, []);
    assert.equal(owner.CurrentTargetStatus, 'retired');
    assert.equal(owner.NextTargetRevision, 3);
    const rows = await currentRow();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].target_status, 'active');
    assert.equal(rows[0].target_value, 90);
    assert.deepEqual((await revisionRows()).map((row) => row.target_status), ['active', 'retired', 'active']);
  });

  test('rejects an unknown measure', async () => {
    const owner = await runAction('SetMeasureTarget', { measureId: 'not-a-measure' });
    assert.equal(owner.MeasureIsInCatalog, false);
    assert.deepEqual(owner.Errors.map((error) => error.code), ['unknown-measure']);
    assert.equal(owner.Errors[0].measureId, 'not-a-measure');
    assert.equal((await currentRow(ACCOUNT, 'not-a-measure')).length, 0);
  });

  test('rejects a percent outside 0–100', async () => {
    for (const value of [-1, 100.5, 150]) {
      const owner = await runAction('SetMeasureTarget', { value });
      assert.equal(owner.TargetValueIsWithinUnitRange, false, `value ${value}`);
      assert.deepEqual(owner.Errors.map((error) => error.code), ['target-value-out-of-range']);
    }
    assert.equal((await currentRow()).length, 0);
  });

  test('accepts the percent bounds 0 and 100', async () => {
    assert.deepEqual((await runAction('SetMeasureTarget', { value: 0 })).Errors, []);
    assert.deepEqual((await runAction('ReviseMeasureTarget', { value: 100 })).Errors, []);
  });

  test('rejects a negative count, accepts zero', async () => {
    const negative = await runAction('SetMeasureTarget', { measureId: COUNT_MEASURE, value: -5 });
    assert.deepEqual(negative.Errors.map((error) => error.code), ['target-value-out-of-range']);
    const zero = await runAction('SetMeasureTarget', { measureId: COUNT_MEASURE, value: 0 });
    assert.deepEqual(zero.Errors, []);
  });

  test('accepts any finite dollar target, negative included (usd, usd_pmpm)', async () => {
    const net = await runAction('SetMeasureTarget', { measureId: 'dsh-payments-net', value: -1740069 });
    assert.equal(net.TargetValueIsWithinUnitRange, true);
    assert.deepEqual(net.Errors, []);
    assert.equal((await currentRow(ACCOUNT, 'dsh-payments-net'))[0].target_value, -1740069);
    const pmpm = await runAction('SetMeasureTarget', { measureId: 'benefit-spending-pmpm', value: -12.5 });
    assert.deepEqual(pmpm.Errors, []);
    const revised = await runAction('ReviseMeasureTarget', { measureId: 'dsh-payments-net', value: -2000000 });
    assert.deepEqual(revised.Errors, []);
  });

  test('rejects a non-finite dollar target', async () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const owner = await runAction('SetMeasureTarget', { measureId: 'dsh-payments-net', value });
      assert.deepEqual(owner.Errors.map((error) => error.code), ['target-value-out-of-range'], String(value));
    }
  });

  test('rejects a negative value for other non-percent units (days, ratio)', async () => {
    for (const measureId of ['credentialing-statutory-clock', 'cs-pcr-readmissions-ratio']) {
      const owner = await runAction('SetMeasureTarget', { measureId, value: -1 });
      assert.deepEqual(owner.Errors.map((error) => error.code), ['target-value-out-of-range'], measureId);
    }
  });

  test('a lost race (the conditional upsert writes no row) is refused as target-changed, with no log entry', async () => {
    const racing = createFaultyDatabase(database);
    racing.zeroRowsFor = /INSERT INTO measure_target [(]/;
    const owner = await runAction('SetMeasureTarget', { value: 80, database: racing });
    assert.equal(owner.TargetRowsWritten, 0);
    assert.deepEqual(owner.Errors.map((error) => error.code), ['target-changed']);
    assert.equal((await revisionRows()).length, 0);
  });

  test('rejects setting a measure that already has an active target', async () => {
    await runAction('SetMeasureTarget', { value: 80 });
    const owner = await runAction('SetMeasureTarget', { value: 82 });
    assert.equal(owner.TargetIsAbsentOrRetired, false);
    assert.deepEqual(owner.Errors.map((error) => error.code), ['target-already-active']);
    assert.equal((await currentRow())[0].target_value, 80);
  });

  test('refuses to run outside a transaction', async () => {
    const owner = newOwner();
    owner.OwnerScope = ACCOUNT;
    owner.MeasureId = PERCENT_MEASURE;
    owner.TargetValue = 80;
    owner.TransactionHandle = NO_TRANSACTION;
    await owner.SetMeasureTarget();
    assert.deepEqual(owner.Errors.map((error) => error.code), ['no-transaction']);
    assert.equal((await currentRow()).length, 0);
  });
});

describe('ReviseMeasureTarget', () => {
  test('arrow active → active advances the revision and keeps the previous one in the log', async () => {
    await runAction('SetMeasureTarget', { value: 80 });
    const owner = await runAction('ReviseMeasureTarget', { value: 88, note: 'Raised after the hearing' });
    assert.deepEqual(owner.Errors, []);
    assert.equal(owner.CurrentTargetRevision, 1);
    assert.equal(owner.NextTargetRevision, 2);
    const [row] = await currentRow();
    assert.equal(row.target_value, 88);
    assert.equal(row.target_revision, 2);
    assert.deepEqual(await revisionRows(), [
      { target_revision: 1, target_status: 'active', target_value: 80 },
      { target_revision: 2, target_status: 'active', target_value: 88 },
    ]);
  });

  test('rejects revising an absent target', async () => {
    const owner = await runAction('ReviseMeasureTarget', { value: 88 });
    assert.equal(owner.CurrentTargetStatus, 'absent');
    assert.deepEqual(owner.Errors.map((error) => error.code), ['target-not-active']);
    assert.equal((await currentRow()).length, 0);
  });

  test('rejects revising a retired target', async () => {
    await runAction('SetMeasureTarget', { value: 80 });
    await runAction('RetireMeasureTarget');
    const owner = await runAction('ReviseMeasureTarget', { value: 88 });
    assert.deepEqual(owner.Errors.map((error) => error.code), ['target-not-active']);
  });

  test('rejects an unknown measure and an out-of-range value', async () => {
    await runAction('SetMeasureTarget', { value: 80 });
    assert.deepEqual((await runAction('ReviseMeasureTarget', { measureId: 'nope' })).Errors.map((e) => e.code), ['unknown-measure']);
    assert.deepEqual((await runAction('ReviseMeasureTarget', { value: 101 })).Errors.map((e) => e.code), ['target-value-out-of-range']);
  });
});

describe('notes', () => {
  test('a revise that omits the note keeps the stored note; an empty note clears it', async () => {
    await runAction('SetMeasureTarget', { value: 80, note: 'Match the national rate' });
    await runAction('ReviseMeasureTarget', { value: 85, noteChange: 'keep' });
    assert.equal((await currentRow())[0].target_note, 'Match the national rate');
    await runAction('ReviseMeasureTarget', { value: 86, note: '', noteChange: 'replace' });
    assert.equal((await currentRow())[0].target_note, '');
  });
});

describe('RetireMeasureTarget', () => {
  test('arrow active → retired keeps the value and logs the retirement', async () => {
    await runAction('SetMeasureTarget', { value: 75, note: 'keep' });
    const owner = await runAction('RetireMeasureTarget', { value: 0 });
    assert.deepEqual(owner.Errors, []);
    const [row] = await currentRow();
    assert.equal(row.target_status, 'retired');
    assert.equal(row.target_value, 75);
    assert.equal(row.target_note, 'keep');
    assert.equal(row.target_revision, 2);
    assert.deepEqual((await revisionRows()).map((r) => r.target_status), ['active', 'retired']);
  });

  test('rejects retiring an absent target', async () => {
    const owner = await runAction('RetireMeasureTarget');
    assert.deepEqual(owner.Errors.map((error) => error.code), ['target-not-active']);
  });
});

describe('ReadActiveMeasureTargets', () => {
  test('returns only the scope\'s active targets (P1 tenant key)', async () => {
    await runAction('SetMeasureTarget', { value: 80 });
    await runAction('SetMeasureTarget', { measureId: COUNT_MEASURE, value: 1000 });
    await runAction('RetireMeasureTarget', { measureId: COUNT_MEASURE });
    await runAction('SetMeasureTarget', { ownerScope: OTHER_ACCOUNT, value: 60 });
    const owner = newOwner();
    owner.OwnerScope = ACCOUNT;
    await owner.ReadActiveMeasureTargets();
    assert.equal(owner.ActiveTargetCount, 1);
    assert.equal(owner.ActiveTargets[0].measureId, PERCENT_MEASURE);
    assert.equal(owner.ActiveTargets[0].value, 80);
    assert.equal(owner.ActiveTargets[0].label, '988 crisis calls answered in Kentucky');
  });
});

describe('InitializeMeasureTarget', () => {
  test('every field starts at its INITIAL value, none null or undefined', () => {
    const owner = newOwner();
    for (const [name, value] of Object.entries(owner)) {
      assert.notEqual(value, null, name);
      assert.notEqual(value, undefined, name);
    }
    assert.equal(owner.TransactionHandle, NO_TRANSACTION);
    assert.deepEqual(owner.Errors, []);
  });
});
