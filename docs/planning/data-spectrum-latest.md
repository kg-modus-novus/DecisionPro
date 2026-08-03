# Data Spectrum (latest gate export)

Generated: 2026-08-03T14:51:55.325Z

## Summary

- Sources loaded: 11
- Sources catalogued: 1
- Sources blocked: 1
- Explicit gaps: 7
- REAL as-of window: 2013-09-30 → 2026-08-01
- Landing cube rows: 243

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
- **Resultant (cubes):** 3 cubes · 3 rows (command-center: 1 src / 2 fact; cost-drivers: 1 src / 2 fact; measure-definitions: 1 src / 11 fact); landing binds: 1
- **Next:** KY claim-grain spend warehouse under DMS DUA

### CMS_MEDICAID_SCORECARD — LOADED

- **Available:** Public Child/Adult Core Set quality CSVs for FFY 2020–2024. Legacy host data.medicaid.gov/sites/default/files/uploaded_resources/; FFY 2020 and FFY 2024 also on download.medicaid.gov. Resolve via scripts/resolve-core-set-csv.mjs (404 on one host is not unpublished). FFY 2017–2019 combined Child/Adult CSVs were probed on the same hosts and returned 404 — treated as not published on the public path used by DecisionPro.
- **Source scale:** 5 CSVs · 5 vintages · 28,263 rows (Sum of public Child/Adult Core Set CSV data rows across published vintages FFY 2020–2024 (state × measure grain). DecisionPro binds Kentucky WCV-CH (Ages 3–21), BCS-AD, and postpartum PPC-AD / PPC2-AD only.)
- **Loaded (PSA):** 14 (2019-12-31 → 2023-12-31)
- **Resultant (cubes):** 3 cubes · 31 rows (benchmarks: 14 src / 14 fact; measure-definitions: 3 src / 11 fact; outcomes: 14 src / 14 fact); landing binds: 14
- **Inconsistencies:** WCV-CH absent from 2020 Child/Adult CSV (measure abbreviation not present that vintage).; WCV-CH bind uses Ages 3–21 rate definition (not Ages 3–11).; Legacy guessed path …/uploaded_resources/2024-child-and-adult-health-care-quality-measures.csv returned HTTP 404; resolved authoritative URI https://download.medicaid.gov/data/2024-child-and-adult-health-care-quality-measures.csv (dataset a5023394-ab10-465b-bb4a-7de5ac98d90c).; PPC-AD renamed to PPC2-AD in FFY 2024; M-012 continues on the postpartum visit (7–84 days) rate.; BCS-AD FFY 2024 publisher row is Ages 50–64 (prior vintages Ages 50–74).; Period labels are FFY reporting · MY care window (asOfDate = MY-12-31), not bare Core Set Year as calendar performance.; Cross-source: KY DMS FY2025 Comprehensive Evaluation HEDIS PPC Postpartum Care MY 2023 = 82.21% / MY 2022 = 78.16% is not substituted into this CMS bind.; WCV-CH definition/vintage gap: abbreviation absent from 2020 Core Set CSV.
- **Next:** Live Scorecard API bind for all Core Set picks

### CMS_MEDICAID_PHARMACY — LOADED

- **Available:** Medicaid Spending by Drug publishes national brand/generic Tot_Spndng_2020…2024 columns; state-attributed KY program totals require a separate curated slice (not invented from national drug rows). CY2017–2019 have no publisher year columns on that CSV; CY2020–2023 national columns exist but are not KY-attributable.
- **Source scale:** 1 CSV · 5 years · 18,511 rows (Publisher inventory from CMS Medicaid Spending by Drug CSV (DSD_MCD RY26): counted data rows at export; header exposes Tot_Spndng_2020…2024 year columns. KY program total in DecisionPro is a curated aggregate bind, not a rollup of national drug rows.)
- **Loaded (PSA):** 1 (2024-12-31 → 2024-12-31)
- **Resultant (cubes):** 2 cubes · 2 rows (cost-drivers: 1 src / 2 fact; measure-definitions: 1 src / 11 fact); landing binds: 1
- **Inconsistencies:** CMS Spending by Drug publishes ~5 national year columns; KY curated pack currently binds one annual aggregate — not a synthetic multi-year KY stretch.
- **Next:** KY MCO pharmacy PMPM under DUA

### KY_DMS_MCO_CONTRACTS — LOADED

- **Available:** Active MCO contract roster on DMS contracts page — snapshot / event, not a continuous numerical series.
- **Source scale:** 1 page · 6 plans (Publisher unit is contracted MCO plans on the DMS managed-care contracts page (5 active + Anthem exit documented in curated roster).)
- **Loaded (PSA):** 6 (2025-01-01 → 2025-01-01)
- **Resultant (cubes):** 1 cubes · 1 rows (mco: 1 src / 2 fact); landing binds: 1
- **Next:** Authorized member-level MCO assignment

### KY_DMS_MCO_EVAL — LOADED

- **Available:** DMS Quality Branch publishes EQRO/quality PDFs; DMS MCO Reports hosts the FY Comprehensive Evaluation Summary PDF. Table 2 includes HEDIS PPC Postpartum Care MY 2022 = 78.16% and MY 2023 = 82.21% (statewide MCO path). Withholding dollars are not structured open data.
- **Source scale:** 1 page · 14 quality/eval PDFs (13 on page + FY2025 summary) (Publisher inventory: 13 PDFs linked from the DMS Quality Branch page plus the FY2025 Comprehensive Evaluation Summary PDF (HTTP 200 on www.chfs.ky.gov/agencies/dms/DMSMCOReports/) = 14 quality/eval PDFs. DecisionPro binds evaluation meta from the summary PDF. PPC HEDIS rates in Table 2 are cross-source context for CMS M-012 — not substituted into CMS_MEDICAID_SCORECARD.)
- **Loaded (PSA):** 1 (2025-06-30 → 2025-06-30)
- **Resultant (cubes):** 2 cubes · 2 rows (mco: 1 src / 2 fact; measure-definitions: 1 src / 11 fact); landing binds: 1
- **Inconsistencies:** CMS Core Set FFY 2024 PPC2-AD postpartum (KY) = 70.2% is a different SoT/method than DMS FY2025 HEDIS PPC Postpartum Care MY 2023 = 82.21%; do not overwrite M-012 with the DMS figure.
- **Next:** Structured EQRO/HEDIS warehouse under DMS agreement

