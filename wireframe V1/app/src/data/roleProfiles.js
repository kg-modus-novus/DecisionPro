/**
 * Role perspectives for Wireframe V1.
 * Roles tailor presentation defaults — they are not authorization boundaries.
 * All views remain aggregate / de-identified with provenance and limitations.
 */

export const ROLE_IDS = [
  'legislator',
  'legislative-staff',
  'budget-analyst',
  'medicaid-leadership',
  'policy-analyst',
  'oversight-auditor',
  'data-steward',
];

const SHARED_LIMITATIONS = [
  'Aggregate / de-identified examination fixtures only — never person-level Medicaid records or PHI.',
  'Options to examine — not prescriptions. Director / lawmaker judgment remains authoritative.',
  'Freshness, suppression, confidence, and source ownership remain first-class on every view.',
];

export const ROLE_CATEGORIES = [
  {
    id: 'legislative',
    label: 'Legislative',
    roleIds: ['legislator', 'legislative-staff'],
  },
  {
    id: 'program-fiscal',
    label: 'Program & Fiscal',
    roleIds: ['budget-analyst', 'medicaid-leadership', 'policy-analyst'],
  },
  {
    id: 'oversight-data',
    label: 'Oversight & Data',
    roleIds: ['oversight-auditor', 'data-steward'],
  },
];

