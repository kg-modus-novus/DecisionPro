# OFR completion report

**Status as of 2026-08-31 (live document, updated as packages land):** OFR-00
through OFR-05 implemented and gate-green. OFR-06 through OFR-09 not yet
started. **A security incident occurred and was resolved during OFR-02, and a
critical state-scoping bug occurred and was resolved during OFR-04 — see
"Security incident (OFR-02)" and "OFR-04 detail" below; read both before
continuing.**

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
