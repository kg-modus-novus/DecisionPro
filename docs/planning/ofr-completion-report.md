# OFR completion report

**Status as of 2026-08-31 (live document, updated as packages land):** OFR-00 and
OFR-01 implemented and gate-green. OFR-02 through OFR-09 not yet started.

This is the Director's acceptance and audit record for the Organization
Funding & Resilience Intelligence (OFR) work package, executed per
`docs/planning/ofr-kickoff-prompt.md` against
`docs/planning/organization-funding-resilience-intelligence-plan.md`.

## Per-package status

| Package | Status | Notes |
|---|---|---|
| OFR-00 — Baseline checkpoint | **Implemented** | `npm run test` (216/216), `npm run build`, `npm run harness:verify`, `npm run bw:gate` all green before any OFR code changed. Evidence: `docs/evidence/harness-workbench/headless/ofr-00-baseline/baseline-verification.json`. Commit: `chore: OFR-00 baseline checkpoint`. |
| OFR-01 — USAspending award grain | **Implemented** | State-neutral (KY+FL, one molecule, no fork) award/recipient-grain adapter for 7 assistance listings. See detail below. Evidence: `docs/evidence/harness-workbench/headless/ofr-01-award-grain/verification.json`. |
| OFR-02 — Identity crosswalk spine | Not started | — |
| OFR-03 — IRS 990 org financials | Not started | — |
| OFR-04 — Facility financial distress (HCRIS) | Not started | — |
| OFR-05 — Ownership & control network | Not started | Gates on OFR-02. |
| OFR-06 — Sub-award flow graph | Not started | Gates on OFR-02. |
| OFR-07 — Waiver & grant horizon watch | Not started | — |
| OFR-08 — Funding & Resilience Evidence Room + Operational Intelligence integration | Not started | — |
| OFR-09 — Acceptance, evidence, and completion report | Not started (this document is the interim shell) | — |

## OFR-01 detail

**What was built** (all additive to the existing schema/export contracts frozen
at OFR-00):

- `xenodroid-bw/src/atoms/GovernedHttpClient.ts` — shared throttled/backoff/UA
  HTTP client (request ceiling, min inter-request delay, large-response
  courtesy delay), extracted for reuse by every future OFR adapter (OFR-03
  through OFR-07), not just this one.
- `xenodroid-bw/sql/005_ofr_federal_award_grain.sql` — new `bw_dso.dso_federal_award`
  and `bw_cube.cube_federal_award_metric` tables. Does not alter the pre-existing
  `dso_federal_award_context` (fiscal-year aggregate) table.
- `xenodroid-bw/src/molecules/RetrieveAndLoadFederalAwardGrain.ts` — one class,
  loops `state in ['KY','FL']` internally (never forks by state). For each
  state × assistance-listing pair, queries USAspending `spending_by_award`
  via both `place_of_performance_locations` and `recipient_locations` filters,
  merges/deduplicates by `generated_internal_id`, lands raw JSON to PSA with a
  SHA-256 hash, and writes DSO rows plus per-state cube metrics (award count,
  total amount, three funding-cliff buckets, single-stream-dependency count).
- `xenodroid-bw/src/molecules/CheckFederalAwardGrainNumbers.ts` — Source
  Reconciliation: row-count floor (≥20 combined), a live re-fetch of
  `spending_by_award_count` for one sampled state/listing compared to the
  stored count, and a live re-fetch of one sampled award's detail endpoint
  compared to its stored `award_amount`. All three passed on the last run
  (442 rows; FL/93.224 control count 231=231; sampled award exact match).
- `xenodroid-bw/src/molecules/ExportFederalAwardGrainForUi.ts` — writes
  `wireframe V1/app/src/data/alp/federalAwardGrain.js`, state-keyed, with the
  reconciliation result embedded.
- Wired into `xenodroid-bw/src/cli.ts` (`real-etl`, `accuracy-check`,
  `export-ui` steps of `bw:gate`).
- `xenodroid-bw/src/catalog/seedCatalog.ts` — updated `USA_SPENDING`
  attribution notes; added `DR-REAL-USASPENDING-AWARD-GRAIN` data request.
- New "Track federal award expirations and single-stream funding
  concentration" case added to the existing **Trend & Budget Planning** goal
  in both `wireframe V1/app/src/data/operationalGoals.js` (KY) and
  `wireframe V1/app/src/data/flOperationalGoals.js` (FL), each sourced only
  from its own state slice of `federalAwardGrain.js`.
- New test: `wireframe V1/app/src/lib/federalAwardGrain.test.js` — asserts
  state-neutrality, no cross-state award-ID leakage, minimum assistance-listing
  coverage, reconciliation `claimAllowed === true`, and no waste/fraud/breach
  language anywhere in the exported payload.
- Catalogue: `docs/planning/ky-medicaid-source-catalogue.md` SOT-FED-AWARD-01
  row updated. `docs/planning/real-data-hydration-plan.md` OFR-01 section added.

