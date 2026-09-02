import { describe, expect, it } from 'vitest';
import {
  buildContinuationActionText,
  buildContinuationEvidenceDisplay,
  enrichRunwayPresentation,
  inferGapHint,
} from './runwayEvidenceDisplay.js';

describe('runwayEvidenceDisplay', () => {
  it('shows loaded transaction evidence without internal record IDs', () => {
    const display = buildContinuationEvidenceDisplay({
      awardKey: 'AWARD-1',
      continuationAssessment: { evidence: ['FRI-TXN-1', 'FRI-TXN-2'] },
      continuationEvidenceSummary: {
        observationCount: 2,
        pageCount: 1,
        latestActionDate: '2026-06-01',
        latestPublishedStatus: 'New award',
        sourceUri: 'https://www.usaspending.gov/award/AWARD-1',
      },
    });
    expect(display.loaded).toBe(true);
    expect(display.headline).toMatch(/You have 2 USAspending transaction observations loaded/i);
    expect(display.headline).not.toMatch(/FRI-TXN/);
    expect(display.confirmTooltip).toMatch(/grant manager/i);
  });

  it('uses active second-person continuation and gap action lines', () => {
    const confirmation = {
      level: 'inferred',
      inferredLabel: 'Search complete',
      tooltip: 'Confirm with grant manager.',
    };
    expect(buildContinuationActionText(confirmation).text).toMatch(/Confirm renewal with the grant manager/i);

    const hint = inferGapHint({
      continuationStatus: 'no_public_continuation_found',
      gapStatus: 'not_assessable',
      daysRemaining: 45,
      missingInputs: ['Recipient-confirmed funding dependency'],
      gapRefs: ['GAP-FRI-GRANT-ADMIN'],
    });
    expect(hint.actionText).toMatch(/Schedule an agency or recipient continuity check/i);
    expect(hint.actionText).not.toMatch(/Gap likelihood is not assessable/i);
  });

  it('enriches runway rows with action text instead of warehouse summaries', () => {
    const enriched = enrichRunwayPresentation({
      date: '2026-11-01',
      awardKey: 'AWARD-1',
      continuationAssessment: {
        status: 'no_public_continuation_found',
        summary: 'No public continuation evidence was found in the completed governed search.',
        evidence: ['FRI-TXN-1'],
      },
      gapAssessment: { status: 'not_assessable', missingInputs: ['Recipient-confirmed funding dependency'] },
      continuationEvidenceSummary: { observationCount: 1, pageCount: 1, latestActionDate: '2026-06-01' },
    }, new Date('2026-09-01T12:00:00Z'));
    expect(enriched.continuationAction.text).toMatch(/Confirm renewal/i);
    expect(enriched.gapInference.actionText).toMatch(/Schedule an agency/i);
    expect(enriched.continuationAction.text).not.toMatch(/Gap likelihood/i);
  });
});
