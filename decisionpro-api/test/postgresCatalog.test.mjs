// Real-Postgres checks, skipped unless DATABASE_URL_TEST names a scratch database (never production:
// the migrations are applied to it and test rows are written).
//   DATABASE_URL_TEST=postgres://user:pass@127.0.0.1:5042/decisionpro_api_test npm test
//
// 1. Schema catalog (CodeXen: the database performs no business writes): no user triggers, no rules,
//    and every foreign key's delete and update actions are RESTRICT ('r') or NO ACTION ('a').
// 2. Behaviour pg-mem cannot show, through MeasureTargetOwner itself: FOR UPDATE and the conditional
//    upsert under two overlapping transactions (exactly one wins, the other gets target-changed), and
//    a rolled-back save leaving nothing behind.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { loadMeasureCatalog, systemClock } from '../src/app.mjs';
import { MeasureTargetOwner } from '../src/domain/MeasureTarget.mjs';
import { connectDatabase } from '../src/platform/db.mjs';
import { migrate } from '../src/platform/migrate.mjs';

const url = process.env.DATABASE_URL_TEST ?? '';
const skip = url === '' ? 'DATABASE_URL_TEST is not set' : false;
const catalog = loadMeasureCatalog();
const MEASURE = '988-calls-routed';

describe('real Postgres', { skip }, () => {
  let database;

  before(async () => {
    database = connectDatabase({ connectionString: url, ssl: process.env.DATABASE_SSL_TEST === 'true', sslCa: process.env.DATABASE_SSL_CA_TEST ?? '' });
    await migrate(database);
  });

  after(async () => {
    await database?.close();
  });

  test('no triggers on public tables', async () => {
    const { rows } = await database.query(
      `SELECT c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND NOT t.tgisinternal`,
    );
    assert.deepEqual(rows, []);
  });

  test('no rules on public tables', async () => {
    const { rows } = await database.query("SELECT tablename, rulename FROM pg_rules WHERE schemaname = 'public'");
    assert.deepEqual(rows, []);
  });

  test('every foreign key restricts delete and update', async () => {
    const { rows } = await database.query(
      `SELECT con.conname, con.confdeltype::text AS on_delete, con.confupdtype::text AS on_update
         FROM pg_constraint con JOIN pg_namespace n ON n.oid = con.connamespace
        WHERE n.nspname = 'public' AND con.contype = 'f'`,
    );
    assert.ok(rows.length >= 3, 'expected the schema\'s foreign keys');
    for (const row of rows) {
      assert.ok(['r', 'a'].includes(row.on_delete), `${row.conname} ON DELETE ${row.on_delete}`);
      assert.ok(['r', 'a'].includes(row.on_update), `${row.conname} ON UPDATE ${row.on_update}`);
    }
  });

  // Two overlapping save transactions set the same new target through MeasureTargetOwner itself.
  // A reads (no row), writes revision 1 and holds its transaction open. B reads (A's row is not
  // committed, so B also sees none), prepares revision 1, and its upsert waits on A's row. A commits;
  // B's conditional upsert then finds revision 1 already stored and writes nothing: target-changed.
  test('overlapping saves of the same new target: exactly one wins, the other gets target-changed', async () => {
    const ownerScope = `test:${randomUUID()}`;
    const stage = (value) => {
      const owner = new MeasureTargetOwner({ Database: database, MeasureCatalog: catalog, Clock: systemClock });
      owner.OwnerScope = ownerScope;
      owner.MeasureId = MEASURE;
      owner.TargetValue = value;
      return owner;
    };
    const first = stage(70);
    const second = stage(90);
    first.TransactionHandle = await database.beginTransaction();
    second.TransactionHandle = await database.beginTransaction();

    await first.SetMeasureTarget();
    assert.deepEqual(first.Errors, []);
    const secondRun = second.SetMeasureTarget();
    await waitUntilBlockedOnLock();
    await first.TransactionHandle.commit();
    await secondRun;
    assert.equal(second.CurrentTargetStatus, 'absent');
    assert.equal(second.TargetRowsWritten, 0);
    assert.deepEqual(second.Errors.map((error) => error.code), ['target-changed']);
    await second.TransactionHandle.rollback();

    const { rows } = await database.query(
      'SELECT target_value, target_revision FROM measure_target WHERE owner_account_id = $1 AND measure_id = $2',
      [ownerScope, MEASURE],
    );
    assert.deepEqual(rows, [{ target_value: 70, target_revision: 1 }]);
    const revisions = await database.query('SELECT target_revision FROM measure_target_revision WHERE owner_account_id = $1', [ownerScope]);
    assert.equal(revisions.rowCount, 1);
  });

  test('a rolled-back save leaves nothing behind', async () => {
    const owner = new MeasureTargetOwner({ Database: database, MeasureCatalog: catalog, Clock: systemClock });
    owner.OwnerScope = `test:${randomUUID()}`;
    owner.MeasureId = MEASURE;
    owner.TargetValue = 50;
    owner.TransactionHandle = await database.beginTransaction();
    await owner.SetMeasureTarget();
    assert.deepEqual(owner.Errors, []);
    await owner.TransactionHandle.rollback();
    assert.equal((await database.query('SELECT * FROM measure_target WHERE owner_account_id = $1', [owner.OwnerScope])).rowCount, 0);
  });

  // Bounded wait (5 s) until another connection is blocked on a row lock in measure_target.
  async function waitUntilBlockedOnLock() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const { rowCount } = await database.query(
        "SELECT pid FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%INSERT INTO measure_target (%'",
      );
      if (rowCount > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('the second save never blocked on the first');
  }
});
