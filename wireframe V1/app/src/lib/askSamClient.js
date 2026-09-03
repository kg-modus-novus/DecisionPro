/**
 * Browser client for Ask Sam. Talks to same-origin Vite middleware locally,
 * or to VITE_ASK_SAM_API_BASE on static hosts (GitHub Pages).
 */

export const DEFAULT_PUBLIC_ASK_SAM_API_BASE = 'https://decisionpro-ask-sam.vercel.app';

const PUBLIC_APP_HOSTS = new Set([
  'demo.decisionpro.io',
  'kg-modus-novus.github.io',
]);

export function resolveAskSamApiBase(configuredBase = '', hostname = '') {
  const configured = String(configuredBase || '').trim().replace(/\/+$/, '');
  if (configured) return configured;

  const normalizedHost = String(hostname || '').trim().toLowerCase();
  return PUBLIC_APP_HOSTS.has(normalizedHost) ? DEFAULT_PUBLIC_ASK_SAM_API_BASE : '';
}

function askSamApiBase() {
  return resolveAskSamApiBase(
    import.meta.env.VITE_ASK_SAM_API_BASE,
    globalThis.location?.hostname,
  );
}

function askSamUrl(path) {
  const base = askSamApiBase();
  if (!base) return path;
  return `${base}${path}`;
}

export async function fetchAskSamStatus() {
  try {
    const res = await fetch(askSamUrl('/api/ask-sam/status'));
    if (!res.ok) return { live: false, provider: null, model: null, mode: 'local' };
    return await res.json();
  } catch {
    return { live: false, provider: null, model: null, mode: 'local' };
  }
}

export async function fetchAskSamReply({ message, context, history }) {
  const res = await fetch(askSamUrl('/api/ask-sam'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, context, history }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Ask Sam failed (${res.status})`);
  }
  return res.json();
}
