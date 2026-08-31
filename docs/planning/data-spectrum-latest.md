# Data Spectrum (latest gate export)

Generated: 2026-08-31T20:29:24.484Z

## Summary

- Sources loaded: 12
- Sources catalogued: 12
- Sources blocked: 1
- Explicit gaps: 7
- REAL as-of window: 2013-09-30 → 2026-08-01
- Landing cube rows: 252

## Inventory

### CMS_DATA_MEDICAID_ENR — LOADED

- **Available:** Modern PI monthly series from ~October 2018 forward (all states × periods in the CSV; DecisionPro extracts Kentucky rows).
- **Source scale:** 1 CSV · 107 periods · 10,812 rows (Publisher PI Performance Indicator CSV — one file covering all states and reporting periods in the current release.)
- **Loaded (PSA):** 10812 (2013-09-30 → 2026-03-31)
- **Resultant (cubes):** 1 cubes · 1 rows (command-center: 1 src / 2 fact); landing binds: 201
- **Next:** KY operational enrollment warehouse under DMS authority

### CMS_DATA_MEDICAID — LOADED

- **Available:** Medicaid Financial Management Data open table on data.medicaid.gov (state × program × service category expenditures). Publisher inventory samples show year=2016 only in the current open table; DecisionPro binds a curated KY expenditure aggregate (as-of 2023-09-30) separately and does not invent CY2017–2022 from missing table years.
- **Source scale:** 1 Financial Management open-data table · 1 year · 15,511 rows (Publisher inventory via data.medicaid.gov datastore API: 15,511 rows; sampled offsets show year=2016 only in the current published table. DecisionPro binds a curated KY expenditure aggregate into PSA/cubes.)
- **Loaded (PSA):** 1 (2023-09-30 → 2023-09-30)
- **Resultant (cubes):** 3 cubes · 3 rows (command-center: 1 src / 2 fact; cost-drivers: 1 src / 2 fact; measure-definitions: 1 src / 12 fact); landing binds: 1
- **Next:** KY claim-grain spend warehouse under DMS DUA

### CMS_MEDICAID_SCORECARD — LOADED

- **Available:** Public Child/Adult Core Set quality CSVs for FFY 2020–2024. Legacy host data.medicaid.gov/sites/default/files/uploaded_resources/; FFY 2020 and FFY 2024 also on download.medicaid.gov. Resolve via scripts/resolve-core-set-csv.mjs (404 on one host is not unpublished). FFY 2017–2019 combined Child/Adult CSVs were probed on the same hosts and returned 404 — treated as not published on the public path used by DecisionPro.
- **Source scale:** 5 CSVs · 5 vintages · 28,263 rows (Sum of public Child/Adult Core Set CSV data rows across published vintages FFY 2020–2024 (state × measure grain). DecisionPro binds Kentucky WCV-CH (Ages 3–21), BCS-AD, and postpartum PPC-AD / PPC2-AD only.)
- **Loaded (PSA):** 14 (2019-12-31 → 2023-12-31)
- **Resultant (cubes):** 3 cubes · 31 rows (benchmarks: 14 src / 14 fact; measure-definitions: 3 src / 12 fact; outcomes: 14 src / 14 fact); landing binds: 14
- **Inconsistencies:** WCV-CH absent from 2020 Child/Adult CSV (measure abbreviation not present that vintage).; WCV-CH bind uses Ages 3–21 rate definition (not Ages 3–11).; Legacy guessed path …/uploaded_resources/2024-child-and-adult-health-care-quality-measures.csv returned HTTP 404; resolved authoritative URI https://download.medicaid.gov/data/2024-child-and-adult-health-care-quality-measures.csv (dataset a5023394-ab10-465b-bb4a-7de5ac98d90c).; PPC-AD renamed to PPC2-AD in FFY 2024; M-012 continues on the postpartum visit (7–84 days) rate.; BCS-AD FFY 2024 publisher row is Ages 50–64 (prior vintages Ages 50–74).; Period labels are FFY reporting · MY care window (asOfDate = MY-12-31), not bare Core Set Year as calendar performance.; Cross-source: KY DMS FY2025 Comprehensive Evaluation HEDIS PPC Postpartum Care MY 2023 = 82.21% / MY 2022 = 78.16% is not substituted into this CMS bind.; WCV-CH definition/vintage gap: abbreviation absent from 2020 Core Set CSV.
- **Next:** Live Scorecard API bind for all Core Set picks

