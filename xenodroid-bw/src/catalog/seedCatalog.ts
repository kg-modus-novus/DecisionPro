/** Seed catalog from planning SoT + provisional measures (hydration cutover). */

export const SOURCE_SYSTEMS = [

  {

    from_sys_id: 'CMS_DATA_MEDICAID_ENR',

    publisher: 'CMS / data.medicaid.gov',

    tos_grade: 'SAFE',

    base_uri: 'https://data.medicaid.gov/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360',

    attribution_notes: 'Performance Indicator dataset; U.S. government works license',

    paid_follow_on_todo: 'KY operational enrollment warehouse under DMS authority',

  },

  {

    from_sys_id: 'CMS_DATA_MEDICAID',

    publisher: 'CMS / data.medicaid.gov',

    tos_grade: 'SAFE',

    base_uri: 'https://data.medicaid.gov/dataset/5b19d1d4-ae43-5fcd-ba14-3cecd99f473f',

    attribution_notes: 'Medicaid Financial Management Data — state expenditure aggregates',

    paid_follow_on_todo: 'KY claim-grain spend warehouse under DMS DUA',

  },

  {

    from_sys_id: 'CMS_MEDICAID_SCORECARD',

    publisher: 'CMS / Medicaid.gov',

    tos_grade: 'SAFE',

    base_uri: 'https://www.medicaid.gov/state-overviews/scorecard',

    attribution_notes: 'Medicaid & CHIP Scorecard / Core Set public measures',

    paid_follow_on_todo: 'Live Scorecard API bind for all Core Set picks',

  },

  {

    from_sys_id: 'CMS_MEDICAID_PHARMACY',

    publisher: 'CMS / data.cms.gov',

    tos_grade: 'SAFE',

    base_uri:

      'https://data.cms.gov/summary-statistics-on-use-and-payments/medicare-medicaid-spending-by-drug/medicaid-spending-by-drug',

    attribution_notes: 'Medicaid Spending by Drug — federal published totals',

    paid_follow_on_todo: 'KY MCO pharmacy PMPM under DUA',

  },

  {

    from_sys_id: 'KY_DMS_MCO_CONTRACTS',

    publisher: 'Kentucky CHFS / DMS',

    tos_grade: 'ATTRIBUTABLE',

    base_uri: 'https://chfs.ky.gov/agencies/dms/dhpo/Pages/mco-contracts.aspx',

    attribution_notes: 'Cite DMS managed care contracts page and effective dates',

    paid_follow_on_todo: 'Authorized member-level MCO assignment',

  },

  {

    from_sys_id: 'KY_DMS_MCO_EVAL',

    publisher: 'Kentucky CHFS / DMS',

    tos_grade: 'ATTRIBUTABLE',

    base_uri:

      'https://chfs.ky.gov/agencies/dms/dpqo/mco-qb/Pages/default.aspx',

    attribution_notes: 'EQRO-assisted comprehensive evaluation PDF extract',

    paid_follow_on_todo: 'Structured EQRO/HEDIS warehouse under DMS agreement',

  },

  {

    from_sys_id: 'KY_DMS_COUNTY_COUNTS',

    publisher: 'Kentucky CHFS / DMS',

    tos_grade: 'ATTRIBUTABLE',

    base_uri: 'https://chfs.ky.gov/agencies/dms/dafm/Pages/statistics.aspx',

    attribution_notes: 'Monthly Medicaid counts by county — curated from published DMS stats PDFs',

    paid_follow_on_todo: 'Machine-readable county feed from DMS',

  },

  {

    from_sys_id: 'KY_DMS_FEE_SCHEDULE',

    publisher: 'Kentucky CHFS / DMS',

    tos_grade: 'ATTRIBUTABLE',

    base_uri: 'https://chfs.ky.gov/agencies/dms/Pages/feesrates.aspx',

    attribution_notes: 'Published fee schedule effective dating — rates ≠ paid amounts',

    paid_follow_on_todo: 'Encounter paid amounts under DUA',

  },

  {

    from_sys_id: 'KY_DMS_PROVIDER_DIR',

    publisher: 'Kentucky CHFS / DMS',

    tos_grade: 'ATTRIBUTABLE',

    base_uri: 'https://chfs.ky.gov/agencies/dms/dpi/Pages/Provider-Directory.aspx',

    attribution_notes: 'Public provider directory freshness meta — not payment SoT',

    paid_follow_on_todo: 'Full provider enrollment extract',

  },

  {

    from_sys_id: 'KY_LRC_RECORD',

    publisher: 'Kentucky General Assembly / LRC',

    tos_grade: 'SAFE',

    base_uri: 'https://apps.legislature.ky.gov/record/',

    attribution_notes: 'Legislative Record bill pages — policy context',

    paid_follow_on_todo: 'Bill↔measure impact modeling',

  },

  {

    from_sys_id: 'CENSUS_ACS',

    publisher: 'U.S. Census Bureau',

    tos_grade: 'SAFE',

    base_uri: 'https://www.census.gov/programs-surveys/acs',

    attribution_notes:
      'ACS poverty/uninsured context; KY uninsured shares loaded via KFF ACS-based State Health Facts extract with Census ACS page attribution',

    paid_follow_on_todo: 'Direct Census ACS API bind with CENSUS_API_KEY for county grain',

  },

  {

    from_sys_id: 'HRSA_AHRF',

    publisher: 'HRSA',

    tos_grade: 'SAFE',

    base_uri: 'https://data.hrsa.gov/topics/health-workforce/ahrf',

    attribution_notes: 'Area Health Resources Files / shortage context',

    paid_follow_on_todo: '',

  },

  {

    from_sys_id: 'AHRQ_HCUP',

    publisher: 'AHRQ',

    tos_grade: 'RESTRICTED',

    base_uri: 'https://hcup-us.ahrq.gov/',

    attribution_notes: 'KY SEDD/SID microdata typically licensed — not auto-ingested',

    paid_follow_on_todo: 'Licensed HCUP aggregates or free published KY tables',

    block_reason: 'HCUP SID/SEDD microdata for Kentucky is typically licensed; redistribution and auto-ingest are blocked on the public POC path (TOS grade RESTRICTED).',

    unblock_need: 'Obtain an approved AHRQ HCUP data use agreement (or use free published KY aggregate tables if available), then Director-authorize a LoadClass=REAL retrieve/load — not web scrape of microdata.',

  },

  {

    from_sys_id: 'TEST_FIXTURE_PACK',

    publisher: 'DecisionPro TEST fixtures',

    tos_grade: 'SAFE',

    base_uri: 'xenodroid-bw/src/fixtures/',

    attribution_notes: 'Synthetic only — LoadClass=TEST — never accurate-demo claim',

    paid_follow_on_todo: '',

  },

] as const;



