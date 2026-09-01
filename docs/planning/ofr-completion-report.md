# OFR completion report

**Status as of 2026-08-31 (final document — OFR-00 through OFR-09 complete):**
All ten packages implemented and gate-green. **A security incident occurred
and was resolved during OFR-02, and a critical state-scoping bug occurred and
was resolved during OFR-04 — see "Security incident (OFR-02)" and "OFR-04
detail" below; read both before relying on any figure quoted earlier in this
document's history.** See "OFR-09 detail" at the end of this document for the
final acceptance sweep, the consolidated Gap registry, and resolution of the
push/no-push instruction conflict.

This is the Director's acceptance and audit record for the Organization
Funding & Resilience Intelligence (OFR) work package, executed per
`docs/planning/ofr-kickoff-prompt.md` against
`docs/planning/organization-funding-resilience-intelligence-plan.md`.

## Per-package status

| Package | Status | Notes |
|---|---|---|
| OFR-00 — Baseline checkpoint | **Implemented** | `npm run test` (216/216), `npm run build`, `npm run harness:verify`, `npm run bw:gate` all green before any OFR code changed. Evidence: `docs/evidence/harness-workbench/headless/ofr-00-baseline/baseline-verification.json`. Commit: `chore: OFR-00 baseline checkpoint`. |
| OFR-01 — USAspending award grain | **Implemented** | State-neutral (KY+FL, one molecule, no fork) award/recipient-grain adapter for 7 assistance listings. See detail below. Evidence: `docs/evidence/harness-workbench/headless/ofr-01-award-grain/verification.json`. |
| OFR-02 — Identity crosswalk spine | **Implemented** | State-neutral (KY+FL) crosswalk spine across 5 sources. See detail below. Evidence: `docs/evidence/harness-workbench/headless/ofr-02-crosswalk/verification.json`. **A security incident occurred and was resolved during this package — see below.** |
| OFR-03 — IRS 990 org financials | **Implemented** | State-neutral (KY+FL) Form 990 financial-resilience ratios filtered to the OFR-02 crosswalked EIN universe. See detail below. Evidence: `docs/evidence/harness-workbench/headless/ofr-03-nonprofit-financials/verification.json`. |
| OFR-04 — Facility financial distress (HCRIS) | **Implemented** | State-neutral (KY+FL) CMS Hospital+SNF cost-report ingestion. A critical state-scoping bug was found and fixed during this package (see detail below) — read before relying on early exploratory numbers quoted elsewhere. Evidence: `docs/evidence/harness-workbench/headless/ofr-04-facility-distress/verification.json`. |
| OFR-05 — Ownership & control network | **Implemented** | State-neutral (KY+FL) CMS ownership network, Hospital+SNF, matched to OFR-04's facility universe. See detail below. Evidence: `docs/evidence/harness-workbench/headless/ofr-05-ownership-network/verification.json`. |
| OFR-06 — Sub-award flow graph | **Implemented** | State-neutral (KY+FL) sub-award graph built from the OFR-01 prime-award universe, identity-resolved via OFR-02. See detail below. Evidence: `docs/evidence/harness-workbench/headless/ofr-06-subaward-flow-graph/verification.json`. |
| OFR-07 — Waiver & grant horizon watch | **Implemented** | State-neutral (KY+FL) `program_horizon_event` from two source lanes: CMS 1115 demonstration pages (KY TEAMKY, FL MMA) and the live Grants.gov search2 API. See detail below. Evidence: `docs/evidence/harness-workbench/headless/ofr-07-program-horizon-events/verification.json`. |
| OFR-08 — Funding & Resilience Evidence Room + Operational Intelligence integration | **Implemented** (with one documented deviation and one documented gap — see detail below) | New state-neutral (KY+FL) Funding & Resilience Evidence Room; two new goal-category signals; a real data-quality fix to Authoritative Sources load status. See detail below. Evidence: `docs/evidence/harness-workbench/headless/ofr-08-funding-resilience-room/` and `docs/evidence/harness-workbench/isolated-rendered/ofr-08-funding-resilience-room/`. |
| OFR-09 — Acceptance, evidence, and completion report | **Implemented** | Final acceptance sweep across all packages; a second instance of the OFR-08 Authoritative Sources load-status bug found and fixed in `dataSpectrum.js`; consolidated Gap registry; push/no-push conflict resolved. See detail below. |

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
3. **Isolated-rendered UI evidence pending — resolved in OFR-08.** The `mcp
   Claude_Browser preview_start` launcher failed against this repo's nested
   working-directory layout (`'C:\Program' is not recognized...`, an
   npm/path-quoting issue in the preview launcher itself, not application
   code) after a `.claude/launch.json` was added at the DecisionPro root.
   OFR-01's own exit gate does not require rendering evidence (it is a
   reconciliation gate), so this did not block the package; recorded as
   `pending-rendered-gate` at the time. Root cause was never fixed in the
   launcher config (still fails the same way), but a working alternative was
   found in OFR-08: an already-running `npm run dev` instance on port 5040
   was navigated to directly via the Browser pane's `navigate` action,
   bypassing the broken `preview_start` launcher while still using the same
   isolated Browser pane tool (never the Director's visible desktop). See
   `docs/evidence/harness-workbench/isolated-rendered/ofr-08-funding-resilience-room/verification.json`
   for the resulting `isolated-rendered` evidence.
4. **Push/no-push instruction conflict.** The kickoff prompt's hard boundary
   #9 says "Do NOT push to GitHub, publish to gh-pages, or deploy to the demo
   site — release remains a Director action after review," but the outer
   chat message ends with "push to GH but do not deploy to the online demo."
   Per the kickoff prompt's own framing ("hard boundaries... override speed
   and completeness"), commits are being made locally only; **no push has
   been made**. This conflict should be resolved explicitly by the Director
   before any push happens.

## OFR-02 detail

**What was built:**

- `xenodroid-bw/src/atoms/OrgNameMatching.ts` — name/address normalization,
  blocking-key generation (so matching never runs the full cross product
  against 113k+ IRS EO BMF rows), and Jaccard token-set similarity.
- `xenodroid-bw/sql/006_ofr_identity_crosswalk.sql` — `dso_identity_record`
  (single-source identity facts) plus `organization_crosswalk_exact` and
  `organization_crosswalk_inferred` as **structurally separate tables** with
  method-specific `CHECK` constraints (not just an export-time filter), and
  `organization_crosswalk_disagreement`.
- `xenodroid-bw/src/molecules/RetrieveAndLoadOrganizationCrosswalk.ts` — one
  state-neutral molecule looping `['KY','FL']` internally. Seeds identity
  records from USAspending recipient-profile lookups (keyed by
  `recipient_id`, since the award-grain `recipient_uei` field OFR-01 requests
  is empty for these state-agency block-grant awards — a second live-verified
  finding), SAM.gov (primary UEI/name authority, key-gated with a graceful
  degrade path), IRS EO BMF state CSVs, CMS Provider Data, and bounded NPPES
  wildcard lookups. Computes exact-derived/inferred matches via blocked
  pairwise name+address comparison, plus SAM-vs-USAspending name
  disagreements (never auto-resolved).
- `xenodroid-bw/src/molecules/CheckOrganizationCrosswalkNumbers.ts` — Source
  Reconciliation: structural exact/inferred separation, an identity-record
  row-count floor, a disagreement-queue integrity check, and a sampled
  exact-derived assertion re-verified either against a live CMS Provider Data
  re-fetch (CCN-anchored) or, when no CCN-anchored assertion exists this run,
  against a re-read and re-parse of the retained, content-hashed IRS EO BMF
  PSA bytes (EIN-anchored fallback) — both are real, working paths, not a
  silent no-op.
- `xenodroid-bw/src/molecules/ExportOrganizationCrosswalkForUi.ts` — writes
  `wireframe V1/app/src/data/alp/organizationCrosswalk.js`, state-keyed, with
  the exact/inferred collections kept separate in the export shape itself.
- Catalogue: added `SAM_ENTITY`, `IRS_EO_BMF`, `NPPES` to
  `seedCatalog.ts` and `ky-medicaid-source-catalogue.md`.
- New "Strengthen exclusion and identity screening with a governed
  crosswalk" case added to the existing **Protect Program Integrity** goal in
  both `operationalGoals.js` (KY) and `flOperationalGoals.js` (FL).
- New test: `wireframe V1/app/src/lib/organizationCrosswalk.test.js` —
  structural separation, no-confirmed-identity language, no-adverse-
  conclusion language, open disagreement queue, reconciliation
  `claimAllowed === true`, grounding-correction text present.

**Grounding corrections, verified live 2026-08-31** (both are documented in
`docs/planning/real-data-hydration-plan.md` and the SQL file's own comments,
not just here):

1. Neither the SAM.gov Entity Management API (even with the Director-
   provisioned key) nor USAspending exposes EIN/TIN — confirmed by a live
   full-section SAM entity lookup and a live USAspending recipient-profile
   fetch, both returning no `ein`/`tin`/`taxIdentification` field anywhere.
   The amended plan's `SAM_ENTITY` row assumed `exact-published` UEI↔EIN
   assertions from SAM; that specific claim does not hold at this API tier.
   The crosswalk design was adjusted accordingly: every UEI↔EIN link is a
   computed `exact-derived` (name+ZIP match) or `inferred` assertion, never
   `exact-published`, except the one genuine same-record fact available —
   NPPES publishing NPI + an embedded state Medicaid provider ID together.
2. OFR-01's `dso_federal_award.recipient_uei` field is empty for every row
   (USAspending does not populate it for the large state-agency block-grant
   awards this package loads). OFR-02 works around this by resolving UEI via
   the USAspending recipient-profile endpoint (`/api/v2/recipient/{recipient_id}/`),
   keyed by the `recipient_id` field, which OFR-01 does populate. Not a defect
   in OFR-01 — `recipient_uei` was requested and simply isn't returned by the
   API for this award shape; this is a documented, worked-around gap, not a
   silent substitution.

### OFR-02 exit gate — status: **green**

> "No inferred match ever presented as identity; sampled exact matches verify
> against published source pairs; SAM-vs-USAspending disagreement queue
> exported; crosswalk coverage stats exported with method breakdown"

- Structural separation: `OFR-XWALK-EXACT-SEPARATION` and
  `OFR-XWALK-INFERRED-SEPARATION` both PASS (0 violations, and the SQL
  `CHECK` constraints make a violation impossible to insert in the first
  place, not just impossible to pass unnoticed).
- Sampled exact-derived assertion re-verified against a freshly re-read,
  content-hashed published source file: `OFR-XWALK-SAMPLE-XW-EX-FL-1` PASS,
  exact 1.00 name similarity and exact ZIP match.
- Disagreement queue exported (`disagreementQueue` per state in
  `organizationCrosswalk.js`); 0 entries this run because SAM contributed 0
  identity records this run (see the rate-limit gap below) — the
  computation path itself is covered by
  `OFR-XWALK-DISAGREEMENTS-NOT-AUTO-RESOLVED`.
- Coverage stats with method breakdown exported per state
  (`methodBreakdown.exactPublished` / `.exactDerived` / `.inferred`).

**Real numbers this run:** 137,387 identity records (KY+FL); 191 exact
assertions (110 exact-published NPI↔state-Medicaid-ID, 68 exact-derived
UEI↔EIN, 11 exact-derived EIN↔NPI, 2 exact-derived UEI↔NPI); 208 inferred
assertions; 0 disagreements (SAM gap, see below).

### Gaps recorded (not fabricated)

| Gap | State | Reason |
|---|---|---|
| `GAP-SAM-ENTITY-KY` | KY | SAM.gov returned HTTP 429 on the first lookup attempt of the run; degraded to the USAspending-seeded identity path per the plan's documented fallback. |
| `GAP-SAM-ENTITY-FL` | FL | Same. |

SAM.gov's public-tier rate limit proved stricter in practice than expected —
repeated 429s occurred even at 3–5 second inter-request pacing, including on
the very first call of a fresh run, across multiple runs in this session.
This is consistent with a short-window burst quota already consumed by this
session's own repeated debugging runs, not a sustained per-request rate
problem. The adapter's fallback worked exactly as designed: the run still
succeeded, reconciliation still passed, and an honest gap was recorded rather
than fabricating SAM data or retrying indefinitely against a publisher's
rate limit. **Re-running `npm run bw:gate` with the key on a later day should
populate SAM identity records and any real disagreements without further
code changes.**

### Security incident (OFR-02) — resolved

While debugging the SAM.gov 429s above, `GovernedHttpClient`'s error
messages embedded the full request URL — including the `api_key` query
parameter — into Gap reason text. A debug script's Gap array was displayed to
the Director via a terminal `cat` of its output file, and **the SAM.gov API
key appeared in plaintext in the conversation transcript twice.**

Verified extent:
- **Not present** in any repository file (`git grep` across tracked and
  untracked files: 0 matches), any Postgres row (`load_history.notes`,
  `dso_identity_record.extra_json`: 0 matches), or any exported UI artifact
  (the export molecule never reads the Gaps array).
- **Present** in this session's conversation transcript (twice) and in one
  temporary scratchpad log file, which was deleted immediately on discovery.

Fix: `xenodroid-bw/src/atoms/GovernedHttpClient.ts` now exports
`RedactCredentialedUri`, stripping `api_key`/`apikey`/`key`/`token`/
`access_token` query parameters from any URL — whole-string or embedded
inside arbitrary error text — before it can reach a thrown error, a Gap
reason, a log line, or an export. Applied at every error-throw site and the
`finalUri` return in `FetchJson`. A regression test is wired into
`npm run bw:test` (`xenodroid-bw/src/cli.ts` `cmdTestOffline`) asserting
redaction on both a full URL and a URL embedded in error text — this now
runs on every `bw:gate`/`bw:test` invocation going forward, for every future
OFR adapter that reuses `GovernedHttpClient` with a credentialed source.

The full gate was re-run after the fix with output redirected to a local
file and grepped for `api_key` before any of it was displayed — 0 matches,
gate passed cleanly (see `docs/evidence/harness-workbench/headless/ofr-02-crosswalk/verification.json`).

**Recommendation for the Director:** rotate the SAM.gov key out of caution.
It never touched any persisted repo, database, or export artifact, but it did
appear in this session's conversation transcript, which is outside this
package's control to purge.

## OFR-03 detail

**What was built:**

- Added `adm-zip` (small, pure-JS, no native deps) to `xenodroid-bw` to
  extract the IRS SOI extract's single-entry ZIP files — the first new
  runtime dependency this OFR run has needed.
- `xenodroid-bw/sql/007_ofr_nonprofit_financials.sql` — `dso_nonprofit_filing`
  (org × tax-period × vintage grain) and `cube_nonprofit_resilience_metric`
  (per-state summary metrics), additive to the frozen schema baseline.
- `xenodroid-bw/src/molecules/RetrieveAndLoadNonprofitFinancials.ts` —
  downloads both posting-year vintages (24, 23) of the national IRS Form 990
  SOI extract (~345,000 rows each), filters to only the EINs already
  identity-resolved to KY or FL by the OFR-02 crosswalk (not a national
  landing — "990 extract rows for crosswalked orgs" per the plan), lands the
  extracted CSV bytes to PSA with a hash, and computes per-state liquidity,
  contribution-dependency, and admin-expense-share resilience metrics.
- `xenodroid-bw/src/molecules/CheckNonprofitFinancialsNumbers.ts` — Source
  Reconciliation: row-count floor, vintage/form-type presence on every fact,
  a structural no-person-level-column check, and a sampled filing row
  re-verified by a live re-fetch and re-extract of the IRS ZIP (real match
  this run: total_revenue $110,674 stored, $110,674 live).
- `xenodroid-bw/src/molecules/ExportNonprofitFinancialsForUi.ts` — writes
  `wireframe V1/app/src/data/alp/nonprofitFinancials.js`, state-keyed, with a
  bounded (15-per-state) lowest-liquidity review-candidate list.
- Catalogue: added `IRS_990_EXTRACT` to `seedCatalog.ts` and
  `ky-medicaid-source-catalogue.md`.
- New "Review nonprofit financial-resilience signals from IRS Form 990
  filings" case added to the existing **Trend & Budget Planning** goal in
  both `operationalGoals.js` (KY) and `flOperationalGoals.js` (FL), each
  with two actions (low-liquidity review; cross-reference against the OFR-01
  award-cliff calendar).
- New test: `wireframe V1/app/src/lib/nonprofitFinancials.test.js` —
  state-neutrality, organization-level-only content, honest limitation
  labeling, no-adverse-conclusion language, bounded/reproducible
  review-candidate lists, reconciliation `claimAllowed === true`.

**Grounding corrections, verified by direct inspection of the extract's own
column header 2026-08-31** (documented in
`docs/planning/real-data-hydration-plan.md`, the SQL file's comments, and the
export payload itself, not just here):

1. The SOI summary extract does not carry a government-specific
   grant-revenue field — Form 990 Part VIII Line 1e (government grants) is
   not broken out from total Line 1h contributions/gifts/grants. The plan's
   "government-grant dependency" ratio is therefore computed and labeled as
   **contribution-and-grant revenue dependency**, not government-specific.
2. The extract does not carry the Form 990 Part IX (B)/(C)/(D)
   program/management/fundraising functional-expense column split — only a
   Total column plus named line items. "Program-vs-admin expense trend" is
   therefore computed and labeled as a **named-administrative-category
   expense share** (management/legal/accounting/lobbying/investment-
   management fees + office expenses, over total functional expenses) — a
   proxy, not the official Part IX allocation.
3. **Scope boundary, not a gap:** this package ingests Form 990 only, not
   990-EZ or 990-PF — the dominant return for the Medicaid-adjacent
   nonprofit population (community health centers, behavioral-health
   providers) this product targets.

### Two real bugs found and fixed during this package

1. **`INSERT has more target columns than expressions`** — the batch-insert
   placeholder template referenced 12 numbered positions but 13 values were
   pushed per row, silently dropping `org_name` from the parameter list.
   Fixed by aligning `COLUMNS_PER_ROW` to the actual push count.
2. **Vintage schema drift** — live-verified that the 24-vintage extract's
   header uses `"EIN"` (uppercase) while the 23-vintage extract uses
   `"ein"` (lowercase) and additionally carries a leading UTF-8 BOM that the
   24-vintage file does not have. The parser now strips a leading BOM and
   does case-insensitive header lookup, so a future vintage's casing or
   encoding quirks do not silently break ingestion again.

Both were caught by actually running the gate against live data and reading
the real error, not assumed away — consistent with the "never fabricate...
a red gate with an honest Gap beats a fake green" instruction.

### OFR-03 exit gate — status: **green**

> "Ratios reproducible from retained extract rows; zero person-level fields
> in any export; filing vintage and form type on every fact"

- `OFR-990-ROW-FLOOR` PASS (38,633 filing rows, KY+FL, both vintages).
- `OFR-990-VINTAGE-FORM-PRESENT` PASS (0 rows missing vintage or form type).
- `OFR-990-NO-PERSON-LEVEL-COLUMNS` PASS (structural `information_schema`
  check — 0 officer/donor/DOB/SSN columns on `dso_nonprofit_filing`).
- `OFR-990-SAMPLE-<ein>-<period>` PASS — a sampled filing's `total_revenue`
  reproduced exactly against a fresh live re-fetch and re-extract of the IRS
  ZIP.

**Real numbers this run:** 38,633 crosswalked KY+FL Form 990 filing rows
across both vintages (filtered from ~345,000 national rows per vintage); 12
resilience metrics computed. Sample KY figures: median liquidity ~6.6 months
of unrestricted net assets, median contribution/grant dependency ~42.5%,
median named-administrative-category expense share ~2.9%.

## OFR-04 detail

**What was built:**

- `xenodroid-bw/sql/008_ofr_facility_financial_distress.sql` —
  `dso_facility_cost_report` (CCN × facility-type × report-year grain),
  `cube_facility_distress_metric` (state summary), and
  `dso_county_facility_rollup` (county-level closure-risk watchlist inputs).
- `xenodroid-bw/src/molecules/RetrieveAndLoadFacilityFinancialDistress.ts` —
  one state-neutral pass over both `data.cms.gov` HCRIS datasets (Hospital
  Provider Cost Report, Skilled Nursing Facility Cost Report), computing
  total margin, Medicaid patient-day share, uncompensated care, and
  county-level negative-margin rollups for KY and FL.
- `xenodroid-bw/src/molecules/CheckFacilityDistressNumbers.ts` — Source
  Reconciliation: row-count floor and a sampled facility-year re-verified
  against a freshly re-fetched CMS API row (real match this run: total_costs
  $913,264,290 stored, $913,264,290 live).
- `xenodroid-bw/src/molecules/ExportFacilityDistressForUi.ts` — writes
  `wireframe V1/app/src/data/alp/facilityFinancialDistress.js`, state-keyed,
  with a bounded (15-per-state) negative-margin watchlist and county
  rollups. Florida's slice explicitly cites `GAP-FL-F-14-PARAMETERS` (the
  AHCA hospital-financial KPI export's own publisher-side parameter block)
  so this federal layer is never mistaken for a replacement of Florida's
  blocked state source — this satisfies the exit gate's explicit
  requirement to annotate, not silently replace, that gap.
- Catalogue: added `CMS_HCRIS` to `seedCatalog.ts` and
  `ky-medicaid-source-catalogue.md`.
- New "Review county-level facility financial-distress signals from CMS
  cost reports" case added to the existing **Improve Coverage & Access**
  goal in both `operationalGoals.js` (KY) and `flOperationalGoals.js` (FL).
- New test: `wireframe V1/app/src/lib/facilityFinancialDistress.test.js` —
  state-neutrality, Medicare-cost-report-basis labeling on every value, the
  Florida gap-annotation requirement, no-adverse-conclusion language,
  bounded/reproducible watchlists, reconciliation `claimAllowed === true`.

### Critical bug found and fixed: silent state-scoping failure

The CMS `data-api/v1` filter query used operator value `"=="` (following a
third-party API-guide example). This specific endpoint requires a single
`"="` for equality; an unrecognized operator value does not error — it
**silently drops the filter and returns unfiltered national data**. The
adapter's row-count-floor check "passed" with 7,926 rows where roughly 1,400
were expected; querying the database directly showed cost-report rows for
every US state (AK through WI), not just KY and FL, each landed twice (once
per state-iteration of the broken "filtered" call).

**Verified blast radius:** the polluted national data never reached any
export or UI surface — `ExportFacilityDistressForUi.ts` filters rows by each
row's own CMS-reported `state_code` field (accurate regardless of the
broken request filter), so no cross-state leakage occurred in any
user-facing output at any point. The bug was confined to unnecessary volume
in the DSO table and would have made the row-count-floor check technically
pass for the wrong reason.

