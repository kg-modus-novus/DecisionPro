# OFR autonomous execution — resume prompt (after OFR-01)

Copy everything below the line into the session to resume the run.

---

Resume the Organization Funding & Resilience Intelligence (OFR) work package
for DecisionPro fully autonomously, end-to-end, without prompting me. I am the
Director; this resume order carries the same pre-authorization as the original
kickoff. All rules in `docs/planning/ofr-kickoff-prompt.md` remain in force —
re-read it first, then re-read
`docs/planning/organization-funding-resilience-intelligence-plan.md`, because
**both were amended after OFR-01 completed**.

Repository root:
`C:\Augen Studios Dropbox\Ken Greenwood\Modus Novus\Projects\DecisionPro\dev\local repo`

## Current state

- OFR-00 and OFR-01 are committed and gate-green (`dfaad62`, `73e4fd2`);
  per-package status is in `docs/planning/ofr-completion-report.md`.
- OFR-02 through OFR-09 have not started.
- The working tree contains **Director-authorized uncommitted work** completed
  between OFR-01 and this resume:
  - amended plan and kickoff prompt (SAM.gov key provisioned; `SAM_ENTITY`
    upgraded to hybrid-preferred; OFR-02 seed order revised; credential gate
    updated);
  - a new credential-expiry alert in the BW admin dashboard
    (`xenodroid-bw/admin/src/data/credentialRegistry.js`,
    `xenodroid-bw/admin/src/lib/credentialExpiry.js`,
    `xenodroid-bw/admin/src/lib/credentialExpiry.test.js`, plus wiring edits in
    `xenodroid-bw/admin/src/App.jsx` and `xenodroid-bw/admin/src/styles.css`).
    It shows an amber banner at the top of the admin page from 30 days before
    a managed credential expires and a red banner once expired. It is
    implemented, tested (7/7 admin vitest tests), built, and
    rendered-verified.
- `.cursor/rules/000-scriptorium-ecosystem-context.mdc` has a pre-existing
  unrelated local modification. Leave it exactly as found and exclude it from
  your commits.

## First actions on resume

1. Commit the authorized uncommitted work above (excluding the `.cursor` rule
   file) as a single commit, e.g.
   `feat: SAM.gov hybrid crosswalk plan amendment + admin credential-expiry alert`.
2. Verify the admin suite still passes before proceeding — the admin package
   has no test script; run it via the wireframe app's vitest:
   from `wireframe V1/app`, `npx vitest run --root "<repo>/xenodroid-bw/admin"`.
   Include this command in your regression runs from now on, since you will be
   told to keep these tests green.
3. Then begin OFR-02 per the amended plan.

## Amendments that change OFR-02

- The SAM.gov API key is Director-provisioned at
  `C:\Augen Studios Dropbox\Ken Greenwood\Modus Novus\Projects\DecisionPro\dev\SAM.gov API Key Expires 11-30-2026.txt`
  (outside the repo; expires 2026-11-30). Load it into env var
  `SAM_GOV_API_KEY` at runtime. Never commit, copy into the repo, or write it
  to logs, console output, PSA metadata, exports, commit messages, or evidence
  files.
- OFR-02 hybrid seed order: SAM.gov entity records are the primary UEI↔EIN
  authority (`exact-published`); USAspending recipient records corroborate —
  disagreements go to a flagged review queue, never silently resolved; IRS EO
  BMF, NPPES org records, CMS Provider Data CCNs, and CMS ownership entities
  extend the spine to EIN↔NPI↔CCN↔state IDs. If the key is absent or expired
  at run time, degrade to the USAspending-seeded path and record an explicit
  gap. Respect SAM.gov rate limits with serial pacing/backoff; prefer
  bulk/extract retrieval over per-entity calls where permitted.
- Preserve the credential-expiry alert. If any future package introduces
  another managed credential, register its metadata (never key values) in
  `credentialRegistry.js` rather than building a parallel mechanism.

## Everything else

Unchanged from the kickoff prompt: package order and gates, TEST → purge →
REAL discipline, state-neutral adapters hydrating both KY and FL, person-level
and no-adverse-conclusion gates, no account creation or ToS acceptance, no
push/deploy (local commits only), Scriptorium isolated UI testing rules,
honest-gap-over-fake-green, and the completion report at
`docs/planning/ofr-completion-report.md` updated as packages close. Work
through OFR-09; end only when its acceptance gates are green or every
remaining blocker is a recorded explicit Gap.