export const MEASURES = [

  {

    measure_id: 'M-001',

    name: 'Total Medicaid & CHIP enrollment (KY)',

    definition:

      'Total Medicaid and CHIP enrollment for Kentucky from CMS PI dataset for the latest reporting period with values.',

    unit: 'persons',

    grain: 'state × month',

    sources: ['CMS_DATA_MEDICAID_ENR'],

  },

  {

    measure_id: 'M-002',

    name: 'YoY enrollment change %',

    definition:

      'Percent change in KY total Medicaid and CHIP enrollment vs same month prior year when both periods exist.',

    unit: 'percent',

    grain: 'state × year',

    sources: ['CMS_DATA_MEDICAID_ENR'],

  },

  {

    measure_id: 'M-003',

    name: 'County Medicaid enrollment count (selected)',

    definition: 'Published DMS monthly membership counts for selected Kentucky counties.',

    unit: 'persons',

    grain: 'county × month',

    sources: ['KY_DMS_COUNTY_COUNTS'],

  },

  {

    measure_id: 'M-004',

    name: 'Federal reported Medicaid expenditure (KY)',

    definition: 'State total Medicaid program expenditures from CMS financial management open data (curated KY slice).',

    unit: 'USD millions',

    grain: 'state × period',

    sources: ['CMS_DATA_MEDICAID'],

  },

  {

    measure_id: 'M-007',

    name: 'Active MCO roster count',

    definition: 'Count of active contracted Kentucky Medicaid MCOs as of catalogue as-of date.',

    unit: 'count',

    grain: 'state × as-of',

    sources: ['KY_DMS_MCO_CONTRACTS'],

  },

  {

    measure_id: 'M-010',

    name: 'Child Core Set WCV-CH well-care visits (KY)',

    definition: 'Kentucky Child and Adolescent Well-Care Visits Ages 3–21 (WCV-CH) from CMS Core Set quality measures CSVs (multi-vintage).',

    unit: 'percent',

    grain: 'state × measure × year',

    sources: ['CMS_MEDICAID_SCORECARD'],

  },

  {

    measure_id: 'M-011',

    name: 'Adult Core Set BCS-AD breast cancer screening (KY)',

    definition: 'Kentucky Breast Cancer Screening Ages 50–74 (BCS-AD) from CMS Core Set quality measures CSVs (multi-vintage).',

    unit: 'percent',

    grain: 'state × measure × year',

    sources: ['CMS_MEDICAID_SCORECARD'],

  },

  {

    measure_id: 'M-012',

    name: 'Maternal PPC-AD postpartum care (KY)',

    definition: 'Kentucky Prenatal and Postpartum Care: Postpartum Care (PPC-AD) from CMS Core Set quality measures CSVs (multi-vintage).',

    unit: 'percent',

    grain: 'state × year',

    sources: ['CMS_MEDICAID_SCORECARD'],

  },

  {

    measure_id: 'M-014',

    name: 'MCO evaluation — quality domain summary',

    definition: 'ATTRIBUTABLE theme flag from DMS comprehensive evaluation / EQRO summary PDF.',

    unit: 'flag',

    grain: 'MCO × FY',

    sources: ['KY_DMS_MCO_EVAL'],

  },

  {

    measure_id: 'M-017',

    name: 'Pharmacy program spend (published federal)',

    definition: 'Federal published Medicaid drug spending aggregate used as pharmacy pressure signal for KY context.',

    unit: 'USD millions',

    grain: 'state × period',

    sources: ['CMS_MEDICAID_PHARMACY'],

  },

  {

    measure_id: 'M-021',

    name: 'ACS uninsured context (KY)',

    definition:
      'Kentucky uninsured share of total population from ACS-based public republish (KFF State Health Facts) for demographic context — not claim-grain Medicaid payment.',

    unit: 'percent',

    grain: 'state × calendar year',

    sources: ['CENSUS_ACS'],

  },

  {

    measure_id: 'M-022',

    name: 'Provider directory freshness meta',

    definition: 'As-of meta for KY DMS public provider directory page.',

    unit: 'as-of',

    grain: 'state × as-of',

    sources: ['KY_DMS_PROVIDER_DIR'],

  },

  {

    measure_id: 'M-023',

    name: 'Fee schedule update event',

    definition: 'Published physician fee schedule revision event from DMS fee schedules page.',

    unit: 'event',

    grain: 'schedule × effective date',

    sources: ['KY_DMS_FEE_SCHEDULE'],

  },

  {

    measure_id: 'M-028',

    name: 'Pending legislation touchpoint count (session)',

    definition: 'Count of curated LRC Medicaid-related bills in the active session extract.',

    unit: 'count',

    grain: 'session',

    sources: ['KY_LRC_RECORD'],

  },

] as const;