**Fix:** corrected the operator to `"="` in both the retrieval molecule and
the accuracy check, purged and reloaded (now correctly 1,336 KY+FL rows,
verified by a direct query showing only `{FL, KY}` as distinct
`state_code` values), and added a **defense-in-depth assertion** — the
adapter now throws immediately if any row in a "state-filtered" response
carries a different state than requested, so this exact silent-failure mode
cannot recur even if a future CMS API change reintroduces it.

This is exactly the class of bug the "no-fake-green" instruction anticipates:
a reconciliation check passed, but for the wrong reason, because the check
itself (row-count floor) wasn't strict enough to catch scope pollution. It
was caught only by manually inspecting the actual row count against a
hand-derived expectation and querying the database directly rather than
trusting the gate's PASS at face value — worth keeping in mind for any
future review of this report's earlier packages' numbers too.

### OFR-04 exit gate — status: **green** (after the fix above)

> "Sampled facility rows reconcile to the published dataset; every UI value
> labeled Medicare-cost-report basis; FL AHCA hospital-financial Gap
> annotated with this federal fallback layer, not silently replaced"

- `OFR-HCRIS-ROW-FLOOR` PASS (1,336 facility-year rows, KY+FL, hospital+SNF,
  verified state-pure post-fix).
- `OFR-HCRIS-SAMPLE-<ccn>` PASS — sampled facility's `total_costs`
  reproduced exactly against a fresh live re-fetch.
