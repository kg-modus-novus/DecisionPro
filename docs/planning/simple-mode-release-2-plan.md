# Simple mode release 2 — Kentucky (approved and built 2026-10-01)

Sources:
- **Adam's framework.** Adam Mather's ChatGPT review of the three LRC Healthcare Transparency
  Dashboard Subcommittee meetings (2026-07-16, 08-26, 09-23). It sets out four questions, ten
  priority areas, the KRS 7A.287 measures, a KCARE long-term-care section and display rules. It
  is a recommendation, not a subcommittee-adopted list.
- **Adam's call.** Zoom with Adam, 2026-10-01 14:02 ET. The DecisionPro-only extract is
  `Modus Novus/Projects/DecisionPro/zoom-2026-10-01-1400-adam-decisionpro.md` (Dropbox).
- **Data inventory.** The 2026-10-01 inventory of what Kentucky data is REAL, hand-entered or a
  gap (summarised in §5).

Builds on `simple-mode-build-plan.md` (release 1). That plan's guardrails still apply: no figure
without an export, gaps as gap cards, no plan ranking on unconfirmed measures, and small-count
suppression.

## 1. What changes from release 1

| Release 1 | Release 2 | Why |
|---|---|---|
| Headline tiles are raw facts (members by county, premium, plans reporting) | Headline tiles are the framework areas, drawn as smart tiles | Adam: "these are the right ones" |
| Raw facts are the page | Raw facts sit in a **"Kentucky facts" side rail** that links into the county heat map | Adam: "static … hard fact data … off to the side" |
| Pin up to 5 tiles | Default dashboard, plus **add from catalog**, drag to reorder, pin and remove | Adam asked; Ken confirmed |
| Tiles show a number | Every tile shows a simple graphic of its breakdown (`smartTileVisuals.jsx`, styles from `smart-tile-style-catalog.md`) | Agreed on the call |
| No problem list | A **briefing strip** above the tiles: the largest open questions, with affected population, accountable entity, next action and status | Framework's opening screen; Director's briefing format |
| Waiver waitlists is a gap or review tab | **Waiver waitlist is a headline tile**, with drill-down by waiver, slots filled and county or region | Adam: "a huge issue" |
| No population views | A population filter on every page: CHIP, children, working-age adults, older adults, people with disabilities, duals, community vs. institutional / FFS | Framework and Adam |
| (absent) | **New area: state administrative cost** of running Medicaid | Adam, new on the call |

Kept as they are: **My District** (Adam: keep it), the **SME view** behind simple mode, and
sources with as-of dates on every tile.

## 2. Opening screen layout

```
┌ Briefing strip: largest open questions (3–5, ranked by decision value) ────────────┐
│ headline · lede · affected population · accountable entity · next action · status   │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌ Population ▾ ┐ ┌ County / District ▾ ┐                ┌ Kentucky facts (side rail) ┐
┌ Smart tiles (default set; user can add/reorder/pin) ┐  │ Members statewide           │
│ Access to care     │ Spending & cost drivers │       │  │ Most / fewest members      │
│ MCO accountability │ Required health outcomes│       │  │ → County heat map          │
│ Waiver waitlist    │ Long-term care          │       │  │ Plans reporting            │
│ Behavioral health  │ Admin cost              │       │  │ → My District              │
└────────────────────────────────────────────────────┘  └────────────────────────────┘
```

Default tile order follows the framework's priorities, with the waiver waitlist promoted. The
tile catalog holds all ten framework areas plus admin cost and the cross-reference tiles (§4).

## 3. Measure contract (every tile and drill-down)

Each tile and drill-down shows:
- current value, trend, target, comparison and responsible entity;
- measurement period, last update, and service date vs. payment date;
- the denominator, the missing-data rate and the suppression note.

Further rules:
- **Missing data.** When there is no figure, show "Not loaded yet" with the unblock path. Never
  draw a fake chart.
- **Targets.** When no statutory, contract or Core Set target exists, show "Target: not set".
- **Missed targets.** A missed target links to its corrective action only where a REAL record
  exists (the MCPAR CAP and sanction records).
- **Briefing headlines.** These state the joined fact and the open question, never a verdict
  (`PROHIBITED_HEADLINE_TERMS`, `PRODUCT_COMMENTARY_TERMS`).

## 4. Areas, drill-downs and data status

