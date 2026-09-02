import { Sha256 } from '../adapters/operationalPublicSources.js';

type ReviewedLabel = {
  displayText: string;
  entityType: 'government_agency' | 'nonprofit';
  authorityRef: string;
  sourceUri: string;
  verifiedAt: string;
};

const REVIEWED_LABELS = new Map<string, ReviewedLabel>([
  ['HEALTH SERVICES KENTUCKY CABINET FOR', {
    displayText: 'Kentucky Cabinet for Health and Family Services',
    entityType: 'government_agency',
    authorityRef: 'Kentucky Cabinet for Health and Family Services agency directory',
    sourceUri: 'https://www.chfs.ky.gov/',
    verifiedAt: '2026-09-01T00:00:00Z',
  }],
  ['ATTORNEY GENERAL KENTUCKY OFF', {
    displayText: 'Kentucky Office of the Attorney General',
    entityType: 'government_agency',
    authorityRef: 'Kentucky Office of the Attorney General agency site',
    sourceUri: 'https://www.ag.ky.gov/',
    verifiedAt: '2026-09-01T00:00:00Z',
  }],
  ['UNIVERSITY OF KENTUCKY RESEARCH FOUNDATION, THE', {
    displayText: 'University of Kentucky Research Foundation',
    entityType: 'nonprofit',
    authorityRef: 'University of Kentucky Research Foundation institutional page',
    sourceUri: 'https://research.uky.edu/office-sponsored-projects-administration/university-kentucky-research-foundation',
    verifiedAt: '2026-09-01T00:00:00Z',
  }],
  // Florida state agencies (reviewed 2026-09-02). USAspending already carries
  // the agency's legal name; the alias supplies entity type and authority
  // so the runway can label the recipient as a government agency instead of
  // "Organization type not yet verified". Raw label is retained unchanged.
  ['FLORIDA AGENCY FOR HEALTH CARE ADMINISTRATION', {
    displayText: 'Florida Agency for Health Care Administration',
    entityType: 'government_agency',
    authorityRef: 'Florida Agency for Health Care Administration agency site',
    sourceUri: 'https://ahca.myflorida.com/',
    verifiedAt: '2026-09-02T00:00:00Z',
  }],
  ['FLORIDA DEPARTMENT OF CHILDREN AND FAMILIES', {
    displayText: 'Florida Department of Children and Families',
    entityType: 'government_agency',
    authorityRef: 'Florida Department of Children and Families agency site',
    sourceUri: 'https://www.myflfamilies.com/',
    verifiedAt: '2026-09-02T00:00:00Z',
  }],
  ['FLORIDA DEPARTMENT OF HEALTH', {
    displayText: 'Florida Department of Health',
    entityType: 'government_agency',
    authorityRef: 'Florida Department of Health agency site',
    sourceUri: 'https://www.floridahealth.gov/',
    verifiedAt: '2026-09-02T00:00:00Z',
  }],
]);

export function SourceIdentityId(input: { awardKey: string; recipientUei?: string; recipientId?: string }) {
  if (input.recipientUei) return `USA_SPENDING:UEI:${input.recipientUei}`;
  if (input.recipientId) return `USA_SPENDING:RECIPIENT:${input.recipientId}`;
  return `USA_SPENDING:AWARD:${input.awardKey}`;
}

/** Business Rule: ResolveOrganizationDisplayLabel. Never changes match keys. */
export function ResolveOrganizationDisplayLabel(rawName: string, sourceIdentityId: string) {
  const rawText = rawName.trim();
  const reviewed = REVIEWED_LABELS.get(rawText.toLocaleUpperCase());
  const sourceHash = Sha256(Buffer.from(JSON.stringify({ sourceIdentityId, rawText }), 'utf8'));
  return reviewed ? {
    sourceIdentityId,
    displayText: reviewed.displayText,
    rawText,
    entityType: reviewed.entityType,
    method: 'official-alias' as const,
    authorityRef: reviewed.authorityRef,
    sourceUri: reviewed.sourceUri,
    confidence: 1,
    reviewStatus: 'reviewed' as const,
    verifiedAt: reviewed.verifiedAt,
    contentHash: sourceHash,
  } : {
    sourceIdentityId,
    displayText: rawText || 'Organization name not reported',
    rawText,
    entityType: 'unknown' as const,
    method: 'unreviewed-source-label' as const,
    authorityRef: 'USAspending source label; legacy transformed provenance',
    sourceUri: 'https://www.usaspending.gov/',
    confidence: 1,
    reviewStatus: 'unreviewed' as const,
    verifiedAt: null,
    contentHash: sourceHash,
  };
}

