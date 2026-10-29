// CodeXen: v1 not-applicable
// "Explain this Page" for simple mode: what each tab and sub-tab shows, where its
// data comes from, how current it is, how to use it, and the explainer videos
// made for it. Presentation only. The page map, sources and data age are read
// from the page's own configuration (PAGES) and measures, so they follow the page;
// the prose is written per tab and sub-tab.
import { PAGES, COUNTY_SUBTABS, HOSPITAL_SUBTABS, SIMPLE_TABS } from './simpleAreas.js';
import { MEASURES } from './sourcedData.js';
import { DATA_LAG_NOTE, freshnessRange } from './dataAge.js';
import { effectiveSubtab, explainerFor } from './explainers.js';

const WHY = 'DecisionPro Kentucky puts the public record on Kentucky Medicaid in one place, in plain numbers, so legislators and staff can ask better questions. It does not recommend legislation, and it labels every estimate.';
const CARD_USE = 'Each card shows the figure, the period it covers and how old it is. Open “How measured” for its definition, inclusions and exclusions, and set “My target” to track it.';
const PUBLIC_ONLY = 'Public, aggregate data only; no person-level records.';

// Written per tab: overview, what is shown, sources and how to use it.
const TAB_TEXT = {
  'simple-home': {
    overview: 'Kentucky Medicaid at a glance: a briefing strip of the most decision-relevant findings, then a dashboard of headline figures you can pin, reorder or hide.',
    data: ['Headline tiles for spending, members, access, quality, plans and waitlists.', 'Briefings that join two or more sources into one finding, with the open question it raises.'],
    sources: ['CMS, MACPAC, Kentucky DMS and CHFS reports, CDC, HRSA and the Census Bureau; each tile names its source.'],
    use: ['Start with the briefings, then open any tile to go to its page.', 'Use the filters to look at one population or place.', CARD_USE],
  },
  'simple-access': {
    overview: 'Can Medicaid members get care? Shortage areas, providers who take Medicaid, appointment waits, travel distance and hospital use, plus rural access, a payment scenario and social vulnerability.',
    data: ['County maps and cards for providers, shortage designations, travel times and hospital or emergency use.'],
    use: ['Pick a measure on the map and click a county for its figures.', CARD_USE],
  },
  'simple-spending': {
    overview: 'Where is Medicaid money going? Total spending and who pays it, what it buys, why it changed, what it costs to run the program, and prescription drugs.',
    data: ['Federal and state spending, spending per member, spending by category, directed payments, administrative cost and pharmacy spending.'],
    use: ['Read the totals first, then what changed and why.', CARD_USE],
  },
  'simple-outcomes': {
    overview: 'Is members’ health improving? The quality measures KRS 7A.287 requires for the managed care plans, then the rest of Kentucky’s federal Core Set reporting, each against the median state; plus health estimates for any county, district or zip code.',
    data: ['Medicaid Core Set rates by year, against the median state, with method breaks marked.', 'Health plan comparisons on the same measures.'],
    use: ['A change across a method break is not improvement or decline.', CARD_USE],
  },
  'simple-states': {
    overview: 'Kentucky against every reporting state on the FFY 2025 Medicaid Core Set (Commissioner Lee’s request): rank, quarter, the median and middle half of states, and the 2023–2025 trend.',
    data: ['91 Core Set measures for every reporting state, with Kentucky and chosen peers highlighted.', 'Flags for measures states report differently or did not report.'],
    sources: ['CMS FFY 2025 Child and Adult Core Set (updated September 2026), with CMS trend guidance.'],
    use: ['Choose a measure, then highlight neighbors or peer states.', 'Read the method notes before comparing across a specification change.'],
  },
  'simple-plans': {
    overview: 'Who is responsible: the managed care plans side by side, every contract with its cost and the outcomes it is held to, prior authorization, provider paperwork, quality money at stake, and sanctions.',
    data: ['Plan contracts, enrollment, scorecard, prior authorization, claims and credentialing, withholds and sanctions.'],
    use: ['Compare plans only on measures marked comparable.', CARD_USE],
  },
  'simple-hospitals': {
    overview: 'How Kentucky hospitals are doing, framed as Indiana presented it: margins in thirds, commercial prices against Medicare, what Medicaid pays, each hospital’s figures, and community benefit.',
    data: ['Margins, cash, Medicaid share of revenue and system ownership by hospital.', 'Commercial prices as a percent of Medicare and in dollars per stay.'],
    sources: ['CMS hospital cost reports, CMS ownership files, RAND hospital price study, IRS Form 990 Schedule H, Kentucky’s hospital rate program documents.'],
    use: ['Keep rural, critical access and independent hospitals separate when comparing.', 'Use percent of Medicare to compare hospitals; dollars give scale.'],
  },
  'simple-rates': {
    overview: 'What Medicare and Medicaid pay for the same care: Medicare’s fee schedule by state, Kentucky Medicaid as a percent of it, how far rates spread between states, deprivation and what Medicaid pays, and procedure codes across states.',
    data: ['Fee schedule rates, percent of Medicare, rate spreads and T-MSIS paid amounts.'],
    use: ['Every fee comparison is in dollars, for the same code, setting (so the same bundle) and unit; anything left out says why.'],
  },
  'simple-waivers': {
    overview: 'Who is waiting for home and community services: Kentucky’s 1915(c) waiver waitlists, slots, where the people waiting live, whether services start once a slot is offered, and what waivers cost.',
    data: ['Waitlist counts, slots funded and filled, days waiting, county estimates, workforce and cost per member.'],
    use: ['County waitlist figures are estimates; each says how it was made.', CARD_USE],
  },
  'simple-ltc': {
    overview: 'Nursing homes and long-term care, paid outside managed care in Kentucky: what Medicaid spends, whether the rate covers cost, beds by county, how residents fare and how homes are staffed.',
    data: ['Spending, rates against cost, beds and occupancy, resident outcomes against the US, staffing and inspections.'],
    use: ['Compare Kentucky with the US on resident outcomes.', CARD_USE],
  },
  'simple-bh': {
    overview: 'Behavioral health and addiction treatment: what plans spend, how many members get care, follow-up after a crisis, and access to addiction medication.',
    data: ['Behavioral health spending, follow-up rates, addiction treatment, 988 and crisis services.'],
    use: [CARD_USE],
  },
  'simple-coverage': {
    overview: 'Who Medicaid covers and how the Department is keeping up: members by group and age, managed care versus fee-for-service, and how quickly applications and renewals are handled.',
    data: ['Members by group and age, application and renewal outcomes and timeliness, call center performance.'],
    use: [CARD_USE],
  },
  'simple-county': {
    overview: 'Medicaid in my county: where members live, and everything DecisionPro has for any county; or build an area from zip codes.',
    data: ['Medicaid members by county (DMS) and estimated by zip code; county facts on access and shortage areas.'],
    sources: ['Kentucky DMS county member counts, Census ACS by zip code, the 2020 Census zip-to-county crosswalk, CDC PLACES and SVI.'],
    use: ['Click a county, or switch to Zip codes to combine several zip codes into one area.', 'Counts of 1 to 10 are never shown.'],
  },
  'simple-district': {
    overview: 'Medicaid in your legislative district: members, the counties the district covers, and the district’s social vulnerability and deprivation.',
    data: ['Estimated Medicaid members and children covered, residents, counties in the district, and resident-weighted SVI and SDI.'],
    sources: ['Kentucky DMS county member counts split by each district’s share of county residents (2020 Census); CDC SVI 2022; Social Deprivation Index 2022.'],
    use: ['Click a county to select its district; switch House or Senate; switch the map between members, vulnerability and deprivation.', 'District figures are estimates built from county values.'],
  },
};

