# DecisionPro website fork — agent guidance

- App ID: `decisionpro` (this fork lives inside the DecisionPro canonical Git root, one level up).
- Ports: dev server on `5045` (decisionpro frontend block `5040–5049`); see root `ports.json`.
- Provenance: forked from the `decisionpro-web` marketing repo (`origin/main` @ `4f90b8f`,
  live at https://decisionpro.io) on 2026-09-03 via `scripts/fork-website.ps1`, then redesigned.
- Purpose: DecisionPro marketing site redesign — highlights Operational Intelligence
  Headlines and Funding & Resilience Intelligence in plain language.
- The live production site remains the separate `decisionpro-web` repo; this fork does not
  deploy anywhere and must not be treated as the production source without a Director decision.
- Brand: DecisionPro — Multi-State Public Program Decision Intelligence. Kentucky and Florida
  retain explicit state-product identities. Attribution: A product of XenoDroid Inc.
- Marketing copy rules (from product governance, enforced in the app by test):
  - Headlines/ledes state a joined public fact and the open question — never a verdict.
    Never use waste/fraud/breach/distress/improper/misconduct/violation/savings/abuse/negligence
    wording to describe what the product asserts.
  - Quoted headlines in `index.html` are verbatim product output; if the app's
    `operationalBriefings.js` data changes, re-generate before editing the quotes.
  - Every Funding & Resilience signal is a review candidate, not a finding.
- Never add PHI, secrets, or person-level Medicaid data.
- Verify changes with `npm run verify` (headless render gate) from this directory.
