import { ROOM_CONFIGS } from '../data/alp/roomConfigs.js';
import { EVIDENCE_ROOMS } from '../data/fixtures.js';

const SHARED_DECISION =
  'DecisionPro surfaces examination options and evidence relationships. It does not prescribe legislation or assert causal certainty. Director / lawmaker judgment remains authoritative.';

function roomExplain(roomId) {
  const config = ROOM_CONFIGS[roomId];
  const meta = EVIDENCE_ROOMS.find((r) => r.id === roomId);
  const title = config?.title || meta?.title || 'Evidence Room';
  const blurb = meta?.blurb || config?.subtitle || 'Aggregate legislative evidence room';
  const metric = config?.metricLabel || 'Primary metric';

  return {
    id: `evidence:${roomId}`,
    title: `${title} — Explain this page`,
    pageName: title,
    overview:
      `This Evidence Room is an Analytical List Page (ALP) for ${title}. ${blurb}. Use visual filters, the content chart, and the detail list to narrow aggregates, then open an object page for a single rollup.`,
    dataDisplayed: [
      `Aggregate rows keyed to populations, regions, periods, MCOs, and room-specific dimensions.`,
      `Primary content metric: ${metric}.`,
      'List rows, KPI strip, and object-page child line items are aggregate / de-identified — not person-level and never PHI.',
    ],
    dataSource: [
      'Kentucky Medicaid analytical warehouse cubes published for legislative decision support (claims, encounters, and contract-measure extracts).',
      'Provenance on each object (e.g. Claims warehouse, Contracting Division) names the owning data steward.',
      'MCO and peer benchmarks arrive through scheduled DMS / plan reporting feeds linked to the warehouse.',
    ],
    upToDate:
      'Refresh follows each cube’s published cadence (often monthly or quarterly). Freshness labels on rows tell you how close a cut is to the latest operational data versus lagged peer measures. Check the object page and Measure Definitions room for the last refresh date and known lag.',
    whyInDecisionPro: [
      'Gives lawmakers a deep room to inspect one evidence domain before or after blending trade-offs.',
      'Supports “explain this change” style examination without implying a recommendation.',
      SHARED_DECISION,
    ],
    howToUse: [
      'Adapt visual filters (multi-select) to frame the question (population, region, period, MCO, …).',
      'Read the content chart and list together — chart for distribution, list for titled aggregates.',
      'Open a row’s object page for identification, related aggregates, and child line items.',
      'Send notable findings into the Consideration Blender via focus tabs when you return to blend & weigh.',
    ],
    schematic: {
      label: 'Evidence Room (ALP) layout',
      layout: 'alp',
      sections: [
        {
          id: '1',
          name: 'Title & page actions',
          alone: 'Identifies the room and reserved Go / Share / Adapt Filters actions.',
          system: 'Anchors which evidence domain you are in when comparing rooms or returning from the blender.',
        },
        {
          id: '2',
          name: 'Adapted filter chips & KPIs',
          alone: 'Shows active filters and high-level counts / metric totals for the current slice.',
          system: 'Use as a trust check before exporting talking points — if KPIs look thin, widen or clear filters.',
        },
        {
          id: '3',
          name: 'Visual Filters',
          alone: 'Click segments to add/remove filter values without hiding other options.',
          system: 'Filter state carries into the list and object pages; clear filters before switching rooms if you want a reset.',
        },
        {
          id: '4',
          name: 'Content chart',
          alone: 'Distributes the room metric across the content dimension (e.g. service or MCO).',
          system: 'Click columns to refine the same dimension; pair with blender weights when this room feeds a finding.',
        },
        {
          id: '5',
          name: 'Detail list / Object page',
          alone: 'Browse titled aggregates; open one for identification, related items, and child line items.',
          system: 'Object context is what you cite when adding a finding to the blender or brief.',
        },
      ],
    },
  };
}

