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

## Data Spectrum (Authoritative Sources)

Primary trust narrative on **Authoritative sources** (`view: 'sources'`) — not a separate nav item.

- BW export: `ExportDataSpectrumForUi` → `wireframe V1/app/src/data/alp/dataSpectrum.js` + `docs/planning/data-spectrum-latest.md`
- Per `FromSysID` / Explicit Gap: Provides, Available depth, Loaded depth, How used, Gaps/inconsistencies, Disposition
- UI: summary chips, sortable Spectrum table, selected-source Spectrum blocks, Download JSON/Markdown

Period filters for Evidence Rooms come from gate-exported `periods.real.js` (merged in `dimensions.js`) so PI months are not hand-maintained.

## Gate

`npm run bw:gate` — TEST → purge → REAL ETL (enrollment, MCO, public hydration pack, and Kentucky operational sources) → accuracy → export all UI bundles (including operational metrics/actions, Data Spectrum, REAL periods, and URI-resolution Load Monitor alerts).
