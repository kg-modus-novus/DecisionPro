import { EVIDENCE_ROOMS, FINDINGS, FOCUS_TABS, OPTION_PACKS } from './fixtures.js';
import {
  ROLE_IDS,
  getRoleProfile,
  orderedEvidenceRooms,
} from './roleProfiles.js';

const ROLE_GUIDE_SCENARIOS = {
  legislator: {
    situation: 'You need a clear district comparison for a town hall.',
    result: 'a short talking point with the number, state comparison, source, and limitation',
  },
  'legislative-staff': {
    situation:
      'The committee chair asks, “Does the maternal follow-up bill address the postpartum gap shown for Eastern Kentucky, and what should I ask the agency at the hearing?”',
    result:
      'a chair-ready hearing question tied to HB 412, the postpartum aggregate, its primary-source pointer, and the remaining verification caveat',
  },
  'budget-analyst': {
    situation:
      'The appropriations chair asks, “How much of the Medicaid increase comes from pharmacy spending for disabled members, and does the displayed driver appear controllable?”',
    result:
      'a fiscal-note statement with the contribution amount, population, controllability cue, and rebate-lag caveat',
  },
  'medicaid-leadership': {
    situation:
      'The cabinet secretary asks, “Which Intervention indicated signal in Eastern Kentucky needs an owner for this month’s cabinet briefing?”',
    result:
      'an operational escalation naming the Eastern Kentucky signal, magnitude, freshness, owner, and responsible follow-up',
  },
  'policy-analyst': {
    situation:
      'A policy lead asks, “Which option could reduce rural travel distance and avoidable emergency use without ignoring pharmacy cost or postpartum quality?”',
    result:
      'a balanced shortlist that shows the selected findings, weights, evidence caveats, and legal constraints',
  },
  'oversight-auditor': {
    situation:
      'An auditor asks, “Can this lagged cost figure be traced to its definition, owner, source, refresh cadence, and limitation?”',
    result:
      'an audit-workpaper trail from the lagged cost figure to its definition, owner, source, freshness, and limitation',
  },
  'data-steward': {
    situation:
      'A catalog reviewer asks, “Does this near-current utilization measure have the correct owner, cadence, source link, and limitation?”',
    result:
      'a confirmed or corrected freshness and quality label with an accountable owner and current source pointer',
  },
};

const ROLE_HOME_TASK_EXAMPLES = {
  legislator:
    'Open County & District View. Set Region to Eastern KY and Population to Disabled. Open Pike (HD-92) — Expenditure. Use the number, state comparison, source, and limitation.',
  'legislative-staff':
    'select “Maternal follow-up value-based measure (HB 412),” compare its displayed openings and blockers with the postpartum finding, and follow the primary-source pointer. Record the LRC verification caveat beside the resulting hearing question.',
  'budget-analyst':
    'set Service to Pharmacy and Population to Disabled, then open “Pharmacy — Disabled.” Carry its contribution amount, controllability cue, and rebate-lag limitation into the fiscal note.',
  'medicaid-leadership':
    'set Attention to Intervention indicated and Region to Eastern KY, then open “MCO quality target miss (Eastern KY).” Assign its displayed owner and freshness caveat to the cabinet follow-up.',
  'policy-analyst':
    'select Budget Pressure, Constituent Care Results, and Access & Rural Care, then add Pharmacy expenditure growth, Postpartum follow-up gap, and Potentially avoidable ED visits. Review Trust and compare the resulting Action packs.',
  'oversight-auditor':
    'set Freshness to Lagged and Measure type to Cost, then open “PMPM.” Record its owner, source, cadence, and limitation in the audit workpaper.',
  'data-steward':
    'set Freshness to Near current and Measure type to Utilization, then open “Avoidable ED.” Confirm or correct its owner, cadence, source link, and limitation.',
};

const ROLE_PRIORITY_TRIAGE_EXAMPLES = {
  legislator:
    'Start with District story. Open County & District View, set Region to Eastern KY and Population to Disabled, then open Pike (HD-92) — Expenditure.',
  'legislative-staff':
    'Choose Law ↔ blender rather than Maternal & access bills or Exportable brief. Open Legislative Analysis, select “Maternal follow-up value-based measure (HB 412),” compare it with the postpartum finding, and record the LRC verification caveat beside the hearing question.',
  'budget-analyst':
    'Choose Cost Drivers ALP rather than Budget focus blend or Trust the lag. Set Service to Pharmacy and Population to Disabled, open “Pharmacy — Disabled,” and carry its controllability and rebate-lag cues into the fiscal note.',
  'medicaid-leadership':
    'Choose Attention signals rather than MCO Accountability or Operational trust. Open Command Center, set Attention to Intervention indicated and Region to Eastern KY, then open “MCO quality target miss (Eastern KY)” and assign its displayed owner and freshness caveat.',
  'policy-analyst':
    'Choose Blend early rather than Benchmarks & outcomes or Law linkage. Select Budget Pressure, Constituent Care Results, and Access & Rural Care; add Pharmacy expenditure growth, Postpartum follow-up gap, and Potentially avoidable ED visits; review Trust; then compare Action packs.',
  'oversight-auditor':
    'Choose Definitions room rather than MCO contract classes or Source links. Set Freshness to Lagged and Measure type to Cost, open the definition, and record its owner, source, cadence, and limitation.',
  'data-steward':
    'Choose Measure Definitions rather than Command Center or Primary sources. Set Freshness to Near current and Measure type to Utilization, open the definition, and correct its owner, cadence, source link, or limitation.',
};

