// AccountOwner: absent ──RegisterAccount──▶ active; active ──RecordAccountSignIn──▶ active.

import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { AccountOwner } from '../src/domain/Account.mjs';
import { migrate } from '../src/platform/migrate.mjs';
import { createTestClock, createTestDatabase } from './helpers.mjs';

let database;
let clock;

beforeEach(async () => {
  database = createTestDatabase();
  clock = createTestClock();
  await migrate(database);
});

function stagedOwner({ provider = 'google', subject = 'sub-1', email = 'staff@example.org' } = {}) {
  const owner = new AccountOwner({ Database: database, Clock: clock });
  owner.Provider = provider;
  owner.ProviderSubject = subject;
  owner.DisplayEmail = email;
  return owner;
}

test('RegisterAccount: arrow absent → active', async () => {
  const owner = stagedOwner();
  await owner.RegisterAccount();
  assert.deepEqual(owner.Errors, []);
  assert.equal(owner.AccountId, 'google:sub-1');
  const { rows } = await database.query('SELECT * FROM account');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].account_status, 'active');
  assert.equal(rows[0].display_email, 'staff@example.org');
  assert.equal(rows[0].sign_in_count, 0);
});

test('RegisterAccount on a registered account writes nothing', async () => {
  await stagedOwner().RegisterAccount();
  const again = stagedOwner({ email: 'other@example.org' });
  await again.RegisterAccount();
  assert.equal(again.AccountIsRegistered, true);
  assert.equal(again.AccountRowsWritten, 0);
  assert.deepEqual(again.Errors, []);
  assert.equal((await database.query('SELECT display_email FROM account')).rows[0].display_email, 'staff@example.org');
});

test('RecordAccountSignIn: arrow active → active counts the sign-in and keeps the email when the provider omits it', async () => {
  await stagedOwner().RegisterAccount();
  clock.advance(60_000);
  const owner = stagedOwner({ email: '' });
  await owner.RecordAccountSignIn();
  assert.deepEqual(owner.Errors, []);
  const [row] = (await database.query('SELECT * FROM account')).rows;
  assert.equal(row.sign_in_count, 1);
  assert.equal(row.display_email, 'staff@example.org');
  assert.equal(new Date(row.last_signed_in_at).getTime(), clock.now());
});

test('RecordAccountSignIn rejects an unregistered account', async () => {
  const owner = stagedOwner({ provider: 'apple', subject: 'never-registered' });
  await owner.RecordAccountSignIn();
  assert.deepEqual(owner.Errors.map((error) => error.code), ['account-not-registered']);
  assert.equal((await database.query('SELECT * FROM account')).rowCount, 0);
});

test('ReadAccount shapes the owner view', async () => {
  await stagedOwner().RegisterAccount();
  const reader = new AccountOwner({ Database: database, Clock: clock });
  reader.AccountId = 'google:sub-1';
  await reader.ReadAccount();
  assert.equal(reader.AccountView.accountId, 'google:sub-1');
  assert.equal(reader.AccountView.provider, 'google');
  assert.equal(reader.AccountView.displayEmail, 'staff@example.org');
});

test('RegisterAccount: a concurrent first sign-in that registered first is treated as registered', async () => {
  // The first SELECT sees no row (the other request has not committed yet when it reads); by the
  // time this request inserts, the row exists, so ON CONFLICT DO NOTHING writes nothing.
  await stagedOwner().RegisterAccount();
  let firstSelect = true;
  const racingDatabase = {
    async query(text, params) {
      if (firstSelect && text.trim().startsWith('SELECT')) {
        firstSelect = false;
        return { rows: [], rowCount: 0 };
      }
      const result = await database.query(text, params);
      // pg-mem reports 1 for ON CONFLICT DO NOTHING even when it skipped; Postgres reports 0.
      return text.includes('ON CONFLICT (account_id) DO NOTHING') ? { rows: [], rowCount: 0 } : result;
    },
  };
  const owner = new AccountOwner({ Database: racingDatabase, Clock: clock });
  owner.Provider = 'google';
  owner.ProviderSubject = 'sub-1';
  owner.DisplayEmail = 'staff@example.org';
  await owner.RegisterAccount();
  assert.equal(owner.AccountRowsWritten, 0);
  assert.equal(owner.AccountIsRegistered, true);
  assert.deepEqual(owner.Errors, []);
  assert.equal((await database.query('SELECT * FROM account')).rowCount, 1);
});
