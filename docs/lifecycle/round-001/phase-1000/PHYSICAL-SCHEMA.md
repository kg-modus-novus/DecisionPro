---
schema: scriptorium/development-canon/phase-document/v1
artifactId: DECISIONPRO-PHASE-1000-PHYSICAL-SCHEMA-001
phaseId: 1000
phaseName: "Database Schema"
round: "001"
documentType: physical-schema
title: "DecisionPro Physical Schema Outline"
revision: 1
status: draft
projectId: "decisionpro"
owners:
  - "Director"
createdAt: 2026-07-31T04:10:00Z
updatedAt: 2026-07-31T04:10:00Z
provenance:
  sources:
    - id: phase-825
      uri: "docs/lifecycle/round-001/phase-825/XENODROID-BW-DATA-DESIGN.md"
    - id: phase-700
      uri: "docs/lifecycle/round-001/phase-700/BUSINESS-OBJECT-CATALOG.md"
  generatedBy:
    - "Cursor development agent"
  confidence: medium
trace:
  requirements:
    - "DP-REQ-B-003"
    - "DP-REQ-F-007"
    - "DP-REQ-N-004"
  artifacts: []
  decisions:
    - "DP-DEC-002"
  evidence: []
supersedes: null
---

# DecisionPro Physical Schema Outline

Postgres schemas (proposed). Names use LSA-oriented clarity; warehouse concepts keep SAP terms in documentation and object comments.

## Schemas

| Schema | Purpose |
|--------|---------|
| `bw_ctl` | Measure catalog, SourceSystem, DataRequest definitions, LoadHistory |
| `bw_psa_meta` | PSA object index (bucket/key, hash, FromSysID, request id) — binary remains in S3 |
| `bw_dso` | Detail DSO tables |
| `bw_cube` | Cube / aggregate tables |
| `bw_stg` | Optional cleanse staging |

## Control tables (sketch)

### `bw_ctl.source_system`

`from_sys_id PK`, `publisher`, `tos_grade`, `base_uri`, `attribution_notes`, `paid_follow_on_todo`

### `bw_ctl.measure`

`measure_id PK`, `name`, `definition`, `unit`, `grain`, `provisional_flag`, `suppression_policy`

### `bw_ctl.measure_source`

`measure_id`, `from_sys_id`, PK `(measure_id, from_sys_id)`

### `bw_ctl.data_request`

`data_request_id PK`, `from_sys_id`, `target_psa_prefix`, `load_class`, `active`

### `bw_ctl.load_history`

`load_history_id PK`, `data_request_id`, `started_at`, `completed_at`, `source_uri`, `as_of_date`, `row_count`, `content_hash`, `status`, `load_class`

## Detail DSO examples (sketch)

All fact tables include: `from_sys_id`, `as_of_date`, `load_class`, `load_history_id`, and domain keys.

- `bw_dso.dso_enrollment_state` — state × period enrollment / expenditure published facts  
- `bw_dso.dso_enrollment_county` — county counts  
- `bw_dso.dso_mco_roster` — MCO contract/roster events  
- `bw_dso.dso_quality_scorecard` — Scorecard/Core Set published rates  
- `bw_dso.dso_mco_eval_extract` — curated EQRO/evaluation extract rows  

## Cubes (sketch)

- `bw_cube.cube_exec_landing` — landing indicators grain  
- `bw_cube.cube_mco_accountability` — MCO × FY themes  
- `bw_cube.cube_geo_context` — county context  

## Purge-safe test markers

- Every fact and cube row carries `load_class IN ('TEST','REAL')`.
- Purge operation: `DELETE FROM … WHERE load_class = 'TEST'` across `bw_dso` and `bw_cube`; remove TEST PSA index rows; optionally delete TEST S3 prefixes.
- Empty-check: `COUNT(*) WHERE load_class='TEST' = 0` and accurate UI queries `load_class='REAL'` only.
- Indexes: `(load_class)`, `(measure keys)`, `(from_sys_id, as_of_date)`, `(load_history_id)`.

## Migration / seed

- Seed SourceSystem and Measure from planning catalogue MDs (or generated SQL) before first REAL load.
- No production PHI seeds. TEST fixtures are synthetic and labeled.

## Security model (POC)

- No public write to Postgres from browser.
- Runner uses service credentials (local env / secrets not committed).
- Demo host serves UI reads of published aggregates only; do not expose admin purge endpoints on public demo without auth (local/operator CLI preferred for POC).
