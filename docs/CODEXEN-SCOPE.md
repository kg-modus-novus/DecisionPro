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
| Account | D1 | `AccountOwner`, `decisionpro-api/src/domain/Account.mjs` | `account` | [plan](planning/measure-targets-codexen-plan.md): absent → active → active | Identity of a signed-in Google/Apple user |
| MeasureTarget | D1 | `MeasureTargetOwner`, `decisionpro-api/src/domain/MeasureTarget.mjs` | `measure_target`, `measure_target_revision` | [plan](planning/measure-targets-codexen-plan.md): absent → active ⇄ active; active → retired → active | Personal targets now; committee scope later |

Technical (D2) owners named in ADR-001: sessions `decisionpro-api/src/platform/sessions.mjs`, enqueue lock table
`decisionpro-api/src/platform/enqueue.mjs`, operation ledger `decisionpro-api/src/platform/operationLedger.mjs`.

## Program containers

| Container | File | Business Action | Reads |
| --- | --- | --- | --- |
| CountDisclosure | `wireframe V1/app/src/lib/simpleMode/countDisclosureProgram.js` | `DiscloseAggregateCounts` | Published aggregate counts |
| PlanComparison | `wireframe V1/app/src/lib/simpleMode/planComparisonProgram.js` | `OrderPlansOnComparableMeasure` | MCPAR plan-period record |
| MyTargetsEditing | `decisionpro-api/src/domain/MyTargetsEditing.mjs` | `OpenMyTargetsForEditing`, `SaveMyTargets`, `CancelMyTargetsEditing` | MeasureTarget (through its owner) |

Existing modules predate this file and carry no container markers; they are not yet classified.