export const ROLE_PROFILES = {
  legislator: {
    id: 'legislator',
    label: 'Legislator',
    shortLabel: 'Legislator',
    category: 'legislative',
    accent: '#0f766e',
    icon: 'district',
    eyebrow: 'District & constituent lens',
    purpose:
      'Orient around district impacts, constituent access, and clear options for examination before hearings or floor debate.',
    dataEmphasis: [
      'District and county enrollment and access patterns',
      'Spending and utilization trends with plain-language magnitude',
      'Outcomes versus state benchmarks',
      'Pending legislation and affected populations',
    ],
    functionality: [
      'Open district-oriented Evidence Rooms',
      'Blend focuses into Win-Win-Win option packs',
      'Generate Consideration Brief talking points',
      'Trace findings to primary government sources',
    ],
    homePriorities: [
      {
        id: 'legislator-district-story',
        title: 'District story first',
        detail:
          'If you want a district-first narrative, open County & District, filter to your region and population, and that will surface constituent-scale aggregates you can explain.',
        outcome: 'A filtered county/district slice ready to brief.',
        showMeJourneyId: 'journey-legislator-district-story',
      },
      {
        id: 'legislator-constituent-care',
        title: 'Constituent care & access',
        detail:
          'If you want care and access talking points, open Outcomes, filter to postpartum populations, and that will highlight gaps you can examine before a hearing.',
        outcome: 'A care-gap object with plain-language magnitude.',
        showMeJourneyId: 'journey-legislator-constituent-care',
      },
      {
        id: 'legislator-brief-session',
        title: 'Brief for the session',
        detail:
          'If you want a session-ready brief, blend district, care, and access findings, walk Trust, and that will unlock option packs you can export as examination candidates.',
        outcome: 'A ranked pack path into the Consideration Brief.',
        showMeJourneyId: 'journey-legislator-brief-session',
      },
    ],
    keyMeasures: [
      { label: 'District relevance', value: 'HD-67 style slices', note: 'Synthetic district fixture' },
      { label: 'Access pressure', value: '17.6 mi rural', note: 'Average distance cue' },
      { label: 'Care gap', value: '−4.7 pts', note: 'Postpartum follow-up vs target' },
    ],
    recommendedRooms: ['county', 'command-center', 'outcomes', 'utilization'],
    primaryActions: [
      { id: 'open-county', label: 'Open County & District View', view: 'evidence', evidenceId: 'county' },
      { id: 'open-blender', label: 'Open Consideration Blender', view: 'blender' },
      { id: 'open-legislation', label: 'Review Law ↔ blender', view: 'legislation' },
    ],
    navRoomOrder: [
      'county',
      'command-center',
      'outcomes',
      'utilization',
      'cost-drivers',
      'mco',
      'provider',
      'benchmarks',
      'measure-definitions',
    ],
    initialState: {
      view: 'role-home',
      activeEvidenceId: 'county',
      selectedFocuses: ['district', 'care', 'access'],
      weights: { budget: 40, care: 70, access: 65, mco: 35, district: 80, bill: 45 },
    },
    askSamHint:
      'Speak in plain language for a legislator: district impact, constituents, and options to examine — not prescriptions.',
    briefEmphasis: 'Emphasize district story, constituent care wins, and political viability caveats.',
    limitations: SHARED_LIMITATIONS,
  },
  'legislative-staff': {
    id: 'legislative-staff',
    label: 'Committee / Legislative Staff',
    shortLabel: 'Legislative Staff',
    category: 'legislative',
    accent: '#115e59',
    icon: 'hearing',
    eyebrow: 'Hearing & bill analysis lens',
    purpose:
      'Prepare committee materials: bill–evidence links, fiscal and access effects, and cited briefing packets.',
    dataEmphasis: [
      'Bill provisions and related statutes',
      'Fiscal, access, and quality effects of pending language',
      'Conflicting evidence and known limitations',
      'Stakeholder and implementation notes',
    ],
    functionality: [
      'Run Law ↔ blender analysis both directions',
      'Compare findings against pending fixtures',
      'Build Consideration Briefs with cites',
      'Drill Evidence Rooms that feed hearing questions',
    ],
    homePriorities: [
      {
        id: 'staff-law-blender',
        title: 'Law ↔ blender',
        detail:
          'If you are drafting a hearing packet, open Legislative Analysis with bill focuses active, and that will map openings and blockers to your blended findings.',
        outcome: 'A law instrument linked to blender evidence.',
        showMeJourneyId: 'journey-staff-law-blender',
      },
      {
        id: 'staff-maternal-bills',
        title: 'Maternal & access bills',
        detail:
          'If you need maternal bill evidence, open Outcomes, apply pregnant and process filters, and that will give you citeable aggregates for chair questions.',
        outcome: 'A filtered maternal outcome object for the memo.',
        showMeJourneyId: 'journey-staff-maternal-bills',
      },
      {
        id: 'staff-exportable-brief',
        title: 'Exportable brief',
        detail:
          'If you need exportable talking points, blend bill-ready findings, mark Trust reviewed, and that will let you lock a pack for the Consideration Brief.',
        outcome: 'A trusted pack ready for brief export.',
        showMeJourneyId: 'journey-staff-exportable-brief',
      },
    ],
    keyMeasures: [
      { label: 'Pending fixture', value: 'HB 412 style', note: 'Curated — verify against LRC' },
      { label: 'Bill readiness focus', value: 'On', note: 'Default blender focus' },
      { label: 'Evidence chain', value: 'Primary sources', note: 'CMS / KY DMS / LRC pointers' },
    ],
    recommendedRooms: ['command-center', 'outcomes', 'cost-drivers', 'measure-definitions'],
    primaryActions: [
      { id: 'open-legislation', label: 'Open Legislative Analysis', view: 'legislation' },
      { id: 'open-blender', label: 'Open Consideration Blender', view: 'blender' },
      { id: 'open-command', label: 'Open Command Center', view: 'evidence', evidenceId: 'command-center' },
    ],
    navRoomOrder: [
      'command-center',
      'outcomes',
      'cost-drivers',
      'utilization',
      'mco',
      'county',
      'provider',
      'benchmarks',
      'measure-definitions',
    ],
    initialState: {
      view: 'role-home',
      activeEvidenceId: 'command-center',
      selectedFocuses: ['bill', 'care', 'budget'],
      weights: { budget: 55, care: 60, access: 45, mco: 40, district: 35, bill: 75 },
    },
    askSamHint:
      'Help committee staff: cite sources, note verification needs against LRC, and keep options-to-examine framing.',
    briefEmphasis: 'Emphasize bill readiness, evidence conflicts, and implementation caveats for hearing packets.',
    limitations: SHARED_LIMITATIONS,
  },
  'budget-analyst': {
    id: 'budget-analyst',
    label: 'Budget / Fiscal Analyst',
    shortLabel: 'Budget Analyst',
    category: 'program-fiscal',
    accent: '#0369a1',
    icon: 'budget',
    eyebrow: 'Spend, drivers & scenario lens',
    purpose:
      'Inspect spending drivers, PMPM and utilization trends, and option-pack fiscal trade-offs with explicit assumptions.',
    dataEmphasis: [
      'Category spend and growth contribution',
      'Population PMPM and utilization volumes',
      'Pharmacy and inpatient pressure findings',
      'Forecast-style uncertainty and rebate lag notes',
    ],
    functionality: [
      'Prioritize Cost Drivers and Benchmarks rooms',
      'Raise Budget Pressure weights in the blender',
      'Compare option packs on budget win language',
      'Inspect measure owners and freshness on definitions',
    ],
    homePriorities: [
      {
        id: 'budget-cost-drivers',
        title: 'Cost Drivers ALP',
        detail:
          'If you want spend drivers, open Cost Drivers, filter pharmacy and population slices, and that will surface high-contribution objects for fiscal notes.',
        outcome: 'A contribution-ranked cost object with controllability cues.',
        showMeJourneyId: 'journey-budget-cost-drivers',
      },
      {
        id: 'budget-focus-blend',
        title: 'Budget focus blend',
        detail:
          'If you want a fiscal blend, raise Budget Pressure weights, blend pharmacy and inpatient findings, and that will re-rank option packs for examination.',
        outcome: 'Budget-weighted packs with explicit lag caveats.',
        showMeJourneyId: 'journey-budget-focus-blend',
      },
      {
        id: 'budget-trust-lag',
        title: 'Trust the lag',
        detail:
          'If you need to trust rebate and encounter lag, open Measure Definitions, filter lagged cost measures, and that will show owners and limitations before you quote a trend.',
        outcome: 'A lagged definition with owner and limitation text.',
        showMeJourneyId: 'journey-budget-trust-lag',
      },
    ],
    keyMeasures: [
      { label: 'Pharmacy growth', value: '+$142M', note: 'Synthetic magnitude' },
      { label: 'Inpatient days', value: '+9%', note: 'Disabled population slice' },
      { label: 'Budget weight', value: 'Elevated', note: 'Role default' },
    ],
    recommendedRooms: ['cost-drivers', 'benchmarks', 'mco', 'measure-definitions'],
    primaryActions: [
      { id: 'open-cost', label: 'Open Cost Drivers', view: 'evidence', evidenceId: 'cost-drivers' },
      { id: 'open-blender', label: 'Open Consideration Blender', view: 'blender' },
      { id: 'open-defs', label: 'Open Measure Definitions', view: 'evidence', evidenceId: 'measure-definitions' },
    ],
    navRoomOrder: [
      'cost-drivers',
      'benchmarks',
      'mco',
      'utilization',
      'command-center',
      'outcomes',
      'provider',
      'county',
      'measure-definitions',
    ],
    initialState: {
      view: 'role-home',
      activeEvidenceId: 'cost-drivers',
      selectedFocuses: ['budget', 'mco'],
      weights: { budget: 85, care: 40, access: 35, mco: 55, district: 25, bill: 30 },
    },
    askSamHint:
      'Emphasize fiscal drivers, lag, rebate caveats, and scenario comparison — not scored recommendations.',
    briefEmphasis: 'Lead with budget win / exposure language and data lag caveats.',
    limitations: SHARED_LIMITATIONS,
  },
  'medicaid-leadership': {
    id: 'medicaid-leadership',
    label: 'Medicaid Leadership',
    shortLabel: 'Medicaid Leadership',
    category: 'program-fiscal',
    accent: '#1d4ed8',
    icon: 'leadership',
    eyebrow: 'Statewide operations & accountability',
    purpose:
      'Monitor statewide program performance, MCO accountability, network access, and operational freshness of warehouse cubes.',
    dataEmphasis: [
      'Statewide and MCO performance aggregates',
      'Contract withholding and missed measures',
      'Provider and network access indicators',
      'Cube freshness and encounter completeness',
    ],
    functionality: [
      'Start in Command Center and MCO Accountability',
      'Compare plans and regions in ALPs',
      'Blend MCO and access focuses',
      'Escalate examination packs for leadership briefings',
    ],
    homePriorities: [
      {
        id: 'leadership-attention',
        title: 'Attention signals',
        detail:
          'If you need statewide attention signals, open Command Center, filter intervention-indicated slices, and that will highlight changes you can explain in an ops brief.',
        outcome: 'An attention-filtered finding ready for escalation review.',
        showMeJourneyId: 'journey-leadership-attention',
      },
      {
        id: 'leadership-mco',
        title: 'MCO Accountability',
        detail:
          'If you need plan accountability, open MCO Accountability, filter a plan and contract class, and that will surface withholding and missed-measure cues.',
        outcome: 'A plan object with withholding and contract-class fields.',
        showMeJourneyId: 'journey-leadership-mco',
      },
      {
        id: 'leadership-ops-trust',
        title: 'Operational trust',
        detail:
          'If you must confirm freshness before a cabinet brief, open Measure Definitions, filter provisional measures, and that will expose quality notes you should disclose.',
        outcome: 'A provisional definition with freshness caveats.',
        showMeJourneyId: 'journey-leadership-ops-trust',
      },
    ],
    keyMeasures: [
      { label: 'Withholding at risk', value: '$18.4M', note: 'MCO D fixture' },
      { label: 'Avoidable ED', value: '+6.1%', note: 'Access / utilization cue' },
      { label: 'MCO focus', value: 'Default on', note: 'Role blender focus' },
    ],
    recommendedRooms: ['command-center', 'mco', 'provider', 'utilization'],
    primaryActions: [
      { id: 'open-command', label: 'Open Command Center', view: 'evidence', evidenceId: 'command-center' },
      { id: 'open-mco', label: 'Open MCO Accountability', view: 'evidence', evidenceId: 'mco' },
      { id: 'open-blender', label: 'Open Consideration Blender', view: 'blender' },
    ],
    navRoomOrder: [
      'command-center',
      'mco',
      'provider',
      'utilization',
      'outcomes',
      'cost-drivers',
      'benchmarks',
      'county',
      'measure-definitions',
    ],
    initialState: {
      view: 'role-home',
      activeEvidenceId: 'command-center',
      selectedFocuses: ['mco', 'access', 'care'],
      weights: { budget: 50, care: 55, access: 60, mco: 80, district: 30, bill: 35 },
    },
    askSamHint:
      'Frame for Medicaid leadership: operations, MCO accountability, freshness, and examination options.',
    briefEmphasis: 'Highlight MCO accountability, access, and operational caveats.',
    limitations: SHARED_LIMITATIONS,
  },
  'policy-analyst': {
    id: 'policy-analyst',
    label: 'Policy Analyst',
    shortLabel: 'Policy Analyst',
    category: 'program-fiscal',
    accent: '#0e7490',
    icon: 'policy',
    eyebrow: 'Cross-domain evidence & interventions',
    purpose:
      'Combine cost, access, outcomes, and benchmarks; evaluate intervention packages with source strength made explicit.',
    dataEmphasis: [
      'Cross-domain ALP cubes and findings',
      'Peer and historical benchmarks',
      'Evidence strength and primary-source lineage',
      'Policy and program relationships via Law ↔ blender',
    ],
    functionality: [
      'Use the full Evidence Rooms suite',
      'Blend multiple focuses and adjust weights',
      'Rank Win-Win-Win packs',
      'Document options in the Consideration Brief',
    ],
    homePriorities: [
      {
        id: 'policy-blend-early',
        title: 'Blend early',
        detail:
          'If you want cross-domain synthesis, open the blender early, blend budget/care/access findings, and that will unlock intervention packages to examine.',
        outcome: 'A multi-focus blend with ranked packs.',
        showMeJourneyId: 'journey-policy-blend-early',
      },
      {
        id: 'policy-benchmarks',
        title: 'Benchmarks & outcomes',
        detail:
          'If you need peer context, open Benchmarks, filter population and freshness, and that will ground intervention ideas in KY vs peer gaps.',
        outcome: 'A benchmark object with gap and source fields.',
        showMeJourneyId: 'journey-policy-benchmarks',
      },
      {
        id: 'policy-law-linkage',
        title: 'Law linkage',
        detail:
          'If you need to test pending language, open Legislative Analysis, link a rural access bill to blended findings, and that will show openings and blockers.',
        outcome: 'A law object tied to access evidence.',
        showMeJourneyId: 'journey-policy-law-linkage',
      },
    ],
    keyMeasures: [
      { label: 'Focus tabs', value: 'Multi-select', note: 'Budget + care + access defaults' },
      { label: 'Spine', value: 'Results → Action', note: 'Walk trust before packs' },
      { label: 'Sources', value: 'Primary linked', note: 'CMS / KY / MACPAC' },
    ],
    recommendedRooms: ['outcomes', 'benchmarks', 'cost-drivers', 'utilization'],
    primaryActions: [
      { id: 'open-blender', label: 'Open Consideration Blender', view: 'blender' },
      { id: 'open-outcomes', label: 'Open Outcomes & Quality', view: 'evidence', evidenceId: 'outcomes' },
      { id: 'open-legislation', label: 'Open Legislative Analysis', view: 'legislation' },
    ],
    navRoomOrder: [
      'outcomes',
      'benchmarks',
      'cost-drivers',
      'utilization',
      'command-center',
      'mco',
      'county',
      'provider',
      'measure-definitions',
    ],
    initialState: {
      view: 'role-home',
      activeEvidenceId: 'outcomes',
      selectedFocuses: ['budget', 'care', 'access'],
      weights: { budget: 55, care: 55, access: 55, mco: 45, district: 40, bill: 50 },
    },
    askSamHint:
      'Support policy analysis: weigh evidence strength, name sources, and keep interventions as options to examine.',
    briefEmphasis: 'Balance budget, care, and access wins with explicit evidence limitations.',
    limitations: SHARED_LIMITATIONS,
  },
  'oversight-auditor': {
    id: 'oversight-auditor',
    label: 'Oversight / Auditor',
    shortLabel: 'Oversight / Auditor',
    category: 'oversight-data',
    accent: '#475569',
    icon: 'oversight',
    eyebrow: 'Traceability & variance lens',
    purpose:
      'Trace measures to sources, inspect calculation caveats, and surface missing, late, or inconsistent reporting.',
    dataEmphasis: [
      'Measure definitions, owners, and refresh history',
      'Contract requirements versus reported performance',
      'Suppression and incompleteness cues',
      'Primary-source evidence chains',
    ],
    functionality: [
      'Prioritize Measure Definitions & Data Quality',
      'Open object pages for provenance fields',
      'Use MCO Accountability for contract-class review',
      'Export brief sections that preserve caveats',
    ],
    homePriorities: [
      {
        id: 'oversight-definitions',
        title: 'Definitions room',
        detail:
          'If you need audit-ready provenance, open Measure Definitions, filter lagged cost measures, and that will show owners, sources, and limitations.',
        outcome: 'A definition object with preserved caveats.',
        showMeJourneyId: 'journey-oversight-definitions',
      },
      {
        id: 'oversight-mco-contracts',
        title: 'MCO contract classes',
        detail:
          'If you need contract-class review, open MCO Accountability, filter monitored plans, and that will surface withholding variance against contract language.',
        outcome: 'A monitored plan object for reconciliation.',
        showMeJourneyId: 'journey-oversight-mco-contracts',
      },
      {
        id: 'oversight-source-links',
        title: 'Source links',
        detail:
          'If you need primary government sources, open Measure Definitions, filter recent process measures, and that will lead you to source links without hiding limitations.',
        outcome: 'A definition with verifiable primary-source pointers.',
        showMeJourneyId: 'journey-oversight-source-links',
      },
    ],
    keyMeasures: [
      { label: 'Definitions room', value: 'Priority', note: 'Role home default' },
      { label: 'Trust spine', value: 'Required', note: 'Walk Trust before Action' },
      { label: 'Provenance', value: 'First-class', note: 'Every object / finding' },
    ],
    recommendedRooms: ['measure-definitions', 'mco', 'benchmarks', 'command-center'],
    primaryActions: [
      { id: 'open-defs', label: 'Open Measure Definitions', view: 'evidence', evidenceId: 'measure-definitions' },
      { id: 'open-mco', label: 'Open MCO Accountability', view: 'evidence', evidenceId: 'mco' },
      { id: 'open-blender', label: 'Open Consideration Blender', view: 'blender' },
    ],
    navRoomOrder: [
      'measure-definitions',
      'mco',
      'benchmarks',
      'command-center',
      'cost-drivers',
      'outcomes',
      'provider',
      'utilization',
      'county',
    ],
    initialState: {
      view: 'role-home',
      activeEvidenceId: 'measure-definitions',
      selectedFocuses: ['mco', 'budget'],
      weights: { budget: 50, care: 40, access: 40, mco: 70, district: 25, bill: 40 },
    },
    askSamHint:
      'Support oversight: emphasize provenance, lag, incompleteness, and audit-ready caveats — never hide limitations.',
    briefEmphasis: 'Preserve trust caveats and source ownership in every exported section.',
    limitations: SHARED_LIMITATIONS,
  },
  'data-steward': {
    id: 'data-steward',
    label: 'Data Steward',
    shortLabel: 'Data Steward',
    category: 'oversight-data',
    accent: '#0f766e',
    icon: 'steward',
    eyebrow: 'Catalog, lineage & quality',
    purpose:
      'Review dataset ownership, refresh cadence, measure lifecycle, suppression rules, and how quality notes surface to other roles.',
    dataEmphasis: [
      'Dataset catalog cues via Measure Definitions',
      'Refresh cadence and last-cut semantics',
      'Calculation versions and known limitations',
      'Suppression and quality rules that affect ALPs',
    ],
    functionality: [
      'Live in Measure Definitions & Command Center',
      'Inspect object-page provenance and primary sources',
      'Preview how freshness labels appear to legislators',
      'Use Ask Sam for lineage-oriented questions',
    ],
    homePriorities: [
      {
        id: 'steward-definitions',
        title: 'Measure Definitions',
        detail:
          'If you steward the catalog, open Measure Definitions, filter near-current utilization measures, and that will let you verify owners, cadence, and limitations.',
        outcome: 'A catalog row with owner and refresh fields checked.',
        showMeJourneyId: 'journey-steward-definitions',
      },
      {
        id: 'steward-command-center',
        title: 'Command Center',
        detail:
          'If you need to see which attention signals depend on cube cuts, open Command Center, filter provisional incompleteness, and that will show how quality labels appear to other roles.',
        outcome: 'An attention signal with freshness labels visible.',
        showMeJourneyId: 'journey-steward-command-center',
      },
      {
        id: 'steward-primary-sources',
        title: 'Primary sources',
        detail:
          'If you maintain government links, open Measure Definitions, filter recent access measures, and that will surface primary-source pointers to spot-check.',
        outcome: 'Verified primary-source links on a definition object.',
        showMeJourneyId: 'journey-steward-primary-sources',
      },
    ],
    keyMeasures: [
      { label: 'Cube cadence', value: 'Monthly / quarterly', note: 'Room-dependent' },
      { label: 'Suppression', value: 'First-class', note: 'Shown on ALPs' },
      { label: 'Lineage', value: 'Primary sources', note: 'Catalog + object pages' },
    ],
    recommendedRooms: ['measure-definitions', 'command-center', 'benchmarks', 'cost-drivers'],
    primaryActions: [
      { id: 'open-defs', label: 'Open Measure Definitions', view: 'evidence', evidenceId: 'measure-definitions' },
      { id: 'open-command', label: 'Open Command Center', view: 'evidence', evidenceId: 'command-center' },
      { id: 'open-benchmarks', label: 'Open Benchmarks', view: 'evidence', evidenceId: 'benchmarks' },
    ],
    navRoomOrder: [
      'measure-definitions',
      'command-center',
      'benchmarks',
      'cost-drivers',
      'outcomes',
      'mco',
      'utilization',
      'provider',
      'county',
    ],
    initialState: {
      view: 'role-home',
      activeEvidenceId: 'measure-definitions',
      selectedFocuses: ['budget', 'mco'],
      weights: { budget: 45, care: 40, access: 40, mco: 50, district: 20, bill: 25 },
    },
    askSamHint:
      'Answer as for a data steward: lineage, ownership, refresh, suppression, and how labels appear to other roles.',
    briefEmphasis: 'Call out data limitations and ownership before narrative wins.',
    limitations: SHARED_LIMITATIONS,
  },
};

export function getRoleProfile(roleId) {
  return ROLE_PROFILES[roleId] || null;
}

export function listRoleProfiles() {
  return ROLE_IDS.map((id) => ROLE_PROFILES[id]);
}

export function orderedEvidenceRooms(roleId, rooms) {
  const profile = getRoleProfile(roleId);
  if (!profile?.navRoomOrder?.length) return rooms.slice();
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const ordered = [];
  for (const id of profile.navRoomOrder) {
    const room = byId.get(id);
    if (room) {
      ordered.push(room);
      byId.delete(id);
    }
  }
  for (const room of byId.values()) ordered.push(room);
  return ordered;
}
