# Kentucky Medicaid Source-of-Truth Catalogue (POC)

**Status:** implemented public-source baseline — refreshed 2026-08-27
**App ID:** `decisionpro`  
**Rule:** public/published analytical sources only on the accurate POC path  
**TOS grades:** `SAFE` | `ATTRIBUTABLE` | `RESTRICTED` | `OUT_OF_POC` | `UNKNOWN`  
**Not authoritative:** any ChatGPT “EndPend” framing from prior misrouted work

Grades are working judgments for POC ingest. Revisit attribution/TOS language before paid production use. Authority depends on the question asked — one feed is never SoT for all domains.

## Grade definitions

| Grade | Meaning for DecisionPro POC |
|-------|-----------------------------|
| `SAFE` | Public government open data / published report suitable for PSA land + demo attribution with standard citation |
| `ATTRIBUTABLE` | Public but requires clear publisher citation, lag/caveat, and possibly PDF/manual extract; OK for POC with provenance UI |
| `RESTRICTED` | License, research DUA, or redistribution limits — do not auto-ingest on POC demo path without Director exception |
| `OUT_OF_POC` | Needs authorized DMS/MCO/eligibility/claims access or contains person-level risk — paid follow-on only |
| `UNKNOWN` | URL known but terms/extractability not yet verified — research before Data Request |

## Catalogue

