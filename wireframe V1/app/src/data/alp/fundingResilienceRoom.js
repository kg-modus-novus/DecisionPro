/**
 * OFR-08: Funding & Resilience Evidence Room — state-neutral (KY + FL)
 * aggregation layer over the seven OFR-01..07 BW exports. Hand-written
 * (like operationalGoals.js), not BW-generated: it re-shapes already
 * gate-reconciled, already state-keyed export data into one unified,
 * filterable evidence-item list for the Evidence Room UI. It introduces no
 * new facts and computes no new figures — every field here is copied
 * through from an OFR export that has already passed its own Source
 * Reconciliation check.
 *
 * Identity-confidence discipline (OFR-02 gate): exact and inferred
 * crosswalk assertions are kept as two distinct item types below and an
 * inferred item always carries reviewCandidateOnly: true — never merged
 * or presented as equally confirmed.
 */
import { FEDERAL_AWARD_GRAIN } from './federalAwardGrain.js';
import { ORGANIZATION_CROSSWALK } from './organizationCrosswalk.js';
import { NONPROFIT_FINANCIALS } from './nonprofitFinancials.js';
import { FACILITY_FINANCIAL_DISTRESS } from './facilityFinancialDistress.js';
import { OWNERSHIP_NETWORK } from './ownershipNetwork.js';
import { SUBAWARD_FLOW_GRAPH } from './subawardFlowGraph.js';
import { PROGRAM_HORIZON_EVENTS } from './programHorizonEvents.js';
import { AUTHORITATIVE_SOURCES } from './authoritativeSources.js';
import { normalizeRunwayAssessment, resolveOrganizationLabel } from '../../lib/fundingRunwayGovernance.js';
import { formatEvidenceForCsv } from '../../lib/runwayEvidenceDisplay.js';

export const FUNDING_RESILIENCE_SOURCE_IDS = [
  'USA_SPENDING',
  'SAM_ENTITY',
  'IRS_EO_BMF',
  'NPPES',
  'IRS_990_EXTRACT',
  'CMS_HCRIS',
  'CMS_OWNERSHIP',
  'CMS_1115_DEMO',
  'GRANTS_GOV',
];

export const FUNDING_RESILIENCE_TYPES = [
  { id: 'award-cliff', label: 'Federal award expiration', packageId: 'OFR-01', sourceSystem: 'USA_SPENDING' },
  { id: 'single-stream', label: 'Single-stream funding dependency', packageId: 'OFR-01', sourceSystem: 'USA_SPENDING' },
  { id: 'identity-exact', label: 'Identity crosswalk (exact)', packageId: 'OFR-02', sourceSystem: 'SAM_ENTITY' },
  { id: 'identity-inferred', label: 'Identity crosswalk (inferred — review candidate)', packageId: 'OFR-02', sourceSystem: 'SAM_ENTITY' },
  { id: 'nonprofit-liquidity', label: 'Nonprofit financial-resilience signal', packageId: 'OFR-03', sourceSystem: 'IRS_990_EXTRACT' },
  { id: 'facility-distress', label: 'Facility financial-distress signal', packageId: 'OFR-04', sourceSystem: 'CMS_HCRIS' },
  { id: 'ownership-chain', label: 'Common-ownership chain', packageId: 'OFR-05', sourceSystem: 'CMS_OWNERSHIP' },
  { id: 'subaward-edge', label: 'Sub-award funding edge', packageId: 'OFR-06', sourceSystem: 'USA_SPENDING' },
  { id: 'horizon-waiver', label: 'Waiver / demonstration horizon event', packageId: 'OFR-07', sourceSystem: 'CMS_1115_DEMO' },
  { id: 'horizon-nofo', label: 'Open federal grant opportunity', packageId: 'OFR-07', sourceSystem: 'GRANTS_GOV' },
];

