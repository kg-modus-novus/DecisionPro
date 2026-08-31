# Real-Data Hydration Plan (complete synthetic cutover)

**Status:** active — Director-authorized cutover  
**App ID:** `decisionpro`  
**Related:** [ky-medicaid-source-catalogue.md](./ky-medicaid-source-catalogue.md), [provisional-measure-catalog.md](./provisional-measure-catalog.md), [decisionpro-poc-lifecycle.md](./decisionpro-poc-lifecycle.md)

## Kentucky operational-source implementation — 2026-08-27

`npm run bw:operational-etl` now performs a repeatable `LoadClass=REAL` refresh through XenoDroid BW load history, PSA, DSO, cube, and generated UI export for eight sources:

- CMS MCPAR 2024 Kentucky response rows;
- CMS Provider Data Kentucky nursing-home facility context;
- HHS-OIG LEIE Kentucky-address aggregate groups (raw content hash retained; person names, dates of birth, and addresses are not landed/exported);
- USAspending Assistance Listing 93.778 fiscal-year obligations with complete/partial period labels;
- Kentucky GeoNet licensed-hospital facilities and published bed context;
- Kentucky OSBD 2026–2028 budget documents, downloaded and content-hashed;
- Kentucky DMS 2026–2027 MCO contract documents, downloaded and content-hashed; and
- Kentucky Transparency official page/source manifest only.

The dashboard contract is generated at `wireframe V1/app/src/data/alp/kyOperationalSources.js`. Every operational metric carries source system/URI, load-history ID, as-of date, provenance, limitation, and controlled next action. Kentucky Transparency transaction-grain contract/payment analytics remain blocked on a supported export or governed operator extract; no internal endpoint is represented as a supported public API.

## Policy

`DP-DEC-001` (revised): After cutover, Evidence Rooms, Blender findings, role smart tiles, and option-pack magnitudes must not show synthetic analytical numbers. Every displayed magnitude is either `LoadClass=REAL` (public published aggregate / curated ATTRIBUTABLE extract with provenance) or an explicit **Gap object** naming the authorized feed / DUA / license needed.

Interaction UX (filters, walkthroughs, blender weighting) remains. Fake warehouse cubes are removed from the demo path. `LoadClass=TEST` fixtures remain only for the pre-REAL gate harness and are purged before accuracy claim.

## UI placement — Authoritative sources

Primary nav item **Authoritative sources** (`view: 'sources'`) under Role Home, before Evidence Rooms. Index lists catalogue rows (domain, publisher, TOS, link, FromSysID, as-of, consumers, Loaded vs Gap). Deep-links from PrimarySourceLinks, Accurate provenance, and Measure Definitions.

Footer badge: **Public REAL + labeled gaps** (not “Synthetic data demo”).

## Evidence Rooms / Blender

See hydration maps in this document’s companion Cursor plan and room/finding disposition tables implemented via BW exports:

- `wireframe V1/app/src/data/alp/roomCubes.real.js`
- `wireframe V1/app/src/data/alp/blenderFindings.real.js`
- `wireframe V1/app/src/data/alp/authoritativeSources.js`
- `wireframe V1/app/src/data/alp/gapObjects.js`

## Unfillable gaps (paid follow-on)

1. Claim/encounter grain cost drivers and contribution $M  
2. Member-level eligibility / MCO assignment  
3. Avoidable-ED / miles-to-care / HD expenditure from KY MMIS  
4. MCO withholding dollar outcomes  
5. Risk-adjusted provider performance from KY payment data  
6. Near-real-time operational refresh  
7. Full electronic EQRO/HEDIS warehouse  
8. HCUP SID/SEDD microdata (license)  
9. NCQA HEDIS specification republication  

## Load / refresh rules

Agent-facing summary: `.cursor/rules/decisionpro-data-load-refresh.mdc`. Keep that rule and this section aligned.

### Most recent available bind (Director invariant)

