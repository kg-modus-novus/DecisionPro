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
      items.push({
        id: nextId('award'), type: 'award-cliff', state,
        title: `${a.recipientName} — ${a.assistanceListing}`,
        metricLabel: 'Award amount', metricValue: money(a.awardAmount),
        date: a.periodEnd, dateLabel: `Period of performance ends ${a.periodEnd}`,
        status: 'review candidate',
        detail: `${a.awardingAgency || 'Federal awarding agency'} · Award ${a.awardId}${a.recipientUei ? ` · UEI ${a.recipientUei}` : ''}`,
        guardrail: 'A listed expiration is a renewal-review prompt, not a predicted funding lapse.',
        urgencyRank: daysFromNow(a.periodEnd),
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

  // OFR-03: lowest-liquidity nonprofit filings.
  const nonprofit = NONPROFIT_FINANCIALS.byState[state];
  if (nonprofit) {
    for (const f of nonprofit.reviewCandidates?.lowestLiquidity || []) {
      items.push({
        id: nextId('nonprofit'), type: 'nonprofit-liquidity', state,
        title: f.orgName || `EIN ${f.ein}`,
        metricLabel: 'Liquidity (months)', metricValue: f.liquidityMonths == null ? '—' : f.liquidityMonths.toFixed(1),
        date: null, dateLabel: `Tax period ${f.taxPeriod} (extract vintage ${f.extractVintage})`,
        status: 'review candidate',
        detail: `Total revenue ${money(f.totalRevenue)} · Total expenses ${money(f.totalExpenses)}`,
        guardrail: 'A single low-liquidity period is not evidence of distress; never a finding.',
        urgencyRank: f.liquidityMonths == null ? null : f.liquidityMonths,
      });
    }
  }

  // OFR-04: negative-margin facility-years.
  const facility = FACILITY_FINANCIAL_DISTRESS.byState[state];
  if (facility) {
    for (const f of facility.negativeMarginWatchlist?.facilities || []) {
      items.push({
        id: nextId('facility'), type: 'facility-distress', state,
        title: f.facilityName || `CCN ${f.ccn}`,
        metricLabel: 'Total margin', metricValue: f.totalMargin == null ? '—' : `${(f.totalMargin * 100).toFixed(1)}%`,
        date: null, dateLabel: `Report year ${f.reportYear}`,
        status: 'review candidate',
        detail: `${f.facilityType || 'Facility'} · ${f.county || 'County not reported'}${f.medicaidDayShare != null ? ` · Medicaid day share ${(f.medicaidDayShare * 100).toFixed(1)}%` : ''}`,
        guardrail: 'A negative margin is a review prompt only, never a closure prediction or distress finding.',
        urgencyRank: f.totalMargin == null ? null : f.totalMargin * 100,
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
        detail: `${c.totalBeds != null ? `${c.totalBeds.toLocaleString()} total beds` : 'Bed count not available'}${c.avgTotalMargin != null ? ` · avg margin ${(c.avgTotalMargin * 100).toFixed(1)}%` : ''}`,
        guardrail: 'Common ownership is never itself a finding of anticompetitive conduct or quality failure.',
      });
    }
  }

  // OFR-06: sub-award funding edges.
  const subaward = SUBAWARD_FLOW_GRAPH.byState[state];
  if (subaward) {
    for (const e of subaward.fundingEdges?.edges || []) {
      items.push({
        id: nextId('edge'), type: 'subaward-edge', state,
        title: `${e.sourceOrg} → ${e.recipientOrg}`,
        metricLabel: 'Amount', metricValue: money(e.amount),
        date: e.actionDate, dateLabel: e.actionDate ? `Action date ${e.actionDate}` : 'Action date not reported',
        status: e.identityConfidence,
        detail: `${e.assistanceListing}${e.recipientEin ? ` · EIN ${e.recipientEin}` : ''}`,
        guardrail: 'A funding edge is a review map, never itself evidence of duplication, waste, or improper coordination.',
        reviewCandidateOnly: e.identityConfidence === 'unresolved',
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

  return items;
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
    metricLabel: item.metricLabel,
    metricValue: item.metricValue,
    date: item.date || '',
    status: item.status,
    detail: item.detail,
    guardrail: item.guardrail,
    reviewCandidateOnly: item.reviewCandidateOnly ? 'yes' : 'no',
    sourceSystem: typeMeta[item.type]?.sourceSystem || '',
  }));
}
