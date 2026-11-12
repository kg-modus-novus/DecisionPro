# Oversight pages: early warning, follow the billers, provider patterns, explanation ledger, state oversight brief

**Asked:** Ken, 2026-11-12: "you become the release owner, build them all now", after asking why the module showed no new tabs. "Them all" is the five pages of the 2026-11-11 mockups (`Modus Novus/Projects/DecisionPro/mockups/oversight-next-2026-11-11`, 1 to 5), built as five new tabs of Potential Fraud Detection from real data, for every flagged service the data supports, not only the mockups' Kentucky and West Virginia examples.

**Not in this build:** law-and-policy items 6 to 9 (billing-code changes, DQ Atlas, state plan amendments, the suggestion script); the authorized provider list, the legislator and agency views and the agency response box (they need sign-in and a data agreement, so the pages say so); the "What to look for" panels on the older pages.

## 1. Applied recommendations (Ken did not decide these; each can be reversed)

1. **No figure shown describes fewer than 11 billers.** A count from 1 to 10 shows as "fewer than 11" and its dollars are withheld; ZIP areas with fewer than 11 billers are merged into "all other areas". This is the CMS small-cell rule applied to billers. The mockup's single "largest biller, $40.2M" bar is dropped: no figure describes one biller. The ten largest billers' paid is withheld when 1 to 10 billers remain beyond them (174 of 916 profiles), since total paid less the top 10 would describe those billers. The ranking inputs (each profile's billers and its six cohorts, counts and dollars) are kept as loaded, so the program's medians and ranks are exact; no page shows them for one service, but they are in the published data file. **The rule is a display rule, not a file rule** (independent review OPA-01, OPA-11, 2026-11-12): 7,748 of 8,764 profiles carry at least one cohort count from 1 to 10 in the file (19,276 cells), and a withheld cell can be worked out by subtraction where it is the only one withheld in a set that adds up to a shown total (cohorts, entity types, "all other areas", a year's months against the radar's yearly paid). The radar file already published, and the HHS source file itself, carry such figures. Whether the published files must meet the rule too (withhold the small ranking inputs, making ranks approximate, and add secondary suppression) is open for Ken; nothing is deployed until he decides.
2. **Public view only.** The mockups' authorized view, legislator view, agency view and agency response box appear as labelled "not available" rows, not as working controls.
3. **The early-warning rule:** a month alerts when its three months' payments (the month and the two before) are at least twice the same three months a year earlier, and at least $1M. The mockup's rule, plus a $1M floor so a small service cannot alert on a few thousand dollars. The first alert is the first alert month from the January before the year the rise starts (the program's change start). It is labelled a monthly rule DecisionPro proposes, not part of the annual screen.
4. **The biller groups followed** are the billers of a service the screen found surging or tripling, in a year it paid at least $5M to at least 11 billers (252 groups in the 2026-11-12 screen). A page shows a group that has played out (its year at least `GROUP_RULE.playedOutYears` = 2 before the latest) and, as a watch list, the group of the latest year when there is one. A service tile reads "at peak YEAR" when the latest year is the peak, else its change from the peak.
5. **Provider patterns are for the latest year (2024)**, for every state and service paid at least $1M to at least 11 billers. "Comparable state services" are those with at least 30 billers and $5M paid (the mockup's 2,878; 2,894 in the data). "Typical" is their median; a service's rank is the share of them with a lower figure. "A newcomer" first billed the code in the state in the latest year or the one before. "Depends on the code": the code is at least half of the biller's Medicaid payments that year.
6. **The state brief's readings** are named by the program from the radar's figures, not typed: FALLING, LONG-RUNNING, ASK WHY, NEW · SMALL, RISING (section 4). Its three questions are templates filled from the brief's own rows.
7. **The explanation ledger** lists the law and policy on file per flagged service with the program's tag; its verdict is the tag. The mockup's events B to G that are not on file are not shown; the page says how far the search went. Every service sits in one of three groups: explained (a confirmed innocent explanation on file), not yet searched, or unexplained so far.
8. **Layout follows the app, not the mockups' 1600px canvas.** The pages sit inside the module's left navigation, so wide tables scroll inside their card, the brief's side cards drop below its table under 1900px, and the overflow check runs at 1100px (at a phone width the app's own navigation fills the screen, which predates this build).
9. **The brief's questions name the state** ("West Virginia's share of enrollment"), and the readings are phrased from each row's own figures.

## 2. Perspective and architecture record

Perspective: `docs/CODEXEN-SCOPE.md` (the Director's statement of 2026-10-28 and the all-state amendment of 2026-11-07). Architecture record: ADR-001 governs `decisionpro-api`; **the warehouse loaders have no architecture record of their own**, and that decision is open for the Director (`docs/CODEXEN-SCOPE.md`, technical tables). This owner follows the other loaders' practice and adds no coordination mechanism: it assumes one CLI load at a time, and writes the replace and the SUCCEEDED status in one transaction. `OversightReview` runs in the browser over static exports and holds no business state.

## 3. Applicability

| Unit | Classification |
|---|---|
| `scripts/tmsis/stage_oversight_aggregates.py` | Not applicable: staging adapter. Serialises the publisher file at declared grains; no provider identifier leaves it. |
| CLI `oversight-groups` | Not applicable: writes the screen's candidate list for the stage. |
| `BillerOversightAggregateOwner` (warehouse) | **Object container**, owns *biller oversight aggregate*: load with reconciliation. |
| `ExportOversightAggregatesForUi` | Not applicable as business logic: serialisation, plus the small-cell rule of section 1.1, which is a disclosure rule applied at the boundary and tested. |
| `OversightReview` (app, `lib/fraud/oversightProgram.js`) | **Program container**: alerts, ranks, readings, group paths. Reads the radar review and the oversight export; writes nothing. |
| Five page components, nav, CSS | Not applicable: presentation. |

## 4. Business Actions and rules

**Warehouse, `BillerOversightAggregateOwner.LoadBillerOversightAggregate`:** read the stage manifest and seven files (`OVERSIGHT_FILES`); retain them in PSA; refuse unless every check passes, then replace the REAL rows and mark the load SUCCEEDED in one transaction (a failed status write rolls the replace back). Checks: `oversight-stage-names-latest-screen` (the manifest names the latest SUCCEEDED screen load); `oversight-<file>-matches-manifest` (row count and sha256 per file); `oversight-months-add-up-to-years` (each state-code's months add up to the loaded yearly paid, within the tolerance); `oversight-code-months-add-up-to-years` (each code's national months add up to every state's loaded paid plus unmatched rows); `oversight-groups-follow-the-rule` (the staged groups are exactly the qualifying ones); `oversight-months-within-the-screen`; `oversight-groups-within-billers`; `oversight-groups-whole-in-their-year`; `oversight-profile-cohorts-add-up`; `oversight-profiles-within-billers`.

**App, `OversightReview`:**
- `ReviewEarlyWarning`: per state-code with a monthly series: three-month sums, alert months by the rule of section 1.3, the first alert from the January before the change start, paid after the alert, months from the alert to the first confirmed restriction on file, the annual flag year (the change start), and the year's first-time flags by pattern.
- `ReviewBillerGroups`: per group, members billing and paid per year, the group's paid against its peak and the latest year, each other service's change from the anchor year to the latest, and each service's peak-to-latest change.
- `RankBillerProfiles`: per profile, the three signs (newcomer share of billers, newcomer share of paid, dependent newcomer share of paid), summed from the export's six cohorts (the newcomers are the year-before and year cohorts), their medians over comparable services and over the code's other states, the rank among comparable services, and whether each sign is high (above `HIGH_SIGN_RANK` = 90% of comparable services).
- Every Business Action reads the export's rules from the export only: `SmallCellMinimum` (the brief withholds a row's billers and dollars below it) and `StageParameters` (the stage's definitions the provider-pattern page states). An export without them is not loaded.
- `SummarizeExplanationLedgers`: per flagged state-code, the policy events on file in date order with the program's match to the rise, the latest year's explanation tag as the verdict and its group (`verdictSplit`), and the count of services in each group (`LedgerSplit`).
- `NameStateBriefReadings`: per state and the latest year, the services above the enrollment line ordered by dollars above it, each with one reading: FALLING (paid fell 20% or more from the prior year), ASK WHY (a blow-up is on file for the service in any year), NEW · SMALL (first flagged this year and paid under $5M), LONG-RUNNING (far above the line three years or more), else RISING or STEADY by its change on the prior year.

## 5. Business objects and owners

| Object | Disposition | Owner | Identity |
|---|---|---|---|
| Biller oversight aggregate (state-code-month spending; biller-group years and services; biller profiles and areas; code labels) | D1: retained, cited by the pages, reconciled to the spending aggregate | `BillerOversightAggregateOwner` | load history id; row keys below |

State-transition diagram: the same as the state-code spending aggregate (REAL rows replaced whole by a SUCCEEDED load; a failed load replaces nothing).

Row keys: `dso_tmsis_state_code_month (state_code, hcpcs, month_ym)`, `dso_tmsis_code_month (hcpcs, month_ym)` (national months, for the code's other states), `dso_biller_group_year (group_state, group_hcpcs, group_year, year)`, `dso_biller_group_service_year (group_state, group_hcpcs, group_year, hcpcs, year)`, `dso_biller_profile_measure (state_code, hcpcs, year, measure)`, `dso_biller_profile_area (state_code, hcpcs, year, zip3)`, `dso_hcpcs_label (hcpcs)`. Foreign keys RESTRICT; no trigger.

## 6. Container fields (owner)

Status, ErrorMessage, LoadHistoryID, StageDirectory, ManifestText, Manifest, FileBytes and FilePsaKeys (seven files), LatestScreenLoadHistoryId, LatestSpendingLoadHistoryId, QualifyingGroupKeys, ScreenStateCodeKeys, LoadedYearlyPaid, LoadedYearlyBillers, LoadedNationalPaid, the parsed rows per file, the eight reconciliation counters (MonthSeriesOffTheirYears, CodeMonthsOffTheirYears, GroupsOffTheRule, MonthSeriesOffTheScreen, GroupsAboveTheirBillers, GroupsNotWholeInTheirYear, ProfilesWhoseCohortsDoNotAdd, ProfilesAboveTheirBillers), Checks, Notes, ReconciliationIsClean, TransactionIsOpen, rows inserted per table, RowsInserted, RowProvenance, PsaStamp, AsOfDate. All INITIAL in `InitializeLoadRunState`.

Program `OversightReview` fields: the staged inputs (Oversight, Radar, Review, CodeLabels, StateNames); run state (OversightIsLoaded, OversightProblem, ReviewIsLoaded, SmallCellMinimum, StageParameters, Labels, MonthAxis, ServiceYearsByStateCode, LatestYear, LedgerGroupByServiceYearId); and the five outputs, each reset by its Business Action.

## 7. Exceptions

None. Pure parse functions per file take text and return rows (the warehouse's convention for staged CSVs), and `InsertRowsInBatches` is a low-level utility. The top-10 measure's count is the number of billers the figure covers (`min(10, billers)`), written by the parser because the stage writes only the dollars.

## 8. Boundaries

The stage writes no NPI, name or address. The export applies the small-cell rule to every figure a page shows (section 1.1 names the two kept as loaded). The page components stage the export, the radar review, `SERVICE_LABELS` (as `CodeLabels`) and `STATE_NAMES` (as `StateNames`) into `OversightReview` and read its outputs; they compute no alert, rank, reading or ledger group of their own.

## 9. Scope changes

Object table: add *biller oversight aggregate* (`BillerOversightAggregateOwner`). Program table: add `OversightReview`. Migration `018_biller_oversight_aggregate.sql`.

## 10. Build log

2026-11-12, branch `feat/oversight-pages`:

- Warehouse: migration 018; `stage_oversight_aggregates.py`; CLI `oversight-groups`, `oversight-load`, `oversight-export`; load `LH-OVERSIGHT-dbdb778b-1ea9-457d-8235-e15eb106205f` passed every check of section 4 against screen and spending loads of the same day. `BillerOversightAggregateOwner.test.ts` covers the parsers, each refusal and the small-cell rule.
- App: `OversightReview` with 16 tests (`oversightProgram.test.js`); five pages, the shared building blocks, the module's NEW tabs and the lazy export load, with 4 page tests (`oversightPages.test.jsx`: five tabs, every page for every state, Kentucky figures, West Virginia withholding).
- Figures checked on the rendered pages: Kentucky H2027 first alert Jul 2023 (May to Jul $8.4M, 2.1× a year earlier), $182.8M paid from Aug 2023 to Dec 2024, 18 months to the first restriction; Kentucky 2020 group of 32 billers ($42M → $70M → $159M); Kentucky 2024 watch list of 171 billers; provider signs 74%, 45%, 36% among 2,894 comparable services; ledger split 7 explained, 1,167 not yet searched, 95 unexplained so far; West Virginia brief 0.64% of enrollment, 55 services, $300.9M above the line.
- Isolated render: `scripts/verify-potential-fraud-isolated.mjs` section 7 on a hidden desktop. Three runs failed while the checks were written (a label regex; a 390px overflow check that the app's own navigation fails, moved to 1100px; layout). Run `docs/evidence/harness-workbench/isolated/20261112T145701684Z` passed (`isolated-rendered`) after the ledger table was fitted to its card and the review repairs below.
- Independent review (2026-11-12) returned revision-required with OPA-01 to OPA-09. Repaired: OPA-02 (SUCCEEDED status written inside the replace transaction, with a test), OPA-03 (the export carries the six cohorts; the program sums the newcomers), OPA-04 (`AreFlaggedProfileSignsHigh` and `HIGH_SIGN_RANK`; the stage definitions travel in the export as `stageParameters`), OPA-05 (`SmallCellMinimum` read from the export only; the pages show it), OPA-06 (question atoms `WhichLedgerGroupIsEachServiceYearIn`, `WhichReadingFitsEachBriefRow`, `WhichGroupsFollowEachStateCode`), OPA-07 (`CountRowsInserted`, `MarkReconciliationFailed`, `StampRowProvenance`, guard on the PSA index), OPA-08 (section 2 and 6). Re-review: every repair held; OPA-10 (top-10 paid recoverable on the page, now withheld when 1 to 10 billers remain beyond the top 10), OPA-11 (cohort counts updated in 1.1) and OPA-12 (the cohort chart reads the minimum) repaired. Open for Ken: OPA-01 (section 1.1) and OPA-09 (one object for the bundle). Pre-existing, routed to remediation: P-01 radar small cells, P-02 the spending owner commits before it completes its load, P-03 no warehouse architecture record, P-04 locals in PASSIVE atoms.