export const DATA_REQUESTS = [

  {

    data_request_id: 'DR-TEST-ENROLLMENT',

    from_sys_id: 'TEST_FIXTURE_PACK',

    target_psa_prefix: 'psa/TEST_FIXTURE_PACK/enrollment/',

    load_class: 'TEST',

  },

  {

    data_request_id: 'DR-TEST-MCO',

    from_sys_id: 'TEST_FIXTURE_PACK',

    target_psa_prefix: 'psa/TEST_FIXTURE_PACK/mco/',

    load_class: 'TEST',

  },

  {

    data_request_id: 'DR-REAL-PI-ENROLLMENT',

    from_sys_id: 'CMS_DATA_MEDICAID_ENR',

    target_psa_prefix: 'psa/CMS_DATA_MEDICAID_ENR/pi/',

    load_class: 'REAL',

  },

  {

    data_request_id: 'DR-REAL-MCO-ROSTER',

    from_sys_id: 'KY_DMS_MCO_CONTRACTS',

    target_psa_prefix: 'psa/KY_DMS_MCO_CONTRACTS/roster/',

    load_class: 'REAL',

  },

  {

    data_request_id: 'DR-REAL-PUBLIC-HYDRATION',

    from_sys_id: 'CMS_MEDICAID_SCORECARD',

    target_psa_prefix: 'psa/PUBLIC_HYDRATION/',

    load_class: 'REAL',

  },

] as const;


