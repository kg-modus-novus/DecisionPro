// CodeXen: v1 not-applicable
// Browser client for the DecisionPro API's sign-in and personal targets
// (plan item #7; service in decisionpro-api/, ADR-001). Transport only: every
// rule is enforced by the API. With no API base configured the page runs in
// demo mode and this client is never called.

const API_BASE = String(import.meta.env.VITE_DECISIONPRO_API_BASE || '').replace(/\/$/, '');

export const SIGN_IN_PROVIDERS = {
  google: String(import.meta.env.VITE_GOOGLE_CLIENT_ID || ''),
  apple: String(import.meta.env.VITE_APPLE_SERVICES_ID || ''),
};

export function apiConfigured() {
  return Boolean(API_BASE) && Boolean(SIGN_IN_PROVIDERS.google || SIGN_IN_PROVIDERS.apple);
}

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { ok: res.ok, status: res.status, data };
}

export const targetsApi = {
  me: () => call('/me'),
  signInWithGoogle: (credential) => call('/auth/google', { method: 'POST', body: { credential } }),
  signInWithApple: (idToken) => call('/auth/apple', { method: 'POST', body: { idToken } }),
  signOut: () => call('/auth/sign-out', { method: 'POST' }),
  listTargets: () => call('/targets'),
  openForEditing: () => call('/targets/edit', { method: 'POST' }),
  saveTargets: (targets) => call('/targets', { method: 'PUT', body: { targets } }),
  cancelEditing: () => call('/targets/edit', { method: 'DELETE' }),
};

const loaded = new Map();

/** Load a provider's sign-in script once (Google Identity Services, Sign in with Apple JS). */
export function loadScript(src) {
  if (!loaded.has(src)) {
    loaded.set(src, new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.onload = resolve;
      el.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.appendChild(el);
    }));
  }
  return loaded.get(src);
}

export const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';
export const APPLE_SCRIPT = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