| ID | Domain | Best public SoT | Access | Limitation | POC | TOS | Attribution notes | Paid follow-on TODO | Proposed FromSysID / PSA |
|----|--------|-----------------|--------|------------|-----|-----|-------------------|---------------------|--------------------------|
| SOT-MCO-01 | Active contracted MCOs | KY CHFS/DMS managed care contracts & member MCO pages | Public web | Plan roster changes (e.g. Anthem no longer MCO effective 2025-01-01); not member assignment | In | `ATTRIBUTABLE` | Cite CHFS/DMS page + effective date; do not treat insurer marketing as SoT | Authorized enrollment/eligibility for member-level assignment | `KY_DMS_MCO_CONTRACTS` → `psa/ky_dms/mco_contracts/` |
| SOT-MCO-02 | MCO program accountability / quality monitoring | DMS MCO Reports — Comprehensive Evaluation summaries/reports (EQRO-assisted; IPRO referenced in reports) | Public PDF under DMS MCO Reports / Quality Branch | PDF extract; annual lag; summary vs full technical report | In | `ATTRIBUTABLE` | Cite report title, FY, URL, retrieval date | Structured EQRO feeds / HEDIS submission files under DMS agreement | `KY_DMS_MCO_EVAL` → `psa/ky_dms/mco_eval/` |
| SOT-MCO-03 | Quality strategy & EQRO contract context | DMS Quality Branch pages + Quality Strategy / EQRO contract PDFs | Public PDF/web | Contract text ≠ measure results; context only | In (context) | `ATTRIBUTABLE` | Cite document + date range | Live quality dashboards if DMS publishes machine-readable | `KY_DMS_QUALITY_BRANCH` → `psa/ky_dms/quality_docs/` |
| SOT-MCO-04 | Managed-care accountability: finance, MLR, encounter data, appeals/grievances, access, quality, sanctions/CAP, overpayments, integrity | CMS Managed Care Program Annual Report PUF 2024 | Official public API/CSV | Annual, state-reported, mixed response types; plan/program/period alignment required | **Loaded — 1,018 KY rows / 27 aggregate operational metrics across all implemented sources** | `SAFE` | Retain Question_ID, raw response, period, program, plan/BSS, and dataset version; do not count every BSS as an active MCO | State operational detail / more current reporting under authority | `CMS_MCPAR` → `psa/CMS_MCPAR/REAL/` |
| SOT-OUT-ELIG | Application / eligibility outcomes | MWMA / DCBS case systems | Authorized only | Person-level; not public | Out | `OUT_OF_POC` | N/A on POC path | DUA + privacy design for eligibility outcomes | — |
| SOT-OUT-UTIL | Service utilization (claim/encounter grain) | MMIS FFS claims + MCO encounters to DMS; KHIE clinical | Authorized | Not public at claim grain | Out | `OUT_OF_POC` | POC may only show published aggregates from other rows | Near-real-time claims drivers via DMS DUA | — |
| SOT-OUT-MCOQ | MCO comparative quality / outcomes (published) | DMS Quality Branch + EQRO / comprehensive evaluation PDFs | Public PDF | Measure specs may reference HEDIS; values lagged | In | `ATTRIBUTABLE` | Show measure year + MCO labels as published | Electronic quality measure warehouse | `KY_DMS_MCO_QUALITY` → `psa/ky_dms/mco_quality/` |
| SOT-OUT-CMS | Longitudinal / cross-state benchmarks | Medicaid & CHIP Scorecard; Adult/Child Core Set reporting; data.medicaid.gov | Public web/open data | State lag; CMS calculation methods; not KY operational SoT for today’s claims | In | `SAFE` | Cite Medicaid.gov / data.medicaid.gov dataset + period | Optional TAF research files if DUA needed for deeper grain | `CMS_MEDICAID_SCORECARD` / `CMS_DATA_MEDICAID` → `psa/cms/scorecard/` / `psa/cms/data_medicaid/` |
| SOT-TMSIS | T-MSIS / TAF analytic | CMS T-MSIS public releases + research TAF | Mixed public / research | Completeness lag; research files may be `RESTRICTED` | Partial | `UNKNOWN` → treat research extracts as `RESTRICTED` until cleared | Prefer Scorecard/open data for POC; escalate TAF | TAF DUA + research environment | `CMS_TMSIS_PUBLIC` → `psa/cms/tmsis/` |
| SOT-ENR-01 | Enrollment / expenditure aggregates (federal) | data.medicaid.gov enrollment & spending datasets; Medicaid.gov state profile KY | Open data | Not claim drivers; refresh cadence varies | In | `SAFE` | Dataset name, period, download hash if available | KY operational enrollment warehouse | `CMS_DATA_MEDICAID_ENR` → `psa/cms/enrollment/` |
| SOT-ENR-02 | KY county Medicaid counts | CHFS/DMS monthly Medicaid counts by county (statistics pages) | Public web | Reference/archive caveats on page; format may be HTML/PDF | In | `ATTRIBUTABLE` | Cite DMS statistics page + month | Machine-readable county feed from DMS | `KY_DMS_COUNTY_COUNTS` → `psa/ky_dms/county_counts/` |
| SOT-COST-01 | Pharmacy / program spend (published) | Medicaid.gov pharmacy pages; data.medicaid.gov drug pricing/payment where applicable | Public | Not KY MCO PMPM drivers at claim grain | In | `SAFE` / `ATTRIBUTABLE` | Prefer dataset over narrative page | KY pharmacy claims aggregates under DUA | `CMS_MEDICAID_PHARMACY` → `psa/cms/pharmacy/` |
| SOT-PROV-01 | Provider directory (public lookup) | KY DMS searchable provider / MCO provider directory initiatives | Public lookup | Not full MMIS enrollment extract; directory accuracy is a known quality topic | In (directory meta) | `ATTRIBUTABLE` | Cite DMS directory; note not payment SoT | Full provider enrollment extract | `KY_DMS_PROVIDER_DIR` → `psa/ky_dms/provider_dir/` |
| SOT-PROV-02 | Facility licensure / inspection | KY OIG / CMS Care Compare | Public | Not Medicaid payment SoT | Context only | `ATTRIBUTABLE` | Separate from claims SoT in UI | Link facility quality to utilization under DUA | `CMS_CARE_COMPARE` / `KY_OIG_FACILITY` |
| SOT-UTIL-PUB | Utilization proxies (public) | AHRQ HCUP / Quality Indicators (national/state where published) | Public | Often not KY Medicaid-specific; methodology differs from MCO encounters | In (benchmark) | `ATTRIBUTABLE` | Label as AHRQ proxy, not KY MMIS | KY avoidable ED/IP from encounters | `AHRQ_HCUP` / `AHRQ_QI` → `psa/ahrq/` |
| SOT-GEO-01 | County / rural context | KyGovMaps Open Data; Census ACS; HRSA shortage/AHRF | Open data | Denominator context, not Medicaid payment | In | `SAFE` | Cite dataset + vintage | Align geographies to DMS regions | `KY_OPEN_GIS` / `CENSUS_ACS` / `HRSA_AHRF` |
| SOT-LEG-01 | Legislative record / bills | Kentucky LRC / Legislative Record | Public | Policy context, not measures | In (context) | `SAFE` | Cite bill/session URL | Bill↔measure impact modeling | `KY_LRC_RECORD` → `psa/ky_lrc/` |
| SOT-MACPAC | National Medicaid analysis | MACPAC publications | Public | Secondary analysis | In (context) | `ATTRIBUTABLE` | Cite report | — | `MACPAC_PUBS` → `psa/macpac/` |
| SOT-HEDIS-SPEC | HEDIS measure specifications | NCQA HEDIS | Spec reference; licensed content risk | Spec text may be `RESTRICTED`; use only for definition pointers, not wholesale republish | Spec pointer only | `RESTRICTED` | Point to NCQA; do not mirror proprietary specs | Licensed measure library if required | — (catalog URI only) |
| SOT-FEE | Fee schedules | KY DMS fee schedules pages | Public | Rates ≠ paid amounts or MCO negotiated | In (context) | `ATTRIBUTABLE` | Cite schedule effective date | Encounter paid amounts | `KY_DMS_FEE_SCHEDULE` → `psa/ky_dms/fees/` |
| SOT-BUDGET-01 | Enacted appropriations, revenue estimates, and fiscal baselines | Kentucky Office of State Budget Director publications | Public documents | No documented supported public budget API found; revision-aware extraction required | **Loaded — 7 current documents indexed, downloaded, hashed** | `ATTRIBUTABLE` | Retain document/version/page/table lineage | State budget system feed | `KY_OSBD_BUDGET` → `psa/KY_OSBD_BUDGET/REAL/` |
| SOT-SPEND-01 | State contract and non-contract payments | Kentucky Transparency spending/contract search | Public search | No documented supported public API found; transaction facts are not represented as hydrated | **Source manifest verified; analytical feed gap remains** | `ATTRIBUTABLE` | Do not invent an API contract from internal network calls; cite search and retrieval query | Supported export or eMARS/accounting feed under authority | `KY_TRANSPARENCY_SPEND` → `psa/KY_TRANSPARENCY_SPEND/REAL/` |
| SOT-PROV-03 | Facility capacity, staffing, quality, ownership, deficiencies and penalties | CMS Provider Data Catalog | Official open-data API/CSV | Medicare certification/quality context; not Medicaid payment truth | **Loaded — 267 KY facilities** | `SAFE` | Dataset ID, release, state filter, and processing date | Join to Medicaid claims only under authority | `CMS_PROVIDER_DATA` → `psa/CMS_PROVIDER_DATA/REAL/` |
| SOT-INTEGRITY-01 | Current federal health-program exclusions | HHS-OIG LEIE | Official public CSV | Identity resolution required; address-state filtering is not a provider match | **Loaded — aggregate-only KY groups** | `SAFE` | Retain the raw source content hash, but do not land/export person names, dates of birth, or addresses; fuzzy match is only a review candidate | Authorized provider-enrollment case workflow | `HHS_OIG_LEIE` → aggregate `psa/HHS_OIG_LEIE/REAL/` |
| SOT-FED-AWARD-01 | Federal award/grant/subaward context | USAspending API v2 | Public API; no authorization currently required | Federal awards are context, not Kentucky payment/contract truth | **Loaded — FY2023–FY2026 obligations; FY2026 labeled partial. OFR-01 (2026-08-31) deepened to award/recipient grain: 7 assistance listings (93.775/93.777/93.778/93.791/93.224/93.958/93.959) × KY+FL via place-of-performance and recipient-location queries, merged/deduplicated, reconciled to live USAspending control totals and a sampled award re-fetch on every gate run** | `SAFE` | Preserve assistance listing, recipient-location and period filters; award-grain rows additionally carry period-of-performance dates, recipient UEI, and awarding/funding agency for the federal funding cliff calendar | Link to state accounting and identity-resolved recipients only after the OFR-02 crosswalk | `USA_SPENDING` → `psa/USA_SPENDING/REAL/` |
| SOT-IDENTITY-01 | Federal UEI registrant identity (name, address, entity type) | SAM.gov Entity Management API v3 | Public API, Director-provisioned key | Verified live 2026-08-31: this API tier does not expose EIN/TIN even with a valid key (FOUO-gated). Primary UEI/name authority in the OFR-02 hybrid seed order; USAspending recipient-profile lookups corroborate | **Loaded — OFR-02 (2026-08-31) targeted lookups for KY+FL federal-award recipient UEIs** | `ATTRIBUTABLE` | Key loaded from local env (`SAM_GOV_API_KEY`) at runtime only; never committed, logged, or exported. Degrades to the USAspending-seeded path with a recorded gap if the key is absent/expired | Authorized FOUO-tier SAM access would add EIN directly | `SAM_ENTITY` → `psa/SAM_ENTITY/REAL/` (identity records only, no PSA landing of raw SAM responses beyond the identity fields retained) |
| SOT-NONPROFIT-01 | Nonprofit organization registry (EIN, name, address, NTEE, ruling date) | IRS Exempt Organizations Business Master File (state CSV extracts) | Official public CSV | Organization-level only; no officer/compensation detail (that is the person-level XML e-file corpus, explicitly out of OFR scope) | **Loaded — OFR-02 (2026-08-31): 22,568 KY rows, 113,452 FL rows (incl. header), full state files landed and content-hashed** | `SAFE` | Crosswalk seed for OFR-02; financial-resilience ratio basis for OFR-03 | Pair with annual Form 990 extract (OFR-03) | `IRS_EO_BMF` → `psa/IRS_EO_BMF/REAL/` |
| SOT-NONPROFIT-02 | Organization-level Form 990 financials (revenue, expenses, net assets, contributions) | IRS SOI annual Form 990 extract (2 posting-year vintages) | Official public CSV | No government-specific grant-revenue field or Part IX program/mgmt/fundraising column split in this extract (labeled at point of use); Form 990 only, not 990-EZ/990-PF; organization-level only | **Loaded — OFR-03 (2026-08-31): national ~345k-row extract filtered to the OFR-02 KY+FL EO BMF EIN universe, both vintages** | `SAFE` | Filtered to crosswalked orgs only, not landed nationally; liquidity-months and contribution-dependency ratios reproducible from retained rows | 990-EZ/990-PF vintages; longer multi-year trend series | `IRS_990_EXTRACT` → `psa/IRS_990_EXTRACT/REAL/` |
| SOT-SUBAWARD-01 | Federal sub-award funding flow for state-agency and nonprofit prime awards | USAspending API v2 subawards endpoint (extends `USA_SPENDING`) | Public API, no auth | Edges are only exact-derived (OFR-02 crosswalk match) or explicitly unresolved; concentration/overlap are review candidates, not findings | **Loaded — OFR-06 (2026-08-31): 442 prime awards queried; 1,197 KY sub-award edges (comparable FL volume), 419 KY edges identity-resolved (35%)** | `SAFE` | Requires the award's `generated_internal_id` (not the display Award ID) for the subawards lookup — discovered live | Expand identity resolution beyond exact-name matching once a richer crosswalk exists | `USA_SPENDING` → `psa/USA_SPENDING/REAL/` |
| SOT-OWNERSHIP-01 | Hospital + SNF ownership & control structure (organization-level only) | CMS Hospital/SNF "All Owners" PUFs (data.cms.gov data-api/v1) | Official open-data API | Person-level owner fields exist in the raw file for individual owners; none are read into any table — organization-level owner facts only. Hospice/HHA out of scope | **Loaded — OFR-05 (2026-08-31): 2,525 organization-level ownership rows across 154 matched KY+FL facilities; 55 multi-facility common-ownership chains** | `SAFE` | Exact-name-matched to the OFR-04 facility universe (no fuzzy matching); every ownership signal is a review candidate, never an adverse finding | Hospice/HHA ownership; fuzzy-matched coverage expansion | `CMS_OWNERSHIP` → `psa/CMS_OWNERSHIP/REAL/` |
| SOT-HCRIS-01 | Hospital + SNF facility financial characteristics (margin, Medicaid day share, uncompensated care, balance sheet) | CMS HCRIS Hospital Provider Cost Report + Skilled Nursing Facility Cost Report (data.cms.gov data-api/v1) | Official open-data API | Medicare cost-report basis, not Medicaid payment truth; a live-verified filter-operator bug (`==` vs `=`) initially caused a silent all-states landing, fixed with a defense-in-depth per-row state assertion (see OFR-04 completion-report detail) | **Loaded — OFR-04 (2026-08-31): 1,336 KY+FL facility-year rows, most recent posted fiscal years, verified state-pure post-fix** | `SAFE` | County-level negative-margin rollup is a review watchlist, not a closure prediction; Florida's own AHCA hospital-financial KPI (F-14) remains blocked (GAP-FL-F-14-PARAMETERS) — this is an explicit federal fallback, not a replacement | Join to Census/HRSA eligible-population ratios for a true access-continuity watchlist | `CMS_HCRIS` → `psa/CMS_HCRIS/REAL/` |
| SOT-NPI-01 | Organizational NPI records (entity type 2 only) | NPPES (CMS National Plan & Provider Enumeration System) | Official public API | Individual-provider NPI records are never queried or promoted; bounded per-run candidate lookups, not a full bulk-file ingestion | **Loaded — OFR-02 (2026-08-31): bounded wildcard-name lookups seeded from SAM and CMS Provider Data candidates, up to 40 candidates per state** | `ATTRIBUTABLE` | The only source in this spine publishing a cross-identifier pair (NPI + embedded state Medicaid provider ID) within one record — this is the sole `exact-published` crosswalk method in OFR-02 | Bulk NPPES file ingestion for full-coverage NPI matching | `NPPES` → identity records only, no bulk PSA landing (targeted API responses only) |
| SOT-WAIVER-01 | Section 1115 demonstration approval period + milestone documents (KY TEAMKY, FL MMA) | CMS Medicaid.gov Section 1115 demonstration pages | Public web page; no structured API exists for this data | CMS publishes no dataset/API for demonstration approval periods — the page itself is the source of record, cited by URI + retrieval date on every event; individual 1915(b)/(c) waiver authorities have no comparable page (recorded as `GAP-1915-KY`/`GAP-1915-FL`, not hand-transcribed) | **Loaded — OFR-07 (2026-08-31): 2 demonstration pages fetched; 14 waiver horizon events (2 expiration + 12 milestone); KY TEAMKY expires 2029-12-31, FL MMA expires 2030-06-30, both live-verified** | `SAFE` | A dedicated parser atom fails loudly if the page's "Waiver Dates"/"Supporting Documents" landmarks are missing, rather than silently returning wrong dates | Structured extraction of individual 1915(b)/(c) waiver authorities once a systematic source or DUA exists | `CMS_1115_DEMO` → `psa/CMS_1115_DEMO/REAL/` |
| SOT-GRANTS-01 | Open/forecasted federal funding opportunities (NOFOs) under the OFR-tracked assistance listings | Grants.gov `search2` API | Public API, no auth | National in scope — not KY/FL eligibility-verified; every event is attached to both states labeled `scope=national`, never state-targeted | **Loaded — OFR-07 (2026-08-31): 7 queries run (one per tracked listing); 12 nofo_opportunity events (5 real open/forecasted opportunities under listing 93.224 as of 2026-08-31, doubled for open+close dates across KY+FL; the other six tracked listings currently have zero open/forecasted opportunities)** | `SAFE` | Live-verified the request filter field is `cfda`, not `aln` — `aln` is silently ignored by this API version and returns the unfiltered catalog | Eligibility-field parsing to narrow national opportunities to those KY/FL entities can actually apply to | `GRANTS_GOV` → `psa/GRANTS_GOV/REAL/` |

