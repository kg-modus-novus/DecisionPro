# Measure targets (plan item #7): CodeXen plan

Date: 2026-10-28. This plan implements item #7 of the 2026-10-28 subcommittee enhancement plan.
Source rulings: the perspective statement in `docs/CODEXEN-SCOPE.md` and the architecture record
in `docs/architecture/ADR-001-decisionpro-api-architecture.md`.

## Architecture record

ADR-001 records:
- **T1** single-server transaction monitor (one Railway replica of `decisionpro-api`)
- **A1** authority follows the lock
- **L1** representative enqueue locks: target-set lock keyed `(owner_account_id, 'TARGET_SET')`
- **R1** restart and resume from `operation_ledger` (no operation kinds yet)
- **P1** tenant key `owner_account_id`

All four decisions are present, so planning proceeds.

## Applicability

| Unit | Classification | Container |
|---|---|---|
| Register an account on first sign-in, record sign-ins | Business Action, state transition | `AccountOwner` (object) |
| Set, revise and retire a personal target | Business Actions, validations, state transitions | `MeasureTargetOwner` (object) |
| Open, save and cancel editing of my targets | Automated workflow segment: lock, validate, owner molecules in one transaction, release | `MyTargetsEditing` (program) |
| Sign in: register or record the sign-in, end the previous session and release its locks, start a session | Automated workflow segment: account owner molecules, then D2 session and lock mechanisms | `SignIn` (program), `decisionpro-api/src/domain/SignIn.mjs` |
| Verify a Google or Apple ID token | Not applicable: adapter (cryptographic check, no business decision) | `decisionpro-api/src/platform/identityTokens.mjs` |
| Sessions, enqueue lock table, operation ledger | Not applicable: technical mechanisms governed by ADR-001 (D2) | `decisionpro-api/src/platform/*` |
| HTTP routes, JSON parsing, CORS, cookies | Not applicable: framework wiring and boundary adapters | `decisionpro-api/src/http/*` |
| Demo-mode targets in browser storage | Not applicable: per-viewer draft, never sent to the server, never authoritative (A1) | `wireframe V1/app/src/lib/simpleMode/draftTargets.js` |
| Target display on cards (gap, met / not met) | Not applicable: presentation of stored values | `measureModel.js` |

## Business Actions

- `RegisterAccount`
- `RecordAccountSignIn`
- `SetMeasureTarget`
- `ReviseMeasureTarget`
- `RetireMeasureTarget`
- `OpenMyTargetsForEditing`
- `SaveMyTargets`
- `CancelMyTargetsEditing`

Later, not built in this change: `ProposeCommitteeTarget`, `ApproveCommitteeTarget`, `RejectCommitteeTarget`.

## Business objects and owners

| Object | Disposition | Identity | Owner | Persistence | State diagram |
|---|---|---|---|---|---|
| Account | D1 | `account_id` = `google:<sub>` / `apple:<sub>` | `AccountOwner`, `decisionpro-api/src/domain/Account.mjs` | `account` | absent → active (`RegisterAccount`); active → active (`RecordAccountSignIn`) |
| MeasureTarget | D1 | `(owner_scope, measure_id)`, one current target per scope per measure; `owner_scope` = account id or, later, `COMMITTEE` | `MeasureTargetOwner`, `decisionpro-api/src/domain/MeasureTarget.mjs` | `measure_target`, plus its own log `measure_target_revision` | below |
| Session | D2 | session id | `decisionpro-api/src/platform/sessions.mjs` (ADR-001 Identity) | `user_session` | n/a |
| Enqueue lock | D2 | lock key | `decisionpro-api/src/platform/enqueue.mjs` (ADR-001 Decision 3) | `enqueue_lock` | n/a |
| Operation ledger entry | D2 | operation id | `decisionpro-api/src/platform/operationLedger.mjs` (ADR-001 Decision 4) | `operation_ledger` | n/a |

MeasureTarget state diagram, for this change:

```
absent ──SetMeasureTarget──▶ active
active ──ReviseMeasureTarget──▶ active        (revision + 1, previous revision kept in the log)
active ──RetireMeasureTarget──▶ retired
retired ──SetMeasureTarget──▶ active          (same identity, revision + 1)
```

Later: `active (personal) ──ProposeCommitteeTarget──▶ proposed (COMMITTEE scope) ──Approve──▶ active (COMMITTEE)`.

Holders: none. `MyTargetsEditing` holds no MeasureTarget; it stages values and invokes the owner's
molecules.

## Container fields

`MeasureTargetOwner` (INITIAL values set by `InitializeMeasureTarget`):
- `OwnerScope = ''`, `MeasureId = ''`
- `TargetValue = 0`, `TargetValueIsSet = false` (a real business concept: a target value was given)
- `TargetUnit = ''`, `BetterDirection = ''`, `TargetNote = ''`, `EffectiveDate = ''`
- `CurrentTargetRows = []`, `TargetStatus = ''`, `TargetRevision = 0`
- `MeasureCatalogEntryCount = 0`, `CatalogEntry = { id: '', unit: '', betterDirection: '' }`
- `TransactionHandle = NO_TRANSACTION`, `RowsWritten = 0`
- `Errors = []`

`MyTargetsEditing`:
- `AccountId = ''`, `SessionId = ''`
- `RequestedTargets = []` (each `{ measureId, value, note, retire }`, normalized at the boundary)
- `LockIsHeld = false`, `LockHolderDescription = ''`
- `TransactionHandle = NO_TRANSACTION`
- `TargetsSaved = 0`, `TargetsRetired = 0`, `TargetsRejected = 0`
- `RequestedTargetIndex = 0`
- `Errors = []`

