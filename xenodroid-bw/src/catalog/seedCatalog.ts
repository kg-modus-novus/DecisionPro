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

    from_sys_id: 'CMS_MCPAR',

    publisher: 'CMS / data.medicaid.gov',

    tos_grade: 'SAFE',

    base_uri: 'https://data.medicaid.gov/dataset/66da70e7-228e-41aa-b041-6f9e433ff237',

    attribution_notes: 'MCPAR PUF 2024; annual state-reported managed-care accountability responses',

    paid_follow_on_todo: 'Reconcile reporting entities to effective Kentucky MCO contracts and operational case systems',

  },

  {

    from_sys_id: 'CMS_PROVIDER_DATA',

    publisher: 'CMS Provider Data Catalog',

    tos_grade: 'SAFE',

    base_uri: 'https://data.cms.gov/provider-data/dataset/4pq5-n9py',

    attribution_notes: 'Kentucky Medicare/Medicaid-certified nursing-facility capacity, ratings, staffing and penalties',

    paid_follow_on_todo: 'Join to Kentucky Medicaid provider enrollment and claims only under authority',

  },

  {

    from_sys_id: 'SAM_ENTITY',

    publisher: 'U.S. General Services Administration / SAM.gov',

    tos_grade: 'ATTRIBUTABLE',

    base_uri: 'https://sam.gov/content/entity-registration',

    attribution_notes: 'Entity Management API v3; primary UEI-registrant-name authority in the OFR-02 hybrid seed order. Director-provisioned key, loaded from local env at runtime only. Verified live (2026-08-31): this API tier does not expose EIN/TIN — UEI-EIN links in the crosswalk are therefore computed name/address matches, not same-record facts from this source.',

    paid_follow_on_todo: 'FOUO-tier SAM access (if authorized) would add EIN directly; not pursued in OFR-02',

  },

  {

    from_sys_id: 'IRS_EO_BMF',

    publisher: 'IRS Exempt Organizations Business Master File',

    tos_grade: 'SAFE',

    base_uri: 'https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf',

    attribution_notes: 'State CSV extracts (EIN, name, address, NTEE code, ruling date, foundation code); organization-level only, no officer/compensation detail',

    paid_follow_on_todo: 'Pair with annual Form 990 extract (OFR-03) for financial resilience ratios',

  },

  {

    from_sys_id: 'NPPES',

    publisher: 'CMS National Plan & Provider Enumeration System',

    tos_grade: 'ATTRIBUTABLE',

    base_uri: 'https://npiregistry.cms.hhs.gov/api/',

    attribution_notes: 'Organizational NPI records only (enumeration_type=NPI-2); the only source in this spine that publishes a cross-identifier pair (NPI + embedded state Medicaid provider ID) within the same record. Individual-provider NPI records are never queried or promoted.',

    paid_follow_on_todo: 'Bulk NPPES file ingestion for full-coverage NPI matching beyond the bounded per-run candidate set',

  },

  {

    from_sys_id: 'IRS_990_EXTRACT',

    publisher: 'IRS Statistics of Income (SOI)',

    tos_grade: 'SAFE',

    base_uri: 'https://www.irs.gov/statistics/soi-tax-stats-annual-extract-of-tax-exempt-organization-financial-data',

    attribution_notes: 'Annual Form 990 org-level financial extract (2 posting-year vintages), filtered to the OFR-02 KY+FL EO BMF EIN universe. No government-specific grant-revenue field or Part IX program/management/fundraising column split exists in this extract (see grounding correction). Form 990 only in this package, not 990-EZ/990-PF. Organization-level only — officer/compensation XML e-file detail is out of OFR scope entirely.',

    paid_follow_on_todo: 'Add 990-EZ/990-PF vintages and a longer multi-year trend series if warranted',

  },

  {

    from_sys_id: 'CMS_HCRIS',

    publisher: 'CMS Healthcare Cost Report Information System (data.cms.gov)',

    tos_grade: 'SAFE',

    base_uri: 'https://data.cms.gov/provider-compliance/cost-reports',

    attribution_notes: 'Hospital + SNF annual cost-report facility financials (most recent FY2023 for both). Medicare cost-report basis — not Medicaid payment truth, not a full-payer financial statement. Florida hospital-financial signal is an explicit fallback alongside the still-blocked FL_AHCA_HOSPITAL_FINANCIAL gap (GAP-FL-F-14-PARAMETERS), not a replacement for it.',

    paid_follow_on_todo: 'Join county rollups to Census/HRSA eligible-population ratios for a true access-continuity watchlist',

  },

  {

    from_sys_id: 'HHS_OIG_LEIE',

    publisher: 'HHS Office of Inspector General',

    tos_grade: 'SAFE',

    base_uri: 'https://www.oig.hhs.gov/exclusions/leie-database-supplement-downloads/',

    attribution_notes: 'Current full LEIE CSV; aggregate legislative display only; identity candidates require verification',

    paid_follow_on_todo: 'Controlled identity-resolution workflow against authorized provider enrollment',

  },

  {

    from_sys_id: 'USA_SPENDING',

    publisher: 'U.S. Department of the Treasury / USAspending',

    tos_grade: 'SAFE',

    base_uri: 'https://api.usaspending.gov/',

    attribution_notes: 'OFR-01: fiscal-year 93.778 obligation aggregates (Kentucky) plus award/recipient-grain rows for Assistance Listings 93.775/93.777/93.778/93.791/93.224/93.958/93.959 across Kentucky and Florida via place-of-performance and recipient-location queries; federal award context, not state payment truth',

    paid_follow_on_todo: 'Reconcile recipient UEIs/EINs to state agencies, contracted providers, and state accounting records under the OFR-02 identity crosswalk',

  },

  {

    from_sys_id: 'KY_OPEN_GIS',

    publisher: 'Kentucky Division of Geographic Information',

    tos_grade: 'SAFE',

    base_uri: 'https://kygisserver.ky.gov/arcgis/rest/services/WGS84WM_Services/Ky_Hospitals_WGS84WM/MapServer/0',

    attribution_notes: 'Official ArcGIS licensed-hospital facility and capacity attributes; institutional context only',

    paid_follow_on_todo: 'Crosswalk provider/service areas to authoritative program geographies',

  },

  {

    from_sys_id: 'KY_OSBD_BUDGET',

    publisher: 'Kentucky Office of State Budget Director',

    tos_grade: 'ATTRIBUTABLE',

    base_uri: 'https://osbd.ky.gov/Publications/Pages/Budget-Documents.aspx',

    attribution_notes: 'Revision-aware current biennial budget document manifest and retained files',

    paid_follow_on_todo: 'Governed table/page extraction and appropriation-line reconciliation',

  },

  {

    from_sys_id: 'KY_TRANSPARENCY_SPEND',

    publisher: 'Commonwealth of Kentucky Transparency',

    tos_grade: 'ATTRIBUTABLE',

    base_uri: 'https://transparency.ky.gov/search/Pages/contractsearch.aspx',

    attribution_notes: 'Official nightly contract-search page; no supported public analytical API/export discovered',

    paid_follow_on_todo: 'Obtain supported export/accounting feed or operator-supplied governed extract',

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

    attribution_notes:
      'Public AHRF county Primary Care HPSA designation codes (usage limitations: None); KY designated-county counts for M-020. Miles-to-care remains Gap.',

    paid_follow_on_todo: 'Optional: county-grain HPSA map tiles; still no miles-to-care without claims geo',

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

    definition:
      'Kentucky Child and Adolescent Well-Care Visits Ages 3–21 (WCV-CH) from CMS Core Set quality measures CSVs (multi-vintage). Labeled FFY reporting · MY care window.',

    unit: 'percent',

    grain: 'state × Core Set FFY / measurement year',

    sources: ['CMS_MEDICAID_SCORECARD'],

  },

  {

    measure_id: 'M-011',

    name: 'Adult Core Set BCS-AD breast cancer screening (KY)',

    definition:
      'Kentucky Breast Cancer Screening (BCS-AD) from CMS Core Set quality measures CSVs (multi-vintage). Age band Ages 50–74 through FFY 2023; FFY 2024 publisher row is Ages 50–64. Labeled FFY reporting · MY care window.',

    unit: 'percent',

    grain: 'state × Core Set FFY / measurement year',

    sources: ['CMS_MEDICAID_SCORECARD'],

  },

  {

    measure_id: 'M-012',

    name: 'Maternal PPC postpartum care (KY)',

    definition:
      'Kentucky Prenatal and Postpartum Care — postpartum visit 7–84 days after delivery. CMS Core Set abbreviation PPC-AD through FFY 2023 reporting (MY 2022); PPC2-AD from FFY 2024 reporting (MY 2023). Labeled FFY reporting · MY care window.',

    unit: 'percent',

    grain: 'state × Core Set FFY / measurement year',

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

    measure_id: 'M-020',

    name: 'Rural / HPSA coverage context (KY)',

    definition:
      'Count of Kentucky counties with Primary Care Health Professional Shortage Area designation (whole or partial county) from public HRSA Area Health Resources Files. Access geography context — not average miles-to-care.',

    unit: 'counties',

    grain: 'state × HPSA vintage year (county designation codes)',

    sources: ['HRSA_AHRF'],

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

  {

    data_request_id: 'DR-REAL-MCPAR-KY',

    from_sys_id: 'CMS_MCPAR',

    target_psa_prefix: 'psa/CMS_MCPAR/ky/',

    load_class: 'REAL',

  },

  {

    data_request_id: 'DR-REAL-CMS-PROVIDER-KY',

    from_sys_id: 'CMS_PROVIDER_DATA',

    target_psa_prefix: 'psa/CMS_PROVIDER_DATA/ky/',

    load_class: 'REAL',

  },

  {

    data_request_id: 'DR-REAL-LEIE',

    from_sys_id: 'HHS_OIG_LEIE',

    target_psa_prefix: 'psa/HHS_OIG_LEIE/current/',

    load_class: 'REAL',

  },

  {

    data_request_id: 'DR-REAL-USASPENDING-KY-MEDICAID',

    from_sys_id: 'USA_SPENDING',

    target_psa_prefix: 'psa/USA_SPENDING/ky-medicaid/',

    load_class: 'REAL',

  },

  {

    data_request_id: 'DR-REAL-KY-HOSPITALS',

    from_sys_id: 'KY_OPEN_GIS',

    target_psa_prefix: 'psa/KY_OPEN_GIS/hospitals/',

    load_class: 'REAL',

  },

  {

    data_request_id: 'DR-REAL-KY-OSBD-DOCS',

    from_sys_id: 'KY_OSBD_BUDGET',

    target_psa_prefix: 'psa/KY_OSBD_BUDGET/current/',

    load_class: 'REAL',

  },

  {

    data_request_id: 'DR-REAL-KY-DMS-CONTRACT-DOCS',

    from_sys_id: 'KY_DMS_MCO_CONTRACTS',

    target_psa_prefix: 'psa/KY_DMS_MCO_CONTRACTS/current-documents/',

    load_class: 'REAL',

  },

  {

    data_request_id: 'DR-REAL-KY-TRANSPARENCY-MANIFEST',

    from_sys_id: 'KY_TRANSPARENCY_SPEND',

    target_psa_prefix: 'psa/KY_TRANSPARENCY_SPEND/page-manifest/',

    load_class: 'REAL',

  },

  {

    data_request_id: 'DR-REAL-USASPENDING-AWARD-GRAIN',

    from_sys_id: 'USA_SPENDING',

    target_psa_prefix: 'psa/USA_SPENDING/REAL/',

    load_class: 'REAL',

  },

  {

    data_request_id: 'DR-REAL-ORG-CROSSWALK',

    from_sys_id: 'IRS_EO_BMF',

    target_psa_prefix: 'psa/IRS_EO_BMF/REAL/',

    load_class: 'REAL',

  },

  {

    data_request_id: 'DR-REAL-IRS-990-EXTRACT',

    from_sys_id: 'IRS_990_EXTRACT',

    target_psa_prefix: 'psa/IRS_990_EXTRACT/REAL/',

    load_class: 'REAL',

  },

  {

    data_request_id: 'DR-REAL-CMS-HCRIS',

    from_sys_id: 'CMS_HCRIS',

    target_psa_prefix: 'psa/CMS_HCRIS/REAL/',

    load_class: 'REAL',

  },

] as const;


