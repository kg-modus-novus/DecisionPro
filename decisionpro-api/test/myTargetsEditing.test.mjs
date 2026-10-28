// MyTargetsEditing: open (lock), save (one transaction through the owner, then release), cancel.
// One API process (T1): two sessions of the same account stand in for two browsers or devices.

import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { loadMeasureCatalog } from '../src/app.mjs';
import { AccountOwner } from '../src/domain/Account.mjs';
import { MyTargetsEditing } from '../src/domain/MyTargetsEditing.mjs';
import { createEnqueue } from '../src/platform/enqueue.mjs';
import { migrate } from '../src/platform/migrate.mjs';
import { createSessions } from '../src/platform/sessions.mjs';
import { SignOut } from '../src/domain/SignOut.mjs';
import { createTestClock, createTestDatabase } from './helpers.mjs';

const catalog = loadMeasureCatalog();
const PERCENT_MEASURE = '988-in-state-answer-rate';
const COUNT_MEASURE = '988-calls-routed';

let database;
let clock;
let enqueue;
let sessions;
let accountId;

beforeEach(async () => {
  database = createTestDatabase();
  clock = createTestClock();
  await migrate(database);
  enqueue = createEnqueue({ database, clock });
  sessions = createSessions({ database, clock });
  const account = new AccountOwner({ Database: database, Clock: clock });
  account.Provider = 'google';
  account.ProviderSubject = 'editor';
  await account.RegisterAccount();
  accountId = account.AccountId;
});

function editingFor(session, requestedTargets = []) {
  const editing = new MyTargetsEditing({ Database: database, Enqueue: enqueue, MeasureCatalog: catalog, Clock: clock });
  editing.AccountId = session.accountId;
  editing.SessionId = session.sessionId;
  editing.SessionExpiresAt = session.expiresAt;
  editing.RequestedTargets = requestedTargets;
  return editing;
}

const target = (measureId, value, extra = {}) => ({ measureId, value, note: '', noteChange: 'replace', retire: false, ...extra });

async function activeTargets() {
  return (await database.query("SELECT measure_id, target_value, target_status FROM measure_target WHERE owner_account_id = $1 ORDER BY measure_id", [accountId])).rows;
}

test('OpenMyTargetsForEditing grants the lock and persists it', async () => {
  const session = await sessions.startSession(accountId);
  const editing = editingFor(session);
  await editing.OpenMyTargetsForEditing();
  assert.equal(editing.LockIsHeld, true);
  assert.equal(editing.LockHolderDescription, '');
  const { rows } = await database.query('SELECT lock_key, session_id FROM enqueue_lock');
  assert.deepEqual(rows, [{ lock_key: `${accountId}|TARGET_SET`, session_id: session.sessionId }]);
});

test('a second browser or device is denied and told who holds the lock', async () => {
  const first = await sessions.startSession(accountId);
  await editingFor(first).OpenMyTargetsForEditing();
  clock.advance(5 * 60_000);
  const second = await sessions.startSession(accountId);
  const editing = editingFor(second);
  await editing.OpenMyTargetsForEditing();
  assert.equal(editing.LockIsHeld, false);
  assert.equal(
    editing.LockHolderDescription,
    'Your targets are open for editing in another browser or device (since 3:42 PM ET). Close it, or sign out there, to edit here.',
  );
});

test('SaveMyTargets without the lock is refused and writes nothing', async () => {
  const session = await sessions.startSession(accountId);
  const editing = editingFor(session, [target(PERCENT_MEASURE, 80)]);
  await editing.SaveMyTargets();
  assert.equal(editing.LockIsHeld, false);
  assert.deepEqual(editing.Errors.map((error) => error.code), ['lock-not-held']);
  assert.deepEqual(await activeTargets(), []);
});

test('SaveMyTargets while another session holds the lock is refused with the holder', async () => {
  const holder = await sessions.startSession(accountId);
  await editingFor(holder).OpenMyTargetsForEditing();
  const other = await sessions.startSession(accountId);
  const editing = editingFor(other, [target(PERCENT_MEASURE, 80)]);
  await editing.SaveMyTargets();
  assert.equal(editing.LockIsHeld, false);
  assert.match(editing.Errors[0].message, /open for editing in another browser or device/);
  assert.deepEqual(await activeTargets(), []);
});

test('SaveMyTargets sets, revises and retires in one transaction, then releases the lock', async () => {
  const session = await sessions.startSession(accountId);
  const opening = editingFor(session);
  await opening.OpenMyTargetsForEditing();
  const first = editingFor(session, [target(PERCENT_MEASURE, 80), target(COUNT_MEASURE, 5000)]);
  await first.SaveMyTargets();
  assert.deepEqual(first.Errors, []);
  assert.equal(first.TargetsSaved, 2);
  assert.equal(first.TargetsCommitted, 2);
  assert.equal(first.LockReleaseCount, 1);
  assert.equal(enqueue.listLocks().length, 0);
  assert.equal((await database.query('SELECT * FROM enqueue_lock')).rowCount, 0);

  await editingFor(session).OpenMyTargetsForEditing();
  const second = editingFor(session, [target(PERCENT_MEASURE, 90), target(COUNT_MEASURE, 0, { retire: true })]);
  await second.SaveMyTargets();
  assert.deepEqual(second.Errors, []);
  assert.equal(second.TargetsSaved, 1);
  assert.equal(second.TargetsRetired, 1);
  assert.deepEqual(await activeTargets(), [
    { measure_id: COUNT_MEASURE, target_value: 5000, target_status: 'retired' },
    { measure_id: PERCENT_MEASURE, target_value: 90, target_status: 'active' },
  ]);
});