const ROLE_RECOMMENDED_ROOM_EXAMPLES = {
  legislator:
    'District comparison → County & District View. New regional alert → Command Center. Postpartum care → Outcomes & Quality. Travel or avoidable ED → Utilization & Access. In each room, set the filters shown on screen, open one row, and keep the source and limitation with the number.',
  'legislative-staff':
    'If the chair asks, “Which new Intervention indicated signal should DMS explain first?”, choose Legislative Command Center; set Attention to Intervention indicated and Region to Eastern KY to produce the first agency-explanation question in the hearing outline. For “How large is the postpartum follow-up gap for pregnant members?”, choose Outcomes & Quality; set Population to Pregnant / postpartum and Measure type to Outcome to produce a hearing question with the displayed gap and peer context. For “How much of the increase comes from pharmacy or inpatient services?”, choose Cost Drivers; set Service to Pharmacy and Population to Disabled to produce a fiscal-effect question with contribution and controllability. For “Who owns this measure, how current is it, and what is its limitation?”, choose Measure Definitions & Data Quality; set Freshness to Lagged and Measure type to Cost to produce the packet’s source-and-limitation footnote.',
  'budget-analyst':
    'If the request is “Which service-and-population slice contributed most to the increase?”, choose Cost Drivers; set Service to Pharmacy and Population to Disabled to produce the fiscal-note driver statement. For “Is Kentucky’s displayed gap unusual relative to the selected peer?”, choose Benchmarks; set Population to Disabled and Freshness to Lagged to produce a benchmark assumption with gap, type, vintage, and caveat. For “Which MCO has withholding exposure and missed measures?”, choose MCO Accountability; set MCO to WellCare of Kentucky and Contract class to Existing contractual to produce a plan-exposure note with withholding and missed-measure context. For “Could rebate or encounter lag change this fiscal figure?”, choose Measure Definitions & Data Quality; set Freshness to Lagged and Measure type to Cost to produce the fiscal assumption documenting owner, source, cadence, and lag.',
  'medicaid-leadership':
    'If the cabinet asks, “Which Intervention indicated signal in Eastern Kentucky needs an owner today?”, choose Legislative Command Center; set Attention to Intervention indicated and Region to Eastern KY to produce an assigned escalation with magnitude and freshness. For “Why does WellCare of Kentucky have withholding at risk?”, choose MCO Accountability; set MCO to WellCare of Kentucky and Contract class to Existing contractual to produce a corrective-plan question with withholding and missed measures. For “Does risk adjustment change the apparent provider problem?”, choose Provider & Delivery-System; compare Unadjusted with Risk-adjusted values and Social risk to produce the delivery-system follow-up. For “What avoidable-use or travel-distance pressure is visible for disabled members in Eastern Kentucky?”, choose Utilization & Access; set Population to Disabled and Region to Eastern KY to produce an access-operations action with owner and review date.',
  'policy-analyst':
    'If the question is “What gap does Postpartum follow-up show for pregnant members?”, choose Outcomes & Quality; set Population to Pregnant / postpartum and Measure type to Outcome to produce a measurable care objective. For “How does Kentucky compare with a displayed peer for disabled members?”, choose Benchmarks; set Population to Disabled and Freshness to Lagged to produce the comparative rationale with gap and vintage. For “Would pharmacy or inpatient pressure dominate the option’s fiscal context?”, choose Cost Drivers; set Service to Pharmacy and Population to Disabled to produce the option’s fiscal constraint. For “Where do rural distance and avoidable emergency use overlap?”, choose Utilization & Access; set Population to Disabled and Region to Eastern KY to produce an access-intervention hypothesis grounded in the displayed pattern.',
  'oversight-auditor':
    'If the workpaper asks, “Who owns this measure, what source feeds it, and what limitation applies?”, choose Measure Definitions & Data Quality; set Freshness to Lagged and Measure type to Cost to produce the provenance record. For “Does the reported MCO issue belong to an existing contract class?”, choose MCO Accountability; set MCO to Humana Healthy Horizons and Contract class to Monitored not contracted to produce the contract-compliance test. For “Is the cited peer comparison current and like-for-like?”, choose Benchmarks; set Population to Disabled and Freshness to Lagged to produce the comparability test with type, vintage, and gap. For “Which reported escalation first exposed the variance?”, choose Legislative Command Center; set Attention to Intervention indicated and Region to Eastern KY to produce the audit-trail starting point with owner and freshness.',
  'data-steward':
    'If the ticket says, “This measure has the wrong owner or cadence,” choose Measure Definitions & Data Quality; set Freshness to Near current and Measure type to Utilization to produce the corrected catalog entry. For “Why is this Provisional or Data incomplete label appearing to leaders?”, choose Legislative Command Center; set Freshness to Provisional and Attention to Data incomplete to produce the corrected quality label and owner assignment. For “Does this benchmark still use the correct source and vintage?”, choose Benchmarks; set Population to Disabled and Freshness to Lagged to produce the corrected benchmark source, type, vintage, and freshness label. For “Which pharmacy or inpatient cube row produced this fiscal amount?”, choose Cost Drivers; set Service to Pharmacy and Population to Disabled to produce a cube-lineage ticket with source and refresh issue.',
};

const ROLE_INDEX_TASK_EXAMPLES = {
  legislator:
    'Open Measure Definitions & Data Quality. Set Freshness to Lagged and Measure type to Cost. Open PMPM and check owner, source, refresh timing, and limitation before quoting it.',
  'legislative-staff':
    'A committee witness asks, “Did performance for Appalachian Care Network — Disabled actually worsen after risk adjustment?” Open the Provider & Delivery-System card, open “Appalachian Care Network — Disabled,” then compare Unadjusted, Risk-adjusted, and Social risk for the follow-up question.',
  'budget-analyst':
    'The fiscal-note reviewer asks, “Is this statewide cost pressure concentrated in Eastern Kentucky for disabled members?” Open the County & District View card, set Population to Disabled and Region to Eastern KY, then compare the local values with the state before adding geographic context.',
  'medicaid-leadership':
    'The cabinet secretary asks, “Is Kentucky’s Avoidable ED result unusual relative to the national average?” Open the Benchmarks card, set Population to Disabled and Freshness to Lagged, then open “Avoidable ED vs National avg” and carry its gap, vintage, and caveat into the response.',
  'policy-analyst':
    'The policy lead asks, “Could an existing MCO contract lever address this issue, or would statutory language be needed?” Open the MCO Accountability card, set MCO to WellCare of Kentucky and Contract class to Existing contractual, then inspect withholding and missed measures before choosing the lever to examine.',
  'oversight-auditor':
    'The audit lead asks, “Does the provider variance remain after risk adjustment and social-risk context are applied?” Open the Provider & Delivery-System card, compare unadjusted and risk-adjusted values, then document whether the original oversight concern still holds.',
  'data-steward':
    'A data-quality ticket asks, “Which source-system input produced this risk-adjusted provider value?” Open the Provider & Delivery-System card, select the affected MCO, open the provider slice, and verify the source system and related definition before correcting the catalog ticket.',
};

const ROOM_TASK_EXAMPLES = {
  'command-center': {
    action:
      'set Attention to Intervention indicated and Region to Eastern KY, then open “MCO quality target miss (Eastern KY)”',
    outcome: 'the signal’s displayed dollar impact, owner, and freshness',
  },
  'cost-drivers': {
    action:
      'set Service to Pharmacy and Population to Disabled, then open “Pharmacy — Disabled”',
    outcome: 'its contribution amount, PMPM, trend, controllability, and lag caveat',
  },
  utilization: {
    action:
      'set Population to Disabled and Region to Eastern KY, then open “Avg miles to care (Eastern KY)”',
    outcome: 'the displayed travel distance, period, source, and freshness',
  },
  outcomes: {
    action:
      'set Population to Pregnant / postpartum and Measure type to Outcome, then open “Postpartum follow-up (Eastern KY)”',
    outcome: 'the displayed performance, peer context, period, and source',
  },
  mco: {
    action:
      'set MCO to WellCare of Kentucky and Contract class to Existing contractual, then open “WellCare of Kentucky — Quality withholding”',
    outcome: 'the withholding amount, missed measures, earned-back cue, and contract class',
  },
  provider: {
    action:
      'open “Appalachian Care Network — Disabled,” then compare Unadjusted, Risk-adjusted, and Social risk',
    outcome: 'whether adjustment changes that provider slice’s apparent performance',
  },
  county: {
    action:
      'set Region to Eastern KY and Population to Disabled, then open “Pike (HD-92) — Expenditure”',
    outcome: 'the local value, state comparison, period, source, and limitation',
  },
  benchmarks: {
    action:
      'set Population to Disabled and Freshness to Lagged, then open “Avoidable ED vs National avg”',
    outcome: 'the Kentucky value, comparison value, gap, benchmark type, and vintage',
  },
  'measure-definitions': {
    action:
      'set Freshness to Lagged and Measure type to Cost, then open “PMPM”',
    outcome: 'its definition, owner, source, cadence, freshness, and limitation',
  },
};