- For every authoritative public source DecisionPro loads, **bind the most recent publisher period that is actually available** on an attributable public URI (HTTP 200 / confirmed open table), then keep verified historical depth where the series is continuous.
- Do **not** leave a stale “sample month/year” bind when a newer public file or vintage has been resolved.
- Re-probe guessed archive paths on refresh; a prior 404 is not permanent.
- Curated aggregates (e.g. KY expenditure / pharmacy program totals) still must not invent attribution — but when a newer attributable KY figure exists, replace/update the bind to that newer vintage.
- Source Timeline empty slots after the loaded latest should read as **not published** / **future** / **missing pending refresh**, not as an intentional skip of available newer data.

### Core Set / Scorecard period labeling

- CSV **Core Set Year** (and “YYYY reporting” dataset titles) are **FFY reporting**, not calendar-year performance.
- For HEDIS-style rates, **FFY N reporting ≈ MY N−1** unless the publisher row says otherwise.
- Landing rows must carry `coreSetYear`, `measurementYear`, `periodId` (`ffyYYYY`), `periodLabel` (e.g. `FFY 2024 reporting · MY 2023`), and `coreSetAbbr`.
- `asOfDate` = **measurement-year end** (`MY-12-31`). UI trust/comparison copy prefers `periodLabel` over a bare date.
- Do not present Core Set tiles as “latest Kentucky performance” when a newer **different SoT** (e.g. DMS EQRO HEDIS PDF) exists — cite the CMS bind honestly and put cross-source figures in Spectrum / provenance notes.

### HTTP 404 recovery

A 404 on a guessed path is not proof the vintage is unpublished. Before Spectrum “URI not published”:

1. Record the failed URL and status.
2. Check dataset metastore / data.gov / Medicaid.gov quality pages for a new host or path (e.g. `download.medicaid.gov`).
3. Probe alternates via `xenodroid-bw/scripts/resolve-core-set-csv.mjs` / `ResolveCoreSetCsvUri`; load the first authoritative HTTP 200.
4. Record failed and resolved URIs in Spectrum.
5. **Surface on BW admin Load Monitor:** unresolved 404s as **error** alerts; successful loads that required a fallback after 404 as **warning** alerts, each with explanation + probe log (`ExportUriResolutionLog` → `loadAlerts` on `/api/bw/workbench`).

### Rebuild helpers

- `node scripts/resolve-core-set-csv.mjs [year…]` — resolve download URIs with 404 fallbacks.
- `node scripts/rebuild-core-set-pack.mjs` — refresh M-010/M-011/M-012 pack rows from resolved CSVs, then run `npm run bw:gate`.
- Gate `export-ui` runs `ExportUriResolutionLog` and refreshes admin Load Monitor alerts.

## History hydration waves

Policy: hydrate aggressively where public SoTs allow it; keep Explicit Gaps unlabeled as history (no invented series). Distinguish **observed SoT availability** vs **what this gate loaded** vs **Director follow-on**.

| Wave | Scope | Status notes |
|------|--------|--------------|
| 1A | CMS PI — all KY periods in PI CSV → `M-001`/`M-002` series + Command Center injection | Full modern monthly series (not latest-3 window) |
| 1B | Core Set vintages for `M-010`/`M-011`/`M-012` | Loaded FFY 2020–2024 where abbreviations exist (FFY→MY labeling); WCV-CH starts FFY 2021; FFY 2024 via `download.medicaid.gov` (`PPC2-AD` postpartum for M-012) |
| 1C | Pharmacy `M-017` | One curated KY annual aggregate; CMS Spending by Drug historical file is national drug-level (~5y) — Spectrum records the grain mismatch (no synthetic KY multi-year stretch) |
| 2A | KY county monthly PDFs `M-003` | Bound **13** HTTP 200 months after day-of-month filename sweep across the full Source Timeline window (2016-09…2026-08): 2024-01/02/10, 2025-01/02/10, 2026-01…07. Latest **2026-07** (Jefferson Total Members **225,170**). All other window months returned 404 for every day suffix — Spectrum `archiveProbe` NOT_FOUND, timeline **Not published** |
| 2B | Census ACS `M-021` | LOADED KY uninsured shares (ACS-based via KFF State Health Facts) for CY2016–2019 + CY2021–2024 |
| 2C | Gaps / event facets | Remain snapshot or Gap — no invented continuous series |

## Kentucky operational public-source hydration

Implemented 2026-08-27 through `RetrieveAndLoadKentuckyOperationalSources` and
`ExportKentuckyOperationalSourcesForUi`:

