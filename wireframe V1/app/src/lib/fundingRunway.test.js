import { describe, expect, it } from 'vitest';
import { buildFundingRunway, daysRemaining, formatDaysRemaining } from './fundingRunway.js';

const NOW = new Date('2026-09-01T12:00:00Z');

describe('funding runway projection', () => {
  it('sorts published deadlines soonest first and calculates calendar days remaining', () => {
    const runway = buildFundingRunway([
      { id: 'later', type: 'award-cliff', date: '2026-12-31', urgencyRank: 1, title: 'Later' },
      { id: 'soon', type: 'award-cliff', date: '2026-09-30', urgencyRank: 1, title: 'Soon' },
      { id: 'document', type: 'horizon-waiver', date: '2026-08-30', urgencyRank: null, title: 'Posted document' },
    ], NOW);
    expect(runway.items.map((item) => item.id)).toEqual(['soon', 'later']);
    expect(runway.items[0].daysRemaining).toBe(29);
    expect(runway.informationalCount).toBe(1);
    expect(runway.summary.dueWithin30).toBe(1);
  });

  it('surfaces collected evidence and inferred signals when public search completed', () => {
    const runway = buildFundingRunway([
      {
        id: 'award',
        type: 'award-cliff',
        date: '2026-09-29',
        urgencyRank: 28,
        title: 'Award',
        continuationAssessment: {
          status: 'no_public_continuation_found',
          summary: 'No public continuation evidence was found in the completed governed search.',
          evidence: ['FRI-TXN-1'],
        },
        gapAssessment: { status: 'not_assessable', missingInputs: ['Recipient-confirmed funding dependency'] },
        continuationEvidenceSummary: { observationCount: 1, pageCount: 1, latestActionDate: '2026-06-01' },
      },
    ], NOW);
    expect(runway.items[0].evidenceDisplay.loaded).toBe(true);
    expect(runway.items[0].gapInference.inferredLabel).toMatch(/inferred/i);
    expect(runway.summary.publicEvidenceLoaded).toBe(1);
    expect(runway.summary.inferredGapSignals).toBe(1);
  });

  it('formats days without implying a forecast', () => {
    expect(daysRemaining('2026-09-01', NOW)).toBe(0);
    expect(formatDaysRemaining(0)).toBe('Ends today');
    expect(formatDaysRemaining(28)).toBe('28 days left');
  });
});