const ROLE_ROOM_REQUESTS = {
  legislator: {
    'command-center': 'Find the top Eastern KY alert and who owns follow-up.',
    'cost-drivers': 'See how much Pharmacy — Disabled drove the increase.',
    utilization: 'Check miles to care for disabled members in Eastern KY.',
    outcomes: 'Check postpartum follow-up for Eastern KY.',
    mco: 'See why WellCare quality withholding is at risk.',
    provider: 'Compare unadjusted vs risk-adjusted for Appalachian Care Network — Disabled.',
    county: 'Compare Pike (HD-92) with the state for disabled members.',
    benchmarks: 'Compare Kentucky Avoidable ED with the shown peer.',
    'measure-definitions': 'Check who owns PMPM, what feeds it, and its limitation.',
  },
  'legislative-staff': {
    'command-center':
      'The chair asks, “What should DMS explain about ‘MCO quality target miss (Eastern KY)’ at the hearing?”',
    'cost-drivers':
      'The chair asks, “What question should we ask about the contribution shown for ‘Pharmacy — Disabled’?”',
    utilization:
      'A witness claims rural access improved; the chair asks, “What does ‘Avg miles to care (Eastern KY)’ show?”',
    outcomes:
      'The chair asks, “What hearing question follows from ‘Postpartum follow-up (Eastern KY)’?”',
    mco:
      'The chair asks, “Which contract question does ‘WellCare of Kentucky — Quality withholding’ raise?”',
    provider:
      'A witness cites unadjusted performance; the chair asks, “Does ‘Appalachian Care Network — Disabled’ change after adjustment?”',
    county:
      'The chair asks, “What Pike (HD-92) impact belongs in the district memo?”',
    benchmarks:
      'The packet editor asks, “Which Avoidable ED benchmark, gap, and vintage should appear in the peer-context footnote?”',
    'measure-definitions':
      'The citation reviewer asks, “Which owner, source, cadence, and limitation belong beside the PMPM figure?”',
  },
  'budget-analyst': {
    'command-center':
      'The fiscal-note reviewer asks, “Does ‘MCO quality target miss (Eastern KY)’ carry enough dollar impact to flag?”',
    'cost-drivers':
      'The appropriations chair asks, “How much of the increase comes from ‘Pharmacy — Disabled,’ and does it appear controllable?”',
    utilization:
      'The fiscal-note reviewer asks, “Could ‘Avg miles to care (Eastern KY)’ signal utilization or transportation exposure?”',
    outcomes:
      'The reviewer asks, “Could the gap in ‘Postpartum follow-up (Eastern KY)’ create measurable utilization or budget exposure?”',
    mco:
      'The appropriations chair asks, “What fiscal exposure is shown by ‘WellCare of Kentucky — Quality withholding’?”',
    provider:
      'The reviewer asks, “Does adjustment of ‘Appalachian Care Network — Disabled’ change the apparent fiscal exposure?”',
    county:
      'The reviewer asks, “Is the displayed Pike (HD-92) pressure geographically concentrated?”',
    benchmarks:
      'The reviewer asks, “Which Avoidable ED comparison and vintage can support the fiscal assumption?”',
    'measure-definitions':
      'Before using PMPM, the reviewer asks, “Could rebate or encounter lag change this fiscal conclusion?”',
  },
  'medicaid-leadership': {
    'command-center':
      'The cabinet secretary asks, “Who owns ‘MCO quality target miss (Eastern KY),’ and what follow-up is due?”',
    'cost-drivers':
      'The commissioner asks, “What management response should examine the pressure in ‘Pharmacy — Disabled’?”',
    utilization:
      'Operations asks, “Who should address the travel pressure in ‘Avg miles to care (Eastern KY)’?”',
    outcomes:
      'The quality lead asks, “Who owns follow-up on ‘Postpartum follow-up (Eastern KY)’?”',
    mco:
      'The commissioner asks, “What corrective-plan question follows from ‘WellCare of Kentucky — Quality withholding’?”',
    provider:
      'The delivery-system lead asks, “Does adjustment change the concern shown for ‘Appalachian Care Network — Disabled’?”',
    county:
      'The cabinet asks, “Does the Pike (HD-92) aggregate justify a regional resource-allocation review?”',
    benchmarks:
      'The cabinet asks, “How unusual is Kentucky’s Avoidable ED result, and how current is the comparison?”',
    'measure-definitions':
      'Before the briefing, the commissioner asks, “Should we use, qualify, or defer the lagged PMPM measure?”',
  },
  'policy-analyst': {
    'command-center':
      'The policy lead asks, “What bounded problem statement follows from ‘MCO quality target miss (Eastern KY)’?”',
    'cost-drivers':
      'The option team asks, “What fiscal constraint does ‘Pharmacy — Disabled’ place on intervention design?”',
    utilization:
      'The policy lead asks, “What access-intervention hypothesis follows from ‘Avg miles to care (Eastern KY)’?”',
    outcomes:
      'The policy lead asks, “What measurable objective follows from ‘Postpartum follow-up (Eastern KY)’?”',
    mco:
      'The option team asks, “Could an existing contract lever address ‘WellCare of Kentucky — Quality withholding’?”',
    provider:
      'The analyst asks, “Which delivery-system lever remains plausible after adjusting ‘Appalachian Care Network — Disabled’?”',
    county:
      'The policy lead asks, “Should the Pike (HD-92) aggregate shape geographic or equity targeting?”',
    benchmarks:
      'The policy lead asks, “Does the Avoidable ED benchmark gap support the intervention hypothesis?”',
    'measure-definitions':
      'The memo editor asks, “Which PMPM provenance caveat must constrain the policy claim?”',
  },
  'oversight-auditor': {
    'command-center':
      'The audit lead asks, “Where did ‘MCO quality target miss (Eastern KY)’ originate, and who owns the variance?”',
    'cost-drivers':
      'The audit lead asks, “Can the contribution shown for ‘Pharmacy — Disabled’ be reconciled to its source?”',
    utilization:
      'The audit lead asks, “Can ‘Avg miles to care (Eastern KY)’ be tested against its unit, source, and period?”',
    outcomes:
      'The audit lead asks, “Can ‘Postpartum follow-up (Eastern KY)’ be validated against its peer, source, and freshness?”',
    mco:
      'The audit lead asks, “Does ‘WellCare of Kentucky — Quality withholding’ map to the correct plan and contract class?”',
    provider:
      'The audit lead asks, “Does the variance for ‘Appalachian Care Network — Disabled’ survive risk adjustment?”',
    county:
      'The audit lead asks, “Does the Pike (HD-92) rollup reconcile to its geographic source and state comparison?”',
    benchmarks:
      'The audit lead asks, “Is the Avoidable ED benchmark comparison like-for-like and current enough to cite?”',
    'measure-definitions':
      'The audit lead asks, “Can PMPM be traced through its definition, owner, source, cadence, and limitation?”',
  },
  'data-steward': {
    'command-center':
      'A data-quality ticket asks, “Are the attention, freshness, and owner labels correct for ‘MCO quality target miss (Eastern KY)’?”',
    'cost-drivers':
      'A data-quality ticket asks, “Which cube row produced the displayed ‘Pharmacy — Disabled’ amount, and when was it refreshed?”',
    utilization:
      'A catalog ticket asks, “Are the unit, region, owner, and cadence correct for ‘Avg miles to care (Eastern KY)’?”',
    outcomes:
      'A catalog ticket asks, “Are the population, peer semantics, owner, and limitation correct for ‘Postpartum follow-up (Eastern KY)’?”',
    mco:
      'A mapping ticket asks, “Does ‘WellCare of Kentucky — Quality withholding’ use the correct MCO and contract-class dimensions?”',
    provider:
      'A lineage ticket asks, “Which inputs and adjustment produced ‘Appalachian Care Network — Disabled’?”',
    county:
      'A geography ticket asks, “Does the Pike (HD-92) aggregate use the correct county-to-district mapping?”',
    benchmarks:
      'A benchmark ticket asks, “Are the source, type, vintage, and freshness correct for the Avoidable ED comparison?”',
    'measure-definitions':
      'A catalog ticket asks, “Are the owner, source, cadence, freshness, and limitation correct for PMPM?”',
  },
};

