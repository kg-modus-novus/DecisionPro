// Boot sequence (ADR-001 Decision 4, R1): migrate, restore locks, resume the ledger.
// A restart is modelled as the first app being discarded and a new one booting on the same
// database. The two never run at once: ADR-001 (T1) forbids two API processes.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createApp } from '../src/app.mjs';
import { TARGET_SET } from '../src/platform/enqueue.mjs';
import { findForbiddenStatements } from '../src/platform/migrate.mjs';
import { createProviderKeys, createTestClock, createTestDatabase, testConfig } from './helpers.mjs';

async function registerAccount(database, accountId) {
  const now = new Date().toISOString();
  await database.query(
    `INSERT INTO account (account_id, provider, provider_subject, display_email, account_status, registered_at, last_signed_in_at, sign_in_count)
     VALUES ($1, 'google', $2, '', 'active', $3, $3, 1)`,
    [accountId, accountId.split(':')[1], now],
  );
}

test('boot restores a lock whose session is valid and releases one whose session ended', async () => {
  const database = createTestDatabase();
  const clock = createTestClock();
  const { keySets } = await createProviderKeys();

  const before = createApp({ database, config: testConfig(), clock, keySets });
  await before.boot();
  await registerAccount(database, 'google:alive');
  await registerAccount(database, 'google:gone');
  const alive = await before.sessions.startSession('google:alive');
  const gone = await before.sessions.startSession('google:gone');
  assert.equal((await before.enqueue.acquire({ ownerScope: 'google:alive', lockObject: TARGET_SET, sessionId: alive.sessionId, sessionExpiresAt: alive.expiresAt })).granted, true);
  assert.equal((await before.enqueue.acquire({ ownerScope: 'google:gone', lockObject: TARGET_SET, sessionId: gone.sessionId, sessionExpiresAt: gone.expiresAt })).granted, true);
  await before.sessions.endSession(gone.sessionId); // ended without its locks being released (crash before release)

  // Restart.
  clock.advance(60_000);
  const after = createApp({ database, config: testConfig(), clock, keySets });
  const result = await after.boot();
  assert.deepEqual(result.migrations.applied, []);
  assert.deepEqual(result.locks, { restored: 1, released: 1 });

  const restored = after.enqueue.listLocks();
  assert.equal(restored.length, 1);
  assert.equal(restored[0].sessionId, alive.sessionId);
  assert.equal(after.enqueue.isHeldBySession('google:alive|TARGET_SET', alive.sessionId), true);
  assert.deepEqual((await database.query('SELECT session_id FROM enqueue_lock')).rows, [{ session_id: alive.sessionId }]);

  // Another browser or device of the same account is still denied, and told who holds it.
  const otherWindow = await after.sessions.startSession('google:alive');
  const denied = await after.enqueue.acquire({ ownerScope: 'google:alive', lockObject: TARGET_SET, sessionId: otherWindow.sessionId, sessionExpiresAt: otherWindow.expiresAt });
  assert.equal(denied.granted, false);
  assert.match(denied.holderDescription, /since 3:42 PM ET/);

  // The holder reconnects.
  const reconnect = await after.enqueue.acquire({ ownerScope: 'google:alive', lockObject: TARGET_SET, sessionId: alive.sessionId, sessionExpiresAt: alive.expiresAt });
  assert.equal(reconnect.granted, true);
  assert.equal(after.enqueue.listLocks().length, 1);
});

test('boot releases a lock whose session passed its 12-hour lifetime', async () => {
  const database = createTestDatabase();
  const clock = createTestClock();
  const { keySets } = await createProviderKeys();
  const before = createApp({ database, config: testConfig(), clock, keySets });
  await before.boot();
  await registerAccount(database, 'google:late');
  const session = await before.sessions.startSession('google:late');
  await before.enqueue.acquire({ ownerScope: 'google:late', lockObject: TARGET_SET, sessionId: session.sessionId, sessionExpiresAt: session.expiresAt });

  clock.advance(12 * 60 * 60 * 1000 + 1);
  const after = createApp({ database, config: testConfig(), clock, keySets });
  const result = await after.boot();
  assert.deepEqual(result.locks, { restored: 0, released: 1 });
  assert.equal((await database.query('SELECT * FROM enqueue_lock')).rowCount, 0);
});

test('boot re-queues ledger operations with attempts remaining and fails the rest', async () => {
  const database = createTestDatabase();
  const clock = createTestClock();
  const { keySets } = await createProviderKeys();
  const first = createApp({ database, config: testConfig(), clock, keySets });
  await first.boot();
  const insert = (id, kind, status, attempts) => database.query(
    `INSERT INTO operation_ledger (operation_id, operation_kind, owner_account_id, operation_status, attempts, max_attempts, payload, failure_reason, created_at, updated_at)
     VALUES ($1, $2, 'google:owner', $3, $4, 3, '{}', '', $5, $5)`,
    [id, kind, status, attempts, new Date(clock.now()).toISOString()],
  );
  await insert('op-unknown', 'no-such-kind', 'running', 1);
  await insert('op-retry', 'test-kind', 'running', 1);
  await insert('op-exhausted', 'test-kind', 'running', 3);
  await insert('op-done', 'test-kind', 'succeeded', 1);

  const after = createApp({ database, config: testConfig(), clock, keySets });
  const runs = [];
  after.ledger.registerOperationKind('test-kind', { run: async (payload) => { runs.push(payload); } });
  const result = await after.boot();
  assert.deepEqual(result.operations, { requeued: ['op-retry'], failed: 2 });
  assert.deepEqual(await Promise.all(result.operationRuns), ['succeeded']);
  const statuses = Object.fromEntries((await database.query('SELECT operation_id, operation_status FROM operation_ledger')).rows
    .map((row) => [row.operation_id, row.operation_status]));
  assert.deepEqual(statuses, { 'op-unknown': 'failed', 'op-retry': 'succeeded', 'op-exhausted': 'failed', 'op-done': 'succeeded' });
  assert.equal(runs.length, 1);
  const failed = await after.ledger.listFailedOperations('google:owner');
  assert.deepEqual(failed.map((operation) => operation.operationId).sort(), ['op-exhausted', 'op-unknown']);
});

test('migrations contain no triggers, rules or cascading foreign keys', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const { MIGRATIONS_DIRECTORY } = await import('../src/platform/migrate.mjs');
  for (const name of await readdir(MIGRATIONS_DIRECTORY)) {
    const sql = await readFile(`${MIGRATIONS_DIRECTORY}/${name}`, 'utf8');
    assert.deepEqual(findForbiddenStatements(sql), [], name);
    const references = sql.replace(/--[^\n]*/g, '').match(/REFERENCES\s+\w+\s*\([^)]*\)[^,;]*/g) ?? [];
    assert.ok(references.length >= 3, `${name}: expected the foreign keys to be found`);
    for (const reference of references) {
      assert.match(reference, /ON DELETE RESTRICT ON UPDATE RESTRICT/, `${name}: ${reference.trim()}`);
    }
  }
  assert.deepEqual(findForbiddenStatements('CREATE TRIGGER t BEFORE INSERT ON x'), [findForbiddenStatements('CREATE TRIGGER t')[0]]);
  assert.equal(findForbiddenStatements('a int REFERENCES b ON DELETE CASCADE').length, 1);
});
