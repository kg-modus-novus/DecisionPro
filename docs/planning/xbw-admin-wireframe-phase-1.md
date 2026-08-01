# XenoDroid BW Admin Wireframe — Phase 1 Plan

**Status:** Phase 1 wireframe scaffolded (`xenodroid-bw/admin` · `:5043`)  
**App:** `xenodroid-bw/admin` · port **5043**  
**Product:** DecisionPro / XenoDroid BW (not LMDSys)

## Decisions

| Topic | Choice |
|-------|--------|
| Host | Separate Vite React app under `xenodroid-bw/admin` (not mixed into legislative 5040 UI) |
| Port | `5043` |
| Data | Fixture-driven Phase 1; hook to `xenodroid-bw` runner in Phase 2 |
| Look & feel | Mockups **21–26** (dark, bottom-up default, LTR toggle, pan/zoom, click details, right-click actions) |
| Nav | Workbench shell: **Modeling** + **Administration**; other RSA1 groups deferred |
| Parlance | UI label toggle SAP ↔ Common; technical IDs remain SAP |

## Phase 1 screens

1. **Modeling → Data Flows** — catalog list (active + planned), then canvas (enrollment + MCO)  
2. **Context-menu displays** — fixture modals: Display Data, DTP Monitor, Lineage, Where-Used, Edit/definition, Export, Run/Simulate, chain log  
3. **Modeling → Source Systems** — list with TOS grades  
4. **Modeling → Process Chains** — POC accuracy gate  
5. **Administration → Load monitor** — fixture LoadHistory / gate status  
6. **Chrome** — parlance toggle, Favorites/Find stubs (Find filters tree)

## Phase 2 (later)

Wire context **Run / Display / Purge / Gate** to CLI/molecules; live Postgres reads for Display Data.

## Out of scope (Phase 1)

Transport, Documents, BI Content, Translation, Metadata Repository, real credential dialogs, licensed SAP BW.