- Every exported state slice carries `basisNote` stating Medicare
  cost-report basis, not Medicaid payment truth.
- Florida's slice carries `floridaFallbackNote` citing
  `GAP-FL-F-14-PARAMETERS` explicitly; Kentucky's is `null` (no equivalent
  gap exists for Kentucky, so nothing to annotate there).

**Real numbers this run:** 1,336 crosswalked-scope KY+FL hospital/SNF
facility-year cost-report rows (both facility types, most recent posted
fiscal years); 12 state-summary resilience metrics; county rollups covering
roughly 120 counties across both states.

## OFR-05 detail

**What was built:**

- `xenodroid-bw/sql/009_ofr_ownership_network.sql` — `dso_ownership_interest`
  (organization-level owner facts only — no name/DOB/address column exists
  on the schema at all), `dso_ownership_chain_rollup`, and
  `cube_ownership_metric`.
- `xenodroid-bw/src/molecules/RetrieveAndLoadOwnershipNetwork.ts` —
  paginates (offset-based, 6,500-row pages) CMS's Hospital + SNF "All
  Owners" PUFs, matches each row's facility name against the OFR-04 KY+FL
  facility universe by exact normalized name, and reads only
  organization-level owner facts into the warehouse — individual owners are
  represented solely by an `owner_type='individual'` flag with an empty
  `owner_organization_name`, never a name. The full raw national file is
  retained in PSA with a content hash.
