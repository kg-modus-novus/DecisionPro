# Data Spectrum (latest gate export)

Generated: 2026-08-02T16:47:41.162Z

## Summary

- Sources loaded: 11
- Sources catalogued: 1
- Sources blocked: 1
- Explicit gaps: 7
- REAL as-of window: 2013-09-30 → 2026-08-01
- Landing cube rows: 229

## Inventory

### CMS_DATA_MEDICAID_ENR — LOADED

- **Available:** Modern PI monthly series from ~October 2018 forward (all states × periods in the CSV; DecisionPro extracts Kentucky rows).
- **Source scale:** 1 CSV · 107 periods · 10,812 rows (Publisher PI Performance Indicator CSV — one file covering all states and reporting periods in the current release.)
- **Loaded (PSA):** 10812 (2013-09-30 → 2026-03-31)
- **Resultant (cubes):** 1 cubes · 1 rows (command-center: 1); landing binds: 201
- **Next:** KY operational enrollment warehouse under DMS authority

### CMS_DATA_MEDICAID — LOADED

- **Available:** Medicaid Financial Management Data open table on data.medicaid.gov (state × program × service category expenditures).
- **Source scale:** 1 Financial Management open-data table · 1 year · 15,511 rows (Publisher inventory via data.medicaid.gov datastore API: 15,511 rows; sampled offsets show year=2016 only in the current published table. DecisionPro binds a curated KY expenditure aggregate into PSA/cubes.)
- **Loaded (PSA):** 1 (2023-09-30 → 2023-09-30)
- **Resultant (cubes):** 3 cubes · 3 rows (command-center: 1; cost-drivers: 1; measure-definitions: 1); landing binds: 1
- **Next:** KY claim-grain spend warehouse under DMS DUA

### CMS_MEDICAID_SCORECARD — LOADED

- **Available:** Public Child/Adult Core Set quality CSVs (verified vintages include 2020–2023; 2024 CSV URI not published at last scan).
- **Source scale:** 4 CSVs · 4 vintages · 17,148 rows (Sum of public Child/Adult Core Set CSV data rows across published vintages 2020–2023 (state × measure grain).)
- **Loaded (PSA):** 11 (2020-12-31 → 2023-12-31)
- **Resultant (cubes):** 3 cubes · 25 rows (benchmarks: 11; measure-definitions: 3; outcomes: 11); landing binds: 11
- **Inconsistencies:** WCV-CH absent from 2020 Child/Adult CSV (measure abbreviation not present that vintage).; 2024 Core Set CSV download URI returned HTTP 404 at last gate research.; Core Set 2024 public CSV URI not available at last research scan (HTTP 404).; WCV-CH definition/vintage gap: abbreviation absent from 2020 Core Set CSV.
- **Next:** Live Scorecard API bind for all Core Set picks

### CMS_MEDICAID_PHARMACY — LOADED

- **Available:** Medicaid Spending by Drug publishes national brand/generic spending with multi-year columns; state-attributed KY program totals require a separate curated slice (not invented from national drug rows).
- **Source scale:** 1 CSV · 5 years · 18,511 rows (Publisher inventory from CMS Medicaid Spending by Drug CSV (DSD_MCD RY26): counted data rows at export; header exposes Tot_Spndng_2020…2024 year columns. KY program total in DecisionPro is a curated aggregate bind, not a rollup of national drug rows.)
- **Loaded (PSA):** 1 (2024-12-31 → 2024-12-31)
- **Resultant (cubes):** 2 cubes · 2 rows (cost-drivers: 1; measure-definitions: 1); landing binds: 1
- **Inconsistencies:** CMS Spending by Drug publishes ~5 national year columns; KY curated pack currently binds one annual aggregate — not a synthetic multi-year KY stretch.
- **Next:** KY MCO pharmacy PMPM under DUA

### KY_DMS_MCO_CONTRACTS — LOADED

- **Available:** Active MCO contract roster on DMS contracts page — snapshot / event, not a continuous numerical series.
- **Source scale:** 1 page · 6 plans (Publisher unit is contracted MCO plans on the DMS managed-care contracts page (5 active + Anthem exit documented in curated roster).)
- **Loaded (PSA):** 6 (2025-01-01 → 2025-01-01)
- **Resultant (cubes):** 1 cubes · 1 rows (mco: 1); landing binds: 1
- **Next:** Authorized member-level MCO assignment

### KY_DMS_MCO_EVAL — LOADED

- **Available:** DMS Quality Branch publishes EQRO/quality PDFs; DMS MCO Reports hosts the FY Comprehensive Evaluation Summary PDF. Withholding dollars are not structured open data.
- **Source scale:** 1 page · 14 quality/eval PDFs (13 on page + FY2025 summary) (Publisher inventory: 13 PDFs linked from the DMS Quality Branch page plus the FY2025 Comprehensive Evaluation Summary PDF (HTTP 200 on www.chfs.ky.gov/agencies/dms/DMSMCOReports/) = 14 quality/eval PDFs. DecisionPro binds evaluation meta from the summary PDF.)
- **Loaded (PSA):** 1 (2025-06-30 → 2025-06-30)
- **Resultant (cubes):** 2 cubes · 2 rows (mco: 1; measure-definitions: 1); landing binds: 1
- **Next:** Structured EQRO/HEDIS warehouse under DMS agreement

