export type ContinuationStatus =
  | 'confirmed_continued' | 'extension_pending' | 'temporary_extension'
  | 'successor_opportunity_identified' | 'no_public_continuation_found'
  | 'not_assessed' | 'confirmed_ending' | 'conflicting' | 'stale';

export type GapStatus = 'not_assessable' | 'monitor' | 'potential_gap' | 'gap_mitigated' | 'confirmed_gap';

export type GapInputs = {
  daysRemaining: number | null;
  continuationStatus: ContinuationStatus;
  dependencyStatus: 'not_assessed' | 'tracked_sources_only' | 'recipient_confirmed';
  replacementStatus: 'not_assessed' | 'none_publicly_identified' | 'candidate_identified' | 'confirmed';
  serviceImpactStatus: 'not_assessed' | 'documented';
  publicSearchReconciled: boolean;
  evidenceFresh: boolean;
  actionWindowDays?: number;
  expiredGraceDays?: number;
  accountableConfirmation?: 'confirmed_gap' | 'gap_mitigated' | null;
};

export const FUNDING_GAP_RULE_VERSION = 'FRI-GAP-v1';

export type ContinuationEvidenceSnapshot = {
  publicSearchReconciled: boolean;
  evidenceFresh: boolean;
  evidenceIds: string[];
  evidenceTypes: string[];
};

const AFFIRMATIVE_CONTINUATION_TYPES = new Set([
  'taggs-action', 'waiver-extension', 'waiver-approval',
]);
const PENDING_CONTINUATION_TYPES = new Set(['waiver-application']);
const SUCCESSOR_CONTINUATION_TYPES = new Set(['successor-opportunity']);

export function DaysRemainingFromEndDate(periodEnd: string | null, now = new Date()): number | null {
  if (!periodEnd) return null;
  const deadline = new Date(`${periodEnd}T00:00:00Z`).getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (Number.isNaN(deadline)) return null;
  return Math.ceil((deadline - today) / (24 * 60 * 60 * 1000));
}

export function IsContinuationEvidenceFresh(lastObservedAt: string | null, now = new Date(), maxAgeDays = 30): boolean {
  if (!lastObservedAt) return false;
  const observed = new Date(lastObservedAt).getTime();
  if (Number.isNaN(observed)) return false;
  return now.getTime() - observed <= maxAgeDays * 24 * 60 * 60 * 1000;
}

/**
 * Business Rule: ResolveContinuationDispositionFromEvidence
 * USAspending transaction pages prove the governed search ran; they never
 * alone establish confirmed continuation.
 */
export function ResolveContinuationDispositionFromEvidence(
  snapshot: ContinuationEvidenceSnapshot,
): { status: ContinuationStatus; reasonCode: string; summary: string } {
  if (!snapshot.publicSearchReconciled) {
    return {
      status: 'not_assessed',
      reasonCode: 'public_continuation_search_not_reconciled',
      summary: 'Public continuation evidence has not yet been fully assessed.',
    };
  }
  if (!snapshot.evidenceFresh) {
    return {
      status: 'stale',
      reasonCode: 'continuation_evidence_stale',
      summary: 'Public continuation evidence is stale; refresh before relying on this disposition.',
    };
  }
  const types = new Set(snapshot.evidenceTypes);
  if (types.has('official-ending-notice')) {
    return {
      status: 'confirmed_ending',
      reasonCode: 'official_ending_notice_published',
      summary: 'An owning authority explicitly published an ending notice in the reconciled public record.',
    };
  }
  if ([...AFFIRMATIVE_CONTINUATION_TYPES].some((type) => types.has(type))) {
    return {
      status: 'confirmed_continued',
      reasonCode: 'affirmative_continuation_evidence_published',
      summary: 'Affirmative continuation evidence was found in the reconciled public search.',
    };
  }
  if ([...PENDING_CONTINUATION_TYPES].some((type) => types.has(type))) {
    return {
      status: 'extension_pending',
      reasonCode: 'extension_application_published',
      summary: 'Extension or renewal application is published as pending.',
    };
  }
  if ([...SUCCESSOR_CONTINUATION_TYPES].some((type) => types.has(type))) {
    return {
      status: 'successor_opportunity_identified',
      reasonCode: 'successor_opportunity_published',
      summary: 'A successor opportunity is published; a continuation award is not confirmed.',
    };
  }
  return {
    status: 'no_public_continuation_found',
    reasonCode: 'public_search_reconciled_no_affirmative_continuation',
    summary: 'No public continuation evidence was found in the completed governed search.',
  };
}