- `xenodroid-bw/src/molecules/CheckOwnershipNetworkNumbers.ts` — Source
  Reconciliation: row-count floor, a structural
  `information_schema.columns` scan asserting zero name/address/DOB/SSN-
  shaped columns exist on the table, and an assertion that zero
  individual-owner rows carry a non-empty organization name.
- `xenodroid-bw/src/molecules/ExportOwnershipNetworkForUi.ts` — writes
  `wireframe V1/app/src/data/alp/ownershipNetwork.js`, state-keyed, with a
  bounded (20-per-state) common-ownership chain list joined to OFR-04 bed
  and margin context.
- Catalogue: added `CMS_OWNERSHIP` to `seedCatalog.ts` and
  `ky-medicaid-source-catalogue.md`.
- New "Review common-ownership chains and recent ownership changes" case
  added to the existing **Protect Program Integrity** goal in both
  `operationalGoals.js` (KY) and `flOperationalGoals.js` (FL).
- New test: `wireframe V1/app/src/lib/ownershipNetwork.test.js` —
  state-neutrality, no individual-owner identity anywhere in the payload,
  no-adverse-conclusion language, bounded/reproducible chain list,
  reconciliation `claimAllowed === true`.

**Real numbers this run:** 2,525 organization-level ownership-interest rows
loaded across 154 matched KY+FL hospital and SNF facilities; 55
multi-facility common-ownership chains identified; 4 state-summary metrics.

### Documented scope boundaries (not gaps)

1. **Hospital + SNF only.** Hospice and Home Health Agency ownership PUFs
   exist and were inspected, but this package does not ingest them — there
   is no existing KY/FL facility-name base table (equivalent to OFR-04's
   `dso_facility_cost_report`) to scope them against without adding a new
   CCN source, which would expand this package's footprint materially.
   Recorded as a paid-follow-on candidate in the catalogue.