- CMS MCPAR 2024 Kentucky responses: official CSV retained in PSA; question/entity/program/period/response rows in Detail DSO; guarded accountability metrics in the operational cube.
- CMS Provider Data: current Kentucky nursing-facility API slice retained and normalized, with capacity, rating, enforcement-event, and fine aggregates.
- HHS-OIG LEIE: the current official file is read and content-hashed; only Kentucky aggregate exclusion groups are retained/exported. Names, DOBs, and addresses do not enter the legislative UI.
- USAspending Assistance Listing 93.778: Kentucky recipient-location obligation context loaded with explicit partial-period and state-accounting limitations.
- Kentucky GeoNet hospitals: official ArcGIS licensed-facility rows normalized with county and licensed-bed aggregates; these are not staffed-capacity or network-adequacy claims.
- OSBD 2026–2028 budget documents and current DMS MCO contract files: official indexes retained and matching documents downloaded/content-hashed for governed page/table extraction.
- Kentucky Transparency: official public search page retained as a source manifest only. No undocumented internal endpoint is represented as a supported production API.

Refresh with `npm --prefix xenodroid-bw run bw:operational-etl`. Each source has a source-specific quality gate and independent `load_history` record.

## Florida governed public-source hydration — 2026-08-30

Refresh with `npm run bw:fl-refresh`. The generated UI contract is
`wireframe V1/app/src/data/alp/flOperationalSources.js` and currently contains:

- all eleven AHCA Agency Dashboard domains, with nine export-permitted workbooks hydrated and two publisher-disabled workbooks retained only as explicit gaps;
- the latest public Florida Medicaid **Age by County** report (July 31, 2026), including 67 county aggregates, the statewide total, and publisher-provided prior-month and prior-year comparators;
- the public Rule 59G-4.002 fee-schedule publication inventory, including schedule category, document format, effective-date context, and official URI; CPT/code descriptions and raw rate tables are not republished;
- the CMS MCPAR 2024 Florida slice;
- the CMS Provider Data Florida nursing-facility slice, summarized to institutional/county metrics;
- the HHS-OIG LEIE Florida-address slice, transformed in memory to exclusion-type aggregates so names, dates of birth, and addresses are not retained in the Florida PSA or UI; and
- USAspending Assistance Listing 93.778 Florida obligations by fiscal year, with complete versus partial-period status.

Every run checks both AHCA robots policies, uses the declared DecisionPro data-request user agent, serializes and paces requests, retains content hashes and source URIs, and hard-stops Tableau extraction when `allow_export_data=false`. The public-site adapters use only ordinary linked pages/files. They do not bypass disabled exports, authenticated systems, or technical controls.

Current governed gaps are:

1. Quality Initiatives workbook export disabled by the publisher;
2. Malpractice Claims workbook export disabled by the publisher;
3. parameter-driven hospital-financial KPI export not yet reconciled to the rendered view; and
4. full plan × metric × quarter iteration not yet reconciled to rendered controls.

The first two require written permission or another authoritative published extract. The latter two are technical reconciliation gates on otherwise public views and may be completed only through supported parameters and rendered-to-export validation.

### Post-refresh opportunity-model rule

`flOperationalGoals.js` recalculates Florida review universes and coverage ratios from the generated `flOperationalSources.js` contract. A hydration refresh must therefore be followed by the Florida governance tests and rendered opportunity-page verification. Observed quantities such as published fines, eligibility changes, facility ratings, exclusion aggregates, and source coverage must remain labeled as review scope or context—not savings, waste, wrongdoing, access failure, or causal program impact. Modeled tranches must state their percentage rule, and realized financial benefit may be populated only from authorized ledgers, paid claims, contract terms, validated utilization, labor baselines, or measured outcomes.

## OFR-01 — federal award/recipient-grain hydration (2026-08-31)

`npm run bw:gate` now also runs `RetrieveAndLoadFederalAwardGrain`, a state-neutral
molecule (one class, no KY/FL fork) that deepens the existing `USA_SPENDING`
adapter from fiscal-year obligation aggregates to award/recipient grain for
Kentucky and Florida across seven assistance listings: 93.775, 93.777, 93.778,
93.791 (plan minimum) plus 93.224, 93.958, 93.959 (HRSA/SAMHSA listings that
fund Medicaid-adjacent capacity). Each state × listing pair is queried via both
place-of-performance and recipient-location filters, merged and deduplicated by
award ID, landed to PSA with a content hash, and reconciled on every gate run
against a freshly re-fetched USAspending control count and one sampled
award-detail re-fetch (`CheckFederalAwardGrainNumbers`).

