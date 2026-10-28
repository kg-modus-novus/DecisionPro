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
| Sign in: register the account or record the sign-in, start a session, end the previous session and release its locks | Automated workflow segment: account owner molecules, then D2 session and lock mechanisms | `SignIn` (program), `decisionpro-api/src/domain/SignIn.mjs` |
| Sign out: release the session's locks, end the session | Automated workflow segment over D2 session and lock mechanisms (no business object changes) | `SignOut` (program), `decisionpro-api/src/domain/SignOut.mjs` |
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
- `SignInAccount` (program `SignIn`)
- `SignOutAccount` (program `SignOut`)

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

`MeasureTargetOwner` (INITIAL values set by `InitializeMeasureTarget`). Revised after the
independent review (CX-06, CX-07): one canonical name per datum, and no presence flag.
- Requested inputs: `OwnerScope = ''`, `MeasureId = ''`, `TargetValue = 0`, `TargetNote = ''`,
  `TargetNoteChange = 'replace'` (`'keep'` when a revise omits the note),
  `TransactionHandle = NO_TRANSACTION`
- Catalog: `CatalogEntryRows = []`, `MeasureCatalogEntryCount = 0`,
  `CatalogEntry = { id: '', unit: '', betterDirection: '' }`
- Stored row as loaded: `CurrentTargetRows = []`, `CurrentTargetRowCount = 0`,
  `CurrentTargetStatus = ''`, `CurrentTargetRevision = 0`, `StoredTargetValue = 0`,
  `StoredTargetNote = ''`, `StoredTargetUnit = ''`, `StoredBetterDirection = ''`
- Row being written: `NextTargetStatus = ''`, `NextTargetRevision = 0`, `NextTargetValue = 0`,
  `NextTargetNote = ''`, `NextTargetUnit = ''`, `NextBetterDirection = ''`,
  `EffectiveDate = ''`, `RecordedAt = ''`
- Answers: `TransactionIsOpen`, `MeasureIsInCatalog`, `TargetValueIsWithinUnitRange`,
  `TargetIsAbsentOrRetired`, `TargetIsActive` (all `false`)
- Counters: `TargetRowsWritten = 0`, `RevisionRowsWritten = 0`
- Reads: `ActiveTargetRows = []`, `ActiveTargetCount = 0`, `ActiveTargets = []`
- `Errors = []`

`MyTargetsEditing`:
- `AccountId = ''`, `SessionId = ''`, `SessionExpiresAt = 0`
- `RequestedTargets = []` (each `{ measureId, value, note, noteChange, retire }`, normalized at the boundary)
- `TargetSetLockKey = ''`, `LockIsHeld = false`, `LockHolderDescription = ''`, `LockReleaseCount = 0`
- `TransactionHandle = NO_TRANSACTION`
- `RequestedTargetCount = 0`, `RequestedTargetIndex = 0`, `RequestedTargetIsRetirement = false`,
  `RequestedTargetIsActive = false`
- `TargetsSaved = 0`, `TargetsRetired = 0`, `TargetsRejected = 0`, `TargetsCommitted = 0`,
  `StorageFailureCount = 0`
- `SaveIsFreeOfErrors = false`, `SaveIsCommitted = false`
- `Errors = []`

`AccountOwner`:
- `Provider = ''`, `ProviderSubject = ''`, `AccountId = ''`, `DisplayEmail = ''`
- `AccountRows = []`, `AccountRowCount = 0`, `AccountStatus = ''` (`'absent'` or `'active'` once loaded)
- `AccountIsRegistered = false`, `SignInTime = ''`, `RecordedDisplayEmail = ''`, `AccountRowsWritten = 0`
- `AccountView = { accountId: '', provider: '', displayEmail: '', registeredAt: '', lastSignedInAt: '', signInCount: 0 }`
- `Errors = []`