export const FUNDING_RESILIENCE_PLAYBOOKS = {
  'award-cliff': {
    goal: 'Prevent an avoidable interruption when a tracked federal award approaches its published end date.',
    lookFor: 'Start with awards ending in 0–6 months, then distinguish a routine renewal from a genuinely unresolved continuity risk.',
    steps: ['Open the award row and confirm its award ID and published end date.', 'Verify renewal status with the awarding agency or recipient.', 'Record renewed, lapse-risk, or unresolved status in the owning review record.'],
    useResult: 'Escalate only unresolved awards into continuity planning; do not treat an expiration date as a predicted lapse.',
    successMeasure: '100% of near-term expirations have an accountable owner and confirmed renewal status.',
  },
  'single-stream': {
    goal: 'Avoid destabilizing a recipient during a funding-policy change.',
    lookFor: 'Recipients whose OFR-visible awards all fall under one tracked assistance listing; this does not describe their full funding picture.',
    steps: ['Open the recipient row and note its tracked program and award total.', 'Confirm other funding streams using authorized recipient or grants records.', 'Open continuity planning only when alternate funding cannot be confirmed.'],
    useResult: 'Use the signal to prioritize validation before a policy change, never as a distress score.',
    successMeasure: '100% of affected single-stream candidates are validated before the relevant funding change.',
  },
  'identity-exact': {
    goal: 'Join evidence to the correct organization without losing identifier provenance.',
    lookFor: 'The two published or derived identifiers, confidence, and evidence supporting the exact link.',
    steps: ['Confirm both identifiers in their source systems.', 'Use the linked identifiers to search the other evidence types.', 'Record any source disagreement for resolution rather than silently merging it.'],
    useResult: 'Use an exact link for governed cross-source review, while keeping enrollment and ownership claims separate.',
    successMeasure: 'Every reused link retains its identifiers, confidence label, and source evidence.',
  },
  'identity-inferred': {
    goal: 'Resolve a possible organization match before it influences a decision.',
    lookFor: 'Name or address similarity and the reason the match did not qualify as exact.',
    steps: ['Compare authoritative identifiers in SAM, NPPES, IRS, or USAspending.', 'Confirm or reject the match with a documented basis.', 'Use downstream evidence only after the review status is recorded.'],
    useResult: 'Promote a match only after human validation; otherwise keep the records separate.',
    successMeasure: '100% of inferred links used downstream have a recorded confirm or reject decision.',
  },
  'nonprofit-liquidity': {
    goal: 'Identify organizations that may merit continuity-planning review before a contract or funding change.',
    lookFor: 'Low liquidity across more than one filing period, an unstable expense denominator, and overlap with award expirations.',
    steps: ['Verify the filing period and financial values against the Form 990 extract.', 'Cross-reference award-cliff and identity evidence for the same organization.', 'Record no-action or continuity-plan-opened status with the reviewer.'],
    useResult: 'Use the ratio as a triage prompt, not a diagnosis of distress or mismanagement.',
    successMeasure: 'All low-liquidity candidates receive a documented review disposition and false-flag reason where applicable.',
  },
  'facility-distress': {
    goal: 'Protect access to care by reviewing possible facility continuity concerns early.',
    lookFor: 'Repeated negative margins, high Medicaid exposure, and corroborating licensure, quality, or network-adequacy context.',
    steps: ['Confirm the cost-report year and margin calculation.', 'Cross-reference current participation and access context.', 'Record no-action or continuity-plan-opened status; monitor repeated signals over time.'],
    useResult: 'Prioritize continuity review without predicting closure or asserting financial distress.',
    successMeasure: 'Every routed facility-year has a review outcome, and repeated false flags are measured.',
  },
  'ownership-chain': {
    goal: 'Review related facilities in chain context instead of treating each facility signal in isolation.',
    lookFor: 'Large portfolios, repeated financial or quality signals across commonly owned facilities, and recent ownership associations.',
    steps: ['Select a chain in the relationship graph or list.', 'Cross-reference its loaded facility portfolio against financial, quality, and participation evidence.', 'Record chain reviewed, no-action, or focused facility follow-up status.'],
    useResult: 'Use common ownership to organize review, never as evidence of quality failure or improper conduct.',
    successMeasure: '100% of prioritized chains have a recorded contextual review and any facility follow-ups have owners.',
  },
  'subaward-edge': {
    goal: 'Understand how tracked federal funds move from prime recipients to sub-recipients before evaluating concentration or overlap.',
    lookFor: 'High-dollar edges, recipients appearing under multiple programs, and whether identity is exact-derived or unresolved.',
    steps: ['Use the relationship graph to select a prime-to-sub-recipient edge.', 'Confirm the award, assistance listing, amount, and identity-confidence label.', 'Reconcile program scope before describing any overlap as duplicative.'],
    useResult: 'Route high-concentration or multi-program recipients to coordination review, not an adverse finding.',
    successMeasure: 'All prioritized edges are identity-labeled and all program-overlap candidates have a scope reconciliation.',
  },
  'horizon-waiver': {
    goal: 'Start renewal or deliverable work early enough to protect program continuity and compliance timeliness.',
    lookFor: 'Published expiration dates, recently posted deliverables, and the applicable Special Terms and Conditions milestone.',
    steps: ['Open the cited CMS source document.', 'Confirm the current deadline and requirement with CMS.', 'Assign the renewal or deliverable review and record its status.'],
    useResult: 'Use published dates to schedule work; do not portray them as predicted lapses or violations.',
    successMeasure: 'Every tracked authority and deliverable has a confirmed owner, deadline, and current status.',
  },
  'horizon-nofo': {
    goal: 'Avoid missing an eligible federal funding opportunity.',
    lookFor: 'Open or forecasted opportunities whose purpose and eligibility align with a documented program need.',
    steps: ['Open the cited Grants.gov opportunity.', 'Confirm eligibility, close date, cost share, and fit with the program need.', 'Record pursue, decline, or not-eligible status and assign next work if pursuing.'],
    useResult: 'Use the list to make an accountable pursuit decision, never to imply funding is secured.',
    successMeasure: '100% of relevant open opportunities receive a pursue, decline, or not-eligible decision before close.',
  },
};

