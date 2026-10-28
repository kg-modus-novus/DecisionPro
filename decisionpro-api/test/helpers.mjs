// Test helpers: an in-memory Postgres (pg-mem) behind the same db interface, a settable clock,
// locally generated identity-provider keys, and an HTTP server on an ephemeral port.
// One API process per test database: ADR-001 forbids simulating two (T1).
// pg-mem fakes transactions (see withSnapshotTransactions), so FOR UPDATE row locking and isolation
// are exercised only by the gated real-Postgres check (test/postgresCatalog.test.mjs).

import { createServer } from 'node:http';

import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { DataType, newDb } from 'pg-mem';

import { createApp } from '../src/app.mjs';
import { createDatabase } from '../src/platform/db.mjs';
import { APPLE_ISSUER } from '../src/platform/identityTokens.mjs';

// 2026-10-28 19:42 UTC is 3:42 PM in Kentucky (Eastern).
export const START_TIME = Date.parse('2026-10-28T19:42:00Z');
export const GOOGLE_CLIENT_ID = 'test-google-client.apps.googleusercontent.com';
export const APPLE_SERVICES_ID = 'io.decisionpro.demo.test';
export const ALLOWED_ORIGIN = 'https://demo.decisionpro.io';

export function createTestClock(start = START_TIME) {
  return {
    current: start,
    now() { return this.current; },
    advance(ms) { this.current += ms; },
  };
}

export function createTestDatabase() {
  const memory = newDb();
  memory.public.registerFunction({
    name: 'char_length',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (text) => [...text].length,
  });
  const { Pool } = memory.adapters.createPg();
  return createDatabase(withSnapshotTransactions(new Pool(), memory));
}

// pg-mem's pg adapter ignores BEGIN/ROLLBACK issued as separate statements on a pooled client, so
// the test pool gives each transaction snapshot semantics: BEGIN takes a backup of the in-memory
// database and ROLLBACK restores it. The tests run one transaction at a time, so this is faithful
// to Postgres for every case they exercise.
function withSnapshotTransactions(pool, memory) {
  return {
    query: (text, params) => pool.query(text, params),
    end: () => pool.end(),
    async connect() {
      const client = await pool.connect();
      let snapshot = null;
      return {
        async query(text, params) {
          const statement = typeof text === 'string' ? text.trim().toUpperCase() : '';
          if (statement === 'BEGIN') {
            snapshot = memory.backup();
            return { rows: [], rowCount: 0 };
          }
          if (statement === 'COMMIT') {
            snapshot = null;
            return { rows: [], rowCount: 0 };
          }
          if (statement === 'ROLLBACK') {
            snapshot?.restore();
            snapshot = null;
            return { rows: [], rowCount: 0 };
          }
          return client.query(text, params);
        },
        release: () => client.release(),
      };
    },
  };
}

export async function createProviderKeys() {
  const google = await generateKeyPair('RS256');
  const apple = await generateKeyPair('RS256');
  const googleJwk = { ...(await exportJWK(google.publicKey)), kid: 'google-test', alg: 'RS256', use: 'sig' };
  const appleJwk = { ...(await exportJWK(apple.publicKey)), kid: 'apple-test', alg: 'RS256', use: 'sig' };
  return {
    google,
    apple,
    keySets: {
      google: createLocalJWKSet({ keys: [googleJwk] }),
      apple: createLocalJWKSet({ keys: [appleJwk] }),
    },
  };
}

export async function signGoogleToken(keys, claims = {}, { issuer = 'https://accounts.google.com', audience = GOOGLE_CLIENT_ID, expiresIn = '1h', privateKey } = {}) {
  return new SignJWT({ email: 'legislator@example.org', email_verified: true, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'google-test' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(claims.sub ?? 'google-subject-1')
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey ?? keys.google.privateKey);
}

export async function signAppleToken(keys, claims = {}, { issuer = APPLE_ISSUER, audience = APPLE_SERVICES_ID, expiresIn = '1h' } = {}) {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'apple-test' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(claims.sub ?? 'apple-subject-1')
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(keys.apple.privateKey);
}

export function testConfig(overrides = {}) {
  return {
    allowedOrigins: [ALLOWED_ORIGIN, 'http://localhost:5040'],
    cookieDomain: '',
    googleClientId: GOOGLE_CLIENT_ID,
    appleServicesId: APPLE_SERVICES_ID,
    displayTimeZone: 'America/New_York',
    signInRateLimit: { limit: 100000 },
    ...overrides,
  };
}

// Wraps a test database so a test can inject storage failures: failBegin, failCommit, failRollback
// (booleans), failQueryFor (a RegExp: matching statements throw), zeroRowsFor (a RegExp: matching
// statements report rowCount 0, as Postgres does when a conditional upsert loses a race).
export function createFaultyDatabase(database) {
  const faults = { failBegin: false, failCommit: false, failRollback: false, failQueryFor: /$^/, zeroRowsFor: /$^/ };
  async function runQuery(run, text, params) {
    if (faults.failQueryFor.test(text)) throw new Error('injected storage failure');
    const result = await run(text, params);
    return faults.zeroRowsFor.test(text) ? { rows: [], rowCount: 0 } : result;
  }
  return Object.assign(faults, {
    query: (text, params) => runQuery((t, p) => database.query(t, p), text, params),
    async beginTransaction() {
      if (faults.failBegin) throw new Error('injected begin failure');
      const handle = await database.beginTransaction();
      const wrapper = {
        get isOpen() { return handle.isOpen; },
        query: (text, params) => runQuery((t, p) => handle.query(t, p), text, params),
        async commit() {
          if (faults.failCommit) { await handle.rollback(); throw new Error('injected commit failure'); }
          return handle.commit();
        },
        async rollback() {
          if (faults.failRollback) { await handle.rollback(); throw new Error('injected rollback failure'); }
          return handle.rollback();
        },
      };
      return wrapper;
    },
    close: () => database.close(),
  });
}

// Boots one app on a database and serves it on an ephemeral port.
export async function startTestServer({ database = createTestDatabase(), clock = createTestClock(), keys, config = testConfig() } = {}) {
  const providerKeys = keys ?? (await createProviderKeys());
  const app = createApp({ database, config, clock, keySets: providerKeys.keySets });
  const bootResult = await app.boot();
  const server = createServer((req, res) => { app.handleRequest(req, res); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    app,
    bootResult,
    database,
    clock,
    keys: providerKeys,
    baseUrl,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// A minimal browser stand-in: keeps the dp_session cookie and sends the allowed Origin.
export function createBrowser(baseUrl, { origin = ALLOWED_ORIGIN } = {}) {
  let cookie = '';
  return {
    get cookie() { return cookie; },
    async request(method, path, body) {
      const headers = {};
      if (origin) headers.Origin = origin;
      if (cookie) headers.Cookie = cookie;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        const value = setCookie.split(';')[0];
        cookie = value.endsWith('=') ? '' : value;
      }
      const text = await response.text();
      return { status: response.status, headers: response.headers, setCookie: setCookie ?? '', body: text ? JSON.parse(text) : {} };
    },
  };
}