test('one rejected target rolls the whole save back and reports per-target errors', async () => {
  const session = await sessions.startSession(accountId);
  await editingFor(session).OpenMyTargetsForEditing();
  const editing = editingFor(session, [
    target(PERCENT_MEASURE, 80),
    target('not-a-measure', 1),
    target(COUNT_MEASURE, -3),
    target('988-calls-answered-in-state', 0, { retire: true }),
  ]);
  await editing.SaveMyTargets();
  assert.equal(editing.SaveIsFreeOfErrors, false);
  assert.equal(editing.TargetsSaved, 1);
  assert.equal(editing.TargetsRejected, 3);
  assert.equal(editing.TargetsCommitted, 0);
  assert.deepEqual(editing.Errors.map((error) => [error.measureId, error.code]), [
    ['not-a-measure', 'unknown-measure'],
    [COUNT_MEASURE, 'target-value-out-of-range'],
    ['988-calls-answered-in-state', 'target-not-active'],
  ]);
  assert.deepEqual(await activeTargets(), []);
  assert.equal((await database.query('SELECT * FROM measure_target_revision')).rowCount, 0);
  assert.equal(editing.LockReleaseCount, 1);
});

test('CancelMyTargetsEditing releases the lock; another browser or device may then open', async () => {
  const first = await sessions.startSession(accountId);
  await editingFor(first).OpenMyTargetsForEditing();
  const cancel = editingFor(first);
  await cancel.CancelMyTargetsEditing();
  assert.equal(cancel.LockReleaseCount, 1);
  const second = await sessions.startSession(accountId);
  const opening = editingFor(second);
  await opening.OpenMyTargetsForEditing();
  assert.equal(opening.LockIsHeld, true);
});

test('SignOut.SignOutAccount releases the session\'s locks and ends the session', async () => {
  const first = await sessions.startSession(accountId);
  await editingFor(first).OpenMyTargetsForEditing();
  const signOut = new SignOut({ Sessions: sessions, Enqueue: enqueue });
  signOut.SessionToken = first.sessionToken;
  await signOut.SignOutAccount();
  assert.equal(signOut.SignOutIsComplete, true);
  assert.equal(signOut.SessionLocksReleased, 1);
  assert.equal(signOut.SessionsEnded, 1);
  assert.equal((await sessions.findActiveSession(first.sessionToken)).sessionIsActive, false);
  const second = await sessions.startSession(accountId);
  const opening = editingFor(second);
  await opening.OpenMyTargetsForEditing();
  assert.equal(opening.LockIsHeld, true);
});

test('a lock whose session reached its 12-hour end is released at the next contention', async () => {
  const first = await sessions.startSession(accountId);
  await editingFor(first).OpenMyTargetsForEditing();
  clock.advance(12 * 60 * 60 * 1000);
  const second = await sessions.startSession(accountId);
  const opening = editingFor(second);
  await opening.OpenMyTargetsForEditing();
  assert.equal(opening.LockIsHeld, true);
  assert.deepEqual((await database.query('SELECT session_id FROM enqueue_lock')).rows, [{ session_id: second.sessionId }]);
});

test('a failure to persist the lock is a storage failure, and the lock is not held', async () => {
  const session = await sessions.startSession(accountId);
  const failingEnqueue = createEnqueue({
    database: { query: async () => { throw new Error('injected'); } },
    clock,
  });
  const editing = new MyTargetsEditing({ Database: database, Enqueue: failingEnqueue, MeasureCatalog: catalog, Clock: clock });
  editing.AccountId = session.accountId;
  editing.SessionId = session.sessionId;
  editing.SessionExpiresAt = session.expiresAt;
  await editing.OpenMyTargetsForEditing();
  assert.equal(editing.StorageFailureCount, 1);
  assert.equal(editing.LockIsHeld, false);
  assert.deepEqual(editing.Errors.map((error) => error.code), ['storage-failure']);
  assert.equal(failingEnqueue.listLocks().length, 0);
});

test('a save after the holder\'s session ended falls back to the generic message', async () => {
  const first = await sessions.startSession(accountId);
  await editingFor(first).OpenMyTargetsForEditing();
  clock.advance(12 * 60 * 60 * 1000);
  const second = await sessions.startSession(accountId);
  const editing = editingFor(second, [target(PERCENT_MEASURE, 80)]);
  await editing.SaveMyTargets();
  assert.equal(editing.LockHolderDescription, '');
  assert.equal(editing.Errors[0].message, 'Open your targets for editing first.');
});
