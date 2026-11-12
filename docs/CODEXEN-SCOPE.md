# CodeXen scope — DecisionPro

Mode: `codexen` (default; no `.codexen/config.json` records otherwise).

## Perspective

Director-owned statement, 2026-10-28 (Ken Greenwood): DecisionPro operates on public and, later,
data-use-agreement Kentucky Medicaid aggregate measures, so that legislators and their staff can see
where money goes, whether people get care, whether health improves, and who is responsible.
Signed-in users set and track their own targets for those measures; an approver role may later
make a target a committee target that everyone sees. DecisionPro never holds person-level Medicaid
data.

Director amendment, 2026-11-07 (Ken Greenwood, answering CodeXen review F10): the aggregate
spending review covers all states. DecisionPro reads public aggregate spending, enrollment and
counts of billing NPIs for every state, so a state's spending on a service can be compared with
its share of national enrollment and with its peer states (the Potential Fraud Detection module).
Kentucky remains the home state for goals, targets and simple mode. The other limits are unchanged:
DecisionPro names no provider, holds no person-level data, and a flagged candidate is potential
fraud to review, never a finding.

## Architecture record

[ADR-001](architecture/ADR-001-decisionpro-api-architecture.md), Director decision 2026-10-28:
**T1** single-server transaction monitor + **A1** authority follows the lock + **L1** representative
enqueue locks + **R1** restart and resume from a durable operation ledger, tenancy **P1**
(`owner_account_id`). It governs the `decisionpro-api` service (Railway, one replica). The static
wireframe app holds no business state: its per-browser storage (zoom, pinned tiles, simple-mode
filters, demo-mode draft targets) holds no business datum and is never authoritative.

## Business objects and owners

| Business object | Disposition | Owner | Persistence | State diagram | Notes |
| --- | --- | --- | --- | --- | --- |
| Published aggregate county counts | D1 | XenoDroid BW export `county-access-context` | BW | BW | Read-only in the app |
| MCPAR plan-period record | D1 | XenoDroid BW export `mcpar-plan-period` | BW | BW | Read-only in the app |
| Published fee schedules and Medicare amounts | D1 | Sourced research file `sourced/fees.json` (simple mode, Director exception 2026-10-01) | research file | n/a (read-only) | Read by `FeeComparison` |
| Published county payments and deprivation index | D1 | Sourced research file `sourced/rural.json` | research file | n/a (read-only) | Read by `PaymentRedistributionScenario` |
| Account | D1 | `AccountOwner`, `decisionpro-api/src/domain/Account.mjs` | `account` | [plan](planning/measure-targets-codexen-plan.md): absent → active → active | Identity of a signed-in Google/Apple user |
| MeasureTarget | D1 | `MeasureTargetOwner`, `decisionpro-api/src/domain/MeasureTarget.mjs` | `measure_target`, `measure_target_revision` | [plan](planning/measure-targets-codexen-plan.md): absent → active ⇄ active; active → retired → active | Personal targets now; committee scope later |
| State-code spending aggregate (HHS T-MSIS, state x HCPCS x year; state x month) | D1 | `TmsisStateCodeSpendingOwner`, `xenodroid-bw/src/molecules/TmsisStateCodeSpendingOwner.ts` | `bw_dso.dso_tmsis_state_code_year`, `bw_dso.dso_tmsis_state_month` | [plan](planning/share-and-surge-screen-codexen-plan.md): absent → loaded (replaced whole under one load history) | Read-only in the app through the `tmsis-screen` export; provider identities never loaded; NPPES counts per state-code-year (2026-11-08) |
| Share-and-surge candidate (state, HCPCS, year, pattern) | D1 | `ShareAndSurgeCandidateOwner`, `xenodroid-bw/src/molecules/ShareAndSurgeCandidateOwner.ts` | `bw_dso.dso_share_surge_candidate` | [plan](planning/share-and-surge-screen-codexen-plan.md): absent → detected; later human arrows (under validation, disposed) wait for the API | Export `potentialFraudRadar.js` (Potential Fraud Detection module); read-only in the app; never a finding |
| Policy event (a dated public law, rule, code or reporting change, or enforcement act, with its source link and quote; standing suggested or confirmed) | D1 | `PolicyEventOwner`, `xenodroid-bw/src/molecules/PolicyEventOwner.ts` | `bw_dso.dso_policy_event`, `bw_dso.dso_policy_search` | [plan](planning/law-and-policy-layer-codexen-plan.md): absent → suggested → confirmed; absent → confirmed; suggested → absent. Pending Director confirmation: confirmed → suggested and confirmed → absent, which a file edit causes today because the curated files are authoritative and each load replaces the source whole; the load lists every withdrawn or demoted confirmed event in its notes | Public context for the Potential Fraud Detection module; search coverage (state, source, searched-through date) is data of the same load; only confirmed events may change a rating (Director decisions 2026-11-11). Export `policyEvents.js` (every event with its standing, the searches, and the rule the load recorded); read-only in the app |
| Biller oversight aggregate (HHS T-MSIS: state x HCPCS x month and national HCPCS x month; biller groups by year and service; biller profiles and practice areas; code labels; no provider identity) | D1 | `BillerOversightAggregateOwner`, `xenodroid-bw/src/molecules/BillerOversightAggregateOwner.ts` | `bw_dso.dso_tmsis_state_code_month`, `dso_tmsis_code_month`, `dso_biller_group_year`, `dso_biller_group_service_year`, `dso_biller_profile_measure`, `dso_biller_profile_area`, `dso_hcpcs_label` | [plan](planning/oversight-pages-codexen-plan.md): absent → loaded (replaced whole under one load history; reconciled to the state-code spending aggregate and the share-and-surge screen it names) | Export `alp/oversightAggregates.js`; the pages show no figure for fewer than 11 billers, but the file is not held to that rule (ranking inputs as loaded; Director decision 2026-11-12: the display rule is enough, [plan](planning/oversight-pages-codexen-plan.md) section 1.1); read-only in the app (the five oversight pages, 2026-11-12) |

