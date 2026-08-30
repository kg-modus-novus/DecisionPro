/**
 * Legislator-facing glossary for DecisionPro / XenoDroid BW terms.
 * Keep definitions plain-language; include one concrete usage example each.
 */
export const GLOSSARY_TERMS = [
  {
    id: 'psa',
    term: 'PSA',
    aliases: ['Persistent Staging Area'],
    definition:
      'The Persistent Staging Area — where DecisionPro first stores the raw files it retrieves from a publisher (for example a CMS CSV or a DMS PDF), unchanged, with a timestamp and source identity.',
    example:
      'In Authoritative sources, Loaded (PSA) counts how many records from that publisher file are currently sitting in the PSA.',
  },
  {
    id: 'cube',
    term: 'Cube',
    aliases: ['Cubes', 'Evidence Room cube', 'Evidence Room cubes'],
    definition:
      'A prepared table of numbers shaped for a specific screen or question (an Evidence Room). Cubes are built from cleansed warehouse data so the UI can show aggregates quickly without re-reading every raw file.',
    example:
      'Resultant (cubes) for Scorecard may show outcomes: 11 and benchmarks: 11 — eleven REAL rows in each of those Evidence Room cubes.',
  },
  {
    id: 'dso',
    term: 'Detail DSO',
    aliases: ['DSO', 'Detail DSOs'],
    definition:
      'Detail DataStore Object — the cleansed, structured layer after PSA. Raw files are checked and typed here (for example Kentucky enrollment by month) before cubes are built.',
    example:
      'A CMS enrollment CSV lands in the PSA, then Kentucky rows are written into a Detail DSO that cubes and measures read from.',
  },
  {
    id: 'data-request',
    term: 'Data Request',
    aliases: ['Data Requests'],
    definition:
      'A controlled retrieval job that pulls an authorized public source into the PSA, records what was fetched, and starts the cleanse → Detail DSO → cube path.',
    example:
      'A Data Request for the CMS Performance Indicator CSV downloads the publisher file, lands it in the PSA, and logs the load for audit.',
  },
  {
    id: 'from-sys-id',
    term: 'FromSysID',
    aliases: ['FromSysId', 'source system ID'],
    definition:
      'The stable identifier for a publisher source system in DecisionPro (for example CMS_DATA_MEDICAID_ENR). Every landed file and measure row carries this so users can see which source a number came from.',
    example:
      'The Authoritative sources catalogue lists each FromSysID so enrollment numbers can be traced back to CMS, not mixed with a different publisher.',
  },
  {
    id: 'sot',
    term: 'Source of Truth',
    aliases: ['SoT', 'source of truth', 'publisher SoT'],
    definition:
      'The owning published source DecisionPro cites for a number — usually a government open-data file, report, or official page — not an invented estimate.',
    example:
      'Source scale describes how large that Source of Truth is (CSVs, years, PDFs), before DecisionPro loads a smaller curated slice.',
  },
  {
    id: 'load-class',
    term: 'LoadClass',
    aliases: ['Load Class', 'REAL', 'TEST'],
    definition:
      'A label on warehouse data: REAL means public-source values allowed on the demo path; TEST means synthetic fixtures used only inside the controlled Accuracy Gate harness and then purged.',
    example:
      'After the Accuracy Gate purges TEST data, Evidence Rooms show only REAL numbers or labeled Gaps.',
  },
  {
    id: 'xenodroid-bw',
    term: 'XenoDroid BW',
    aliases: ['BW', 'business warehouse'],
    definition:
      'DecisionPro’s warehouse spine (inspired by SAP BW layering in name only — not licensed SAP software). It stages publisher files, cleanses them, and builds cubes the product can query.',
    example:
      'When you see Loaded (PSA) and Resultant (cubes), you are looking at two layers of the XenoDroid BW path from raw file to screen-ready aggregates.',
  },
  {
    id: 'accuracy-gate',
    term: 'Accuracy Gate',
    aliases: ['Gate', 'bw:gate'],
    definition:
      'The controlled pipeline that proves the warehouse path with TEST fixtures, empties them, then loads REAL public sources before DecisionPro claims accuracy on the demo.',
    example:
      'Operators run the Accuracy Gate before a REAL refresh so synthetic test numbers never appear as Kentucky Medicaid fact.',
  },
  {
    id: 'source-reconciliation',
    term: 'Source Reconciliation',
    aliases: ['reconciliation'],
    definition:
      'An independent check that DecisionPro’s displayed numbers still match the owning published sources — separate from the Accuracy Gate pipeline control.',
    example:
      'On the Source Reconciliation tab, each check shows the warehouse value next to the publisher value it should match.',
  },
  {
    id: 'as-of',
    term: 'As-of',
    aliases: ['as-of date', 'as-of window'],
    definition:
      'The publisher’s “true as of” date for a number (when the source says the fact applies), not merely the day DecisionPro downloaded the file.',
    example:
      'An enrollment as-of of 2026-03-31 means the CMS series reports that month’s membership, even if DecisionPro loaded the file later.',
  },
  {
    id: 'explicit-gap',
    term: 'Explicit Gap',
    aliases: ['Gap', 'Gaps'],
    definition:
      'A labeled hole where DecisionPro deliberately does not invent a number because no authorized continuous public series exists. Gaps stay visible so absence is not mistaken for zero.',
    example:
      'Claim-grain dollar impact by service may appear as an Explicit Gap until Kentucky authorizes the needed data feed.',
  },
  {
    id: 'landing',
    term: 'Landing',
    aliases: ['executive landing', 'landing binds', 'landing measures'],
    definition:
      'Compact measure×as-of rows used for executive tiles and accuracy checks. Distinct from Evidence Room cube rows, which power room screens.',
    example:
      'Enrollment may have many landing binds across months while Resultant shows one command-center cube row that the room screen reads.',
  },
  {
    id: 'source-scale',
    term: 'Source scale',
    aliases: [],
    definition:
      'How the publisher packages the Source of Truth — files, periods, years, documents — and how many records that package contains. It is not the same as how many rows DecisionPro loaded.',
    example:
      'Pharmacy Source scale may read “1 CSV · 5 years · 18,511 rows” while Loaded (PSA) shows only the curated KY bind DecisionPro staged.',
  },
  {
    id: 'operational-intelligence',
    term: 'Operational intelligence',
    aliases: ['operational analysis'],
    definition: 'Evidence organized around a decision: what was observed, how it was analyzed, who can act, what benefit is expected, and how the result will be measured.',
    example: 'The Operational intelligence Goals page turns a reported overpayment signal into a reviewable recovery-reconciliation opportunity.',
  },
  {
    id: 'cms',
    term: 'CMS',
    aliases: ['Centers for Medicare & Medicaid Services'],
    definition: 'The federal Centers for Medicare & Medicaid Services, which administers Medicare, works with states on Medicaid and CHIP, and publishes several datasets used by DecisionPro.',
    example: 'DecisionPro uses CMS MCPAR and Provider Data Catalog publications as public aggregate evidence.',
    reference: { label: 'CMS', href: 'https://www.cms.gov/' },
  },
  {
    id: 'dms',
    term: 'DMS',
    aliases: ['Kentucky Department for Medicaid Services'],
    definition: 'Kentucky’s Department for Medicaid Services, the state organization responsible for administering the Kentucky Medicaid program.',
    example: 'A recommendation may name DMS network oversight or program integrity as the accountable owner.',
    reference: { label: 'Kentucky DMS', href: 'https://www.chfs.ky.gov/agencies/dms/Pages/default.aspx' },
  },
  {
    id: 'ahca',
    term: 'AHCA',
    aliases: ['Florida Agency for Health Care Administration'],
    definition: 'Florida’s Agency for Health Care Administration, which administers Florida Medicaid and publishes the state dashboards compared with DecisionPro.',
    example: 'DPro-FL cites an AHCA dashboard as the publisher when it uses a Florida plan-performance measure.',
    reference: { label: 'Florida AHCA', href: 'https://ahca.myflorida.com/' },
  },
  {
    id: 'mcpar',
    term: 'MCPAR',
    aliases: ['Managed Care Program Annual Report', 'Managed Care Program Annual Reports'],
    definition: 'The annual Managed Care Program Annual Report that states submit to CMS for each Medicaid managed care program. It contains program- and plan-level information across oversight topics.',
    example: 'DecisionPro uses Kentucky MCPAR responses as annual public signals for overpayments and encounter-data timeliness.',
    reference: { label: 'CMS public MCPAR guidance', href: 'https://www.medicaid.gov/medicaid/managed-care/guidance/medicaid-and-chip-managed-care-reporting/public-access-state-submitted-mcpars' },
  },
  {
    id: 'puf',
    term: 'Public Use File',
    aliases: ['Public Use Files', 'PUF', 'PUFs'],
    definition: 'A publisher-prepared data file released for public analysis. The MCPAR Public Use File is an annual CSV in which each row represents a specific reported data point for a managed care program or plan.',
    example: 'The recovery opportunity begins with Kentucky rows from the 2024 MCPAR Public Use File.',
    reference: { label: 'CMS MCPAR Public Use Files', href: 'https://www.medicaid.gov/medicaid/managed-care/guidance/medicaid-and-chip-managed-care-reporting/how-to-use-mcpar-public-use-files' },
  },
  {
    id: 'mco',
    term: 'Managed Care Organization',
    aliases: ['Managed Care Organizations', 'MCO', 'MCOs', 'managed-care plan', 'managed-care plans'],
    definition: 'A health plan organization under contract with a state Medicaid agency to arrange and pay for covered services for enrolled members under managed care.',
    example: 'The recovery workpaper compares plan-reported amounts for six Kentucky MCOs.',
    reference: { label: 'Medicaid managed care', href: 'https://www.medicaid.gov/medicaid/managed-care' },
  },
  {
    id: 'mlr',
    term: 'Medical Loss Ratio',
    aliases: ['MLR'],
    definition: 'A managed-care financial ratio comparing qualifying spending on clinical services and quality improvement with premium revenue, subject to the applicable reporting rules and adjustments.',
    example: 'DecisionPro treats an MLR as a defined financial measure, not as a standalone finding of efficiency or waste.',
    reference: { label: 'CMS managed-care reporting', href: 'https://www.medicaid.gov/medicaid/managed-care/guidance/medicaid-and-chip-managed-care-reporting' },
  },
  {
    id: 'encounter-data',
    term: 'Encounter data',
    aliases: ['encounter file', 'encounter files', 'encounter-data file', 'encounter-data files'],
    definition: 'Records submitted by managed-care plans describing services delivered to members. Completeness and timeliness affect utilization, rate, quality, and program-integrity analysis.',
    example: 'A late encounter file can place downstream DecisionPro measures on a data-quality hold until a corrected file passes acceptance checks.',
  },
  {
    id: 'network-adequacy',
    term: 'Network adequacy',
    aliases: ['network sufficiency', 'access standard', 'access standards'],
    definition: 'Whether a health plan’s provider network gives covered people reasonable access to required services under the applicable time, distance, appointment, capacity, and specialty standards.',
    example: 'Facility counts alone do not establish network adequacy; DecisionPro asks for plan rosters, travel time, and appointment evidence.',
    reference: { label: 'CMS managed-care reporting', href: 'https://www.medicaid.gov/medicaid/managed-care/guidance/medicaid-and-chip-managed-care-reporting' },
  },
  {
    id: 'program-integrity',
    term: 'Program integrity',
    aliases: ['Medicaid program integrity'],
    definition: 'Controls and oversight used to prevent, detect, investigate, and correct improper payments or noncompliance while protecting due process and avoiding unsupported accusations.',
    example: 'DecisionPro routes possible exclusion matches to authorized program-integrity reviewers instead of making an adverse finding.',
  },
  {
    id: 'prior-authorization',
    term: 'Prior authorization',
    aliases: ['prior-authorization', 'prior auth'],
    definition: 'A health-plan process requiring approval before certain services, items, or prescriptions are covered, based on the applicable benefit and clinical rules.',
    example: 'DPro-FL compares prior-authorization approval, denial, appeal, extension, and timeliness measures only after populations and services are aligned.',
  },
  {
    id: 'corrective-action-plan',
    term: 'Corrective Action Plan',
    aliases: ['Corrective Action Plans', 'CAP', 'CAPs'],
    definition: 'A documented set of required corrective steps, accountable owners, milestones, and due dates used to remedy a verified performance or compliance problem.',
    example: 'DecisionPro may present a corrective action plan as one possible remedy after the evidence and authority are validated.',
  },
  {
    id: 'overpayment',
    term: 'Overpayment',
    aliases: ['overpayments', 'overpayment candidate', 'overpayment candidates'],
    definition: 'A payment amount reported or determined to exceed what was properly payable. A reported candidate is not confirmed debt or recoverable savings until status, authority, and prior recovery are reconciled.',
    example: 'The $5.09 million MCPAR amount is a reported overpayment candidate pool, not a confirmed savings total.',
  },
  {
    id: 'recovery-reconciliation',
    term: 'Recovery reconciliation',
    aliases: ['recovery-reconciliation', 'recovery status', 'recovery-status'],
    definition: 'A controlled comparison of reported overpayment candidates with authorized ledgers, payment records, contract periods, and reviewer dispositions to determine what is recovered, outstanding, duplicated, disputed, or non-actionable.',
    example: 'DecisionPro prepares a six-plan recovery reconciliation for DMS review.',
  },
  {
    id: 'candidate-pool',
    term: 'Candidate pool',
    aliases: ['candidate workload', 'candidate records'],
    definition: 'The set of records or dollars that meet initial screening criteria and require validation. Candidate status is a lead for review, not a confirmed finding.',
    example: 'A 10%–50% recovery scenario is applied to the reported candidate pool only for planning sensitivity.',
  },
  {
    id: 'deterministic-match',
    term: 'Deterministic match',
    aliases: ['deterministic matching', 'deterministic identifiers'],
    definition: 'A record match based on exact, authorized identifiers or explicit rules rather than approximate name similarity.',
    example: 'Exclusion candidates must be resolved with deterministic identifiers inside the authorized case system.',
  },
  {
    id: 'fuzzy-match',
    term: 'Fuzzy match',
    aliases: ['fuzzy matching', 'fuzzy identity match', 'similarity match'],
    definition: 'An approximate record comparison that tolerates differences in spelling or formatting. It can identify candidates for human review but must not by itself support exclusion, payment hold, or another adverse action.',
    example: 'DecisionPro labels a fuzzy match as unresolved until an authorized reviewer verifies identity and current source status.',
  },
  {
    id: 'leie',
    term: 'LEIE',
    aliases: ['List of Excluded Individuals/Entities', 'List of Excluded Individuals and Entities', 'HHS-OIG List of Excluded Individuals/Entities'],
    definition: 'The HHS Office of Inspector General’s List of Excluded Individuals/Entities. It identifies people and entities excluded from participation in federally funded health care programs and is updated by OIG.',
    example: 'DecisionPro displays an aggregate Kentucky-address LEIE workload but keeps identity verification outside the legislative dashboard.',
    reference: { label: 'HHS-OIG exclusions', href: 'https://oig.hhs.gov/exclusions/' },
  },
  {
    id: 'provider-data-catalog',
    term: 'Provider Data Catalog',
    aliases: ['CMS Provider Data Catalog', 'PDC'],
    definition: 'CMS’s public catalog of downloadable provider and facility datasets used for Care Compare and related directories, including quality, staffing, capacity, ownership, and certification context.',
    example: 'DecisionPro loads Kentucky nursing-facility counts and rating context from the CMS Provider Data Catalog.',
    reference: { label: 'CMS Provider Data Catalog', href: 'https://data.cms.gov/provider-data/about' },
  },
  {
    id: 'usaspending',
    term: 'USAspending',
    aliases: ['USAspending API', 'USAspending API v2', 'USAspending.gov'],
    definition: 'The U.S. government’s public source for federal award and spending information. In DecisionPro it provides federal context, not state contract-payment truth.',
    example: 'DecisionPro uses USAspending to contextualize federal health-program awards while keeping Kentucky payment conclusions separate.',
    reference: { label: 'USAspending', href: 'https://www.usaspending.gov/' },
  },
  {
    id: 'api',
    term: 'Application Programming Interface',
    aliases: ['API', 'open-data API', 'public API'],
    definition: 'A documented machine-to-machine access method that lets software request structured data using defined endpoints and parameters.',
    example: 'The Provider Data Catalog API lets DecisionPro retrieve current public facility datasets without manual copying.',
  },
  {
    id: 'csv',
    term: 'CSV',
    aliases: ['CSV file', 'CSV files', 'comma-separated values'],
    definition: 'A plain-text tabular file format in which records are stored as rows and fields are separated by commas or another documented delimiter.',
    example: 'CMS publishes the annual MCPAR Public Use File as a downloadable CSV.',
  },
  {
    id: 'data-adapter',
    term: 'Data adapter',
    aliases: ['document adapter', 'governed document adapter', 'governed public-file adapter'],
    definition: 'Controlled code that retrieves or extracts a publisher source, preserves provenance, validates its structure, and converts it into DecisionPro’s governed data model.',
    example: 'Kentucky budget PDFs require a governed document adapter because no supported public budget API is documented.',
  },
  {
    id: 'hydrated-data',
    term: 'Hydrated data',
    aliases: ['data hydrated', 'hydrated dataset', 'hydrated datasets', 'hydrated snapshot', 'REAL data hydrated'],
    definition: 'Publisher data that DecisionPro has actually retrieved, retained with provenance, normalized, and made available to the application—not merely a catalog link or planned connector.',
    example: 'A REAL data hydrated status means the source has passed the implemented load path and supplies current aggregate metrics.',
  },
  {
    id: 'source-manifest',
    term: 'Source manifest',
    aliases: ['source manifest verified', 'governed source manifest'],
    definition: 'A retained inventory describing the authoritative source objects found at a publisher location, including identity, access path, dates, and validation metadata.',
    example: 'A source manifest may verify that seven budget documents exist even before their tables are fully extracted.',
  },
  {
    id: 'provenance',
    term: 'Provenance',
    aliases: ['data lineage', 'lineage'],
    definition: 'The recorded chain showing where a value came from, when and how it was retrieved, what transformations were applied, and which displayed result uses it.',
    example: 'The explanation for a hospital-bed metric includes publisher, retrieval record, transformation, as-of date, and limitation provenance.',
  },
  {
    id: 'cadence',
    term: 'Cadence',
    aliases: ['refresh cadence', 'publication cadence', 'reporting cadence'],
    definition: 'How often or under what event schedule a publisher releases or updates a source, such as monthly, annual, quarterly, or contract-amendment driven.',
    example: 'LEIE has a monthly publication cadence, while MCPAR Public Use Files are annual.',
  },
  {
    id: 'denominator',
    term: 'Denominator',
    aliases: ['denominators'],
    definition: 'The population, events, dollars, or other total used as the base of a rate or percentage. Comparisons are unreliable when denominators differ materially.',
    example: 'Encounter timeliness cannot be compared across plans until the reporting period and denominator definitions are aligned.',
  },
  {
    id: 'aggregate-data',
    term: 'Aggregate data',
    aliases: ['aggregate evidence', 'aggregate metrics', 'public aggregate data'],
    definition: 'Information summarized across groups, organizations, places, or periods rather than displayed as person-level records.',
    example: 'The legislative dashboard shows aggregate exclusion-screening counts, not individual identities.',
  },
  {
    id: 'de-identified',
    term: 'De-identified',
    aliases: ['de-identified data', 'deidentified'],
    definition: 'Data processed so it does not directly identify a person under the applicable governance standard; it must still be handled according to permitted use and re-identification risk.',
    example: 'DecisionPro legislative views are designed around aggregate or de-identified evidence rather than person-level Medicaid records.',
  },
  {
    id: 'phi',
    term: 'Protected Health Information',
    aliases: ['PHI', 'person-level Medicaid data'],
    definition: 'Individually identifiable health information protected under applicable privacy rules. DecisionPro’s legislative views do not accept or display PHI.',
    example: 'The recovery workpaper instructs reviewers not to upload PHI or person-level records.',
  },
  {
    id: 'reporting-entity',
    term: 'Reporting entity',
    aliases: ['reporting entities'],
    definition: 'The organization responsible for submitting a reported value, such as a managed-care plan or program named in a public reporting file.',
    example: 'DecisionPro maps each MCPAR reporting entity to the correct plan, program, contract, and reporting period.',
  },
  {
    id: 'modeled-benefit',
    term: 'Modeled benefit',
    aliases: ['modeled absolute benefit', 'modeled improvement', 'planning target', 'planning scenario'],
    definition: 'A transparent estimate or target calculated from stated evidence and assumptions. It supports planning but is not a measured outcome, confirmed saving, or implementation decision.',
    example: 'The $0.51M–$2.54M recovery range is a modeled benefit based on a stated sensitivity range.',
  },
  {
    id: 'absolute-benefit',
    term: 'Absolute benefit',
    aliases: ['absolute improvement'],
    definition: 'The expected change expressed in its natural unit, such as dollars, counties, facilities, records, completed periods, or percentage points.',
    example: 'Twelve counties moved from signal to validated decision is the absolute benefit of the first coverage-review tranche.',
  },
  {
    id: 'relative-improvement',
    term: 'Relative improvement',
    aliases: ['relative benefit'],
    definition: 'The expected change expressed as a percentage of a stated baseline or scoped total.',
    example: 'Reviewing 12 of 79 observed counties is a 15.2% relative improvement in decision coverage.',
  },
  {
    id: 'baseline',
    term: 'Baseline',
    aliases: ['control total', 'accounting control total'],
    definition: 'The defined starting value, population, or reconciled total against which a later result or variance is measured.',
    example: 'The observed 74.0% encounter-timeliness value is the baseline for a modeled improvement scenario.',
  },
  {
    id: 'sensitivity-range',
    term: 'Sensitivity range',
    aliases: ['sensitivity case', 'sensitivity cases', 'planning sensitivity'],
    definition: 'A set of alternative assumption values used to show how a modeled result changes when the true outcome is not yet known.',
    example: 'DecisionPro applies 10%, 25%, and 50% recovery sensitivity cases because no governed Kentucky historical recovery-rate series is loaded.',
  },
  {
    id: 'evidence-confidence',
    term: 'Evidence confidence',
    aliases: ['confidence level'],
    definition: 'A qualitative assessment of how strongly the available sources, grain, freshness, and validation status support the stated interpretation.',
    example: 'Moderate evidence confidence can mean the public capacity data is real while Medicaid network sufficiency remains incomplete.',
  },
  {
    id: 'decision-guardrail',
    term: 'Decision guardrail',
    aliases: ['guardrail', 'guardrails'],
    definition: 'A rule that limits how evidence may be interpreted or acted upon so an incomplete signal is not converted into an unsupported conclusion or harmful action.',
    example: 'A decision guardrail says never to treat a fuzzy identity match as proof of exclusion.',
  },
  {
    id: 'appropriation',
    term: 'Appropriation',
    aliases: ['appropriations', 'enacted appropriation', 'enacted appropriations'],
    definition: 'Legal authority enacted for government to incur obligations and make payments for specified purposes, amounts, and periods.',
    example: 'DecisionPro reconciles enacted appropriations and revisions before comparing the budget baseline with payments.',
    reference: { label: 'USAspending glossary', href: 'https://www.usaspending.gov/search' },
  },
  {
    id: 'encumbrance',
    term: 'Encumbrance',
    aliases: ['encumbrances'],
    definition: 'A commitment of budget authority for an expected obligation or expenditure that may not yet have become an actual payment.',
    example: 'An apparent underspend may reflect an encumbrance or timing difference rather than idle money.',
  },
  {
    id: 'budget-variance',
    term: 'Budget variance',
    aliases: ['variance', 'variances', 'fiscal variance'],
    definition: 'The difference between a defined budget baseline and an observed, obligated, or paid amount for the aligned period and scope.',
    example: 'DecisionPro requires timing, enrollment, rate, and encumbrance explanations before labeling a budget variance inefficient.',
  },
  {
    id: 'arcgis-rest',
    term: 'ArcGIS REST service',
    aliases: ['ArcGIS REST services'],
    definition: 'A documented web service published through Esri ArcGIS that lets applications query geographic layers, features, fields, and metadata.',
    example: 'DecisionPro retrieves Kentucky licensed-hospital features from a public ArcGIS REST service.',
  },
  {
    id: 'ogc',
    term: 'OGC',
    aliases: ['Open Geospatial Consortium'],
    definition: 'The Open Geospatial Consortium, which develops open standards for accessing and sharing geographic information and services.',
    example: 'Kentucky’s open-geospatial catalog exposes an OGC search API used to discover authoritative public layers.',
    reference: { label: 'Open Geospatial Consortium', href: 'https://www.ogc.org/' },
  },
  {
    id: 'data-grain',
    term: 'Data grain',
    aliases: ['grain', 'reporting grain', 'transaction grain', 'plan-level grain'],
    definition: 'The level represented by one record or observation, such as one transaction, plan, county, facility, reporting entity, or annual program response.',
    example: 'MCPAR is public at annual program- and plan-level grain and cannot establish transaction-level recovery status.',
  },
  {
    id: 'reporting-period',
    term: 'Reporting period',
    aliases: ['performance year', 'contract year'],
    definition: 'The defined dates to which a reported value applies. It is distinct from the date DecisionPro retrieved the source.',
    example: 'The reconciliation aligns every amount to its MCPAR reporting period and effective contract period.',
  },
  {
    id: 'contract-crosswalk',
    term: 'Contract crosswalk',
    aliases: ['entity/contract crosswalk', 'plan-to-contract crosswalk'],
    definition: 'A reviewed mapping that connects each reporting entity and period to the correct contract and amendment record.',
    example: 'The recovery review needs a contract crosswalk before a plan-reported amount can be tested against a specific obligation or remedy.',
  },
  {
    id: 'reviewer-disposition',
    term: 'Reviewer disposition',
    aliases: ['disposition', 'review disposition'],
    definition: 'The human reviewer’s evidence-backed classification of a candidate record, such as recovered, outstanding, duplicate, disputed, non-actionable, or awaiting evidence.',
    example: 'A plan row does not become confirmed recovered until the reviewer disposition and authorized evidence reference support it.',
  },
  {
    id: 'premium-revenue',
    term: 'Premium revenue',
    aliases: ['annual premium revenue'],
    definition: 'The managed-care premium amount reported for the aligned period and population. DecisionPro uses it as scale context, not as proof of profit or loss.',
    example: 'The recovery table shows each candidate amount as a share of corresponding annual premium revenue.',
  },
  {
    id: 'kentucky-recovery-reports',
    term: 'Kentucky recovery-monitoring reports',
    aliases: ['PI-06', 'PI-02', 'CP-06', 'recovery ledger', 'recovery-ledger'],
    definition: 'Authorized Kentucky operational records used to monitor identified overpayments and collection status. The loaded contract evidence describes PI-06 as a monthly case-status report, PI-02 as quarterly collection monitoring, and CP-06 as monitoring accounts reaching 180 days; reviewers must verify the current controlling instructions.',
    example: 'DecisionPro asks the authorized owner to use PI-06, PI-02, CP-06, a recovery ledger, or a payment record to support each reviewer disposition.',
  },
  {
    id: 'pace',
    term: 'PACE',
    aliases: ['Program of All-Inclusive Care for the Elderly', 'PACE program'],
    definition: 'A Medicare and Medicaid program that coordinates medical and long-term services and supports for eligible older adults who generally meet a nursing-facility level of care while living in the community.',
    example: 'The Florida Facilities & Access Evidence Room uses AHCA’s public PACE report as program and geography context, not as proof of individual eligibility or service availability.',
    reference: { label: 'CMS PACE', href: 'https://www.cms.gov/medicare/medicaid-coordination/about/pace' },
  },
  {
    id: 'licensed-beds',
    term: 'Licensed beds',
    aliases: ['licensed-bed capacity', 'licensed bed data'],
    definition: 'The number and type of facility beds authorized under the applicable state licensure record. Licensed capacity does not by itself establish staffing, occupancy, Medicaid participation, appointment availability, or actual service access.',
    example: 'DecisionPro combines Florida licensed-bed counts with provider, PACE, quality, and geographic evidence before treating capacity as a possible access signal.',
    reference: { label: 'Florida AHCA Agency Dashboards', href: 'https://ahca.myflorida.com/medicaid/agency-dashboards.html' },
  },
  {
    id: 'smmc',
    term: 'Statewide Medicaid Managed Care',
    aliases: ['SMMC'],
    definition: 'Florida’s Medicaid managed-care program framework, including managed medical assistance and long-term-care plan arrangements and their applicable contract periods.',
    example: 'A Florida plan signal must be aligned to the correct SMMC plan class and contract period before cross-dashboard comparison.',
    reference: { label: 'Florida Medicaid SMMC', href: 'https://ahca.myflorida.com/medicaid/statewide-medicaid-managed-care.html' },
  },
  {
    id: 'liquidated-damages',
    term: 'Liquidated damages',
    aliases: ['liquidated damage'],
    definition: 'A contractually specified monetary remedy associated with a defined failure or nonperformance. An assessed amount is not automatically a collected amount, a recoverable overpayment, waste, or realized savings.',
    example: 'DPro-FL keeps assessed liquidated damages separate from collections until an authorized financial record establishes realization status.',
  },
  {
    id: 'source-of-record',
    term: 'Source of record',
    aliases: ['system of record'],
    definition: 'The authoritative publisher or operational system responsible for the official fact. DecisionPro preserves, cites, and analyzes that fact but does not replace its source of record.',
    example: 'Florida AHCA remains the source of record for its dashboard figures even when DecisionPro retains a governed reference copy and calculated aggregate.',
  },
  {
    id: 'content-signal',
    term: 'Content-Signal',
    aliases: ['content signal', 'ai-train=no', 'use=reference'],
    definition: 'Publisher-supplied machine-readable usage preferences. At the recorded Florida refresh, AHCA indicated reference use was allowed and model training was not allowed; DecisionPro hashes and rechecks this policy on every load.',
    example: 'The Florida source catalogue displays the recorded Content-Signal and stops the loader for policy review if its required contract changes.',
  },
  {
    id: 'export-permission-gate',
    term: 'Export permission gate',
    aliases: ['allow_export_data', 'Tableau export permission'],
    definition: 'A hard ingestion control derived from the publisher workbook configuration. When allow_export_data is false, DecisionPro may cite the rendered public dashboard but must not ingest its data export.',
    example: 'Florida Quality Initiatives and Malpractice Claims remain explicit gaps because their current workbook configurations disable data export.',
  },
  {
    id: 'realized-value',
    term: 'Realized value',
    aliases: ['realized savings', 'realization status'],
    definition: 'A benefit that has been verified in the authoritative operational or financial record, rather than merely assessed, modeled, forecast, avoided in a scenario, or reported as a candidate.',
    example: 'DPro-FL does not call an assessed compliance amount realized savings until collection and contract records support that classification.',
  },
  {
    id: 'rendered-export-reconciliation',
    term: 'Rendered-to-export reconciliation',
    aliases: ['rendered reconciliation'],
    definition: 'A validation that confirms an exported dataset or filtered result matches the figures, filters, definitions, and period displayed in the publisher’s rendered dashboard.',
    example: 'The Florida plan-quarter series remains a gap until selected exported plan metrics agree with the rendered AHCA view.',
  },
  {
    id: 'source-native-dashboard',
    term: 'Source-native dashboard',
    aliases: ['source-native view', 'source-native'],
    definition:
      'The interactive dashboard served and controlled by the government publisher. DecisionPro opens or embeds it so reviewers can use publisher interactions that cannot legally or technically be copied into the warehouse.',
    example:
      'The Florida Facilities Evidence Room pairs normalized DecisionPro county comparisons with the AHCA source-native dashboard for reconciliation.',
  },
  {
    id: 'full-spectrum-reporting',
    term: 'Full-spectrum reporting',
    aliases: ['integrated report'],
    definition:
      'A governed decision packet that brings the evidence, active filters, provenance, known gaps, analytical boundary, recommendation, accountable owner and benefit measure together.',
    example:
      'A Florida Evidence Room integrated report can be downloaded as a governed JSON packet for review or legislative briefing.',
  },
  {
    id: 'decision-weighted-ranking',
    term: 'Decision-weighted ranking',
    aliases: ['decision weights', 'weighted ranking'],
    definition:
      'A transparent way to reorder review priorities by changing the relative importance of impact, evidence strength, feasibility and urgency; it does not alter source evidence or promise an outcome.',
    example:
      'The Florida Consideration Blender uses four decision weights to reorder six goal portfolios for discussion.',
  },
  {
    id: 'reporting-cell',
    term: 'Reporting cell',
    aliases: ['reporting cells'],
    definition:
      'One published combination of organization, measure and reporting period in a normalized aggregate dataset.',
    example:
      'Hospital reporting coverage counts reporting cells by county without exposing patient-level records.',
  },
];

const byId = new Map(GLOSSARY_TERMS.map((t) => [t.id, t]));

export function getGlossaryTerm(id) {
  return byId.get(id) || null;
}

export function listGlossaryTerms() {
  return GLOSSARY_TERMS.slice().sort((a, b) => a.term.localeCompare(b.term));
}

/** Short / ambiguous labels stay searchable but are not auto-hyperlinked in prose. */
const NO_AUTO_LINK = new Set([
  'gate',
  'bw',
  'real',
  'test',
  'gap',
  'gaps',
  'dso',
  'reconciliation',
  'landing',
  'business warehouse',
]);

/** Match patterns longest-first for safe inline linking. */
export function glossaryMatchPatterns() {
  const items = [];
  const seen = new Set();
  for (const entry of GLOSSARY_TERMS) {
    for (const label of [entry.term, ...(entry.aliases || [])]) {
      if (!label) continue;
      if (NO_AUTO_LINK.has(label.toLowerCase())) continue;
      if (seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      items.push({ label, id: entry.id });
    }
  }
  items.sort((a, b) => b.label.length - a.label.length);
  return items;
}
