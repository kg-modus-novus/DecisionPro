/**
 * Client helpers for Ask Sam live API.
 */

export async function fetchAskSamStatus() {
  try {
    const res = await fetch('/api/ask-sam/status', { method: 'GET' });
    if (!res.ok) return { live: false, provider: null, model: null };
    return await res.json();
  } catch {
    return { live: false, provider: null, model: null };
  }
}

export async function fetchAskSamReply({ message, context, history }) {
  const res = await fetch('/api/ask-sam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context, history }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.reply) {
    throw new Error(data.error || `Ask Sam HTTP ${res.status}`);
  }
  return data;
}
