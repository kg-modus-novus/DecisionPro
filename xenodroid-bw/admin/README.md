# XenoDroid BW Admin (Phase 1)

Fixture-first workbench for DecisionPro / XenoDroid BW operators. Visual model matches mockups **21–26**. Not wired to Postgres or the CLI gate yet (Phase 2).

## Run

From repo root:

```powershell
npm run bw:admin
```

Or:

```powershell
npm --prefix xenodroid-bw/admin run dev
```

Open http://localhost:5043/

Legislative DecisionPro UI remains on **5040**.

## Phase 1 screens

| Nav | View |
|-----|------|
| Modeling → Data Flows | Catalog list (active + planned) → Open canvas (enrollment + MCO) |
| Modeling → InfoProviders | DSO / Cube / Query catalog (Display, Lineage, jump to Data Flow) |
| Modeling → InfoObjects | Characteristics + key figures on accurate path |
| Modeling → DataSources | Extract definitions → PSA / Source System |
| Context menus | Fixture modals: Display Data, Monitor, Lineage, Where-Used, Edit, Export, Run, chain log |
| Modeling → Source Systems | TOS-graded sources |
| Modeling → Process Chains | POC accuracy gate sequence |
| Administration → Load Monitor | Fixture LoadHistory |

Parlance toggle (SAP ↔ Common) changes labels only; technical IDs stay SAP-shaped.

## Phase 2 (later)

Hook Run / Display / Purge / Gate actions to `npm run bw:gate` and live `bw_*` reads.