// Written per sub-tab that is its own analysis.
const SUBTAB_TEXT = {
  'simple-access:rural': {
    overview: 'Rural Kentucky: what the data supports about the figures cited in the meeting (rural share, primary care doctors, shortage counties, ambulance access), with county maps.',
    data: ['Rural population share, primary care doctors per 100,000 and their change since 2012, shortage designations by type, deprivation, and office-visit payments by county.'],
    sources: ['USDA rural-urban codes 2023, 2020 Census, County Health Rankings and HRSA physician counts 2012–2022, HRSA shortage areas, T-MSIS office-visit payments, Social Deprivation Index 2022.'],
    use: ['Read how each cited figure compares with the data before using it.'],
  },
  'simple-access:scenario': {
    overview: 'A what-if, not a forecast: redirect part of the Medicaid office-visit payment pool toward counties with higher deprivation scores and see the change by county and for rural counties.',
    data: ['Office-visit payments by county (CY 2023) reweighted by the Social Deprivation Index.'],
    sources: ['HHS Medicaid Provider Spending (T-MSIS), Social Deprivation Index 2022 (Robert Graham Center).'],
    use: ['Move the slider (0 to 25%) and read the rural share and per-visit gap before and after.'],
  },
  'simple-access:vulnerability': {
    overview: 'Access measured against social vulnerability (Allison Adams’s request): a county heat map shaded by the CDC SVI or the Social Deprivation Index with an outline layer, a quarter-by-quarter comparison and a county scatter.',
    data: ['County SVI (overall and four themes) and SDI; any access measure averaged by vulnerability quarter; counties the two indexes rank differently.'],
    sources: ['CDC/ATSDR Social Vulnerability Index 2022, Social Deprivation Index 2022, HRSA shortage areas, USDA rural codes.'],
    use: ['Choose a measure, an index and an outline; read the table and scatter together.', 'Percentiles rank against other Kentucky counties.'],
  },
  'simple-spending:drivers-breakdown': {
    overview: 'Why spending rose while enrollment fell: the change split into enrollment, the mix of members, directed payments and other price and use.',
    data: ['Spending change FFY 2022–2024 by component, and by population group.'],
    sources: ['CMS-64 via MACStats, enrollment by group, DMS directed-payment figures.'],
    use: ['Price and utilization cannot be separated with public data; that needs encounter data.'],
  },
  'simple-outcomes:local': {
    overview: 'Health estimates for the place you choose (county, district or zip codes), beside Kentucky’s statewide Medicaid figure for the related measure.',
    data: ['CDC model estimates for all adults living in the area; statewide Medicaid Core Set rates.'],
    sources: ['CDC PLACES (BRFSS 2021–2022), Medicaid Core Set.'],
    use: ['These are estimates for all adults, not Medicaid members only; each row names the claims data that would replace it.'],
  },
  'simple-plans:contract-ledger': {
    overview: 'Every Medicaid contract: what it costs, who pays (federal and state shares), and the outcomes it is held to. Contracts with no outcome defined are flagged.',
    data: ['24 contracts: value, funding split, terms, and each contract’s outcome measures, weights and targets.'],
    sources: ['Kentucky open contract records, MCPAR 2024, MCO contract appendices, 1915(c) waiver applications, CHFS budget documents.'],
    use: ['Open a contract for its outcome measures and contract sections.'],
  },
  'simple-rates:medicare': {
    overview: 'Medicare’s physician fee schedule by state: what Medicare pays for the same service in Kentucky and neighboring payment areas, and why it differs.',
    data: ['CY 2026 Medicare allowed amounts by payment area, split into work, practice expense and malpractice adjustments.'],
    sources: ['CMS CY 2026 physician fee schedule: relative values, geographic adjusters (GPCI), conversion factor.'],
    use: ['Kentucky is one statewide payment area.'],
  },
  'simple-rates:medicaid': {
    overview: 'Kentucky Medicaid as a percent of Medicare, beside its neighbors, compared like for like (Secretary Sachdev’s point).',
    data: ['Each state’s Medicaid rate in dollars, Medicare in that state, and the percent; the bundle the rates pay for.'],
    sources: ['Kentucky DMS 2026 fee schedules and neighbors’ posted schedules; CMS fee schedule; KFF/Urban fee index 2024.'],
    use: ['Choose a service and a setting. Only dollar payment rates for the same code, setting and unit are compared; any rate left out says why.'],
  },
  'simple-rates:spread': {
    overview: 'How far posted Medicaid rates spread between Kentucky’s neighbors for psychotherapy, addiction counseling and autism therapy, on the same like-for-like rules.',
    data: ['Highest-to-lowest neighbor ratio and Kentucky against each; states left out with the reason; a quality measure for context.'],
    sources: ['Posted Medicaid fee schedules for Kentucky and its neighbors; CMS Core Set 2025.'],
    use: ['Quality is context only, not evidence that rates cause results. Spreads between providers within Kentucky need paid claims.'],
  },
  'simple-rates:deprivation': {
    overview: 'Does Medicaid pay less where people are more deprived? Kentucky’s fee schedule is one statewide rate, so this compares what Medicaid actually paid per office visit by county, and each state’s fee level against its deprivation.',
    data: ['Mix-adjusted paid per office visit by quarter of counties ranked by the SDI; a county scatter against the SDI or CDC SVI; states’ fee index against state deprivation.'],
    sources: ['HHS Medicaid Provider Spending (T-MSIS) CY 2023, Social Deprivation Index 2022, CDC SVI 2022, KFF/Urban fee index 2024.'],
    use: ['The quarters always rank by the SDI; the switch changes the chart. Counties are where the billing practice is, not where members live.'],
  },
  'simple-rates:codes': {
    overview: 'Kentucky procedure codes compared across states from Medicaid claims (T-MSIS): paid per claim line, claim lines per 1,000 members, and total paid (Commissioner Lee’s request).',
    data: ['59 common codes, every state, 2018–2024; Kentucky’s rank among states compared and the median.'],
    sources: ['HHS Medicaid Provider Spending (T-MSIS), February 2026 version; CMS DQ Atlas; CMS enrollment.'],
    use: ['States whose data CMS rates unusable are left out of the ranking. Claims are placed by provider address; 2024 is incomplete.'],
  },
  'simple-county:counties': {
    overview: 'Where Medicaid members live: a county map of members, by population group, and everything DecisionPro has for the county you select.',
    data: ['Medicaid members by county and group; county facts on access, shortage areas and health.'],
    sources: ['Kentucky DMS county member counts; HRSA, CDC and Census county data.'],
    use: ['Choose who to count, then click a county.'],
  },
  'simple-county:zips': {
    overview: 'Build an area from zip codes, such as West Louisville, and see its estimated Medicaid members and residents.',
    data: ['782 Kentucky zip areas shaded by members, coverage, vulnerability or CDC estimates.'],
    sources: ['Census ACS by zip code, the 2020 Census zip-to-county crosswalk, Kentucky DMS county members, CDC PLACES and SVI.'],
    use: ['Zoom to a county, click zip codes, then “Use these zip codes as my area”. Member counts by zip are estimates.'],
  },
  'simple-hospitals:margins': {
    overview: 'How hospitals are doing, in Indiana’s thirds: double-digit margins, low single digits, or in the red.',
    data: ['Operating and total margins in thirds, medians, cash and investments, Medicaid share of revenue.'],
    sources: ['CMS hospital cost reports (2024 file).'],
    use: ['Systems hold cash centrally, so hospital books can understate it.'],
  },
  'simple-hospitals:medicaid': {
    overview: 'What Medicaid managed care pays hospitals: the hospital rate program, as a percent of commercial and of Medicare, and in dollars per stay.',
    data: ['Base payment, rate-program add-on and other directed payments per inpatient stay; outpatient totals.'],
    sources: ['Kentucky Hospital Rate Improvement Program documents (CY 2024 and 2026); RAND hospital price study.'],
    use: ['Dollars are converted from the program’s own published add-on per stay.'],
  },
  'simple-hospitals:list': {
    overview: 'Look up any Kentucky hospital: its county, system, type, margins, Medicaid share and commercial price.',
    data: ['One row per hospital, searchable by name, county or system.'],
    sources: ['CMS hospital cost reports, CMS ownership files, RAND hospital price study.'],
    use: ['Search, then compare a hospital with others of the same type. A blank means the source has no figure for it.'],
  },
  'simple-hospitals:benefit': {
    overview: 'Community benefit: what nonprofit hospitals report spending on charity care and other community benefit, as a share of expenses.',
    data: ['Community benefit as a percent of total expenses, by hospital and system.'],
    sources: ['IRS Form 990 Schedule H.'],
    use: ['Schedule H is filed by the nonprofit entity, which may be a whole system rather than one hospital.'],
  },
  'simple-hospitals:prices': {
    overview: 'Commercial hospital prices against Medicare: Kentucky beside its neighbors, and each hospital’s price in dollars per inpatient stay.',
    data: ['Commercial price as a percent of Medicare by state and hospital; dollars per stay using each hospital’s own Medicare payment.'],
    sources: ['RAND hospital price study Round 5.1 (2020–2022); CMS hospital cost reports (2024).'],
    use: ['Compare hospitals on the percent; the dollars give scale. Outpatient prices stay as percentages.'],
  },
};