The generated UI contract is
`wireframe V1/app/src/data/alp/federalAwardGrain.js`, keyed by `state` with no
cross-population between KY and FL. It feeds a new "federal funding cliff
calendar" (0–6 / 6–12 / 12–24 month award-expiration buckets) and a
single-stream-dependency review-candidate list into the Trend & Budget
Planning goal category for both `KY_OPERATIONAL_GOALS` and
`FL_OPERATIONAL_GOALS`. Empty state × listing combinations (no USAspending
award-grain records returned in the FY2023–FY2026 window) are recorded, not
fabricated — currently KY/93.777, FL/93.777, and FL/93.791.

## OFR-02 — identity crosswalk spine (2026-08-31)

`npm run bw:gate` now also runs `RetrieveAndLoadOrganizationCrosswalk`, a
state-neutral molecule that builds `organization_crosswalk_exact` and
`organization_crosswalk_inferred` (structurally separate tables, enforced by
SQL `CHECK` constraints, not just an export-time filter) for Kentucky and
Florida from five identity sources: SAM.gov Entity Management API (primary
UEI/name authority, Director-provisioned key), USAspending recipient
profiles, IRS EO BMF state extracts, CMS Provider Data, and bounded NPPES
organizational-NPI lookups.

**Grounding correction, verified live 2026-08-31:** the OFR plan's amended
`SAM_ENTITY` row assumed SAM.gov would be the primary UEI↔EIN authority with
`exact-published` confidence. A full-section SAM entity lookup for a known
UEI returned `entityRegistration`/`coreData`/`assertions` with no
`ein`/`tin`/`taxIdentification` field anywhere — this API tier (even with the
provisioned key) does not expose EIN; that requires FOUO access this key does
not carry. USAspending's award-grain and recipient-profile endpoints were
checked too and also do not expose EIN. The one genuine same-record
(`exact-published`) cross-identifier fact available in this spine is NPPES:
an organizational NPI record can carry an embedded state Medicaid provider
identifier. Every other link (UEI↔EIN, EIN↔NPI, etc.) is therefore a
name/ZIP-matched `exact-derived` assertion or a name-similarity-only
`inferred` review candidate — never presented as `exact-published` unless it
truly came from one source's own record.

SAM.gov's public-tier rate limit proved stricter than documented pacing
handled cleanly in testing: repeated HTTP 429 responses occurred even at 3
second inter-request spacing, including on the very first call of a fresh
run — consistent with a short-window burst quota rather than a steady
per-request rate. When SAM lookups fail, the adapter records an explicit
`GAP-SAM-ENTITY-<state>` gap and degrades to the USAspending-seeded identity
path for that state, per the plan's documented fallback; it does not retry
indefinitely or substitute fabricated data.

The generated UI contract is
`wireframe V1/app/src/data/alp/organizationCrosswalk.js`, keyed by `state`
with no cross-population between KY and FL, feeding a new "Strengthen
exclusion and identity screening with a governed crosswalk" case into the
Protect Program Integrity goal category for both `KY_OPERATIONAL_GOALS` and
`FL_OPERATIONAL_GOALS`.

## OFR-03 — IRS Form 990 organization financials (2026-08-31)

`npm run bw:gate` now also runs `RetrieveAndLoadNonprofitFinancials`, which
ingests the IRS SOI annual Form 990 extract (two posting-year vintages, 24
and 23) and filters its ~345,000 national rows down to only the
organizations already identity-resolved to Kentucky or Florida by the OFR-02
IRS EO BMF crosswalk — "990 extract rows for crosswalked orgs" per the plan,
not a national landing. Scope for this package is Form 990 only (not
990-EZ/990-PF), the dominant return for the Medicaid-adjacent nonprofit
population this product targets; documented as a scope boundary, not a
silent omission.

