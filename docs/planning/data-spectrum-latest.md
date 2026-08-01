# Data Spectrum (latest gate export)

Generated: 2026-08-01T19:35:55.185Z

## Summary

- Sources loaded: 11
- Sources catalogued: 1
- Sources blocked: 1
- Explicit gaps: 7
- REAL as-of window: 2013-09-30 → 2026-08-01
- Landing cube rows: 237

## Inventory

### CMS_DATA_MEDICAID_ENR — LOADED

- **Available:** Modern PI monthly series from ~October 2018 forward (KY rows with totals).
- **Loaded:** 201 rows (2013-09-30 → 2026-03-31)
- **Next:** KY operational enrollment warehouse under DMS authority

### CMS_DATA_MEDICAID — LOADED

- **Available:** Financial management expenditure aggregates; multi-year open data vintages.
- **Loaded:** 1 rows (2023-09-30 → 2023-09-30)
- **Next:** KY claim-grain spend warehouse under DMS DUA

### CMS_MEDICAID_SCORECARD — LOADED

- **Available:** Public Child/Adult Core Set quality CSVs (verified vintages include 2020–2023; 2024 CSV URI not published at last scan).
- **Loaded:** 11 rows (2020-12-31 → 2023-12-31)
- **Inconsistencies:** WCV-CH absent from 2020 Child/Adult CSV (measure abbreviation not present that vintage).; 2024 Core Set CSV download URI returned HTTP 404 at last gate research.; Core Set 2024 public CSV URI not available at last research scan (HTTP 404).; WCV-CH definition/vintage gap: abbreviation absent from 2020 Core Set CSV.
- **Next:** Live Scorecard API bind for all Core Set picks

### CMS_MEDICAID_PHARMACY — LOADED

- **Available:** Medicaid Spending by Drug publishes ~5 years of national brand/generic spending columns; state-attributed KY program totals require a separate curated slice (not invented from national drug rows).
- **Loaded:** 1 rows (2024-12-31 → 2024-12-31)
- **Inconsistencies:** CMS Spending by Drug publishes ~5 national year columns; KY curated pack currently binds one annual aggregate — not a synthetic multi-year KY stretch.
- **Next:** KY MCO pharmacy PMPM under DUA

### KY_DMS_MCO_CONTRACTS — LOADED

- **Available:** Active MCO contract roster on DMS contracts page — snapshot / event, not a continuous numerical series.
- **Loaded:** 9 rows (2025-01-01 → 2025-01-01)
- **Next:** Authorized member-level MCO assignment

### KY_DMS_MCO_EVAL — LOADED

- **Available:** EQRO / comprehensive evaluation PDFs — theme meta; withholding dollars not structured open data.
- **Loaded:** 1 rows (2025-06-30 → 2025-06-30)
- **Next:** Structured EQRO/HEDIS warehouse under DMS agreement

### KY_DMS_COUNTY_COUNTS — LOADED

- **Available:** Monthly Medicaid membership counts by county PDF archive on DMS statistics page (filename pattern KYDWMMCCYYYYMMDD.pdf).
- **Loaded:** 2 rows (2024-01-01 → 2025-01-01)
- **Inconsistencies:** Archive PDF ky202412 HTTP 404 — not loaded (https://www.chfs.ky.gov/agencies/dms/stats/KYDWMMCC20241201.pdf); Archive PDF ky202411 HTTP 404 — not loaded (https://www.chfs.ky.gov/agencies/dms/stats/KYDWMMCC20241101.pdf); Archive PDF ky202410 HTTP 404 — not loaded (https://www.chfs.ky.gov/agencies/dms/stats/KYDWMMCC20241001.pdf); Archive PDF ky202301 HTTP 404 — not loaded (https://www.chfs.ky.gov/agencies/dms/stats/KYDWMMCC20230101.pdf)
- **Next:** Machine-readable county feed from DMS

### KY_DMS_FEE_SCHEDULE — LOADED

- **Available:** Published fee schedule revision events — snapshot / event, not continuous series.
- **Loaded:** 1 rows (2025-11-03 → 2025-11-03)
- **Next:** Encounter paid amounts under DUA

### KY_DMS_PROVIDER_DIR — LOADED

- **Available:** Provider directory freshness meta only — snapshot / event, not continuous series.
- **Loaded:** 1 rows (2026-08-01 → 2026-08-01)
- **Next:** Full provider enrollment extract

### KY_LRC_RECORD — LOADED

- **Available:** Legislative Record bill pages — policy context counts, not a continuous quantitative series.
- **Loaded:** 1 rows (2026-04-27 → 2026-04-27)
- **Next:** Bill↔measure impact modeling

### CENSUS_ACS — LOADED

- **Available:** ACS 1-year estimates roughly 2005–2024 (API requires key); KFF Health Insurance Coverage of the Total Population publishes ACS-based KY shares including Medicaid and Uninsured.
- **Loaded:** 8 rows (2016-12-31 → 2024-12-31)
- **Next:** Direct Census ACS API bind with CENSUS_API_KEY for county grain

### HRSA_AHRF — CATALOGUED

- **Available:** Area Health Resources Files / shortage context — catalogued; not auto-loaded on public POC path for miles-to-care substitutes.
- **Loaded:** 0 rows
- **Next:** Director-authorize curated extract or Data Request bind

### AHRQ_HCUP — BLOCKED

- **Available:** KY SID/SEDD microdata typically licensed — blocked on public POC path.
- **Loaded:** 0 rows
- **Next:** Obtain an approved AHRQ HCUP data use agreement (or use free published KY aggregate tables if available), then Director-authorize a LoadClass=REAL retrieve/load — not web scrape of microdata.

### GAP-AVOIDABLE-ED — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Loaded:** 0 rows
- **Inconsistencies:** Gap remains unlabeled as history: Potentially avoidable ED visits (KY Medicaid)
- **Next:** KY avoidable ED from encounters; HCUP microdata is RESTRICTED

### GAP-CLAIMS-COST-DRIVERS — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Loaded:** 0 rows
- **Inconsistencies:** Gap remains unlabeled as history: Claim-grain cost drivers by service × population
- **Next:** Near-real-time KY cost-driver warehouse

### GAP-HD-EXPENDITURE — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Loaded:** 0 rows
- **Inconsistencies:** Gap remains unlabeled as history: House district expenditure rollups
- **Next:** District spend SoT — county enrollment is the public substitute

### GAP-HEDIS-SPEC — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Loaded:** 0 rows
- **Inconsistencies:** Gap remains unlabeled as history: NCQA HEDIS specification republication
- **Next:** Licensed measure library if required

### GAP-MCO-WITHHOLDING-DOLLARS — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Loaded:** 0 rows
- **Inconsistencies:** Gap remains unlabeled as history: MCO quality withholding dollars not earned back
- **Next:** Structured withholding outcomes warehouse

### GAP-PROVIDER-RISK-ADJ — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Loaded:** 0 rows
- **Inconsistencies:** Gap remains unlabeled as history: Risk-adjusted provider performance
- **Next:** Provider performance under DUA

### GAP-RURAL-DISTANCE — GAP

- **Available:** No continuous public series — requires authorized feed / DUA / license.
- **Loaded:** 0 rows
- **Inconsistencies:** Gap remains unlabeled as history: Average distance to care (rural)
- **Next:** Miles-to-care from authorized utilization