const PAGE_EXPLAINS = {
  'state-selector': {
    id: 'state-selector',
    title: 'DecisionPro state products — Explain this page',
    pageName: 'DecisionPro state products',
    overview:
      'This state-neutral landing page introduces the DecisionPro product family and routes visitors into an explicitly identified state product. The bare URL stays neutral; Kentucky and Florida use ?state=KY and ?state=FL.',
    dataDisplayed: [
      'Kentucky and Florida product tiles with current evidence and functionality boundaries.',
      'Shared DecisionPro principles for provenance, aggregate evidence, and accountable action.',
    ],
    dataSource: ['Declarative DecisionPro product-state configuration; no analytical data is displayed on this page.'],
    upToDate: 'Product availability and evidence labels reflect the current local DecisionPro build.',
    whyInDecisionPro: [
      'Prevents an unlabeled state default and gives every state product a cohesive, shareable URL.',
      'Keeps state selection separate from the demo role selector inside each product.',
      SHARED_DECISION,
    ],
    howToUse: [
      'Choose Kentucky or Florida.',
      'On the next page, choose a demo role to enter that state product.',
      'Use the DecisionPro logo to return to this neutral landing page.',
    ],
    schematic: {
      label: 'Product routing',
      layout: 'simple',
      sections: [
        { id: '1', name: 'Bare URL', alone: 'Neutral product introduction.', system: 'No state analytical context.' },
        { id: '2', name: 'State tile', alone: 'Select Kentucky or Florida.', system: 'Writes the explicit state query.' },
        { id: '3', name: 'Role selector', alone: 'Choose a demo perspective.', system: 'Enters the selected state product.' },
      ],
    },
  },
  'role-selector': {
    id: 'role-selector',
    title: 'Choose A Role — Explain this page',
    pageName: 'Choose A Role',
    overview:
      'This is a demo-only role selector so you can see every role the system supports. In production, a userid would open the screen that matches that user’s role. Here, push a role tile to simulate logging into that role. Roles tailor navigation order, default focuses/weights, and home priorities — they are not permission boundaries.',
    dataDisplayed: [
      'Seven role tiles with purpose, data emphasis, and functionality previews.',
      'Demo-only framing that production would resolve role from userid instead of a picker.',
    ],
    dataSource: [
      'Declarative role profiles in the wireframe (no live directory or IAM integration).',
    ],
    upToDate:
      'Role profiles are static for this demo. Return via the top-bar Roles control anytime to simulate another login.',
    whyInDecisionPro: [
      'Lets demos exercise every supported role without inventing authentication.',
      'Keeps shared analytical pages instead of divergent duplicate apps.',
      SHARED_DECISION,
    ],
    howToUse: [
      'Read a tile’s data/functionality preview.',
      'Push a role tile to simulate login and open that role’s home with tailored defaults.',
      'Use Guide to replay this page’s walkthrough anytime this session.',
    ],
    schematic: {
      label: 'Demo role selector',
      layout: 'simple',
      sections: [
        {
          id: '1',
          name: 'Intro',
          alone: 'Explains demo-only role selection vs production userid → role home.',
          system: 'Sets expectation before any analytical work.',
        },
        {
          id: '2',
          name: 'Role tiles',
          alone: 'Seven pushable tiles for supported roles.',
          system: 'Simulates login, applies defaults, and opens Role Home.',
        },
      ],
    },
  },
  'role-home': {
    id: 'role-home',
    title: 'Role home — Explain this page',
    pageName: 'Role home',
    overview:
      'Role Home orients the selected perspective with priorities, key measure cues, recommended Evidence Rooms, and primary actions. Shared pages remain available in the left nav.',
    dataDisplayed: [
      'Priority cards and synthetic key measure cues for the role.',
      'Recommended rooms and primary action buttons.',
      'Shared limitations (aggregate-only, non-prescription).',
    ],
    dataSource: [
      'Role profile content plus controlled Evidence Room fixtures.',
    ],
    upToDate:
      'Measure cues are synthetic fixtures aligned to the role’s emphasis, not live dashboards.',
    whyInDecisionPro: [
      'Provides a role-specific starting map without inventing separate apps.',
      SHARED_DECISION,
    ],
    howToUse: [
      'Scan priorities, then open a recommended room or primary action.',
      'Use left nav for any shared page; Switch role to change perspective.',
    ],
    schematic: {
      label: 'Role home',
      layout: 'simple',
      sections: [
        {
          id: '1',
          name: 'Priorities',
          alone: 'What this role usually examines first.',
          system: 'Guides which Evidence Rooms and blender focuses matter.',
        },
        {
          id: '2',
          name: 'Actions',
          alone: 'Jump links into shared analytical pages.',
          system: 'Does not hide other tools.',
        },
      ],
    },
  },
  blender: {
    id: 'blender',
    title: 'Consideration Blender — Explain this page',
    pageName: 'Consideration Blender',
    overview:
      'The Consideration Blender is the primary legislative interaction surface: scan focus tabs, send findings in, weigh competing priorities, walk the question spine (Results → Action), and unlock Win-Win-Win option packs to examine — never to prescribe.',
    dataDisplayed: [
      'Focus-tab findings (magnitude, freshness, trust notes, constituency relevance).',
      'Trade-off (quadrant) map and impact radar for the current blend.',
      'Visible focus weights and ranked Win-Win-Win suggestion packs.',
      'Spine stages: Results, Path, Trajectory, Law & Pending, Trust, Action.',
    ],
    dataSource: [
      'Findings curated from Evidence Room warehouse cubes and legislative analytical services.',
      'Radar and pack ranking recalculate from blended findings × your slider weights.',
      'Law pointers on later spine steps come from the Law ↔ blender catalog of statutes, gaps, and pending measures.',
    ],
    upToDate:
      'Finding freshness follows the source room’s last published cut. Re-open an Evidence Room or check Trust notes when lagged or provisional inputs are in the blend.',
    whyInDecisionPro: [
      'Lets lawmakers see competing budget, care, access, MCO, district, and bill-readiness lenses at once.',
      'Makes trade-offs and priority weights visible before packaging a Consideration Brief.',
      SHARED_DECISION,
    ],
    howToUse: [
      'Select focus tabs, then Add to blender on 2+ findings.',
      'On Results, read the quadrant and radar (click to enlarge + explain); adjust weight sliders and watch packs reorder.',
      'Walk Path → Trajectory → Law & Pending → Trust → Action; mark trust reviewed before export when possible.',
      'Open a Win-Win-Win pack or Export Consideration Brief when ready to package examination notes.',
    ],
    schematic: {
      label: 'Blender layout',
      layout: 'blender',
      sections: [
        {
          id: '1',
          name: 'Focus tabs',
          alone: 'Parallel lenses (Budget, Care, Access, MCO, District, Bill readiness).',
          system: 'Selected tabs decide which findings appear as blender inputs.',
        },
        {
          id: '2',
          name: 'Question spine',
          alone: 'Stages the examination conversation from Results through Action.',
          system: 'Trust completion influences brief warnings; Action unlocks pack / brief export paths.',
        },
        {
          id: '3',
          name: 'Inputs ready to blend',
          alone: 'Finding cards with magnitude, freshness, and Add/Remove.',
          system: 'These become the evidence chain in the Consideration Brief.',
        },
        {
          id: '4',
          name: 'Competition surface (quadrant + radar + weights)',
          alone: 'Shows relative trade-offs and the blend profile; sliders rebalance emphasis.',
          system: 'Click charts to maximize + read guides; weight changes reshape packs and brief weights.',
        },
        {
          id: '5',
          name: 'Win-Win-Win suggestions',
          alone: 'Ranked examination packs (not prescriptions).',
          system: 'Open a pack detail or carry packs into the brief’s option table.',
        },
      ],
    },
  },

  pack: {
    id: 'pack',
    title: 'Win-Win-Win Pack — Explain this page',
    pageName: 'Win-Win-Win Option Pack',
    overview:
      'Pack detail expands one examination candidate: budget / care / political “wins,” distributional notes, levers, failure modes, trust caveats, and competition charts comparing this pack to your current blend.',
    dataDisplayed: [
      'Pack narrative wins and who may gain / bear cost.',
      'Time horizon, legal/contracting levers, failure modes, trust caveats.',
      'Quadrant of blended findings and radar with this pack overlaid on the blend profile.',
    ],
    dataSource: [
      'Option packs maintained by legislative analytical services and scored against current blender weights and findings.',
      'Competition charts reuse the same blend radar engine as Results and the Consideration Brief.',
    ],
    upToDate:
      'Pack scores refresh when you change blender findings or weights. Underlying evidence freshness still follows the source rooms cited in Trust notes.',
    whyInDecisionPro: [
      'Translates blended tensions into concrete options to examine with colleagues.',
      'Keeps “win-win-win” framing without claiming enacted policy or guaranteed outcomes.',
      SHARED_DECISION,
    ],
    howToUse: [
      'Read the three win cards, then open competition charts (maximize for how-to guides).',
      'Scan levers and failure modes before citing the pack in a brief or caucus conversation.',
      'Add to Consideration Brief or return to the blender to reweight and compare other packs.',
    ],
    schematic: {
      label: 'Pack detail layout',
      layout: 'pack',
      sections: [
        {
          id: '1',
          name: 'Pack title & disclaimer',
          alone: 'Names the examination candidate and reminds: not a prescription.',
          system: 'Title appears in brief tables and Action lists.',
        },
        {
          id: '2',
          name: 'Win grid (Budget / Care / Political)',
          alone: 'Short statements of relative upside under this pack framing.',
          system: 'Use as talking-point seeds; cross-check Trust caveats before sharing.',
        },
        {
          id: '3',
          name: 'Competition view',
          alone: 'Quadrant + radar with this pack overlaid; click to enlarge and explain.',
          system: 'Compare to blender Results — same axes, pack-specific overlay.',
        },
        {
          id: '4',
          name: 'Pack details',
          alone: 'Who gains, who may bear cost, levers, failure modes, trust caveats.',
          system: 'Feeds brief option rows and Law ↔ blender relevance tagging.',
        },
        {
          id: '5',
          name: 'Actions',
          alone: 'Add to Consideration Brief or back to blender.',
          system: 'Brief packaging is the handoff to export / colleague one-pager.',
        },
      ],
    },
  },

  brief: {
    id: 'brief',
    title: 'Consideration Brief — Explain this page',
    pageName: 'Consideration Brief',
    overview:
      'Export-oriented packaging of the current blend: problem statement, evidence chain, competition summary, option packs, status-quo trajectory, law notes, trust & gaps, constituent narrative, talking points, and explicit non-prescription disclaimer.',
    dataDisplayed: [
      'Structured brief sections 1–10 with metadata (Brief ID, date, perspective, horizon).',
      'Competition charts (opportunity quadrant + impact radar with pack overlays).',
      'Trust table, law notes, talking points, and quality / recency labels.',
    ],
    dataSource: [
      'Assembled from selected focuses, blended findings, weights, packs, and spine/trust state.',
      'Charts use the same blend engine as the blender Results stage; law notes link to the Law ↔ blender catalog.',
    ],
    upToDate:
      'The brief reflects the blend at export time. If warehouse cubes refresh or you change weights, regenerate the brief so talking points stay aligned.',
    whyInDecisionPro: [
      'Gives lawmakers a shareable examination packet for caucus or staff review.',
      'Keeps provenance, trust gaps, and non-prescription language first-class.',
      SHARED_DECISION,
    ],
    howToUse: [
      'Walk the outline rail; expand competition charts for reading guides.',
      'Copy talking points or export PDF / one-pager for packaging.',
      'If a trust warning shows, return to blender Trust before treating the brief as ready to discuss.',
    ],
    schematic: {
      label: 'Brief export layout',
      layout: 'brief',
      sections: [
        {
          id: '1',
          name: 'Brief toolbar',
          alone: 'Export / share / copy actions and back to blender.',
          system: 'Hand-off surface from examination to packaging.',
        },
        {
          id: '2',
          name: 'Outline & included inputs',
          alone: 'Jump links to sections 1–10 and weight checklist.',
          system: 'Shows which focus weights rode into this brief.',
        },
        {
          id: '3',
          name: 'Document header & disclaimer',
          alone: 'KY framing, brief ID, and non-prescription disclaimer.',
          system: 'Always retain disclaimer language when copying content out.',
        },
        {
          id: '4',
          name: 'Competition summary charts',
          alone: 'Quadrant + radar with maximize + explain.',
          system: 'Same relative picture as blender Results, frozen into the brief narrative.',
        },
        {
          id: '5',
          name: 'Packs, trajectory, trust, talking points',
          alone: 'Tables and lists for options, status quo, gaps, and colleague one-pager.',
          system: 'Primary content for staff briefings; pair with Law ↔ blender for blockers/openings.',
        },
      ],
    },
  },

  'evidence-index': {
    id: 'evidence-index',
    title: 'Evidence Rooms — Explain this page',
    pageName: 'Evidence Rooms index',
    overview:
      'Catalog of deep evidence rooms. Each room opens an Analytical List Page for a Medicaid legislative domain (command center, cost drivers, utilization, outcomes, MCO, provider, county, benchmarks, measure definitions).',
    dataDisplayed: [
      'Room cards with title and short blurb.',
      'No row-level metrics until you open a room.',
    ],
    dataSource: [
      'Registry of published Evidence Rooms maintained for DecisionPro legislative users.',
      'Each room connects to its warehouse cube when opened.',
    ],
    upToDate:
      'Room availability follows the published landscape. Open a room to see that cube’s freshness and refresh cadence.',
    whyInDecisionPro: [
      'Entry point for domain deep-dives that feed blender findings and brief evidence chains.',
      SHARED_DECISION,
    ],
    howToUse: [
      'Pick a room that matches your question (e.g. Cost Drivers for spend pressure).',
      'Filter and open aggregates, then return to the blender to weigh competing findings.',
    ],
    schematic: {
      label: 'Evidence Rooms index',
      layout: 'evidence-index',
      sections: [
        {
          id: '1',
          name: 'Rooms catalog',
          alone: 'Grid/list of evidence domains with blurbs.',
          system: 'Choose a room before blending if you need fresher domain detail.',
        },
        {
          id: '2',
          name: 'Room open action',
          alone: 'Enters the ALP for that domain.',
          system: 'Object-page findings are what you later cite in blender / brief.',
        },
      ],
    },
  },

  operational: {
    id: 'operational',
    title: 'Operational intelligence — Explain this page',
    pageName: 'Operational intelligence',
    overview:
      'Organizes public aggregate evidence around goal categories and controlled Decision Cases. Each case makes its inputs, analysis transformations, review priority, potential actions, accountable owner, authority, success measures, and guardrails inspectable.',
    dataDisplayed: [
      'A quiet Goals page with tiles for spending, coverage/access, quality gaps, contract accountability, program integrity, and trend/budget planning.',
      'A dedicated goal-detail page with Input → analysis & transformations → potential-action lanes for the selected Decision Case.',
      'Every potential action states who acts, what they do, implementation steps, expected benefit, duration, estimated cost, and estimated savings or an explicit estimate gap.',
      'Clickable explanations add provenance, authority, prerequisites, limitations, guardrails, and outcome measures.',
      'Separate Evidence & Data and Data Sources tabs for hydration, readiness, explicit gaps, source coverage, and legal/analytic limitations.',
    ],
    dataSource: [
      'Official CMS, state, HHS-OIG, USAspending, and state geospatial/publication sources linked in each row.',
      'Florida values come from the governed AHCA refresh when workbook export is permitted; export-disabled and unreconciled parameter-driven content remains an explicit Gap.',
    ],
    upToDate:
      'Kentucky values come from the generated REAL operational warehouse export, with source-specific as-of dates on the evidence cards. Every refresh re-checks publisher metadata, permissions, freshness, definitions, load history, and content hashes.',
    whyInDecisionPro: [
      'Closes the gap between finding an anomaly and assigning a controlled action with a measurable outcome.',
      'Prevents public-data signals from being mislabeled as proven waste, causality, breach, or savings.',
      SHARED_DECISION,
    ],
    howToUse: [
      'Start on Goals and choose a tile; the goal grid is replaced by its dedicated Decision Case page.',
      'Open any card to inspect where it comes from, how it was transformed, who or what it could affect, and what would invalidate it.',
      'Read each potential action as a bounded delivery brief: accountable actor, work, method, benefit, duration, cost and savings evidence.',
      'Use All goals to return to the goal index, or use the top tabs to inspect Evidence & Data and Data Sources independently.',
      'Use review priority to decide what deserves attention first; treat implementation status as a separate validation and authority gate.',
      'If an action advances, assign its named owner and track its success and balancing measures; scale, revise, or stop based on observed results.',
    ],
    schematic: {
      label: 'Goal-oriented evidence-to-action workbench',
      layout: 'operational',
      sections: [
        { id: '1', name: 'Goal', alone: 'Choose the outcome to examine.', system: 'Review priority and readiness remain distinct.' },
        { id: '2', name: 'Inputs', alone: 'Observed evidence and explicit gaps.', system: 'Period, grain, definition, source, and limitation.' },
        { id: '3', name: 'Transform', alone: 'Reconcile and test explanations.', system: 'Rules, joins, assumptions, and invalidation conditions.' },
        { id: '4', name: 'Potential actions', alone: 'Controlled options—not prescriptions.', system: 'Owner, authority, prerequisites, safeguards, and measures.' },
      ],
    },
  },

  sources: {
    id: 'sources',
    title: 'Authoritative sources — Explain this page',
    pageName: 'Authoritative sources',
    overview:
      'Source catalogue, explicit gaps, loaded-vs-available spectrum, reconciliation evidence, timeline, and accuracy gate for DecisionPro public data.',
    dataDisplayed: [
      'Publisher/source-system rows with load state, scale, periods, resultant cubes, and provenance.',
      'Explicit gaps and the authorization, license, or feed required to close them.',
      'Source Reconciliation and accuracy-gate results.',
    ],
    dataSource: ['XenoDroid BW source catalogue, PSA/load history, cube exports, and reconciliation records.'],
    upToDate: 'Each row carries source and bind freshness; open Source Timeline for publication and load history.',
    whyInDecisionPro: ['Makes trust and limitations inspectable before evidence enters a decision.', SHARED_DECISION],
    howToUse: ['Filter by load state, open a source row, and review reconciliation before citing a value.'],
    schematic: {
      label: 'Source trust path',
      layout: 'sources',
      sections: [
        { id: '1', name: 'Catalogue', alone: 'Publisher and access contract.', system: 'FromSysID and attribution.' },
        { id: '2', name: 'Load', alone: 'PSA and period evidence.', system: 'Hash, history, and load class.' },
        { id: '3', name: 'Reconcile', alone: 'Owning-source comparison.', system: 'Accuracy claim gate.' },
      ],
    },
  },

  legislation: {
    id: 'legislation',
    title: 'Law ↔ blender — Explain this page',
    pageName: 'Legislative Analysis (Law ↔ blender)',
    overview:
      'Maps statutes, gaps, and pending-legislation instruments to the current blender focuses, findings, and active pack — highlighting relative blockers and openings for examination. Cite links open a legislation object page.',
    dataDisplayed: [
      'Law instruments with kind, cite, title, and relevance / blocker / opening scores.',
      'Focus and pack context used for scoring.',
      'Hyperlinks from cites into statute / pending-bill / gap object pages.',
    ],
    dataSource: [
      'Legislative Research Commission and related statutory / pending-measure catalogs curated for DecisionPro.',
      'Scores depend on selected focuses and active pack tags from the Consideration Blender.',
    ],
    upToDate:
      'Verify cites and bill status against official LRC / General Assembly sources before legislative use. Scores refresh when blender context changes.',
    whyInDecisionPro: [
      'Connects evidence trade-offs to legal/contracting constraints and openings.',
      'Supports the spine’s Law & Pending stage with a dedicated workspace.',
      SHARED_DECISION,
    ],
    howToUse: [
      'Review top-scored instruments for your current blend.',
      'Open a cite hyperlink for executive summary, primary sources, relevance, and related opinions.',
      'Note blocker vs opening strength before writing brief law notes.',
      'Return to the blender Trust / Action stages or open Evidence Rooms for related aggregates.',
    ],
    schematic: {
      label: 'Law ↔ blender layout',
      layout: 'legislation',
      sections: [
        {
          id: '1',
          name: 'Context strip',
          alone: 'Shows focuses / pack context driving scores.',
          system: 'Change blender selection to reshuffle relevance.',
        },
        {
          id: '2',
          name: 'Instrument list',
          alone: 'Laws/bills with blocker, opening, and relevance.',
          system: 'Cite links open object pages; select rows for the draft workspace.',
        },
        {
          id: '3',
          name: 'Back to blender',
          alone: 'Returns to blend & weigh.',
          system: 'Keeps law examination inside the same decision loop as packs and brief.',
        },
      ],
    },
  },

  'law-object': {
    id: 'law-object',
    title: 'Legislation object — Explain this page',
    pageName: 'Legislation object page',
    overview:
      'Object page for a statute, pending bill, or statutory/contract gap: executive summary with primary authoritative source links, detailed analysis, why it is relevant to the current blender analysis, and a list of related opinion/analysis web pages.',
    dataDisplayed: [
      'Instrument cite, kind, status, blocker / opening / relevance scores.',
      'Executive summary and primary authoritative source hyperlinks.',
      'Detailed analysis and current-analysis relevance narrative.',
      'Related opinions & analyses list (external web pages).',
    ],
    dataSource: [
      'Curated DecisionPro legislation catalog with LRC / General Assembly / CMS-facing primary sources.',
      'Related opinion links are third-party analyses — not Kentucky legal advice.',
    ],
    upToDate:
      'Pending bill numbers and statuses are curated fixtures until a live LRC feed is linked. Always verify against the Legislative Record.',
    whyInDecisionPro: [
      'Turns every law/bill reference into a navigable examination object.',
      'Separates authoritative sources from related opinions.',
      SHARED_DECISION,
    ],
    howToUse: [
      'Read the executive summary and open primary sources first.',
      'Use the relevance section to connect the instrument to the active blend.',
      'Scan related opinions last — they are not authoritative.',
      'Return via Back, or open the Law ↔ blender workspace for draft wording.',
    ],
    schematic: {
      label: 'Legislation object layout',
      layout: 'legislation',
      sections: [
        {
          id: '1',
          name: 'Executive summary',
          alone: 'Summary plus primary authoritative source links.',
          system: 'Start here before reading related opinions.',
        },
        {
          id: '2',
          name: 'Detailed analysis & relevance',
          alone: 'Deeper instrument narrative tied to blender context.',
          system: 'Explains why this cite appears in the current examination.',
        },
        {
          id: '3',
          name: 'Related opinions list',
          alone: 'External analysis / opinion pages.',
          system: 'Contrast only — not LRC counsel.',
        },
      ],
    },
  },
};