| Tile | Drill-down | Have (REAL unless noted) | Gap → unblock |
|---|---|---|---|
| Access to care | County map, district; primary care / BH / dental / specialty | Primary-care shortage areas by county; members by county | Active Medicaid providers, accepting new patients, appointment availability, travel time → NPPES + MCO directories; GAP-RURAL-DISTANCE |
| Spending & cost drivers | Per member, YoY, state/federal share, capitation / FFS / directed payments / rebates | M-004 federal-reported expenditure (FY2023); enrollment trend; M-017 pharmacy total | PMPM (M-029), FMAP (M-005/006), reconciliation → CMS-64 financial management report; decomposition → GAP-CLAIMS-COST-DRIVERS |
| MCO accountability | Plan vs. contract requirement (not plan vs. plan); waste, fraud and abuse view | MCPAR 2024: MLR, appeals, grievances, fair hearings, program integrity, overpayments, sanctions, CAPs | HEDIS/CAHPS by plan → IPRO EQR; withhold → GAP-MCO-WITHHOLDING-DOLLARS; prompt pay → DOI open-records request |
| Required health outcomes (KRS 7A.287) | Fixed six-measure panel | WCV, BCS, PPC (Core Set, FFY2020–24, vs. national median) | FUA/FUM, HBD, CBP, CCS, COL → extend `extract-core-set-ky.mjs` if KY reported; **verify statute text before labeling anything "statutory"** |
| Waiver waitlist | By waiver; funded / filled / waiting / average wait; county or region map | Hand-entered only (`reviewData.js`, as of 2025-09-02) | Move through BW (CHFS BR Subcommittee waiver update); county distribution → CHFS waiver dashboard or DMS request |
| Long-term care (KCARE) | NF access by county, capacity, outcomes, payment adequacy, HCBS delivery | NF beds, star ratings, fines by county; HCRIS Medicaid day share and margins | MDS outcomes and PBJ staffing → extend Care Compare loader; Medicaid-accepting NFs, per diem vs. cost, LOC delays, HCBS hours delivered → DMS |
| Behavioral health & SUD | Spend by plan; follow-up, IET, MOUD, crisis | Hand-entered BH spend by plan (SFY2023–24) | Move through BW; FUH/IET → Core Set extract |
| Admin cost (new) | State admin spend, FTEs, admin share of Medicaid | — | CMS-64 administration lines; CHFS/DMS budget; state payroll transparency for DMS FTEs (sources to confirm) |
| Pharmacy value | Gross vs. net, cost drivers, per member by plan | M-017 aggregate | SDUD; rebates (CMS-64); per-plan acuity → GAP-PROVIDER-RISK-ADJ |
| Hospital & ED, provider admin burden, eligibility processing | — | — | Gap cards; claims (T-MSIS/TAF) or DMS reports |

**Cross-reference tiles** (Adam: "mash them together"):
- **BH spend per member by plan**: hand-entered BH spend ÷ MCPAR enrollment. This becomes REAL
  once BH spend comes through BW.
- **MCO accountability × BH follow-up**: needs plan-level FUH/FUA, which is a gap.
- **Per-person spend by plan, adjusted for acuity**: blocked on GAP-PROVIDER-RISK-ADJ. Until then,
  show the unadjusted figure only, labeled "not adjusted for how sick members are", and never
  order plans on it.

## 5. Population and geography filters

Every page shows the filters. Where a measure cannot be split, the filter reads "not available
for this measure"; it is never hidden.

What exists today:
- Core Set rows tagged child / adult / maternal / disabled.
- MCPAR by plan.
- County for members, primary-care shortage areas and NFs.

What is missing:
- CHIP, aged, dual and MCO-vs-FFS splits → DMS monthly counts by eligibility category (existing
  gap FR-4).
- District → LRC shapefiles and crosswalk (existing gap FR-2.2). `dimensions.js` is seed only.

## 6. Build order

1. Opening screen: briefing strip from the existing KY briefings (MCPAR sanctions and CAPs,
   overpayment concentration, county access). Area smart tiles from REAL data; gap tiles
   elsewhere. Kentucky facts side rail linking to the heat map and My District.
2. Tile catalog: add, reorder (drag and keyboard), pin and remove. Stored in localStorage,
   extending `decisionpro.simple.pins.v1`.
3. Population and geography filter bar with per-measure availability.
4. Required-outcomes panel; Core Set extract extension.
5. Waiver waitlist and BH through BW instead of hand entry; waiver drill-down.
6. Care Compare MDS outcomes and PBJ staffing for long-term care.
7. CMS-64 financial management report: PMPM, state/federal share, rebates and admin cost.
8. Port to Florida once Adam signs off on Kentucky.

## 7. Director decisions (2026-10-01)

Answered: simple mode is the default landing page; hand-entered waiver and BH figures may appear (now researched and re-verified in `sourced/`); every page is fully populated with no "not loaded yet" or "entered by hand" labels; where the ideal measure is unpublished, both the nearest real measure and a labeled estimate are shown; the FFS nursing facility figure is sourced (8.5% of FFY 2024 spending, $1.555B of $18.30B, vs Adam's ~10%). Build record: `simple-mode-release-2-build-checkpoint.md`; internal data-load backlog: `simple-mode-data-load-backlog.md`.

## 7a. Original open decisions

- **Saved dashboards across devices** need server-side persistence. Under CodeXen, that requires
  the T/A/L/R architecture record first; until then, layouts stay per browser.
- Whether simple mode becomes the default landing page.
- Whether hand-entered waiver and BH figures may appear in the main build before they move
  through BW (today they appear only in the review build).
- Adam's FFS skilled-nursing figure (~$2B of ~$20B) is unverified. Do not show it until it is
  sourced.