const ROLE_ROOM_DELIVERABLES = {
  legislator: {
    'command-center': 'one sentence: signal, size, owner, and as-of caveat',
    'cost-drivers': 'which service and population drove the shown increase (not causation)',
    utilization: 'the shown distance or use figure for that region',
    outcomes: 'the care gap, peer context, source, and limitation',
    mco: 'a plan question on withholding and missed measures',
    provider: 'whether risk adjustment changes the picture',
    county: 'local value, state comparison, source, and limitation',
    benchmarks: 'Kentucky vs the shown peer, with the gap and caveat',
    'measure-definitions': 'owner, source, refresh timing, and limitation for the quote',
  },
  'legislative-staff': {
    'command-center':
      'the first agency-explanation question in the chair’s hearing outline',
    'cost-drivers':
      'a fiscal-effect question naming the service, population, contribution amount, and controllability cue',
    utilization:
      'an access hearing question naming the region, population, rate or distance, and freshness caveat',
    outcomes:
      'a maternal or quality hearing question stating the displayed gap and peer context',
    mco:
      'a contract-oversight question tying the plan’s withholding and missed measures to its contract class',
    provider:
      'a witness follow-up asking whether risk adjustment changes the claimed provider trend',
    county:
      'a district-impact paragraph for the chair memo with the local value and state comparison',
    benchmarks:
      'a peer-context citation for the packet with the benchmark type, vintage, gap, and limitation',
    'measure-definitions':
      'a packet footnote documenting the measure owner, source, cadence, and known limitation',
  },
  'budget-analyst': {
    'command-center':
      'a fiscal-attention note identifying the largest displayed dollar-impact signal and its owner',
    'cost-drivers':
      'a fiscal-note driver statement with contribution amount, population, controllability, and rebate-lag caveat',
    utilization:
      'a utilization-exposure note connecting the regional rate or distance measure to possible budget pressure',
    outcomes:
      'a budget-risk note explaining whether the displayed care gap could warrant utilization or fiscal follow-up',
    mco:
      'a plan-exposure note with withholding, missed measures, PMPM context, and contract class',
    provider:
      'a risk-adjusted fiscal interpretation showing whether provider mix changes the apparent exposure',
    county:
      'a geographic allocation note showing whether the displayed cost pressure is concentrated locally',
    benchmarks:
      'a benchmark assumption stating the Kentucky gap, comparison type, freshness, and fiscal-use caveat',
    'measure-definitions':
      'a fiscal assumption documenting rebate or encounter lag, owner, source, and refresh cadence',
  },
  'medicaid-leadership': {
    'command-center':
      'an assigned operational escalation with the signal, magnitude, region, owner, and freshness caveat',
    'cost-drivers':
      'a management briefing item naming the service driver, affected population, controllability, and next review',
    utilization:
      'an access-operations follow-up naming the region, population, measure, owner, and review date',
    outcomes:
      'a quality-improvement follow-up tied to the displayed gap, peer context, and accountable owner',
    mco:
      'a corrective-plan question for the named MCO covering withholding, missed measures, and contract class',
    provider:
      'a delivery-system follow-up showing whether risk adjustment changes the provider concern',
    county:
      'a regional resource-allocation question supported by the local value and state comparison',
    benchmarks:
      'a cabinet context statement explaining how Kentucky compares and why benchmark freshness matters',
    'measure-definitions':
      'a use, qualify, or defer decision for the measure based on owner, cadence, source, and limitation',
  },
  'policy-analyst': {
    'command-center':
      'a bounded problem statement naming the change, affected region, magnitude, and evidence caveat',
    'cost-drivers':
      'a fiscal constraint for option design naming the driver, population, contribution, and controllability',
    utilization:
      'an access-intervention hypothesis tied to the displayed regional utilization or distance pattern',
    outcomes:
      'a measurable care objective tied to the displayed population gap and peer context',
    mco:
      'a contract-lever hypothesis tied to the plan, contract class, withholding, and missed measures',
    provider:
      'a delivery-system lever that accounts for risk adjustment and social-risk context',
    county:
      'a geographic or equity objective grounded in the local value and state comparison',
    benchmarks:
      'a comparative rationale naming the benchmark, gap, vintage, and limitation',
    'measure-definitions':
      'an evidence caveat for the policy memo documenting owner, source, cadence, and limitation',
  },
  'oversight-auditor': {
    'command-center':
      'an audit-trail starting point identifying where the variance surfaced, its owner, and freshness label',
    'cost-drivers':
      'a reconcilable cost-driver workpaper line with service, population, contribution, and source',
    utilization:
      'a testable access-measure assertion with region, population, rate or distance, source, and limitation',
    outcomes:
      'a performance-measure workpaper stating the displayed gap, peer context, source, and freshness',
    mco:
      'a contract-compliance test tying withholding and missed measures to the correct plan and class',
    provider:
      'a risk-adjustment workpaper showing whether the unadjusted oversight concern remains valid',
    county:
      'a geographic-aggregation test documenting the district value, state comparison, and rollup source',
    benchmarks:
      'a comparability test documenting benchmark type, vintage, gap, and known limitation',
    'measure-definitions':
      'a provenance record with definition, owner, source, cadence, freshness, and limitation',
  },
  'data-steward': {
    'command-center':
      'a corrected attention, freshness, or incompleteness label with an accountable owner',
    'cost-drivers':
      'a cube-lineage ticket naming the service, population, generated amount, source, and refresh issue',
    utilization:
      'a corrected access-measure entry with region, population, unit, owner, source, and cadence',
    outcomes:
      'a corrected quality-measure entry with population, measure type, peer semantics, owner, and limitation',
    mco:
      'a corrected MCO and contract-class mapping with the affected withholding or missed-measure row',
    provider:
      'a documented adjustment lineage from unadjusted input through risk-adjusted output and source system',
    county:
      'a corrected county-to-district mapping with the rollup source and state-comparison semantics',
    benchmarks:
      'a corrected benchmark source, type, vintage, and freshness label',
    'measure-definitions':
      'a confirmed or corrected catalog entry with owner, source, cadence, freshness, and limitation',
  },
};