`SignIn` (program; dependencies `Database`, `Clock`, `Sessions`, `Enqueue`, and its own `AccountOwner`):
- Inputs: `Provider = ''`, `ProviderSubject = ''`, `DisplayEmail = ''` (from the verified ID token),
  `PreviousSessionToken = ''` (the browser's `dp_session` cookie)
- Run state: `AccountId = ''`, `AccountIsReadyForSignIn = false`,
  `StartedSession = { sessionIsActive: false, sessionToken: '', sessionId: '', accountId: '', createdAt: 0, expiresAt: 0 }`,
  `PreviousSession` (same INITIAL shape), `PreviousSessionIsActive = false`,
  `PreviousSessionLocksReleased = 0`, `PreviousSessionsEnded = 0`, `AccountView` (as `AccountOwner`)
- Outcome: `SignInIsComplete = false`, `StorageFailureCount = 0`, `Errors = []`

`SignOut` (program; dependencies `Sessions`, `Enqueue`):
- Input: `SessionToken = ''` (the `dp_session` cookie)
- Run state: `Session` (INITIAL session shape), `SessionIsActive = false`, `SessionLocksReleased = 0`,
  `SessionsEnded = 0`
- Outcome: `SignOutIsComplete = false`, `StorageFailureCount = 0`, `Errors = []`

Dependencies are fields set at construction: `Database`, `Enqueue`, `MeasureCatalog`, `Clock`,
and for the sign-in programs `Sessions`.

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

`OpenMyTargetsForEditing`: `IdentifyTargetSetLock` → `AcquireTargetSetLock` (ACTIVE; `Enqueue.acquire`;
a persist failure counts in `StorageFailureCount`, mapped to 503) → `IsLockHeldBySession` writes
`LockIsHeld`, or `LockHolderDescription` when denied ('' when the holder's session has ended).

`SaveMyTargets`:
1. `IsLockHeldBySession`
2. `BeginTargetTransaction` (ACTIVE)
3. For each requested target, the owner's `SetMeasureTarget`, `ReviseMeasureTarget` or
   `RetireMeasureTarget`, sharing the transaction handle. The loop advances
   `RequestedTargetIndex` and its counters.
4. `IsSaveFreeOfErrors`
5. `CommitTargetTransaction` (ACTIVE) or `RollBackTargetTransaction` (ACTIVE)
6. `IsSaveCommitted` writes `SaveIsCommitted`; `CountCommittedTargets`; `ForgetTargetTransaction`
7. `ReleaseTargetSetLock` (ACTIVE). A release failure after a commit is reported
   (`lockReleased: false`) and does not undo the commit.

The lock holder is the session (ADR-001 Decision 3): the denial applies between browsers and
devices; tabs share the lock. A save releases the lock the tabs share, so another tab must reopen
editing before its own save, and gets 409 until it does. The front end reopens before every edit.

`CancelMyTargetsEditing`: `ReleaseTargetSetLock`.

`RegisterAccount`: `IdentifyAccount` → `LoadAccount` → `CountAccountRows` → `IsAccountRegistered`; when
absent, `StampAccountSignIn` → `PersistNewAccount` (`ON CONFLICT DO NOTHING`) → `LoadAccount` →
`CountAccountRows` → `IsAccountRegistered` (a concurrent first sign-in that registered first counts
as registered) → `RejectRegistrationNotRecorded` only if still absent.

`RecordAccountSignIn`: `IdentifyAccount` → `LoadAccount` → `CountAccountRows` → `IsAccountRegistered` →
`StampAccountSignIn` → `PersistAccountSignIn` (arrow active → active), or
`RejectSignInOfUnregisteredAccount`.

`SignInAccount` (program `SignIn`):
1. `StageAccountIdentity` (PASSIVE; stage the verified identity into `AccountOwner`)
2. `RegisterAccountOnFirstSignIn` (ACTIVE; owner `RegisterAccount`) → `CopyAccountIdentity` →
   `IsAccountReadyForSignIn` (else `RejectSignInForAccount`)
3. `StartSession` (ACTIVE; `Sessions.startSession`)
4. `RecordSignInOnAccount` (ACTIVE; owner `RecordAccountSignIn`) → `IsAccountReadyForSignIn`
5. `ReadSignedInAccount` (ACTIVE; owner `ReadAccount`) → `CopySignedInAccountView`
6. `LoadPreviousSession` (ACTIVE) → `IsPreviousSessionActive` → `ReleasePreviousSessionLocks` (ACTIVE)
   → `EndPreviousSession` (ACTIVE)
7. `IsSignInComplete` writes `SignInIsComplete`; storage failures map to 503

Order decision (atomic from the browser's point of view): the new session starts before the sign-in
is counted, and the previous session ends last. Any failure before step 6 completes leaves the
browser with its previous cookie and session, so it stays signed in; the response carries no new
cookie. A failure after step 3 leaves an undelivered session row that holds no lock and ends at its
12-hour lifetime. A failure in step 6 after the count was raised still leaves the browser signed in
on its previous session.

`SignOutAccount` (program `SignOut`): `LoadSession` (ACTIVE) → `IsSessionActive` →
`ReleaseSessionLocks` (ACTIVE) → `EndSession` (ACTIVE) → `IsSignOutComplete`. The route clears the
cookie only when `SignOutIsComplete`; a storage failure is 503 and leaves the browser signed in.

## Coordination mechanisms

| Mechanism | Serves | Condition it handles |
|---|---|---|
| Target-set enqueue lock | ADR-001 Decision 3 (`architecture-record: T1 A1 L1 ADR-001`) | the same account editing from two browsers or devices at once; the denial names the holder. Tabs of one browser share the session and the lock |
| Lock persisted to `enqueue_lock` and restored at boot | Decision 4 (`T1 R1 ADR-001`) | API restart while an edit is open |
| Session lifetime of 12 hours | ADR-001 Identity and Decision 3 | bounds sign-in and lock holding |
| `SELECT … FOR UPDATE` inside the save transaction | Decision 2 (A1): the lock owner's write commits atomically | rows changed by a save in the same process; no second process exists under T1 |
| Conditional upsert (`… DO UPDATE … WHERE measure_target.target_revision = EXCLUDED.target_revision - 1`) | Decision 2 (A1) (`architecture-record: T1 A1 ADR-001`) | two overlapping saves of the same target within one session (tabs) or across a lock boundary: the loser writes no row and is refused as `target-changed` (422) |
| Provider key cache (`createRemoteJWKSet` in `identityTokens.mjs`, `PROVIDER_KEY_CACHE`): Google and Apple signing keys kept in memory for 10 minutes, refetched no sooner than 30 seconds after a fetch (cooldown), a fetch abandoned after 5 seconds | ADR-001 Identity (`architecture-record: T1 ADR-001`): one process, so the cache lives in memory | verifying every ID token without fetching the provider's keys each time; a key rotation is picked up when a token names an unknown key (after the cooldown) or the cache ages out; an unreachable key server fails fast as `key-set-unavailable` (503) |
| Sign-in attempt limit: 60 sign-in attempts (`POST /auth/google`, `POST /auth/apple`) per client IP per 10 minutes, fixed window; `/auth/sign-out` is exempt | T1 (`architecture-record: T1 ADR-001`): one process, so the counters live in memory; expired windows are pruned on each check, no timer | repeated failed sign-ins from one address. The limit allows a legislative office whose staff share one public address. Key: the client IP (the right-most `X-Forwarded-For` entry behind Railway's proxy when `TRUST_PROXY=true`) |

No retry, poll, lease or heartbeat is added. The only cache is the provider key cache, and the
only durations besides the session lifetime are the sign-in attempt window and that cache's
lifetime, cooldown and fetch timeout; each is a row above. There is no timer or sweeper: the
window and the cache expire when next consulted. Every read that decides comes from the
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
  `Account`, `MeasureTarget`, `MyTargetsEditing`, `SignIn`, `SignOut` rows, the technical tables and
  the D2 owners.
- First-line markers (kebab `owns=`):
  - `CodeXen-Container: v1 kind=object container=AccountOwner owns=account`
  - `CodeXen-Container: v1 kind=object container=MeasureTargetOwner owns=measure-target`
  - `CodeXen-Container: v1 kind=program container=MyTargetsEditing`
  - `CodeXen-Container: v1 kind=program container=SignIn`
  - `CodeXen-Container: v1 kind=program container=SignOut`
- Index rebuild: `node scripts/codexen/codexen-index.mjs build --write-cursor-rule`, if the
  script exists in this repository; otherwise record that it is absent. It is absent (no `.codexen/`
  directory and no index script yet), as recorded in `docs/CODEXEN-SCOPE.md`.
