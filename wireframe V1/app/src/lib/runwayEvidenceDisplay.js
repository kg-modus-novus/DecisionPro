import { daysRemaining } from './fundingRunway.js';
import { GAP_LABELS, normalizeRunwayAssessment } from './fundingRunwayGovernance.js';

export const GAP_CONFIRM_TOOLTIPS = {
  'GAP-FRI-GRANT-ADMIN': 'Ask state grants administration for the current Notice of Award, renewal workflow status, or grant-manager disposition.',
  'GAP-FRI-RUNWAY-BASIS': 'Ask state accounting or grants management for available award balance and eligible daily spend — not USAspending obligation totals.',
  'GAP-FRI-SERVICE-DEPENDENCY': 'Ask the program or contract owner which services this award supports and whether a lapse would materially matter.',
  'GAP-FRI-REPLACEMENT-FUNDING': 'Ask the budget or grants owner whether replacement, bridge, or mitigation funding is approved or in process.',
  'GAP-FRI-LEGACY-RAW-CAPTURE': 'Run the governed USAspending transaction refresh so byte-faithful pages land in PSA before you rely on continuation posture.',
};

const CONFIRMED_CONTINUATION = new Set([
  'confirmed_continued', 'confirmed_ending', 'extension_pending', 'temporary_extension',
]);

export function usaSpendingAwardUri(awardKey) {
  if (!awardKey) return null;
  return `https://www.usaspending.gov/award/${encodeURIComponent(awardKey)}`;
}

export function buildContinuationEvidenceDisplay(item = {}) {
  const summary = item.continuationEvidenceSummary || {};
  const evidenceIds = item.continuationAssessment?.evidence || [];
  const count = summary.observationCount ?? evidenceIds.length;
  const pages = summary.pageCount ?? 0;
  const sourceUri = summary.sourceUri || usaSpendingAwardUri(item.awardKey);

  if (count === 0 && pages === 0) {
    return {
      loaded: false,
      observationCount: 0,
      pageCount: 0,
      headline: 'You do not have USAspending transaction observations for this award yet.',
      lines: [],
      sourceUri,
      confirmTooltip: 'Run the governed public refresh, or check that this award falls inside the search window (90 days past through 365 days before the published end date).',
    };
  }

  const lines = [];
  if (summary.latestActionDate) {
    lines.push(`Latest action: ${summary.latestActionDate}${summary.latestPublishedStatus ? ` (${summary.latestPublishedStatus})` : ''}.`);
  }
  if (pages > 0) {
    lines.push(`You retain ${pages} byte-faithful USAspending API page${pages === 1 ? '' : 's'} in PSA.`);
  }

  return {
    loaded: true,
    observationCount: count,
    pageCount: pages,
    headline: `You have ${count} USAspending transaction observation${count === 1 ? '' : 's'} loaded.`,
    lines,
    sourceUri,
    confirmTooltip: 'These are public transaction facts — not a continuation decision. Confirm renewal with the grant manager or recipient through a Notice of Award or grant-status feed.',
  };
}

export function continuationConfirmationState(status) {
  if (CONFIRMED_CONTINUATION.has(status)) {
    return { level: 'confirmed', tooltip: null };
  }
  if (status === 'successor_opportunity_identified') {
    return {
      level: 'inferred',
      inferredLabel: 'Opportunity only',
      tooltip: 'You have a published successor opportunity, but no confirmed continuation award. Verify whether the recipient pursued it.',
    };
  }
  if (status === 'no_public_continuation_found') {
    return {
      level: 'inferred',
      inferredLabel: 'Search complete',
      tooltip: 'You completed the governed USAspending search and found no affirmative continuation record. Confirm renewal with the grant manager or recipient — silence in public records is not proof funding stops.',
    };
  }
  if (status === 'stale') {
    return {
      level: 'unverified',
      inferredLabel: 'Stale evidence',
      tooltip: 'Refresh public transaction evidence before you rely on this disposition.',
    };
  }
  return {
    level: 'unverified',
    inferredLabel: 'Search not reconciled',
    tooltip: 'Run the governed USAspending transaction refresh, or verify this award falls inside the search window.',
  };
}

export function buildContinuationActionText(confirmation) {
  if (confirmation.level === 'confirmed') {
    return { text: 'You have affirmative continuation evidence in the reconciled public record.', tone: 'confirmed' };
  }
  if (confirmation.inferredLabel === 'Search complete') {
    return {
      text: 'Confirm renewal with the grant manager or recipient — you completed the public search and found no continuation record.',
      tone: 'inferred',
    };
  }
  if (confirmation.inferredLabel === 'Opportunity only') {
    return {
      text: 'Verify whether the recipient pursued the published successor opportunity — continuation is not confirmed yet.',
      tone: 'inferred',
    };
  }
  if (confirmation.inferredLabel === 'Stale evidence') {
    return { text: 'Refresh public transaction evidence before you rely on this continuation posture.', tone: 'unverified' };
  }
  return { text: 'Run the public transaction refresh, or check that this award is inside the governed search window.', tone: 'unverified' };
}

