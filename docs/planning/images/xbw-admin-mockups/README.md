# XenoDroid BW Admin — UI ideation mockups

Concept screens for a future **XenoDroid BW** administrator console (SAP BW naming only).
**Ideation / look-and-feel only** — not wired to the runner yet.

Folder: `docs/planning/images/xbw-admin-mockups/`

---

## Canonical data-flow look & feel (21–26) — review these first

Modeled on the EndPend-style workflow canvas: status-colored nodes, legend, pan/zoom chrome, click = details, right-click = actions. **Dark theme.** Default orientation **bottom-up** (PSA at bottom → provider/report at top); toggle to **left-to-right**.

| # | File | What it shows |
|---|------|----------------|
| **21** | [21-data-flow-bottom-up.png](./21-data-flow-bottom-up.png) | **Default:** enrollment path, bottom-up, statuses on nodes |
| **22** | [22-data-flow-bottom-up-context-menu.png](./22-data-flow-bottom-up-context-menu.png) | Right-click menu on DTP (Run / Display / Edit / Modify / …) |
| **23** | [23-data-flow-bottom-up-details.png](./23-data-flow-bottom-up-details.png) | Single-click node → details inspector |
| **24** | [24-data-flow-ltr-orientation.png](./24-data-flow-ltr-orientation.png) | Same flow after **Left-to-right** orientation toggle |
| **25** | [25-data-flow-mco-bottom-up.png](./25-data-flow-mco-bottom-up.png) | Second path (MCO roster), bottom-up |
| **26** | [26-process-chain-bottom-up.png](./26-process-chain-bottom-up.png) | POC accuracy gate as process chain (bottom-up) |

### Interaction contract (for later wireframe)

| Input | Behavior |
|-------|----------|
| Drag empty canvas | Pan |
| Mouse wheel | Zoom |
| Double-click canvas | Reset fit |
| Orientation control | **Bottom-up** (default) ↔ **Left-to-right** |
| Single-click node | Select + open details (status, keys, Display Data, Edit, Where-Used) |
| Right-click node | Context menu: Run / Display Data / Display Monitor / Edit / Modify / Simulate / Lineage / … (by object type) |
| Node chrome | Status always visible (Completed / Active / Upcoming / Error); decisions as amber diamonds |

### Vertical stack (bottom → top)

`PSA` → `Transformation` → `Detail DSO` → `DTP` → `Cube` → `Query / Report (InfoProvider surface)`

---

## Earlier catalog & landscape (01–10)

Still useful as supporting navigation IA (PSA browser, schemas, DataProviders, KPIs, etc.). See files `01-` … `10-`.

## Earlier horizontal flow drafts (11–20)

Superseded for **look & feel** by **21–26**. Keep as alternate sketches only; do not treat as canonical orientation/interaction model.

---

## Hook-up map (after approval → wireframe → live)

| UI action | Existing backend |
|-----------|------------------|
| Run DTP / Data Request | `RetrieveAndLoad*` molecules / CLI |
| Purge TEST / empty-check | `PurgeTestLoads`, `VerifyWarehouseEmptyOfTest` |
| Accuracy gate chain | `npm run bw:gate` |
| Display Data | `bw_dso.*` / `bw_cube.*` queries |
| PSA objects | `bw_psa_meta` + filesystem PSA |
| Export to DecisionPro UI | `ExportAccurateLandingForUi` |

**Next after Director approval of 21–26:** interactive admin wireframe (fixture-driven canvas), then bind actions to `xenodroid-bw`.
