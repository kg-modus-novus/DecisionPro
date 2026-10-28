// HTTP scenarios from the independent review (CX-15): storage failures map to 503, tenants are
// isolated, tabs of one session share the lock, a new sign-in releases the old session's locks,
// token rejections name their reason, /auth/* is rate limited, and session ids are hashed at rest.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { SignJWT, generateKeyPair } from 'jose';

import { hashSessionToken } from '../src/platform/sessions.mjs';
import {
  GOOGLE_CLIENT_ID,
  createBrowser,
  createFaultyDatabase,
  createTestDatabase,
  signGoogleToken,
  startTestServer,
  testConfig,
} from './helpers.mjs';

const PERCENT_MEASURE = '988-in-state-answer-rate';
const COUNT_MEASURE = '988-calls-routed';

let api;
let faulty;

before(async () => {
  faulty = createFaultyDatabase(createTestDatabase());
  api = await startTestServer({ database: faulty });
});

after(async () => {
  await api.close();
});

async function signedInBrowser(subject) {
  const browser = createBrowser(api.baseUrl);
  const response = await browser.request('POST', '/auth/google', { credential: await signGoogleToken(api.keys, { sub: subject }) });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return browser;
}

function resetFaults() {
  Object.assign(faulty, { failBegin: false, failCommit: false, failRollback: false, failQueryFor: /$^/, zeroRowsFor: /$^/ });
}

