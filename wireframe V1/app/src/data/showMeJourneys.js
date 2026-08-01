/**
 * Controlled, manually launched Show Me journeys (21 = 7 roles × 3 priorities).
 * Synthetic fixtures only — narrative may interpolate live session cube values.
 */

import { ROOM_CONFIGS } from './alp/roomConfigs.js';
import { LAW_INSTRUMENTS } from './alp/legislation.js';
import {
  ATTENTION,
  CONTRACT_CLASSES,
  FRESHNESS,
  MCOS,
  MEASURE_TYPES,
  POPULATIONS,
  REGIONS,
  SERVICE_CATEGORIES,
} from './alp/dimensions.js';
import { EVIDENCE_ROOMS, FINDINGS, FOCUS_TABS, OPTION_PACKS } from './fixtures.js';
import { ROLE_IDS, ROLE_PROFILES } from './roleProfiles.js';
import { listSlice } from '../lib/alpCube.js';

const ROOM_IDS = new Set(EVIDENCE_ROOMS.map((r) => r.id));
const FINDING_IDS = new Set(FINDINGS.map((f) => f.id));
const PACK_IDS = new Set(OPTION_PACKS.map((p) => p.id));
const LAW_IDS = new Set(LAW_INSTRUMENTS.map((l) => l.id));
const PATTERNS = new Set([
  'evidence-investigation',
  'blender-synthesis',
  'trust-provenance',
  'legislative-linkage',
]);

const DIM_IDS = {
  population: new Set(POPULATIONS.map((d) => d.id)),
  region: new Set(REGIONS.map((d) => d.id)),
  mco: new Set(MCOS.map((d) => d.id)),
  service: new Set(SERVICE_CATEGORIES.map((d) => d.id)),
  attention: new Set(ATTENTION.map((d) => d.id)),
  freshness: new Set(FRESHNESS.map((d) => d.id)),
  measureType: new Set(MEASURE_TYPES.map((d) => d.id)),
  contractClass: new Set(CONTRACT_CLASSES.map((d) => d.id)),
};

const DIM_LABELS = Object.fromEntries(
  [
    ...ATTENTION,
    ...CONTRACT_CLASSES,
    ...FRESHNESS,
    ...MCOS,
    ...MEASURE_TYPES,
    ...POPULATIONS,
    ...REGIONS,
    ...SERVICE_CATEGORIES,
  ].map((item) => [item.id, item.label]),
);

const PRIORITY_DECISION_SCENARIOS = {
  'legislator-district-story': {
    need: 'prepare a town-hall answer about which Eastern Kentucky district signal deserves attention',
    decision: 'which local aggregate is strong enough to brief, with its source and limitation',
  },
  'legislator-constituent-care': {
    need: 'answer a constituent who asks whether postpartum follow-up is falling short',
    decision:
      'what qualified answer to give the constituent, including the displayed rate, peer context, source, and limitation',
  },
  'legislator-brief-session': {
    need: 'walk into a session meeting with one defensible district, care, and access option',
    decision: 'which option pack merits discussion and what trade-offs must accompany it',
  },
  'staff-law-blender': {
    need: 'prepare the chair for questions about how a maternal-health bill connects to current evidence',
    decision: 'which provision opens an opportunity, which law may block it, and which source must be verified',
  },
  'staff-maternal-bills': {
    need: 'draft a hearing question about postpartum process performance in Eastern Kentucky',
    decision: 'which aggregate supports the question and which caveat belongs in the chair memo',
  },
  'staff-exportable-brief': {
    need: 'turn several bill-ready findings into a concise packet for the committee chair',
    decision: 'which pack to brief and whether its evidence chain is ready for export',
  },
  'budget-cost-drivers': {
    need: 'explain whether pharmacy spending among disabled members is materially driving the increase',
    decision: 'which contribution row belongs in the fiscal note and whether it appears controllable',
  },
  'budget-focus-blend': {
    need: 'compare fiscal options for pharmacy, inpatient use, and MCO withholding pressure',
    decision: 'which option ranks highest when budget impact is weighted more heavily',
  },
  'budget-trust-lag': {
    need: 'decide whether a cost trend is settled enough to quote in a fiscal briefing',
    decision: 'whether rebate or encounter lag changes the conclusion and how to disclose it',
  },
  'leadership-attention': {
    need: 'identify the Eastern Kentucky signal that should be on this month’s cabinet briefing',
    decision: 'which intervention-indicated aggregate requires an owner and follow-up',
  },
  'leadership-mco': {
    need: 'understand why WellCare of Kentucky has quality withholding at risk',
    decision: 'which contracted measure is driving exposure and what management response to examine',
  },
  'leadership-ops-trust': {
    need: 'determine whether a provisional operational measure is safe to use in a cabinet briefing',
    decision: 'whether to use, qualify, or defer the signal based on freshness and ownership',
  },
  'policy-blend-early': {
    need: 'compare interventions that address cost, postpartum care, and avoidable emergency use together',
    decision: 'which cross-domain package offers the most balanced examination path',
  },
  'policy-benchmarks': {
    need: 'determine whether a disabled-population outcome gap is unusual relative to a credible peer',
    decision: 'which benchmark gap is meaningful enough to shape an intervention hypothesis',
  },
  'policy-law-linkage': {
    need: 'test whether pending rural-access language would help or hinder the active evidence-based options',
    decision: 'which legal opening or blocker must be addressed in the policy design',
  },
  'oversight-definitions': {
    need: 'trace a lagged cost measure before relying on it in an oversight finding',
    decision: 'whether the definition, owner, source, and limitation support an audit conclusion',
  },
  'oversight-mco-contracts': {
    need: 'reconcile a monitored MCO’s reported performance with its contract classification',
    decision: 'whether the variance reflects a contractual issue, a monitoring issue, or incomplete evidence',
  },
  'oversight-source-links': {
    need: 'prove that a reported process measure leads back to an authoritative government source',
    decision: 'whether the evidence chain is complete enough for an audit workpaper',
  },
  'steward-definitions': {
    need: 'verify that a near-current utilization measure has the correct owner, cadence, and limitation',
    decision: 'whether the catalog entry can remain as published or needs correction',
  },
  'steward-command-center': {
    need: 'understand why a provisional, incomplete signal is appearing in the Command Center',
    decision: 'which freshness or quality label downstream users need to see',
  },
  'steward-primary-sources': {
    need: 'spot-check that an access measure still points to the correct government source',
    decision: 'whether the link and catalog metadata are current enough for downstream use',
  },
};

function homeTarget(priorityId) {
  return `role-home-priority-${priorityId}`;
}

function returnHomeStep(priorityId, tryCopy) {
  return {
    id: 'return-home',
    title: 'Okay, now you try it',
    narrative:
      tryCopy
      || 'Okay, now you try it. Use this priority tile as your starting point and repeat the path with your own judgment.',
    target: homeTarget(priorityId),
    apply: {
      view: 'role-home',
      activeEvidenceId: null,
      evidenceObjectId: null,
      activeLawId: null,
      activePackId: null,
      guidedFilters: {},
      viewMode: 'hybrid',
      objectFacet: null,
      highlightPriorityId: priorityId,
      askSamOpen: false,
    },
  };
}