### KY_DMS_COUNTY_COUNTS — LOADED

- **Available:** Monthly Medicaid membership counts by county PDF archive on DMS statistics page (filename pattern KYDWMMCCYYYYMMDD.pdf; DD is publisher run day, often mid-month). Public path retains a sparse archive — DecisionPro inventory shows files only for selected 2024–2026 months; earlier timeline months are not online at the guessed stats URLs.
- **Source scale:** 13 monthly county PDFs (~120 counties each) (Publisher unit is monthly county PDF documents. Filename day is the DMS run date (not always 01). Full day-sweep inventory for the Source Timeline window (2016-09…2026-08) found 13 HTTP 200 files (2024-01, 2024-02, 2024-10, 2025-01, 2025-02, 2025-10, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07); 107 months returned 404 for all day suffixes on the public stats path.)
- **Loaded (PSA):** 13 (2024-01-01 → 2026-07-01)
- **Resultant (cubes):** 3 cubes · 92 rows (county: 78 src / 78 fact; measure-definitions: 1 src / 11 fact; utilization: 13 src / 13 fact); landing binds: 13
- **Inconsistencies:** Archive day-sweep: 107 months HTTP 404 / not on public path (e.g. ky201609, ky201610, ky201611, …). See Source Timeline probes.
- **Next:** Machine-readable county feed from DMS

### KY_DMS_FEE_SCHEDULE — LOADED

- **Available:** DMS Fee Schedules page publishes downloadable rate/fee PDFs by service type.
- **Source scale:** 1 page · 41 fee/rate PDFs linked on page (Publisher inventory: 41 PDF fee/rate schedule documents linked from the live DMS Fee Schedules page (counted from page HTML). DecisionPro binds one physician-schedule revision event into PSA/cubes, not every rate line.)
- **Loaded (PSA):** 1 (2025-11-03 → 2025-11-03)
- **Resultant (cubes):** 2 cubes · 2 rows (measure-definitions: 1 src / 11 fact; provider: 1 src / 2 fact); landing binds: 1
- **Next:** Encounter paid amounts under DUA

### KY_DMS_PROVIDER_DIR — LOADED

- **Available:** DMS Provider Directory portal page links state Waiver/Medicaid directories and five MCO find-a-provider directories. Provider row population lives inside those search tools, not as a single downloadable table.
- **Source scale:** 1 page · 2 state directories (Waiver + Medicaid) · 5 MCO find-a-provider directories (Publisher inventory from the live DMS Provider Directory page: 2 Commonwealth directory tools + 5 MCO network directories (Aetna, Humana, Molina/Passport, United, Wellcare) = 7 searchable directories. Full provider-row cardinality is inside those tools and is not a single public CSV.)
- **Loaded (PSA):** 1 (2026-08-01 → 2026-08-01)
- **Resultant (cubes):** 2 cubes · 2 rows (measure-definitions: 1 src / 11 fact; provider: 1 src / 2 fact); landing binds: 1
- **Next:** Full provider enrollment extract

### KY_LRC_RECORD — LOADED

- **Available:** Legislative Record bill and subject-index pages for Medicaid/maternal policy context.
- **Source scale:** 1 page · 3 Medicaid/maternal bill touchpoints (Publisher inventory of the DecisionPro LRC touchpoint set: HB 487 (26RS subject index), postpartum sponsor page, and HB 2 (26RS) bill page — all HTTP 200 at inventory time. The full Legislative Record corpus is far larger; this scale is the verified maternal/Medicaid bill set used for context measures.)
- **Loaded (PSA):** 1 (2026-04-27 → 2026-04-27)
- **Resultant (cubes):** 1 cubes · 1 rows (measure-definitions: 1 src / 11 fact); landing binds: 1
- **Next:** Bill↔measure impact modeling

### CENSUS_ACS — LOADED

- **Available:** KFF Health Insurance Coverage of the Total Population (ACS-based) publishes Uninsured and other coverage shares by state and year.
- **Source scale:** 1 page · 16 years · 51 states + DC · 816 rows (Publisher inventory from KFF State Health Facts total-population indicator: 16 timeframe years observed in the published tool (2008–2019, 2021–2024; 2020 absent) × 51 geographies (50 states + DC) = 816 state×year cells for the Uninsured share series. DecisionPro binds 8 KY annual points into PSA/cubes.)
- **Loaded (PSA):** 8 (2016-12-31 → 2024-12-31)
- **Resultant (cubes):** 1 cubes · 1 rows (measure-definitions: 1 src / 11 fact); landing binds: 8
- **Next:** Direct Census ACS API bind with CENSUS_API_KEY for county grain

### HRSA_AHRF — CATALOGUED

- **Available:** Area Health Resources Files / shortage context — catalogued; not auto-loaded on public POC path for miles-to-care substitutes.
- **Source scale:** — (AHRF county/shortage files are large periodic releases. Full publisher row count not inventoried on the public POC path (catalogued only).)
- **Loaded (PSA):** 0
- **Resultant (cubes):** 0 cubes · 0 rows; landing binds: 0
- **Next:** Director-authorize curated extract or Data Request bind

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