const ROLE_LEGISLATIVE_TASKS = {
  legislator: 'Rural primary-care access & transportation pilot authority (SB 187)',
  'legislative-staff': 'Maternal follow-up value-based measure (HB 412)',
  'budget-analyst': 'Pharmacy stewardship & specialty class reporting (HB 412-B)',
  'medicaid-leadership':
    'Limited surgical remedy when network adequacy fails rural counties',
  'policy-analyst': 'Rural primary-care access & transportation pilot authority (SB 187)',
  'oversight-auditor':
    'No explicit freshness-labeling duty for legislative dashboards',
  'data-steward':
    'No explicit freshness-labeling duty for legislative dashboards',
};

const ROLE_PACK_IDS = {
  legislator: 'pack-district-brief',
  'legislative-staff': 'pack-pc-pharmacy-rural',
  'budget-analyst': 'pack-pc-pharmacy-rural',
  'medicaid-leadership': 'pack-mco-bh',
  'policy-analyst': 'pack-mco-bh',
  'oversight-auditor': 'pack-mco-bh',
  'data-steward': 'pack-pc-pharmacy-rural',
};

function formatList(items) {
  if (items.length < 2) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function step(id, target, title, purpose, data, functionality, example) {
  return {
    id,
    target,
    title,
    purpose,
    data,
    functionality,
    example,
  };
}

function legislatorHomeOrientationSteps() {
  const profile = getRoleProfile('legislator');
  const firstAction = profile?.primaryActions?.[0]?.label || 'Open County & District View';
  return [
    {
      ...step(
        'legislator-home-priorities',
        'role-home-priorities',
        'Your priorities',
        'Start here. These tiles show what matters first for a legislator view.',
        'Short priority titles, a few key numbers, and the usual next step. Figures are synthetic aggregates for the demo — not recommendations.',
        'Read the District story tile, then move to Recommended rooms or a primary action.',
        `${ROLE_GUIDE_SCENARIOS.legislator.situation} ${ROLE_PRIORITY_TRIAGE_EXAMPLES.legislator}`,
      ),
      route: { view: 'role-home', activeLawId: null, evidenceObjectId: null },
    },
    {
      ...step(
        'legislator-home-rooms',
        'role-home-rooms',
        'Recommended Evidence Rooms',
        'These rooms are the fastest path for common district questions.',
        'County & District for local vs state. Command Center for alerts. Outcomes and Utilization for care and access.',
        'Click a room to open it, or use the left nav for the full list.',
        ROLE_RECOMMENDED_ROOM_EXAMPLES.legislator,
      ),
      route: { view: 'role-home', activeLawId: null, evidenceObjectId: null },
    },
    {
      ...step(
        'legislator-home-actions',
        'role-home-actions',
        'Primary actions',
        'Use a shortcut when you already know the task.',
        `“${firstAction}” jumps into that workspace. Other buttons open Blender, legislation, or related rooms.`,
        'Press a shortcut, set filters on the next screen, open one row, and keep source plus limitation with the number.',
        `Press “${firstAction},” then ${ROLE_HOME_TASK_EXAMPLES.legislator}`,
      ),
      route: { view: 'role-home', activeLawId: null, evidenceObjectId: null },
    },
  ];
}

function roleHomeSteps(roleId, rooms) {
  const profile = getRoleProfile(roleId);
  const scenario = ROLE_GUIDE_SCENARIOS[roleId];
  const label = profile?.label || 'this role';
  const recommendedRooms = (profile?.recommendedRooms || [])
    .map((id) => EVIDENCE_ROOMS.find((room) => room.id === id))
    .filter(Boolean);
  const roomNames = recommendedRooms.map((room) => room.title).join(', ');
  const roomReasons = recommendedRooms
    .map((room) => `${room.title}: ${room.blurb}`)
    .join('; ');
  const actions = (profile?.primaryActions || []).map((action) => action.label).join(', ');
  const actionOutcomes = (profile?.primaryActions || [])
    .map((action) => {
      if (action.view === 'evidence') {
        const room = EVIDENCE_ROOMS.find((item) => item.id === action.evidenceId);
        return `${action.label} opens ${room?.title || 'an Evidence Room'} to examine its aggregate data`;
      }
      if (action.view === 'blender') {
        return `${action.label} starts cross-domain synthesis and trade-off examination`;
      }
      if (action.view === 'legislation') {
        return `${action.label} connects evidence questions to curated statutes and pending fixtures`;
      }
      return `${action.label} opens its role-relevant workspace`;
    })
    .join('; ');

  const homeSteps =
    roleId === 'legislator'
      ? legislatorHomeOrientationSteps()
      : [
          {
            ...step(
              `${roleId}-home-priorities`,
              'role-home-priorities',
              `${label} summary and priorities`,
              `Start with the priorities that orient ${label.toLowerCase()} work and the sequence this perspective usually follows.`,
              `${(profile?.homePriorities || []).map((item) => `${item.title}: ${item.detail}`).join('; ')} Key measure cues: ${(profile?.keyMeasures || []).map((measure) => `${measure.label} ${measure.value}`).join('; ')}.`,
              'Use these tiles as a role-tailored summary before opening deeper evidence. Values are synthetic aggregate cues, not recommendations.',
              `${scenario.situation} ${ROLE_PRIORITY_TRIAGE_EXAMPLES[roleId]}`,
            ),
            route: { view: 'role-home', activeLawId: null, evidenceObjectId: null },
          },
          {
            ...step(
              `${roleId}-home-rooms`,
              'role-home-rooms',
              'Recommended Evidence Rooms',
              `The recommended rooms for ${label.toLowerCase()} are ${roomNames}.`,
              `They fit this role’s emphasis on ${(profile?.dataEmphasis || []).join(', ')}. Room contributions: ${roomReasons}.`,
              'Open a recommended room directly, or continue through the full room list in role-priority order during this guide.',
              `${label} asks, “Which Evidence Room should I use for the new request on my desk?” ${ROLE_RECOMMENDED_ROOM_EXAMPLES[roleId]}`,
            ),
            route: { view: 'role-home', activeLawId: null, evidenceObjectId: null },
          },
          {
            ...step(
              `${roleId}-home-actions`,
              'role-home-actions',
              'Primary actions',
              `The shortcuts for this role are ${actions}.`,
              actionOutcomes,
              'Use a shortcut to begin the named task. Every shared destination remains available from the left navigation.',
              `${label} asks, “How can I start producing ${scenario.result} in the next five minutes?” Press “${profile.primaryActions[0].label},” then ${ROLE_HOME_TASK_EXAMPLES[roleId]}`,
            ),
            route: { view: 'role-home', activeLawId: null, evidenceObjectId: null },
          },
        ];

  return [
    ...homeSteps,
    destinationStep(
      `${roleId}-evidence-index`,
      'nav-evidence-index',
      'Evidence Rooms index',
      'Browse every aggregate Evidence Room from one role-ordered index.',
      'Cards identify each room and summarize its synthetic, de-identified analytical scope.',
      'Open any room to filter, chart, and inspect aggregate objects with provenance.',
      { view: 'evidence', activeEvidenceId: null, evidenceObjectId: null, activeLawId: null },
      roleId,
    ),
    ...rooms.map((room) =>
      destinationStep(
        `${roleId}-room-${room.id}`,
        `nav-room-${room.id}`,
        room.title,
        `${room.title} provides ${room.blurb.toLowerCase()}.`,
        'The page presents aggregate analytical tiles, filters, charts, rows, freshness, ownership, and source context for this domain.',
        'Use it to narrow an evidence question and drill into de-identified aggregate objects before carrying findings into synthesis.',
        { view: 'evidence', activeEvidenceId: room.id, evidenceObjectId: null, activeLawId: null },
        roleId,
      ),
    ),
    destinationStep(
      `${roleId}-blender`,
      'nav-blender',
      'Consideration Blender',
      'Combine role-relevant findings and examine trade-offs across multiple policy lenses.',
      'Focus tabs, sourced findings, relative weights, the question spine, trust cues, and option-pack comparisons appear here.',
      'Select findings, adjust emphasis, and walk Results through Action without turning the output into a prescription.',
      { view: 'blender', evidenceObjectId: null, activeLawId: null },
      roleId,
    ),
    destinationStep(
      `${roleId}-pack`,
      'nav-pack',
      'Win-Win-Win Pack',
      'Examine one synthetic option package across budget, constituent care, and political-viability lenses.',
      'The page shows three win narratives, comparison charts, who may gain or bear cost, levers, failure modes, and trust caveats.',
      'Normally this navigation button unlocks after at least two findings are blended. The guide can preview the current synthetic pack before then.',
      { view: 'pack', evidenceObjectId: null },
      roleId,
    ),
    destinationStep(
      `${roleId}-brief`,
      'nav-brief',
      'Consideration Brief',
      'Review an export-oriented synthesis for talking points and hearing preparation.',
      'The brief carries blend inputs, weights, evidence links, option narrative, and limitations into one structured view.',
      'Normally this navigation button unlocks after at least two findings are blended. The guide can preview the current synthetic brief before then.',
      { view: 'brief', evidenceObjectId: null },
      roleId,
    ),
    destinationStep(
      `${roleId}-legislation`,
      'nav-legislation',
      'Legislative Analysis',
      'Examine relationships between curated law instruments and active blender questions.',
      'The workspace contains synthetic pending fixtures, statutes, relevance signals, sources, and opening-or-blocker analysis.',
      'Filter and open instruments, then trace evidence in either direction. This is examination support, not legal advice.',
      { view: 'legislation', activeLawId: null, evidenceObjectId: null },
      roleId,
    ),
    destinationStep(
      `${roleId}-ask-sam`,
      'nav-ask-sam',
      'Ask Sam',
      `Ask contextual questions with guidance tailored to ${label.toLowerCase()} priorities.`,
      'The panel receives the current page, evidence room, focuses, blended findings, pack, spine status, and role-oriented prompt context.',
      'Open or close the panel from this navigation control. Responses must preserve synthetic-data, source, limitation, and non-prescriptive framing.',
      { askSamOpen: true },
      roleId,
    ),
  ];
}

function legislatorDestinationExample(title, route) {
  if (route?.activeEvidenceId) {
    const roomTask = ROOM_TASK_EXAMPLES[route.activeEvidenceId];
    const deliverable = ROLE_ROOM_DELIVERABLES.legislator[route.activeEvidenceId];
    return `${ROLE_ROOM_REQUESTS.legislator[route.activeEvidenceId]} In ${title}, ${roomTask.action}. You get ${roomTask.outcome} — enough for ${deliverable}.`;
  }
  if (title === 'Evidence Rooms index') return ROLE_INDEX_TASK_EXAMPLES.legislator;
  if (title === 'Consideration Blender') {
    return 'Open Consideration Blender. Add a few findings from your focuses. Check Trust on each, then compare Action packs. Keep it as a shortlist with sources — not a recommendation.';
  }
  if (title === 'Win-Win-Win Pack') {
    const pack = OPTION_PACKS.find((item) => item.id === ROLE_PACK_IDS.legislator);
    return `Open “${pack.title}.” Read who gains, who may bear cost, why it might fail, and the Trust caveats.`;
  }
  if (title === 'Consideration Brief') {
    const pack = OPTION_PACKS.find((item) => item.id === ROLE_PACK_IDS.legislator);
    return `Open “${pack.title},” choose Add to Consideration Brief, then check that findings, sources, and limitations carried over.`;
  }
  if (title === 'Legislative Analysis') {
    return `Open Legislative Analysis. Select “${ROLE_LEGISLATIVE_TASKS.legislator}.” Note openings, blockers, and what still needs official verification — not legal advice.`;
  }
  if (title === 'Ask Sam') {
    return 'Open Ask Sam. Ask which findings matter for your district task, what to verify, and which limitations to keep in the briefing.';
  }
  return `Open ${title}. Follow one clear item to its detail. Keep the source and limitation with the number.`;
}

function destinationExample(title, route, roleId) {
  if (roleId === 'legislator') {
    return legislatorDestinationExample(title, route);
  }

  const profile = getRoleProfile(roleId);
  const scenario = ROLE_GUIDE_SCENARIOS[roleId];
  if (route?.activeEvidenceId) {
    const roomTask = ROOM_TASK_EXAMPLES[route.activeEvidenceId];
    const deliverable = ROLE_ROOM_DELIVERABLES[roleId][route.activeEvidenceId];
    return `${ROLE_ROOM_REQUESTS[roleId][route.activeEvidenceId]} In ${title}, ${roomTask.action}. That gives you ${roomTask.outcome} and produces ${deliverable}.`;
  }
  if (title === 'Evidence Rooms index') {
    return ROLE_INDEX_TASK_EXAMPLES[roleId];
  }
  if (title === 'Consideration Blender') {
    const focusLabels = profile.initialState.selectedFocuses
      .map((id) => FOCUS_TABS.find((focus) => focus.id === id)?.label)
      .filter(Boolean);
    const findingTitles = profile.initialState.selectedFocuses
      .map((focusId) => FINDINGS.find((finding) => finding.focusId === focusId)?.title)
      .filter(Boolean);
    const strongestWeight = Object.entries(profile.initialState.weights)
      .sort((a, b) => b[1] - a[1])[0];
    const strongestLabel =
      FOCUS_TABS.find((focus) => focus.id === strongestWeight[0])?.label || strongestWeight[0];
    return `${profile.shortLabel} asks, “Which candidate best survives comparison across ${formatList(focusLabels)} while I produce ${scenario.result}?” Add ${formatList(findingTitles)} and set ${strongestLabel} to ${strongestWeight[1]}. Review each finding under Trust, then compare the Action packs to produce a sourced shortlist, not a recommendation.`;
  }
  if (title === 'Win-Win-Win Pack') {
    const pack = OPTION_PACKS.find((item) => item.id === ROLE_PACK_IDS[roleId]);
    return `${profile.shortLabel} asks, “Who could gain, who could bear cost, and why might ‘${pack.title}’ fail before it goes on my discussion shortlist?” Open the pack, compare its Budget win, Constituent care win, and Political viability win, then read Who may bear cost, Why it might fail, and Trust caveats.`;
  }
  if (title === 'Consideration Brief') {
    const pack = OPTION_PACKS.find((item) => item.id === ROLE_PACK_IDS[roleId]);
    return `${profile.shortLabel} asks, “Can I carry ‘${pack.title}’ into the next meeting with its evidence and caveats intact?” Open the pack, select Add to Consideration Brief, then review the carried findings, weights, source links, and limitations. The resulting document provides ${scenario.result}.`;
  }
  if (title === 'Legislative Analysis') {
    return `${profile.shortLabel} asks, “Does ‘${ROLE_LEGISLATIVE_TASKS[roleId]}’ create an opening or blocker for the active evidence-based option?” Compare the displayed openings and blockers with the active findings, then follow the primary-source pointer and record what still requires official verification. Use the result to frame a question or option for examination, not a legal conclusion.`;
  }
  if (title === 'Ask Sam') {
    return `${profile.shortLabel} asks, “Which visible findings matter most for my task, what should I verify, and which limitations belong in the briefing?” Open Ask Sam from the dense screen, submit that question, and use the cited screen context to continue the analysis.`;
  }
  return `${scenario.situation} Open ${title}, follow the strongest visible item from summary to supporting detail, and preserve its source and limitation in ${scenario.result}.`;
}

function destinationStep(id, target, title, purpose, data, functionality, route, roleId) {
  return {
    ...step(
      id,
      target,
      title,
      purpose,
      data,
      functionality,
      destinationExample(title, route, roleId),
    ),
    route,
  };
}

export function roleTourKey(roleId) {
  return roleId ? `role-tour:${roleId}` : null;
}

function pageGuideStep(id, target, title, purpose, data, functionality) {
  return {
    ...step(id, target, title, purpose, data, functionality, null),
    allowShowExample: false,
  };
}

const PAGE_GUIDES = {
  operational: [
    pageGuideStep('operational-overview', 'operational-header', 'Operational Intelligence overview', 'Turn published evidence into a prioritized, accountable action to examine.', 'Goal opportunities combine hydrated public data, explicit gaps, modeled benefits, confidence, and limitations.', 'Start with Goals, then use Evidence & Data and Data Sources to inspect what supports the opportunity.'),
    pageGuideStep('operational-pages', 'operational-tabs', 'Three views of the same decision', 'Move between the action portfolio, supporting evidence, and source catalogue.', 'Each tab preserves provenance, freshness, limitations, and the distinction between observed and modeled values.', 'Choose a tab to change the current Operational Intelligence screen; Guide explains whichever tab is visible.'),
    pageGuideStep('operational-current', 'operational-current-page', 'Use the current Operational Intelligence view', 'Work with the content displayed in the selected tab.', 'Goals show quantified opportunities; Evidence & Data shows analytical inputs; Data Sources shows public-source coverage.', 'Open a goal or opportunity for its detailed decision case, or inspect evidence and sources before acting.'),
  ],
  sources: [
    pageGuideStep('sources-overview', 'authoritative-sources', 'Authoritative Sources overview', 'Verify what DecisionPro uses, what is loaded, and what remains unavailable.', 'The catalogue records publisher, status, reporting period, provenance, limitations, and reconciliation history.', 'Use this trust surface before relying on a number in analysis or testimony.'),
    pageGuideStep('sources-tabs', 'authoritative-sources-tabs', 'Choose a source view', 'Inspect the source list, reconciliation status, or time coverage.', 'The three views use the same governed source catalogue and retained load evidence.', 'Switch tabs to answer whether a source exists, loaded correctly, and covers the needed period.'),
    pageGuideStep('sources-current', 'authoritative-sources-current', 'Inspect the current source view', 'Review the active source table or timeline in detail.', 'Rows distinguish loaded, catalogued, blocked, and explicit-gap states instead of implying unavailable data exists.', 'Filter or follow a source record, and carry its period and limitation into downstream analysis.'),
  ],
  'evidence-index': [
    pageGuideStep('evidence-index-overview', 'evidence-index-header', 'Evidence Rooms overview', 'Choose the analytical domain that matches the question you need to answer.', 'Rooms contain aggregate or de-identified measures, filters, charts, drill-down rows, and provenance.', 'Open a room to move from a broad domain to a reviewable evidence object.'),
    pageGuideStep('evidence-index-rooms', 'evidence-index-grid', 'Choose an Evidence Room', 'Compare all available analytical domains in the order emphasized for your selected role.', 'Each card states its scope and approximate aggregate-row volume.', 'Select a card; Guide on the next screen will explain that room.'),
  ],
  'evidence-room': [
    pageGuideStep('evidence-room-overview', 'alp-analytical-header', 'Evidence Room overview', 'Frame the question, reporting period, and analytical scope for this room.', 'The header states the governed measure context, freshness, ownership, and limitations.', 'Confirm the scope before interpreting charts or rows.'),
    pageGuideStep('evidence-room-filters', 'alp-visual-filters', 'Narrow the evidence', 'Filter the aggregate data to the population, geography, service, or status relevant to the question.', 'Filters change the visible aggregate slice without exposing person-level Medicaid records.', 'Apply filters, then inspect how the charts and result list respond.'),
    pageGuideStep('evidence-room-results', 'alp-content', 'Review patterns and results', 'Compare visual patterns with the supporting aggregate rows.', 'Charts and lists represent the same filtered analytical context with source and freshness cues.', 'Open a row to inspect its definition, lineage, and related evidence.'),
    pageGuideStep('evidence-room-lineage', 'alp-lineage', 'Verify lineage and limitations', 'Trace the displayed result back to its governed source context.', 'Lineage records the source, transformations, reporting period, and known limitations.', 'Keep these qualifications attached when carrying a finding into the Blender, a brief, or a hearing question.'),
  ],
  'evidence-object': [
    pageGuideStep('evidence-object-overview', 'object-header', 'Evidence object overview', 'Inspect one aggregate result without losing the room and filter context that produced it.', 'The object header identifies the selected measure or aggregate row and its status.', 'Use the detail view to decide whether the result is suitable for the task.'),
    pageGuideStep('evidence-object-detail', 'object-body', 'Evidence object details', 'Review definitions, values, comparisons, ownership, and caveats together.', 'The fields remain aggregate or de-identified and retain their source context.', 'Follow related evidence or return one screen when the review is complete.'),
  ],
  blender: [
    pageGuideStep('blender-overview', 'blender-title', 'Consideration Blender overview', 'Combine evidence across policy goals and examine trade-offs without treating the result as a prescription.', 'The Blender uses selected focus areas, governed findings, relative weights, trust cues, and option packs.', 'Work from focus selection through the question spine to a sourced shortlist.'),
    pageGuideStep('blender-focuses', 'blender-focus-tabs', 'Select policy focuses', 'Choose the outcomes that should shape the comparison.', 'Focus tabs determine which relevant findings become available; they do not change permissions.', 'Select one or more focuses, then add the findings that belong in the decision.'),
    pageGuideStep('blender-findings', 'blender-findings', 'Add evidence to the blend', 'Choose the specific findings that support the question.', 'Each finding carries magnitude, freshness, weight, source context, and limitations.', 'Add at least two findings to unlock option-pack comparison.'),
    pageGuideStep('blender-spine', 'blender-spine', 'Walk the decision spine', 'Move deliberately from Results through Impact, Trust, and Action.', 'Each stage exposes a different part of the evidence-to-decision chain.', 'Review Trust before carrying an option into a pack or consideration brief.'),
  ],
  pack: [
    pageGuideStep('pack-overview', 'pack-title', 'Option Pack overview', 'Examine one option across budget, constituent care, and political-viability lenses.', 'This is a synthetic option to examine, not a recommendation or prescription.', 'Read all three benefit lenses before reviewing implementation details.'),
    pageGuideStep('pack-wins', 'pack-wins', 'Compare the three potential wins', 'See how the same option may affect spending, care, and practical viability.', 'The narratives are derived from the current blended findings and weights.', 'Use them as hypotheses to test against the detailed caveats below.'),
    pageGuideStep('pack-details', 'pack-details', 'Check beneficiaries, costs, and risks', 'Understand who may gain, who may bear cost, timing, levers, failure modes, and trust caveats.', 'These fields preserve uncertainty and implementation constraints.', 'Carry the option into a Consideration Brief only after reviewing these qualifications.'),
  ],
  brief: [
    pageGuideStep('brief-toolbar', 'brief-toolbar', 'Consideration Brief overview', 'Review and export a structured synthesis for discussion, testimony preparation, or further analysis.', 'The brief carries forward the chosen option, evidence, weights, source links, and limitations.', 'Use the toolbar to return, print, or export after checking the body.'),
    pageGuideStep('brief-body', 'brief-body', 'Review the complete brief', 'Confirm the decision question, supporting findings, trade-offs, and caveats are represented accurately.', 'The body preserves links back to evidence and relevant legislative instruments.', 'Treat the brief as examination support, not legal advice or an automated decision.'),
  ],
  legislation: [
    pageGuideStep('legislation-overview', 'legislation-header', 'Legislative Analysis overview', 'Examine how curated legislative instruments relate to the active policy question.', 'The page combines synthetic pending fixtures, statutes, relevance signals, source pointers, and verification caveats.', 'Filter or open an instrument to inspect possible openings and blockers.'),
    pageGuideStep('legislation-workspace', 'legislation-workspace', 'Work with legislation and evidence', 'Compare instrument language with active findings and option context.', 'The workspace keeps evidence links and official-source pointers visible alongside the analysis.', 'Use the result to frame questions and verification work; it is not legal advice.'),
  ],
  'law-object': [
    pageGuideStep('law-object-overview', 'law-object-header', 'Legislative instrument overview', 'Inspect one legislative instrument and its relationship to the active analysis.', 'The header identifies the instrument, status, and curated context.', 'Confirm the instrument and status before using the analysis.'),
    pageGuideStep('law-object-analysis', 'law-object-page', 'Review openings and blockers', 'See how the instrument may enable, constrain, or require verification for the active option.', 'The analysis connects the instrument to current focuses, findings, and pack context.', 'Use these as issues to examine, not as a legal conclusion.'),
    pageGuideStep('law-object-sources', 'law-object-sources', 'Verify official sources', 'Follow the primary-source pointers before relying on the instrument.', 'Source links and caveats show what requires official verification.', 'Keep the source and verification status with any downstream statement.'),
  ],
};

export function walkthroughTourKey(ctx) {
  if (!ctx?.roleId || !ctx?.view) return null;
  const state = String(ctx.stateCode || 'KY').toUpperCase() === 'FL' ? 'FL' : 'KY';
  if (ctx.view === 'role-home') return `state:${state}:${roleTourKey(ctx.roleId)}`;
  const suffix = ctx.view === 'evidence'
    ? (ctx.evidenceObjectId ? `object:${ctx.evidenceId || 'unknown'}:${ctx.evidenceObjectId}` : ctx.evidenceId || 'index')
    : ctx.view === 'law-object' ? ctx.lawId || 'unknown' : ctx.view;
  return `state:${state}:page-tour:${ctx.roleId}:${suffix}`;
}

export function resolveNextWalkthroughRoute(ctx) {
  if (!ctx?.roleId || !ctx?.view) return null;
  if (ctx.view === 'role-home') return { view: 'operational', evidenceObjectId: null };
  if (ctx.view === 'operational') return { view: 'sources', evidenceObjectId: null };
  if (ctx.view === 'sources') {
    return {
      view: 'evidence',
      activeEvidenceId: null,
      evidenceObjectId: null,
      activeLawId: null,
    };
  }
  if (ctx.view === 'evidence') {
    if (ctx.evidenceObjectId) return { evidenceObjectId: null };
    return { view: 'blender', evidenceObjectId: null, activeLawId: null };
  }
  if (ctx.view === 'blender') return { view: 'legislation', activeLawId: null, evidenceObjectId: null };
  if (ctx.view === 'pack') return { view: 'brief', evidenceObjectId: null };
  if (ctx.view === 'brief') return { view: 'legislation', activeLawId: null, evidenceObjectId: null };
  if (ctx.view === 'law-object') return { view: 'legislation', activeLawId: null, evidenceObjectId: null };
  if (ctx.view === 'legislation') return { view: 'role-home', activeLawId: null, evidenceObjectId: null };
  return null;
}

/**
 * Role entry guide.
 * Default (includeDestinations: false) stays on the role home — three orientation
 * steps — so Next does not drag the user through every nav destination.
 * Pass includeDestinations: true for the full coverage sequence (tests / Show Me wiring).
 */
export function resolveRoleTourSteps(roleId, { includeDestinations = false } = {}) {
  if (!getRoleProfile(roleId)) return [];
  const all = roleHomeSteps(roleId, orderedEvidenceRooms(roleId, EVIDENCE_ROOMS));
  if (includeDestinations) return all;
  return all.filter((step) => String(step.target || '').startsWith('role-home-'));
}

export function resolveWalkthroughSteps(ctx) {
  if (!getRoleProfile(ctx?.roleId)) return [];
  if (ctx.view === 'role-home') return resolveRoleTourSteps(ctx.roleId);
  if (ctx.view === 'evidence') {
    if (ctx.evidenceObjectId) return PAGE_GUIDES['evidence-object'];
    return PAGE_GUIDES[ctx.evidenceId ? 'evidence-room' : 'evidence-index'];
  }
  return PAGE_GUIDES[ctx.view] || [];
}

export function listWalkthroughCoverageKeys() {
  return ROLE_IDS.map(roleTourKey);
}
