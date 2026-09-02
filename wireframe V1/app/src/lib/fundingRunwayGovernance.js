const REVIEWED_LABELS = new Map([
  ['HEALTH SERVICES KENTUCKY CABINET FOR', {
    displayName: 'Kentucky Cabinet for Health and Family Services',
    entityType: 'government_agency',
    authority: 'Kentucky Cabinet for Health and Family Services agency directory',
    sourceUri: 'https://www.chfs.ky.gov/',
  }],
  ['ATTORNEY GENERAL KENTUCKY OFF', {
    displayName: 'Kentucky Office of the Attorney General',
    entityType: 'government_agency',
    authority: 'Kentucky Office of the Attorney General agency site',
    sourceUri: 'https://www.ag.ky.gov/',
  }],
  ['UNIVERSITY OF KENTUCKY RESEARCH FOUNDATION, THE', {
    displayName: 'University of Kentucky Research Foundation',
    entityType: 'nonprofit',
    authority: 'University of Kentucky Research Foundation institutional page',
    sourceUri: 'https://research.uky.edu/office-sponsored-projects-administration/university-kentucky-research-foundation',
  }],
  // Florida state agencies (reviewed 2026-09-02) — mirrors the warehouse
  // registry in xenodroid-bw/src/atoms/OrganizationDisplayLabelAtoms.ts.
  ['FLORIDA AGENCY FOR HEALTH CARE ADMINISTRATION', {
    displayName: 'Florida Agency for Health Care Administration',
    entityType: 'government_agency',
    authority: 'Florida Agency for Health Care Administration agency site',
    sourceUri: 'https://ahca.myflorida.com/',
  }],
  ['FLORIDA DEPARTMENT OF CHILDREN AND FAMILIES', {
    displayName: 'Florida Department of Children and Families',
    entityType: 'government_agency',
    authority: 'Florida Department of Children and Families agency site',
    sourceUri: 'https://www.myflfamilies.com/',
  }],
  ['FLORIDA DEPARTMENT OF HEALTH', {
    displayName: 'Florida Department of Health',
    entityType: 'government_agency',
    authority: 'Florida Department of Health agency site',
    sourceUri: 'https://www.floridahealth.gov/',
  }],
]);

export const CONTINUATION_LABELS = {
  confirmed_continued: 'Continuation confirmed by a reconciled publisher record.',
  extension_pending: 'Extension or renewal application is published as pending.',
  temporary_extension: 'Temporary extension is published through the stated date.',
  successor_opportunity_identified: 'A successor opportunity is published; a continuation award is not confirmed.',
  no_public_continuation_found: 'No public continuation evidence was found in the completed governed search.',
  not_assessed: 'Public continuation evidence has not yet been fully assessed.',
  confirmed_ending: 'The owning authority explicitly confirms the award or authority is ending.',
};

export const GAP_LABELS = {
  not_assessable: 'Not assessable with the evidence currently loaded.',
  monitor: 'Monitor — current evidence does not establish a potential gap.',
  potential_gap: 'Potential gap — all required evidence predicates are present.',
  gap_mitigated: 'Potential gap is mitigated by confirmed replacement funding or an approved bridge.',
  confirmed_gap: 'Gap is confirmed by the accountable owning authority.',
};

export function resolveOrganizationLabel(rawSourceName = '') {
  const raw = String(rawSourceName).trim();
  const reviewed = REVIEWED_LABELS.get(raw.toLocaleUpperCase());
  if (!reviewed) {
    return {
      displayName: raw || 'Organization name not reported',
      rawSourceName: raw || null,
      entityType: 'unknown',
      entityTypeLabel: 'Organization type not yet verified',
      labelStatus: 'unreviewed_source_label',
      nameAuthority: 'USAspending source label',
      sourceUri: null,
    };
  }
  return {
    ...reviewed,
    rawSourceName: raw,
    entityTypeLabel: reviewed.entityType === 'government_agency' ? 'Government agency' : 'Nonprofit organization',
    labelStatus: 'reviewed_alias',
    nameAuthority: reviewed.authority,
  };
}

export function normalizeRunwayAssessment(item = {}) {
  const continuation = item.continuationAssessment || {};
  const gap = item.gapAssessment || {};
  const continuationStatus = CONTINUATION_LABELS[continuation.status] ? continuation.status : 'not_assessed';
  const gapStatus = GAP_LABELS[gap.status] ? gap.status : 'not_assessable';
  return {
    continuationStatus,
    continuationLabel: continuation.summary || CONTINUATION_LABELS[continuationStatus],
    continuationAssessedAt: continuation.assessedAt || null,
    continuationReasonCode: continuation.reasonCode || 'legacy_source_public_search_not_run',
    continuationEvidence: Array.isArray(continuation.evidence) ? continuation.evidence : [],
    gapStatus,
    gapLabel: gap.summary || GAP_LABELS[gapStatus],
    gapAssessedAt: gap.assessedAt || null,
    gapRuleVersion: gap.ruleVersion || 'FRI-GAP-v1',
    gapRefs: Array.isArray(gap.gapRefs) && gap.gapRefs.length
      ? gap.gapRefs
      : ['GAP-FRI-LEGACY-RAW-CAPTURE', 'GAP-FRI-GRANT-ADMIN', 'GAP-FRI-RUNWAY-BASIS', 'GAP-FRI-SERVICE-DEPENDENCY', 'GAP-FRI-REPLACEMENT-FUNDING'],
    missingInputs: Array.isArray(gap.missingInputs) && gap.missingInputs.length
      ? gap.missingInputs
      : ['Continuation disposition', 'Service/capacity dependency', 'Available balance and eligible burn rate', 'Replacement funding or mitigation'],
  };
}