**Grounding correction, verified by direct inspection of the extract's
column header 2026-08-31:** the SOI summary extract does not carry a
government-specific grant-revenue field — Form 990 Part VIII Line 1e
(government grants) is not broken out from total Part VIII Line 1
contributions/gifts/grants (Line 1h) in this file. "Government-grant
dependency" is therefore computed and labeled as **contribution-and-grant
revenue dependency** (total contributions/grants ÷ total revenue), not a
government-specific ratio. The extract also does not carry the Form 990 Part
IX functional-expense column split (Program / Management-and-general /
Fundraising) — only a Total column plus named expense line items.
"Program-vs-admin expense trend" is therefore computed and labeled as a
**named-administrative-category expense share** (management, legal,
accounting, lobbying, and investment-management fees plus office expenses,
over total functional expenses) — a proxy, not the official Part IX
allocation. Both limitations are stated at the point of use in the exported
UI payload, not only in this document.

The generated UI contract is
`wireframe V1/app/src/data/alp/nonprofitFinancials.js`, keyed by `state`,
feeding a "Review nonprofit financial-resilience signals from IRS Form 990
filings" case into the Trend & Budget Planning goal for both
`KY_OPERATIONAL_GOALS` and `FL_OPERATIONAL_GOALS`. Every ratio is labeled a
review prompt, never a finding of distress or mismanagement, per the
no-adverse-conclusion gate.

## OFR-04 — CMS HCRIS facility financial distress (2026-08-31)

`npm run bw:gate` now also runs `RetrieveAndLoadFacilityFinancialDistress`,
which ingests CMS's Hospital Provider Cost Report and Skilled Nursing
Facility Cost Report (both via `data.cms.gov/data-api/v1`) for Kentucky and
Florida, computing total margin, Medicaid patient-day share, uncompensated
care, and county-level negative-margin rollups. Every value is labeled
Medicare cost-report basis, not Medicaid payment truth.

**Critical bug found and fixed, live-verified 2026-08-31:** the CMS
data-api's equality filter requires operator value `"="`, not `"=="` as a
third-party API guide suggested. An unrecognized operator value does not
error on this endpoint — it silently drops the filter and returns unfiltered
national data. This caused the first load to land cost-report rows for
every US state instead of only KY/FL (caught by manually checking the
loaded row count against a hand-derived expectation, not by the
reconciliation gate itself, since the row-count floor "passed" for the
wrong reason). The polluted data never reached any export or UI surface —
the export layer filters by each row's own CMS-reported state field — but
the fix also adds a defense-in-depth assertion that throws immediately if a
"state-filtered" API response ever again contains a row for the wrong
state, so this failure mode cannot recur silently. Full detail:
`docs/planning/ofr-completion-report.md` "OFR-04 detail".

Florida's exported slice explicitly cites the pre-existing
`GAP-FL-F-14-PARAMETERS` gap (Florida's own AHCA hospital-financial KPI
export, blocked by a publisher-side parameter requirement) so this federal
HCRIS layer is presented as an explicit fallback alongside that gap, never
a silent replacement for it.

## OFR-05 — CMS ownership & control network (2026-08-31)