`AccountOwner`:
- `Provider = ''`, `ProviderSubject = ''`, `AccountId = ''`, `DisplayEmail = ''`
- `AccountRows = []`, `AccountStatus = ''`
- `Errors = []`

Dependencies are fields set at construction: `Database`, `Enqueue`, `MeasureCatalog`, `Clock`.

## Molecule sequence

`SetMeasureTarget` (and `ReviseMeasureTarget`, a deliberate duplicate; consolidation is not planned):
1. `LoadMeasureCatalogEntry` (PASSIVE; reads the published catalog bundled with the API).
2. `IsMeasureInCatalog` writes `MeasureIsInCatalog`.
3. `IsTargetValueWithinUnitRange` writes `TargetValueIsWithinUnitRange` (percent 0–100; dollars
   any finite value, including negative; other units ≥ 0; Director ruling 2026-10-28, ADR-001
   Business rules).
4. `LoadCurrentTarget` (ACTIVE; `SELECT … FOR UPDATE` inside the caller's transaction).
5. `IsTargetAbsentOrRetired` writes `TargetIsAbsentOrRetired`.
   For `Revise`: `IsTargetActive` writes `TargetIsActive`.
6. `PrepareTargetRevision` (PASSIVE; revision + 1, status `active`).
7. `PersistMeasureTarget` (ACTIVE; upsert `measure_target`). Arrow: absent/retired → active, or
   active → active.
8. `PersistMeasureTargetRevision` (ACTIVE; insert into `measure_target_revision`).

`RetireMeasureTarget`: `LoadCurrentTarget` → `IsTargetActive` → `PrepareTargetRetirement` →
`PersistMeasureTarget` (arrow active → retired) → `PersistMeasureTargetRevision`.

`OpenMyTargetsForEditing`: `AcquireTargetSetLock` (ACTIVE; `Enqueue.acquire`) → `IsLockHeldBySession`
writes `LockIsHeld`, or `LockHolderDescription` when denied.

`SaveMyTargets`:
1. `IsLockHeldBySession`
2. `BeginTargetTransaction` (ACTIVE)
3. For each requested target, the owner's `SetMeasureTarget`, `ReviseMeasureTarget` or
   `RetireMeasureTarget`, sharing the transaction handle. The loop advances
   `RequestedTargetIndex` and its counters.
4. `IsSaveFreeOfErrors`
5. `CommitTargetTransaction` (ACTIVE) or `RollBackTargetTransaction` (ACTIVE)
6. `ReleaseTargetSetLock` (ACTIVE)

`CancelMyTargetsEditing`: `ReleaseTargetSetLock`.

`RegisterAccount` / `RecordAccountSignIn`: `LoadAccount` → `IsAccountRegistered` →
`PersistNewAccount`, or `PersistAccountSignIn`.

## Coordination mechanisms

| Mechanism | Serves | Condition it handles |
|---|---|---|
| Target-set enqueue lock | ADR-001 Decision 3 (`architecture-record: T1 A1 L1 ADR-001`) | two windows of the same account editing at once; the denial names the holder |
| Lock persisted to `enqueue_lock` and restored at boot | Decision 4 (`T1 R1 ADR-001`) | API restart while an edit is open |
| Session lifetime of 12 hours | ADR-001 Identity and Decision 3 | bounds sign-in and lock holding |
| `SELECT … FOR UPDATE` inside the save transaction | Decision 2 (A1): the lock owner's write commits atomically | rows changed by a save in the same process; no second process exists under T1 |

No retry, poll, cache, timer, lease or heartbeat is added. Every read that decides comes from the
Postgres row (unheld) or the held edit session (A1). The browser's copy is never trusted, and
every value is re-validated on the server.

## Exceptions

- The HTTP adapters take `(req, res)`. They are framework wiring, not containers.
- The platform modules (`enqueue`, `sessions`, `operationLedger`, `identityTokens`) are
  conventional technical utilities with ordinary signatures. They are not containers.
- No container atom or molecule has a parameter, return value or local. The per-target loop uses
  the `RequestedTargetIndex` field.

## Boundaries

- The route adapters reject missing or invalid JSON and normalize each requested target before
  staging it: `measureId` is a string, `value` is a finite number, `note` is a string of at most
  500 characters, and `retire` is a boolean. Requests are capped at 100 targets, and over-cap
  requests are rejected with a 400.
- A save runs in one transaction, held in `MyTargetsEditing.TransactionHandle`. The owner molecules
  run inside it.
- There is no delete: retiring is a state. Foreign keys are `RESTRICT`. No triggers, rules or
  cascades.

## Scope changes

- `docs/CODEXEN-SCOPE.md`: perspective statement, pointer to the architecture record, and the
  `Account`, `MeasureTarget`, `MyTargetsEditing` rows and D2 owners.
- First-line markers:
  - `CodeXen-Container: v1 kind=object container=AccountOwner owns=Account`
  - `CodeXen-Container: v1 kind=object container=MeasureTargetOwner owns=MeasureTarget`
  - `CodeXen-Container: v1 kind=program container=MyTargetsEditing`
- Index rebuild: `node scripts/codexen/codexen-index.mjs build --write-cursor-rule`, if the
  script exists in this repository; otherwise record that it is absent.
