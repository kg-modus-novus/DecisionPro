// HTTP routes end to end against one booted API on an in-memory database, with ID tokens signed
// by locally generated provider keys.

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { generateKeyPair } from 'jose';

import {
  ALLOWED_ORIGIN,
  createBrowser,
  signAppleToken,
  signGoogleToken,
  startTestServer,
} from './helpers.mjs';

const PERCENT_MEASURE = '988-in-state-answer-rate';
const COUNT_MEASURE = '988-calls-routed';

let api;

before(async () => {
  api = await startTestServer();
});

after(async () => {
  await api.close();
});

async function signedInBrowser(subject = 'http-user') {
  const browser = createBrowser(api.baseUrl);
  const credential = await signGoogleToken(api.keys, { sub: subject });
  const response = await browser.request('POST', '/auth/google', { credential });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return browser;
}

describe('health and CORS', () => {
  test('GET /health', async () => {
    const response = await createBrowser(api.baseUrl, { origin: '' }).request('GET', '/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'ok');
  });

  test('an origin outside ALLOWED_ORIGINS is rejected without CORS headers', async () => {
    const response = await createBrowser(api.baseUrl, { origin: 'https://evil.example' }).request('GET', '/health');
    assert.equal(response.status, 403);
    assert.equal(response.body.error, 'origin-not-allowed');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });

  test('a preflight from an allowed origin is answered with credentials allowed', async () => {
    const response = await fetch(`${api.baseUrl}/targets`, {
      method: 'OPTIONS',
      headers: { Origin: ALLOWED_ORIGIN, 'Access-Control-Request-Method': 'PUT' },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.match(response.headers.get('access-control-allow-methods'), /PUT/);
  });

  test('a preflight from another origin is rejected', async () => {
    const response = await fetch(`${api.baseUrl}/targets`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:9999', 'Access-Control-Request-Method': 'PUT' },
    });
    assert.equal(response.status, 403);
  });
});

describe('sign-in and sessions', () => {
  test('Google sign-in registers the account and sets the session cookie', async () => {
    const browser = createBrowser(api.baseUrl);
    const response = await browser.request('POST', '/auth/google', { credential: await signGoogleToken(api.keys, { sub: 'cookie-check' }) });
    assert.equal(response.status, 200);
    assert.equal(response.body.account.accountId, 'google:cookie-check');
    assert.equal(response.body.account.displayEmail, 'legislator@example.org');
    assert.match(response.setCookie, /^dp_session=[A-Za-z0-9_-]{43};/);
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=43200']) {
      assert.ok(response.setCookie.includes(attribute), attribute);
    }
    assert.ok(!response.setCookie.includes('Domain='));
    assert.equal(response.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);
    const me = await browser.request('GET', '/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.account.accountId, 'google:cookie-check');
    assert.equal(me.body.account.signInCount, 1);
    assert.deepEqual(me.body.failedOperations, []);
  });

  test('Apple sign-in works without an email claim', async () => {
    const browser = createBrowser(api.baseUrl);
    const response = await browser.request('POST', '/auth/apple', { idToken: await signAppleToken(api.keys, { sub: 'apple-1' }) });
    assert.equal(response.status, 200);
    assert.equal(response.body.account.accountId, 'apple:apple-1');
    assert.equal(response.body.account.displayEmail, '');
  });

  test('requests without a session are 401', async () => {
    const browser = createBrowser(api.baseUrl);
    assert.equal((await browser.request('GET', '/me')).status, 401);
    assert.equal((await browser.request('GET', '/targets')).status, 401);
    assert.equal((await browser.request('PUT', '/targets', { targets: [] })).status, 401);
  });

  test('sign-out ends the session and clears the cookie', async () => {
    const browser = await signedInBrowser('sign-out-user');
    const response = await browser.request('POST', '/auth/sign-out');
    assert.equal(response.status, 200);
    assert.match(response.setCookie, /^dp_session=;.*Max-Age=0/);
    assert.equal((await browser.request('GET', '/me')).status, 401);
  });

  test('a rejected token is 401', async () => {
    const browser = createBrowser(api.baseUrl);
    const response = await browser.request('POST', '/auth/google', { credential: 'not-a-jwt' });
    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'invalid-id-token');
  });

  test('cookie Domain comes from COOKIE_DOMAIN when set', async () => {
    const withDomain = await startTestServer({ keys: api.keys, config: { ...(await import('./helpers.mjs')).testConfig({ cookieDomain: 'decisionpro.io' }) } });
    try {
      const browser = createBrowser(withDomain.baseUrl);
      const response = await browser.request('POST', '/auth/google', { credential: await signGoogleToken(api.keys) });
      assert.ok(response.setCookie.includes('Domain=decisionpro.io'));
    } finally {
      await withDomain.close();
    }
  });
});

describe('targets', () => {
  test('open, save, read, and the lock is released by the save', async () => {
    const browser = await signedInBrowser('targets-user');
    assert.deepEqual((await browser.request('GET', '/targets')).body, { targets: [], count: 0 });
    assert.equal((await browser.request('POST', '/targets/edit')).status, 200);
    const saved = await browser.request('PUT', '/targets', {
      targets: [{ measureId: PERCENT_MEASURE, value: 85, note: 'National rate' }, { measureId: COUNT_MEASURE, value: 12000 }],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body, { committed: true, saved: 2, retired: 0, rejected: 0, committedTargets: 2, lockReleased: true, errors: [] });
    const read = await browser.request('GET', '/targets');
    assert.equal(read.body.count, 2);
    assert.deepEqual(read.body.targets.map((target) => [target.measureId, target.value, target.revision]), [
      [COUNT_MEASURE, 12000, 1],
      [PERCENT_MEASURE, 85, 1],
    ]);
    // Saving again needs the lock again.
    const unlocked = await browser.request('PUT', '/targets', { targets: [{ measureId: PERCENT_MEASURE, value: 90 }] });
    assert.equal(unlocked.status, 409);
    assert.equal(unlocked.body.error, 'lock-not-held');
  });

  test('a second browser gets 409 naming the holder; cancel frees it', async () => {
    const first = await signedInBrowser('two-browsers');
    const second = await signedInBrowser('two-browsers');
    assert.equal((await first.request('POST', '/targets/edit')).status, 200);
    const denied = await second.request('POST', '/targets/edit');
    assert.equal(denied.status, 409);
    assert.equal(denied.body.holder, 'Your targets are open for editing in another browser or device (since 3:42 PM ET). Close it, or sign out there, to edit here.');
    const refusedSave = await second.request('PUT', '/targets', { targets: [{ measureId: PERCENT_MEASURE, value: 50 }] });
    assert.equal(refusedSave.status, 409);
    assert.match(refusedSave.body.holder, /another browser or device/);
    assert.deepEqual((await first.request('DELETE', '/targets/edit')).body, { editing: false, released: 1, errors: [] });
    assert.equal((await second.request('POST', '/targets/edit')).status, 200);
  });

  test('sign-out releases the lock for the other browser', async () => {
    const first = await signedInBrowser('sign-out-lock');
    const second = await signedInBrowser('sign-out-lock');
    await first.request('POST', '/targets/edit');
    assert.equal((await second.request('POST', '/targets/edit')).status, 409);
    assert.equal((await first.request('POST', '/auth/sign-out')).body.releasedLocks, 1);
    assert.equal((await second.request('POST', '/targets/edit')).status, 200);
  });

  test('a save with a rejected target is 422, rolls back, and reports per-target errors', async () => {
    const browser = await signedInBrowser('rejections');
    await browser.request('POST', '/targets/edit');
    const response = await browser.request('PUT', '/targets', {
      targets: [
        { measureId: PERCENT_MEASURE, value: 80 },
        { measureId: PERCENT_MEASURE.toUpperCase(), value: 80 },
        { measureId: COUNT_MEASURE, value: -1 },
      ],
    });
    assert.equal(response.status, 422);
    assert.equal(response.body.committed, false);
    assert.equal(response.body.rejected, 2);
    assert.deepEqual(response.body.errors.map((error) => error.code), ['unknown-measure', 'target-value-out-of-range']);
    assert.equal((await browser.request('GET', '/targets')).body.count, 0);
  });

  test('retire through the API', async () => {
    const browser = await signedInBrowser('retire-user');
    await browser.request('POST', '/targets/edit');
    await browser.request('PUT', '/targets', { targets: [{ measureId: PERCENT_MEASURE, value: 70 }] });
    await browser.request('POST', '/targets/edit');
    const retired = await browser.request('PUT', '/targets', { targets: [{ measureId: PERCENT_MEASURE, retire: true }] });
    assert.equal(retired.status, 200);
    assert.equal(retired.body.retired, 1);
    assert.equal((await browser.request('GET', '/targets')).body.count, 0);
  });

  test('boundary normalization rejects malformed requests with 400', async () => {
    const browser = await signedInBrowser('boundary-user');
    await browser.request('POST', '/targets/edit');
    const cases = [
      [{ targets: 'nope' }, 'invalid-targets'],
      [{ targets: Array.from({ length: 101 }, () => ({ measureId: PERCENT_MEASURE, value: 1 })) }, 'too-many-targets'],
      [{ targets: [{ measureId: PERCENT_MEASURE, value: '80' }] }, 'invalid-target'],
      [{ targets: [{ measureId: PERCENT_MEASURE }] }, 'invalid-target'],
      [{ targets: [{ measureId: 42, value: 1 }] }, 'invalid-target'],
      [{ targets: [{ measureId: PERCENT_MEASURE, value: 1, note: 'x'.repeat(501) }] }, 'invalid-target'],
      [{ targets: [{ measureId: PERCENT_MEASURE, value: 1, retire: 'yes' }] }, 'invalid-target'],
      [{ targets: [null] }, 'invalid-target'],
    ];
    for (const [body, code] of cases) {
      const response = await browser.request('PUT', '/targets', body);
      assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80));
      assert.equal(response.body.error, code);
    }
    assert.equal((await browser.request('PUT', '/targets', '{not json')).status, 400);
    const exactly500 = await browser.request('PUT', '/targets', { targets: [{ measureId: PERCENT_MEASURE, value: 1, note: 'x'.repeat(500) }] });
    assert.equal(exactly500.status, 200);
  });

  test('unknown paths are 404 and wrong methods 405', async () => {
    const browser = createBrowser(api.baseUrl);
    assert.equal((await browser.request('GET', '/nope')).status, 404);
    assert.equal((await browser.request('PATCH', '/targets')).status, 405);
  });
});

