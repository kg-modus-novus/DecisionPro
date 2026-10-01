// CodeXen: v1 not-applicable
// Page and tile configuration for simple mode release 2 (presentation only).
// Each page is a list of sections; a section lists sourced measure ids
// (sourcedData.js) shown as measure cards, optionally with a county map or a
// breakdown table. Tiles on the opening page point at a headline measure and
// the page that explains it.

export const SIMPLE_TABS = [
  { view: 'simple-home', label: 'At a glance' },
  { view: 'simple-access', label: 'Access to care' },
  { view: 'simple-spending', label: 'Spending' },
  { view: 'simple-outcomes', label: 'Health outcomes' },
  { view: 'simple-plans', label: 'Plans and providers' },
  { view: 'simple-waivers', label: 'Waiver waitlists' },
  { view: 'simple-ltc', label: 'Long-term care' },
  { view: 'simple-bh', label: 'Behavioral health' },
  { view: 'simple-coverage', label: 'Who is covered' },
  { view: 'simple-county', label: 'Medicaid in my county' },
  { view: 'simple-district', label: 'My district' },
];
export const SIMPLE_VIEWS = SIMPLE_TABS.map((t) => t.view);

export const QUESTIONS = [
  { id: 'money', text: 'Where is Medicaid money going?', view: 'simple-spending' },
  { id: 'care', text: 'Can people get care?', view: 'simple-access' },
  { id: 'health', text: 'Is their health improving?', view: 'simple-outcomes' },
  { id: 'responsible', text: 'Who is responsible when performance falls short?', view: 'simple-plans' },
];

