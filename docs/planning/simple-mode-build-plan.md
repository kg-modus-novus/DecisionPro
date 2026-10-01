# Simple mode ("Kentucky at a glance") — build plan

Source requirements: *DecisionPro Lite — Requirements* (Claude Doc, 2026-10-01), derived from the
2026-09-25 working call (Ken, Adam, Jeremy, Dillion, Darian). That document is an interpretation of
the call, not a Director-approved specification; this plan records where the build departs from it.

## Goal

One plain-language landing page that a non-expert legislator can read in seconds, with every number
sourced and dated, and the existing expert workspace one click behind it. This is release 1: the
landing dashboard (FR-1), the county heat map (FR-2), and the MCO comparison (FR-3). The rest of the
requirements appear as labeled gap cards with an unblock path.

## What ships in release 1

| Req | Delivered | Data (all already exported, REAL) |
| --- | --- | --- |
| FR-1.1 headline metrics | Medicaid members counted by county; MCO premium revenue; statewide premium per plan member; plans reporting for 2024 | `countyAccessContext.js` (DMS county counts, 2026-07); `mcparPlanPeriod.js` (CMS MCPAR 2024) |
| FR-1.2 most / least populated counties | Top and bottom 5 counties by members | `countyAccessContext.js` |
| FR-1.3 general default | Same default tile order for every visitor | — |
| FR-1.4 pinning | Pin up to 5 tiles; stored per browser in localStorage (`decisionpro.simple.pins.v1`) | — |
| FR-1.5 hot topics | Session-topic chips that open the gap cards | — |
| FR-2.1, 2.3, 2.4 heat map + drill-down | Kentucky county map, members in five quantile bands; click a county for its breakdown; back to statewide | `countyAccessContext.js` + generated `kyCountyShapes.js` |
| FR-2.6 suppression | Member counts 1–10 shown as "<11", with complementary suppression or a withheld total | applied to every displayed Medicaid member count; facility and bed counts are not person counts and are shown as published |
| FR-3.1, 3.2 MCO comparison | All six plans that filed MCPAR 2024; ordered only on reported measures and on derived ratios the export marks comparable; data-quality flags shown in text | `mcparPlanPeriod.js` |
| FR-6.1, 6.2 transparency | Each tile names its source and as-of period and opens the full workspace | — |

## Gap cards in release 1 (no figures shown)