describe('identity token verification with locally generated keys', () => {
  const verifier = () => api.app.identityTokens;

  test('accepts both Google issuers', async () => {
    for (const issuer of ['accounts.google.com', 'https://accounts.google.com']) {
      const identity = await verifier().verifyGoogleIdToken(await signGoogleToken(api.keys, { sub: 'g' }, { issuer }));
      assert.deepEqual(identity, { provider: 'google', providerSubject: 'g', email: 'legislator@example.org' });
    }
  });

  test('rejects a Google token for another audience, issuer, or signing key, and an expired one', async () => {
    const stranger = await generateKeyPair('RS256');
    const tokens = [
      await signGoogleToken(api.keys, {}, { audience: 'someone-else' }),
      await signGoogleToken(api.keys, {}, { issuer: 'https://appleid.apple.com' }),
      await signGoogleToken(api.keys, {}, { privateKey: stranger.privateKey }),
      await signGoogleToken(api.keys, {}, { expiresIn: Math.floor(Date.now() / 1000) - 3600 }),
    ];
    for (const token of tokens) {
      await assert.rejects(verifier().verifyGoogleIdToken(token), { name: 'Error' });
    }
  });

  test('accepts an Apple token and rejects one for the wrong audience or issuer', async () => {
    const identity = await verifier().verifyAppleIdToken(await signAppleToken(api.keys, { sub: 'a', email: 'relay@privaterelay.appleid.com' }));
    assert.deepEqual(identity, { provider: 'apple', providerSubject: 'a', email: 'relay@privaterelay.appleid.com' });
    await assert.rejects(verifier().verifyAppleIdToken(await signAppleToken(api.keys, {}, { audience: 'other' })));
    await assert.rejects(verifier().verifyAppleIdToken(await signAppleToken(api.keys, {}, { issuer: 'https://accounts.google.com' })));
  });

  test('a Google token is not accepted as an Apple token', async () => {
    await assert.rejects(verifier().verifyAppleIdToken(await signGoogleToken(api.keys)));
  });
});