const sectionsOf = (view, anchor) => {
  const page = PAGES[view];
  if (!page) return [];
  const sub = effectiveSubtab(view, anchor);
  const own = page.sections.filter((s) => s.subtab && s.id === sub);
  return own.length ? own : page.sections.filter((s) => !s.subtab);
};

function measuresOf(sections) {
  const ids = sections.flatMap((s) => [...(s.measures || []), ...((s.map?.options || []).map((o) => o.measureId))]);
  return [...new Set(ids)].map((id) => MEASURES.get(id)).filter(Boolean);
}

function publishersOf(measures) {
  return [...new Set(measures.map((m) => m.source?.publisher).filter(Boolean))].slice(0, 8);
}

function schematicFor(view, anchor, sections) {
  if (sections.length) {
    return sections.map((s, i) => ({
      id: String(i + 1),
      name: s.title,
      alone: s.widget || s.map ? (s.note || 'An interactive view; its controls are above the figures.') : `Cards for ${(s.measures || []).length} measures.`,
      system: s.map ? 'Click a county on the map to see its figures.' : 'Each figure shows its source and how old it is; open “How measured” for its method.',
    }));
  }
  const custom = {
    'simple-home': ['Briefings', 'Headline tiles', 'Filters and layout'],
    'simple-states': ['Measure and peer pickers', 'Kentucky’s rank and trend', 'Every state, ranked'],
    'simple-hospitals': HOSPITAL_SUBTABS.filter((t) => t.id === effectiveSubtab(view, anchor)).map((t) => t.label),
    'simple-county': COUNTY_SUBTABS.filter((t) => t.id === effectiveSubtab(view, anchor)).map((t) => t.label).concat(['County or area figures']),
    'simple-district': ['Chamber and district pickers', 'Map: members, vulnerability or deprivation', 'District figures', 'Counties in the district'],
  }[view] || [];
  return custom.map((name, i) => ({ id: String(i + 1), name, alone: 'Part of this page.', system: 'Each figure shows its source and how old it is.' }));
}

