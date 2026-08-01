---
schema: scriptorium/development-canon/phase-document/v1
artifactId: DECISIONPRO-PHASE-400-FUNCTIONAL-REQUIREMENTS-001
phaseId: 400
phaseName: "Functional Requirements and Decomposition"
round: "001"
documentType: functional-requirements
title: "DecisionPro Functional Requirements"
revision: 1
status: draft
projectId: "decisionpro"
owners:
  - "Director"
createdAt: 2026-07-31T04:10:00Z
updatedAt: 2026-07-31T04:10:00Z
provenance:
  sources:
    - id: planning-poc
      uri: "docs/planning/decisionpro-poc-lifecycle.md"
    - id: phase-300
      uri: "docs/lifecycle/round-001/phase-300/BUSINESS-REQUIREMENTS-AND-RULES.md"
  generatedBy:
    - "Cursor development agent"
  confidence: high
trace:
  requirements:
    - "DP-REQ-F-001"
    - "DP-REQ-F-002"
    - "DP-REQ-F-003"
    - "DP-REQ-F-004"
    - "DP-REQ-F-005"
    - "DP-REQ-F-006"
    - "DP-REQ-F-007"
    - "DP-REQ-F-008"
  artifacts:
    - "DECISIONPRO-PHASE-825-XENODROID-BW-001"
  decisions:
    - "DP-DEC-002"
  evidence: []
supersedes: null
---

# DecisionPro Functional Requirements

## Functions

| ID | Function | Acceptance |
|----|----------|------------|
| DP-REQ-F-001 | **Run Data Request** — execute a named request that retrieves a public source into PSA | Request id, source URI, timestamps, row/file counts, status in LoadHistory |
| DP-REQ-F-002 | **Cleanse / enrich PSA → Detail DSO** | Invalid rows quarantined; `FromSysID`/`AsOfDate` preserved |
| DP-REQ-F-003 | **Load cubes** from Detail DSO aggregates for UI grain | Cube refresh recorded; measures resolve |
| DP-REQ-F-004 | **Read Detail DSO vs cube** — UI chooses appropriate grain | No silent wrong-grain join |
| DP-REQ-F-005 | **Resolve Measure from catalog** | Definition, unit, sources shown |
| DP-REQ-F-006 | **Show provenance (“why trust this number?”)** | Definition, data flow stage, LoadHistory, source attribution, freshness |
| DP-REQ-F-007 | **Purge test loads** | All `LoadClass=TEST` removed from PSA/DSO/cubes; empty-check report |
| DP-REQ-F-008 | **Gate accurate UI** | Accurate path reads only `LoadClass=REAL` (or equivalent) post-purge |

## Scenarios

1. **Test cycle:** Operator runs test Data Requests → thorough automated/UI tests → purge → empty-check pass.
2. **Real cycle:** Operator runs real ETL Data Requests for `SAFE`/`ATTRIBUTABLE` sources → DSO/cube load → accuracy checklist vs published values.
3. **Legislator path:** Open landing indicators → select one → open provenance → see source URI and `AsOfDate`.
4. **Gap path:** Open cost-driver deep dive needing claims → see OUT_OF_POC explanation and paid TODO (no fake numbers).

## Decomposition notes

- Data Request runner is TypeScript orchestration (molecule-level Business Action: *Retrieve Public Medicaid Dataset* / *Load Detail DSO* / *Refresh Cube* — names finalized at CodeXen implementation).
- React wireframe consumes cube/DSO read APIs or exported aggregates for POC; do not hard-code accurate numbers in UI once real path is live.