## Outcomes — split classes (do not collapse)

1. **Application / eligibility outcomes** — `SOT-OUT-ELIG` — `OUT_OF_POC`
2. **Service utilization (operational grain)** — `SOT-OUT-UTIL` — `OUT_OF_POC`; public proxies via `SOT-UTIL-PUB` / published aggregates only
3. **MCO quality / comparative outcomes** — `SOT-OUT-MCOQ` / `SOT-MCO-02` — POC candidate
4. **Longitudinal / cross-state benchmarks** — `SOT-OUT-CMS` — POC candidate (lagged; freshness required)

## POC ingest priority (SAFE / ATTRIBUTABLE first)

1. `CMS_MCPAR` Kentucky slice for machine-readable managed-care accountability
2. `CMS_MEDICAID_SCORECARD` / `CMS_DATA_MEDICAID` enrollment & Scorecard KY slices
3. `KY_DMS_MCO_CONTRACTS` + roster effective dating and MCPAR plan reconciliation
4. `KY_DMS_MCO_EVAL` / Quality Branch PDF extracts (manual or semi-structured)
5. `KY_DMS_COUNTY_COUNTS`
6. CMS Provider Data / HHS-OIG LEIE / Census / HRSA / Ky open data for integrity, facility, denominator, and map context
7. Kentucky Transparency / OSBD governed document-search adapters for budget and contract-payment intelligence

