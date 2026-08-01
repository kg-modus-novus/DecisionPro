# XenoDroid BW Admin

Workbench for DecisionPro / XenoDroid BW operators. Look & feel matches mockups **21–26**.

## Ports

| Service | Port |
|---------|------|
| Admin UI | 5043 |
| Admin read API | 5044 |
| Postgres | 5042 |

## Live mode (preferred)

Requires healthy Postgres (`npm run bw:up` from `xenodroid-bw` if needed) and prior REAL loads (`bw:gate` or `bw:real-etl`).

From repo root:

```powershell
npm run bw:admin:live
```

Open http://localhost:5043/ — header shows **LIVE** when `/api/bw/workbench` succeeds.

UI-only (fixture fallback if API down):

```powershell
npm run bw:admin
```

API-only:

```powershell
npm run bw:admin-api
```

## What is live

- Source Systems, DataSources, InfoProviders, InfoObjects (with live key-figure values)
- Data Flow catalog + canvases (enrollment, MCO, public hydration) with live counts/status
- Load Monitor from `bw_ctl.load_history`
- Process Chain status derived from loads
- Context **Display Data** / **Display Monitor** from DSO/cube/PSA/load_history

## Still fixture / deferred

- Run DTP / Purge / Gate write-back from UI
- Edit / Activate metadata write-back
