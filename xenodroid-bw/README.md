# XenoDroid BW (DecisionPro POC)

SAP LSA naming only: **PSA → cleanse → Detail DSO → cubes**, driven by **Data Requests**.
Stack: filesystem PSA (S3 path-shaped) + Postgres + TypeScript runner + React accurate-landing export.

Not licensed SAP BW. Do not dual-name SAP vs non-SAP terms.

## Ports

- Legislative UI: `localhost:5040`
- Postgres: `localhost:5042` (docker compose)
- Admin workbench: `localhost:5043` — `npm run bw:admin:live` (UI + read API `:5044`; see `admin/README.md`)

## Operator gate (mandatory after build)

**Accuracy Gate** (`npm run bw:gate`) is pipeline / release control. The number-check step inside it is **Source Reconciliation** — also required standalone after every REAL refresh/upload. Plan: [`docs/planning/source-reconciliation.md`](../docs/planning/source-reconciliation.md).

```powershell
npm run bw:install
npm run bw:up
# wait until healthy, then:
npm run bw:gate
```

Sequence inside `bw:gate`:

1. migrate + seed catalog  
2. load **TEST** fixtures into PSA/DSO/cubes  
3. assert TEST rows exist  
4. **purge** TEST + empty-check  
5. **REAL** ETL (CMS PI enrollment CSV + curated KY DMS MCO roster)  
6. **Source Reconciliation** (`accuracy-check` vs re-fetched/published extracts; exports `sourceReconciliation.js` for Authoritative sources UI)  
7. export UI bundles (`accurateLanding.js`, hydration, Data Spectrum, Source Reconciliation)  

## Individual commands

| Script | Purpose |
|--------|---------|
| `npm run bw:migrate` | Apply SQL schemas |
| `npm run bw:seed` | SourceSystem / Measure / DataRequest |
| `npm --prefix xenodroid-bw run bw:test-load` | TEST loads |
| `npm --prefix xenodroid-bw run bw:purge` | Purge TEST |
| `npm --prefix xenodroid-bw run bw:real-etl` | REAL public ETL |
| `npm run bw:accuracy` | **Source Reconciliation** — compare cubes to owning sources + export UI last-run |
| `npm --prefix xenodroid-bw run bw:export` | Write UI export |

## Credentials

Local POC only (`decisionpro` / `decisionpro_poc_local`). Do not reuse for shared environments.
