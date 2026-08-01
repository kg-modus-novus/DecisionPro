---
schema: scriptorium/development-canon/phase-document/v1
artifactId: DECISIONPRO-PHASE-825-XENODROID-BW-001
phaseId: 825
phaseName: "Data Storage, Flow, Integration, and QoS Design"
round: "001"
documentType: xenodroid-bw-data-design
title: "XenoDroid BW Data Design"
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
    - id: ky-source-catalogue
      uri: "docs/planning/ky-medicaid-source-catalogue.md"
  generatedBy:
    - "Cursor development agent"
  confidence: high
trace:
  requirements:
    - "DP-REQ-F-001"
    - "DP-REQ-F-002"
    - "DP-REQ-F-003"
    - "DP-REQ-F-007"
    - "DP-REQ-N-005"
  artifacts:
    - "DECISIONPRO-PHASE-900-SOLUTION-ARCHITECTURE-001"
    - "DECISIONPRO-PHASE-1000-PHYSICAL-SCHEMA-001"
  decisions:
    - "DP-DEC-002"
  evidence: []
supersedes: null
---

# XenoDroid BW Data Design

**XenoDroid BW** mimics SAP BW LSA using **SAP naming only** (PSA, cleanse, Detail DSO, cubes, Data Requests). It is not licensed SAP BW.

## LSA layers

| Layer | Store | Role |
|-------|-------|------|
| PSA | S3 object landing | Persistent staging area — raw retrieved files as landed |
| Cleanse / enrich | Transient or staging schema | Validate, type, attach FromSysID/AsOfDate/LoadClass |
| Detail DSO | Postgres | Cleansed detail for domains (enrollment, MCO roster, quality extract, etc.) |
| Cubes | Postgres (aggregate tables or materialized views) | UI grains |

## Ownership

| Data | Owner | Notes |
|------|-------|-------|
| Public source files in PSA | DecisionPro ops | Immutable land; new retrieve = new object key |
| Detail DSO / cubes | DecisionPro | Derived; rebuildable from PSA + Data Requests |
| Measure catalog | DecisionPro product | Provisional until client selection |
| Source TOS grades | DecisionPro + Director | Catalogue-controlled |

## Ingestion / Data Requests

1. Select SourceSystem with TOS `SAFE` or `ATTRIBUTABLE` (REAL) or fixture pack (TEST).
2. Data Request retrieves into `s3://…/psa/<FromSysID>/<yyyy>/<mm>/<dd>/<requestId>/`.
3. Cleanse writes Detail DSO rows with lineage to LoadHistory.
4. Cube refresh aggregates Detail DSO for measures in scope.

### Load modes

| LoadClass | Purpose |
|-----------|---------|
| `TEST` | Controlled fixtures for thorough testing; must be purged before REAL |
| `REAL` | Public-source ETL for accurate POC path |

## Lineage and QoS

- Every fact row: `FromSysID`, `AsOfDate`, `LoadHistoryID`, `LoadClass`.
- Freshness derived at query time from min/max `AsOfDate` and load completion time.
- Failed cleanses quarantine bad rows; do not partial-publish unlabeled mixes on accurate path.
- Retention: keep PSA lands and LoadHistory for POC audit; purge only TEST fact projections (optionally retain TEST PSA under a test prefix if Director prefers — default: purge TEST from queryable DSO/cubes hard).

## Post-build sequence (data design binding)

```text
TEST Data Requests → thorough tests → Purge TEST → empty-check
→ REAL Data Requests (ETL) → Detail DSO + cube load → UI accuracy check
```

## Explicit non-goals

- Dual naming dictionaries (SAP vs “friendly” synonyms in code/docs)
- Overbuilt multi-product packaging
- Authorized MMIS/eligibility pipelines in this POC design
