# Smart Tile Style Catalog & Role Matrix

**Status:** active — Director-authorized catalog → map → render  
**App ID:** `decisionpro`  
**Scope:** Accurate Landing + role-home signal tiles (wireframe V1)  
**Constraint:** No synthetic analytical magnitudes. Visuals may use `ACCURATE_LANDING.measureSeries` REAL points, peer REAL rates, catalogue counts, or Explicit Gaps.

## 1. Why this exists

Prior work shipped Fiori-*inspired* faces without a locked style catalog or content→style matrix. Most tiles fell back to big-number `metric` cards, so complex SAP Smart Tile styles were underused even when REAL series/peers existed.

This document is the decision artifact. Implementation maps DecisionPro `visual` ids to these contracts in `wireframe V1/app/src/lib/smartTileVisuals.jsx`.

## 2. SAP GenericTile content styles (bounded catalog)

Sources: SAP Help *Generic Tile* control overview; OpenUI5 / Fiori Elements microchart samples (`NumericContent`, `sap.suite.ui.microchart.*`); Director-supplied Launchpad / KPI tile screenshots.

| SAP / Fiori content style | OpenUI5 / Suite cue | Required data | DecisionPro `visual` | Notes |
|---------------------------|---------------------|---------------|----------------------|-------|
| Numeric KPI | `NumericContent` | value, unit/scale, optional trend | `metric` | Large value + scale/unit + ↑↓ |
| Comparison (bars) | `ComparisonMicroChart` | 2–4 labeled values | `barCompare` | Small label+value **above** filled pill; fills use **green / amber / red** only (good / warning / bad) — not blue |
| Area / sparkline | `AreaMicroChart` | ≥2 ordered points | `areaTrend` | Area fill + line; tick every period |
| Bullet (vs target) | `BulletMicroChart` | current, target, range | `bullet` | Actual bar + target marker |
| Radial / donut | `RadialMicroChart` | percent 0–100 (or ratio) | `radial` | Ring + % value |
| Hero + breakdown | KPI + ComparisonMicroChart | hero value + 2–3 peers | `heroBreakdown` | Large KPI left; comparison pills right |
| Status / deviation flag | Status / semantic tile | flag label + detail | `status` | Lagged, themes, catalogue state |
| Explicit Gap (DP) | — (not SAP) | gapId + access path | `gap` | Never draw fake charts |
| Harvey ball | HarveyMicroChart | portion of whole | *deferred* | No honest portion for most KY tiles yet |
| Action / icon tile | Launchpad action | icon + title | *out of scope* | Not used on Accurate Landing |

### Render contract (shared chrome)

Inspired by GenericTile layout — adapted to DecisionPro dark theme (not Fiori light chrome):

1. **Kind strip** — evaluation / load class cue (e.g. `Accurate · REAL · M-001`)
2. **Title** — measure or signal name
3. **Content region** — one `visual` body (always includes a graphical element)
4. **Footer** — as-of · FromSysID + CTA, pinned to the bottom of equal-height tiles in a row

**Graphics rule:** Every tile shows a meaningful graphic — area/radial/bullet/bars when data fits; county share-of-state bar; status disc; Explicit Gap glyph (never a fake chart). Multi-period area charts tick **every** period (including intermediates such as 2026-02 between 2026-01 and 2026-03).

**Fallbacks:** If a visual’s data prerequisites fail (e.g. `areaTrend` with &lt;2 series points), render `metric` with comparison pills (or `gap` when the tile is an Explicit Gap). Do **not** use a lone decorative “bump” column for single-observation metrics — prefer REAL peer compare rows (e.g. Fed KY total vs Pharmacy pub.) or a labeled full-width published-aggregate pill.

## 3. Inventory — data shapes available

### Accurate Landing measures (REAL)

| ID | Content | Series points | Best-fit styles |
|----|---------|---------------|-----------------|
| M-001 | Enrollment persons | 3 | `areaTrend`, `heroBreakdown`, `metric` |
| M-002 | YoY % | 3 | `bullet` (vs 0), `areaTrend`, `metric` |
| M-003 | County persons (top 3) | curated county set | `barCompare` |
| M-004 | Fed $M | 1 | `metric`, `heroBreakdown` |
| M-007 | MCO count | 7 | `bullet`, `metric`, `areaTrend` |
| M-010 | Child Core Set % | 2 | `radial`, `barCompare`, `areaTrend`, `status` |
| M-011 | Adult Core Set % | 3 | `radial`, `barCompare`, `areaTrend` |
| M-012 | Maternal PPC-AD % | 3 | `radial`, `areaTrend`, `metric` |
| M-014 | EQRO themes | 1 | `status` |
| M-017 | Pharmacy $M | 1 | `heroBreakdown`, `metric` |