### KY_DMS_COUNTY_COUNTS — LOADED

- **Available:** Monthly Medicaid membership counts by county PDF archive on DMS statistics page (filename pattern KYDWMMCCYYYYMMDD.pdf).
- **Source scale:** 2 monthly county PDFs (HTTP 200) (~120 counties each) (Publisher unit is monthly county PDF documents. Inventory probe confirmed 2 recent PDFs HTTP 200 (2024-01 and 2025-01). Fuller DMS archive depth beyond this probe set is not yet listed; each PDF typically lists ~120 counties.)
- **Loaded (PSA):** 2 (2024-01-01 → 2025-01-01)
- **Resultant (cubes):** 3 cubes · 15 rows (county: 12; measure-definitions: 1; utilization: 2); landing binds: 2
- **Inconsistencies:** Archive PDF ky202412 HTTP 404 — not loaded (https://www.chfs.ky.gov/agencies/dms/stats/KYDWMMCC20241201.pdf); Archive PDF ky202411 HTTP 404 — not loaded (https://www.chfs.ky.gov/agencies/dms/stats/KYDWMMCC20241101.pdf); Archive PDF ky202410 HTTP 404 — not loaded (https://www.chfs.ky.gov/agencies/dms/stats/KYDWMMCC20241001.pdf); Archive PDF ky202301 HTTP 404 — not loaded (https://www.chfs.ky.gov/agencies/dms/stats/KYDWMMCC20230101.pdf)
- **Next:** Machine-readable county feed from DMS

### KY_DMS_FEE_SCHEDULE — LOADED

- **Available:** DMS Fee Schedules page publishes downloadable rate/fee PDFs by service type.
- **Source scale:** 1 page · 41 fee/rate PDFs linked on page (Publisher inventory: 41 PDF fee/rate schedule documents linked from the live DMS Fee Schedules page (counted from page HTML). DecisionPro binds one physician-schedule revision event into PSA/cubes, not every rate line.)
- **Loaded (PSA):** 1 (2025-11-03 → 2025-11-03)
- **Resultant (cubes):** 2 cubes · 2 rows (measure-definitions: 1; provider: 1); landing binds: 1
- **Next:** Encounter paid amounts under DUA

### KY_DMS_PROVIDER_DIR — LOADED

- **Available:** DMS Provider Directory portal page links state Waiver/Medicaid directories and five MCO find-a-provider directories. Provider row population lives inside those search tools, not as a single downloadable table.
- **Source scale:** 1 page · 2 state directories (Waiver + Medicaid) · 5 MCO find-a-provider directories (Publisher inventory from the live DMS Provider Directory page: 2 Commonwealth directory tools + 5 MCO network directories (Aetna, Humana, Molina/Passport, United, Wellcare) = 7 searchable directories. Full provider-row cardinality is inside those tools and is not a single public CSV.)
- **Loaded (PSA):** 1 (2026-08-01 → 2026-08-01)
- **Resultant (cubes):** 2 cubes · 2 rows (measure-definitions: 1; provider: 1); landing binds: 1
- **Next:** Full provider enrollment extract

### KY_LRC_RECORD — LOADED

- **Available:** Legislative Record bill and subject-index pages for Medicaid/maternal policy context.
- **Source scale:** 1 page · 3 Medicaid/maternal bill touchpoints (HTTP 200) (Publisher inventory of the DecisionPro LRC touchpoint set: HB 487 (26RS subject index), postpartum sponsor page, and HB 2 (26RS) bill page — all HTTP 200 at inventory time. The full Legislative Record corpus is far larger; this scale is the verified maternal/Medicaid bill set used for context measures.)
- **Loaded (PSA):** 1 (2026-04-27 → 2026-04-27)
- **Resultant (cubes):** 1 cubes · 1 rows (measure-definitions: 1); landing binds: 1
- **Next:** Bill↔measure impact modeling

### CENSUS_ACS — LOADED

- **Available:** KFF Health Insurance Coverage of the Total Population (ACS-based) publishes Uninsured and other coverage shares by state and year.
- **Source scale:** 1 page · 16 years · 51 states + DC · 816 rows (Publisher inventory from KFF State Health Facts total-population indicator: 16 timeframe years observed in the published tool (2008–2019, 2021–2024; 2020 absent) × 51 geographies (50 states + DC) = 816 state×year cells for the Uninsured share series. DecisionPro binds 8 KY annual points into PSA/cubes.)
- **Loaded (PSA):** 8 (2016-12-31 → 2024-12-31)
- **Resultant (cubes):** 1 cubes · 1 rows (measure-definitions: 1); landing binds: 8
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