AGENTS.md forbids hand-transcribing figures that are not exported ("a blocked … source becomes an
explicit Gap object with an unblock path — never a fixture standing in for real data"), and the
source catalogue marks 1915(c) waiver authorities as an explicit catalogue gap. These requirements
therefore ship as gap cards:

| Req | Gap | Unblock path |
| --- | --- | --- |
| FR-2.2 districts | Legislative district boundaries not loaded | Load LRC House/Senate district shapefiles and a county–district crosswalk through BW |
| FR-2.2 ADDs | Area Development District roster not loaded | Load the Kentucky Council of ADDs county roster through BW |
| FR-3.1 current contracts | Which plans hold contracts today is not exported (Anthem's 2025 exit is in a DMS PDF only) | Load the DMS managed care contracts page through BW |
| FR-3.2 quality | HEDIS/CAHPS per MCO not loaded | Export IPRO EQR plan-level results through BW |
| FR-3.2 payment speed | Prompt-pay data not public | Open-records request to the Department of Insurance |
| FR-4 demographics, programs | Age/sex/program by county not loaded | Load DMS monthly counts by age, sex and eligibility category |
| FR-5.1 waivers | 1915(c) slot and waitlist data is a catalogue gap | Export the CHFS BR Subcommittee waiver update (2025-09-17) through BW, then the CHFS dashboard due 2026-08 |
| FR-5.2 behavioral health | BH spend not exported | Export the DMS behavioral health committee figures through BW |

## Departures from the requirements document

- **No "top 3" marking (FR-3.1).** AGENTS.md: no plan is ranked on a measure whose reporting
  definition is unconfirmed, and nothing is presented as a verdict. The comparison sorts by a
  measure the visitor chooses, only among measures that pass the MCPAR-COMPARE-v1 dispersion rule,
  and says it is an ordering, not a recommendation.
- **Premium per plan member** is shown once, statewide, as all plans' reported premium revenue ÷
  all plans' reported enrollment, labeled as an approximation. It is not offered per plan or for
  ordering, because the export carries no comparability verdict for it.
- **Unstable-rate flag (FR-2.6)** is not delivered: release 1 shows no rates.
- **MLR** is shown but does not order plans: every plan reports 90%.
- **Entry point.** Simple mode is added as a new first card on the state landing page and a nav
  entry; the expert landing flow is unchanged. Making simple mode the default is a Director decision.

## Build steps

1. Generate Kentucky county SVG paths from `us-atlas` (Census cartographic boundaries) with a
   committed script → `src/data/alp/kyCountyShapes.js` (generated, do not hand-edit).
2. `src/lib/simpleMode/countDisclosureProgram.js` — suppression rule (CodeXen program container).
3. `src/lib/simpleMode/planComparisonProgram.js` — comparable-measure ordering (CodeXen program container).
4. `src/lib/simpleMode/simpleModeData.js` — tile definitions, quantile bands, gap cards (presentation).
5. `src/lib/simpleMode/pinnedTiles.js` — localStorage pins (UI preference, uiZoom pattern).
6. `src/components/SimpleHome.jsx`, `KyCountyHeatMap.jsx`, `McoComparison.jsx` + styles.
7. Wire view `simple-home` into `App.jsx`, `StateLanding.jsx` and the nav.
8. Vitest: suppression, comparison, pins, quantile bands, DOM render; full suite; `vite build`.
9. Rendered check (pending-rendered-gate unless an isolated desktop is available).

## CodeXen plan

**Architecture record.** None recorded for DecisionPro. The canon requires it before the first
background operation, persistence path, lock or cross-request business state; this change adds none
(read-only static exports; the only storage is a UI preference). Open Director item: record T/A/L/R
before any such mechanism is added.

**Applicability.**

| Unit | Classification |
| --- | --- |
| Small-count suppression | Rule → program container `CountDisclosure` |
| Comparable-measure ordering of plans | Decision → program container `PlanComparison` |
| Quantile banding, tile definitions, number formatting | Not applicable (formatting) |
| Pinned tiles in localStorage | Not applicable (UI preference, no business datum) |
| React components, map geometry script, App wiring | Not applicable (framework wiring, adapter) |

**Business Actions.** `DiscloseAggregateCounts` (CountDisclosure); `OrderPlansOnComparableMeasure`
(PlanComparison).

**Business objects and owners.** Read only: the published aggregate count rows and the MCPAR plan
rows are owned by the XenoDroid BW exports (`countyAccessContext`, `mcparPlanPeriod`). Neither
container writes or persists them; each holds read copies and run state only. No state transition.

**Container fields.** One module instance per container; runs are synchronous. Each run calls
`InitializeCountDisclosure` / `InitializePlanComparison` (deterministic INITIAL values, no nulls),
stages inputs into fields, runs the molecule and reads result fields. No parameters, returns or
locals in atoms beyond array-callback arguments (see Exceptions).

**Molecule sequence.**
- `DiscloseAggregateCounts`: `StageCountsForDisclosure` (passive) → `SuppressSmallCounts` (active) →
  `CountSmallCells` (passive) → `IsComplementarySuppressionNeeded` (question) → when needed:
  `FindNextSmallestShownCount` (passive) → `CountComplementaryCandidates` (passive) →
  `SuppressNextSmallestCount` (active) or `WithholdGroupTotal` (active) → `PublishDisclosedCounts` (passive).
- `OrderPlansOnComparableMeasure`: `CountReportingPlans` (passive) → `IsMeasureComparable` (question,
  reads the export's MCPAR-COMPARE-v1 verdict) → `OrderPlansByMeasure` (active) or
  `KeepPlansInPublishedOrder` (passive).

**Coordination mechanisms.** None added.

**Exceptions.** Array iteration callbacks inside atoms take their element argument (the language's
form of one statement over a collection). This is not one of the canon's two exception grounds;
recorded here for the Director to accept or reject.

**Boundaries.** Components normalise null measures to "not reported" before staging; no transaction;
no deletes.

**Persistence.** The only storage is per-browser localStorage for pinned tile ids, a UI preference
with no business datum; it is a persistence path in the generic sense and is recorded here as out of
CodeXen scope.

**Scope changes.** Create `docs/CODEXEN-SCOPE.md` listing the two program containers and the pending
architecture record; containers carry first-line `CodeXen-Container: v1` markers.