/**
 * Resolve explain content for the current app view.
 * @param {{ view: string, evidenceRoomId?: string | null, lawInstrumentId?: string | null, roleId?: string | null, roleEmphasis?: string | null }} ctx
 */
export function resolvePageExplain(ctx = {}) {
  const { view, evidenceRoomId = null, roleEmphasis = null } = ctx;
  let explain = null;
  if (view === 'state-selector') explain = PAGE_EXPLAINS['state-selector'];
  else if (view === 'role-selector') explain = PAGE_EXPLAINS['role-selector'];
  else if (view === 'role-home') explain = PAGE_EXPLAINS['role-home'];
  else if (view === 'blender') explain = PAGE_EXPLAINS.blender;
  else if (view === 'pack') explain = PAGE_EXPLAINS.pack;
  else if (view === 'brief') explain = PAGE_EXPLAINS.brief;
  else if (view === 'operational') explain = PAGE_EXPLAINS.operational;
  else if (view === 'sources') explain = PAGE_EXPLAINS.sources;
  else if (view === 'legislation') explain = PAGE_EXPLAINS.legislation;
  else if (view === 'law-object') explain = PAGE_EXPLAINS['law-object'];
  else if (view === 'evidence') {
    if (evidenceRoomId && ROOM_CONFIGS[evidenceRoomId]) explain = roomExplain(evidenceRoomId);
    else explain = PAGE_EXPLAINS['evidence-index'];
  } else {
    explain = PAGE_EXPLAINS.blender;
  }

  if (String(ctx.stateCode || '').toUpperCase() === 'FL' && explain) {
    const roomName = evidenceRoomId ? String(evidenceRoomId).replace(/^fl-/, '').replaceAll('-', ' ') : null;
    explain = {
      ...explain,
      title: `${explain.pageName} — DecisionPro Florida`,
      overview: view === 'evidence' && roomName
        ? `This Florida Evidence Room examines ${roomName} using permitted AHCA public aggregates, retained provenance, publisher status, and explicit gaps. It does not expose person-level records or replace Florida AHCA as source of record.`
        : `${explain.overview} In DecisionPro Florida, this surface uses the governed AHCA and federal evidence bundle and keeps Florida-specific permission, definition, period, and reconciliation limits visible.`,
      dataSource: [
        'Florida AHCA public dashboards and permitted exports, refreshed with an honest DecisionPro user agent, permission gate, retained configuration, content hash, citation, and reference-only boundary.',
        'Federal public sources may provide comparable context only after program, population, definition, denominator, and reporting-period alignment.',
        'Quality Initiatives and Malpractice Claims remain rendered-reference gaps while publisher data export is disabled.',
      ],
      upToDate: 'Each Florida refresh rechecks robots/content policy, per-workbook export permission, workbook publication metadata, content hashes, row quality gates, and explicit gaps. The displayed as-of period comes from the data where available rather than assuming workbook publish time is the measurement period.',
    };
  }

  if (roleEmphasis && explain) {
    return {
      ...explain,
      overview: `${explain.overview} Role perspective note: ${roleEmphasis}`,
    };
  }
  return explain;
}

export { PAGE_EXPLAINS, roomExplain };