Catalogue counts (steward / oversight): LOADED / CATALOGUED / BLOCKED / Gaps → `barCompare` or `status`.

### Role-signal tiles

Three per role; mix of REAL magnitudes, Explicit Gaps, status cues, and (policy) blender focus weights labeled as UI intent — not claim-grain analytics.

## 4. Content → style matrix (locked for this pass)

### Accurate Landing

| Role | Tile 1 | Tile 2 | Tile 3 | Tile 4 | Tile 5 |
|------|--------|--------|--------|--------|--------|
| Legislator | M-001 `areaTrend` | M-003 top-3 `barCompare` | M-003 bottom-3 `barCompare` | M-012 `radial` | M-002 `bullet` |
| Legislative staff | M-012 `radial` | M-014 `status` | M-001 `areaTrend` | M-010 `radial` | — |
| Budget analyst | M-017 `heroBreakdown` | M-002 `bullet` | M-004 `metric` | M-001 `areaTrend` | — |
| Medicaid leadership | M-007 `bullet` | M-014 `status` | M-010 `radial` | M-001 `areaTrend` | — |
| Policy analyst | M-010 `barCompare` | M-012 `radial` | M-017 `metric` | M-011 `areaTrend` | — |
| Oversight / auditor | M-010 `status` | M-007 `metric` | M-014 `status` | Catalogue `status` | — |
| Data steward | Catalogue `status` | M-001 `areaTrend` | M-021 `areaTrend` | M-007 `bullet` | — |

### Role-signal tiles

| Role | Signal 1 | Signal 2 | Signal 3 |
|------|----------|----------|----------|
| Legislator | HD spend `gap` | Rural distance `gap` | Maternal `areaTrend` (M-012 series) |
| Legislative staff | LRC `status` | Maternal `radial` | Sources ready `status` |
| Budget analyst | Pharmacy `heroBreakdown` | Inpatient `gap` | YoY `bullet` |
| Medicaid leadership | EQRO `status` | Avoidable ED `gap` | MCO count `bullet` |
| Policy analyst | Cross-domain `barCompare` (UI weights) | Scorecard `radial` | Law opening `status` |
| Oversight / auditor | Lagged `status` | MCO roster `bullet` | Gaps `gap` |
| Data steward | Gap labels `status` | Measure catalog `status` | Sources `barCompare` |

## 5. Implementation map

| Artifact | Role |
|----------|------|
| `docs/planning/smart-tile-style-catalog.md` | This catalog + matrix |
| `lib/smartTileVisuals.jsx` | Visual primitives + fallbacks |
| `data/roleTileProfiles.js` | Landing selection + style + series bind |
| `data/homeSmartTiles.js` | Signal tile visuals |
| `components/SmartTile.jsx` | Shared chrome |
| `styles.css` | Dense tile content layout |

## 6. Explicit non-goals

- Shipping OpenUI5 / licensed SAP BW controls
- Light Fiori Launchpad chrome on DecisionPro dark theme
- Harvey balls or multi-threshold Area bands without REAL threshold metadata
- Inventing historical periods beyond `measureSeries`

## 7. Sources (research)

- [SAP Help — Generic Tile](https://help.sap.com/docs/SAPUI5/b2f662dd9d7a4ec680056733050b4d34/a1998ecc0853481891f8bc81cf900c9a.html)
- [SAP-docs — Radial Micro Chart](https://github.com/SAP-docs/sapui5/blob/main/docs/06_SAP_Fiori_Elements/radial-micro-chart-1d7cebc.md)
- [Stack Overflow — Comparison Micro Chart on Generic Tile](https://stackoverflow.com/questions/46783657/comparison-micro-chart-on-a-generic-tile)
- Director screenshots: Launchpad KPI tiles, Evaluation KPI tiles, Comparison / Area / Bullet / Radial samples
