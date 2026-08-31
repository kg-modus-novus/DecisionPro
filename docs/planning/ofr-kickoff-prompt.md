# OFR autonomous execution — kickoff prompt

Copy everything below the line into a fresh session to launch the run.

---

Execute the entire Organization Funding & Resilience Intelligence (OFR) work
package for DecisionPro fully autonomously, end-to-end, without prompting me.
I am the Director and I pre-authorize the full package as specified; do not
stop to ask questions. Where the plan and reality conflict, follow the gates,
record the deviation in your completion report, and continue.

## Context and authority

- Repository root (canonical git root, app ID `decisionpro`):
  `C:\Augen Studios Dropbox\Ken Greenwood\Modus Novus\Projects\DecisionPro\dev\local repo`
- Read these before writing any code, in order:
  1. `AGENTS.md` and `README.md` (operating loop, conventions, CodeXen scope)
  2. `docs/planning/organization-funding-resilience-intelligence-plan.md` —
     the authoritative specification for this run (packages OFR-00 … OFR-09,
     data model, source table, gates)
  3. `docs/planning/ky-medicaid-source-catalogue.md` and
     `docs/planning/dprofl-dashboard-review-operationalization-and-build-plan.md`
     (existing source governance and the state-neutral `state`-dimension
     architecture)
  4. `docs/planning/real-data-hydration-plan.md` (load/refresh rules) and
     `.cursor/rules/decisionpro-data-load-refresh.mdc`
  5. `xenodroid-bw/README.md` plus the existing adapter code in
     `xenodroid-bw/src/` (follow the atoms/molecules pattern;
     `RetrieveAndLoadKentuckyOperationalSources.ts` and
     `scripts/refresh-florida-public-sources.mjs` are the closest precedents)
- Director authorization date: 2026-08-31. This prompt is the authorization
  record for executing OFR-00 through OFR-09.

## Execution order

Run the packages in plan order: OFR-00 baseline, OFR-01 USAspending award
grain, OFR-02 identity crosswalk, OFR-03 IRS 990 org financials, OFR-04 HCRIS
facility financial distress, OFR-05 ownership/control network, OFR-06 sub-award
flow graph, OFR-07 waiver & grant horizon watch, OFR-08 Funding & Resilience
Evidence Room + Operational Intelligence integration, OFR-09 acceptance and
completion report. Do not start a package until the previous package's exit
gate passes (OFR-04 may overlap OFR-03; OFR-05/06 require OFR-02 green).

For every new data source follow the existing BW discipline: TEST load →
thorough checks → purge → REAL ETL → accuracy check → UI export, with retained
raw bytes, SHA-256 content hashes, load history, source URIs, and retrieval
timestamps in the PSA. Every adapter is state-neutral and hydrates both
Kentucky and Florida through the `state` dimension — never fork by state.

## Hard boundaries (these override speed and completeness)

1. Never create accounts, register for API keys, accept terms of service, or
   enter any credential anywhere. One credential is Director-provisioned and
   permitted: the SAM.gov API key in
   `C:\Augen Studios Dropbox\Ken Greenwood\Modus Novus\Projects\DecisionPro\dev\SAM.gov API Key Expires 11-30-2026.txt`
   (outside the repo; expires 2026-11-30). Load it into the local environment
   variable `SAM_GOV_API_KEY` at runtime. Never commit it, copy it into the
   repo, or write it to logs, console output, PSA metadata, exports, commit
   messages, or evidence files. Use it per the plan's `SAM_ENTITY` row:
   SAM.gov is the primary UEI↔EIN authority in OFR-02's hybrid seed order,
   with rate-limit-respecting pacing and the USAspending-seeded path as the
   recorded-gap fallback if the key fails. Any other key-gated source is an
   explicit catalogue Gap.
2. No PHI and no person-level data in any warehouse export or UI surface: no
   officer names, owner-person names, birth dates, or personal addresses.
   Publisher raw files may be retained in PSA with hashes. IRS 990 XML e-files
   (officer detail) are out of scope entirely.
3. No DataRepublican code, packaged data, or calculated fields. Official
   publishers only, exactly as listed in the plan's source table.
4. Never label any funding amount, ratio, ownership structure, or network
   position as waste, fraud, breach, confirmed distress, or savings. Signals
   are review candidates with owner, validation steps, caveats, and guardrails.
5. Inferred identity matches live in a separate collection from exact matches
   and are never presented as confirmed identity.
6. Blocked, key-gated, or unreconciled sources remain explicit Gap objects on
   the REAL path — never substitute fixtures, estimates, or synthetic values.
7. Do not modify the LMDSys legacy project, the marketing repo, or unrelated
   pre-existing work. Do not touch `.cursor/rules/000-scriptorium-ecosystem-context.mdc`
   (it has a pre-existing local modification; leave it as found).
8. Follow the Scriptorium isolated UI testing standard: run builds, unit
   tests, and non-rendered checks headlessly first; never open a visible
   terminal or GUI window on the Director's desktop; rendered verification
   runs isolated and its evidence is labeled `headless-validated` or
   `isolated-rendered` (never promoted); if isolation is unavailable, report
   `pending-rendered-gate` and continue headless.
9. Commit locally at each package boundary with a conventional-commit message
   naming the package (e.g. `feat: OFR-01 USAspending award-grain adapter`).
   Do NOT push to GitHub, publish to gh-pages, or deploy to the demo site —
   release remains a Director action after review.
10. Respect publishers: honest DecisionPro user agent, serial pacing,
    retry/backoff, request ceilings, robots/policy snapshots — reuse the
    controls already implemented in `bw:fl-refresh`.

## Failure handling

- On a download 404 or moved resource, resolve alternate authoritative URIs
  (see `xenodroid-bw/scripts/resolve-core-set-csv.mjs` precedent) before
  recording "unpublished"; on persistent network failure, retry with backoff,
  then record an explicit Gap with the attempted URIs and continue.
- On a failing test you introduced, fix it before proceeding. On a
  pre-existing failure unrelated to OFR, record it in the completion report
  and do not mask it.
- Never fabricate data, control totals, or reconciliation results to pass a
  gate. A red gate with an honest Gap beats a fake green.

## Verification (must all pass before OFR-09 closes)

From the repo root:

- `npm run test`
- `npm run build`
- `npm run harness:verify`
- The BW gate sequence for every new adapter (`npm run bw:gate` plus the
  adapter-specific accuracy checks you add)
- Headless interaction checks for `?state=KY` and `?state=FL` covering the new
  Funding & Resilience Evidence Room, new signals in all six goal categories,
  new Authoritative Sources rows, and walkthrough coverage per the parity
  contract; then isolated-rendered evidence stored under
  `docs/evidence/harness-workbench/` following the existing folder pattern.
- Cross-state leakage check: no Kentucky analytical magnitude on a Florida
  route and vice versa.

## Completion deliverables

1. All code, adapters, exports, tests, catalogue rows, and UI surfaces per the
   plan, committed per package.
2. Updated `docs/planning/ky-medicaid-source-catalogue.md` (new FromSysID
   rows), the Florida source registry, `README.md`/`AGENTS.md` where behavior
   changed, and the plan document's status line.
3. A completion report at
   `docs/planning/ofr-completion-report.md` with: per-package status
   (implemented / gap / out-of-scope), every recorded Gap and its unblock
   path, deviations from the plan with reasons, evidence paths and labels,
   test/build/harness results, and the exact commands for the Director's
   visual acceptance pass.

Work through the whole package to completion. End only when OFR-09's
acceptance gates are green or every remaining blocker is recorded as an
explicit Gap in the completion report.