**Bug found and fixed during this package:** the pre-existing
`ExportKentuckyOperationalSourcesForUi` "latest load per FromSysID" queries
picked the *latest* `load_history` row for `USA_SPENDING` to source its two
fiscal-year metrics. Once OFR-01 began writing its own `USA_SPENDING`
`load_history` rows (correctly, under the same FromSysID — same publisher,
same catalog entry), those queries started resolving to an OFR-01 load with no
matching `cube_operational_source_metric` rows, silently dropping
`ky-usaspending-latest-complete-fy` / `ky-usaspending-current-partial-fy` from
the export (metric count 27 → 25, caught by
`operationalIntelligence.test.js`). Fixed by pinning both queries to
`data_request_id = 'DR-REAL-USASPENDING-KY-MEDICAID'` when `from_sys_id =
'USA_SPENDING'`, restoring metric count to 27. This is the general pattern any
later OFR package must watch for whenever it adds a second loader under an
existing FromSysID.

### OFR-01 exit gate — status: **green**

> "Award facts reconcile to API control totals per listing×FY; FY2026 labeled
> partial; existing FY-aggregate outputs unchanged or superseded with lineage"

- Reconciliation: `OFR-AWARD-ROW-FLOOR`, `OFR-AWARD-CONTROL-<state>-<listing>`,
  `OFR-AWARD-SAMPLE-<awardKey>` all PASS on the current run (see evidence file).
- Existing FY-aggregate outputs (`ky-usaspending-latest-complete-fy` /
  `-current-partial-fy`, `dso_federal_award_context`) are untouched — same
  values, same table, same export keys.

### Gaps recorded (not fabricated)

| Gap | State/listing | Reason |
|---|---|---|
| No award-grain records | KY, 93.777 (State Survey and Certification) | USAspending `spending_by_award` returned zero results for this listing/state/FY2023–FY2026 window via both location filters. |
| No award-grain records | FL, 93.777 | Same as above. |
| No award-grain records | FL, 93.791 (Money Follows the Person) | Zero results via both filters in this window (KY had one record, found only via `recipient_locations`). |

None of these are treated as blocked/RESTRICTED sources — they are an honest
absence of award-grain rows for that state/listing/window at the time of this
run, re-probed on every refresh per the Most Recent Available Bind rule.

### Deviations from the plan, with reasons

1. **Assistance-listing selection beyond the required four.** The plan says
   "add SAMHSA/HRSA listings that fund Medicaid-adjacent capacity" without
   naming them. Selected 93.224 (HRSA Health Center Program), 93.958
   (SAMHSA Community Mental Health Services Block Grant), and 93.959 (SAMHSA
   Substance Abuse Prevention and Treatment Block Grant) as the most directly
   Medicaid-adjacent-capacity HRSA/SAMHSA listings. Documented here and in the
   catalogue for Director review; easy to extend the `ofrAssistanceListings`
   array in `xenodroid-bw/src/config.ts` if a different set is preferred.
2. **"Federal funding cliff calendar" UI slice scope.** Read as a signal
   inside the existing Trend & Budget Planning goal category (per the plan's
   own Signal Portfolio table), not a new standalone Evidence Room — the plan
   reserves the new Evidence Room for OFR-08. If the Director intends a
   dedicated room sooner, that is a scope change, not a defect.
3. **Isolated-rendered UI evidence pending.** The `mcp Claude_Browser
   preview_start` launcher failed against this repo's nested working-directory
   layout (`'C:\Program' is not recognized...`, an npm/path-quoting issue in
   the preview launcher, not application code) after a `.claude/launch.json`
   was added at the DecisionPro root. OFR-01's own exit gate does not require
   rendering evidence (it is a reconciliation gate), so this did not block the
   package; recorded as `pending-rendered-gate` and deferred to the OFR-08/09
   rendering pass, where it will be retried (and the launch.json path issue
   investigated) before the final acceptance screenshots are taken.
4. **Push/no-push instruction conflict.** The kickoff prompt's hard boundary
   #9 says "Do NOT push to GitHub, publish to gh-pages, or deploy to the demo
   site — release remains a Director action after review," but the outer
   chat message ends with "push to GH but do not deploy to the online demo."
   Per the kickoff prompt's own framing ("hard boundaries... override speed
   and completeness"), commits are being made locally only; **no push has
   been made**. This conflict should be resolved explicitly by the Director
   before any push happens.

## Verification commands (repo root: `dev/local repo`)

```powershell
npm run test
npm run build
npm run harness:verify
npm run bw:gate
```

All four are green as of this document's last update.

## Director's visual acceptance pass (pending)

Not yet available — the dev-server preview launcher issue above needs a fix or
a different verification path before a rendered `?state=KY` / `?state=FL`
walkthrough of the new Trend & Budget Planning signal can be captured. In the
meantime, `npm run dev` from `dev/local repo` and opening
`http://localhost:5040/?state=KY` (or `?state=FL`) locally will show the new
case under Trend & Budget Planning → the federal award-cliff case.
