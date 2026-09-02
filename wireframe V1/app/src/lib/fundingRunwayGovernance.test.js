import { describe, expect, it } from 'vitest';
import { normalizeRunwayAssessment, resolveOrganizationLabel } from './fundingRunwayGovernance.js';

describe('funding runway governance', () => {
  it('uses a reviewed display label without destroying the publisher label', () => {
    const identity = resolveOrganizationLabel('HEALTH SERVICES KENTUCKY CABINET FOR');
    expect(identity.displayName).toBe('Kentucky Cabinet for Health and Family Services');
    expect(identity.rawSourceName).toBe('HEALTH SERVICES KENTUCKY CABINET FOR');
    expect(identity.entityTypeLabel).toBe('Government agency');
    expect(identity.labelStatus).toBe('reviewed_alias');
  });

  it('does not heuristically rewrite an unreviewed legal name', () => {
    const identity = resolveOrganizationLabel('TRIAD HEALTH SYSYEMS INC');
    expect(identity.displayName).toBe('TRIAD HEALTH SYSYEMS INC');
    expect(identity.labelStatus).toBe('unreviewed_source_label');
  });

  it('defaults to honest missing-evidence states rather than inferring a lapse', () => {
    const assessment = normalizeRunwayAssessment({});
    expect(assessment.continuationStatus).toBe('not_assessed');
    expect(assessment.gapStatus).toBe('not_assessable');
    expect(assessment.missingInputs).toHaveLength(4);
  });

  it('preserves a governed completed public search without claiming non-continuation', () => {
    const assessment = normalizeRunwayAssessment({
      continuationAssessment: { status: 'no_public_continuation_found', assessedAt: '2026-09-01' },
    });
    expect(assessment.continuationLabel).toMatch(/No public continuation evidence/i);
    expect(assessment.continuationLabel).not.toMatch(/no extension exists/i);
  });
});