function evidenceJourney({
  id,
  roleId,
  priorityId,
  title,
  roomId,
  filters,
  preferredLeadTitle,
  openCopy,
  filterCopy,
  chartCopy,
  listCopy,
  leadCopy,
  tryCopy,
}) {
  const facetSteps = [
    ['overview', 'object-facet-overview', 'Overview shows the aggregate story and magnitude for this slice.'],
    ['identification', 'object-facet-identification', 'Identification lists dimensions, owners, and how this row is keyed.'],
    ['related', 'object-facet-related', 'Related aggregates keep nearby slices in view without leaving the object.'],
    ['legislation', 'object-facet-legislation', 'Legislative touchpoints point to statutes or bills that may open or constrain work.'],
    ['options', 'object-facet-options', 'Options to examine stay non-prescriptive — candidates only.'],
  ];

  return {
    id,
    roleId,
    priorityId,
    originPriorityId: priorityId,
    pattern: 'evidence-investigation',
    title,
    preferredLeadTitle,
    steps: [
      {
        id: 'open-room',
        title: 'Open the evidence room',
        narrative: openCopy,
        target: 'alp-titlebar',
        apply: {
          view: 'evidence',
          activeEvidenceId: roomId,
          evidenceObjectId: null,
          activeLawId: null,
          activePackId: null,
          guidedFilters: {},
          viewMode: 'hybrid',
          objectFacet: null,
          highlightPriorityId: null,
        },
      },
      {
        id: 'apply-filters',
        title: 'Narrow with visual filters',
        narrative: filterCopy,
        target: 'alp-visual-filters',
        apply: {
          view: 'evidence',
          activeEvidenceId: roomId,
          evidenceObjectId: null,
          guidedFilters: { ...filters },
          viewMode: 'hybrid',
          objectFacet: null,
        },
      },
      {
        id: 'read-chart',
        title: 'Read the filtered chart',
        narrative: chartCopy,
        target: 'alp-content-chart',
        apply: {
          view: 'evidence',
          activeEvidenceId: roomId,
          evidenceObjectId: null,
          guidedFilters: { ...filters },
          viewMode: 'hybrid',
          objectFacet: null,
        },
      },
      {
        id: 'scan-items',
        title: 'Scan the item list',
        narrative: listCopy,
        target: 'alp-detail-list',
        apply: {
          view: 'evidence',
          activeEvidenceId: roomId,
          evidenceObjectId: null,
          guidedFilters: { ...filters },
          viewMode: 'hybrid',
          objectFacet: null,
        },
      },
      {
        id: 'open-lead',
        title: 'Open the lead aggregate',
        narrative: leadCopy,
        target: 'alp-lead-item',
        resolveLead: true,
        apply: {
          view: 'evidence',
          activeEvidenceId: roomId,
          evidenceObjectId: null,
          guidedFilters: { ...filters },
          viewMode: 'hybrid',
          objectFacet: null,
        },
      },
      ...facetSteps.map(([facet, target, narrative]) => ({
        id: `facet-${facet}`,
        title: `Object facet: ${facet}`,
        narrative,
        target,
        resolveLead: true,
        apply: {
          view: 'evidence',
          activeEvidenceId: roomId,
          evidenceObjectId: '__lead__',
          guidedFilters: { ...filters },
          objectFacet: facet,
          viewMode: 'hybrid',
        },
      })),
      returnHomeStep(priorityId, tryCopy),
    ],
  };
}

function blenderJourney({
  id,
  roleId,
  priorityId,
  title,
  focuses,
  findingIds,
  weights,
  packId,
  copies,
}) {
  return {
    id,
    roleId,
    priorityId,
    originPriorityId: priorityId,
    pattern: 'blender-synthesis',
    title,
    steps: [
      {
        id: 'open-blender',
        title: 'Open the Consideration Blender',
        narrative: copies.open,
        target: 'blender-title',
        apply: {
          view: 'blender',
          evidenceObjectId: null,
          activeLawId: null,
          activePackId: null,
          selectedFocuses: focuses,
          blendedIds: [],
          spineStep: 'Results',
          trustReviewed: false,
          pathPinned: false,
          highlightPriorityId: null,
          guidedFilters: {},
          objectFacet: null,
        },
      },
      {
        id: 'set-focuses',
        title: 'Set focus tabs',
        narrative: copies.focuses,
        target: 'blender-focus-tabs',
        apply: {
          view: 'blender',
          selectedFocuses: focuses,
          blendedIds: [],
          spineStep: 'Results',
        },
      },
      {
        id: 'blend-findings',
        title: 'Blend findings',
        narrative: copies.findings,
        target: 'blender-findings',
        apply: {
          view: 'blender',
          selectedFocuses: focuses,
          blendedIds: findingIds,
          spineStep: 'Results',
        },
      },
      {
        id: 'weigh',
        title: 'Adjust weights',
        narrative: copies.weights,
        target: 'blender-weights',
        apply: {
          view: 'blender',
          selectedFocuses: focuses,
          blendedIds: findingIds,
          weights: { ...weights },
          spineStep: 'Results',
        },
      },
      {
        id: 'trust',
        title: 'Walk Trust',
        narrative: copies.trust,
        target: 'blender-trust',
        apply: {
          view: 'blender',
          selectedFocuses: focuses,
          blendedIds: findingIds,
          weights: { ...weights },
          spineStep: 'Trust',
          trustReviewed: true,
        },
      },
      {
        id: 'packs',
        title: 'Review option packs',
        narrative: copies.packs,
        target: 'blender-packs',
        apply: {
          view: 'blender',
          selectedFocuses: focuses,
          blendedIds: findingIds,
          weights: { ...weights },
          spineStep: 'Action',
          trustReviewed: true,
          activePackId: packId,
        },
      },
      {
        id: 'open-pack',
        title: 'Open a pack card',
        narrative: copies.packDetail,
        target: 'pack-wins',
        apply: {
          view: 'pack',
          activePackId: packId,
          selectedFocuses: focuses,
          blendedIds: findingIds,
          weights: { ...weights },
          trustReviewed: true,
        },
      },
      returnHomeStep(priorityId, copies.tryIt),
    ],
  };
}

function trustJourney({
  id,
  roleId,
  priorityId,
  title,
  filters,
  preferredLeadTitle,
  copies,
}) {
  return evidenceJourney({
    id,
    roleId,
    priorityId,
    title,
    roomId: 'measure-definitions',
    filters,
    preferredLeadTitle,
    openCopy: copies.open,
    filterCopy: copies.filters,
    chartCopy: copies.chart,
    listCopy: copies.list,
    leadCopy: copies.lead,
    tryCopy: copies.tryIt,
  });
}

