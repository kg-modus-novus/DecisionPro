/**
 * Info-popovers for ALP KPI and visual-filter tiles.
 * Explains treat warehouse measures as operational legislative decision-support data.
 */

import {
  FILTER_PRIMARY_SOURCES,
  primarySourcesForRoom,
  sources,
} from '../data/alp/primarySources.js';
import { catalogueFromSysIdsForRoom } from './alpCube.js';

function catalogueSourcesForRoom(roomId) {
  return catalogueFromSysIdsForRoom(roomId).map((fromSysId) => ({
    fromSysId,
    label: fromSysId,
  }));
}

const FILTER_EXPLAINS = {
  population: {
    title: 'Population',
    about:
      'Medicaid eligibility / coverage groups used to slice the warehouse cube (e.g. Children/CHIP, Expansion, Aged, Disabled).',
    source:
      'Enrollment and eligibility extracts from the Kentucky Medicaid analytical warehouse, aligned to DMS coverage categories.',
    terms: [
      'All Medicaid — no population filter applied.',
      'CHIP / Expansion / Aged / Disabled / Pregnant — coverage cohorts for legislative examination.',
    ],
    useTile:
      'Click a bar to add that population to the filter; click again to remove. Multi-select is additive (OR within Population). Use the dropdown for a single value or All.',
    useData:
      'Narrow to the coverage cohort you are examining so cost, access, and quality signals are not averaged away across dissimilar groups. Compare Expansion vs Aged/Disabled when budget pressure and care results may diverge.',
  },
  region: {
    title: 'Region',
    about: 'Kentucky geographic regions used for aggregate rollups (Eastern, Central, Western, Northern KY).',
    source: 'Regional attributes on warehouse cubes derived from county / service-area mappings maintained for legislative views.',
    terms: ['Statewide may appear in some rooms as an all-region cue; visual bars usually omit statewide for contrast.'],
    useTile: 'Click bars to add/remove regions. Multiple regions stay visible and selectable.',
    useData:
      'Focus on the regions that match your district story or oversight question. Eastern vs Northern KY often surface different access and utilization patterns; multi-select when you need a side-by-side regional scan.',
  },
  period: {
    title: 'Period',
    about: 'State fiscal-year quarters for the time series (e.g. FY2024 Q4 through FY2025 Q3).',
    source: 'Warehouse cube period keys published on the DMS analytical calendar for Medicaid legislative reporting.',
    terms: [
      'FY24 Q4 / FY25 Q1–Q3 — short labels on the chart axis; full labels in the dropdown.',
      'Points show relative metric or count by quarter under other active filters.',
    ],
    useTile:
      'Click a plot point to add that quarter; click again to remove. Multi-select keeps several quarters active. Dropdown sets a single period or All.',
    useData:
      'Filter to recent periods to see the current trajectory; filter to older periods to recover the prior baseline. Select two or more quarters when you want to compare how the same slice moved over time before blending a finding.',
  },
  mco: {
    title: 'MCO',
    about: 'Managed care organization plan slices used in contract and quality reporting.',
    source: 'Plan identifiers from Medicaid managed-care contract files and encounter / quality submissions in the warehouse.',
    terms: ['MCO codes identify contracted plans for aggregate comparison — never member-level attribution.'],
    useTile: 'Click donut segments or legend rows to toggle MCO filters. Multi-select is supported.',
    useData:
      'Isolate one plan when examining withholding, network, or encounter completeness, or multi-select to compare plans that share a contract cycle. Useful before packaging MCO accountability options.',
  },
  freshness: {
    title: 'Freshness',
    about: 'How current the underlying measure cut is relative to KY operational data versus lagged peers.',
    source: 'Published with each warehouse measure cut by the owning data steward (claims ops vs peer/HEDIS pipelines).',
    terms: [
      'Near current — operational claims/encounters close to the latest available cut.',
      'Recent — settled enough for trends; may still revise with run-out.',
      'Lagged — peer/national or HEDIS-style measures that trail KY ops data by design.',
      'Provisional — early/incomplete cuts; useful for scanning, not firm conclusions.',
    ],
    useTile:
      'Click a donut slice or legend row to filter to that freshness; click again to clear. Compare lagged vs near-current before blending findings.',
    useData:
      'Prefer near-current or recent cuts when framing session-ready talking points. Keep lagged peer measures available for context, but filter them out when you need operational KY claims without mixing timelines.',
  },
  service: {
    title: 'Service',
    about: 'Service category rollups (inpatient, pharmacy, ED, outpatient, BH, LTC, primary, maternal).',
    source: 'Claims and encounter service taxonomy mapped in the cost and utilization warehouse cubes.',
    terms: [],
    useTile: 'Toggle service bars to narrow the ALP list and content chart.',
    useData:
      'Zoom into the service line driving budget or access concern (e.g. pharmacy vs ED). Separating services keeps contribution-to-increase readable and avoids attributing growth to the wrong category.',
  },
  attention: {
    title: 'Attention',
    about: 'Watch-status style tags for legislative scanning (on target, watch, intervene, incomplete).',
    source: 'Derived attention bands from Command Center measure rules maintained by legislative analytical services.',
    terms: [
      'Intervention indicated — elevated signal for examination, not a mandate.',
      'Data incomplete — trust/coverage gap cue.',
    ],
    useTile: 'Filter command-center style rooms to attention bands before opening object pages.',
    useData:
      'Start with Intervention indicated or Watch to triage what deserves a blender finding. Use Data incomplete to surface trust gaps before you package a brief.',
  },
  measureType: {
    title: 'Measure type',
    about: 'Typed measure families (cost, utilization, outcome, process, access, equity).',
    source: 'Measure Definitions catalog owned with DMS / quality reporting stewards.',
    terms: [],
    useTile: 'Use to isolate definition / quality rows by measure family.',
    useData:
      'Separate outcome vs process vs access measures so peer gaps are not compared across unlike metric families. Useful when pairing care-result findings with budget pressure.',
  },
  contractClass: {
    title: 'Contract class',
    about: 'Whether a measure sits in existing contract language, monitored-only, or candidate future.',
    source: 'Contracting Division measure inventories linked to MCO accountability cubes.',
    terms: [
      'Existing contractual — already in contract language.',
      'Monitored not contracted — watched but not withheld.',
      'Candidate future — examination candidate only.',
    ],
    useTile: 'Toggle donut segments to compare contractual vs candidate slices.',
    useData:
      'Filter to Existing contractual when examining today’s withholding levers; use Candidate future when scanning options that would require contract or statute change.',
  },
  providerGroup: {
    title: 'Provider group',
    about: 'Delivery-system / provider-group rollups for performance comparison.',
    source: 'Provider network groupings in the delivery-system warehouse views (aggregate only).',
    terms: [],
    useTile: 'Filter provider-room aggregates by group; open rows for risk-adjusted context.',
    useData:
      'Compare delivery-system groups when access or quality pressure concentrates in a network type. Always read risk-adjusted context on the object page before attributing performance.',
  },
  county: {
    title: 'County',
    about: 'Kentucky counties with house-district cues for district story framing.',
    source: 'County attributes on warehouse cubes joined to legislative district crosswalks.',
    terms: ['District codes (e.g. HD-67) are constituency cues for aggregate views.'],
    useTile: 'Select counties to focus county-room lists and charts.',
    useData:
      'Focus on counties in your district or a peer set to build a constituency-ready narrative. Keep views aggregate — county filters frame geography, not individuals.',
  },
  benchmarkType: {
    title: 'Benchmark type',
    about: 'Benchmark family used for gap comparisons (state, peer, national-style).',
    source: 'Benchmark Definitions and peer feeds published into the Benchmarks room cube.',
    terms: [],
    useTile: 'Filter which benchmark comparisons appear in the list.',
    useData:
      'Choose the benchmark family that matches the hearing question (state peer vs national-style). Mixing families without labels can exaggerate or hide gaps.',
  },
};