## Explicit POC gaps (sell the paid build-out)

| Gap | Need |
|-----|------|
| Near-real-time KY cost drivers at claim/encounter grain | DMS/MCO authorized feeds + DUA |
| Member-level MCO assignment & eligibility outcomes | Eligibility/enrollment systems under authority |
| Fully structured EQRO/HEDIS result warehouse | DMS quality data sharing agreement |
| Proprietary measure specification republication | NCQA/other license or public Core Set only |

## Verified live URLs (web scan 2026-08-01)

### Kentucky DMS / CHFS
| Resource | URL |
|----------|-----|
| MCO Contracts | https://chfs.ky.gov/agencies/dms/dhpo/Pages/mco-contracts.aspx |
| MCO Options | https://chfs.ky.gov/agencies/dms/dhpo/Pages/mco-options.aspx |
| Quality Branch / EQRO | https://chfs.ky.gov/agencies/dms/dpqo/mco-qb/Pages/default.aspx |
| 2025 FY Comprehensive Evaluation Summary | https://www.chfs.ky.gov/agencies/dms/DMSMCOReports/2025%20FY%20Comprehensive%20Evaluation%20Summary.pdf |
| 2024 FY Comprehensive Evaluation Summary | https://www.chfs.ky.gov/agencies/dms/DMSMCOReports/2024%20FY%20Comprehensive%20Evaluation%20Summary.pdf |
| KY Quality Strategy | https://www.chfs.ky.gov/agencies/dms/dpqo/mco-qb/Documents/2-12-2024%20KY%20Quality%20Strategy.pdf |
| Monthly Medicaid Counts by County | https://chfs.ky.gov/agencies/dms/dafm/Pages/statistics.aspx |
| Research and Analytics Branch | https://chfs.ky.gov/agencies/dms/dpqo/rab/Pages/default.aspx |
| Example county membership PDF (2025-01-01) | https://www.chfs.ky.gov/agencies/dms/stats/KYDWMMCC20250101.pdf |
| Fee Schedules | https://chfs.ky.gov/agencies/dms/Pages/feesrates.aspx |
| Provider Directory | https://chfs.ky.gov/agencies/dms/dpi/Pages/Provider-Directory.aspx |

