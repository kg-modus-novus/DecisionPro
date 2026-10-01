# Simple mode release 2 — build checkpoint (resume here)

Checkpointed 2026-10-01 before a reboot. **Update 2026-10-01 (evening): Phase 1 research and Phase 2 build are done** — 256 sourced measures, 11 tabs, tests green (2 pre-existing OFR failures), isolated rendered check passing (`docs/evidence/simple-mode-r2/`). Remaining: independent review findings, commit, merge to `main`, publish to `gh-pages`.
Repo branch: `feat/simple-mode` (clean except the untracked files listed under "State on disk").

## Director decisions (2026-10-01, in chat)

1. Simple mode becomes the **default landing page**.
2. Hand-entered waiver and BH figures may appear in the **main build** before they go through BW.
3. Research the nursing-facility fee-for-service figure and source it. Adam said about $2B of
   ~$20B (~10%).
4. **Build all of it** and fill every page with real numbers. **Nothing may stay "Not loaded yet".**
5. **Remove every "Entered by hand" label.** Keep internal notes on what the data-load process
   needs later. The site must review as if it were fully hydrated and live.
6. When the ideal Kentucky measure is not published, show **both** the nearest real measure
   **and** a modeled estimate. The estimate tile carries a small "estimate" label and its method.
7. Deploy to the **live demo** (`demo.DecisionPro.io`, GitHub Pages `gh-pages`). Merge
   `feat/simple-mode` into `main`.
8. Record a **scoped AGENTS.md exception** for simple mode only, dated 2026-10-01. The SME view
   keeps the strict REAL/Gap rule.

## Inputs

- Plan: `docs/planning/simple-mode-release-2-plan.md`. Its §7 open decisions are now answered
  above.
- Adam call extract: `C:\Augen Studios Dropbox\Ken Greenwood\Modus Novus\Projects\DecisionPro\zoom-2026-10-01-1400-adam-decisionpro.md`.
- Adam's ChatGPT framework: the four questions, ten priority areas, KRS 7A.287 measures, KCARE
  long-term care and display rules. Its text is in that file's caption notes and in plan §1–4.
- Research schema: `wireframe V1/app/src/lib/simpleMode/sourced/RESEARCH_BRIEF.md`.

## State on disk (uncommitted)

- `docs/planning/simple-mode-release-2-plan.md` (new)
- `docs/planning/simple-mode-release-2-build-checkpoint.md` (this file)
- `wireframe V1/app/src/lib/simpleMode/sourced/RESEARCH_BRIEF.md` (new; shared brief for the
  research agents)

## Build plan

### Phase 1 — Research (6 parallel background general-purpose agents)

Each agent reads `RESEARCH_BRIEF.md` and writes one file,
`wireframe V1/app/src/lib/simpleMode/sourced/<area>.json`:

| Agent | Output | Scope |
|---|---|---|
| A | `spending.json` | CMS-64 Financial Management Report for KY, FY2023–FY2025: total, federal/state, MCO capitation, FFS by category including **nursing facility FFS (answers Adam's $2B / $20B)**, drug rebates, administration. FMAP FY2024–26. PMPM, year-over-year, and a decomposition estimate (enrollment vs. per-member cost). DMS admin positions/FTEs from the KY budget. Enacted 2024–26 Medicaid appropriation. |
| B | `outcomes.json` | KRS 7A.287: verify the statute text and list its measures. Core Set KY FFY2020–24 with national medians: WCV, CIS/IMA, BCS, CCS, COL, PPC, HBD, CBP, FUA, FUM, FUH, IET, OUD, adult preventive. Per-plan HEDIS/CAHPS from the IPRO EQR technical report. |
| C | `plans.json` | Current plans (5, Anthem exited 2025-01-01) with source. Prior-authorization metrics KY MCOs posted under CMS-0057-F (approval/denial rates, turnaround). DMS MCO quarterly reports (claims timeliness, denials), DOI prompt pay, withhold/quality incentive, credentialing. Admin-burden proxies plus estimates. |
| D | `longterm.json` | Care Compare KY vs. US: hospitalizations, ED visits, pressure ulcers, falls with major injury, antipsychotic use. PBJ staffing hours per resident day. Medicaid-certified NFs and occupancy by county. Closures 2023–26. Medicaid NF per diem vs. HCRIS cost. Newest waiver slot/waitlist update, plus a waitlist-by-county estimate. HCBS hours delivered and level-of-care delays (proxy plus estimate). |
| E1 | `population.json` | DMS membership by eligibility category, age and county (CHIP, expansion, aged, disabled, duals; MCO vs. FFS). Medicaid.gov eligibility performance indicators: application processing time, call center, renewals. Unwinding outcomes (procedural vs. ineligible). House/Senate district ↔ county crosswalk (LRC). ADD county roster. |
| E2 | `access.json` | HPSA primary care, dental and mental health by county (HRSA). Active Medicaid providers by county and type (proxy plus estimate). Appointment availability and travel time (proxy plus estimate). ED visits and inpatient days per 1,000, PQI, 30-day readmissions. Pharmacy: SDUD gross, top drugs, rebates, net. BH services: MOUD providers, crisis/988, children placed out of state. |

### Phase 2 — Build (after the research JSON lands)

1. `lib/simpleMode/sourcedData.js` adapter: imports the JSON, formats values, and exposes area
   tiles and drill-down models. Remove the `IS_REVIEW_BUILD` gate. Fold `reviewData.js` figures
   into the main build and drop the `handEntered` flags and labels.
2. Opening screen (`SimpleHome.jsx` At a glance), in order:
   - the briefing strip of largest open questions (governed headline rules: no verdicts, no product
     commentary);
   - the population and geography filter bar;
   - the area smart tiles: access, spending, MCO accountability, required outcomes, waiver
     waitlist, long-term care, BH, admin cost, pharmacy, hospital/ED;
   - the "Kentucky facts" side rail: members, most/fewest counties → heat map, My District.
3. Tile catalog: add, reorder (drag plus keyboard), pin and remove. Extend `pinnedTiles.js`
   (localStorage).
4. Smart-tile graphics: reuse `lib/smartTileVisuals.jsx` (metric / areaTrend / bullet / radial /
   barCompare / heroBreakdown).
5. Tabs to match plan §1:
   - At a glance;
   - Access to care, with the county map and district;
   - Spending, including admin and pharmacy;
   - Required health outcomes;
   - Plans and providers;
   - Long-term care, including waivers;
   - Behavioral health;
   - My District, with the real crosswalk.

   Replace every `GapList` with sourced content.
6. Measure contract on every card: value, trend, target or "Target: not set", comparison,
   responsible entity, period and as-of, source link. Estimates get an "Estimate" chip and a
   method note.
7. Default landing: `App.jsx` / `StateLanding.jsx` route the KY entry to `simple-home`.
8. Internal notes: `docs/planning/simple-mode-data-load-backlog.md` lists every non-BW figure and
   its `loadNote`. Add the AGENTS.md scoped exception.
9. Tests: update `simpleMode.test.js`, `simpleHomeDom.test.jsx` and `showMeSurfaces.test.jsx`. Add
   tests for no "Not loaded yet" and no "Entered by hand" text in simple mode, every tile having a
   source URL, and estimates carrying a methodNote. Then `npm run test` and `npm run build`.
10. Rendered check: `scripts/verify-simple-mode-isolated.mjs` via HiddenDesktopRunner (see memory
    `decisionpro-depot-briefing-build`). Otherwise report `pending-rendered-gate`.
11. Independent review subagent, plus a CodeXen review of any new program containers.
12. Commit on `feat/simple-mode`, merge to `main`, push, then build `wireframe V1/app` and publish
    `dist` to `gh-pages`. Follow the prior deploy commits: `git log origin/gh-pages`
    (e.g. 68fcad0) and keep the `CNAME` for demo.DecisionPro.io. Then send Adam the link
    (Ken does that).

## Resume instruction

After reboot, say "resume the simple mode build". Read this file, then start Phase 1 by launching
the six research agents in the background with the scopes above, each told to read
`RESEARCH_BRIEF.md` and write its JSON.
