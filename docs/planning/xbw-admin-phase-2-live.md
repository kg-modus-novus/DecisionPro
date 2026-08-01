# XenoDroid BW Admin — Phase 2 Live Hydration Plan

**Status:** implemented (read path)  
**App:** `xenodroid-bw/admin` (:5043) + read API (:5044)  
**Authority:** Director — populate interface from DecisionPro technical implementation and loaded data

## Goal

Replace fixture-only catalog/list/Display Data with **live reads** from Postgres (`bw_ctl` / `bw_psa_meta` / `bw_dso` / `bw_cube`) and the modeled LSA graph that already exists in the runner (Data Requests → PSA → DSO → Cube → export).

## Architecture

| Layer | Port | Role |
|-------|------|------|
| Admin Vite UI | 5043 | Workbench chrome, canvas, filters/sort |
| Admin read API | 5044 | Node HTTP over existing `pg` pool — **read-only** in this cut |
| Postgres | 5042 | Source of truth for catalog + loaded facts |
| Filesystem PSA | `xenodroid-bw/data/psa` | Object keys surfaced via `bw_psa_meta.object_index` |

Modeling graphs (node layout, technical names for TRFN/DTP) remain a **code catalog overlay** — there is no RSA1 metadata table yet. Live counts/status/Display Data come from DB.

## Endpoints (this cut)

| Method | Path | Source |
|--------|------|--------|
| GET | `/api/bw/health` | DB ping |
| GET | `/api/bw/workbench` | Assembled snapshot for all list views + flow graphs |
| GET | `/api/bw/display-data?object=` | PSA / DSO / Cube / Query peek (latest REAL load preferred) |
| GET | `/api/bw/load-monitor` | `bw_ctl.load_history` |
| GET | `/api/bw/dtp-monitor?object=` | Derived from load_history + source/target counts |

## Out of scope (later)

Mutating Run DTP / Purge / Gate from UI (still Confirm → toast until CLI bridge). Write-back Edit. Full RSA1 InfoObject repository.

## Operator start

```powershell
npm run bw:up          # if needed
npm run bw:admin:live  # API :5044 + Vite :5043
```

UI shows **Live** vs **Fixture** banner from `/api/bw/health`.