### Federal CMS / Medicaid.gov
| Resource | URL |
|----------|-----|
| data.medicaid.gov | https://data.medicaid.gov/ |
| MCPAR PUF 2024 | https://data.medicaid.gov/dataset/66da70e7-228e-41aa-b041-6f9e433ff237 |
| MCPAR PUF 2024 CSV | https://download.medicaid.gov/data/mmcc-mcpar-puf-2024.csv |
| PI / enrollment dataset | https://data.medicaid.gov/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360 |
| Medicaid Financial Management Data | https://data.medicaid.gov/dataset/5b19d1d4-ae43-5fcd-ba14-3cecd99f473f |
| Medicaid Spending by Drug | https://data.cms.gov/summary-statistics-on-use-and-payments/medicare-medicaid-spending-by-drug/medicaid-spending-by-drug |
| Medicaid & CHIP Scorecard | https://www.medicaid.gov/state-overviews/scorecard |
| Kentucky state profile | https://www.medicaid.gov/state-overviews/stateprofile.html?state=Kentucky |
| Core Set Data Dashboard | https://www.medicaid.gov/medicaid/quality-of-care/core-set-data-dashboard/main |
| Adult and Child Core Set | https://www.medicaid.gov/medicaid/quality-of-care/performance-measurement/adult-and-child-health-care-quality-measures |
| Enrollment highlights | https://www.medicaid.gov/medicaid/program-information/medicaid-and-chip-enrollment-data/report-highlights |

