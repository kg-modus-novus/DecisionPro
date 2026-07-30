/**
 * Synthetic legislative instruments for bi-directional analysis.
 * Curated/demo only — not a live bill feed, not legal advice.
 * Primary source URLs point at real Kentucky / federal catalogs where possible;
 * pending bill numbers are examination fixtures until a live LRC feed is linked.
 */

export const LAW_INSTRUMENTS = [
  {
    id: 'krs-205-admin',
    kind: 'existing',
    objectType: 'statute',
    cite: 'KRS Chapter 205 (selected)',
    title: 'Medicaid administration & eligibility framing',
    status: 'In force',
    summary:
      'Frames agency administration, eligibility pathways, and reporting authorities relevant to program oversight.',
    executiveSummary:
      'Kentucky Revised Statutes Chapter 205 is the principal statutory frame for Cabinet administration of medical assistance, eligibility pathways, and oversight reporting. For DecisionPro examination it is the baseline authority behind enrollment, PMPM, and pharmacy stewardship questions — not a prescription to amend.',
    impacts: ['budget', 'care', 'access', 'mco'],
    blockerStrength: 0.35,
    opportunityStrength: 0.55,
    blenderHooks: ['pharmacy', 'enrollment', 'pmpm'],
    primarySources: [
      {
        label: 'KRS Chapter 205 — Public Assistance & Medical Assistance (LRC)',
        href: 'https://apps.legislature.ky.gov/law/statutes/chapter.aspx?id=38318',
        publisher: 'Kentucky Legislative Research Commission',
      },
      {
        label: 'Kentucky Revised Statutes home',
        href: 'https://apps.legislature.ky.gov/law/statutes/',
        publisher: 'Kentucky LRC',
      },
      {
        label: 'Cabinet for Health and Family Services — Medicaid',
        href: 'https://www.chfs.ky.gov/agencies/dms/Pages/default.aspx',
        publisher: 'KY CHFS / DMS',
      },
    ],
    detailedAnalysis:
      'Selected Chapter 205 provisions govern how the Cabinet organizes medical assistance, what eligibility pathways exist, and which reporting duties support General Assembly oversight. In the wireframe they surface when budget, enrollment, or pharmacy aggregates are under examination. The statute is broad; DecisionPro points only to the administrative frame that explains why warehouse measures exist and who owns them — not to a full annotated code review.',
    relevanceToAnalysis:
      'Relevant whenever the blender or ALP rooms treat enrollment growth, PMPM, or pharmacy class spend as controllable vs structural. It anchors “who may administer / report” before any pending measure is discussed as an opening.',
    relatedOpinions: [
      {
        label: 'KFF — Medicaid in Kentucky overview',
        href: 'https://www.kff.org/medicaid/state-indicator/total-medicaid-spending/?currentTimeframe=0&selectedRows=%7B%22states%22:%7B%22kentucky%22:%7B%7D%7D%7D',
        publisher: 'KFF',
        note: 'National comparative context for KY Medicaid spend.',
      },
      {
        label: 'NCSL — Medicaid policy resources',
        href: 'https://www.ncsl.org/health/the-medicaid-toolkit',
        publisher: 'NCSL',
        note: 'Cross-state legislative framing, not KY counsel.',
      },
      {
        label: 'Commonwealth Fund — Medicaid scorecard materials',
        href: 'https://www.commonwealthfund.org/publications/scorecard/2025/jun/2025-scorecard-state-health-system-performance',
        publisher: 'Commonwealth Fund',
        note: 'Peer-state performance framing for examination only.',
      },
    ],
  },
  {
    id: 'krs-205-managed',
    kind: 'existing',
    objectType: 'statute',
    cite: 'KRS 205.5601 et seq.',
    title: 'Managed-care contracting authorities',
    status: 'In force',
    summary:
      'Supports MCO contracting, quality withholdings, and network adequacy expectations.',
    executiveSummary:
      'Managed-care contracting authorities under KRS 205 enable quality withholdings, network adequacy expectations, and corrective pathways that the Consideration Blender treats as existing contractual levers. Examination focuses on whether withhold and network tools are strong enough for the modeled rural / BH follow-up balances.',
    impacts: ['mco', 'access', 'care', 'budget'],
    blockerStrength: 0.45,
    opportunityStrength: 0.7,
    blenderHooks: ['withholding', 'network', 'bh-followup'],
    primarySources: [
      {
        label: 'KRS Chapter 205 — search managed care / medical assistance',
        href: 'https://apps.legislature.ky.gov/law/statutes/chapter.aspx?id=38318',
        publisher: 'Kentucky LRC',
      },
      {
        label: 'KY DMS — Managed Care',
        href: 'https://chfs.ky.gov/agencies/dms/dhpo/Pages/mco-options.aspx',
        publisher: 'KY CHFS / DMS',
      },
      {
        label: 'CMS — Medicaid managed care overview',
        href: 'https://www.medicaid.gov/medicaid/managed-care',
        publisher: 'CMS',
      },
    ],
    detailedAnalysis:
      'These authorities are the statutory backdrop for MCO contracts that carry quality withholdings and network adequacy standards. In DecisionPro they explain why “existing contractual” filter bands appear in MCO rooms and why rural network gaps show up as blockers rather than pure data artifacts. Gaps in surgical corrective tools are cataloged separately as statutory/contract weaknesses.',
    relevanceToAnalysis:
      'High relevance when MCO Accountability, Outcomes, or rural access findings are in the blend — especially packs that rely on withholding clarity or network corrective pathways.',
    relatedOpinions: [
      {
        label: 'MACPAC — managed care oversight issues',
        href: 'https://www.macpac.gov/topics/managed-care/',
        publisher: 'MACPAC',
        note: 'Federal advisory framing for MCO oversight.',
      },
      {
        label: 'NASHP — Medicaid managed care resources',
        href: 'https://nashp.org/policy/medicaid/',
        publisher: 'NASHP',
        note: 'State policy exchange materials.',
      },
      {
        label: 'Health Affairs — Medicaid managed care quality themes',
        href: 'https://www.healthaffairs.org/topic/medicaid',
        publisher: 'Health Affairs',
        note: 'Opinion / analysis corpus; not KY legal advice.',
      },
    ],
  },
  {
    id: 'krs-304-ins',
    kind: 'existing',
    objectType: 'statute',
    cite: 'KRS Chapter 304 (selected)',
    title: 'Insurance / payer coordination provisions',
    status: 'In force',
    summary:
      'Adjacent insurance rules that can constrain or enable care coordination and prior-auth timing.',
    executiveSummary:
      'Selected Insurance Code provisions in KRS Chapter 304 sit beside Medicaid managed care and can shape prior-authorization timing, care coordination expectations, and payer interaction. DecisionPro surfaces them when access or utilization rooms treat delay and coordination as structural constraints.',
    impacts: ['access', 'mco', 'care'],
    blockerStrength: 0.5,
    opportunityStrength: 0.4,
    blenderHooks: ['prior-auth', 'access'],
    primarySources: [
      {
        label: 'KRS Chapter 304 — Insurance Code',
        href: 'https://apps.legislature.ky.gov/law/statutes/chapter.aspx?id=38526',
        publisher: 'Kentucky LRC',
      },
      {
        label: 'Kentucky Department of Insurance',
        href: 'https://insurance.ky.gov/',
        publisher: 'KY DOI',
      },
    ],
    detailedAnalysis:
      'Chapter 304 is not a Medicaid chapter, but selected coordination and utilization-management adjacent rules can interact with MCO prior-auth practices that drive access metrics. The wireframe uses this instrument as a pointer for “insurance-side friction,” not as a claim that any specific section must be amended.',
    relevanceToAnalysis:
      'Relevant when Utilization & Access or Outcomes rooms emphasize prior-auth lag, specialty referral timing, or coordination failures that may sit partly outside pure Medicaid contract language.',
    relatedOpinions: [
      {
        label: 'NAIC — prior authorization model discussions',
        href: 'https://content.naic.org/',
        publisher: 'NAIC',
        note: 'Insurance regulator community materials.',
      },
      {
        label: 'AHIP — prior authorization perspectives',
        href: 'https://www.ahip.org/',
        publisher: 'AHIP',
        note: 'Payer-industry viewpoint for contrast.',
      },
      {
        label: 'AMA — prior authorization reform advocacy',
        href: 'https://www.ama-assn.org/practice-management/prior-authorization',
        publisher: 'AMA',
        note: 'Provider-side advocacy; opinion, not statute.',
      },
    ],
  },
  {
    id: 'bill-maternal-a',
    kind: 'pending',
    objectType: 'pending-bill',
    cite: 'HB 412',
    title: 'Maternal follow-up value-based measure',
    status: 'Committee discussion',
    summary: 'Pending language to strengthen postpartum follow-up contracting measures.',
    executiveSummary:
      'Fixture pending measure HB 412 examines stronger postpartum follow-up value-based contracting language. It is LRC-curated discussion material for the wireframe — verify status against the Kentucky General Assembly bill record before any legislative use.',
    impacts: ['care', 'mco', 'bill', 'budget'],
    blockerStrength: 0.25,
    opportunityStrength: 0.8,
    blenderHooks: ['postpartum', 'withholding'],
    primarySources: [
      {
        label: 'Kentucky General Assembly — Legislative Record',
        href: 'https://apps.legislature.ky.gov/record/',
        publisher: 'Kentucky General Assembly / LRC',
      },
      {
        label: 'Kentucky Legislature home',
        href: 'https://legislature.ky.gov/',
        publisher: 'Kentucky General Assembly',
      },
      {
        label: 'CMS — maternity & postpartum Medicaid resources',
        href: 'https://www.medicaid.gov/medicaid/quality-of-care/quality-improvement-initiatives/maternal-infant-health-care-quality',
        publisher: 'CMS',
      },
    ],
    detailedAnalysis:
      'The fixture treats HB 412 as committee/caucus discussion language that would tighten postpartum follow-up measures inside MCO value-based arrangements. It pairs with existing withholding authorities and with draft freshness / specialty reporting templates when maternal care findings are in the blend. Bill number and status are synthetic until a live committee feed is authorized.',
    relevanceToAnalysis:
      'High opening strength when Bill Readiness or Constituent Care Results focuses are active, or when Outcomes rooms surface postpartum follow-up gaps beside MCO withholding performance.',
    relatedOpinions: [
      {
        label: 'KFF — Medicaid postpartum coverage',
        href: 'https://www.kff.org/medicaid/issue-brief/medicaid-postpartum-coverage-extension-tracker/',
        publisher: 'KFF',
        note: 'Policy tracker / analysis.',
      },
      {
        label: 'Commonwealth Fund — maternal health & Medicaid',
        href: 'https://www.commonwealthfund.org/publications/issue-briefs/2023/dec/state-policies-improve-maternal-health',
        publisher: 'Commonwealth Fund',
        note: 'State policy options paper.',
      },
      {
        label: 'March of Dimes — Kentucky maternal health data',
        href: 'https://www.marchofdimes.org/peristats/state-summaries/kentucky',
        publisher: 'March of Dimes',
        note: 'Advocacy / data summary; not LRC counsel.',
      },
    ],
  },
  {
    id: 'bill-rural-access',
    kind: 'pending',
    objectType: 'pending-bill',
    cite: 'SB 187',
    title: 'Rural primary-care access & transportation pilot authority',
    status: 'Caucus discussion',
    summary:
      'Would authorize targeted pilots for rural access and non-emergency transport coordination.',
    executiveSummary:
      'Fixture pending measure SB 187 explores pilot authority for rural primary-care access and non-emergency medical transportation coordination. It is examination language for district and access focuses — confirm against the official Legislative Record before citing as introduced text.',
    impacts: ['access', 'district', 'budget', 'care'],
    blockerStrength: 0.3,
    opportunityStrength: 0.75,
    blenderHooks: ['avoidable-ed', 'distance', 'rural'],
    primarySources: [
      {
        label: 'Kentucky General Assembly — Legislative Record',
        href: 'https://apps.legislature.ky.gov/record/',
        publisher: 'Kentucky General Assembly / LRC',
      },
      {
        label: 'KY CHFS — rural health',
        href: 'https://chfs.ky.gov/agencies/dph/dpqi/hcab/Pages/hpsamua.aspx',
        publisher: 'KY CHFS',
      },
      {
        label: 'HRSA — rural health information',
        href: 'https://www.hrsa.gov/rural-health',
        publisher: 'HRSA',
      },
    ],
    detailedAnalysis:
      'SB 187 in this catalog is the pending opening most often paired with rural network gaps and avoidable ED growth. It is meant to be read alongside the Rural Network Adequacy Corrective Tools draft and existing MCO contracting authorities — pilots as examination options, not enacted programs.',
    relevanceToAnalysis:
      'Elevates when County & District or Utilization rooms show distance, rural network holes, or avoidable ED concentration in eastern / southern regions.',
    relatedOpinions: [
      {
        label: 'Rural Health Information Hub — Kentucky',
        href: 'https://www.ruralhealthinfo.org/states/kentucky',
        publisher: 'RHIhub',
        note: 'Rural access context and program inventory.',
      },
      {
        label: 'NCSL — non-emergency medical transportation',
        href: 'https://www.ncsl.org/health/nonemergency-medical-transportation-nemt',
        publisher: 'NCSL',
        note: 'Cross-state NEMT framing.',
      },
      {
        label: 'Brookings — rural health access essays',
        href: 'https://www.brookings.edu/articles/rural-health-care-infrastructure-trends-and-considerations/',
        publisher: 'Brookings',
        note: 'Opinion / analysis.',
      },
    ],
  },
  {
    id: 'bill-pharmacy-steward',
    kind: 'pending',
    objectType: 'pending-bill',
    cite: 'HB 412-B',
    title: 'Pharmacy stewardship & specialty class reporting',
    status: 'Draft / discussion',
    summary:
      'Would require therapeutic-class visibility and rebate/stewardship reporting for high-growth pharmacy spend.',
    executiveSummary:
      'Fixture companion measure HB 412-B examines specialty pharmacy class visibility and stewardship reporting so legislators can separate size from contribution to increase. Primary sources are LRC record portals and federal Medicaid pharmacy policy pages; bill text here is curated for examination only.',
    impacts: ['budget', 'mco', 'bill'],
    blockerStrength: 0.4,
    opportunityStrength: 0.7,
    blenderHooks: ['pharmacy', 'specialty'],
    primarySources: [
      {
        label: 'Kentucky General Assembly — Legislative Record',
        href: 'https://apps.legislature.ky.gov/record/',
        publisher: 'Kentucky General Assembly / LRC',
      },
      {
        label: 'CMS — Medicaid pharmacy',
        href: 'https://www.medicaid.gov/medicaid/prescription-drugs',
        publisher: 'CMS',
      },
      {
        label: 'MACPAC — prescription drugs',
        href: 'https://www.macpac.gov/topics/prescription-drugs/',
        publisher: 'MACPAC',
      },
    ],
    detailedAnalysis:
      'Pharmacy class reporting is the examination opening most tied to Cost Drivers specialty spend. HB 412-B pairs with the Specialty Pharmacy Class Visibility draft template and with Chapter 205 administrative reporting duties. Rebate timing limitations remain an explicit trust caveat in ALP rooms.',
    relevanceToAnalysis:
      'Primary when Budget Pressure focus or Cost Drivers specialty/pharmacy tiles dominate the blend.',
    relatedOpinions: [
      {
        label: 'KFF — Medicaid financing basics',
        href: 'https://www.kff.org/medicaid/medicaid-financing-the-basics/',
        publisher: 'KFF',
        note: 'Spend context; not KY PDL advice.',
      },
      {
        label: 'NCSL — Medicaid pharmacy cost containment',
        href: 'https://www.ncsl.org/health/medicaid-prescription-drug-laws-and-strategies',
        publisher: 'NCSL',
        note: 'State law inventory / analysis.',
      },
      {
        label: 'Pew — specialty drug spending research',
        href: 'https://www.pew.org/en/research-and-analysis/fact-sheets/2015/11/specialty-drugs-and-health-care-costs',
        publisher: 'Pew',
        note: 'Explainer / opinion-adjacent research.',
      },
    ],
  },
  {
    id: 'gap-data-freshness',
    kind: 'gap',
    objectType: 'statutory-gap',
    cite: 'Statutory gap',
    title: 'No explicit freshness-labeling duty for legislative dashboards',
    status: 'Gap / weakness',
    summary:
      'Existing reporting authorities do not clearly require lag warnings when national peers sit beside near-current claims.',
    executiveSummary:
      'This catalog entry is a statutory/contract gap, not an enacted statute: reporting authorities do not clearly require freshness labels when lagged national peers sit beside nearer-current Kentucky claims. It exists so lawmakers can examine the blocker without mistaking it for positive law.',
    impacts: ['bill', 'budget', 'care'],
    blockerStrength: 0.65,
    opportunityStrength: 0.6,
    blenderHooks: ['freshness', 'trust'],
    primarySources: [
      {
        label: 'KRS statutes home (baseline reporting authorities)',
        href: 'https://apps.legislature.ky.gov/law/statutes/',
        publisher: 'Kentucky LRC',
      },
      {
        label: 'CMS — Medicaid & CHIP Scorecard methodology notes',
        href: 'https://www.medicaid.gov/state-overviews/scorecard/welcome',
        publisher: 'CMS',
      },
      {
        label: 'KyGovMaps Open Data Portal',
        href: 'https://opengisdata.ky.gov/',
        publisher: 'Commonwealth of Kentucky',
      },
    ],
    detailedAnalysis:
      'The gap is inferred from the absence of an explicit legislative-dashboard freshness duty in the curated instrument set. Draft “Medicaid Legislative Metrics Freshness Act” language is the examination response — labeling duties, not eligibility or benefit changes.',
    relevanceToAnalysis:
      'Surfaces whenever Trust stage, lagged freshness chips, or benchmark rooms place peer rates beside operational claims without clear period labels.',
    relatedOpinions: [
      {
        label: 'Data Quality Campaign — legislative data use',
        href: 'https://dataqualitycampaign.org/',
        publisher: 'DQC',
        note: 'Education/data-use advocacy; transferable labeling themes.',
      },
      {
        label: 'Urban Institute — Medicaid data quality discussions',
        href: 'https://www.urban.org/policy-centers/health-policy-center',
        publisher: 'Urban Institute',
        note: 'Research / commentary.',
      },
      {
        label: 'NCSL — evidence-based policymaking',
        href: 'https://www.ncsl.org/center-for-results-driven-governing/policy-snapshot-evidence-informed-policymaking',
        publisher: 'NCSL',
        note: 'Process guidance for legislatures.',
      },
    ],
  },
  {
    id: 'gap-network-remedy',
    kind: 'gap',
    objectType: 'statutory-gap',
    cite: 'Contract/statute gap',
    title: 'Limited surgical remedy when network adequacy fails rural counties',
    status: 'Gap / weakness',
    summary:
      'Withholding exists, but targeted corrective tools for rural network holes are weakly specified.',
    executiveSummary:
      'Existing withholding authority is stronger than the cataloged surgical remedies for rural network adequacy failures. This gap instrument explains why blender packs that need targeted rural fixes often look blocked even when MCO contracts already withhold quality dollars.',
    impacts: ['access', 'mco', 'district'],
    blockerStrength: 0.7,
    opportunityStrength: 0.65,
    blenderHooks: ['network', 'rural', 'ed'],
    primarySources: [
      {
        label: 'KY DMS — Managed Care',
        href: 'https://chfs.ky.gov/agencies/dms/dhpo/Pages/mco-options.aspx',
        publisher: 'KY CHFS / DMS',
      },
      {
        label: 'CMS — network adequacy in Medicaid managed care',
        href: 'https://www.medicaid.gov/medicaid/managed-care/guidance/network-adequacy',
        publisher: 'CMS',
      },
      {
        label: 'KRS Chapter 205 (contracting frame)',
        href: 'https://apps.legislature.ky.gov/law/statutes/chapter.aspx?id=38318',
        publisher: 'Kentucky LRC',
      },
    ],
    detailedAnalysis:
      'The gap sits between KRS managed-care authorities and the absence of a clearly specified, time-limited corrective toolkit for rural counties with repeated network failures correlated to avoidable ED growth. The Rural Network Adequacy Corrective Tools draft is the examination response paired with SB 187 pilot authority.',
    relevanceToAnalysis:
      'Strong blocker when rural access, avoidable ED, or district disparity findings are active — especially packs that assume a surgical network remedy already exists.',
    relatedOpinions: [
      {
        label: 'KFF — Medicaid managed care network adequacy',
        href: 'https://www.kff.org/medicaid/medicaid-managed-care-network-adequacy-access-current-standards-and-proposed-changes/',
        publisher: 'Commonwealth Fund',
        note: 'Issue brief / analysis.',
      },
      {
        label: 'Georgetown CCF — Medicaid managed care access',
        href: 'https://ccf.georgetown.edu/',
        publisher: 'Georgetown CCF',
        note: 'Policy analysis center.',
      },
      {
        label: 'Rural Health Information Hub — network adequacy',
        href: 'https://www.ruralhealthinfo.org/topics/healthcare-access',
        publisher: 'RHIhub',
        note: 'Rural access topic library.',
      },
    ],
  },
];

