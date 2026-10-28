# CodeXen scope — DecisionPro

Mode: `codexen` (default; no `.codexen/config.json` records otherwise).

## Perspective

Director-owned statement, 2026-10-28 (Ken Greenwood): DecisionPro operates on public and, later,
data-use-agreement Kentucky Medicaid aggregate measures, so that legislators and their staff can see
where money goes, whether people get care, whether health improves, and who is responsible.
Signed-in users set and track their own targets for those measures; an approver role may later
make a target a committee target that everyone sees. DecisionPro never holds person-level Medicaid
data.

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

Technical (D2) owners named in ADR-001: sessions `decisionpro-api/src/platform/sessions.mjs`, enqueue lock table
`decisionpro-api/src/platform/enqueue.mjs`, operation ledger `decisionpro-api/src/platform/operationLedger.mjs`.

Technical tables (no business datum lives in them):

- `user_session`: technical because it holds only sign-in session bookkeeping (a hash of the cookie token, the account it signs in, and its 12-hour lifetime under ADR-001 Identity); no business rule reads or decides on it.
- `enqueue_lock`: technical because it is the persisted copy of the in-memory enqueue lock table (ADR-001 Decisions 3 and 4); it records who holds a lock, not any business value.
- `operation_ledger`: technical because it records the attempts and status of background operations for restart (ADR-001 Decision 4); today it has no operation kinds. Before the first operation kind is added, the Director disposes whether ledger entries stay technical or become a business object (canon promotion test: a job record with its own identity and lifecycle).

Container markers use the kebab `owns=` form (`owns=account`, `owns=measure-target`). This repository has no `.codexen/` directory and no `codexen-index` script yet, so the project index is not built and markers are not checked in CI.

## Program containers

| Container | File | Business Action | Reads |
| --- | --- | --- | --- |
| CountDisclosure | `wireframe V1/app/src/lib/simpleMode/countDisclosureProgram.js` | `DiscloseAggregateCounts` | Published aggregate counts |
| PlanComparison | `wireframe V1/app/src/lib/simpleMode/planComparisonProgram.js` | `OrderPlansOnComparableMeasure` | MCPAR plan-period record |
| MyTargetsEditing | `decisionpro-api/src/domain/MyTargetsEditing.mjs` | `OpenMyTargetsForEditing`, `SaveMyTargets`, `CancelMyTargetsEditing` | MeasureTarget (through its owner) |
| SignIn | `decisionpro-api/src/domain/SignIn.mjs` | `SignInAccount` (register on first sign-in or record the sign-in, start a session, end the previous session and release its locks) | Account (through `AccountOwner`); sessions and enqueue locks (D2) |
| SignOut | `decisionpro-api/src/domain/SignOut.mjs` | `SignOutAccount` (release the session's locks, end the session) | Sessions and enqueue locks (D2); no business object |
| FeeComparison | `wireframe V1/app/src/lib/simpleMode/feeComparisonProgram.js` | `CompareRatesOnNormalizedBasis` (plan item #24: same code, setting, unit and tier; posted rates only; consistent percent of Medicare) | Published fee research rows (sourced `fees`) |
| PaymentRedistributionScenario | `wireframe V1/app/src/lib/simpleMode/paymentScenarioProgram.js` | `ModelPaymentRedistribution` (plan items #6, #12: an illustrative redirect of a payment pool by deprivation; writes nothing) | Published county payments and deprivation index (sourced `rural`) |

Existing modules predate this file and carry no container markers; they are not yet classified.
