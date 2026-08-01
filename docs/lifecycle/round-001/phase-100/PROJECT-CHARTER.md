---
schema: scriptorium/development-canon/phase-document/v1
artifactId: DECISIONPRO-PHASE-100-PROJECT-CHARTER-001
phaseId: 100
phaseName: "Project Initiation and Initial Definitions"
round: "001"
documentType: project-charter
title: "DecisionPro Project Charter"
revision: 1
status: draft
projectId: "decisionpro"
owners:
  - "Director"
createdAt: 2026-07-31T04:10:00Z
updatedAt: 2026-07-31T04:10:00Z
provenance:
  sources:
    - id: docswamp-transcript
      uri: "docswamp/transcript.txt"
      note: "Source meeting evidence"
    - id: docswamp-requirements-assessment
      uri: "docswamp/Requirements Assessment.txt"
      note: "Interpretation only — not Director-approved specification"
    - id: planning-poc-lifecycle
      uri: "docs/planning/decisionpro-poc-lifecycle.md"
  generatedBy:
    - "Cursor development agent"
  confidence: high
trace:
  requirements: []
  artifacts:
    - "DECISIONPRO-PHASE-200-GENERAL-REQUIREMENTS-001"
  decisions:
    - "DP-DEC-001"
    - "DP-DEC-002"
    - "DP-DEC-003"
  evidence:
    - id: readme-identity
      uri: "README.md"
    - id: ports-json
      uri: "ports.json"
supersedes: null
---

# DecisionPro Project Charter

## Mandate

Build **DecisionPro Kentucky — Legislative Modeling & Decision Support System**, a product of **XenoDroid Inc.**, that helps legislators and oversight staff answer: where Medicaid money is going, what is driving change, and which interventions warrant examination — using an **accurate public-data POC** that demonstrates the warehouse and provenance spine, then sells the paid build-out for authorized operational data.

## Product identity

| Item | Value |
|------|-------|
| App ID | `decisionpro` |
| Local UI | http://localhost:5040 (ports `5040–5049`) |
| Demo host (documented) | https://demo.DecisionPro.io |
| Canonical Git | this repository (`dev/local repo`) |
| Legacy boundary | **LMDSys remains a separate legacy project and is not modified** |

## Goals

- **DP-GOAL-001 — Credible public POC:** Load and show real published aggregates (not synthetic fill on the accurate-demo path) with measure definitions and provenance.
- **DP-GOAL-002 — Sell the gap:** Make explicit what requires DMS/MCO authorized feeds, DUAs, or licensed specs (“it works; for X/Y/Z we need 1/2/3”).
- **DP-GOAL-003 — XenoDroid BW spine:** Implement an SAP-LSA-shaped warehouse (PSA → cleanse → detail DSO → cubes; Data Requests) in S3 + Postgres + TypeScript + React — SAP naming only; no licensed SAP BW.
- **DP-GOAL-004 — Trust path:** Every number supports “why trust this?” — definition, flow, load history, source, `FromSysID`, `AsOfDate` / freshness.

## Non-goals (POC)

- Person-level Medicaid / PHI / eligibility case systems
- Near-real-time claim/encounter cost-driver warehouse without authorized access
- Renaming or folding LMDSys
- Dual SAP vs non-SAP vocabulary layers
- Unregistered deployment landscapes beyond documented demo/marketing hosts

## Success criteria (POC)

1. Catalogue of KY Medicaid public sources with TOS grades exists and drives ingest.
2. Provisional 20–30 measures documented; subset loaded from real public sources after the post-build gate.
3. Post-build sequence completed: test-data load → thorough test → purge → real ETL → DSO/cube load → UI accuracy check.
4. Demo can state accuracy claims only for measures that passed the accuracy gate.

## Stop criteria

- Requirement to show PHI or unauthorized operational feeds on the public demo path
- Attempt to license or pretend to be SAP BW
- Scope expansion that blocks a sellable public-data POC

## Assumptions and unknowns

- Public Scorecard / data.medicaid.gov / DMS published PDFs remain accessible for automated or semi-automated Data Requests.
- PDF EQRO/evaluation extracts may be semi-manual in POC (`ATTRIBUTABLE`).
- Client will later choose the final measure set from the provisional catalog.
- Exact cloud account layout for S3/Postgres is TBD within documented hosts — do not invent landscapes.

## Decisions recorded

- **DP-DEC-001 (revised 2026-08-01):** Public-REAL hydration cutover — Evidence Rooms, Blender findings, role tiles, and pack magnitudes show only `LoadClass=REAL` values or explicit Gap objects. Synthetic analytical magnitudes are removed from the demo path. `LoadClass=TEST` remains solely for the pre-REAL gate harness and must be purged before accuracy claim.
- **DP-DEC-002:** Implementation name **XenoDroid BW**; SAP LSA naming only.
- **DP-DEC-003:** Author substantive round-001 lifecycle MDs; do not use thin Remodel as primary authoring path.
