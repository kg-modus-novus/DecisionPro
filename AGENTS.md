# DecisionPro agent guidance

## Authority and operating loop

- The Director is authoritative for scope, policy meaning, exceptions, and
  acceptance.
- Consult the Scriptorium Development Canon before planning or changing DecisionPro.
- Follow Understand -> Plan -> Implement -> Verify -> Independent Review ->
  Repair.
- Use `decisionpro` as the app ID and this directory as the canonical Git root.
- Preserve unrelated and pre-existing work.
- Do not modify the separate LMDSys legacy project unless the Director explicitly
  directs work there.

## Project conventions

- Treat `docswamp/transcript.txt` as source evidence and
  `docswamp/Requirements Assessment.txt` as an interpretation, not as a
  Director-approved specification.
- Preserve provenance when translating existing evidence into
  `docs/lifecycle/round-nnn/phase-*`; run lifecycle Verify before any
  Director-authorized Remodel.
- Use the reserved frontend block `5040-5049`.
- Keep observed facts, inferences, recommendations, and Director decisions
  distinct.
- Design legislative views around aggregate or de-identified information.
  Never introduce PHI, person-level Medicaid data, secrets, or credentials.
- Treat suppression, access control, auditability, source ownership, measure
  definitions, refresh dates, and known limitations as first-class
  requirements.
- Product attribution: DecisionPro is a product of XenoDroid Inc.
- Brand: DecisionPro Kentucky — Legislative Modeling & Decision Support System.
- Do not invent staging, production, data access, or deployment arrangements
  beyond the documented demo and marketing hosts.

## CodeXen

Apply CodeXen to business actions, rules, validations, decisions, state
transitions, explanations, intervention classifications, and coordinated
business-data access. Do not impose it on framework wiring, serialization,
configuration, or low-level utilities without business processing.

## Organization Funding & Resilience Intelligence (OFR)

The state-neutral (KY+FL) Funding & Resilience Evidence Room and its seven
backing adapters (`docs/planning/organization-funding-resilience-intelligence-plan.md`)
carry standing rules that apply to any future change touching this area, not
just the packages that built it:

- Never create accounts, register API keys, or accept terms of service. The
  Director-provisioned SAM.gov key is the sole exception — load it from its
  provided file into `SAM_GOV_API_KEY` at runtime only; never commit, log,
  print, or export it. `GovernedHttpClient`'s `RedactCredentialedUri()` must
  wrap any text derived from a credentialed URL before it reaches an error
  message, Gap reason, log line, or export.
- No PHI or person-level data outside the PSA layer: no officer/owner-person
  names, dates of birth, or addresses in any warehouse export or UI surface.
- No funding amount, financial ratio, ownership structure, or network
  position may be labeled waste, fraud, breach, distress-as-fact, or
  savings — every OFR signal is a review candidate, not a finding.
- Exact and inferred identity-crosswalk assertions live in separate
  collections/UI item types; an inferred assertion is never presented as a
  confirmed identity.
- A blocked, key-gated, or unreconciled source becomes an explicit Gap
  object with an unblock path — never a fixture standing in for real data.
- See `docs/planning/ofr-completion-report.md` for the full acceptance-gate
  record, every open Gap, and documented deviations from the original plan
  (including why the Funding & Resilience room is a dedicated component
  rather than routed through the Kentucky-only ALP cube engine).

## Operational briefing strip and depot inferences

The ranked cross-source inferences shown above the goal tiles on each
Operational Intelligence page (`docs/planning/operational-briefing-depot-inference-plan.md`)
carry standing rules:

- Every briefing headline is a governed template filled from exported data.
  It states the joined fact and the open question and never a verdict — no
  waste, fraud, breach, distress, improper, misconduct, violation, savings,
  or abuse wording — and no plan is ranked on a measure whose reporting
  definition is unconfirmed (`PROHIBITED_HEADLINE_TERMS` is enforced by test).
- Headlines and ledes describe the evidence and what it means for a
  decision-maker. They never describe DecisionPro itself — what was added,
  joined, exported, or should be built (`PRODUCT_COMMENTARY_TERMS` is
  enforced by test). Product changes belong in the plan documents.
- `county-access-context` rebuilds the per-county denominators (members or
  eligibles, HPSA, certified beds, HCRIS rollup); `ofr-award-grain-refresh`
  re-fetches the OFR-01 grain with the published award type and re-derives
  labels and continuation assessments in the right order.
- Briefings join already-exported, gate-reconciled facts and compute no new
  source figures; any new join key is emitted by a BW exporter with its own
  reconciliation check. A join that cannot run because a source slice is not
  loaded becomes a `gap` card with an unblock path, never an empty list.
- The MCPAR plan-period record never reads the PUF's submitter or contact
  question IDs; the exporter scans its own payload for them.
- Regenerate depot bundles with `npx tsx src/cli.ts ofr-depot-export` from
  `xenodroid-bw` (label backfill → continuation assessment → exports); a
  Release A label refresh on its own regresses continuation assessments.
- CMS Care Compare `chain_name` can be an individual owner's name. Only a
  label that passes `ChainLabelAtoms.ResolveChainLabel` (organization-marker
  allowlist) is stored or rendered; otherwise the chain is identified by its
  CMS `chain_id` and the label is withheld. Never widen the rule into a
  person-name detector, and never render the raw publisher field.
- SAM.gov lookups run only through `ofr-sam-resolve` (persisted, resumable,
  Retry-After aware); outcomes live in `bw_ctl.sam_entity_resolution`, the
  key only in `process.env`. `ky-contract-index` rebuilds the Kentucky MCO
  contract section index from the retained PSA PDFs; section text is hashed,
  not stored, and a citation match never determines applicability.

## Data load / refresh

- Follow `docs/planning/real-data-hydration-plan.md` **Load / refresh rules** and
  `.cursor/rules/decisionpro-data-load-refresh.mdc`.
- Core Set tiles use FFY reporting · MY care-window labels (`periodLabel`), not a
  bare Core Set Year date as “as of performance.”
- On download 404s, resolve alternate authoritative URIs before recording
  “unpublished” (see `xenodroid-bw/scripts/resolve-core-set-csv.mjs`).

## Verification

Run:

```powershell
npm run harness:verify
```

## Wireframe V1

- Start: `npm run dev` (Vite on http://localhost:5040)
- Tests: `npm run test`
- Build: `npm run build`
- Service: `app_5040` in `ports.json`
- Demo: https://demo.DecisionPro.io
- Public REAL + labeled Gaps on demo path; no PHI; TEST fixtures only inside BW gate harness