function legislativeJourney({
  id,
  roleId,
  priorityId,
  title,
  focuses,
  findingIds,
  lawId,
  copies,
}) {
  return {
    id,
    roleId,
    priorityId,
    originPriorityId: priorityId,
    pattern: 'legislative-linkage',
    title,
    steps: [
      {
        id: 'open-legislation',
        title: 'Open Legislative Analysis',
        narrative: copies.open,
        target: 'legislation-header',
        apply: {
          view: 'legislation',
          activeLawId: null,
          evidenceObjectId: null,
          selectedFocuses: focuses,
          blendedIds: findingIds,
          highlightPriorityId: null,
          guidedFilters: {},
          objectFacet: null,
        },
      },
      {
        id: 'workspace',
        title: 'Scan Law ↔ blender workspace',
        narrative: copies.workspace,
        target: 'legislation-workspace',
        apply: {
          view: 'legislation',
          activeLawId: null,
          selectedFocuses: focuses,
          blendedIds: findingIds,
        },
      },
      {
        id: 'open-law',
        title: 'Open a law instrument',
        narrative: copies.law,
        target: 'law-object-page',
        apply: {
          view: 'law-object',
          activeLawId: lawId,
          selectedFocuses: focuses,
          blendedIds: findingIds,
        },
      },
      {
        id: 'sources',
        title: 'Check source links',
        narrative: copies.sources,
        target: 'law-object-sources',
        apply: {
          view: 'law-object',
          activeLawId: lawId,
          selectedFocuses: focuses,
          blendedIds: findingIds,
        },
      },
      returnHomeStep(priorityId, copies.tryIt),
    ],
  };
}

/** Pick the highest-metric semantically preferred row under the current filters. */
export function resolveLeadRow(roomId, filters = {}, preferredLeadTitle = '') {
  const config = ROOM_CONFIGS[roomId];
  if (!config) return null;
  let slice = listSlice(roomId, filters, { page: 0, pageSize: 50 });
  // REAL/Gap cubes are sparse — fall back to the room's full REAL set when filters miss.
  if (!slice.rows.length) {
    slice = listSlice(roomId, {}, { page: 0, pageSize: 50 });
  }
  if (!slice.rows.length) return null;
  const metricKey = config.metricKey;
  const preferredNeedle = preferredLeadTitle.toLocaleLowerCase();
  let preferredRows = preferredNeedle
    ? slice.rows.filter((row) => String(row.title).toLocaleLowerCase().includes(preferredNeedle))
    : [];
  if (!preferredRows.length && preferredNeedle) {
    // Title fixtures from the synthetic era may not match REAL titles — pick best REAL/Gap row.
    preferredRows = slice.rows;
  }
  const candidates = preferredRows.length ? preferredRows : slice.rows;
  return [...candidates].sort((a, b) => {
    const av = Number(a[metricKey]);
    const bv = Number(b[metricKey]);
    const aNum = Number.isFinite(av) ? av : Number(a.metricValue) || 0;
    const bNum = Number.isFinite(bv) ? bv : Number(b.metricValue) || 0;
    if (bNum !== aNum) return bNum - aNum;
    // Prefer REAL over Gap when metrics tie or are null.
    if (a.rowKind !== b.rowKind) return a.rowKind === 'REAL' ? -1 : 1;
    return String(a.id).localeCompare(String(b.id));
  })[0];
}

export function resolveJourneyLeadRow(journey) {
  const roomStep = journey?.steps?.find(
    (step) => Object.keys(step.apply?.guidedFilters || {}).length > 0,
  ) || journey?.steps?.find((step) => step.apply?.activeEvidenceId);
  const roomId = roomStep?.apply?.activeEvidenceId;
  if (!roomId) return null;
  return resolveLeadRow(
    roomId,
    roomStep.apply.guidedFilters || {},
    journey.preferredLeadTitle,
  );
}

function interpolate(text, leadRow, roomId) {
  if (!text) return text;
  const metricKey = ROOM_CONFIGS[roomId]?.metricKey;
  const metricLabel = ROOM_CONFIGS[roomId]?.metricLabel || 'Metric';
  const metricVal = leadRow && metricKey != null ? leadRow[metricKey] : null;
  const replacements = {
    '{leadTitle}': leadRow?.title || 'the lead aggregate',
    '{leadMetric}':
      metricVal == null
        ? 'the visible metric'
        : `${metricLabel} ${Number(metricVal).toLocaleString(undefined, { maximumFractionDigits: 1 })}`,
    '{leadPopulation}': leadRow?.population || 'the filtered population',
    '{leadRegion}': leadRow?.region || 'the filtered region',
  };
  return Object.entries(replacements).reduce(
    (out, [token, value]) => out.split(token).join(value),
    text,
  );
}