### CMS_MEDICAID_PHARMACY — LOADED

- **Available:** Medicaid Spending by Drug publishes national brand/generic Tot_Spndng_2020…2024 columns; state-attributed KY program totals require a separate curated slice (not invented from national drug rows). CY2017–2019 have no publisher year columns on that CSV; CY2020–2023 national columns exist but are not KY-attributable.
- **Source scale:** 1 CSV · 5 years · 18,511 rows (Publisher inventory from CMS Medicaid Spending by Drug CSV (DSD_MCD RY26): counted data rows at export; header exposes Tot_Spndng_2020…2024 year columns. KY program total in DecisionPro is a curated aggregate bind, not a rollup of national drug rows.)
- **Loaded (PSA):** 1 (2024-12-31 → 2024-12-31)
- **Resultant (cubes):** 2 cubes · 2 rows (cost-drivers: 1 src / 2 fact; measure-definitions: 1 src / 12 fact); landing binds: 1
- **Inconsistencies:** CMS Spending by Drug publishes ~5 national year columns; KY curated pack currently binds one annual aggregate — not a synthetic multi-year KY stretch.
- **Next:** KY MCO pharmacy PMPM under DUA

### KY_DMS_MCO_CONTRACTS — LOADED

- **Available:** Active MCO contract roster on DMS contracts page — snapshot / event, not a continuous numerical series.
- **Source scale:** 1 page · 6 plans (Publisher unit is contracted MCO plans on the DMS managed-care contracts page (5 active + Anthem exit documented in curated roster).)
- **Loaded (PSA):** 0 (2025-01-01 → 2025-01-01)
- **Resultant (cubes):** 1 cubes · 1 rows (mco: 1 src / 2 fact); landing binds: 1
- **Next:** Authorized member-level MCO assignment

### CMS_MCPAR — CATALOGUED

- **Available:** MCPAR PUF 2024; annual state-reported managed-care accountability responses
- **Source scale:** — (Publisher-side scale not yet observed for this SoT.)
- **Loaded (PSA):** 177973
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** Reconcile reporting entities to effective Kentucky MCO contracts and operational case systems

### CMS_PROVIDER_DATA — CATALOGUED