/**
 * Room-specific “How to Use this Data” copy for visual filters.
 * Keys: roomId → filterKey → prose.
 */
const ROOM_FILTER_USE_DATA = {
  county: {
    period:
      'Filter to recent periods to understand recent patterns in a county or district. Filter to older periods to see what those patterns used to be, and select both when you want to compare how county or district metrics have changed over time.',
    population:
      'Narrow to the coverage group that matters for the district story (e.g. Expansion adults vs Children/CHIP) so county comparisons are not diluted by statewide mix.',
    region:
      'Use region together with county when you need a wider geographic frame around a district, then drill into specific counties for the brief.',
    county:
      'Select the counties in or adjacent to your district to build a focused vs-state narrative without scanning the full statewide list.',
    mco:
      'When a county’s MCO mix matters for access or quality talking points, filter to the plans serving that geography before opening object pages.',
  },
  'cost-drivers': {
    period:
      'Filter to the most recent quarters to see where spend growth is landing now; add an earlier quarter when you need a before/after contribution comparison for budget hearings.',
    service:
      'Isolate the service line (pharmacy, ED, inpatient, etc.) that contributes most to the increase so the content chart and list stay decision-relevant.',
    population:
      'Separate coverage cohorts when growth is concentrated in Expansion, Aged, or Disabled — statewide averages often hide the controllable driver.',
    region:
      'Focus regions where contribution-to-increase is outsized relative to enrollment so rural vs metro budget stories stay distinct.',
    mco:
      'Compare plans when stewardship or formulary patterns differ; useful before packaging pharmacy or ED-related option packs.',
  },
  'command-center': {
    period:
      'Recent periods surface current attention signals; older periods help you see whether a watch item is new or persistent before you escalate it into the blender.',
    attention:
      'Filter to Intervention indicated or Watch to triage the session agenda; keep Data incomplete visible when trust caveats may block a clean narrative.',
    freshness:
      'Prefer near-current signals for session readiness; filter lagged peers out when you need operational KY claims without mixed timelines.',
  },
  utilization: {
    period:
      'Recent periods show current access and utilization rates; older periods recover the prior access baseline so you can judge whether rural or ED pressure is new.',
    region:
      'Focus the regions (often Eastern or Western KY) where distance and avoidable ED patterns concentrate for access oversight.',
    measureType:
      'Separate access vs utilization measure families so rate comparisons stay like-for-like when pairing with care-result findings.',
  },
  outcomes: {
    period:
      'Recent periods show current quality performance; older periods and multi-select help you see whether a gap is closing or widening before you cite it.',
    freshness:
      'Filter near-current KY outcomes separately from lagged peer/HEDIS cuts so peer gaps are not read as same-period shortfalls.',
    measureType:
      'Keep outcome, process, and access measures in separate filters when packaging care-result options.',
  },
  mco: {
    period:
      'Align periods to the contract or withholding cycle you are examining so earned-back and missed-measure counts map to the right reporting window.',
    contractClass:
      'Existing contractual isolates today’s levers; Candidate future isolates examination options that would need contract or statute change.',
    mco:
      'Single-plan filters support accountability questions; multi-select supports peer comparison across plans in the same cycle.',
  },
  provider: {
    period:
      'Recent periods show current delivery-system performance; older periods help separate one-time spikes from sustained risk-adjusted gaps.',
    region:
      'Regional filters highlight where network or social-risk context concentrates before you open provider object pages.',
  },
  benchmarks: {
    period:
      'Match the period of the KY cut to the benchmark family’s publication window so gap points are not artifacts of mismatched timelines.',
    freshness:
      'Filter lagged national-style benchmarks separately when the hearing question is about near-current KY operational performance.',
    population:
      'Keep coverage cohorts aligned with the benchmark definition so equity or Expansion comparisons stay valid.',
  },
  'measure-definitions': {
    period:
      'Filter to the publication window of the definition cut you are reviewing when freshness or cadence notes differ by quarter.',
    freshness:
      'Isolate lagged or provisional definitions when documenting known limitations for Trust notes or briefs.',
    measureType:
      'Browse one measure family at a time when reconciling owners, sources, and limitations for a blender finding.',
  },
};

