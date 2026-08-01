---
schema: scriptorium/development-canon/phase-document/v1
artifactId: DECISIONPRO-PHASE-200-GENERAL-REQUIREMENTS-001
phaseId: 200
phaseName: "General Requirements Gathering"
round: "001"
documentType: general-requirements
title: "DecisionPro General Requirements"
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
    - id: docswamp-requirements-assessment
      uri: "docswamp/Requirements Assessment.txt"
      note: "Interpretation — not approved spec"
    - id: ky-source-catalogue
      uri: "docs/planning/ky-medicaid-source-catalogue.md"
  generatedBy:
    - "Cursor development agent"
  confidence: high
trace:
  requirements:
    - "DP-REQ-G-001"
    - "DP-REQ-G-002"
    - "DP-REQ-G-003"
    - "DP-REQ-G-004"
    - "DP-REQ-G-005"
  artifacts:
    - "DECISIONPRO-PHASE-300-BUSINESS-REQUIREMENTS-001"
  decisions:
    - "DP-DEC-001"
  evidence:
    - id: planning-poc
      uri: "docs/planning/decisionpro-poc-lifecycle.md"
supersedes: null
---

# DecisionPro General Requirements

## Actor and context map

| Actor | Context | Primary need |
|-------|---------|--------------|
| Legislator | Time-scarce; statewide view | Warning → cause → intervention options |
| LRC analyst | Deeper drill | Credible numbers, definitions, sources |
| Medicaid leadership | Program accountability | MCO/quality/cost context without PHI |
| Budget / oversight staff | Fiscal pressure | Trends, drivers (public grain for POC) |
| Demo viewer / buyer | Sales POC | Proof of accurate public pipeline + clear paid gaps |

## Goals and outcomes catalog

| ID | Outcome |
|----|---------|
| DP-OUT-001 | User sees where published money/enrollment/quality signals stand for KY |
| DP-OUT-002 | User can open provenance for any accurate-path number |
| DP-OUT-003 | System refuses to present `OUT_OF_POC` / unauthorized grain as fact |
| DP-OUT-004 | After build, real ETL populates DSOs/cubes and UI matches published sources |

## General requirements

- **DP-REQ-G-001 — Legislative decision support first:** Design for legislators and analysts, not consumer provider shopping.
- **DP-REQ-G-002 — Public-only accurate path:** Accurate POC ingest uses only catalogue rows graded `SAFE` or `ATTRIBUTABLE`.
- **DP-REQ-G-003 — Constrained executive view:** Start with a small indicator set drawn from the provisional measure catalog (order of 10–15 on landing; catalog holds 20–30).
- **DP-REQ-G-004 — Explain change:** Prefer views that support “what changed / why / whom / where to intervene” over raw data dumps.
- **DP-REQ-G-005 — Explicit gaps:** Surfaces that need authorized claims/eligibility must say so and point to paid follow-on.

## Constraints and assumptions

- No PHI; aggregate / de-identified / published only.
- Wireframe V1 exists as interaction prototype; accurate path will bind to XenoDroid BW after build + real-load gate.
- Demo hosting already documented (`docs/DNS.md`); no invented landscapes.
- Freshness lags are expected for CMS Scorecard and annual EQRO PDFs.

## Open questions

- Which Core Set measures does the client want on the first accurate landing screen?
- Degree of automation for DMS PDF evaluation extracts in POC vs manual curated CSV?
- Postgres/S3 tenancy for POC (local Docker vs cloud) — Director choice at build time.
