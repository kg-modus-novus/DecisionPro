/**
 * Browser client for Ask Sam. Talks to same-origin Vite middleware locally,
 * or to VITE_ASK_SAM_API_BASE on static hosts (GitHub Pages).
 */

function askSamApiBase() {
  const raw = String(import.meta.env.VITE_ASK_SAM_API_BASE || '').trim().replace(/\/+$/, '');
  return raw;
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