const typeMeta = Object.fromEntries(FUNDING_RESILIENCE_TYPES.map((t) => [t.id, t]));
const sourceById = Object.fromEntries((AUTHORITATIVE_SOURCES.sources || []).map((s) => [s.fromSysId, s]));

function money(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Lower = more worth attention first when sorted ascending. Only set where a
 * genuine "how urgent/severe is this" comparison is meaningful for the type:
 * days until a real deadline (award/waiver expiration, grant close date), or
 * a severity ratio already lower-is-worse (liquidity months, margin). Left
 * null for types with no such dimension (identity, ownership, sub-award,
 * milestone/open-date informational rows) — those rely on search instead.
 */
function daysFromNow(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return ms / (1000 * 60 * 60 * 24);
}

function singleStreamRecipients(award) {
  if (award?.singleStreamDependency?.recipients?.length) return award.singleStreamDependency.recipients;
  const grouped = new Map();
  for (const row of award?.awards || []) {
    const key = row.recipientUei || String(row.recipientName || '').trim().toLocaleUpperCase();
    if (!key) continue;
    const current = grouped.get(key) || {
      recipientName: row.recipientName,
      recipientUei: row.recipientUei || null,
      assistanceListings: new Set(),
      awardCount: 0,
      totalAmount: 0,
      earliestEnd: null,
    };
    current.assistanceListings.add(row.assistanceListing);
    current.awardCount += 1;
    current.totalAmount += Number(row.awardAmount || 0);
    if (row.periodEnd && (!current.earliestEnd || row.periodEnd < current.earliestEnd)) current.earliestEnd = row.periodEnd;
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .filter((row) => row.assistanceListings.size === 1)
    .map((row) => ({ ...row, assistanceListing: [...row.assistanceListings][0], assistanceListings: undefined }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

function buildStateItems(state) {
  const items = [];
  let seq = 0;
  const nextId = (prefix) => `${prefix}-${state}-${seq++}`;

  // OFR-01: awards inside the 0-6 / 6-12 month cliff window + single-stream dependency.
  const award = FEDERAL_AWARD_GRAIN.byState[state];
  if (award) {
    for (const a of award.awards || []) {
      if (a.periodEnd == null) continue;
      const monthsUntil = (new Date(a.periodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44);
      if (monthsUntil < 0 || monthsUntil > 12) continue;
      const fallbackIdentity = resolveOrganizationLabel(a.recipientName);
      const identity = a.organizationIdentity ? {
        displayName: a.organizationIdentity.displayName,
        rawSourceName: a.organizationIdentity.rawSourceName,
        entityType: a.organizationIdentity.entityType,
        entityTypeLabel: a.organizationIdentity.entityType === 'government_agency'
          ? 'Government agency'
          : a.organizationIdentity.entityType === 'nonprofit' ? 'Nonprofit organization' : 'Organization type not yet verified',
        labelStatus: a.organizationIdentity.reviewStatus,
        nameAuthority: a.organizationIdentity.authority,
        sourceUri: a.organizationIdentity.authorityUri,
      } : fallbackIdentity;
      const assessment = normalizeRunwayAssessment(a);
      items.push({
        id: nextId('award'), type: 'award-cliff', state,
        title: `${identity.displayName} — ${a.assistanceListing}`,
        organizationName: identity.displayName,
        rawSourceName: identity.rawSourceName,
        entityType: identity.entityType,
        entityTypeLabel: identity.entityTypeLabel,
        identityLabelStatus: identity.labelStatus,
        nameAuthority: identity.nameAuthority,
        nameSourceUri: identity.sourceUri,
        awardId: a.awardId,
        awardKey: a.awardKey,
        assistanceListing: a.assistanceListing,
        awardAmount: a.awardAmount,
        recipientUei: a.recipientUei || null,
        continuationEvidenceSummary: a.continuationEvidenceSummary || null,
        metricLabel: 'Award amount', metricValue: money(a.awardAmount),
        date: a.periodEnd, dateLabel: `Period of performance ends ${a.periodEnd}`,
        status: 'review candidate',
        detail: `${a.awardingAgency || 'Federal awarding agency'} · Award ${a.awardId}${a.recipientUei ? ` · UEI ${a.recipientUei}` : ''}`,
        guardrail: 'A listed expiration is a renewal-review prompt, not a predicted funding lapse.',
        urgencyRank: daysFromNow(a.periodEnd),
        continuationAssessment: {
          status: assessment.continuationStatus,
          summary: assessment.continuationLabel,
          assessedAt: assessment.continuationAssessedAt,
          reasonCode: assessment.continuationReasonCode,
          evidence: assessment.continuationEvidence,
          gapRefs: assessment.gapRefs,
        },
        gapAssessment: {
          status: assessment.gapStatus,
          summary: assessment.gapLabel,
          assessedAt: assessment.gapAssessedAt,
          ruleVersion: assessment.gapRuleVersion,
          missingInputs: assessment.missingInputs,
          gapRefs: assessment.gapRefs,
        },
      });
    }
    for (const r of singleStreamRecipients(award)) {
      const identity = resolveOrganizationLabel(r.recipientName);
      items.push({
        id: nextId('single-stream'), type: 'single-stream', state,
        title: identity.displayName,
        organizationName: identity.displayName,
        rawSourceName: identity.rawSourceName,
        entityType: identity.entityType,
        entityTypeLabel: identity.entityTypeLabel,
        identityLabelStatus: identity.labelStatus,
        nameAuthority: identity.nameAuthority,
        nameSourceUri: identity.sourceUri,
        metricLabel: 'Tracked award amount', metricValue: money(r.totalAmount),
        date: r.earliestEnd, dateLabel: r.earliestEnd ? `Earliest tracked award end ${r.earliestEnd}` : 'No published end date',
        status: 'review candidate',
        detail: `${r.assistanceListing} · ${r.awardCount} tracked award${r.awardCount === 1 ? '' : 's'}${r.recipientUei ? ` · UEI ${r.recipientUei}` : ''}`,
        guardrail: 'Single-stream status covers only the OFR-tracked assistance listings and is never evidence of distress or a complete funding profile.',
        urgencyRank: daysFromNow(r.earliestEnd),
      });
    }
  }

  // OFR-02: identity crosswalk — exact and inferred kept as distinct item types.
  const crosswalk = ORGANIZATION_CROSSWALK.byState[state];
  if (crosswalk) {
    for (const r of (crosswalk.exactAssertions || []).slice(0, 25)) {
      items.push({
        id: nextId('xw-exact'), type: 'identity-exact', state,
        title: `${r.left?.type || ''} ${r.left?.value || ''} ↔ ${r.right?.type || ''} ${r.right?.value || ''}`,
        metricLabel: 'Confidence', metricValue: `${(Number(r.confidence) * 100).toFixed(0)}%`,
        date: null, dateLabel: 'No date dimension for this assertion',
        status: 'exact-published/derived',
        detail: r.evidence || 'Exact identifier match.',
        guardrail: 'An exact assertion is a matched identifier pair, not a confirmed provider-enrollment or ownership relationship.',
      });
    }
    for (const r of (crosswalk.inferredAssertions || []).slice(0, 25)) {
      items.push({
        id: nextId('xw-inferred'), type: 'identity-inferred', state,
        title: `${r.left?.type || ''} ${r.left?.value || ''} ↔ ${r.right?.type || ''} ${r.right?.value || ''}`,
        metricLabel: 'Confidence', metricValue: `${(Number(r.confidence) * 100).toFixed(0)}%`,
        date: null, dateLabel: 'No date dimension for this assertion',
        status: 'inferred — review candidate only',
        detail: r.evidence || 'Name/address similarity match.',
        guardrail: 'Never presented as a confirmed identity. Requires human review before any downstream use.',
        reviewCandidateOnly: true,
      });
    }
  }

  // OFR-03: nonprofit financial-resilience signals. The relevance-gated list
  // (organizations that reach the depot through an exact crosswalk link or an
  // identity-resolved sub-award edge) is used when the export carries it; the
  // unfiltered lowest-liquidity list remains the fallback.
  const nonprofit = NONPROFIT_FINANCIALS.byState[state];
  if (nonprofit) {
    const depotLinked = nonprofit.depotLinkedCandidates?.organizations || [];
    const source = depotLinked.length ? depotLinked : (nonprofit.reviewCandidates?.lowestLiquidity || []);
    for (const f of source) {
      const ratioNeedsDenominatorReview = f.liquidityMonths != null && Math.abs(f.liquidityMonths) > 120;
      const links = f.depotLinks?.length ? ` · Depot links: ${f.depotLinks.join('; ')}` : '';
      const prior = f.priorPeriodLiquidityMonths != null ? ` · Prior period ${f.priorPeriodLiquidityMonths.toFixed(1)} months` : '';
      items.push({
        id: nextId('nonprofit'), type: 'nonprofit-liquidity', state,
        title: f.orgName || `EIN ${f.ein}`,
        ein: f.ein,
        metricLabel: 'Liquidity (months)', metricValue: f.liquidityMonths == null ? '—' : f.liquidityMonths.toFixed(1),
        date: null, dateLabel: `Tax period ${f.taxPeriod} (extract vintage ${f.extractVintage})`,
        status: 'review candidate',
        detail: `Total revenue ${money(f.totalRevenue)} · Total expenses ${money(f.totalExpenses)}${prior}${links}`,
        guardrail: 'A single low-liquidity period is not evidence of distress; never a finding.',
        urgencyRank: f.liquidityMonths == null ? null : f.liquidityMonths,
        depotLinks: f.depotLinks || [],
        lowLiquidityBothPeriods: Boolean(f.lowLiquidityBothPeriods),
        dataQualityNote: ratioNeedsDenominatorReview
          ? 'Extreme ratio (more than 120 months in magnitude): verify the Form 990 net-asset value and expense denominator before comparing this row with other organizations.'
          : null,
      });
    }
  }

  // OFR-04: negative-margin facility-years.
  const facility = FACILITY_FINANCIAL_DISTRESS.byState[state];
  if (facility) {
    for (const f of facility.negativeMarginWatchlist?.facilities || []) {
      const provider = f.providerContext || null;
      const providerDetail = provider
        ? `${provider.overallRating != null ? ` · CMS overall rating ${provider.overallRating} star${provider.overallRating === 1 ? '' : 's'}` : ''}${provider.certifiedBeds != null ? ` · ${provider.certifiedBeds} certified beds` : ''}${provider.totalFines ? ` · published fines ${money(provider.totalFines)}` : ''}`
        : '';
      items.push({
        id: nextId('facility'), type: 'facility-distress', state,
        title: f.facilityName || `CCN ${f.ccn}`,
        ccn: f.ccn,
        metricLabel: 'Total margin', metricValue: f.totalMargin == null ? '—' : `${(f.totalMargin * 100).toFixed(1)}%`,
        date: null, dateLabel: `Report year ${f.reportYear}`,
        status: 'review candidate',
        detail: `${f.facilityType || 'Facility'} · ${f.county || 'County not reported'}${f.medicaidDayShare != null ? ` · Medicaid day share ${(f.medicaidDayShare * 100).toFixed(1)}%` : ''}${providerDetail}`,
        guardrail: 'A negative margin is a review prompt only, never a closure prediction or distress finding.',
        urgencyRank: f.totalMargin == null ? null : f.totalMargin * 100,
        providerContext: provider,
      });
    }
  }

  // OFR-05: common-ownership chains.
  const ownership = OWNERSHIP_NETWORK.byState[state];
  if (ownership) {
    for (const c of ownership.ownershipChains?.chains || []) {
      items.push({
        id: nextId('chain'), type: 'ownership-chain', state,
        title: c.ownerOrganizationName,
        metricLabel: 'Facilities controlled', metricValue: String(c.facilityCount),
        date: null, dateLabel: 'Snapshot per most recent CMS ownership PUF',
        status: 'review candidate',
        detail: `${c.totalBeds != null ? `${c.totalBeds.toLocaleString()} total beds` : 'Bed count not available'}${c.avgTotalMargin != null ? ` · avg margin ${(c.avgTotalMargin * 100).toFixed(1)}%` : ''}${c.qualityContext?.ratedFacilityCount ? ` · ${c.qualityContext.lowRatedFacilityCount} of ${c.qualityContext.ratedFacilityCount} rated facilities at 1–2 stars · published fines ${money(c.qualityContext.publishedFineAmount)}` : ''}`,
        guardrail: 'Common ownership is never itself a finding of anticompetitive conduct or quality failure.',
        sourceNode: c.ownerOrganizationName,
        targetNode: `${c.facilityCount} matched ${state} facilities`,
        relationshipValue: c.facilityCount,
        relationshipMembers: c.facilities || [],
        qualityContext: c.qualityContext || null,
        chainSource: 'CMS_OWNERSHIP',
      });
    }
    // CMS Care Compare's own chain grouping (chain_id). A label is present
    // only when the publisher's chain name is an organization; otherwise the
    // chain is identified by its CMS id and the label is withheld.
    for (const c of ownership.cmsChains?.chains || []) {
      items.push({
        id: nextId('cms-chain'), type: 'ownership-chain', state,
        title: c.displayLabel,
        chainSource: 'CMS_PROVIDER_DATA',
        chainId: c.chainId,
        labelWithheld: !c.label,
        metricLabel: 'Facilities in CMS-reported chain', metricValue: String(c.facilityCount),
        date: null, dateLabel: 'Snapshot per most recent CMS Care Compare load',
        status: 'review candidate',
        detail: `CMS-reported chain · ${Number(c.totalCertifiedBeds || 0).toLocaleString()} certified beds · ${c.lowRatedFacilityCount} of ${c.ratedFacilityCount} rated facilities at 1–2 stars · published fines ${money(c.publishedFineAmount)}${c.changedOwnership12moCount ? ` · ${c.changedOwnership12moCount} changed ownership in the last 12 months` : ''}${c.label ? '' : ' · label withheld: the publisher\'s chain name is not an organization name'}`,
        guardrail: 'A CMS-reported chain is the publisher\'s grouping, never itself a finding of anticompetitive conduct or quality failure.',
        sourceNode: c.displayLabel,
        targetNode: `${c.facilityCount} ${state} facilities (CMS chain)`,
        relationshipValue: c.facilityCount,
        relationshipMembers: (c.facilities || []).map((f) => ({
          ccn: f.ccn, facilityName: f.facilityName, facilityType: 'snf', role: 'CMS-reported chain member',
          percentageOwnership: null, associationDate: null, overallRating: f.overallRating ?? null, totalFines: f.totalFines ?? null,
        })),
        qualityContext: { ratedFacilityCount: c.ratedFacilityCount, lowRatedFacilityCount: c.lowRatedFacilityCount, publishedFineAmount: c.publishedFineAmount },
      });
    }
  }

  // OFR-06: sub-award funding edges.
  const subaward = SUBAWARD_FLOW_GRAPH.byState[state];
  if (subaward) {
    for (const e of subaward.fundingEdges?.edges || []) {
      const sourceIdentity = resolveOrganizationLabel(e.sourceOrg);
      const recipientIdentity = resolveOrganizationLabel(e.recipientOrg);
      items.push({
        id: nextId('edge'), type: 'subaward-edge', state,
        title: `${sourceIdentity.displayName} → ${recipientIdentity.displayName}`,
        metricLabel: 'Amount', metricValue: money(e.amount),
        date: e.actionDate, dateLabel: e.actionDate ? `Action date ${e.actionDate}` : 'Action date not reported',
        status: e.identityConfidence,
        primeAwardKey: e.primeAwardKey || null,
        primeAwardId: e.primeAwardId || null,
        primeAwardEnd: e.primeAwardEnd || null,
        detail: `${e.assistanceListing}${e.recipientEin ? ` · EIN ${e.recipientEin}` : ''}${e.primeAwardId ? ` · Prime award ${e.primeAwardId}${e.primeAwardEnd ? ` ends ${e.primeAwardEnd}` : ''}` : ''}${sourceIdentity.displayName !== sourceIdentity.rawSourceName ? ` · Prime reported as ${sourceIdentity.rawSourceName}` : ''}${recipientIdentity.displayName !== recipientIdentity.rawSourceName ? ` · Recipient reported as ${recipientIdentity.rawSourceName}` : ''}`,
        guardrail: 'A funding edge is a review map, never itself evidence of duplication, waste, or improper coordination.',
        reviewCandidateOnly: e.identityConfidence === 'unresolved',
        sourceNode: sourceIdentity.displayName,
        targetNode: recipientIdentity.displayName,
        relationshipValue: Number(e.amount || 0),
        evidenceContext: {
          actionDate: e.actionDate || null,
          amount: Number(e.amount || 0),
          assistanceListing: e.assistanceListing,
          recipientEin: e.recipientEin || null,
          primeOrganization: sourceIdentity.displayName,
          rawPrimeOrganization: sourceIdentity.rawSourceName,
          recipientOrganization: recipientIdentity.displayName,
          primeAwardId: e.primeAwardId || null,
          subawardNumber: e.subawardNumber || null,
        },
      });
    }
  }

  // OFR-07: waiver horizon events + open NOFO opportunities.
  const horizon = PROGRAM_HORIZON_EVENTS.byState[state];
  if (horizon) {
    // Only a real forward deadline (a waiver's expiration date, or a NOFO's
    // application close date) is "urgent" in the days-remaining sense — a
    // milestone document's posted date or a NOFO's open date is informational,
    // not a countdown, so those are left unranked (search finds them instead).
    const isDeadlineKind = (kind) => kind === 'expiration' || kind === 'close_date';
    for (const ev of horizon.events?.items || []) {
      const isNofo = ev.eventType === 'nofo_opportunity';
      items.push({
        id: nextId('horizon'), type: isNofo ? 'horizon-nofo' : 'horizon-waiver', state,
        title: isNofo ? ev.detail : `${ev.program} — ${ev.eventDateKind.replace('_', ' ')}`,
        metricLabel: 'Status', metricValue: ev.status,
        date: ev.eventDate, dateLabel: `${ev.eventDateKind.replace('_', ' ')}: ${ev.eventDate}`,
        status: ev.status,
        detail: isNofo ? ev.program : ev.detail,
        guardrail: 'A published date and status only — never a predicted renewal or award outcome.',
        sourceDocumentUri: ev.sourceDocumentUri, retrievedAt: ev.retrievedAt,
        urgencyRank: isDeadlineKind(ev.eventDateKind) ? daysFromNow(ev.eventDate) : null,
      });
    }
  }

  return items.map((item) => ({ ...item, playbook: FUNDING_RESILIENCE_PLAYBOOKS[item.type] }));
}

function buildStateSummary(state, items) {
  const counts = {};
  for (const t of FUNDING_RESILIENCE_TYPES) counts[t.id] = 0;
  for (const item of items) counts[item.type] = (counts[item.type] || 0) + 1;
  return {
    totalItems: items.length,
    reviewCandidateCount: items.filter((i) => i.reviewCandidateOnly).length,
    countsByType: counts,
  };
}

function buildStateLineage(state) {
  return FUNDING_RESILIENCE_SOURCE_IDS.map((id) => {
    const s = sourceById[id];
    return {
      fromSysId: id,
      publisher: s?.publisher || 'Not catalogued',
      href: s?.href || null,
      tosGrade: s?.tosGrade || 'UNKNOWN',
      loadStatus: s?.loadStatus || 'CATALOGUED',
      asOfDate: s?.asOfDate || 'See source record',
      attributionNotes: s?.attributionNotes || '',
    };
  });
}

function buildByState() {
  const byState = {};
  for (const state of ['KY', 'FL']) {
    const items = buildStateItems(state);
    byState[state] = {
      state,
      items,
      summary: buildStateSummary(state, items),
      lineage: buildStateLineage(state),
    };
  }
  return byState;
}

export const FUNDING_RESILIENCE_ROOM = {
  schema: 'decisionpro/funding-resilience-room/v1',
  note: 'A funding-continuity and organizational-resilience evidence room built from OFR-01..07. Every row is a review candidate for human validation — never itself a finding of waste, fraud, distress, breach, or improper conduct.',
  typeCatalog: FUNDING_RESILIENCE_TYPES,
  byState: buildByState(),
};

export function fundingResilienceCsvRows(state, items) {
  const slice = FUNDING_RESILIENCE_ROOM.byState[state];
  if (!slice) return [];
  return (items || slice.items).map((item) => ({
    type: typeMeta[item.type]?.label || item.type,
    package: typeMeta[item.type]?.packageId || '',
    state: item.state,
    title: item.title,
    organizationName: item.organizationName || '',
    organizationType: item.entityTypeLabel || '',
    publisherLabel: item.rawSourceName || '',
    nameAuthority: item.nameAuthority || '',
    awardId: item.awardId || '',
    awardKey: item.awardKey || '',
    assistanceListing: item.assistanceListing || '',
    awardAmount: item.awardAmount ?? '',
    metricLabel: item.metricLabel,
    metricValue: item.metricValue,
    date: item.date || '',
    status: item.status,
    continuationStatus: item.continuationAssessment?.status || '',
    continuationReason: item.continuationAssessment?.reasonCode || '',
    continuationAssessedAt: item.continuationAssessment?.assessedAt || '',
    continuationEvidenceIds: item.continuationAssessment?.evidence?.join(' | ') || '',
    gapStatus: item.gapAssessment?.status || '',
    gapRuleVersion: item.gapAssessment?.ruleVersion || '',
    missingGapInputs: item.gapAssessment?.missingInputs?.join(' | ') || '',
    gapReferences: item.gapAssessment?.gapRefs?.join(' | ') || '',
    ...formatEvidenceForCsv(item),
    detail: item.detail,
    dataQualityNote: item.dataQualityNote || '',
    guardrail: item.guardrail,
    goal: item.playbook?.goal || '',
    whatToLookFor: item.playbook?.lookFor || '',
    steps: item.playbook?.steps?.join(' | ') || '',
    useResult: item.playbook?.useResult || '',
    successMeasure: item.playbook?.successMeasure || '',
    reviewCandidateOnly: item.reviewCandidateOnly ? 'yes' : 'no',
    sourceSystem: typeMeta[item.type]?.sourceSystem || '',
  }));
}
