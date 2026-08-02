---
schema: scriptorium/development-canon/phase-document/v1
artifactId: DECISIONPRO-PHASE-500-NFR-AND-TOLERANCES-001
phaseId: 500
phaseName: "System Tolerance and Nonfunctional Requirements"
round: "001"
documentType: nfr-and-tolerances
title: "DecisionPro NFR and Tolerances"
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
    - id: dns
      uri: "docs/DNS.md"
  generatedBy:
    - "Cursor development agent"
  confidence: medium
trace:
  requirements:
    - "DP-REQ-N-001"
    - "DP-REQ-N-002"
    - "DP-REQ-N-003"
    - "DP-REQ-N-004"
    - "DP-REQ-N-005"
  artifacts:
    - "DECISIONPRO-PHASE-900-SOLUTION-ARCHITECTURE-001"
  decisions:
    - "DP-DEC-001"
  evidence: []
supersedes: null
---

# DecisionPro NFR and Tolerances

## Nonfunctional requirements

| ID | Area | Requirement |
|----|------|-------------|
| DP-REQ-N-001 | Privacy | No PHI / person-level Medicaid on any POC path |
| DP-REQ-N-002 | Freshness honesty | UI must show source lag; never imply real-time claims |
| DP-REQ-N-003 | Availability (POC) | Local `5040` for build/test; demo host per `docs/DNS.md` for static/demo publish — not an invented HA landscape |
| DP-REQ-N-004 | Auditability | LoadHistory retained for every Data Request including purge and real ETL |
| DP-REQ-N-005 | Accuracy gate | Accurate path not released until post-build sequence passes |

## Post-build verification gate (mandatory)

1. Populate with **test** data (`LoadClass=TEST`).
2. Test thoroughly (automated + UI journeys + negative TOS cases).
3. **Empty** all test data from PSA, Detail DSOs, and cubes; verify empty-check.
4. Run **real** ETL Data Requests from public sources; load DSOs and cubes.
5. Run **Source Reconciliation** — check numbers/results against owning published source extracts (see `docs/planning/source-reconciliation.md`). Distinct from the Accuracy Gate sequence that contains this step.

## Tolerances

| Topic | Tolerance |
|-------|-----------|
| Numeric match | Exact match to published aggregate when grain matches; else documented rounding ≤ display precision and shown in provenance |
| Scorecard lag | Annual/multi-month lag accepted if labeled |
| PDF extract | Manual transcription OK in POC if LoadHistory cites report section |
| Performance | POC interactive reads within a few seconds on local/demo; not production SLA |
| Failure mode | Failed Data Request leaves prior REAL data intact; does not mix TEST into accurate path |

## Quality-attribute scenarios

- Source URL 404 → Data Request fails with clear status; UI shows last good REAL load or “unavailable,” never silent stale unlabeled data.
- Operator skips purge → empty-check fails → real ETL blocked.