### Context / legislation / restricted
| Resource | URL | Note |
|----------|-----|------|
| AHRQ HCUP | https://hcup-us.ahrq.gov/ | KY SEDD exists; microdata often RESTRICTED |
| Child/Adult Core Set quality measures CSV (2020) | https://data.medicaid.gov/sites/default/files/uploaded_resources/2020-child-and-adult-health-care-quality-measures.csv | State rates + medians |
| Child/Adult Core Set quality measures CSV (2022) | https://data.medicaid.gov/sites/default/files/uploaded_resources/2022-child-and-adult-health-care-quality-measures_0.csv | State rates + medians |
| Child/Adult Core Set quality measures CSV (2023) | https://data.medicaid.gov/sites/default/files/uploaded_resources/2023-child-and-adult-health-care-quality-measures.csv | State rates + medians |
| KY SEDD composition | https://hcup-us.ahrq.gov/db/state/sedddist/sedddist_filecompky.jsp | |
| KyGovMaps Open Data | https://opengisdata.ky.gov/ | |
| Census ACS | https://www.census.gov/programs-surveys/acs | |
| HRSA AHRF | https://data.hrsa.gov/topics/health-workforce/ahrf | |
| Kentucky Legislative Record | https://apps.legislature.ky.gov/record/ | |
| MACPAC | https://www.macpac.gov/ | |
| NCQA HEDIS | https://www.ncqa.org/hedis/ | Spec pointer only — RESTRICTED republish |
| Kentucky Transparency spending search | https://transparency.ky.gov/search/Pages/spendingsearch.aspx | Public search; no documented supported API found |
| Kentucky OSBD | https://osbd.ky.gov/pages/default.aspx | Public budget documents |
| CMS Provider Data Catalog | https://data.cms.gov/provider-data/ | Official open-data API/CSV |
| HHS-OIG LEIE | https://www.oig.hhs.gov/exclusions/leie-database-supplement-downloads/ | Official public CSV |
| USAspending API | https://api.usaspending.gov/ | Federal award context |

## Research notes

- UI Authoritative Sources view hydrates from BW export `authoritativeSources.js` (single SoT with this catalogue).
- 2025 evaluation / contracts list Aetna, Humana, Passport, United, WellCare (Anthem exit).
