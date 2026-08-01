# Provisional Measure Starter Catalog (20–30)

**Status:** provisional — client selects final set later  
**App ID:** `decisionpro`  
**Audience:** legislators, LRC analysts, Medicaid leadership, budget/oversight  
**Rule:** every measure maps to a catalogue source; accurate path uses real loads after post-build gate

Columns: MeasureID, Name, Question answered, Grain, Source catalogue ID(s), FromSysID, Freshness expectation, Suppression notes, POC path.

| MeasureID | Name | Legislative question | Grain | Source IDs | FromSysID | Freshness | Suppression | POC |
|-----------|------|----------------------|-------|------------|-----------|-----------|-------------|-----|
| M-001 | Total Medicaid & CHIP enrollment (KY) | Where is the program scale? | State × month | SOT-ENR-01 | `CMS_DATA_MEDICAID_ENR` | Source publish lag | N/A aggregate | Accurate |
| M-002 | YoY enrollment change % | What is driving change? | State × year | SOT-ENR-01 | `CMS_DATA_MEDICAID_ENR` | Annual/monthly per source | N/A | Accurate |
| M-003 | County Medicaid enrollment count | Where geographically? | County × month | SOT-ENR-02 | `KY_DMS_COUNTY_COUNTS` | Monthly if published | Small-cell if ever sub-aggregate | Accurate |
| M-004 | Federal reported Medicaid expenditure (KY) | Where is money going? | State × period | SOT-ENR-01 / SOT-COST-01 | `CMS_DATA_MEDICAID` | Source lag | N/A | Accurate |
| M-005 | YoY expenditure change % | What is driving increase? | State × year | SOT-ENR-01 | `CMS_DATA_MEDICAID` | Source lag | N/A | Accurate |
| M-006 | Expenditure per enrollee (derived) | Cost intensity? | State × period | SOT-ENR-01 | derived from above | Same as parents | Document derivation | Accurate |
| M-007 | Active MCO roster count | Who is accountable? | State × as-of | SOT-MCO-01 | `KY_DMS_MCO_CONTRACTS` | As-of page date | N/A | Accurate |
| M-008 | MCO contract effective events | What changed in contracting? | MCO × effective date | SOT-MCO-01 | `KY_DMS_MCO_CONTRACTS` | Event-dated | N/A | Accurate |
| M-009 | Scorecard / Core Set reporting completeness (KY) | Can we trust quality transparency? | State × Core Set year | SOT-OUT-CMS | `CMS_MEDICAID_SCORECARD` | Annual | N/A | Accurate |
| M-010 | Selected Child Core Set rate (KY) | Child outcomes vs peers? | State × measure × year | SOT-OUT-CMS | `CMS_MEDICAID_SCORECARD` | Annual lag | Follow CMS suppression | Accurate |
| M-011 | Selected Adult Core Set rate (KY) | Adult outcomes vs peers? | State × measure × year | SOT-OUT-CMS | `CMS_MEDICAID_SCORECARD` | Annual lag | Follow CMS suppression | Accurate |
| M-012 | Maternal / infant quality indicator (published) | Maternal performance? | State × year | SOT-OUT-CMS | `CMS_MEDICAID_SCORECARD` | Annual | Follow CMS | Accurate |
| M-013 | Preventive care Core Set proxy | Prevention performance? | State × year | SOT-OUT-CMS | `CMS_MEDICAID_SCORECARD` | Annual | Follow CMS | Accurate |
| M-014 | MCO evaluation — quality domain summary flag | MCO accountability? | MCO × FY | SOT-MCO-02 / SOT-OUT-MCOQ | `KY_DMS_MCO_EVAL` | Annual PDF | As published | Accurate (extract) |
| M-015 | MCO evaluation — access/timeliness theme | Access concerns? | MCO × FY | SOT-MCO-02 | `KY_DMS_MCO_EVAL` | Annual PDF | As published | Accurate (extract) |
| M-016 | EQRO technical report availability | Oversight evidence present? | State × year | SOT-MCO-03 | `KY_DMS_QUALITY_BRANCH` | Annual | N/A | Accurate (meta) |
| M-017 | Pharmacy program spend (published federal) | Drug cost pressure? | State × period | SOT-COST-01 | `CMS_MEDICAID_PHARMACY` | Source lag | N/A | Accurate |
| M-018 | Avoidable ED proxy (AHRQ QI / HCUP where KY available) | Low-value acute use? | State/geo × year | SOT-UTIL-PUB | `AHRQ_QI` | Annual | Label proxy | Accurate (proxy) |
| M-019 | Inpatient utilization proxy (AHRQ/HCUP) | Hospital intensity? | State × year | SOT-UTIL-PUB | `AHRQ_HCUP` | Annual | Label proxy | Accurate (proxy) |
| M-020 | Rural / HPSA coverage context | Access geography? | County | SOT-GEO-01 | `HRSA_AHRF` / KY HPSA | Vintage-dated | N/A | Accurate (context) |
| M-021 | ACS poverty / uninsured context | Population pressure? | County | SOT-GEO-01 | `CENSUS_ACS` | ACS vintage | N/A | Accurate (context) |
| M-022 | Provider directory freshness meta | Data quality of network info? | State × as-of | SOT-PROV-01 | `KY_DMS_PROVIDER_DIR` | Page as-of | N/A | Accurate (meta) |
| M-023 | Fee schedule update event | Rate policy change? | Schedule × effective date | SOT-FEE | `KY_DMS_FEE_SCHEDULE` | Effective dating | N/A | Accurate (context) |
| M-024 | Cross-state enrollment rank (Scorecard/open data) | KY vs peers scale? | State × period | SOT-OUT-CMS | `CMS_MEDICAID_SCORECARD` | Source lag | N/A | Accurate |
| M-025 | Cross-state selected quality rank | KY vs peers quality? | State × measure × year | SOT-OUT-CMS | `CMS_MEDICAID_SCORECARD` | Annual | Follow CMS | Accurate |
| M-026 | Behavioral health Core Set / Scorecard proxy | BH performance? | State × year | SOT-OUT-CMS | `CMS_MEDICAID_SCORECARD` | Annual | Follow CMS | Accurate |
| M-027 | Readmission / follow-up proxy (Core Set if published) | Continuity of care? | State × year | SOT-OUT-CMS | `CMS_MEDICAID_SCORECARD` | Annual | Follow CMS | Accurate |
| M-028 | Pending legislation touchpoint count (session) | Policy pipeline? | Bill × session | SOT-LEG-01 | `KY_LRC_RECORD` | Session | N/A | Context |
| M-029 | PMPM (derived from published spend÷enrollment) | Unit cost? | State × period | SOT-ENR-01 | derived | Same as parents | Document formula | Accurate (derived) |
| M-030 | Claim-grain cost driver share by service | What drove the increase? | Service × period | SOT-OUT-UTIL | — | N/A | PHI risk | **Gap / OUT_OF_POC** — sell DMS DUA |

## Client selection note

This set is a **starter**. Director/client may drop proxies, elevate EQRO extracts, or replace Core Set picks. M-030 remains the primary paid-data sell for true cost-driver analysis.

## Accuracy-check binding

For each Accurate-path measure after real ETL: displayed value must match published source extract within documented rounding; provenance must show definition, `FromSysID`, `AsOfDate`, LoadHistory id, and source URI.