function formatList(items) {
  if (items.length < 2) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function showMeExample(step, leadRow, roomId, journey) {
  const apply = step.apply || {};
  const profile = ROLE_PROFILES[journey?.roleId];
  const scenario = PRIORITY_DECISION_SCENARIOS[journey?.priorityId];
  const need = scenario?.need || 'complete this role-specific analysis';
  const decision = scenario?.decision || 'what action or follow-up the evidence supports';
  const filters = apply.guidedFilters || {};
  const journeyFilters =
    Object.keys(filters).length
      ? filters
      : journey.steps.find(
        (item) => item.apply?.guidedFilters
          && Object.keys(item.apply.guidedFilters).length,
      )?.apply.guidedFilters || {};
  const filterExample = Object.entries(journeyFilters)
    .flatMap(([key, value]) => {
      const values = Array.isArray(value) ? value : [value];
      const filterLabel =
        ROOM_CONFIGS[roomId]?.filters?.find((filter) => filter.key === key)?.label || key;
      return values.map((id) => `${filterLabel} to ${DIM_LABELS[id] || id}`);
    })
    .join(' and ');
  const filterScope = filterExample.replaceAll(' to ', ' set to ');
  const leadTitle = leadRow?.title || 'the highlighted lead aggregate';
  const leadMetric = interpolate('{leadMetric}', leadRow, roomId);
  const selectedFocuses =
    apply.selectedFocuses?.length
      ? apply.selectedFocuses
      : journey.steps.find((item) => item.apply?.selectedFocuses?.length)?.apply.selectedFocuses || [];
  const focusLabels = selectedFocuses
    .map((id) => FOCUS_TABS.find((focus) => focus.id === id)?.label)
    .filter(Boolean);
  const blendedIds =
    apply.blendedIds?.length
      ? apply.blendedIds
      : journey.steps.find((item) => item.apply?.blendedIds?.length)?.apply.blendedIds || [];
  const findingTitles = blendedIds
    .map((id) => FINDINGS.find((finding) => finding.id === id)?.title)
    .filter(Boolean);
  const lawId =
    apply.activeLawId
    || journey.steps.find((item) => item.apply?.activeLawId)?.apply.activeLawId;
  const law = LAW_INSTRUMENTS.find((item) => item.id === lawId);
  const lawDisplayTitle = law
    ? `${law.title}${law.kind === 'pending' ? ` (${law.cite})` : ''}`
    : 'the highlighted instrument';
  const packId =
    apply.activePackId
    || journey.steps.find((item) => item.apply?.activePackId)?.apply.activePackId;
  const pack = OPTION_PACKS.find((item) => item.id === packId);
  const journeyWeights =
    apply.weights
    || journey.steps.find((item) => item.apply?.weights)?.apply.weights
    || {};
  const strongestWeight = Object.entries(journeyWeights).sort((a, b) => b[1] - a[1])[0];
  const strongestWeightLabel =
    FOCUS_TABS.find((focus) => focus.id === strongestWeight?.[0])?.label
    || 'the leading role priority';

  if (step.target?.startsWith('role-home-priority-')) {
    const repeatAction = {
      'evidence-investigation':
        `open ${ROOM_CONFIGS[roomId]?.title || 'the demonstrated evidence room'}, set ${filterExample}, compare the chart, open “${leadTitle},” and verify its Overview, Identification, Related aggregates, Legislative touchpoints, and Options to examine`,
      'trust-provenance':
        `open Measure Definitions & Data Quality, set ${filterExample}, open “${leadTitle},” and verify its owner, source, refresh cadence, and limitation`,
      'blender-synthesis':
        `open the Consideration Blender, select ${formatList(focusLabels)}, add ${formatList(findingTitles)}, set ${strongestWeightLabel} to ${strongestWeight?.[1] ?? 70}, review Trust, and open “${pack?.title || 'the highest-ranked pack'}”`,
      'legislative-linkage':
        `open Legislative Analysis, select “${lawDisplayTitle},” compare its openings and blockers with ${formatList(findingTitles)}, and follow the primary-source pointer while recording the remaining official-verification requirement`,
    }[journey.pattern];
    return `${profile?.shortLabel || 'The user'} asks, “Can I repeat this path myself to decide ${decision}?” ${repeatAction[0].toUpperCase()}${repeatAction.slice(1)}. The result is a reproducible evidence path for that decision.`;
  }
  if (step.target === 'alp-visual-filters') {
    return `${profile?.shortLabel || 'The user'} asks, “Can I isolate only the evidence needed to ${need}?” Set ${filterExample || 'the relevant population and region'} here; the chart and item list immediately narrow to that decision slice.`;
  }
  if (step.target === 'alp-content-chart') {
    return `${profile?.shortLabel || 'The user'} asks, “With ${filterScope || 'the current filters applied'}, which visible category should I examine first to ${need}?” Compare the displayed bars, then use the largest relevant category to decide which rows merit provenance review—not to infer causation.`;
  }
  if (step.target === 'alp-detail-list') {
    return `${profile?.shortLabel || 'The user'} asks, “Which row under ${filterScope || 'these filters'} matches my request and should be checked first?” Compare the visible title, metric, freshness, and dimensions; “${leadTitle}” is the demonstrated match at ${leadMetric}, so open it for provenance review.`;
  }
  if (step.target === 'alp-lead-item') {
    return `${profile?.shortLabel || 'The user'} asks, “What supports ‘${leadTitle},’ and can I safely rely on ${leadMetric} when I ${need}?” Open the row and verify its population, region, period, source, freshness, and limitation before deciding ${decision}.`;
  }
  if (step.target?.startsWith('object-facet-')) {
    const facet = step.target.replace('object-facet-', '').replace('-', ' ');
    const facetExample = {
      overview:
        `${profile?.shortLabel || 'The user'} asks, “For ‘${leadTitle},’ what does ${leadMetric} mean in context, and which breakdown explains the total?” Open Overview and record the headline metric, status cues, and breakdown for the briefing.`,
      identification:
        `${profile?.shortLabel || 'The user'} asks, “Who owns ‘${leadTitle},’ which population, region, and period does it cover, and what source produced it?” Open Identification and record those fields plus the displayed limitation.`,
      related:
        `${profile?.shortLabel || 'The user'} asks, “Is ‘${leadTitle}’ isolated, or do adjacent populations and regions show a similar pattern?” Open Related aggregates and compare the nearby rows before describing the finding as local or broader.`,
      legislation:
        `${profile?.shortLabel || 'The user'} asks, “Which displayed bill, statute, or identified gap may create an opening or constraint for ‘${leadTitle}’?” Open Legislative touchpoints and carry the relevant instrument into official-source verification.`,
      options:
        `${profile?.shortLabel || 'The user'} asks, “Which bounded follow-up candidates could address ‘${leadTitle},’ and what caution belongs beside each?” Open Options to examine and compare candidates without treating the list as a recommendation.`,
    }[facet];
    return facetExample;
  }
  if (step.target === 'blender-focus-tabs') {
    return `${profile?.shortLabel || 'The user'} asks, “Can I compare how ${formatList(focusLabels)} change the way I ${need}?” Select those focus tabs so the candidate findings cover each decision lens.`;
  }
  if (step.target === 'blender-findings') {
    return `${profile?.shortLabel || 'The user'} asks, “What option could respond to ${formatList(findingTitles)} together instead of treating each finding separately?” Add those ${findingTitles.length} findings to create the comparison set.`;
  }
  if (step.target === 'blender-weights') {
    return `${profile?.shortLabel || 'The user'} asks, “How does the candidate order change when ${strongestWeightLabel} matters most for ${decision}?” Set that weight to ${strongestWeight?.[1] ?? 70}; the radar and pack order recalculate for comparison.`;
  }
  if (step.target === 'blender-trust') {
    return `${profile?.shortLabel || 'The user'} asks, “Which freshness, confidence, source, or limitation caveat could overturn this comparison?” Open Trust and mark it reviewed only after you can state the caveats that must accompany the packs.`;
  }
  if (step.target === 'blender-packs') {
    return `${profile?.shortLabel || 'The user'} asks, “Which candidate warrants deeper examination under the displayed findings, weights, and Trust caveats?” In Action, open “${pack?.title || 'the highlighted pack'}” as the demonstrated candidate and compare its displayed scores, evidence level, failure modes, and caveats. This is examination support, not a recommendation.`;
  }
  if (step.target === 'pack-wins') {
    return `${profile?.shortLabel || 'The user'} asks, “Who could gain, who could bear cost, and why might ‘${pack?.title || 'the highlighted pack'}’ fail before I decide ${decision}?” Compare its three win columns, cost-bearer, failure modes, and Trust caveats to determine whether it belongs in the brief.`;
  }
  if (step.target === 'legislation-header') {
    return `${profile?.shortLabel || 'The user'} asks, “Which exact bill, statute, or legal gap should I test while I ${need}?” Open Legislative Analysis with ${formatList(focusLabels)} active and locate “${lawDisplayTitle}.”`;
  }
  if (step.target === 'legislation-workspace') {
    return `${profile?.shortLabel || 'The user'} asks, “Does ‘${lawDisplayTitle}’ create an opening or blocker for ${formatList(findingTitles)}?” Compare the instrument and findings in the Law ↔ blender workspace and record the displayed relevance strengths.`;
  }
  if (step.target === 'law-object-page') {
    return `${profile?.shortLabel || 'The user'} asks, “Which provision may create an opening, which law or gap may block it, and which official source must verify that interpretation?” Open “${lawDisplayTitle}” and read its Executive summary, Detailed analysis, affected focuses, and displayed relevance before deciding ${decision}.`;
  }
  if (step.target === 'law-object-sources') {
    return `${profile?.shortLabel || 'The user'} asks, “Which official source must confirm the displayed claim about ‘${lawDisplayTitle}’?” Follow the Primary authoritative source pointer and record any remaining LRC or official-source verification requirement beside the cited provision; the synthetic record locates what to verify but does not verify the law.`;
  }
  if (step.target === 'blender-title') {
    return `${profile?.shortLabel || 'The user'} asks, “Can I compare candidate responses while I ${need}?” Open the Consideration Blender, select ${formatList(focusLabels)}, and add ${formatList(findingTitles)} to create a ${findingTitles.length}-finding comparison for weighting and Trust review.`;
  }
  if (roomId) {
    return `${profile?.shortLabel || 'The user'} asks, “Where can I ${need}?” Open ${ROOM_CONFIGS[roomId]?.title || 'this evidence room'}, set ${filterExample}, compare the chart, and open “${leadTitle}” to assemble the evidence needed to decide ${decision}.`;
  }
  return `${profile?.shortLabel || 'The user'} asks, “How can I ${need}?” Make the demonstrated choice on this screen and compare the resulting evidence before deciding ${decision}.`;
}

function distinctExample(example, narrative) {
  const exampleText = String(example || '').replace(/\s+/g, ' ').trim();
  const narrativeText = String(narrative || '').replace(/\s+/g, ' ').trim();
  if (!exampleText) return '';
  if (exampleText.toLocaleLowerCase() === narrativeText.toLocaleLowerCase()) return '';
  return exampleText;
}

export function buildShowMeSteps(journey, { leadRow = null } = {}) {
  if (!journey?.steps?.length) return [];
  const roomId =
    journey.steps.find((s) => s.apply?.activeEvidenceId)?.apply.activeEvidenceId || null;
  return journey.steps.map((step) => {
    const narrative = interpolate(step.narrative, leadRow, roomId);
    const example = distinctExample(
      interpolate(
        step.example || showMeExample(step, leadRow, roomId, journey),
        leadRow,
        roomId,
      ),
      narrative,
    );
    return {
      ...step,
      preferredLeadTitle: journey.preferredLeadTitle,
      title: interpolate(step.title, leadRow, roomId),
      narrative,
      purpose: narrative || step.purpose,
      data: step.data || 'Controlled synthetic demo data for this guided path.',
      functionality: step.functionality || 'Follow Next to apply the next guided state.',
      example,
      mode: 'show-me',
    };
  });
}

export const SHOW_ME_JOURNEYS = {
  'journey-legislator-district-story': evidenceJourney({
    id: 'journey-legislator-district-story',
    roleId: 'legislator',
    priorityId: 'legislator-district-story',
    title: 'District story in County & District',
    roomId: 'county',
    filters: { region: 'east', population: 'disabled' },
    preferredLeadTitle: 'Pike (HD-92)',
    openCopy:
      'If you want a district-first story, start in County & District so county and region slices stay in view.',
    filterCopy:
      'Apply Eastern KY and Disabled filters so the chart and list answer a constituent-relevant question.',
    chartCopy:
      'Read the filtered chart for magnitude before you commit to a talking point.',
    listCopy:
      'Scan the item list for the strongest remaining aggregate under those filters.',
    leadCopy:
      'Open {leadTitle} — the lead row under your filters ({leadMetric}).',
    tryCopy:
      'Okay, now you try it. Return to District story first and recreate this path for your own district question.',
  }),

  'journey-legislator-constituent-care': evidenceJourney({
    id: 'journey-legislator-constituent-care',
    roleId: 'legislator',
    priorityId: 'legislator-constituent-care',
    title: 'Constituent care in Outcomes',
    roomId: 'outcomes',
    filters: { population: 'pregnant', measureType: 'outcome' },
    preferredLeadTitle: 'Postpartum follow-up',
    openCopy:
      'If you want constituent care and access cues, open Outcomes & Quality for postpartum and quality gaps.',
    filterCopy:
      'Filter to Pregnant / postpartum and Outcome measures so care gaps stay front and center.',
    chartCopy:
      'Use the chart to see which measure types still carry the largest gaps after filtering.',
    listCopy:
      'Choose a list row you could explain in plain language at a town hall.',
    leadCopy:
      'Open {leadTitle} and note {leadMetric} before you decide what to examine further.',
    tryCopy:
      'Okay, now you try it. Start from Constituent care & access and pick your own care question.',
  }),

  'journey-legislator-brief-session': blenderJourney({
    id: 'journey-legislator-brief-session',
    roleId: 'legislator',
    priorityId: 'legislator-brief-session',
    title: 'Blend into a session brief',
    focuses: ['district', 'care', 'access'],
    findingIds: ['f-hd67', 'f-postpartum', 'f-rural-distance'],
    weights: { budget: 40, care: 70, access: 65, mco: 35, district: 80, bill: 45 },
    packId: 'pack-district-brief',
    copies: {
      open: 'If you want a session-ready brief, open the Consideration Blender with district defaults.',
      focuses: 'Keep District, Care Quality, and Access focuses on so findings match constituent stakes.',
      findings: 'Blend district, postpartum, and rural-distance findings — at least two unlock packs.',
      weights: 'Raise district and care weights so the radar reflects what you will brief.',
      trust: 'Mark Trust reviewed only after you have read freshness and source caveats.',
      packs: 'Scan Win-Win-Win packs as options to examine, not prescriptions.',
      packDetail: 'Open the district brief pack and read the three win columns plus failure modes.',
      tryIt: 'Okay, now you try it. From Brief for the session, rebuild a blend with your own weights.',
    },
  }),

  'journey-staff-law-blender': legislativeJourney({
    id: 'journey-staff-law-blender',
    roleId: 'legislative-staff',
    priorityId: 'staff-law-blender',
    title: 'Law ↔ blender for hearing prep',
    focuses: ['bill', 'care', 'budget'],
    findingIds: ['f-pending-maternal', 'f-postpartum'],
    lawId: 'bill-maternal-a',
    copies: {
      open: 'If you are prepping a hearing packet, open Legislative Analysis with bill readiness focuses active.',
      workspace: 'Use the Law ↔ blender workspace to see blockers and openings against blended findings.',
      law: 'Open the maternal bill fixture and read how provisions touch care and budget evidence.',
      sources: 'Follow primary-source pointers and note where LRC verification is still required.',
      tryIt: 'Okay, now you try it. From Law ↔ blender, link a different instrument to your blend.',
    },
  }),

  'journey-staff-maternal-bills': evidenceJourney({
    id: 'journey-staff-maternal-bills',
    roleId: 'legislative-staff',
    priorityId: 'staff-maternal-bills',
    title: 'Maternal bill evidence in Outcomes',
    roomId: 'outcomes',
    filters: { population: 'pregnant', region: 'east', measureType: 'process' },
    preferredLeadTitle: 'Postpartum follow-up',
    openCopy:
      'If you need maternal and access bill evidence, start in Outcomes with hearing-ready filters.',
    filterCopy:
      'Filter Pregnant / postpartum, Eastern KY, and Process measures to match pending maternal language.',
    chartCopy:
      'Confirm the chart still shows a usable series after the hearing filters.',
    listCopy:
      'Pick a list row you can cite with caveats in a chair memo.',
    leadCopy:
      'Open {leadTitle} ({leadMetric}) and capture identification fields for the packet.',
    tryCopy:
      'Okay, now you try it. From Maternal & access bills, rebuild filters for another provision.',
  }),

  'journey-staff-exportable-brief': blenderJourney({
    id: 'journey-staff-exportable-brief',
    roleId: 'legislative-staff',
    priorityId: 'staff-exportable-brief',
    title: 'Lock a pack for export',
    focuses: ['bill', 'care', 'budget'],
    findingIds: ['f-pending-maternal', 'f-pharmacy', 'f-avoidable-ed'],
    weights: { budget: 55, care: 60, access: 45, mco: 40, district: 35, bill: 75 },
    packId: 'pack-pc-pharmacy-rural',
    copies: {
      open: 'If you need an exportable brief, open the blender with Bill Readiness elevated.',
      focuses: 'Keep Bill, Care, and Budget focuses selected for committee materials.',
      findings: 'Blend pending maternal, pharmacy, and avoidable ED findings to unlock packs.',
      weights: 'Raise bill readiness weight so ranking favors hearing-ready packs.',
      trust: 'Complete Trust so the Consideration Brief does not carry an unmarked trust warning.',
      packs: 'Choose a pack you can defend as an examination candidate for the chair.',
      packDetail: 'Open the pack and skim wins, levers, and trust caveats before export.',
      tryIt: 'Okay, now you try it. From Exportable brief, lock a different pack and re-check Trust.',
    },
  }),

  'journey-budget-cost-drivers': evidenceJourney({
    id: 'journey-budget-cost-drivers',
    roleId: 'budget-analyst',
    priorityId: 'budget-cost-drivers',
    title: 'Cost Drivers contribution path',
    roomId: 'cost-drivers',
    filters: { service: 'pharmacy', population: 'disabled' },
    preferredLeadTitle: 'Pharmacy — Disabled',
    openCopy:
      'If you want spend drivers, open Cost Drivers so contribution and PMPM stay in the analytical header.',
    filterCopy:
      'Filter Pharmacy and Disabled to isolate a high-pressure fiscal slice.',
    chartCopy:
      'Read contribution in the chart before you brief a dollar figure.',
    listCopy:
      'Sort visually for the highest contribution rows still in scope.',
    leadCopy:
      'Open {leadTitle} — watch {leadMetric} and controllability on the object page.',
    tryCopy:
      'Okay, now you try it. From Cost Drivers ALP, change service or population and re-open a lead row.',
  }),

  'journey-budget-focus-blend': blenderJourney({
    id: 'journey-budget-focus-blend',
    roleId: 'budget-analyst',
    priorityId: 'budget-focus-blend',
    title: 'Budget-weighted blend',
    focuses: ['budget', 'mco'],
    findingIds: ['f-pharmacy', 'f-inpatient-disabled', 'f-mco-withholding'],
    weights: { budget: 85, care: 40, access: 35, mco: 55, district: 25, bill: 30 },
    packId: 'pack-pc-pharmacy-rural',
    copies: {
      open: 'If you want a fiscal blend, open the blender with Budget Pressure defaults.',
      focuses: 'Keep Budget and MCO Accountability focuses on for driver comparison.',
      findings: 'Blend pharmacy, inpatient disabled, and MCO withholding findings.',
      weights: 'Keep budget weight elevated and watch how pack scores move.',
      trust: 'Review lag and rebate caveats on Trust before Action.',
      packs: 'Compare packs as fiscal examination candidates only.',
      packDetail: 'Open a pack and read budget win language against failure modes.',
      tryIt: 'Okay, now you try it. From Budget focus blend, retune weights and re-rank packs.',
    },
  }),

  'journey-budget-trust-lag': (() => {
    const j = trustJourney({
      id: 'journey-budget-trust-lag',
      roleId: 'budget-analyst',
      priorityId: 'budget-trust-lag',
      title: 'Trust rebate and encounter lag',
      filters: { freshness: 'lagged', measureType: 'cost' }, // measure-definitions dims only
      preferredLeadTitle: 'PMPM',
      copies: {
        open: 'If you need to trust the lag, open Measure Definitions before you quote a fiscal trend.',
        filters: 'Filter Lagged freshness and Cost measure types to surface rebate/encounter caveats.',
        chart: 'Confirm the chart still has a series once lag filters are applied.',
        list: 'Pick a definition row whose owner and refresh cadence you can cite.',
        lead: 'Open {leadTitle} and read limitation and refresh fields ({leadMetric}).',
        tryIt: 'Okay, now you try it. From Trust the lag, inspect a different lagged cost definition.',
      },
    });
    j.pattern = 'trust-provenance';
    return j;
  })(),

  'journey-leadership-attention': evidenceJourney({
    id: 'journey-leadership-attention',
    roleId: 'medicaid-leadership',
    priorityId: 'leadership-attention',
    title: 'Command Center attention signals',
    roomId: 'command-center',
    filters: { attention: 'intervene', region: 'east' },
    preferredLeadTitle: 'MCO quality target miss (Eastern KY)',
    openCopy:
      'If you need statewide attention signals, open the Legislative Command Center first.',
    filterCopy:
      'Filter Intervention indicated and Eastern KY so ops briefing starts with explainable change.',
    chartCopy:
      'Use the chart to see which services still drive dollar impact under attention filters.',
    listCopy:
      'Choose a finding you can explain to cabinet leadership with caveats.',
    leadCopy:
      'Open {leadTitle} ({leadMetric}) and walk provenance before escalation.',
    tryCopy:
      'Okay, now you try it. From Attention signals, change attention or region and re-open a lead row.',
  }),

  'journey-leadership-mco': evidenceJourney({
    id: 'journey-leadership-mco',
    roleId: 'medicaid-leadership',
    priorityId: 'leadership-mco',
    title: 'MCO Accountability withholding',
    roomId: 'mco',
    filters: { mco: 'mco-d', contractClass: 'contracted' },
    preferredLeadTitle: 'WellCare of Kentucky — Quality withholding',
    openCopy:
      'If you need plan accountability, open MCO Accountability for withholding and missed measures.',
    filterCopy:
      'Filter WellCare of Kentucky and Existing contractual class to focus the ops conversation.',
    chartCopy:
      'Read withholding magnitude in the chart before you brief a dollar figure.',
    listCopy:
      'Scan missed-measure and earned-back cues on the list rows.',
    leadCopy:
      'Open {leadTitle} ({leadMetric}) and check contract-class identification.',
    tryCopy:
      'Okay, now you try it. From MCO Accountability, switch plans and compare withholding.',
  }),

  'journey-leadership-ops-trust': (() => {
    const j = trustJourney({
      id: 'journey-leadership-ops-trust',
      roleId: 'medicaid-leadership',
      priorityId: 'leadership-ops-trust',
      title: 'Operational freshness before briefing',
      filters: { freshness: 'provisional', measureType: 'process' },
      preferredLeadTitle: 'Encounter completeness',
      copies: {
        open: 'If you must confirm operational trust, open Measure Definitions before a cabinet brief.',
        filters: 'Filter Provisional freshness and Process measures to see weak operational cubes.',
        chart: 'Confirm provisional filters still leave a readable series.',
        list: 'Pick a definition whose incompleteness you would disclose in the brief.',
        lead: 'Open {leadTitle} and read freshness, owner, and limitation fields.',
        tryIt: 'Okay, now you try it. From Operational trust, clear filters and find a near-current measure.',
      },
    });
    j.pattern = 'trust-provenance';
    return j;
  })(),

  'journey-policy-blend-early': blenderJourney({
    id: 'journey-policy-blend-early',
    roleId: 'policy-analyst',
    priorityId: 'policy-blend-early',
    title: 'Blend early across focuses',
    focuses: ['budget', 'care', 'access'],
    findingIds: ['f-pharmacy', 'f-postpartum', 'f-avoidable-ed'],
    weights: { budget: 55, care: 55, access: 55, mco: 45, district: 40, bill: 50 },
    packId: 'pack-mco-bh',
    copies: {
      open: 'If you want cross-domain synthesis, open the blender early with balanced focuses.',
      focuses: 'Keep Budget, Care, and Access selected so findings span domains.',
      findings: 'Blend pharmacy, postpartum, and avoidable ED findings into one examination set.',
      weights: 'Keep weights balanced, then nudge one domain to see pack re-ranking.',
      trust: 'Walk Trust so source strength stays explicit before Action.',
      packs: 'Rank Win-Win-Win packs as intervention packages to examine.',
      packDetail: 'Open a pack and note evidence level plus who may bear cost.',
      tryIt: 'Okay, now you try it. From Blend early, swap one finding and re-rank packs.',
    },
  }),

  'journey-policy-benchmarks': evidenceJourney({
    id: 'journey-policy-benchmarks',
    roleId: 'policy-analyst',
    priorityId: 'policy-benchmarks',
    title: 'Benchmarks peer context',
    roomId: 'benchmarks',
    filters: { population: 'disabled', freshness: 'lagged' },
    preferredLeadTitle: 'Avoidable ED',
    openCopy:
      'If you need peer context for interventions, open Benchmarks before you draft options.',
    filterCopy:
      'Filter Disabled population and Lagged freshness to ground the peer comparison.',
    chartCopy:
      'Read peer gaps in the chart before proposing an examination package.',
    listCopy:
      'Choose a benchmark row with a clear KY vs peer story.',
    leadCopy:
      'Open {leadTitle} ({leadMetric}) and capture gap and source fields.',
    tryCopy:
      'Okay, now you try it. From Benchmarks & outcomes, change population and reopen a peer gap.',
  }),

  'journey-policy-law-linkage': legislativeJourney({
    id: 'journey-policy-law-linkage',
    roleId: 'policy-analyst',
    priorityId: 'policy-law-linkage',
    title: 'Test pending language against evidence',
    focuses: ['bill', 'access', 'care'],
    findingIds: ['f-rural-distance', 'f-avoidable-ed'],
    lawId: 'bill-rural-access',
    copies: {
      open: 'If you need law linkage, open Legislative Analysis with access-oriented focuses.',
      workspace: 'Map rural access findings to openings and blockers in the workspace.',
      law: 'Open the rural access bill fixture and read levers against blended findings.',
      sources: 'Confirm primary-source links before you document an option to examine.',
      tryIt: 'Okay, now you try it. From Law linkage, open a gap instrument and re-check blockers.',
    },
  }),

  'journey-oversight-definitions': (() => {
    const j = trustJourney({
      id: 'journey-oversight-definitions',
      roleId: 'oversight-auditor',
      priorityId: 'oversight-definitions',
      title: 'Definitions room provenance',
      filters: { freshness: 'lagged', measureType: 'cost' },
      preferredLeadTitle: 'Total Medicaid expenditure',
      copies: {
        open: 'If you need audit-ready provenance, start in Measure Definitions & Data Quality.',
        filters: 'Filter Lagged freshness and Cost measures to isolate reporting variance.',
        chart: 'Confirm the definitions chart still responds after provenance filters.',
        list: 'Pick a row whose owner and limitation text you would preserve in an export.',
        lead: 'Open {leadTitle} and walk identification plus primary sources.',
        tryIt: 'Okay, now you try it. From Definitions room, inspect a different owner or freshness label.',
      },
    });
    j.pattern = 'trust-provenance';
    return j;
  })(),

  'journey-oversight-mco-contracts': evidenceJourney({
    id: 'journey-oversight-mco-contracts',
    roleId: 'oversight-auditor',
    priorityId: 'oversight-mco-contracts',
    title: 'MCO contract-class review',
    roomId: 'mco',
    filters: { contractClass: 'monitored', mco: 'mco-b' },
    preferredLeadTitle: 'Humana Healthy Horizons — Network adequacy',
    openCopy:
      'If you need contract-class review, open MCO Accountability for monitored plans.',
    filterCopy:
      'Filter Monitored not contracted and Humana Healthy Horizons to surface variance.',
    chartCopy:
      'Read withholding and missed-measure cues in the chart.',
    listCopy:
      'Choose a plan row you can reconcile to contract language.',
    leadCopy:
      'Open {leadTitle} ({leadMetric}) and verify contract class on Identification.',
    tryCopy:
      'Okay, now you try it. From MCO contract classes, switch to Candidate future and compare.',
  }),

  'journey-oversight-source-links': (() => {
    const j = trustJourney({
      id: 'journey-oversight-source-links',
      roleId: 'oversight-auditor',
      priorityId: 'oversight-source-links',
      title: 'Follow primary source links',
      filters: { freshness: 'recent', measureType: 'process' },
      preferredLeadTitle: 'Encounter completeness',
      copies: {
        open: 'If you need source links, open Measure Definitions and stay on provenance fields.',
        filters: 'Filter Recent freshness and Process measures for traceable operational cues.',
        chart: 'Use the chart only as a map to the definition rows you will cite.',
        list: 'Select a row with primary government source pointers.',
        lead: 'Open {leadTitle} and follow Identification / sources — never hide limitations.',
        tryIt: 'Okay, now you try it. From Source links, open another definition and verify its hrefs.',
      },
    });
    j.pattern = 'trust-provenance';
    return j;
  })(),

  'journey-steward-definitions': (() => {
    const j = trustJourney({
      id: 'journey-steward-definitions',
      roleId: 'data-steward',
      priorityId: 'steward-definitions',
      title: 'Catalog owners and limitations',
      filters: { freshness: 'near', measureType: 'utilization' },
      preferredLeadTitle: 'Avoidable ED',
      copies: {
        open: 'If you steward the catalog, live in Measure Definitions for owners and limitations.',
        filters: 'Filter Near current and Utilization to review operational cadence.',
        chart: 'Confirm cadence labels still render after filters.',
        list: 'Pick a definition whose owner and refresh cadence you would correct if wrong.',
        lead: 'Open {leadTitle} and verify owner, refresh, and limitation matrix fields.',
        tryIt: 'Okay, now you try it. From Measure Definitions, find a lagged utilization measure.',
      },
    });
    j.pattern = 'trust-provenance';
    return j;
  })(),

  'journey-steward-command-center': evidenceJourney({
    id: 'journey-steward-command-center',
    roleId: 'data-steward',
    priorityId: 'steward-command-center',
    title: 'Attention signals vs cube cuts',
    roomId: 'command-center',
    filters: { freshness: 'provisional', attention: 'incomplete' },
    preferredLeadTitle: 'MCO quality target miss',
    openCopy:
      'If you need to see which attention signals depend on cube cuts, open Command Center.',
    filterCopy:
      'Filter Provisional and Data incomplete so quality notes surface to other roles.',
    chartCopy:
      'Watch how incomplete cuts still produce chart series — label honesty matters.',
    listCopy:
      'Choose a signal whose freshness label you would want legislators to see.',
    leadCopy:
      'Open {leadTitle} ({leadMetric}) and check freshness on Identification.',
    tryCopy:
      'Okay, now you try it. From Command Center, clear incompleteness filters and compare labels.',
  }),

  'journey-steward-primary-sources': (() => {
    const j = trustJourney({
      id: 'journey-steward-primary-sources',
      roleId: 'data-steward',
      priorityId: 'steward-primary-sources',
      title: 'Keep government links current',
      filters: { freshness: 'recent', measureType: 'access' },
      preferredLeadTitle: 'Distance to care',
      copies: {
        open: 'If you maintain primary sources, open Measure Definitions and inspect government links.',
        filters: 'Filter Recent freshness and Access measures to a bounded catalog slice.',
        chart: 'Use the chart only to locate definition rows with source pointers.',
        list: 'Select a row you would spot-check for href accuracy.',
        lead: 'Open {leadTitle} and confirm primary-source labels remain accurate and current.',
        tryIt: 'Okay, now you try it. From Primary sources, open another measure type and verify links.',
      },
    });
    j.pattern = 'trust-provenance';
    return j;
  })(),
};

// Fix pattern for trust journeys that reused evidenceJourney builder
for (const journey of Object.values(SHOW_ME_JOURNEYS)) {
  if (
    journey.pattern === 'evidence-investigation'
    && journey.steps.some((s) => s.apply?.activeEvidenceId === 'measure-definitions')
    && /trust|definitions|source|lag|ops-trust|primary/i.test(journey.id)
  ) {
    journey.pattern = 'trust-provenance';
  }
}

export function getShowMeJourney(id) {
  return SHOW_ME_JOURNEYS[id] || null;
}

export function listShowMeJourneys() {
  return Object.values(SHOW_ME_JOURNEYS);
}

function validateFilters(filters, journeyId, errors) {
  if (!filters || typeof filters !== 'object') return;
  for (const [key, value] of Object.entries(filters)) {
    const allowed = DIM_IDS[key];
    if (!allowed) {
      errors.push(`${journeyId}: unknown filter dimension ${key}`);
      continue;
    }
    const ids = Array.isArray(value) ? value : [value];
    for (const id of ids) {
      if (!allowed.has(id)) errors.push(`${journeyId}: invalid ${key}=${id}`);
    }
  }
}

export function validateShowMeFixtures({
  roleProfiles = ROLE_PROFILES,
  rooms = EVIDENCE_ROOMS,
  findings = FINDINGS,
  packs = OPTION_PACKS,
  laws = LAW_INSTRUMENTS,
} = {}) {
  const errors = [];
  const journeys = listShowMeJourneys();
  if (journeys.length !== 21) errors.push(`expected 21 journeys, found ${journeys.length}`);

  const journeyIds = new Set();
  const priorityIds = new Set();
  const roomSet = new Set(rooms.map((r) => r.id));
  const findingSet = new Set(findings.map((f) => f.id));
  const packSet = new Set(packs.map((p) => p.id));
  const lawSet = new Set(laws.map((l) => l.id));

  for (const roleId of ROLE_IDS) {
    const profile = roleProfiles[roleId];
    if (!profile) {
      errors.push(`missing role profile ${roleId}`);
      continue;
    }
    if (!Array.isArray(profile.homePriorities) || profile.homePriorities.length !== 3) {
      errors.push(`${roleId}: expected 3 homePriorities`);
      continue;
    }
    for (const priority of profile.homePriorities) {
      if (!priority.id) errors.push(`${roleId}: priority missing id`);
      if (!priority.detail) errors.push(`${roleId}: priority ${priority.id} missing detail`);
      if (!priority.outcome) errors.push(`${roleId}: priority ${priority.id} missing outcome`);
      if (!priority.showMeJourneyId) {
        errors.push(`${roleId}: priority ${priority.id} missing showMeJourneyId`);
        continue;
      }
      if (priorityIds.has(priority.id)) errors.push(`duplicate priority id ${priority.id}`);
      priorityIds.add(priority.id);
      const journey = SHOW_ME_JOURNEYS[priority.showMeJourneyId];
      if (!journey) {
        errors.push(`${priority.id}: missing journey ${priority.showMeJourneyId}`);
        continue;
      }
      if (journey.roleId !== roleId) {
        errors.push(`${journey.id}: roleId mismatch for ${priority.id}`);
      }
      if (journey.priorityId !== priority.id || journey.originPriorityId !== priority.id) {
        errors.push(`${journey.id}: priority/origin mismatch`);
      }
    }
  }

  for (const journey of journeys) {
    if (journeyIds.has(journey.id)) errors.push(`duplicate journey id ${journey.id}`);
    journeyIds.add(journey.id);
    if (!PATTERNS.has(journey.pattern)) errors.push(`${journey.id}: invalid pattern`);
    if (!journey.steps?.length) errors.push(`${journey.id}: no steps`);
    const last = journey.steps?.[journey.steps.length - 1];
    if (last?.apply?.view !== 'role-home') {
      errors.push(`${journey.id}: final step must restore role-home`);
    }
    if (last?.apply?.highlightPriorityId !== journey.originPriorityId) {
      errors.push(`${journey.id}: final highlightPriorityId mismatch`);
    }
    if (last?.target !== homeTarget(journey.originPriorityId)) {
      errors.push(`${journey.id}: final target mismatch`);
    }
    if (!/okay, now you try it/i.test(last?.narrative || '')) {
      errors.push(`${journey.id}: final narrative must invite the user to try`);
    }

    for (const step of journey.steps || []) {
      if (!step.id || !step.title || !step.narrative || !step.target) {
        errors.push(`${journey.id}: step missing id/title/narrative/target`);
      }
      const apply = step.apply || {};
      if (apply.activeEvidenceId && !roomSet.has(apply.activeEvidenceId) && apply.activeEvidenceId !== null) {
        errors.push(`${journey.id}: invalid room ${apply.activeEvidenceId}`);
      }
      if (apply.activeLawId && !lawSet.has(apply.activeLawId)) {
        errors.push(`${journey.id}: invalid law ${apply.activeLawId}`);
      }
      if (apply.activePackId && !packSet.has(apply.activePackId)) {
        errors.push(`${journey.id}: invalid pack ${apply.activePackId}`);
      }
      if (Array.isArray(apply.blendedIds)) {
        for (const fid of apply.blendedIds) {
          if (!findingSet.has(fid)) errors.push(`${journey.id}: invalid finding ${fid}`);
        }
      }
      validateFilters(apply.guidedFilters, journey.id, errors);
    }
  }

  // silence unused const lint in some bundlers
  void ROOM_IDS;
  void FINDING_IDS;
  void PACK_IDS;
  void LAW_IDS;

  return { ok: errors.length === 0, errors };
}