function resolveFilterUseData(filterKey, roomId, fallback) {
  const roomMap = roomId ? ROOM_FILTER_USE_DATA[roomId] : null;
  if (roomMap && roomMap[filterKey]) return roomMap[filterKey];
  return fallback;
}

export function kpiTileExplain(kind, config) {
  const metricLabel = config?.metricLabel || 'Primary metric';
  const room = config?.title || 'this Evidence Room';
  const roomSources = primarySourcesForRoom(config?.roomId);
  const catalogueSources = catalogueSourcesForRoom(config?.roomId);
  if (kind === 'metric') {
    return {
      title: metricLabel,
      about: `Sum of the content-chart series for ${room} under the current visual filters.`,
      source: `Kentucky Medicaid warehouse aggregates for ${room}, totaled across the chart’s content dimension after filters.`,
      primarySources: roomSources,
      catalogueSources,
      terms: [
        'Sum of content chart series — adds the visible chart columns for the filtered slice.',
        'Values change when you adapt visual filters.',
      ],
      useTile:
        'Read alongside the content chart. Clear or change filters to see how the total moves. Not clickable itself.',
      useData: `Use this total as a scale check for ${room}: if filters change the number sharply, the chart and list are concentrating on a material slice worth examining further.`,
    };
  }
  if (kind === 'aggregates') {
    return {
      title: 'Aggregates in scope',
      about: 'How many aggregate rows match the current filters (list cardinality).',
      source: 'Count of warehouse rollup rows returned for this room after visual filters.',
      primarySources: roomSources,
      catalogueSources,
      terms: ['Filtered list cardinality — count of rollup rows, not members or claim lines.'],
      useTile:
        'Use as a scale check before opening the detail list. Narrow filters if the list is too large to scan.',
      useData:
        'A large count means you are still looking at a broad cut — tighten population, region, period, or service before packaging a finding. A small count means the filtered story is already focused enough to open rows.',
    };
  }
  if (kind === 'claims') {
    return {
      title: 'Claim lines represented',
      about: 'Scale cue for how many claim lines the in-scope aggregates stand in for.',
      source: 'Derived from warehouse claim-line factors published with each aggregate cube.',
      primarySources: roomSources.length ? roomSources : sources('kyDms', 'medicaidData', 'cmsDataSearch'),
      catalogueSources,
      terms: ['~ approximate — rounded for legislative scale reading, not an audit total.'],
      useTile:
        'Treat as a size cue when comparing rooms or filter sets. Never interpret as person-level volume.',
      useData:
        'Use the claim-line scale to judge whether a pattern is large enough for budget or access oversight, while staying strictly aggregate and de-identified.',
    };
  }
  if (kind === 'realRows') {
    return {
      title: 'REAL / Gap rows',
      about: 'Count of public-REAL and labeled Gap rows in this Evidence Room under current filters.',
      source: 'XenoDroid BW LoadClass=REAL hydration export — no synthetic claim-line expansion.',
      primarySources: roomSources,
      catalogueSources,
      terms: [
        'REAL — published aggregate/meta with provenance.',
        'Gap — explicit missing feed; not filled with invented magnitudes.',
      ],
      useTile: 'Use as a scale check for how many honest public rows are in scope.',
      useData:
        'If you need claim-grain volume, that remains a labeled Gap / paid DUA follow-on — do not read this count as claim lines.',
    };
  }
  return {
    title: 'Active visual filters',
    about: 'Count of selected visual-filter values currently applied (each multi-select value counts).',
    source: 'Derived from your current ALP filter selections in this session.',
    primarySources: roomSources,
    catalogueSources,
    terms: ['Click charts to refine — reminder that filters come from the Visual Filters row.'],
    useTile:
      'Clear chips above or Clear Filters to reset. Opening a filter’s info (i) explains that dimension.',
    useData:
      'A non-zero count means the chart and list are already scoped — cite those filters when you add a finding so Trust notes and briefs stay aligned with what you examined.',
  };
}

export function filterTileExplain(filter, config) {
  const key = filter?.key;
  const roomId = config?.roomId;
  const found = FILTER_EXPLAINS[key];
  const primarySources = FILTER_PRIMARY_SOURCES[key]
    ? FILTER_PRIMARY_SOURCES[key].map((s) => ({ ...s }))
    : primarySourcesForRoom(roomId);
  const catalogueSources = catalogueSourcesForRoom(roomId);
  if (found) {
    return {
      ...found,
      primarySources,
      catalogueSources,
      useData: resolveFilterUseData(key, roomId, found.useData),
    };
  }
  return {
    title: filter?.label || 'Visual filter',
    about: `Visual filter for ${filter?.label || 'this dimension'} on the Analytical List Page.`,
    source: 'Kentucky Medicaid warehouse dimension published for this Evidence Room.',
    primarySources,
    catalogueSources,
    terms: [],
    useTile: 'Click chart elements to add/remove filter values; use the dropdown for All or a single value.',
    useData: `Filter on ${filter?.label || 'this dimension'} to focus the room on the slice that matches your legislative question, then open rows for provenance and limitations.`,
  };
}
