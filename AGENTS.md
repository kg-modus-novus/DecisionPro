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
- Synthetic fixtures only; no PHI
