/**
 * Build a safe feedback package: UI context + optional screenshot. No PHI.
 */

export function buildFeedbackContext({
  roleId = null,
  view = null,
  activeEvidenceId = null,
  activeLawId = null,
  activePackId = null,
  evidenceObjectId = null,
  walkthrough = null,
} = {}) {
  return {
    roleId,
    view,
    activeEvidenceId,
    activeLawId,
    activePackId,
    evidenceObjectId,
    walkthrough: walkthrough
      ? {
          open: Boolean(walkthrough.open),
          stepId: walkthrough.stepId ?? null,
          stepTitle: walkthrough.stepTitle ?? null,
          index: walkthrough.index ?? null,
        }
      : null,
    host: typeof location !== 'undefined' ? location.host : null,
    href: typeof location !== 'undefined' ? location.href : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    appVersion: 'wireframe-v1',
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Capture the main content column (or documentElement) as a JPEG data URL.
 * Uses html2canvas when available; returns null on failure.
 */
export async function captureFeedbackScreenshot(targetSelector = '.content-column') {
  try {
    const mod = await import('html2canvas');
    const html2canvas = mod.default || mod;
    const el =
      (typeof document !== 'undefined' && document.querySelector(targetSelector))
      || (typeof document !== 'undefined' ? document.documentElement : null);
    if (!el) return null;
    const canvas = await html2canvas(el, {
      useCORS: true,
      allowTaint: true,
      logging: false,
      scale: Math.min(1, window.devicePixelRatio || 1),
      backgroundColor: '#f7f4ef',
    });
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return null;
  }
}

export function buildFeedbackPayload({
  category,
  message,
  contact = '',
  tags = [],
  context,
  screenshotDataUrl = null,
}) {
  return {
    category,
    message: String(message || '').trim(),
    contact: String(contact || '').trim() || undefined,
    tags,
    context,
    screenshotDataUrl: screenshotDataUrl || undefined,
  };
}