describe('storage failures are 503', () => {
  test('begin fails', async () => {
    const browser = await signedInBrowser('fail-begin');
    await browser.request('POST', '/targets/edit');
    faulty.failBegin = true;
    try {
      const response = await browser.request('PUT', '/targets', { targets: [{ measureId: PERCENT_MEASURE, value: 80 }] });
      assert.equal(response.status, 503);
      assert.equal(response.body.committed, false);
      assert.equal(response.body.errors[0].code, 'storage-failure');
    } finally {
      resetFaults();
    }
    assert.equal((await browser.request('GET', '/targets')).body.count, 0);
  });

  test('commit fails: the user is told the save may not have completed', async () => {
    const browser = await signedInBrowser('fail-commit');
    await browser.request('POST', '/targets/edit');
    faulty.failCommit = true;
    try {
      const response = await browser.request('PUT', '/targets', { targets: [{ measureId: PERCENT_MEASURE, value: 80 }] });
      assert.equal(response.status, 503);
      assert.equal(response.body.committed, false);
      assert.equal(response.body.committedTargets, 0);
      assert.equal(response.body.errors[0].message, 'The save may not have completed. Reload to check.');
    } finally {
      resetFaults();
    }
  });

  test('rollback fails after a rejected target', async () => {
    const browser = await signedInBrowser('fail-rollback');
    await browser.request('POST', '/targets/edit');
    faulty.failRollback = true;
    try {
      const response = await browser.request('PUT', '/targets', { targets: [{ measureId: 'not-a-measure', value: 1 }] });
      assert.equal(response.status, 503);
      assert.deepEqual(response.body.errors.map((error) => error.code), ['unknown-measure', 'storage-failure']);
    } finally {
      resetFaults();
    }
  });

  test('a lock that cannot be persisted is a 503 and is not held', async () => {
    const browser = await signedInBrowser('fail-acquire');
    faulty.failQueryFor = /INSERT INTO enqueue_lock/;
    try {
      const response = await browser.request('POST', '/targets/edit');
      assert.equal(response.status, 503);
      assert.equal(response.body.errors[0].code, 'storage-failure');
    } finally {
      resetFaults();
    }
    assert.equal(api.app.enqueue.listLocks().filter((lock) => lock.ownerScope === 'google:fail-acquire').length, 0);
    assert.equal((await browser.request('POST', '/targets/edit')).status, 200);
  });

  test('a lost race on the target row is a 422 target-changed, not a 503', async () => {
    const browser = await signedInBrowser('lost-race');
    await browser.request('POST', '/targets/edit');
    faulty.zeroRowsFor = /INSERT INTO measure_target [(]/;
    try {
      const response = await browser.request('PUT', '/targets', { targets: [{ measureId: PERCENT_MEASURE, value: 80 }] });
      assert.equal(response.status, 422);
      assert.deepEqual(response.body.errors.map((error) => error.code), ['target-changed']);
    } finally {
      resetFaults();
    }
  });
});

describe('tenancy (P1) over HTTP', () => {
  test('two accounts cannot see or overwrite each other\'s targets', async () => {
    const alice = await signedInBrowser('tenant-alice');
    const bob = await signedInBrowser('tenant-bob');
    await alice.request('POST', '/targets/edit');
    assert.equal((await alice.request('PUT', '/targets', { targets: [{ measureId: PERCENT_MEASURE, value: 80 }] })).status, 200);

    // Bob's lock is his own target set: Alice's open lock never blocks him, and he sees nothing of hers.
    assert.equal((await alice.request('POST', '/targets/edit')).status, 200);
    assert.equal((await bob.request('POST', '/targets/edit')).status, 200);
    assert.equal((await bob.request('GET', '/targets')).body.count, 0);

    // Bob saving the same measure sets his own target (revision 1); Alice's row is untouched.
    const bobSave = await bob.request('PUT', '/targets', { targets: [{ measureId: PERCENT_MEASURE, value: 10 }] });
    assert.equal(bobSave.status, 200);
    assert.equal(bobSave.body.saved, 1);
    const aliceTargets = (await alice.request('GET', '/targets')).body.targets;
    assert.deepEqual(aliceTargets.map((target) => [target.measureId, target.value, target.revision]), [[PERCENT_MEASURE, 80, 1]]);
    const bobTargets = (await bob.request('GET', '/targets')).body.targets;
    assert.deepEqual(bobTargets.map((target) => [target.measureId, target.value, target.revision]), [[PERCENT_MEASURE, 10, 1]]);
  });
});

describe('sessions and the lock', () => {
  test('two tabs of one browser share the session, so they share the lock', async () => {
    const tab = await signedInBrowser('two-tabs');
    const sameCookie = { request: (method, path, body) => fetch(`${api.baseUrl}${path}`, {
      method,
      headers: { Origin: 'https://demo.decisionpro.io', Cookie: tab.cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (response) => ({ status: response.status, body: await response.json() })) };
    assert.equal((await tab.request('POST', '/targets/edit')).status, 200);
    assert.equal((await sameCookie.request('POST', '/targets/edit')).status, 200);
    const saved = await sameCookie.request('PUT', '/targets', { targets: [{ measureId: COUNT_MEASURE, value: 3 }] });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.committed, true);
  });

  test('signing in again ends the old session and releases its locks', async () => {
    const browser = await signedInBrowser('re-sign-in');
    const oldCookie = browser.cookie;
    await browser.request('POST', '/targets/edit');
    const otherDevice = await signedInBrowser('re-sign-in');
    assert.equal((await otherDevice.request('POST', '/targets/edit')).status, 409);

    const again = await browser.request('POST', '/auth/google', { credential: await signGoogleToken(api.keys, { sub: 're-sign-in' }) });
    assert.equal(again.status, 200);
    assert.notEqual(browser.cookie, oldCookie);
    assert.equal((await otherDevice.request('POST', '/targets/edit')).status, 200);

    const oldSession = await fetch(`${api.baseUrl}/me`, { headers: { Cookie: oldCookie } });
    assert.equal(oldSession.status, 401);
  });

  test('session ids are hashed at rest, and ended_at stays null until the session ends', async () => {
    const browser = await signedInBrowser('hashed-session');
    const token = browser.cookie.split('=')[1];
    const stored = await api.database.query('SELECT session_id, session_status, ended_at FROM user_session WHERE session_id = $1', [hashSessionToken(token)]);
    assert.equal(stored.rowCount, 1);
    assert.equal(stored.rows[0].ended_at, null);
    assert.equal((await api.database.query('SELECT * FROM user_session WHERE session_id = $1', [token])).rowCount, 0);
    await browser.request('POST', '/auth/sign-out');
    const ended = await api.database.query('SELECT session_status, ended_at FROM user_session WHERE session_id = $1', [hashSessionToken(token)]);
    assert.equal(ended.rows[0].session_status, 'ended');
    assert.notEqual(ended.rows[0].ended_at, null);
  });
});

describe('token rejection reasons', () => {
  async function rejectionReason(credential) {
    const response = await createBrowser(api.baseUrl).request('POST', '/auth/google', { credential });
    assert.equal(response.status, 401);
    return response.body.reason;
  }

  const unsigned = (claims, configure) => {
    const jwt = new SignJWT({ email: 'x@example.org', ...claims }).setProtectedHeader({ alg: 'RS256', kid: 'google-test' });
    configure(jwt);
    return jwt.sign(api.keys.google.privateKey);
  };

  test('each rejection names its reason', async () => {
    const stranger = await generateKeyPair('RS256');
    const ellipticCurve = await generateKeyPair('ES256');
    assert.equal(await rejectionReason(await signGoogleToken(api.keys, {}, { audience: 'someone-else' })), 'audience');
    assert.equal(await rejectionReason(await signGoogleToken(api.keys, {}, { issuer: 'https://evil.example' })), 'issuer');
    assert.equal(await rejectionReason(await signGoogleToken(api.keys, {}, { privateKey: stranger.privateKey })), 'signature');
    assert.equal(await rejectionReason(await signGoogleToken(api.keys, {}, { expiresIn: Math.floor(Date.now() / 1000) - 3600 })), 'expired');
    assert.equal(await rejectionReason('not-a-jwt'), 'malformed');
    assert.equal(await rejectionReason(''), 'missing-token');
    const es256 = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: 'google-test' })
      .setIssuer('https://accounts.google.com').setAudience(GOOGLE_CLIENT_ID).setSubject('s').setIssuedAt().setExpirationTime('1h')
      .sign(ellipticCurve.privateKey);
    assert.equal(await rejectionReason(es256), 'algorithm');
    const withoutIat = await unsigned({}, (jwt) => jwt.setIssuer('https://accounts.google.com').setAudience(GOOGLE_CLIENT_ID).setSubject('s').setExpirationTime('1h'));
    assert.equal(await rejectionReason(withoutIat), 'missing-claim');
    const withoutExp = await unsigned({}, (jwt) => jwt.setIssuer('https://accounts.google.com').setAudience(GOOGLE_CLIENT_ID).setSubject('s').setIssuedAt());
    assert.equal(await rejectionReason(withoutExp), 'missing-claim');
  });
});

