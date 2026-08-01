---
schema: scriptorium/development-canon/phase-document/v1
artifactId: DECISIONPRO-PHASE-900-SOLUTION-ARCHITECTURE-001
phaseId: 900
phaseName: "Solution Architecture"
round: "001"
documentType: solution-architecture
title: "DecisionPro Solution Architecture"
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
    - id: readme
      uri: "README.md"
  generatedBy:
    - "Cursor development agent"
  confidence: high
trace:
  requirements:
    - "DP-REQ-G-002"
    - "DP-REQ-F-001"
    - "DP-REQ-N-003"
  artifacts:
    - "DECISIONPRO-PHASE-825-XENODROID-BW-001"
    - "DECISIONPRO-PHASE-1000-PHYSICAL-SCHEMA-001"
  decisions:
    - "DP-DEC-002"
  evidence:
    - id: ports
      uri: "ports.json"
supersedes: null
---

# DecisionPro Solution Architecture

## Components

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| PSA landing | S3-compatible object store | Raw Data Request lands |
| LSA / Detail DSO / cubes | Postgres | Cleansed detail + aggregates |
| Data Request runner | TypeScript | Retrieve, cleanse orchestrate, load, purge, history |
| Measure / source catalog | Versioned docs → later DB tables | Definitions & TOS |
| UI | Existing React wireframe (`wireframe V1`, port **5040**) | Legislative views + provenance |
| Demo publish | Documented GitHub Pages / `demo.DecisionPro.io` | Static or built UI per existing DNS docs |

## Deployment view (POC — documented hosts only)

```mermaid
flowchart TB
  subgraph localDev [Local_dev]
    Runner[TS_DataRequest_Runner]
    PG[(Postgres_LSA)]
    UI[React_Vite_5040]
  end
  subgraph objects [Object_store]
    S3[S3_PSA]
  end
  subgraph publicHost [Documented_demo_host]
    Pages[demo.DecisionPro.io]
  end
  PublicWeb[Public_KY_CMS_sources] --> Runner
  Runner --> S3
  Runner --> PG
  PG --> UI
  UI --> Pages
```

Do **not** invent unregistered staging/production landscapes. Cloud account details are a build-time Director choice within this shape.

## Integration contracts (logical)

- `POST /data-requests/:id/run` (or CLI equivalent) → LoadHistory
- `POST /data-requests/purge-test` → empty-check report
- `GET /measures/:id/value?grain=…` → value + provenance bundle
- `GET /provenance/:measureId` → definition, flow, history, source

Exact HTTP vs CLI for POC is an implementation detail; both must support the post-build gate.

## ADRs (draft)

| ADR | Decision |
|-----|----------|
| ADR-001 | XenoDroid BW over licensed SAP BW |
| ADR-002 | SAP naming only in warehouse layer |
| ADR-003 | Accurate path vs labeled fixture interaction path |
| ADR-004 | Post-build TEST → purge → REAL → accuracy gate is mandatory |

## Trust / failure boundaries

- Public internet retrieval failures do not corrupt REAL cubes.
- TEST and REAL are hard-separated by LoadClass.
- UI accurate mode refuses TEST facts.
- LMDSys is outside the trust boundary entirely (separate repo/product).
