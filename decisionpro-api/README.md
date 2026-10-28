# decisionpro-api

The DecisionPro API: Google and Apple sign-in, sessions, and personal measure targets ("My
targets", plan item #7 of the 2026-10-28 subcommittee plan). DecisionPro is a product of XenoDroid Inc.

- Architecture record: [ADR-001](../docs/architecture/ADR-001-decisionpro-api-architecture.md),
  **T1 + A1 + L1 + R1**, tenancy **P1**. One long-running Node process on one Railway replica
  owns all business state and the lock table; Railway Postgres is the durable log.
- CodeXen plan: [measure-targets-codexen-plan.md](../docs/planning/measure-targets-codexen-plan.md).
  Scope: [CODEXEN-SCOPE.md](../docs/CODEXEN-SCOPE.md).
- No PHI and no person-level Medicaid data. The API stores an account identity, a display email
  shown only to its owner, sessions, locks, and the targets a user sets on published aggregate measures.

## Layout

| Path | What it is |
|---|---|
| `src/domain/Account.mjs` | `AccountOwner`, object container for Account (`RegisterAccount`, `RecordAccountSignIn`, `ReadAccount`) |
| `src/domain/MeasureTarget.mjs` | `MeasureTargetOwner`, object container for MeasureTarget (`SetMeasureTarget`, `ReviseMeasureTarget`, `RetireMeasureTarget`, `ReadMeasureTargetStatus`, `ReadActiveMeasureTargets`) |
| `src/domain/MyTargetsEditing.mjs` | `MyTargetsEditing`, program container (`OpenMyTargetsForEditing`, `SaveMyTargets`, `CancelMyTargetsEditing`) |
| `src/domain/SignIn.mjs` | `SignIn`, program container (`SignInAccount`: register the account or record the sign-in through `AccountOwner`, start the new session, then end the previous session and release its locks) |
| `src/domain/SignOut.mjs` | `SignOut`, program container (`SignOutAccount`: release the session's locks, then end the session) |
| `src/platform/sessions.mjs` | D2: 12-hour sessions in `user_session` (only the SHA-256 of the cookie token is stored), the `dp_session` cookie |
| `src/platform/enqueue.mjs` | D2: in-memory enqueue lock table persisted to `enqueue_lock` (L1, R1) |
| `src/platform/operationLedger.mjs` | D2: `operation_ledger` and boot resume (R1); no operation kinds yet |
| `src/platform/identityTokens.mjs` | Adapter: Google and Apple ID token verification against the providers' JWKS (`jose`) |
| `src/platform/db.mjs`, `src/platform/migrate.mjs` | `pg` adapter and boot-time SQL migrations from `migrations/` |
| `src/http/*` | Thin route adapters, CORS allowlist, JSON body and boundary normalization, sign-in attempt limit |
| `src/app.mjs`, `src/server.mjs` | Composition root and entry point (boot: migrate, restore locks, resume ledger, listen) |
| `src/data/measureCatalog.json` | Generated measure catalog (id, unit, betterDirection, label) |
| `scripts/build-measure-catalog.mjs` | Regenerates the catalog from `wireframe V1/app/src/lib/simpleMode/sourcedDisplay.generated.js` |

## Routes

| Route | Body | Result |
|---|---|---|
| `GET /health` | | `200 {status:"ok"}` after a database round trip |
| `POST /auth/google` | `{credential}` (Google Identity Services ID token) | `200 {account, session}` and `Set-Cookie: dp_session`. A rejected token is `401 {error:"invalid-id-token", reason}` (`audience`, `issuer`, `signature`, `expired`, `algorithm`, `missing-claim`, `malformed`, …). If the provider's key server cannot be reached the answer is `503 {error:"identity-provider-unavailable", reason:"key-set-unavailable"}`. Signing in again in the same browser starts the new session first, then ends the previous one and releases its locks; any storage failure is `503` with no new cookie, and the browser stays signed in on its previous session. More than 60 sign-in attempts per client IP in 10 minutes is `429` (recorded in the plan's coordination table) |
| `POST /auth/apple` | `{idToken}` (Sign in with Apple ID token) | same |
| `POST /auth/sign-out` | | releases the session's locks, ends the session, then clears the cookie. A storage failure is `503` and the cookie is not cleared. Not rate limited |
| `GET /me` | | `{account, session, failedOperations}` |
| `GET /targets` | | the account's active targets |
| `POST /targets/edit` | | `200 {editing:true}`, `503` if the lock cannot be stored, or `409 {holder}` when the targets are open in another browser or device. The lock holder is the session (ADR-001 Decision 3): the denial applies between browsers and devices; tabs share the lock. A save releases the lock the tabs share, so another tab must reopen editing before its own save and gets `409` until it does (the front end reopens before every edit) |
| `PUT /targets` | `{targets:[{measureId, value, note, retire}]}` | requires the held lock. `200` committed, `422` rolled back with per-target `errors` (including `target-changed` when the stored target moved on), `409` lock not held, `503` storage failure (on commit: "The save may not have completed. Reload to check."). Body: `{committed, saved, retired, rejected, committedTargets, lockReleased, errors}`. The save releases the lock either way; reopen to edit again. A commit whose lock release then fails is still `200`, with `lockReleased: false` |
| `DELETE /targets/edit` | | cancel: releases the lock |

Boundary rules (`src/http/boundary.mjs`): the body must be `application/json` and at most 64 KB;
`measureId` is a non-empty string; `value` is a finite number (it may be omitted only when
`retire` is true); `note` is a string of at most 500 characters (omit it to keep the stored note,
send `""` to clear it); `retire` is a boolean; at most
100 targets per request. Anything else is a `400`. Server-side value rules (MeasureTargetOwner
`IsTargetValueWithinUnitRange`): percent 0–100; dollars (`usd`, `usd_pmpm`) any finite number,
negative included (for example `dsh-payments-net`, published at −1,740,069; Director ruling, ADR-001 "Business rules recorded with this ADR"); every other unit
(counts, rates, ratios, days, hours, index) zero or more.

CORS: only origins listed in `ALLOWED_ORIGINS` may call the API, with credentials. A request whose
`Origin` is not on the list gets `403` and no CORS headers. Requests without an `Origin` header
(health checks, curl) are served.

## Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. On Railway, use the private network URL (`${{Postgres.DATABASE_URL}}`, host `postgres.railway.internal`): it stays inside the project network and needs no TLS |
| `DATABASE_SSL` | no | `true` to connect with TLS. The server certificate is verified (`rejectUnauthorized: true`); a self-signed server needs `DATABASE_SSL_CA`. Default `false` |
| `DATABASE_SSL_CA` | no | PEM CA bundle (the certificate text) used to verify the Postgres server when `DATABASE_SSL=true` |
| `TRUST_PROXY` | no | `true` on Railway: the sign-in attempt limit keys on the right-most `X-Forwarded-For` entry, the one Railway's proxy appends. Default `false` (socket address) |
| `PORT` | no | Listen port. Railway sets it. Default `8080`; use `5046` locally |
| `ALLOWED_ORIGINS` | yes, in practice | Comma-separated CORS allowlist. Production: `https://demo.decisionpro.io`. Local: `http://localhost:5040` |
| `COOKIE_DOMAIN` | no | `Domain` attribute of the `dp_session` cookie. Set `decisionpro.io` in production so `api.decisionpro.io` and `demo.decisionpro.io` share it; leave unset locally |
| `GOOGLE_CLIENT_ID` | for Google sign-in | The Web OAuth client id; the `aud` every Google ID token must carry. Unset: Google sign-in is refused |
| `APPLE_SERVICES_ID` | for Apple sign-in | The Apple Services ID; the `aud` every Apple ID token must carry. Unset: Apple sign-in is refused |
| `DISPLAY_TIME_ZONE` | no | Time zone of the "since 3:42 PM ET" lock-holder message. Default `America/New_York` (Kentucky spans Eastern and Central time, so the message says ET) |

No client secret is needed: the browser obtains the ID token (Google Identity Services, Sign in
with Apple JS) and the API verifies its signature, issuer (`accounts.google.com` /
`https://accounts.google.com`; `https://appleid.apple.com`), audience and expiry against the
providers' published JWKS. Only RS256 is accepted, and `exp`, `iat` and `sub` are required.

## Run locally

```powershell
cd decisionpro-api
npm install
npm test                       # node --test; in-memory Postgres (pg-mem), no external services
```

To run the server you need a Postgres 14+ database. The BW Postgres from `npm run bw:up`
(port 5042) can host a separate database for it, for example `decisionpro_api`:

```powershell
$env:DATABASE_URL = 'postgres://<user>:<password>@127.0.0.1:5042/decisionpro_api'
$env:PORT = '5046'
$env:ALLOWED_ORIGINS = 'http://localhost:5040'
$env:GOOGLE_CLIENT_ID = '<web client id>'
npm start
```

Port 5046 is `decisionpro_api_5046` in `ports.json`.
Run it from the integrated terminal or as a hidden background process, never in a visible console
window. Browsers accept `Secure` cookies on `http://localhost`.

Regenerate the measure catalog after `npm run simple:sourced` changes the simple-mode data:

```powershell
node decisionpro-api/scripts/build-measure-catalog.mjs
```

## Tests

`npm test` covers every MeasureTarget and Account arrow and rejection (unknown measure,
out-of-range value, revise or retire of an absent target, set of an active one, a lost race
refused as `target-changed` through a simulated zero-row upsert), notes kept or cleared on revise, a
concurrent first sign-in, the lock denial naming its holder ("open for editing in another browser
or device … ET"), save without the lock, rollback of a save with a rejected target, lock release on
save, cancel, sign-out, a new sign-in and session end, two tabs of one session sharing the lock, two
accounts that cannot see or change each other's targets, `503` on begin, commit, rollback and
lock-persist failures, `503` when a new sign-in cannot start its session or release the previous
session's locks and when sign-out cannot end the session (the browser stays signed in), a commit
whose lock release fails (`200`, `lockReleased: false`), lock restore and ledger resume at boot,
CORS rejection, cookie attributes, session ids hashed at rest, the sign-in attempt limit (and
sign-out exempt from it), boundary normalization, and ID token verification with locally generated
keys, including the reason each rejected token is refused and `503` when the key server is
unreachable or answers an error.

The test database is pg-mem behind the same `db.mjs` interface. **pg-mem fakes transactions**: it
ignores `BEGIN`/`ROLLBACK` sent as separate statements, so the test pool gives each transaction
snapshot semantics (`test/helpers.mjs`); it also reports one row for a conditional upsert or an
`ON CONFLICT DO NOTHING` that wrote nothing. The pg-mem suite therefore proves the containers'
logic and the HTTP mapping, not Postgres concurrency. The gated real-Postgres suite
`test/postgresCatalog.test.mjs` is skipped unless `DATABASE_URL_TEST` names a scratch database
(never production: it applies the migrations and writes test rows):

```powershell
$env:DATABASE_URL_TEST = 'postgres://<user>:<password>@127.0.0.1:5042/decisionpro_api_test'
npm test
```

It proves exactly four things on real Postgres:

1. no user triggers on public tables (`pg_trigger`, non-internal);
2. no rules on public tables (`pg_rules`);
3. every foreign key's `confdeltype` and `confupdtype` are `r` (RESTRICT) or `a` (NO ACTION);
4. through `MeasureTargetOwner.SetMeasureTarget` itself, two overlapping save transactions on the
   same new target: the second blocks on the first's row, exactly one writes revision 1, and the
   other writes no row and gets `target-changed`; and a rolled-back save leaves no row.

It does not test the HTTP layer, sessions or locks against real Postgres. `DATABASE_SSL_TEST` and `DATABASE_SSL_CA_TEST`
configure TLS for it. Tests never simulate two API processes: ADR-001 forbids that topology.

## CodeXen exception register

| Exception | Reason | Evidence |
|---|---|---|
| One container instance per request | Request isolation, the canon's concurrency exception, recorded in ADR-001 Decision 1. Molecules await Postgres; under Node's event loop two requests on a shared instance would interleave their run state. Independent copies need no signature. | `src/http/routes.mjs` (`newAccountOwner`, `newMeasureTargetOwner`, `newMyTargetsEditing`, `newSignIn`, `newSignOut`) |
| Dollar targets may be negative | Director ruling, ADR-001 "Business rules recorded with this ADR" (2026-10-28), recorded in the plan's Molecule sequence step 3: `usd` and `usd_pmpm` accept any finite number; counts and other non-dollar units stay ≥ 0, percent 0–100. | `src/domain/MeasureTarget.mjs` (`DOLLAR_UNITS`, `IsTargetValueWithinUnitRange`), `test/measureTarget.test.mjs` |
| HTTP adapters take `(req, res)` | Framework wiring, not containers (plan, Exceptions). | `src/http/*` |
| Platform modules have ordinary signatures | Conventional technical utilities (plan, Exceptions). | `src/platform/*` |
| `ReadMeasureTargetStatus`, `ReadActiveMeasureTargets`, `ReadAccount` | Owner read molecules added beside the plan's Business Actions so the program and the routes read through the owner instead of issuing their own SQL. | `src/domain/*` |
| `TargetRowsWritten` / `RevisionRowsWritten` in place of the plan's single `RowsWritten` | One counter per persistence unit, so each ACTIVE atom's post-check reads its own result. | `src/domain/MeasureTarget.mjs` |
| `CurrentTargetStatus` / `NextTargetStatus`, `CurrentTargetRevision` / `NextTargetRevision`, `StoredTarget*` / `NextTarget*` in place of the plan's `TargetStatus`, `TargetRevision`, `TargetUnit`, `BetterDirection` | One canonical name per datum: the stored row, the requested input and the revision being written are different data. `TargetValueIsSet` is dropped: the boundary guarantees a value unless retiring. `TargetNoteChange` (`replace` or `keep`) is named business state for "keep the stored note". | `src/domain/MeasureTarget.mjs` |
| `SignIn` and `SignOut` program containers | The sign-in and sign-out workflows (owner molecules, then session and lock mechanisms) are not route logic. Field maps, molecule sequences and the sign-in order decision are in the plan; both are in the scope file. | `src/domain/SignIn.mjs`, `src/domain/SignOut.mjs` |
| In-memory sign-in attempt limit, 60 per client IP per 10 minutes | Recorded in the plan's coordination table (what is limited, key, limit and window, the condition it handles); in memory because one process serves the API (ADR-001 T1), cited `// architecture-record: T1 ADR-001`. Sign-out is exempt. | `src/http/rateLimit.mjs`, `src/http/routes.mjs` |

## Deploy (Railway)

`railway.json` sets the start command `node src/server.mjs`, `numReplicas: 1` (ADR-001 Decision 1:
a second replica is an architecture change and needs a new ADR), the `/health` healthcheck, and
restart on failure (R1: a restart resumes from the ledger and the lock table).

Deploys must stop the old process before the new one starts (architecture-record: T1 ADR-001,
Decision 1). `numReplicas: 1` alone does not prevent a deploy from overlapping two processes, so the
service gets a **1 GB Railway volume mounted at `/data`**. The app never reads or writes it; it is
there only because Railway does not run two deployments of a volume-backed service at once. The
cost is a few seconds of API downtime per deploy. Railway's Config-as-Code schema (`railway.json`)
has no volume setting, so the volume is attached in the Railway dashboard (setup step 3 below).

Railway has deprecated Config as Code: new services cannot opt into `railway.json`, and existing
ones stop reading it on 2026-12-01. Its replacement is Infrastructure as Code in
`.railway/railway.ts` at the repository root (outside this folder). Until that file exists, enter
the same settings in the dashboard (step 3) and treat `railway.json` as the written record of them. A background
operation that fails while the service runs records the attempt and waits for the next boot; there
is no runtime retry (ADR-001 Decision 4). Set the service's
root directory to `decisionpro-api`.

## Setup the Director does himself

Agents never create accounts, accept terms, or create OAuth clients. These steps are yours. Keep
every id and secret out of the repository.

### 1. Google Cloud console: OAuth client (Web)

1. Open <https://console.cloud.google.com/>, pick or create the XenoDroid project for DecisionPro.
2. **APIs & Services → OAuth consent screen** (Google Auth Platform → Branding): app name
   "DecisionPro Kentucky", support email, authorized domain `decisionpro.io`, developer contact.
   Scopes: `openid`, `email`, `profile` only. Choose External; publish when ready (sign-in with
   only these scopes does not need verification review).
3. **Credentials → Create credentials → OAuth client ID → Web application**, name "DecisionPro demo".
4. **Authorized JavaScript origins**: `https://demo.decisionpro.io` and `http://localhost:5040`.
   No redirect URI is needed for the Google Identity Services button (ID token flow).
5. Copy the **Client ID** (`…apps.googleusercontent.com`). It is `GOOGLE_CLIENT_ID` for the API and
   the client id the front end passes to Google Identity Services. The client secret is not used.

### 2. Apple Developer: Services ID and Sign in with Apple

1. In <https://developer.apple.com/account/> → **Certificates, Identifiers & Profiles → Identifiers**,
   make sure an **App ID** exists with **Sign in with Apple** enabled (it is the primary App ID the
   Services ID groups under), for example `io.decisionpro.app`.
2. Create a **Services ID** (Identifiers → + → Services IDs), for example `io.decisionpro.demo`,
   description "DecisionPro demo". This identifier is `APPLE_SERVICES_ID` and the `clientId` the
   front end passes to Sign in with Apple JS.
3. Enable **Sign in with Apple** on the Services ID → **Configure**: primary App ID from step 1;
   **Domains and Subdomains**: `demo.decisionpro.io`; **Return URLs**:
   `https://demo.decisionpro.io/` (and any path the front end uses for the popup or redirect
   flow; Apple does not accept `localhost`, so local Apple sign-in needs a tunnel or is tested on
   the demo host).
4. **Domain verification** for `demo.decisionpro.io`: if the portal offers a verification file,
   download `apple-developer-domain-association.txt` and publish it at
   `https://demo.decisionpro.io/.well-known/apple-developer-domain-association.txt` (the GitHub
   Pages site), then click Verify.
5. Save. No private key is needed: the API only verifies Apple's ID token. A Sign in with Apple
   private key is needed only if a later change exchanges authorization codes server-side.

### 3. Railway: project, service and Postgres

1. In Railway, create (or open) the project for DecisionPro and add **Postgres**.
2. Add a service from the GitHub repository, name it `decisionpro-api`, set **Root Directory** to
   `decisionpro-api`. In **Settings**, set the start command `node src/server.mjs`, replicas `1`,
   healthcheck path `/health`, and restart policy "On failure" (the values in `railway.json`; a new
   service may not read that file, see Deploy).
   **Attach a volume** (architecture-record: T1 ADR-001): right-click the service, or use the
   command palette, → **Attach volume**, size 1 GB, mount path `/data`. The app does not use it; it
   makes Railway stop the old deployment before starting the new one, so two API processes never
   overlap.
3. Service **Variables**: `DATABASE_URL` = reference to `${{Postgres.DATABASE_URL}}` (private
   network, `DATABASE_SSL` unset); `ALLOWED_ORIGINS=https://demo.decisionpro.io` (no localhost in production); `TRUST_PROXY=true`;
   `COOKIE_DOMAIN=decisionpro.io`; `GOOGLE_CLIENT_ID`; `APPLE_SERVICES_ID`.
4. **Settings → Networking → Custom Domain**: add `api.decisionpro.io`. Railway shows the target
   host (`<something>.up.railway.app`) for the CNAME in step 4 and issues the certificate once DNS
   resolves.
5. Deploy and check `https://api.decisionpro.io/health` returns `{"status":"ok"}`. The boot log
   line `[decisionpro-api] boot {...}` shows migrations applied and locks restored.
   Cost estimate from ADR-001: about $5–15 a month (an estimate, not a quote).

### 4. DNS: CNAME at GoDaddy

Add a CNAME record: host `api`, value the Railway target from step 3.4. With the Scriptorium
GoDaddy CLI (`$scriptorium-godaddy-cli`), check first that no `api` record exists
(`gddy dns list decisionpro.io`), then:

```powershell
gddy dns add decisionpro.io --type CNAME --name api --data <railway-target> --ttl 600
```

If Railway also asks for a TXT verification record, add it the same way with `--type TXT`. Do not
change the existing `demo` record (GitHub Pages).

### 5. Secrets in Infisical

Store in Infisical (DecisionPro project, `prod` environment, and `dev` for local values):
`GOOGLE_CLIENT_ID`, `APPLE_SERVICES_ID`, and, if you keep it outside Railway, `DATABASE_URL`. The
Google and Apple ids are public identifiers but are kept with the other configuration so Railway,
local runs and the front end read one source. Copy them into the Railway service variables (or
use Infisical's Railway integration). Never commit them, and never put them in the static site's
repository beyond the public client ids its build needs.
