import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AssessPotentialFundingGap,
  ResolveContinuationDispositionFromEvidence,
} from './FundingRunwayGovernanceAtoms.js';

describe('ResolveContinuationDispositionFromEvidence', () => {
  it('keeps not_assessed when the public search has not reconciled', () => {
    const result = ResolveContinuationDispositionFromEvidence({
      publicSearchReconciled: false,
      evidenceFresh: false,
      evidenceIds: [],
      evidenceTypes: [],
    });
    assert.equal(result.status, 'not_assessed');
  });

  it('treats reconciled transaction-only evidence as no affirmative continuation', () => {
    const result = ResolveContinuationDispositionFromEvidence({
      publicSearchReconciled: true,
      evidenceFresh: true,
      evidenceIds: ['FRI-TXN-1'],
      evidenceTypes: ['award-transaction'],
    });
    assert.equal(result.status, 'no_public_continuation_found');
    assert.match(result.summary, /No public continuation evidence/i);
  });

  it('maps affirmative publisher evidence to confirmed continuation', () => {
    const result = ResolveContinuationDispositionFromEvidence({
      publicSearchReconciled: true,
      evidenceFresh: true,
      evidenceIds: ['FRI-WVR-1'],
      evidenceTypes: ['waiver-extension'],
    });
    assert.equal(result.status, 'confirmed_continued');
  });
});

describe('AssessPotentialFundingGap after reconciled search', () => {
  it('drops continuation search from missing inputs once disposition is known', () => {
    const gap = AssessPotentialFundingGap({
      daysRemaining: 45,
      continuationStatus: 'no_public_continuation_found',
      dependencyStatus: 'not_assessed',
      replacementStatus: 'not_assessed',
      serviceImpactStatus: 'not_assessed',
      publicSearchReconciled: true,
      evidenceFresh: true,
    });
    assert.equal(gap.status, 'not_assessable');
    assert.equal(gap.missingInputs.includes('Reconciled public continuation search'), false);
    assert.equal(gap.missingInputs.includes('Continuation disposition'), false);
  });
});