/** The explain object for a simple-mode view and sub-tab, in the shape ExplainThisPage renders. */
export function simplePageExplain(view, anchor = null) {
  const tab = SIMPLE_TABS.find((t) => t.view === view);
  const base = TAB_TEXT[view];
  if (!tab || !base) return null;
  const sub = effectiveSubtab(view, anchor);
  const subText = sub ? SUBTAB_TEXT[`${view}:${sub}`] : null;
  const text = { ...base, ...(subText || {}) };
  const sections = sectionsOf(view, anchor);
  const measures = measuresOf(sections);
  const range = freshnessRange(measures);
  const subLabel = sub && subText ? ` · ${(PAGES[view]?.sections.find((s) => s.id === sub)?.subtab) || [...HOSPITAL_SUBTABS, ...COUNTY_SUBTABS].find((t) => t.id === sub)?.label || ''}` : '';
  const explainer = explainerFor(view, anchor);
  return {
    id: `simple:${view}${sub ? `:${sub}` : ''}`,
    pageName: `${tab.label}${subLabel}`,
    overview: text.overview,
    dataDisplayed: [...text.data, PUBLIC_ONLY],
    dataSource: text.sources || (publishersOf(measures).length ? publishersOf(measures) : ['Each figure names its publisher in its source line.']),
    upToDate: range
      ? `The figures here run from ${range.oldest.label.replace('Data through ', '')} (oldest) to ${range.newest.label.replace('Data through ', '')} (newest). ${DATA_LAG_NOTE}`
      : `Each figure shows the period it covers and how old it is. ${DATA_LAG_NOTE}`,
    whyInDecisionPro: [WHY],
    howToUse: text.use,
    schematic: { label: `${tab.label}${subLabel}`, layout: 'simple', sections: schematicFor(view, anchor, sections) },
    videos: explainer ? explainer.videos : [],
    videoTitle: explainer ? explainer.title : '',
  };
}