describe('rate limiting on sign-in attempts', () => {
  test('a client over the limit gets 429 until the window passes', async () => {
    const limited = await startTestServer({ keys: api.keys, config: testConfig({ signInRateLimit: { limit: 2, windowMs: 10 * 60_000 } }) });
    try {
      const browser = createBrowser(limited.baseUrl);
      const credential = await signGoogleToken(api.keys, { sub: 'limited' });
      assert.equal((await browser.request('POST', '/auth/google', { credential })).status, 200);
      assert.equal((await browser.request('POST', '/auth/google', { credential })).status, 200);
      const third = await browser.request('POST', '/auth/google', { credential });
      assert.equal(third.status, 429);
      assert.equal(third.body.error, 'too-many-requests');
      assert.equal((await browser.request('GET', '/me')).status, 200); // only sign-in attempts are limited
      assert.equal((await browser.request('POST', '/auth/sign-out')).status, 200); // sign-out is not limited
      limited.clock.advance(10 * 60_000);
      assert.equal((await browser.request('POST', '/auth/google', { credential })).status, 200);
    } finally {
      await limited.close();
    }
  });
});

describe('sign-in and sign-out storage failures (503, browser stays signed in)', () => {
  test('the new session cannot be started: 503, no cookie, the sign-in is not counted', async () => {
    const browser = await signedInBrowser('fail-session-start');
    const before = (await browser.request('GET', '/me')).body.account.signInCount;
    faulty.failQueryFor = /INSERT INTO user_session/;
    try {
      const response = await browser.request('POST', '/auth/google', { credential: await signGoogleToken(api.keys, { sub: 'fail-session-start' }) });
      assert.equal(response.status, 503);
      assert.equal(response.setCookie, '');
    } finally {
      resetFaults();
    }
    const me = await browser.request('GET', '/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.account.signInCount, before);
  });

  test('the sign-in cannot be counted on the account: 503, no cookie', async () => {
    const browser = await signedInBrowser('fail-record-sign-in');
    faulty.failQueryFor = /UPDATE account/;
    try {
      const response = await browser.request('POST', '/auth/google', { credential: await signGoogleToken(api.keys, { sub: 'fail-record-sign-in' }) });
      assert.equal(response.status, 503);
      assert.equal(response.setCookie, '');
    } finally {
      resetFaults();
    }
    assert.equal((await browser.request('GET', '/me')).status, 200); // still on the previous session
  });

  test('the signed-in account cannot be read back: 503, no cookie', async () => {
    const browser = await signedInBrowser('fail-read-account');
    const before = browser.cookie;
    let accountReads = 0;
    faulty.failQueryFor = { test: (text) => /FROM account WHERE account_id/.test(text) && (accountReads += 1) === 3 };
    try {
      // Reads of the account row during sign-in: RegisterAccount, RecordAccountSignIn, then ReadAccount (the third).
      const response = await browser.request('POST', '/auth/google', { credential: await signGoogleToken(api.keys, { sub: 'fail-read-account' }) });
      assert.equal(response.status, 503);
      assert.equal(response.setCookie, '');
    } finally {
      resetFaults();
    }
    assert.equal(accountReads >= 3, true);
    assert.equal(browser.cookie, before);
    assert.equal((await browser.request('GET', '/me')).status, 200);
  });

  test('the previous session\'s locks cannot be released on re-sign-in: 503, the old session and its lock remain', async () => {
    const browser = await signedInBrowser('fail-release-on-sign-in');
    await browser.request('POST', '/targets/edit');
    faulty.failQueryFor = /DELETE FROM enqueue_lock/;
    try {
      const response = await browser.request('POST', '/auth/google', { credential: await signGoogleToken(api.keys, { sub: 'fail-release-on-sign-in' }) });
      assert.equal(response.status, 503);
      assert.equal(response.setCookie, '');
    } finally {
      resetFaults();
    }
    assert.equal((await browser.request('GET', '/me')).status, 200);
    assert.equal((await browser.request('POST', '/targets/edit')).status, 200); // still this session's lock
  });

  test('sign-out that cannot end the session: 503, the cookie is not cleared, the session stays active', async () => {
    const browser = await signedInBrowser('fail-sign-out');
    faulty.failQueryFor = /UPDATE user_session/;
    try {
      const response = await browser.request('POST', '/auth/sign-out');
      assert.equal(response.status, 503);
      assert.equal(response.setCookie, '');
      assert.equal(response.body.signedOut, false);
    } finally {
      resetFaults();
    }
    assert.equal((await browser.request('GET', '/me')).status, 200);
  });

  test('a commit that succeeds while the lock release fails is 200 with lockReleased false', async () => {
    const browser = await signedInBrowser('fail-release-after-commit');
    await browser.request('POST', '/targets/edit');
    faulty.failQueryFor = /DELETE FROM enqueue_lock/;
    try {
      const response = await browser.request('PUT', '/targets', { targets: [{ measureId: PERCENT_MEASURE, value: 70 }] });
      assert.equal(response.status, 200);
      assert.equal(response.body.committed, true);
      assert.equal(response.body.lockReleased, false);
      assert.deepEqual(response.body.errors.map((error) => error.code), ['lock-not-released']);
    } finally {
      resetFaults();
    }
    assert.equal((await browser.request('GET', '/targets')).body.count, 1);
  });
});

describe('identity provider key server unavailable', () => {
  test('a network failure fetching the keys is key-set-unavailable and a 503', async () => {
    const unreachable = {
      ...api.keys,
      keySets: { ...api.keys.keySets, google: async () => { throw new TypeError('fetch failed'); } },
    };
    const server = await startTestServer({ keys: unreachable });
    try {
      const response = await createBrowser(server.baseUrl).request('POST', '/auth/google', { credential: await signGoogleToken(api.keys) });
      assert.equal(response.status, 503);
      assert.equal(response.body.error, 'identity-provider-unavailable');
      assert.equal(response.body.reason, 'key-set-unavailable');
    } finally {
      await server.close();
    }
  });

  test('a JWKS endpoint answering 500 is key-set-unavailable', async () => {
    const { createServer } = await import('node:http');
    const { createRemoteJWKSet } = await import('jose');
    const { createIdentityTokenVerifier } = await import('../src/platform/identityTokens.mjs');
    const keyServer = createServer((req, res) => { res.writeHead(500); res.end('down'); });
    await new Promise((resolve) => keyServer.listen(0, '127.0.0.1', resolve));
    try {
      const verifier = createIdentityTokenVerifier({
        googleClientId: GOOGLE_CLIENT_ID,
        appleServicesId: 'unused',
        keySets: { google: createRemoteJWKSet(new URL(`http://127.0.0.1:${keyServer.address().port}/keys`)), apple: api.keys.keySets.apple },
      });
      await assert.rejects(verifier.verifyGoogleIdToken(await signGoogleToken(api.keys)), { reason: 'key-set-unavailable' });
    } finally {
      await new Promise((resolve) => keyServer.close(resolve));
    }
  });
});
