# Real-Data Hydration Plan (complete synthetic cutover)

**Status:** active — Director-authorized cutover  
**App ID:** `decisionpro`  
**Related:** [ky-medicaid-source-catalogue.md](./ky-medicaid-source-catalogue.md), [provisional-measure-catalog.md](./provisional-measure-catalog.md), [decisionpro-poc-lifecycle.md](./decisionpro-poc-lifecycle.md)

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

## History hydration waves

Policy: hydrate aggressively where public SoTs allow it; keep Explicit Gaps unlabeled as history (no invented series). Distinguish **observed SoT availability** vs **what this gate loaded** vs **Director follow-on**.

| Wave | Scope | Status notes |
|------|--------|--------------|
| 1A | CMS PI — all KY periods in PI CSV → `M-001`/`M-002` series + Command Center injection | Full modern monthly series (not latest-3 window) |
| 1B | Core Set vintages for `M-010`/`M-011`/`M-012` | Loaded 2020–2023 where abbreviations exist; WCV-CH starts 2021; 2024 CSV URI not published at last scan |
| 1C | Pharmacy `M-017` | One curated KY annual aggregate; CMS Spending by Drug historical file is national drug-level (~5y) — Spectrum records the grain mismatch (no synthetic KY multi-year stretch) |
| 2A | KY county monthly PDFs `M-003` | Parsed Jan 2024 + Jan 2025 Total Members extracts; archive probes for missing months are Spectrum inconsistencies |
| 2B | Census ACS `M-021` | LOADED KY uninsured shares (ACS-based via KFF State Health Facts) for CY2016–2019 + CY2021–2024 |
| 2C | Gaps / event facets | Remain snapshot or Gap — no invented continuous series |

## Data Spectrum (Authoritative Sources)

Primary trust narrative on **Authoritative sources** (`view: 'sources'`) — not a separate nav item.

- BW export: `ExportDataSpectrumForUi` → `wireframe V1/app/src/data/alp/dataSpectrum.js` + `docs/planning/data-spectrum-latest.md`
- Per `FromSysID` / Explicit Gap: Provides, Available depth, Loaded depth, How used, Gaps/inconsistencies, Disposition
- UI: summary chips, sortable Spectrum table, selected-source Spectrum blocks, Download JSON/Markdown

Period filters for Evidence Rooms come from gate-exported `periods.real.js` (merged in `dimensions.js`) so PI months are not hand-maintained.

## Gate

`npm run bw:gate` — TEST → purge → REAL ETL (enrollment, MCO, public hydration pack) → accuracy → export all UI bundles (including Data Spectrum + REAL periods).