Technical (D2) owners named in ADR-001: sessions `decisionpro-api/src/platform/sessions.mjs`, enqueue lock table
`decisionpro-api/src/platform/enqueue.mjs`, operation ledger `decisionpro-api/src/platform/operationLedger.mjs`.

Technical tables (no business datum lives in them):

- `user_session`: technical because it holds only sign-in session bookkeeping (a hash of the cookie token, the account it signs in, and its 12-hour lifetime under ADR-001 Identity); no business rule reads or decides on it.
- `enqueue_lock`: technical because it is the persisted copy of the in-memory enqueue lock table (ADR-001 Decisions 3 and 4); it records who holds a lock, not any business value.
- `bw_ctl.load_history` and `bw_psa_meta.object_index` (warehouse): **proposed technical, pending Director confirmation** (independent review 2026-11-11, law-and-policy layer item 2). They record each warehouse load run and each retained source object; every loader writes them through `LoadHistoryAtoms` and its own PSA index insert, and no business rule decides from them beyond "latest succeeded load". The warehouse loaders have no architecture record of their own (ADR-001 governs `decisionpro-api`); that decision is open.
- `operation_ledger`: technical because it records the attempts and status of background operations for restart (ADR-001 Decision 4); today it has no operation kinds. Before the first operation kind is added, the Director disposes whether ledger entries stay technical or become a business object (canon promotion test: a job record with its own identity and lifecycle).

Container markers use the kebab `owns=` form (`owns=account`, `owns=measure-target`,
`owns=state-code-spending-aggregate`, `owns=share-and-surge-candidate`, `owns=policy-event`, `owns=biller-oversight-aggregate`). The all-state enrollment
load (`LoadAllStateEnrollmentFromRetainedExtract`) is a second molecule of the existing enrollment
owner `RetrieveAndLoadEnrollment`, which predates markers. This repository has no `.codexen/` directory and no `codexen-index` script yet, so the project index is not built and markers are not checked in CI.

## Program containers