export function inferGapHint({ continuationStatus, gapStatus, daysRemaining, missingInputs = [], gapRefs = [] }) {
  if (gapStatus !== 'not_assessable') {
    return { level: 'confirmed', inferredLabel: GAP_LABELS[gapStatus], actionText: GAP_LABELS[gapStatus], tooltip: null, tone: 'confirmed' };
  }

  const nearTerm = daysRemaining != null && daysRemaining <= 90 && daysRemaining >= -90;
  const insideWindow = daysRemaining != null && daysRemaining <= 180 && daysRemaining >= -90;
  const confirmPaths = gapRefs.map((id) => GAP_CONFIRM_TOOLTIPS[id]).filter(Boolean);
  const missingSummary = missingInputs.length
    ? `You still need ${missingInputs.map((input) => input.toLowerCase()).join(', ')} before you assess gap likelihood.`
    : '';

  if (continuationStatus === 'no_public_continuation_found' && nearTerm) {
    return {
      level: 'inferred',
      inferredLabel: 'Inferred: elevated review priority',
      actionText: 'Schedule an agency or recipient continuity check — you are in the near-term window with no public continuation evidence.',
      tooltip: `This is not a confirmed gap. ${missingSummary} ${confirmPaths[0] || ''}`.trim(),
      tone: 'inferred',
    };
  }
  if (continuationStatus === 'no_public_continuation_found' && insideWindow) {
    return {
      level: 'inferred',
      inferredLabel: 'Inferred: monitor',
      actionText: 'Monitor this award — you completed the public search and remain inside the review window.',
      tooltip: confirmPaths.join(' ') || 'Confirm dependency and replacement funding with program and budget owners.',
      tone: 'inferred',
    };
  }
  if (continuationStatus === 'not_assessed' || continuationStatus === 'stale') {
    return {
      level: 'unverified',
      inferredLabel: 'Gap posture pending search',
      actionText: 'Load or refresh public continuation evidence before you infer gap posture.',
      tooltip: GAP_CONFIRM_TOOLTIPS['GAP-FRI-LEGACY-RAW-CAPTURE'],
      tone: 'unverified',
    };
  }
  return {
    level: 'inferred',
    inferredLabel: 'Inferred: inputs pending',
    actionText: missingSummary || 'Ask the program owner to confirm dependency, service impact, and replacement funding.',
    tooltip: confirmPaths.join(' ') || 'Contact the program owner to supply the missing inputs.',
    tone: 'inferred',
  };
}

export function enrichRunwayPresentation(item = {}, now = new Date()) {
  const base = normalizeRunwayAssessment(item);
  const remaining = item.date ? daysRemaining(item.date, now) : null;
  const evidenceDisplay = buildContinuationEvidenceDisplay(item);
  const continuationConfirmation = continuationConfirmationState(base.continuationStatus);
  const continuationAction = buildContinuationActionText(continuationConfirmation);
  const gapInference = inferGapHint({
    continuationStatus: base.continuationStatus,
    gapStatus: base.gapStatus,
    daysRemaining: remaining,
    missingInputs: base.missingInputs,
    gapRefs: base.gapRefs,
  });

  return {
    ...base,
    daysRemaining: remaining,
    evidenceDisplay,
    continuationConfirmation,
    continuationAction,
    gapInference,
    continuationStatusLabel: base.continuationStatus.replaceAll('_', ' '),
    gapStatusLabel: gapInference.inferredLabel || base.gapStatus.replaceAll('_', ' '),
  };
}

export function formatEvidenceForCsv(item = {}) {
  const display = buildContinuationEvidenceDisplay(item);
  const enriched = enrichRunwayPresentation(item);
  return {
    collectedEvidenceSummary: display.headline,
    collectedEvidenceDetail: display.lines.join(' | '),
    collectedEvidenceSource: display.sourceUri || '',
    continuationAction: enriched.continuationAction.text,
    continuationConfirmHow: enriched.continuationConfirmation.tooltip || '',
    inferredGapSignal: enriched.gapInference.inferredLabel || '',
    gapAction: enriched.gapInference.actionText || '',
    gapConfirmHow: enriched.gapInference.tooltip || '',
  };
}
