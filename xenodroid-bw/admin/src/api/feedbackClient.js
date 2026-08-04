/**
 * Feedback Inbox client. Prefer same-origin /api/feedback (Vite proxy → 5040).
 * Override with VITE_FEEDBACK_API_BASE when the wireframe API is remote.
 */

function feedbackApiBase() {
  const raw = String(import.meta.env.VITE_FEEDBACK_API_BASE || '')
    .trim()
    .replace(/\/+$/, '');
  return raw;
}

function feedbackUrl(path) {
  const base = feedbackApiBase();
  if (!base) return path;
  return `${base}${path}`;
}

export async function fetchFeedbackInbox() {
  const res = await fetch(feedbackUrl('/api/feedback'));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} /api/feedback: ${text}`);
  }
  return res.json();
}

export async function fetchFeedbackItem(id) {
  const res = await fetch(feedbackUrl(`/api/feedback/${encodeURIComponent(id)}`));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} /api/feedback/${id}: ${text}`);
  }
  return res.json();
}

export async function patchFeedbackItem(id, patch) {
  const res = await fetch(feedbackUrl(`/api/feedback/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} PATCH /api/feedback/${id}: ${text}`);
  }
  return res.json();
}
