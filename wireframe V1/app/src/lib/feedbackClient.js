/**
 * Browser client for Feedback API. Same-origin locally; VITE_FEEDBACK_API_BASE
 * (or VITE_ASK_SAM_API_BASE) on static hosts.
 */

function feedbackApiBase() {
  const feedback = String(import.meta.env.VITE_FEEDBACK_API_BASE || '')
    .trim()
    .replace(/\/+$/, '');
  if (feedback) return feedback;
  return String(import.meta.env.VITE_ASK_SAM_API_BASE || '')
    .trim()
    .replace(/\/+$/, '');
}

function feedbackUrl(path) {
  const base = feedbackApiBase();
  if (!base) return path;
  return `${base}${path}`;
}

export async function submitFeedbackPackage(payload) {
  const res = await fetch(feedbackUrl('/api/feedback'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Feedback submit failed (${res.status})`);
  }
  return body;
}

export async function fetchFeedbackInbox({ includeScreenshot = false } = {}) {
  const q = includeScreenshot ? '?includeScreenshot=1' : '';
  const res = await fetch(feedbackUrl(`/api/feedback${q}`));
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Feedback list failed (${res.status})`);
  }
  return res.json();
}

export async function fetchFeedbackItem(id) {
  const res = await fetch(feedbackUrl(`/api/feedback/${encodeURIComponent(id)}`));
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Feedback item failed (${res.status})`);
  }
  return res.json();
}

export async function patchFeedbackItem(id, patch) {
  const res = await fetch(feedbackUrl(`/api/feedback/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Feedback update failed (${res.status})`);
  }
  return body;
}