2. **Exact-match only, no fuzzy matching.** Unlike OFR-02's crosswalk, this
   package matches CMS ownership records to OFR-04 facilities by exact
   normalized name only. Because this signal feeds a program-integrity-
   adjacent goal, a conservative lower-bound match (missing some real
   matches) was chosen over a fuzzy match (risking a false ownership link
   in a sensitive context).
3. **No live-sample reconciliation check.** OFR-01 through OFR-04 each
   include a check that re-fetches one sampled row live and compares it to
   the stored value. OFR-05 does not, because the underlying CMS datasets
   require offset-paginated fetches (6,500-row pages) that make a
   single-sample re-verification comparatively costly relative to the
   incremental assurance it would add given the three structural/volume
   checks already in place (row floor, zero person-level columns, zero
   individual rows carrying an organization name). Recorded explicitly here
   rather than silently omitted, per the no-fake-green instruction's spirit
   — this is an honest scope decision, not a hidden shortcut.

### OFR-05 exit gate — status: **green**

> "Chain rollups reproducible; owner-person detail confined to PSA; every
> ownership signal labeled review candidate, never adverse finding"

- Chain rollups are deterministically recomputed from retained DSO rows on
  every export — reproducible by construction, not by a sampled check.
- `OFR-OWNERSHIP-NO-PERSON-LEVEL-COLUMNS` PASS: structurally, no
  individual-owner detail can exist outside PSA (the column doesn't exist).
- Every exported chain and metric carries language stating common ownership
  or a recent association is a review candidate, never itself a finding —
  verified by the frontend test's language assertions.

## OFR-06 detail

**What was built:**

- `xenodroid-bw/sql/010_ofr_subaward_flow_graph.sql` —
  `dso_federal_subaward`, `dso_funding_edge` (with a SQL `CHECK` constraint
  limiting `identity_confidence` to `exact-derived`/`unresolved`), and
  `cube_subaward_metric`. No new `FromSysID` — still `USA_SPENDING`.
- `xenodroid-bw/src/molecules/RetrieveAndLoadSubawardFlowGraph.ts` — queries
  USAspending's subawards API for every one of the 442 KY+FL prime awards
  already loaded by OFR-01 (keyed by `award_key`, the
  `generated_internal_id` format the subawards endpoint actually requires —
  the plain display "Award ID" code does not work, discovered by live
  testing). Every resulting sub-recipient name is matched against OFR-02's
  EIN-bearing identity records by exact normalized name; a match earns
  `exact-derived` confidence, no match stays `unresolved` — never silently
  promoted.
- `xenodroid-bw/src/molecules/CheckSubawardFlowGraphNumbers.ts` — Source
  Reconciliation: structural confidence-label validation, an assertion that
  no unresolved edge carries an identity value, and a sampled subaward
  re-verified against a fresh live re-fetch.
- `xenodroid-bw/src/molecules/ExportSubawardFlowGraphForUi.ts` — writes
  `wireframe V1/app/src/data/alp/subawardFlowGraph.js`, state-keyed, with a
  bounded (25-per-state) funding-edge list, every edge carrying its
  identity-confidence label.
- Catalogue: extended the existing `USA_SPENDING` entry rather than adding a
  new `FromSysID`.
- New "Review sub-award funding concentration and program overlap" case
  added to the existing **Trend & Budget Planning** goal in both
  `operationalGoals.js` (KY) and `flOperationalGoals.js` (FL).
- New test: `wireframe V1/app/src/lib/subawardFlowGraph.test.js` —
  state-neutrality, every edge labeled exact-derived or unresolved (never an
  identity value on an unresolved edge), no-adverse-conclusion language,
  bounded edge list, reconciliation `claimAllowed === true`.

**Real numbers this run:** 442 prime awards queried; 1,197 sub-award funding
edges loaded for Kentucky alone (comparable volume for Florida); 419 of
Kentucky's edges identity-resolved via the OFR-02 crosswalk (35%); top
identity-resolved recipient concentration 25.4%; 17 Kentucky sub-recipients
funded under more than one OFR-tracked assistance listing (program-overlap
review candidates).

### OFR-06 exit gate — status: **green**

> "Edges only between crosswalk-reconciled identities or explicitly labeled
> unresolved; concentration metrics carry identity-confidence caveats"

- `OFR-SUBAWARD-CONFIDENCE-LABELED` PASS: every edge carries exactly
  `exact-derived` or `unresolved`, structurally enforced by a SQL `CHECK`
  constraint, not just an application-level filter.
- `OFR-SUBAWARD-UNRESOLVED-CARRIES-NO-EIN` PASS: zero unresolved edges carry
  any identity value.
- The concentration metric is computed only over `exact-derived` edges, and
  the exported payload's `identityConfidenceNote` states this caveat
  explicitly wherever the metric is shown.

## OFR-07 detail

**What was built:**

- `xenodroid-bw/src/atoms/GovernedHttpClient.ts` — added `FetchText()`
  alongside the existing `FetchJson()`, for the non-JSON CMS demonstration
  page fetch, with the same throttling/backoff/UA/credential-redaction
  discipline.
- `xenodroid-bw/src/atoms/ParseCmsDemonstrationPage.ts` — a new parsing atom.
  CMS publishes **no structured API** for Section 1115 demonstration
  approval periods; the demonstration page itself (verified live,
  2026-08-31) is the source of record. Every KY TEAMKY and FL MMA
  demonstration page carries a stable "Waiver Dates" block (Approval /
  Effective / Expiration, each followed by an `MM/DD/YYYY` line) and a
  "Supporting Documents" table (posted date + title). The parser fails
  loudly (throws) if either landmark is missing, rather than silently
  returning wrong or empty dates — verified against both real fetched pages
  before being wired into the molecule.
- `xenodroid-bw/sql/011_ofr_program_horizon_events.sql` —
  `dso_program_horizon_event` (with SQL `CHECK` constraints on `event_type`,
  `scope`, and `event_date_kind`) and `cube_program_horizon_metric`.
- `xenodroid-bw/src/molecules/RetrieveAndLoadProgramHorizonEvents.ts` — two
  source lanes:
  - **CMS_1115_DEMO** (new `FromSysID`): fetches the two named demonstration
    pages (KY TEAMKY, FL MMA — the only two demonstrations named in the
    plan), parses the expiration date into one `waiver_expiration` event and
    up to 6 recently posted documents into `waiver_milestone` events, each
    `scope='state'`.
  - **GRANTS_GOV** (new `FromSysID`): live, unauthenticated Grants.gov
    `search2` API (`https://api.grants.gov/v1/api/search2`), queried once
    per OFR-tracked assistance listing using the `cfda` filter field
    (live-verified: `aln` is silently ignored by this API version and
    returns the unfiltered catalog — `cfda` is the real field name).
    Results are `nofo_opportunity` events with `scope='national'`, attached
    to **both** KY and FL (a Grants.gov opportunity is not KY/FL
    eligibility-verified — never presented as state-targeted).
- `xenodroid-bw/src/molecules/CheckProgramHorizonEventsNumbers.ts` — Source
  Reconciliation: every event must carry a non-empty `source_document_uri`
  and `retrieved_at` (the plan's exit gate, checked structurally); waiver
  events must be `scope='state'` and NOFO events `scope='national'`; no
  status text may contain renewal-outcome-prediction language; a sampled
  waiver expiration date is re-verified against a freshly re-fetched CMS
  demonstration page.
- `xenodroid-bw/src/molecules/ExportProgramHorizonEventsForUi.ts` — writes
  `wireframe V1/app/src/data/alp/programHorizonEvents.js`, state-keyed, with
  a bounded (40-per-state) event list sorted by date.
- Catalogue: two new `FromSysID` entries, `CMS_1115_DEMO` and `GRANTS_GOV`.
- New "Track waiver/demonstration expirations and open federal grant
  opportunities" case added to the existing **Trend & Budget Planning** goal
  in both `operationalGoals.js` (KY) and `flOperationalGoals.js` (FL).
- New test: `wireframe V1/app/src/lib/programHorizonEvents.test.js` —
  state-neutrality, every event cites a source document and retrieval date,
  type/scope/date-kind labeling, at least one expiration event per state,
  no renewal-outcome-prediction language, bounded event list, reconciliation
  `claimAllowed === true`.

**Real numbers this run:** 2 demonstration pages fetched (KY TEAMKY, FL
MMA); 14 waiver horizon events loaded (2 `waiver_expiration` + 12
`waiver_milestone`, capped at 6 milestones per state); 7 Grants.gov
`search2` queries run (one per OFR-tracked assistance listing); 12
`nofo_opportunity` events loaded (5 real open/forecasted opportunities under
listing 93.224 — HRSA community health center capacity — as of 2026-08-31,
the other six tracked listings currently have zero open/forecasted
opportunities; each hit yields an open-date event and, where published, a
close-date event, doubled across KY+FL). TEAMKY expiration confirmed
`2029-12-31` (approval `2018-01-12`, effective `2019-04-01`); FL MMA
expiration confirmed `2030-06-30` (approval `2005-10-19`, effective
`2006-07-01`) — both live-verified against the CMS demonstration page's own
structured "Waiver Dates" block, not derived from search snippets.

**Documented scope boundary (not a silent omission):** individual state
1915(b)/(c) waiver authorities (KY's six HCBS waivers, FL's iBudget and
related 1915(c)/(b) waivers) are named in the plan under "1915 authorities"
but have **no comparable CMS structured page** — they exist only as
state-agency PDF filings with no systematic index. Hand-transcribing them
would violate the reconciliation/no-fake-green discipline (no way to
re-verify against a live source on every gate run). Recorded as
`GAP-1915-KY` and `GAP-1915-FL` rather than fabricated or hand-curated
without a reconciliation path.

### OFR-07 exit gate — status: **green**

> "Every event cites source document and retrieval date; no renewal outcome
> predicted, only dates and published status"

- `OFR-HORIZON-EVERY-EVENT-CITED` PASS: zero events missing a
  `source_document_uri` or `retrieved_at`.
- `OFR-HORIZON-NO-RENEWAL-OUTCOME-PREDICTED` PASS: zero events whose status
  text predicts a renewal outcome (scanned on every gate run).
- `OFR-HORIZON-SAMPLE-KY-EXPIRATION` PASS: stored TEAMKY expiration date
  matched a freshly re-fetched CMS demonstration page exactly
  (`2029-12-31` both stored and live).

## OFR-08 detail

**Architecture deviation from the plan text (recorded per the standing
instruction to record deviations with reasons):** the plan's acceptance gate
says the new room must pass "the same gates as existing rooms." Investigation
found this is not a single, retrofittable target: Kentucky's 9 existing
Evidence Rooms run on one config-driven ALP cube engine
(`ROOM_CONFIGS`/`AnalyticalListPage.jsx`/`roomCubes.real.js`) whose filter
dimensions (county, MCO, region, population) are Kentucky-specific vocabulary
with zero state-awareness anywhere in the engine, while Florida's 8 rooms run
on an entirely separate, hand-written `FloridaEvidenceWorkspace` component
that already has **no** real filter/chart/drill-down/lineage/CSV engine of
its own — it only emits the same `data-walkthrough-target` strings so the
generic walkthrough guide fires. Retrofitting state-awareness into the
9-room KY engine to host one new room would be a large, high-blast-radius
change touching every existing room's dimension model; it was out of
proportion to this package and risked destabilizing already-verified,
already-committed KY functionality untouched by OFR-01..07.

Instead, `FundingResilienceRoom.jsx` is a new, dedicated, state-neutral
component that implements the plan's literal feature list for real — filters,
a chart, aggregate summary rows, drill-down, source lineage, and CSV export —
without touching either existing engine, going further than Florida's current
bespoke-room bar (which fakes lineage/CSV/drill-down; this room's versions of
all four are real). It reuses the shared, already-generic glossary and
walkthrough-guide systems (`GlossaryText`, the `evidence-room` page guide,
`resolvePageExplain`) and was additionally wired into the deeper interactive
"Show Me" example-journey system (`ROOM_TASK_EXAMPLES` /
`ROLE_ROOM_REQUESTS` / `ROLE_ROOM_DELIVERABLES` in `walkthroughs.js`, plus a
dedicated `fundingResilienceJourney` in `guideExampleJourneys.js`, since that
system is also ALP-engine-specific and could not reuse `evidenceInvestigationSteps`).

**What was built:**

- `xenodroid-bw/src/molecules/ExportHydrationBundles.ts` — a real backend
  fix, not cosmetic: `authoritativeSources.js`'s `loadStatus` field
  previously only recognized the base M-xxx measure pipeline's loads, so
  every OFR-01..07 `FromSysID` showed `CATALOGUED` even after a fully
  reconciled REAL load (discovered while verifying OFR-08's "Authoritative
  Sources rows for all new FromSysIDs" requirement — the rows already
  existed automatically via the generic `SOURCE_SYSTEMS` export, but their
  status was wrong). Fixed with a generic query against
  `bw_ctl.load_history`/`bw_ctl.data_request` for any `FromSysID` with a
  `SUCCEEDED` `REAL` load, rather than hardcoding a per-source list.
  `SAM_ENTITY` and `NPPES` correctly continue to show `CATALOGUED` this run
  (no SAM.gov key in this session's environment; NPPES found no lookup
  candidates) — an honest reflection of actual run state, not a bug.
- `wireframe V1/app/src/data/alp/fundingResilienceRoom.js` — a new,
  hand-written (not BW-generated) aggregation layer combining all seven
  OFR-01..07 exports into one unified, state-keyed, filterable evidence-item
  list. Introduces no new facts and computes no new figures — every field is
  copied through from an export that already passed its own package-level
  Source Reconciliation check. Keeps OFR-02's exact/inferred identity
  crosswalk assertions as two distinct item types, with every inferred item
  carrying `reviewCandidateOnly: true` — never merged or presented as
  equally confirmed, per the identity gate.
- `wireframe V1/app/src/components/FundingResilienceRoom.jsx` — the room
  component: header, signal-type filter chips, a review-candidate-only
  toggle, a bar chart of row counts by signal type, aggregate summary tiles,
  a filterable row list with click-through drill-down (full detail + source
  citation where the underlying package carries one), a 9-source lineage
  panel (publisher, TOS grade, load status, as-of date), and a CSV export of
  the currently filtered rows. Emits the same four `data-walkthrough-target`
  strings (`alp-analytical-header`/`alp-visual-filters`/`alp-content`/`alp-lineage`)
  the shared `evidence-room` walkthrough guide already targets, plus
  optional `guidedItemType`/`guidedLeadTitleContains` props for the Show Me
  auto-demo (mirroring the `guidedFilters`/`guidedLeadItemId` pattern
  `AnalyticalListPage.jsx` already uses).
- `wireframe V1/app/src/lib/downloadCsv.js` — a small, generic, pure/testable
  CSV-builder plus a Blob-URL download trigger (mirrors the pattern already
  used by `exportLineageWorkbook.js`'s `downloadLineageWorkbook`).
- `wireframe V1/app/src/lib/pageExplains.js` — a dedicated
  `fundingResilienceRoomExplain()` branch in `resolvePageExplain`, since the
  generic `roomExplain()` describes the KY ALP engine specifically (would
  have been factually wrong for this room) and the existing FL-specific
  override block assumes "AHCA public aggregates" framing (also wrong here;
  explicitly exempted).
- `wireframe V1/app/src/data/glossary.js` — 7 new terms for vocabulary this
  room introduces: sub-award, identity crosswalk, HCRIS, Form 990, NOFO,
  Section 1115 demonstration.
- `wireframe V1/app/src/data/walkthroughs.js` and
  `wireframe V1/app/src/data/guideExampleJourneys.js` — full "Show Me"
  interactive-journey coverage for the new room across all 7 roles (this
  system enforces one validated journey per role-tour step with no
  exceptions — `validateGuideExampleFixtures()` — so a stub/skip was not an
  option; a dedicated `fundingResilienceJourney` builder was required since
  the existing builder assumes the ALP cube engine's `listSlice`/dimension
  filters).
- `wireframe V1/app/src/App.jsx`,
  `wireframe V1/app/src/components/EvidenceRooms.jsx`,
  `wireframe V1/app/src/components/FloridaWorkspace.jsx`,
  `wireframe V1/app/src/data/fixtures.js` — navigation wiring: the room is
  registered in both `EVIDENCE_ROOMS` (KY) and `FL_EVIDENCE_ROOMS` (FL) room
  indexes, and `App.jsx`'s `evidence` view intercepts `activeEvidenceId ===
  'funding-resilience'` before the existing KY/FL engine branch, for both
  states, with full guided-state plumbing (`guidedItemType`/
  `guidedLeadTitleContains` added alongside the existing `guidedFilters`
  etc. state machine for Show Me snapshot/restore).
- Two new goal-category signals, closing goal categories that had zero OFR
  signals through OFR-07, using data already loaded (no new backend
  ingestion):
  - **Contract Accountability** (KY) / **Strengthen Plan Accountability**
    (FL): "Track waiver deliverable and monitoring-report milestones," built
    from OFR-07's already-exported `waiver_milestone` events — the plan's
    own "waiver deliverable milestones" language under this goal category.
  - *(Identify Quality Gaps / Provider Integrity's "chain-level
    quality/penalty rollup" was investigated and explicitly deferred — see
    Gap below, not silently dropped.)*
- New tests: `wireframe V1/app/src/lib/fundingResilienceRoom.test.js` (data
  layer: state-neutrality, identity-confidence separation, citation
  completeness, no-adverse-conclusion language, lineage completeness, CSV
  row shape), `wireframe V1/app/src/lib/downloadCsv.test.js` (pure CSV-text
  builder), `wireframe V1/app/src/lib/fundingResilienceRoomDom.test.jsx`
  (walkthrough targets present for both states, 9 lineage cards, filter
  interaction narrows the list, drill-down shows a guardrail, CSV button
  present, no cross-state item-content leakage), and extensions to
  `pageExplains.test.js`, `walkthroughs.test.js`, and
  `guideExampleJourneys.test.js` for the new room's coverage.

**Documented Gap (not a silent omission):** `GAP-CHAIN-QUALITY-ROLLUP` — the
plan's "Identify Quality Gaps" signal ("chain-level quality/penalty rollups
across commonly owned facilities") would need OFR-05's exported ownership
payload to carry facility-level detail per chain (it currently exports only
aggregate `facilityCount`/`totalBeds`/`avgTotalMargin` per owner), joined
against the pre-existing CMS Provider Data low-rating field. That is a real,
bounded, likely-feasible follow-on (extend `ExportOwnershipNetworkForUi.ts`'s
payload, no new source ingestion) but was out of scope for this pass; the
existing OFR-05 "ownership-churn-review" signal (Protect Program
Integrity/Provider Integrity) remains the closest existing coverage for this
goal category's institutional-quality dimension.

**Real numbers this run:** Kentucky — 141 evidence rows across all 10 signal
types (38 flagged review-candidate-only: 25 inferred crosswalk assertions +
13 unresolved sub-award edges). Florida — 169 evidence rows (34 flagged
review-candidate-only). All 9 governed sources present in the lineage panel
for both states; `authoritativeSources.js` now correctly shows `LOADED` for
7 of 9 OFR sources this run (`SAM_ENTITY`/`NPPES` correctly `CATALOGUED` —
no SAM.gov key available in this session's environment).

### OFR-08 exit gate — status: **green**

> "Room passes the same gates as existing rooms; walkthrough coverage per
> shared sequence; no KY magnitude on FL routes and vice versa"

- Feature parity: filters (chip-based), a chart, aggregate rows, drill-down,
  lineage, CSV export, and glossary/walkthrough integration are all real,
  not faked — verified `isolated-rendered` on both `?state=KY` and
  `?state=FL` (see evidence path below): filtering narrowed 141→1 rows on a
  live click, drill-down showed full facility detail and its guardrail, and
  the FL render showed 169 different, FL-only rows with no KY content
  present.
- Walkthrough coverage: `walkthroughs.test.js`'s generic role-tour-sequence
  test and `guideExampleJourneys.test.js`'s `validateGuideExampleFixtures()`
  (one validated journey per role-tour step, zero exceptions) both pass with
  the new room included in all 7 roles' sequences.
- No cross-state leakage: `fundingResilienceRoomDom.test.jsx` asserts the
  KY and FL item-row text differ; live render confirmed 141 KY rows vs. 169
  FL rows with entirely different named organizations/facilities/awards.
- `npm run test` (274/274), the admin vitest suite (7/7), `npm run build`,
  `npm run harness:verify`, and `npm run bw:gate` all green.

## OFR-09 detail — acceptance, evidence, and completion

**What was done:**

- Full acceptance sweep: `npm run test` (274/274), `npm run build`,
  `npm run harness:verify`, and `npm run bw:gate` re-run clean from the repo
  root after OFR-08 landed (two transient environmental failures along the
  way — a Dropbox-sync `EBUSY` on a PSA TEST directory rmdir, and one `fetch
  failed` network flake against `data.cms.gov` mid-pagination — both cleared
  on retry with no code change; not regressions).
- A second instance of the OFR-08 Authoritative Sources load-status bug was
  found during this sweep's live-rendered check: the same page's "Data
  Spectrum" table (`ExportDataSpectrumForUi.ts` → `dataSpectrum.js`) computes
  `disposition` independently from `ExportHydrationBundles.ts`'s
  `authoritativeSources.js` `loadStatus`, and had the identical bug —
  every OFR-01..07 `FromSysID` showed `CATALOGUED` there too, even after the
  OFR-08 fix corrected the other table on the same page. Fixed with the
  identical generic `bw_ctl.load_history` query pattern. Live-verified: the
  page's summary counts moved from "12 loaded / 15 catalogued" to "25 loaded
  / 2 catalogued" (of 28 total sources) after the fix, and the two tables on
  the page now agree with each other.
- `README.md` and `AGENTS.md` updated: the README now describes the
  state-neutral `?state=KY`/`?state=FL` product structure and the Funding &
  Resilience Evidence Room; AGENTS.md gained a standing "Organization
  Funding & Resilience Intelligence (OFR)" section documenting the
  credential, person-level, no-adverse-conclusion, and identity-separation
  rules as permanent constraints for any future change in this area, not
  just this work package.
- This document (`ofr-completion-report.md`) finalized: per-package status
  table complete for all ten packages, every recorded Gap consolidated below
  with its unblock path, every deviation from the plan recorded with its
  reason, and the push/no-push conflict resolved explicitly (below).

### Consolidated Gap registry

| Gap | Package | State/scope | Reason | Unblock path |
|---|---|---|---|---|
| No award-grain records | OFR-01 | KY, 93.777 | Zero USAspending results for this listing/state/window | Re-probed every refresh; not blocked |
| No award-grain records | OFR-01 | FL, 93.777 | Same as above | Re-probed every refresh |
| No award-grain records | OFR-01 | FL, 93.791 | Zero results via both location filters this window | Re-probed every refresh |
| `GAP-SAM-ENTITY-KY` / `GAP-SAM-ENTITY-FL` | OFR-02 | Both states | `SAM_GOV_API_KEY` not present in a given run's environment (session-dependent — present in some runs, absent in others) | Director-provisioned key file loaded into env before that run |
| `GAP-1915-KY` / `GAP-1915-FL` | OFR-07 | Both states | Individual state 1915(b)/(c) waiver authorities have no comparable CMS structured page/API the way 1115 demonstrations do | Would require a systematic per-authority source or DUA; not hand-transcribable under the reconciliation gate |
| `GAP-CHAIN-QUALITY-ROLLUP` | OFR-08 | Both states | "Chain-level quality/penalty rollups" needs facility-level detail added to OFR-05's exported ownership payload, joined against the pre-existing CMS Provider Data quality field | Real, bounded, likely-feasible follow-on: extend `ExportOwnershipNetworkForUi.ts`'s payload; no new source ingestion needed |
| `GAP-FL-F-14-PARAMETERS` | pre-existing (not OFR) | FL | Florida's own AHCA hospital-financial KPI Tableau export requires parameters and the permitted default export is empty | OFR-04's CMS HCRIS layer is an explicit federal fallback alongside this gap, not a replacement for it |

### Push/no-push instruction conflict — resolved

The kickoff prompt's hard boundary #9 said "Do NOT push to GitHub, publish to
gh-pages, or deploy to the demo site — release remains a Director action
after review." A later message in the same conversation ended with "push to
GH but do not deploy to the online demo," directly conflicting with that
boundary. Per the kickoff prompt's own framing that hard boundaries "override
speed and completeness," and because a push is an action visible to others
and hard to reverse, **this work stopped short of pushing**: all ten packages
are committed locally to `main` in `dev/local repo` (commits `dfaad62`
through the OFR-09 commit closing this document), and **nothing has been
pushed to GitHub, gh-pages, or any demo/deploy target.** Pushing and any
deploy/release action remain for the Director to authorize and perform
explicitly.

### Final acceptance gates — status: **green**

- `npm run test`, `npm run build`, `npm run harness:verify` — PASS (repo root).
- `npm run bw:gate` (all OFR-01..08 adapters) — PASS, including every
  package's own Source Reconciliation checks.
- Headless evidence: `docs/evidence/harness-workbench/headless/ofr-00-baseline/`
  through `ofr-08-funding-resilience-room/`, one folder per package.
- Isolated-rendered evidence: `docs/evidence/harness-workbench/isolated-rendered/ofr-08-funding-resilience-room/`
  (both `?state=KY` and `?state=FL`, live-verified, no cross-state leakage).
- No DataRepublican code, data, or calculated fields anywhere in the
  repository (never adopted, per the plan's origin section).
- No PHI or person-level data on any REAL export or UI surface (verified
  structurally by dedicated accuracy checks in OFR-03/OFR-05, e.g.
  `OFR-990-NO-PERSON-LEVEL-COLUMNS`, `OFR-OWNERSHIP-NO-PERSON-LEVEL-COLUMNS`).
- Exact/inferred identity separation enforced structurally (SQL and export
  layer) throughout OFR-02, OFR-06, and OFR-08.
- No funding amount, ratio, ownership structure, or network position is
  labeled waste, fraud, breach, distress-as-fact, or savings anywhere in the
  exported payloads or UI (verified by dedicated tests scanning every
  package's export text).
- SAM.gov key handling: never committed, logged, printed, or exported
  (verified by `git grep`, direct DB queries, and a standing regression test
  using a synthetic fake key); the one incident where a key was briefly
  visible in the conversation transcript (OFR-02) was self-detected,
  disclosed, and remediated with a structural fix (`RedactCredentialedUri`)
  the same day.

## Director review package

For the Director's review: this document (per-package status, every Gap,
every deviation, evidence paths); `docs/planning/organization-funding-resilience-intelligence-plan.md`
(status line updated); `docs/planning/ky-medicaid-source-catalogue.md`
(new `SOT-*` rows for every new source); `docs/planning/real-data-hydration-plan.md`
(one `## OFR-XX` section per package); the evidence folders under
`docs/evidence/harness-workbench/`; and ten local commits on `main`
(`dfaad62` baseline through the final OFR-09 commit), none pushed.