export const PAGES = {
  'simple-access': {
    eyebrow: 'Access to care',
    title: 'Can Medicaid members get care?',
    lede: 'Shortage areas, providers who take Medicaid, how quickly people get appointments, how far they travel, and how often they end up in the hospital or emergency room.',
    sections: [
      {
        id: 'shortages',
        title: 'Shortage areas and providers by county',
        map: {
          options: [
            { measureId: 'pcp-per-10k-county', legend: 'primary care doctors per 10,000 people', unit: 'ratio' },
            { measureId: 'dentists-per-10k-county', legend: 'dentists per 10,000 people', unit: 'ratio' },
            { measureId: 'mental-health-providers-per-10k-county', legend: 'mental health providers per 10,000 people', unit: 'ratio' },
            { measureId: 'members-per-medicaid-pcp-county-est', legend: 'members per primary care doctor taking new Medicaid patients (estimate)', unit: 'ratio' },
            { measureId: 'health-center-sites-county', legend: 'community health center sites', unit: 'count' },
            { measureId: 'hpsa-primary-care-counties', legend: 'primary care shortage score (higher = greater shortage)', unit: 'index' },
          ],
        },
        measures: ['hpsa-primary-care-counties', 'hpsa-dental-counties', 'hpsa-mental-health-counties', 'pcp-per-10k-county', 'dentists-per-10k-county', 'mental-health-providers-per-10k-county'],
      },
      {
        id: 'appointments',
        title: 'Can people get an appointment?',
        measures: ['bh-appt-routine-within-30-days', 'bh-appt-within-48-hours', 'bh-centers-reachable', 'physicians-accepting-new-medicaid', 'members-per-medicaid-pcp-county-est', 'medicaid-enrolled-providers'],
        table: { measures: ['bh-appt-routine-within-30-days', 'bh-appt-within-48-hours'], rowLabel: 'Plan', caption: 'Behavioral health appointment availability by plan' },
      },
      {
        id: 'travel',
        title: 'How far people travel',
        map: {
          options: [
            { measureId: 'drive-time-health-center-county-est', legend: 'hours to the nearest community health center (estimate)', unit: 'hours' },
            { measureId: 'drive-time-otp-county-est', legend: 'hours to the nearest methadone clinic (estimate)', unit: 'hours' },
          ],
        },
        measures: ['drive-time-health-center-county-est', 'drive-time-otp-county-est', 'health-center-sites-county'],
      },
      {
        id: 'hospital',
        title: 'Hospital and emergency room use',
        measures: ['ed-visits-per-1000', 'inpatient-stays-per-1000', 'readmission-ratio-adults', 'preventable-admissions-pqi', 'cs-pqi01-diabetes-admissions', 'cs-pqi08-heart-failure-admissions', 'preventable-hospital-stays-county', 'sud-ed-visits-per-1000'],
      },
    ],
  },
  'simple-spending': {
    eyebrow: 'Spending and cost drivers',
    title: 'Where is Medicaid money going?',
    lede: 'Total spending and who pays it, what it buys, why it changed, what it costs to run the program, and prescription drugs.',
    sections: [
      {
        id: 'totals',
        title: 'How much, and who pays',
        measures: ['total-medicaid-spending', 'federal-share-spending', 'state-share-spending', 'fmap', 'state-fiscal-year-spending-actual', 'enacted-budget-2026-2028'],
      },
      {
        id: 'drivers',
        title: 'Why spending changed',
        measures: ['benefit-spending-pmpm', 'spending-growth-decomposition', 'budgeted-enrollment'],
        table: { measures: ['spending-growth-decomposition'], rowLabel: 'Change from FFY 2023 to FFY 2024', caption: 'Spending change broken into enrollment and cost per member' },
      },
      {
        id: 'what-it-buys',
        title: 'What the money buys',
        measures: ['benefit-spending-by-category', 'managed-care-share-benefits', 'directed-payments', 'nursing-facility-ffs-share'],
        table: { measures: ['benefit-spending-by-category', 'benefit-spending-by-category-ffy2023'], rowLabel: 'Category', caption: 'Benefit spending by category', sortBy: 'benefit-spending-by-category' },
      },
      {
        id: 'admin',
        title: 'What it costs to run Medicaid',
        measures: ['admin-spending-cms64', 'admin-share-of-total', 'dms-admin-personnel-costs', 'dms-staff-fte-estimate'],
      },
      {
        id: 'pharmacy',
        title: 'Prescription drugs',
        measures: ['rx-gross-reimbursed', 'rx-drug-rebate-offset', 'rx-net-spend-est', 'rx-prescriptions', 'drug-spending-gross-and-rebates', 'rx-adherence-antidepressant'],
        table: { measures: ['rx-top-drugs'], rowLabel: 'Drug', caption: 'Top 10 drugs by spending before rebates', sortBy: 'rx-top-drugs' },
      },
    ],
  },
  'simple-outcomes': {
    eyebrow: 'Health outcomes',
    title: 'Is members’ health improving?',
    lede: 'The measures KRS 7A.287 requires for the managed care plans, then the rest of Kentucky’s federal quality reporting. Each shows Kentucky against the median state.',
    statute: true,
    sections: [
      { id: 'krs-a', title: 'Follow-up after an emergency room visit', statute: '(a)', measures: ['cs-fua-adult-7day', 'cs-fua-adult-30day', 'cs-fum-adult-7day', 'cs-fum-adult-30day'] },
      { id: 'krs-b', title: 'Cancer screenings', statute: '(b)', measures: ['cs-bcs-breast-screening-ffy2024', 'est-bcs-breast-screening-ffy2025', 'cs-ccs-cervical-screening', 'cs-col-colorectal-ffy2024', 'est-col-colorectal-51-65-ffy2025'] },
      { id: 'krs-c', title: 'Child and adolescent well-care visits', statute: '(c)', measures: ['cs-wcv-child-adolescent-well-care', 'cs-w30-first-15-months', 'cs-w30-15-30-months'] },
      { id: 'krs-d', title: 'Postpartum care', statute: '(d)', measures: ['cs-ppc-postpartum-adult', 'cs-ppc-postpartum-under21', 'cs-ppc-prenatal-adult'] },
      { id: 'krs-e', title: 'Diabetes care', statute: '(e)', measures: ['cs-hbd-a1c-controlled-ffy2024', 'cs-hbd-a1c-poor-control-ffy2024', 'est-gsd-poor-control-ffy2025'] },
      { id: 'krs-f', title: 'Blood pressure care', statute: '(f)', measures: ['cs-cbp-blood-pressure-control'] },
      { id: 'by-plan', title: 'The same measures by health plan', planMeasures: true },
      { id: 'other', title: 'Immunizations, asthma and hospital stays', measures: ['cs-cis-combo3', 'cs-ima-combo1', 'cs-ima-hpv', 'cs-amr-child', 'cs-amr-adult', 'cs-pcr-readmissions-ratio', 'cs-pqi05-copd-admissions', 'cs-pqi15-asthma-admissions'] },
    ],
  },
  'simple-plans': {
    eyebrow: 'Plans and providers',
    title: 'Who is responsible: the managed care plans',
    lede: 'Five plans hold Kentucky Medicaid contracts through December 31, 2026. Here they are side by side, with prior authorization, provider paperwork, quality money at stake, and sanctions.',
    sections: [
      { id: 'contracts', title: 'Who holds the contracts', measures: ['mco-contracts-current', 'mco-contract-term', 'enrollment-by-plan', 'anthem-exit'] },
      { id: 'scorecard', title: 'The plans side by side', widget: 'plan-scorecard' },
      { id: 'prior-auth', title: 'Prior authorization', measures: ['pa-standard-denied-pct', 'pa-standard-median-days', 'pa-expedited-approved-pct', 'pa-expedited-median-hours', 'pa-overturned-on-appeal-pct', 'pa-requests-per-1000', 'ffs-pa-requests-2025', 'pa-denial-2019-oig'] },
      { id: 'provider-burden', title: 'Getting paid and getting credentialed', measures: ['clean-claims-30day-standard', 'claim-denial-rate-estimate', 'credentialing-statutory-clock', 'credentialing-max-days-estimate', 'eqr-coverage-authorization-compliance', 'eqr-provider-selection-compliance'] },
      { id: 'money-at-stake', title: 'Money tied to quality', measures: ['quality-withhold-pct', 'quality-withhold-dollars-estimate', 'amc-directed-payment-withhold', 'directed-payments', 'state-fair-hearings-filed'] },
      { id: 'sanctions', title: 'Sanctions and corrective actions', widget: 'sanctions', note: 'Actions the state reported taking against plans in the federal annual report. Each is a published intervention, not a DecisionPro finding.' },
    ],
  },
  'simple-waivers': {
    eyebrow: 'Waiver waitlists',
    title: 'Who is waiting for home and community services',
    lede: 'Kentucky’s 1915(c) waivers pay for care at home instead of an institution. Slots are limited, so people wait, some for years.',
    sections: [
      { id: 'waitlist', title: 'The waitlist', measures: ['waiver-waitlist-unduplicated', 'waiver-slots-funded', 'waiver-slots-filled', 'waiver-avg-days-waiting', 'waiver-slots-added-2026-28', 'waitlist-on-medicaid'] },
      { id: 'by-waiver', title: 'By waiver', widget: 'waiver-table' },
      {
        id: 'by-county',
        title: 'Where the people waiting live',
        map: {
          options: [
            { measureId: 'waiver-waitlist-by-county-est', legend: 'people waiting, all waivers (estimate)', unit: 'count' },
            { measureId: 'waiver-waitlist-by-county-est', field: 'mpw', key: 'mpw', legend: 'people waiting for Michelle P. (estimate)', unit: 'count' },
            { measureId: 'waiver-waitlist-by-county-est', field: 'scl', key: 'scl', legend: 'people waiting for SCL (estimate)', unit: 'count' },
            { measureId: 'waiver-waitlist-by-county-est', field: 'hcb', key: 'hcb', legend: 'people waiting for HCB (estimate)', unit: 'count' },
          ],
        },
        measures: ['waiver-waitlist-by-county-est', 'waiver-participants-top-counties'],
      },
      { id: 'delivery', title: 'Are services delivered once a slot is offered?', measures: ['hcbs-allocated-not-started', 'hcbs-hours-delivered-est', 'hcbs-dsp-vacancy', 'hcbs-dsp-turnover', 'hcbs-rate-study-level', 'waiver-mpw-placements-per-year'] },
      { id: 'cost', title: 'What waivers cost', measures: ['waiver-spending', 'waiver-members-served', 'waiver-cost-per-member', 'waiver-sept2025-baseline'] },
    ],
  },
  'simple-ltc': {
    eyebrow: 'Long-term care',
    title: 'Nursing homes and long-term care',
    lede: 'Nursing home care is paid outside managed care in Kentucky. Here is what it costs, whether there are beds, how residents fare, and how the homes are staffed.',
    sections: [
      { id: 'nf-money', title: 'What Medicaid spends', measures: ['nursing-facility-ffs-spending', 'nursing-facility-ffs-share', 'nursing-facility-members-served', 'ltc-ffs-by-type', 'nf-medicaid-share-days', 'pace-enrollment', 'pace-enrollment-est'] },
      { id: 'nf-payment', title: 'Is the payment rate adequate?', measures: ['nf-medicaid-rate', 'nf-cost-per-day', 'nf-medicaid-rate-vs-cost', 'nf-operating-margin'] },
      {
        id: 'nf-capacity',
        title: 'Beds and access by county',
        map: {
          options: [
            { measureId: 'nf-by-county', field: 'beds', legend: 'certified nursing home beds', unit: 'count' },
            { measureId: 'nf-by-county', field: 'occupancyPct', legend: 'percent of beds in use', unit: 'percent' },
            { measureId: 'nf-by-county', legend: 'nursing homes', unit: 'count' },
            { measureId: 'nf-by-county', field: 'medicaidFacilities', legend: 'nursing homes taking Medicaid', unit: 'count' },
          ],
        },
        measures: ['nf-facility-count', 'nf-certified-beds', 'nf-occupancy', 'nf-medicaid-participating', 'nf-cms-terminations', 'nf-inactive-licensed', 'ltc-eligibility-decision-days'],
      },
      { id: 'nf-outcomes', title: 'How residents fare (Kentucky vs the US)', measures: ['nf-hosp-per-1000', 'nf-ed-per-1000', 'nf-short-stay-rehosp', 'nf-discharge-community', 'nf-pressure-ulcers', 'nf-falls-injury', 'nf-antipsychotic', 'nf-antianxiety', 'nf-star-overall'] },
      { id: 'nf-staffing', title: 'Staffing and oversight', measures: ['nf-total-nurse-hprd', 'nf-rn-hprd', 'nf-nurse-turnover', 'nf-rn-turnover', 'nf-overdue-surveys', 'nf-special-focus'] },
    ],
  },
  'simple-bh': {
    eyebrow: 'Behavioral health and substance use',
    title: 'Behavioral health and addiction treatment',
    lede: 'What plans spend, how many members get care, whether people are followed up after a crisis, and access to addiction medication.',
    sections: [
      { id: 'spend', title: 'Spending', measures: ['bh-spend-mco', 'bh-spend-mco-sfy2025-est', 'sud-spend', 'members-with-bh-services'], crossReference: 'bh-by-plan' },
      { id: 'follow-up', title: 'Follow-up after a crisis', measures: ['cs-fuh-adult-7day', 'cs-fuh-child-7day', 'cs-fum-adult-7day', 'cs-fum-child-7day', 'cs-fua-adult-7day', 'cs-iet-initiation', 'cs-iet-engagement'] },
      { id: 'addiction', title: 'Addiction treatment', measures: ['members-on-moud', 'oud-pharmacotherapy', 'otp-count', 'buprenorphine-doses', 'sud-ed-visits-per-1000', 'sud-inpatient-per-1000'] },
      { id: 'crisis', title: 'Crisis line and children', measures: ['988-in-state-answer-rate', '988-calls-routed', 'foster-youth-out-of-state', 'bh-enrolled-providers', 'bh-appt-routine-within-30-days'] },
    ],
  },
  'simple-coverage': {
    eyebrow: 'Who is covered',
    title: 'Who Medicaid covers, and how the Department is keeping up',
    lede: 'Members by group and age, managed care versus fee-for-service, and how quickly applications and renewals are handled.',
    sections: [
      { id: 'members', title: 'Members', measures: ['members-total-dms', 'members-managed-care-vs-ffs', 'members-by-age-band', 'children-kchip-vs-medicaid', 'expansion-adults', 'dual-eligibles', 'foster-sky-members'], table: { measures: ['members-by-eligibility-category'], rowLabel: 'Eligibility group', caption: 'Members by eligibility group', sortBy: 'members-by-eligibility-category' } },
      { id: 'applications', title: 'Applications', measures: ['pi-applications', 'pi-determinations', 'pi-determination-timeliness', 'pi-determinations-over-45-days', 'pi-call-center-volume', 'pi-call-center-abandonment'] },
      { id: 'renewals', title: 'Renewals and coverage losses', measures: ['renewals-due-outcomes', 'renewals-ex-parte-rate', 'renewals-retained-rate', 'renewals-procedural-closure-rate', 'renewals-ineligible-rate', 'fair-hearings-over-90-days'], table: { measures: ['renewals-by-age'], rowLabel: 'Age group', caption: 'Renewal terminations by age' } },
    ],
  },
};

// Population filter: which members the visitor is looking at.
export const POPULATIONS = [
  { id: 'all', label: 'All members' },
  { id: 'children', label: 'Children (0–18)' },
  { id: 'working', label: 'Working-age adults (19–64)' },
  { id: 'older', label: 'Older adults (65+)' },
  { id: 'expansion', label: 'Expansion adults' },
  { id: 'disabled', label: 'People with disabilities' },
  { id: 'duals', label: 'Also on Medicare (dual eligible)' },
  { id: 'kchip', label: 'KCHIP children' },
];