`npm run bw:gate` now also runs `RetrieveAndLoadOwnershipNetwork`, which
ingests CMS's Hospital + SNF "All Owners" PUFs (offset-paginated, national
files) and matches each row's facility to the OFR-04 KY+FL facility universe
by exact normalized name. Only organization-level owner facts (organization
name, role, percentage, entity-type flags, association date) and an
`owner_type` flag are read into any table — the raw file's individual-owner
name and personal-address fields are never read past the initial PSA
landing (which retains the full file with a content hash for audit, per the
person-level gate's PSA-retention allowance). This is structurally
enforced: `dso_ownership_interest` has no column that could hold a person's
name.

Scoped to Hospital and SNF facilities only in this package (Hospice/HHA
ownership out of scope — documented boundary), and matched by exact name
only (no fuzzy matching, unlike OFR-02's crosswalk), since this signal feeds
a program-integrity-adjacent goal category. The generated UI contract is
`wireframe V1/app/src/data/alp/ownershipNetwork.js`, feeding a "common-
ownership chains and recent ownership changes" review case into Protect
Program Integrity for both states.

## OFR-06 — federal sub-award flow graph (2026-08-31)

`npm run bw:gate` now also runs `RetrieveAndLoadSubawardFlowGraph`, which
queries USAspending's subawards API for every one of the 442 KY+FL prime
awards already loaded by OFR-01. Live-verified: the subawards endpoint
requires the award's `generated_internal_id` (e.g.
`ASST_NON_B08TI088097_075`) — the plain display "Award ID" code (e.g.
`B08TI088097`) returns zero results even for awards that do have subawards.
OFR-01's `dso_federal_award.award_key` column already stores the
`generated_internal_id` form, so no re-fetch was needed.

Every resulting funding edge is matched against OFR-02's EIN-bearing
identity records by exact normalized name and labeled `exact-derived` or
`unresolved` — a SQL `CHECK` constraint makes any other value impossible to
insert. Funding-concentration is computed only over `exact-derived` edges;
program-overlap (a sub-recipient appearing under more than one OFR-tracked
assistance listing) is computed over all edges but never described as
duplicative without a scope-reconciliation caveat. The generated UI contract
is `wireframe V1/app/src/data/alp/subawardFlowGraph.js`, feeding a
"sub-award funding concentration and program overlap" review case into
Trend & Budget Planning for both states.

## OFR-07 — waiver & grant horizon watch (2026-08-31)

`npm run bw:gate` now also runs `RetrieveAndLoadProgramHorizonEvents`, which
hydrates two source lanes into a single state-neutral
`dso_program_horizon_event` table:

- **CMS_1115_DEMO** — the two 1115 demonstrations named in the plan (KY
  TEAMKY, FL MMA). CMS publishes no structured API for demonstration
  approval periods; each demonstration page itself
  (`medicaid.gov/medicaid/section-1115-demo/demonstration-and-waiver-list/{id}`)
  is the source of record, live-verified to carry a stable "Waiver Dates"
  block (Approval/Effective/Expiration) and a "Supporting Documents" table.
  A new atom, `ParseCmsDemonstrationPage.ts`, extracts both and throws if
  either landmark is missing rather than silently returning wrong dates.
  KY TEAMKY expires `2029-12-31`; FL MMA expires `2030-06-30` — both
  confirmed live against the page, not derived from search snippets.
- **GRANTS_GOV** — the live, unauthenticated Grants.gov `search2` API,
  queried once per OFR-tracked assistance listing. Live-verified: the
  request field is `cfda`, not `aln` — `aln` is silently accepted but
  ignored by this API version and returns the full unfiltered catalog,
  which would have produced a badly over-broad "NOFO opportunity" list if
  shipped without live verification. Every resulting opportunity is
  `scope='national'` (Grants.gov does not confirm KY/FL-specific
  eligibility) and is attached to both states, never presented as
  state-targeted.

Individual state 1915(b)/(c) waiver authorities are named in the plan under
"1915 authorities" but have no comparable CMS structured page — recorded as
`GAP-1915-KY`/`GAP-1915-FL` in the completion report rather than
hand-transcribed without a reconciliation path. The generated UI contract is
`wireframe V1/app/src/data/alp/programHorizonEvents.js`, feeding a "track
waiver/demonstration expirations and open federal grant opportunities"
review case into Trend & Budget Planning for both states.

## Data Spectrum (Authoritative Sources)

Primary trust narrative on **Authoritative sources** (`view: 'sources'`) — not a separate nav item.

- BW export: `ExportDataSpectrumForUi` → `wireframe V1/app/src/data/alp/dataSpectrum.js` + `docs/planning/data-spectrum-latest.md`
- Per `FromSysID` / Explicit Gap: Provides, Available depth, Loaded depth, How used, Gaps/inconsistencies, Disposition
- UI: summary chips, sortable Spectrum table, selected-source Spectrum blocks, Download JSON/Markdown

Period filters for Evidence Rooms come from gate-exported `periods.real.js` (merged in `dimensions.js`) so PI months are not hand-maintained.

## Gate

`npm run bw:gate` — TEST → purge → REAL ETL (enrollment, MCO, public hydration pack, and Kentucky operational sources) → accuracy → export all UI bundles (including operational metrics/actions, Data Spectrum, REAL periods, and URI-resolution Load Monitor alerts).
