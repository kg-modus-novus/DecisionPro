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
