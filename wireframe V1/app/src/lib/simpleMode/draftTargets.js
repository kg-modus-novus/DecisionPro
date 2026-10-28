// CodeXen: v1 not-applicable
// Demo-mode targets (plan item #7): a viewer's draft targets kept in this
// browser only. They are never sent to the DecisionPro API and are never
// authoritative (ADR-001, Decision 2): signed-in targets live in the API and
// are validated there. Presentation convenience only.

export const DRAFT_TARGETS_STORAGE_KEY = 'decisionpro.simple.draftTargets';

export function readDraftTargets() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_TARGETS_STORAGE_KEY) || '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function writeDraftTargets(targets) {
  try {
    localStorage.setItem(DRAFT_TARGETS_STORAGE_KEY, JSON.stringify(targets));
  } catch {
    // Storage can be unavailable (private windows); drafts then last for this page view only.
  }
  return targets;
}

export function storeDraftTarget(targets, measureId, { value, note = '' }) {
  return writeDraftTargets({ ...targets, [measureId]: { value, note: String(note).slice(0, 500), setAt: new Date().toISOString() } });
}

export function removeDraftTarget(targets, measureId) {
  const next = { ...targets };
  delete next[measureId];
  return writeDraftTargets(next);
}

/** A number the form can save for this unit, or a plain reason it cannot. */
export function checkTargetInput(text, unit) {
  const value = Number(String(text).replace(/[$,%\s]/g, ''));
  if (String(text).trim() === '' || !Number.isFinite(value)) return { ok: false, reason: 'Enter a number.' };
  if (unit === 'percent' && (value < 0 || value > 100)) return { ok: false, reason: 'A percentage target must be between 0 and 100.' };
  if (value < 0) return { ok: false, reason: 'A target cannot be negative.' };
  return { ok: true, value };
}
