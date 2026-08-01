---
schema: scriptorium/development-canon/phase-document/v1
artifactId: DECISIONPRO-PHASE-300-BUSINESS-REQUIREMENTS-001
phaseId: 300
phaseName: "Focused Business Requirements and Rules"
round: "001"
documentType: business-requirements-and-rules
title: "DecisionPro Business Requirements and Rules"
revision: 1
status: draft
projectId: "decisionpro"
owners:
  - "Director"
createdAt: 2026-07-31T04:10:00Z
updatedAt: 2026-07-31T04:10:00Z
provenance:
  sources:
    - id: measure-catalog
      uri: "docs/planning/provisional-measure-catalog.md"
    - id: ky-source-catalogue
      uri: "docs/planning/ky-medicaid-source-catalogue.md"
    - id: docswamp-requirements-assessment
      uri: "docswamp/Requirements Assessment.txt"
      note: "Interpretation only"
  generatedBy:
    - "Cursor development agent"
  confidence: high
trace:
  requirements:
    - "DP-REQ-B-001"
    - "DP-REQ-B-002"
    - "DP-REQ-B-003"
    - "DP-REQ-B-004"
    - "DP-REQ-B-005"
    - "DP-REQ-B-006"
  artifacts:
    - "DECISIONPRO-PHASE-400-FUNCTIONAL-REQUIREMENTS-001"
  decisions:
    - "DP-DEC-001"
  evidence: []
supersedes: null
---

# DecisionPro Business Requirements and Rules

## Business requirements

- **DP-REQ-B-001 — Measure catalog:** Every displayed accurate-path indicator resolves to a Measure with definition, unit, grain, source IDs, and provisional status until client selection.
- **DP-REQ-B-002 — Source authority by question:** MCO roster, quality outcomes, utilization, and eligibility are different SoT classes; do not collapse them.
- **DP-REQ-B-003 — TOS gating:** Only `SAFE` / `ATTRIBUTABLE` sources feed the accurate path. `RESTRICTED` / `OUT_OF_POC` / `UNKNOWN` (uncleared) are blocked or shown as gap-only.
- **DP-REQ-B-004 — Attribution:** Published publisher, dataset/report title, URI, and retrieval/`AsOfDate` are first-class.
- **DP-REQ-B-005 — Freshness:** Freshness is derived at report/aggregate time from underlying `AsOfDate` / load timestamps — not a static UI fake.
- **DP-REQ-B-006 — Suppression:** Follow source-published suppression; never invent person-level detail to “complete” a cell.

## Rule catalog

| RuleID | Rule | Decision / exception |
|--------|------|----------------------|
| DP-R-001 | Accurate demo path shall not display `LoadClass=TEST` facts | Exception: none on public demo |
| DP-R-002 | Demo-path analytical magnitudes shall be REAL or Gap only | Synthetic numbers forbidden after cutover; TEST harness only pre-purge |
| DP-R-003 | `FromSysID` required on fact records landed from PSA | Reject load if missing |
| DP-R-004 | `AsOfDate` required on measure facts | Reject or quarantine |
| DP-R-005 | HEDIS proprietary specification text shall not be republished | Link out; Core Set/public text OK |
| DP-R-006 | Claim-grain cost drivers are out of POC | Show gap card + paid TODO |
| DP-R-007 | EQRO/PDF extracts must retain report FY and page/section provenance | Manual extract allowed in POC |
| DP-R-008 | After purge, accurate path empty-check must pass before real ETL | Hard gate |

## Acceptance measures (business)

- Provisional catalog of 20–30 measures exists and traces to SoT rows.
- At least one enrollment, one expenditure/derived, one Scorecard/Core Set, and one MCO accountability measure can pass UI accuracy check after real load.
- Gap measures (e.g. claim-grain drivers) are visibly sold as paid follow-on, not faked.
