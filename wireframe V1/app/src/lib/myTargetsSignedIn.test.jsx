/**
 * @vitest-environment jsdom
 */
// Signed-in targets (plan item #7) against a fake decisionpro-api that returns the
// service's real response shapes (decisionpro-api/src/http/routes.mjs).
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.CSS = globalThis.CSS || { escape: (s) => s };

function fakeApi() {
  const state = { targets: [], editingHeldElsewhere: false, calls: [] };
  const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
  const fetch = vi.fn((url, init = {}) => {
    const path = new URL(url).pathname;
    const method = init.method || 'GET';
    state.calls.push(`${method} ${path}`);
    if (path === '/me') return json(200, { account: { accountId: 'google:1', provider: 'google', displayEmail: 'staff@example.test' }, session: {}, failedOperations: [] });
    if (path === '/targets' && method === 'GET') return json(200, { targets: state.targets, count: state.targets.length });
    if (path === '/targets/edit' && method === 'POST') {
      return state.editingHeldElsewhere
        ? json(409, { error: 'targets-open-elsewhere', editing: false, holder: 'Your targets are open for editing in another browser or device (since 3:42 PM).' })
        : json(200, { editing: true });
    }
    if (path === '/targets' && method === 'PUT') {
      const [t] = JSON.parse(init.body).targets;
      state.targets = t.retire ? [] : [{ measureId: t.measureId, value: t.value, note: t.note, revision: 1 }];
      return json(200, { committed: true, saved: t.retire ? 0 : 1, retired: t.retire ? 1 : 0, rejected: 0, errors: [] });
    }
    return json(404, { error: 'not-found' });
  });
  return { state, fetch };
}

let api;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.resetModules();
  vi.stubEnv('VITE_DECISIONPRO_API_BASE', 'https://api.example.test');
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client');
  api = fakeApi();
  vi.stubGlobal('fetch', api.fetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

async function renderOutcomes() {
  const { SimplePage } = await import('../components/SimpleHome.jsx');
  const host = document.createElement('div');
  document.body.appendChild(host);
  await act(async () => { createRoot(host).render(<SimplePage view="simple-outcomes" />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return host;
}

function input(el, value) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('My targets, signed in', () => {
  it('shows the account and saves a target through the API, never to browser storage', async () => {
    const host = await renderOutcomes();
    expect(host.querySelector('.sm-account-bar').textContent).toMatch(/saved to your account \(staff@example\.test\)/);
    const line = host.querySelector('.sm-my-target');
    expect(line.textContent).toMatch(/^My target(?! \(draft\))/);
    await act(async () => { line.querySelector('button').click(); });
    input(line.querySelector('input'), '55');
    await act(async () => { line.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(api.state.calls).toEqual(expect.arrayContaining(['POST /targets/edit', 'PUT /targets']));
    expect(line.textContent).toMatch(/55%/);
    expect(localStorage.getItem('decisionpro.simple.draftTargets')).toBeNull();
  });

  it('tells the viewer when the targets are open for editing elsewhere', async () => {
    api.state.editingHeldElsewhere = true;
    const host = await renderOutcomes();
    const line = host.querySelector('.sm-my-target');
    await act(async () => { line.querySelector('button').click(); });
    expect(line.querySelector('[role="alert"]').textContent).toMatch(/another browser or device/);
    expect(line.querySelector('form')).toBeNull();
  });
});