| Container | File | Business Action | Reads |
| --- | --- | --- | --- |
| CountDisclosure | `wireframe V1/app/src/lib/simpleMode/countDisclosureProgram.js` | `DiscloseAggregateCounts` | Published aggregate counts |
| PlanComparison | `wireframe V1/app/src/lib/simpleMode/planComparisonProgram.js` | `OrderPlansOnComparableMeasure` | MCPAR plan-period record |
| MyTargetsEditing | `decisionpro-api/src/domain/MyTargetsEditing.mjs` | `OpenMyTargetsForEditing`, `SaveMyTargets`, `CancelMyTargetsEditing` | MeasureTarget (through its owner) |
| SignIn | `decisionpro-api/src/domain/SignIn.mjs` | `SignInAccount` (register on first sign-in or record the sign-in, start a session, end the previous session and release its locks) | Account (through `AccountOwner`); sessions and enqueue locks (D2) |
| SignOut | `decisionpro-api/src/domain/SignOut.mjs` | `SignOutAccount` (release the session's locks, end the session) | Sessions and enqueue locks (D2); no business object |
| FeeComparison | `wireframe V1/app/src/lib/simpleMode/feeComparisonProgram.js` | `CompareRatesOnNormalizedBasis` (plan item #24: dollars only, percent postings converted; same code, setting/bundle, unit and tier; posted rates only; consistent percent of Medicare), `MeasureRateSpreadOnNormalizedBasis` (spreads between states on the same seven rules; one split setting beside unsplit rates), `CompareClaimPaymentsAcrossStates` (T-MSIS: claims reported, CMS data usable) | Published fee and T-MSIS research rows (sourced `fees`, `tmsis`) |
| PaymentRedistributionScenario | `wireframe V1/app/src/lib/simpleMode/paymentScenarioProgram.js` | `ModelPaymentRedistribution` (plan items #6, #12: an illustrative redirect of a payment pool by deprivation; writes nothing) | Published county payments and deprivation index (sourced `rural`) |
| PaymentDeprivationAssessment | `wireframe V1/app/src/lib/simpleMode/paymentDeprivationProgram.js` | `AssessPaymentDeprivationRelation` (2026-10-29 follow-up: how strongly deprivation and Medicaid payment move together; whether the quarter gap is volume-driven; writes nothing) | Published county payments, deprivation correlations and state fee index (sourced `rural`) |
| PotentialFraudSignalReview | `wireframe V1/app/src/lib/fraud/potentialFraudSignalProgram.js` | `ScorePotentialFraudCandidates` (Potential Fraud Detection module, 2026-11-07: merge candidate rows into service-years, cross-state displacement, signal score and suggested tier, case-file checklist, "can health explain it"; under a staged session score rule of signal weights and tier cut-offs; writes nothing; [plan](planning/potential-fraud-detection-codexen-plan.md); and, law-and-policy layer 2026-11-11: matches the dated public policy events to each rise, counts confirmed events by kind of explanation, names the explanation standing, and rates a confirmed measurement artifact EXPLAINED; [plan](planning/law-and-policy-layer-codexen-plan.md)) | Share-and-surge candidate, state-code spending aggregate and enrollment, through the radar export; policy event, through the policy events export |
| OversightReview | `wireframe V1/app/src/lib/fraud/oversightProgram.js` | `ReviewEarlyWarning` (monthly alert rule, first alert, paid after it, months to the first restriction), `ReviewBillerGroups` (a group's billing and paid paths, its other services, the code's other states), `RankBillerProfiles` (three newcomer signs, medians and ranks among comparable services), `SummarizeExplanationLedgers` (events on file, verdict and its group), `NameStateBriefReadings` (services above the enrollment line with one named reading and three questions); the five oversight pages, 2026-11-12; writes nothing; [plan](planning/oversight-pages-codexen-plan.md) | Biller oversight aggregate, through the oversight export; scored service-years and policy matches from `PotentialFraudSignalReview` |
| LeveledDollarReallocation | `wireframe V1/app/src/lib/fraud/leveledDollarReallocationProgram.js` | `ModelLeveledDollarReallocation` (reallocation what-if: level flagged services to a line, upheld share, FMAP split, allocation to documented needs; a planning model that writes nothing) | Scored service-years from `PotentialFraudSignalReview`; every state's latest-year paid and enrollment share; KFF FY2024 FMAP |

Staging adapter: `xenodroid-bw/scripts/tmsis/stage_tmsis_aggregates.py` is `TmsisStateCodeSpendingOwner`'s staging adapter, not a container. It applies the owner's rules that need the NPI rows (attribution; new billers; the NPPES counts under `RECENT_ENUMERATION_WINDOW_YEARS` and `EXPECTED_TAXONOMY_PAID_COVERAGE`), because provider identities never enter the warehouse. It writes the parameters to the stage manifest, and the owner refuses a stage made under others (`tmsis-nppes-rule-matches-owner`).

Session state (D3): the Potential Fraud Detection score rule (signal weights and tier cut-offs) is staged by the module page for the browser session and read only by `PotentialFraudSignalReview`; it is not saved, shared or cited. A saved or shared score rule would be a business object and needs the API.

Existing modules predate this file and carry no container markers; they are not yet classified.
