# ADR-001: DecisionPro API architecture record

- **Status:** Accepted (Director decision, Ken Greenwood, 2026-10-28)
- **Scope:** the `decisionpro-api` service and every business object it persists. The static demo
  (GitHub Pages) holds no business state and is unaffected.
- **Canon:** CodeXen code generation, *Architecture record* and *Named templates*
  (`hub/docs/development-canon/best-practices/CODEXEN_CODE_GENERATION.md`).
- **Choice:** the canon reference design **T1 + A1 + L1 + R1**, tenancy **P1**.
- **Rejected:** T4 + A2 + L3 on Vercel serverless functions. It would have worked for personal
  targets, but it is a poor fit for the background data loads that non-public data under data use
  agreements will bring. The Director chose the reference design over a serverless compromise.

## Context

Plan item #7 (subcommittee meeting 2026-10-28) lets a signed-in user set targets for simple-mode
measures. Today a target is fixed in the sourced data. Sign-in is with Google or Apple. Targets are
personal ("My targets"). A later approver role promotes a personal target to a committee target
that everyone sees. Later, under item #5, the same service will hold non-public data and run its
scheduled loads.

## Decision 1: Topology (T1, single-server transaction monitor)

- One long-running Node process, the Railway service `decisionpro-api` with exactly one replica,
  owns all business state and the lock table. Railway Postgres in the same project is the durable
  log.
- The service is deployed with `numReplicas: 1`. A second replica is an architecture change and
  needs a new ADR, not a configuration change.
- Scale is vertical: give the service more CPU and memory. For isolation and failure domains it is
  sharded by tenant (P1 key) later, if ever needed.
- Failure is bounded to that one process. A crash or deploy makes the API briefly unavailable
  (seconds), and the static site keeps working read-only. Restart follows Decision 4.

## Decision 2: Authority (A1, authority follows the lock)

- For a business unit held under a lock, the lock owner's in-process copy is the truth until it is
  saved or released. For an unheld unit, the Postgres row is the truth. A browser copy is never the
  truth.
- Demo-mode targets live only in the viewer's browser. They are never sent to the service and are
  not the business object. The page labels them "Draft target, this browser only, not saved to
  your account."

## Decision 3: Locking (L1, representative enqueue locks on business keys)

| Lock | Key | Covers | Held by | Released |
|---|---|---|---|---|
| Target set | `(owner_account_id, 'TARGET_SET')` | every personal target of that account | the user session that opened "Edit my targets" | on save, on cancel, on sign-out, or when that session ends |
| Committee target (later) | `('COMMITTEE', measure_id)` | the committee target for one measure | the approver session reviewing it | on approve, reject or cancel, or when that session ends |

- The lock table lives in the API process's memory and is persisted to `enqueue_lock` in Postgres
  on every acquire and release, so locks survive a restart (Decision 4).
- A user session ends at sign-out, or 12 hours after sign-in. The 12 hours is the session lifetime
  this record sets, and it also bounds how long a lock can be held.
- A denied request is told who holds the lock: "Your targets are open for editing in another
  window (since 3:42 PM). Close it, or sign out there, to edit here." For committee locks, the
  message names the approver.

## Decision 4: Recovery (R1, restart and resume from a durable operation ledger)

- Every background or long-running operation kind is written to `operation_ledger` before it
  starts, with `attempts`, `max_attempts` and `status`.
- At boot the service runs these steps once, in order:
  1. Restore the lock table from `enqueue_lock`. A lock whose session is still valid is restored
     pending reconnect. A lock whose session has ended is released.
  2. Re-queue ledger operations that have attempts remaining. Mark the rest `failed` and show them
     to the user who started them.
- There is no runtime sweeper, lease or heartbeat.
- Default attempt cap: 3 per operation kind, unless the kind's own entry says otherwise.
- Operation kinds today: none. Saving targets is a single request-scoped transaction, not a
  background operation. The first kinds will be the non-public data loads under item #5, and each
  will be added to this record with its attempt cap and what the user sees.

## Tenancy (P1, tenant key column)

- Every business table carries `owner_account_id`, and the service scopes every read and write by
  it.
- An account is the pair (identity provider, provider subject), stored as `account_id`
  (`google:<sub>` or `apple:<sub>`). Email addresses are stored only for display to their owner.
- Committee targets carry the scope `COMMITTEE` in place of an owner account.

## Identity (supporting decision, not a coordination mechanism)

- Google and Apple OpenID Connect ID tokens are verified on the server against each provider's
  published keys (issuer, audience, expiry, signature).
- The service then issues its own session, as an httpOnly, Secure, SameSite=Lax cookie.
- The API is served from `api.decisionpro.io`, the same registrable domain as `demo.decisionpro.io`,
  so the cookie is same-site and works in browsers that block third-party cookies.
- OAuth client ids and secrets are created by the Director and kept in Infisical. Agents never
  create accounts or accept terms.

## Consequences

- Every lock, ledger step, retry and duration in the service cites this record with a comment of
  the form `// architecture-record: T1 A1 L1 R1 ADR-001`.
- Tests may not simulate two API processes. That topology is forbidden here, and a test for it
  would lock in the wrong assumption.
- Cost estimate given to the Director: about $5–15 a month of Railway usage on the existing plan.
  This is an estimate, not a quote.