export function GapRefsForContinuationSnapshot(publicSearchReconciled: boolean): string[] {
  const refs = [
    'GAP-FRI-GRANT-ADMIN', 'GAP-FRI-RUNWAY-BASIS', 'GAP-FRI-SERVICE-DEPENDENCY', 'GAP-FRI-REPLACEMENT-FUNDING',
  ];
  return publicSearchReconciled ? refs : ['GAP-FRI-LEGACY-RAW-CAPTURE', ...refs];
}

/**
 * Business Rule: AssessPotentialFundingGap
 * A published end date is never sufficient. Potential-gap requires a near
 * deadline plus unresolved/noncontinuing public evidence, recipient-confirmed
 * dependency, documented service impact, and no confirmed replacement.
 */
export function AssessPotentialFundingGap(input: GapInputs): { status: GapStatus; missingInputs: string[] } {
  if (input.accountableConfirmation === 'confirmed_gap') return { status: 'confirmed_gap', missingInputs: [] };
  if (input.accountableConfirmation === 'gap_mitigated' || input.replacementStatus === 'confirmed') {
    return { status: 'gap_mitigated', missingInputs: [] };
  }

  const missingInputs: string[] = [];
  if (!input.publicSearchReconciled) missingInputs.push('Reconciled public continuation search');
  if (!input.evidenceFresh) missingInputs.push('Fresh continuation evidence');
  if (['not_assessed', 'conflicting', 'stale'].includes(input.continuationStatus)) missingInputs.push('Continuation disposition');
  if (input.dependencyStatus !== 'recipient_confirmed') missingInputs.push('Recipient-confirmed funding dependency');
  if (input.serviceImpactStatus !== 'documented') missingInputs.push('Documented service or capacity impact');
  if (input.replacementStatus === 'not_assessed') missingInputs.push('Completed replacement-funding assessment');
  if (input.daysRemaining == null) missingInputs.push('Published end date');

  if (missingInputs.length) return { status: 'not_assessable', missingInputs };
  if (input.continuationStatus === 'confirmed_continued') return { status: 'monitor', missingInputs: [] };
  if (['extension_pending', 'temporary_extension', 'successor_opportunity_identified'].includes(input.continuationStatus)) {
    return { status: 'monitor', missingInputs: [] };
  }
  if (input.replacementStatus === 'candidate_identified') return { status: 'monitor', missingInputs: [] };

  const actionWindowDays = input.actionWindowDays ?? 180;
  const expiredGraceDays = input.expiredGraceDays ?? 90;
  const insideWindow = input.daysRemaining! >= -expiredGraceDays && input.daysRemaining! <= actionWindowDays;
  if (!insideWindow) return { status: 'monitor', missingInputs: [] };
  return ['no_public_continuation_found', 'confirmed_ending'].includes(input.continuationStatus)
    ? { status: 'potential_gap', missingInputs: [] }
    : { status: 'monitor', missingInputs: [] };
}

export function EstimatedRunoutDate(
  assessmentDate: string,
  availableBalance: number | null,
  averageEligibleDailySpend: number | null,
): string | null {
  if (availableBalance == null || averageEligibleDailySpend == null || averageEligibleDailySpend <= 0) return null;
  const start = new Date(`${assessmentDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  start.setUTCDate(start.getUTCDate() + Math.floor(Math.max(0, availableBalance) / averageEligibleDailySpend));
  return start.toISOString().slice(0, 10);
}