export const DRAFT_BILL_TEMPLATES = [
  {
    id: 'draft-freshness',
    title: 'Medicaid Legislative Metrics Freshness Act (draft)',
    addresses: ['gap-data-freshness'],
    supportsOpportunities: ['bill-maternal-a', 'bill-pharmacy-steward'],
    blenderHooks: ['trust', 'freshness'],
    surgical: true,
    summary:
      'Requires freshness and coverage-period labels whenever lagged benchmarks appear beside operational claims metrics.',
    draftWording: `SECTION 1. Definitions.
(1) "Legislative Medicaid metric" means an aggregate measure prepared for the General Assembly concerning Medicaid cost, utilization, outcomes, or managed-care performance.
(2) "Lagged comparison" means a benchmark whose measurement period ends more than twelve (12) months before the operational claims period displayed beside it.

SECTION 2. Freshness labeling duty.
(1) Any legislative Medicaid metric display that places a lagged comparison beside an operational claims metric shall:
   (a) Display the service or measurement period;
   (b) Display the publication or refresh date; and
   (c) Display a plain-language freshness label selected from: Near current, Recent, Lagged, Historical, or Provisional.
(2) Failure to label shall be treated as an incomplete metric for oversight purposes, not as a finding of program noncompliance.

SECTION 3. No private right of action.
This Act creates no private cause of action and does not alter Medicaid eligibility or benefits.`,
  },
  {
    id: 'draft-rural-network',
    title: 'Rural Network Adequacy Corrective Tools Act (draft)',
    addresses: ['gap-network-remedy'],
    supportsOpportunities: ['bill-rural-access', 'krs-205-managed'],
    blenderHooks: ['network', 'rural', 'avoidable-ed'],
    surgical: true,
    summary:
      'Creates a targeted corrective pathway when rural network adequacy failures correlate with avoidable ED growth.',
    draftWording: `SECTION 1. Purpose.
To authorize surgical corrective tools when managed-care network adequacy failures in rural counties materially contribute to avoidable emergency utilization.

SECTION 2. Corrective plan trigger.
(1) If the cabinet finds that a managed-care organization fails a rural network adequacy standard in two (2) consecutive measurement periods, and avoidable emergency utilization for the affected counties exceeds the statewide rate by a published threshold, the organization shall submit a corrective access plan within sixty (60) days.
(2) The plan may include time-limited transportation supports, temporary access payments, or telehealth access obligations, without rewriting the entire risk contract.

SECTION 3. Reporting to the General Assembly.
A de-identified aggregate summary of triggers, plans, and outcomes shall be available to LRC analysts and Medicaid leadership for legislative oversight.`,
  },
  {
    id: 'draft-pharmacy-class',
    title: 'Specialty Pharmacy Class Visibility Act (draft)',
    addresses: ['bill-pharmacy-steward'],
    supportsOpportunities: ['krs-205-admin', 'bill-pharmacy-steward'],
    blenderHooks: ['pharmacy', 'specialty', 'budget'],
    surgical: false,
    summary:
      'Requires therapeutic-class and specialty growth reporting so legislators can distinguish size vs contribution to increase.',
    draftWording: `SECTION 1. Reporting.
(1) The cabinet shall publish, at least quarterly, aggregate Medicaid pharmacy expenditure by therapeutic class, including:
   (a) Current spend;
   (b) Year-over-year growth;
   (c) Dollar contribution to annual increase; and
   (d) Known rebate timing limitations.
(2) Reports shall be de-identified and suitable for legislative decision support.

SECTION 2. Use.
The reports are for oversight and contracting examination and do not themselves amend preferred drug lists.`,
  },
];

export function getLawInstrument(id) {
  return LAW_INSTRUMENTS.find((law) => law.id === id) || null;
}

export function draftsForInstrument(instrumentId) {
  return DRAFT_BILL_TEMPLATES.filter(
    (d) => d.addresses.includes(instrumentId) || d.supportsOpportunities.includes(instrumentId),
  );
}

/** Map blender focus ids to legislation relevance. */
export function scoreInstrumentForBlender(instrument, focuses = [], packTags = []) {
  const focusSet = new Set([...(focuses || []), ...(packTags || [])]);
  const overlap = (instrument.impacts || []).filter((x) => focusSet.has(x)).length;
  const focusScore = overlap / Math.max(instrument.impacts.length, 1);
  return {
    ...instrument,
    relevance: Number(
      (0.45 * focusScore + 0.3 * instrument.opportunityStrength + 0.25 * instrument.blockerStrength).toFixed(3),
    ),
  };
}
