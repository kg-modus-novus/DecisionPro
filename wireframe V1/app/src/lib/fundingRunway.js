const DAY_MS = 24 * 60 * 60 * 1000;
const DEADLINE_TYPES = new Set(['award-cliff', 'horizon-waiver']);
import { enrichRunwayPresentation } from './runwayEvidenceDisplay.js';

export function daysRemaining(dateString, now = new Date()) {
  if (!dateString) return null;
  const deadline = new Date(`${dateString}T00:00:00Z`).getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (Number.isNaN(deadline)) return null;
  return Math.ceil((deadline - today) / DAY_MS);
}

export function buildFundingRunway(items = [], now = new Date()) {
  const deadlineItems = items
    .filter((item) => DEADLINE_TYPES.has(item.type) && item.date && item.urgencyRank != null)
    .map((item) => {
      const remaining = daysRemaining(item.date, now);
      const isAuthority = item.type === 'horizon-waiver';
      const priority = remaining <= 30 ? 'urgent' : remaining <= 90 ? 'near-term' : 'monitor';
      const enriched = enrichRunwayPresentation(item, now);
      return {
        ...item,
        daysRemaining: enriched.daysRemaining,
        priority,
        deadlineType: isAuthority ? 'Waiver authority expiration' : 'Federal award end date',
        ...enriched,
        continuationKnown: enriched.continuationConfirmation.level === 'confirmed',
        gapAssessed: enriched.gapStatus !== 'not_assessable' || enriched.gapInference.level === 'inferred',
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining || a.title.localeCompare(b.title));

  return {
    items: deadlineItems,
    informationalCount: Math.max(0, items.length - deadlineItems.length),
    summary: {
      nextDeadlineDays: deadlineItems[0]?.daysRemaining ?? null,
      dueWithin30: deadlineItems.filter((item) => item.daysRemaining <= 30).length,
      dueWithin90: deadlineItems.filter((item) => item.daysRemaining <= 90).length,
      continuationUnknown: deadlineItems.filter((item) => item.continuationConfirmation?.level !== 'confirmed').length,
      publicEvidenceLoaded: deadlineItems.filter((item) => item.evidenceDisplay?.loaded).length,
      inferredGapSignals: deadlineItems.filter((item) => item.gapInference?.level === 'inferred').length,
    },
  };
}

export function formatRunwayDate(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateString || 'Date not reported';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function formatDaysRemaining(days) {
  if (days == null) return 'Days unknown';
  if (days === 0) return 'Ends today';
  if (days < 0) return `${Math.abs(days)} days past`;
  return `${days} days left`;
}