- **Available:** Kentucky Medicare/Medicaid-certified nursing-facility capacity, ratings, staffing and penalties
- **Source scale:** — (Publisher-side scale not yet observed for this SoT.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** Join to Kentucky Medicaid provider enrollment and claims only under authority

### SAM_ENTITY — CATALOGUED

- **Available:** Entity Management API v3; primary UEI-registrant-name authority in the OFR-02 hybrid seed order. Director-provisioned key, loaded from local env at runtime only. Verified live (2026-08-31): this API tier does not expose EIN/TIN — UEI-EIN links in the crosswalk are therefore computed name/address matches, not same-record facts from this source.
- **Source scale:** — (Publisher-side scale not yet observed for this SoT.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** FOUO-tier SAM access (if authorized) would add EIN directly; not pursued in OFR-02

### IRS_EO_BMF — CATALOGUED

- **Available:** State CSV extracts (EIN, name, address, NTEE code, ruling date, foundation code); organization-level only, no officer/compensation detail
- **Source scale:** — (Publisher-side scale not yet observed for this SoT.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** Pair with annual Form 990 extract (OFR-03) for financial resilience ratios

### NPPES — CATALOGUED

- **Available:** Organizational NPI records only (enumeration_type=NPI-2); the only source in this spine that publishes a cross-identifier pair (NPI + embedded state Medicaid provider ID) within the same record. Individual-provider NPI records are never queried or promoted.
- **Source scale:** — (Publisher-side scale not yet observed for this SoT.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** Bulk NPPES file ingestion for full-coverage NPI matching beyond the bounded per-run candidate set

### IRS_990_EXTRACT — CATALOGUED

- **Available:** Annual Form 990 org-level financial extract (2 posting-year vintages), filtered to the OFR-02 KY+FL EO BMF EIN universe. No government-specific grant-revenue field or Part IX program/management/fundraising column split exists in this extract (see grounding correction). Form 990 only in this package, not 990-EZ/990-PF. Organization-level only — officer/compensation XML e-file detail is out of OFR scope entirely.
- **Source scale:** — (Publisher-side scale not yet observed for this SoT.)
- **Loaded (PSA):** 338048
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** Add 990-EZ/990-PF vintages and a longer multi-year trend series if warranted

### CMS_HCRIS — CATALOGUED

- **Available:** Hospital + SNF annual cost-report facility financials (most recent FY2023 for both). Medicare cost-report basis — not Medicaid payment truth, not a full-payer financial statement. Florida hospital-financial signal is an explicit fallback alongside the still-blocked FL_AHCA_HOSPITAL_FINANCIAL gap (GAP-FL-F-14-PARAMETERS), not a replacement for it.
- **Source scale:** — (Publisher-side scale not yet observed for this SoT.)
- **Loaded (PSA):** 769
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** Join county rollups to Census/HRSA eligible-population ratios for a true access-continuity watchlist

### HHS_OIG_LEIE — CATALOGUED

- **Available:** Current full LEIE CSV; aggregate legislative display only; identity candidates require verification
- **Source scale:** — (Publisher-side scale not yet observed for this SoT.)
- **Loaded (PSA):** 45
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** Controlled identity-resolution workflow against authorized provider enrollment

### USA_SPENDING — CATALOGUED

- **Available:** OFR-01: fiscal-year 93.778 obligation aggregates (Kentucky) plus award/recipient-grain rows for Assistance Listings 93.775/93.777/93.778/93.791/93.224/93.958/93.959 across Kentucky and Florida via place-of-performance and recipient-location queries; federal award context, not state payment truth
- **Source scale:** — (Publisher-side scale not yet observed for this SoT.)
- **Loaded (PSA):** 11
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** Reconcile recipient UEIs/EINs to state agencies, contracted providers, and state accounting records under the OFR-02 identity crosswalk

### KY_OPEN_GIS — CATALOGUED

- **Available:** Official ArcGIS licensed-hospital facility and capacity attributes; institutional context only
- **Source scale:** — (Publisher-side scale not yet observed for this SoT.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** Crosswalk provider/service areas to authoritative program geographies

### KY_OSBD_BUDGET — CATALOGUED

- **Available:** Revision-aware current biennial budget document manifest and retained files
- **Source scale:** — (Publisher-side scale not yet observed for this SoT.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** Governed table/page extraction and appropriation-line reconciliation

### KY_TRANSPARENCY_SPEND — CATALOGUED

- **Available:** Official nightly contract-search page; no supported public analytical API/export discovered
- **Source scale:** — (Publisher-side scale not yet observed for this SoT.)
- **Loaded (PSA):** 483
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** Obtain supported export/accounting feed or operator-supplied governed extract

### KY_DMS_MCO_EVAL — LOADED

- **Available:** DMS Quality Branch publishes EQRO/quality PDFs; DMS MCO Reports hosts the FY Comprehensive Evaluation Summary PDF. Table 2 includes HEDIS PPC Postpartum Care MY 2022 = 78.16% and MY 2023 = 82.21% (statewide MCO path). Withholding dollars are not structured open data.
- **Source scale:** 1 page · 14 quality/eval PDFs (13 on page + FY2025 summary) (Publisher inventory: 13 PDFs linked from the DMS Quality Branch page plus the FY2025 Comprehensive Evaluation Summary PDF (HTTP 200 on www.chfs.ky.gov/agencies/dms/DMSMCOReports/) = 14 quality/eval PDFs. DecisionPro binds evaluation meta from the summary PDF. PPC HEDIS rates in Table 2 are cross-source context for CMS M-012 — not substituted into CMS_MEDICAID_SCORECARD.)
- **Loaded (PSA):** 1 (2025-06-30 → 2025-06-30)
- **Resultant (cubes):** 2 cubes · 2 rows (mco: 1 src / 2 fact; measure-definitions: 1 src / 12 fact); landing binds: 1
- **Inconsistencies:** CMS Core Set FFY 2024 PPC2-AD postpartum (KY) = 70.2% is a different SoT/method than DMS FY2025 HEDIS PPC Postpartum Care MY 2023 = 82.21%; do not overwrite M-012 with the DMS figure.
- **Next:** Structured EQRO/HEDIS warehouse under DMS agreement

### KY_DMS_COUNTY_COUNTS — LOADED

- **Available:** Monthly Medicaid membership counts by county PDF archive on DMS statistics page (filename pattern KYDWMMCCYYYYMMDD.pdf; DD is publisher run day, often mid-month). Public path retains a sparse archive — DecisionPro inventory shows files only for selected 2024–2026 months; earlier timeline months are not online at the guessed stats URLs.
- **Source scale:** 13 monthly county PDFs (~120 counties each) (Publisher unit is monthly county PDF documents. Filename day is the DMS run date (not always 01). Full day-sweep inventory for the Source Timeline window (2016-09…2026-08) found 13 HTTP 200 files (2024-01, 2024-02, 2024-10, 2025-01, 2025-02, 2025-10, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07); 107 months returned 404 for all day suffixes on the public stats path.)
- **Loaded (PSA):** 13 (2024-01-01 → 2026-07-01)
- **Resultant (cubes):** 3 cubes · 92 rows (county: 78 src / 78 fact; measure-definitions: 1 src / 12 fact; utilization: 13 src / 22 fact); landing binds: 13
- **Inconsistencies:** Archive day-sweep: 107 months HTTP 404 / not on public path (e.g. ky201609, ky201610, ky201611, …). See Source Timeline probes.
- **Next:** Machine-readable county feed from DMS

### KY_DMS_FEE_SCHEDULE — LOADED

- **Available:** DMS Fee Schedules page publishes downloadable rate/fee PDFs by service type.
- **Source scale:** 1 page · 41 fee/rate PDFs linked on page (Publisher inventory: 41 PDF fee/rate schedule documents linked from the live DMS Fee Schedules page (counted from page HTML). DecisionPro binds one physician-schedule revision event into PSA/cubes, not every rate line.)
- **Loaded (PSA):** 1 (2025-11-03 → 2025-11-03)
- **Resultant (cubes):** 2 cubes · 2 rows (measure-definitions: 1 src / 12 fact; provider: 1 src / 2 fact); landing binds: 1
- **Next:** Encounter paid amounts under DUA

### KY_DMS_PROVIDER_DIR — LOADED

- **Available:** DMS Provider Directory portal page links state Waiver/Medicaid directories and five MCO find-a-provider directories. Provider row population lives inside those search tools, not as a single downloadable table.
- **Source scale:** 1 page · 2 state directories (Waiver + Medicaid) · 5 MCO find-a-provider directories (Publisher inventory from the live DMS Provider Directory page: 2 Commonwealth directory tools + 5 MCO network directories (Aetna, Humana, Molina/Passport, United, Wellcare) = 7 searchable directories. Full provider-row cardinality is inside those tools and is not a single public CSV.)
- **Loaded (PSA):** 1 (2026-08-01 → 2026-08-01)
- **Resultant (cubes):** 2 cubes · 2 rows (measure-definitions: 1 src / 12 fact; provider: 1 src / 2 fact); landing binds: 1
- **Next:** Full provider enrollment extract

### KY_LRC_RECORD — LOADED

- **Available:** Legislative Record bill and subject-index pages for Medicaid/maternal policy context.
- **Source scale:** 1 page · 3 Medicaid/maternal bill touchpoints (Publisher inventory of the DecisionPro LRC touchpoint set: HB 487 (26RS subject index), postpartum sponsor page, and HB 2 (26RS) bill page — all HTTP 200 at inventory time. The full Legislative Record corpus is far larger; this scale is the verified maternal/Medicaid bill set used for context measures.)
- **Loaded (PSA):** 1 (2026-04-27 → 2026-04-27)
- **Resultant (cubes):** 1 cubes · 1 rows (measure-definitions: 1 src / 12 fact); landing binds: 1
- **Next:** Bill↔measure impact modeling

### CENSUS_ACS — LOADED

- **Available:** KFF Health Insurance Coverage of the Total Population (ACS-based) publishes Uninsured and other coverage shares by state and year.
- **Source scale:** 1 page · 16 years · 51 states + DC · 816 rows (Publisher inventory from KFF State Health Facts total-population indicator: 16 timeframe years observed in the published tool (2008–2019, 2021–2024; 2020 absent) × 51 geographies (50 states + DC) = 816 state×year cells for the Uninsured share series. DecisionPro binds 8 KY annual points into PSA/cubes.)
- **Loaded (PSA):** 8 (2016-12-31 → 2024-12-31)
- **Resultant (cubes):** 1 cubes · 1 rows (measure-definitions: 1 src / 12 fact); landing binds: 8
- **Next:** Direct Census ACS API bind with CENSUS_API_KEY for county grain

### HRSA_AHRF — LOADED

- **Available:** Public HRSA AHRF county files on data.hrsa.gov (usage limitations: None). DecisionPro binds Kentucky Primary Care HPSA designation counts for CY2017–CY2025 from attributable vintages: 2021-2022 ASCII historical fields (2017–2021), 2022-2023 county CSV (2022–2023), 2024-2025 county CSV (2024–2025). CY2026 not yet a complete annual HPSA vintage in this inventory. Miles-to-care remains Gap (needs claims geo).
- **Source scale:** 1 AHRF 2024-2025 county geo CSV (national counties) · 9 years · 120 Kentucky counties in AHRF county file · 3,235 rows (Publisher AHRF 2024-2025 county geo CSV has 3,235 national county/entity rows; DecisionPro extracts 120 Kentucky counties and aggregates Primary Care HPSA codes (1=Whole, 2=Part, 0=none) into statewide designated-county counts for M-020. Earlier years use the same KY FIPS filter on prior public AHRF county releases.)
- **Loaded (PSA):** 9 (2017-12-31 → 2025-12-31)
- **Resultant (cubes):** 2 cubes · 10 rows (measure-definitions: 1 src / 12 fact; utilization: 9 src / 22 fact); landing binds: 9
- **Next:** Optional: county-grain HPSA map tiles; still no miles-to-care without claims geo

### AHRQ_HCUP — BLOCKED

- **Available:** KY SID/SEDD microdata typically licensed — blocked on public POC path.
- **Source scale:** — (HCUP SID/SEDD encounter microdata is licensed; publisher encounter volume is not counted on the public POC path.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** Obtain an approved AHRQ HCUP data use agreement (or use free published KY aggregate tables if available), then Director-authorize a LoadClass=REAL retrieve/load — not web scrape of microdata.

### GAP-AVOIDABLE-ED — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Source scale:** — (Explicit Gap — no publisher SoT to count.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Inconsistencies:** Gap remains unlabeled as history: Potentially avoidable ED visits (KY Medicaid)
- **Next:** KY avoidable ED from encounters; HCUP microdata is RESTRICTED

### GAP-CLAIMS-COST-DRIVERS — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Source scale:** — (Explicit Gap — no publisher SoT to count.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Inconsistencies:** Gap remains unlabeled as history: Claim-grain cost drivers by service × population
- **Next:** Near-real-time KY cost-driver warehouse

### GAP-HD-EXPENDITURE — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Source scale:** — (Explicit Gap — no publisher SoT to count.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Inconsistencies:** Gap remains unlabeled as history: House district expenditure rollups
- **Next:** District spend SoT — county enrollment is the public substitute

### GAP-HEDIS-SPEC — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Source scale:** — (Explicit Gap — no publisher SoT to count.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Inconsistencies:** Gap remains unlabeled as history: NCQA HEDIS specification republication
- **Next:** Licensed measure library if required

### GAP-MCO-WITHHOLDING-DOLLARS — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Source scale:** — (Explicit Gap — no publisher SoT to count.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Inconsistencies:** Gap remains unlabeled as history: MCO quality withholding dollars not earned back
- **Next:** Structured withholding outcomes warehouse

### GAP-PROVIDER-RISK-ADJ — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Source scale:** — (Explicit Gap — no publisher SoT to count.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Inconsistencies:** Gap remains unlabeled as history: Risk-adjusted provider performance
- **Next:** Provider performance under DUA

### GAP-RURAL-DISTANCE — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Source scale:** — (Explicit Gap — no publisher SoT to count.)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Inconsistencies:** Gap remains unlabeled as history: Average distance to care (rural)
- **Next:** Miles-to-care from authorized utilization

