# Potential Fraud Detection module: CodeXen plan

Date: 2026-11-07. Director instructions, in order:

- "Start over. Review my prompt. Generate 5 UI mockup images of what that might look like for the
  user." Then "All five pages": build the national radar, program blow-up, case file, reallocation
  what-if, and tools and data coverage pages, plus the backtests page the mockups' sidebar shows.
- "consider a what-if leveling meaning - if this is fraud, how can those dollars be reallocated to
  improve other areas which need it?" (the reallocation page).
- "don't forget to take out that crap you built without my authorization": the Program Integrity
  goal case, briefing cards, leveling card and KY+FL export were reverted in `3225067`.

## Perspective

`docs/CODEXEN-SCOPE.md`, Director statement 2026-10-28. Where Medicaid money goes, state by state
and service by service, is an aggregate measure of where money goes. The module reads aggregate
spending, enrollment and counts of billing NPIs only. It names no provider and holds no
person-level data. A candidate is potential fraud to review, never a finding.

## Architecture record

ADR-001 (T1 + A1 + L1 + R1, P1) governs `decisionpro-api`; this module does not touch it. The app
reads the generated export `alp/potentialFraudRadar.js` (written by the warehouse CLI
`fraud-radar-export`, also run at the end of `tmsis-screen` and `ofr-depot-export`). The export is
a read-only projection of the owner's rows and is never authoritative. The change adds no lock,
lease, heartbeat, retry, reload, cache, poll, timer, interval, queue, duration or persistence path.
Reviewer notes, explanation answers, dispositions, added events and saved scenarios live in React
state for the browser session only; nothing is written or sent.

## Applicability

| Unit | Classification | Container |
| --- | --- | --- |
| `xenodroid-bw/src/molecules/ExportPotentialFraudRadarForUi.ts` | Not applicable: serialization of the candidate rows, yearly series, every state's latest-year paid per flagged code, enrollment shares and load dates. No score, tier or decision is computed there. | technical export class |
| Merge of candidate rows, cross-state displacement, signal points and score, suggested tier, case-file checklist, the "can health explain it" decision, ranking and summaries | Rules and decisions | program container `PotentialFraudSignalReview` |
| Leveling to a line, upheld share, FMAP split, available dollars, allocation to needs, over-allocation, people reached | Business Action (a planning model that writes nothing) | program container `LeveledDollarReallocation` |
| `components/fraud/*.jsx` pages, `fraudFormat.jsx`, `fraudVisuals.jsx` | Not applicable: presentation, filtering and sorting of program outputs, text export. The pages stage inputs, run the Business Action and render its fields. `fraudVisuals.jsx` (2026-11-08) holds the shared tile map, legend swatches and chart colors. | none |
| `data/potentialFraudCatalog.js`, `data/federalMatchingRate.js` | Not applicable: configuration and sourced reference values (plain labels, analysis statuses, KFF FY2024 FMAP, illustrative needs) | none |

## Business Actions

- `ScorePotentialFraudCandidates` (program `PotentialFraudSignalReview`)
- `ModelLeveledDollarReallocation` (program `LeveledDollarReallocation`)

## Business objects and owners

| Datum | Business object | Owner | Access here |
| --- | --- | --- | --- |
| Candidate rows, patterns, shares, counts, levels above the lines | Share-and-surge candidate | `ShareAndSurgeCandidateOwner` | read through the export |
| Every state's paid per code and year, national totals | State-code spending aggregate | `TmsisStateCodeSpendingOwner` | read through the export |
| Enrollment share and mean enrollment by state and year | Enrollment (existing) | `RetrieveAndLoadEnrollment` | read through the export |
| LEIE state summary, load dates | existing BW loads | their loaders | read through the export |

Neither program writes a business object. The signal score, the suggested tier, the checklist and
the reallocation results are computed on demand and not retained, so none is a business object
(CX-BUSINESS-OBJECT-MODEL: output computed on demand is not an object). A reviewer's tier or
disposition will become one when the API persists it; that is the candidate's "under validation,
disposed" arrows already recorded as waiting for the API in the share-and-surge plan.

## Dispositions

| Classification | Disposition | Reason |
| --- | --- | --- |
| Session-only reviewer answers, disposition, added events, saved scenarios | D3 | One page component is the sole writer; nothing outside the session reads them; they are discarded on reload and labeled so on the page |
| `SIGNAL_WEIGHTS`, `TIER_RULE`, `HEALTH_EXPLANATION_RULE`, displacement thresholds | Rule configuration of `PotentialFraudSignalReview` | DecisionPro's starting rule, labeled as a suggestion; a reviewer sets the tier |
| `DOCUMENTED_NEEDS` gaps and unit costs | Illustrative configuration | Labeled illustrative until each goal owner confirms them |

## Container fields

`PotentialFraudSignalReview`:

- Inputs, staged by the caller: `Radar` (`{}`) and `CodeLabels` (`{}`).
- Run state, all reset by `ResetSignalReview`:
  - `RadarIsLoaded` (`false`)
  - `CandidateRows` (`[]`)
  - `ServiceYearByKey` (empty `Map`)
  - `CollapsesByCodeYear` (empty `Map`)
  - `FirstBlowupYearByStateCode` (`{}`)
  - `DisplacementCount` (`0`)
- Outputs, also reset by `ResetSignalReview`:
  - `ServiceYears` (`[]`)
  - `YearSummaries` (`{}`)
  - `StateYearSummaries` (`{}`)
  - `YearlySeriesByStateCode` (`{}`)
  - `Years` (`[]`)
  - `LatestYear` (`0`)
  - `Errors` (`[]`)

`LeveledDollarReallocation`:

- Inputs, staged by the caller:
  - `State` (`''`)
  - `Services` (`[]`)
  - `LatestYearStatePaid` (`{}`)
  - `EnrollmentShareByState` (`{}`)
  - `Line` (`'enrollment'`)
  - `Scope` (`'all'`)
  - `UpheldSharePct` (`60`)
  - `FederalMatchingRate` (`0`)
  - `Destination` (`'medicaid'`)
  - `Needs` (`[]`)
  - `Allocations` (`{}`)
- Run state and outputs, all reset by `ResetReallocationRun`:
  - `ReallocationInputsAreValid` (`false`)
  - `ServicesInScope` (`[]`)
  - `PeerLineByCode` (`{}`)
  - `LeveledServices` (`[]`)
  - `StatePaidInScope` (`0`)
  - `DollarsAboveLine` (`0`)
  - `DollarsAboveEachLine` (`0` for every `LEVELING_LINES` key)
  - `UpheldDollars` (`0`)
  - `FederalShare` (`0`)
  - `StateShare` (`0`)
  - `AvailableDollars` (`0`)
  - `NeedOutcomes` (`[]`)
  - `AllocatedDollars` (`0`)
  - `UnallocatedDollars` (`0`)
  - `AllocationIsOverAvailable` (`false`)
  - `AllocationsFittedToAvailable` (`{}`)
  - `SourcesOfFreedDollars` (`[]`)
  - `ServicesWithoutPeerLine` (`0`)
  - `Errors` (`[]`)

Each Business Action calls its reset first. Staged inputs are kept between runs.

## Molecule sequence

`ScorePotentialFraudCandidates`. Every atom is PASSIVE, and question atoms are marked:

1. `ResetSignalReview`
2. `IsRadarLoaded` (question, writes `RadarIsLoaded`). If it is false, `RejectMissingRadar` runs and the action stops.
3. `DecodeCandidateRows`
4. `MergeServiceYears`. Every service-year starts with INITIAL values, never `null`: an empty displacement and tier, health figures of 0 with "is known" booleans, and `enrollmentLine` (national paid x enrollment share).
5. `AreServiceYearsCollapseOnly` (question, writes `collapseOnly`)
6. `AreServiceYearsBlowups` (question, writes `isBlowup`: the share surged or paid tripled)
7. `IndexShareCollapses`
8. `AttachCrossStateDisplacement` (writes `displacementIsFound` and `displacement`)
9. `MeasureSignalPoints`. It reads `SIGNAL_WEIGHTS` and `SIGNAL_THRESHOLDS` only.
10. `TotalSignalScores`
11. `SuggestReviewTiers`. It reads `TIER_RULE.minScore`.
12. `AssessCaseSignals`. Every check carries an `id` and a `shortLabel`; it writes `checkCounts` (by `CHECK_KINDS`), `publicCheckCount` and `dataCheckCount` on each service-year.
13. `MeasureEnrollmentAndPaidChanges`
14. `CanEnrollmentExplainRises` (question, writes `enrollmentShareIsFlat`, `enrollmentIsFlatOrDown` and `riseIsUnexplainedByEnrollment` by `HEALTH_EXPLANATION_RULE`; an unknown figure answers false)
15. `IndexFirstBlowupYears`
16. `DateRiseEvents` (writes `riseEvents` with their fit: start of rise, matches or after, known case, displacement. The blow-up page adds only the catalog's policy events and the reviewer's session events.)
17. `MeasureYearlySeriesAgainstEnrollmentLine` (writes `YearlySeriesByStateCode`: for each flagged state-code, every year's paid, national total, share, top-10 billers' share, enrollment line = national paid x enrollment share, paid as a multiple of the line, `enrollmentLineIsKnown`, `isFarAboveEnrollmentLine` by `SIGNAL_THRESHOLDS.excessMultipleFloor`, and whether the screen flagged the year and as a blow-up. A flagged year takes its line and multiple from the service-year (the owner's figures). A line that cannot be measured stays 0 with `enrollmentLineIsKnown` false. The page calls the line "fair share" as a plain label only. Added 2026-11-08 for the blow-up chart.)
18. `RankServiceYears`
19. `SummarizeYears`
20. `IsMostAboveEnrollmentConvention` (question, writes `mostAboveEnrollmentIsConvention` on each year summary)
21. `SummarizeStatesByYear`
22. `PublishSignalReview`

`ModelLeveledDollarReallocation`. Every atom is PASSIVE, and question atoms are marked:

1. `ResetReallocationRun`
2. `AreReallocationInputsValid` (question). If the inputs are not valid, `RejectInvalidReallocationInputs` runs and the action stops.
3. `SelectServicesInScope`
4. `MeasurePeerStateLines`
5. `LevelServicesToLine`. Each leveled service carries its dollars above every line (`aboveByLine`) and above the chosen one.
6. `TotalDollarsAboveLine`
7. `TotalDollarsAboveEachLine`. The line buttons show these totals.
8. `CalculateUpheldDollars`
9. `SplitByFederalMatchingRate`
10. `CalculateAvailableDollars`
11. `AllocateToDocumentedNeeds`
12. `IsAllocationOverAvailable` (question)
13. `FitAllocationsToAvailableDollars`. The page's "Fit to available" button stages this field as the new allocations; the page computes no allocation itself.
14. `EstimatePeopleReached`
15. `RankSourcesOfFreedDollars`

No atom is ACTIVE, because neither program persists anything. No persisted transition is added.

## Coordination mechanisms

None. The radar loads once per visit through a dynamic import, which is a code-splitting chunk and
not a cache of business data.

## Exceptions

Atoms that iterate a collection use block-scoped iteration names and small formatting closures
inside the loop. This follows the existing simple-mode program containers. No atom takes a
parameter or returns a value. The program keeps two text helpers (`asPct`, `asMoney`) for the checklist detail lines (independent review F08, accepted as project practice). The earlier `IsCollapseOnly(s)` helper was replaced by the question
atom `AreServiceYearsCollapseOnly`.

## Boundaries

`PotentialFraudDetection.jsx` dynamically imports the export, stages `Radar` and `CodeLabels`, and
runs the signal action once. `ReallocationPage.jsx` normalizes slider and select values to numbers
and keys before staging; a typed gap is staged only when it reads as a positive number of millions and a
typed unit cost only when it reads as dollars of zero or more (`parseMillions`, `parseDollars`, tested), and the input question also refuses any need without a positive gap and a unit cost of zero
or more. The state's FMAP comes from `federalMatchingRate.js`, and a missing rate
is rejected by the input question, not defaulted. No transaction, delete or detach.

## Scope changes

Both program containers were added to the program-container table in `docs/CODEXEN-SCOPE.md`. Each
file carries its first-line `CodeXen-Container: v1 kind=program` marker. The repository has no
`codexen-index` script yet, so no index is rebuilt (unchanged from the scope file's note).

## Review record

The independent review on 2026-11-07 returned revision-required. These findings were repaired in the same change:

- **F01.** The blow-up decision moved into the program.
- **F02.** The chips render from the checklist.
- **F03.** No `null` business state remains.
- **F04.** The health question is its own atom, and its thresholds live in the rule.
- **F05.** The thresholds are named.
- **F06.** The known-case default answer is removed, and the event fit moved into the program.
- **F07.** The program exposes the enrollment line.
- **F09.** The reallocation input guard checks the scope, the services and the needs.
- **P1.** The export now reads the owner's per-case backtest verdicts from the screen run's notes (`BACKTEST_NOTE_PREFIX`) instead of re-deciding them.

These findings stay open:

- **F07.** The blow-up page's peer table still divides share by enrollment share to display each state's multiple.
- **F10.** Closed on 2026-11-07. The Director widened the perspective statement to all states, with Kentucky kept as the home state; see the amendment in `docs/CODEXEN-SCOPE.md`.

The second independent review (subagent `a5a3a585ffc149edc`, same day) returned **pass**. It added three advisory findings, left open:

- **R01.** The blow-up page rewrites the displacement event's text with a regex. The program should carry the displaced state as its own field.
- **R02.** `TIER_RULE.test` repeats the 70 and 40 cut-offs in prose.
- **R03.** The backtest verdicts travel as JSON inside the screen run's free-text notes. A structured column would be sturdier.

## Change 2026-11-08: blow-up page redesign (Director-approved mockup)

The blow-up page now has a tile-map state picker tinted by the number of programs that blew up in the latest year, a ranked one-click program list, and a one-axis dollar chart. The chart shows the United States total as an outline, the state's paid as a bar (red in blow-up years) and the fair share as a dashed line, with two rows on top: share of US and times the fair share. Clicking a flagged year's bar opens that year.

- **Program change.** A new PASSIVE atom, `MeasureYearlySeriesAgainstEnrollmentLine`, writes the output field `YearlySeriesByStateCode` (INITIAL `{}`, reset by `ResetSignalReview`). The chart and caption read the fair-share line and the times-the-line multiple from it. The page no longer divides share by enrollment share for the chart, which closes that part of F07. The peer-state table still does (F07 stays open for that table).
- **No new business object, coordination mechanism or persistence.** The atom reads the export only and writes a run output.
- **Presentation.** The page sorts the state's blow-ups by score and picks the newest blow-up per code when the latest year has none. The tile map enables every state with a blow-up in any screen year (every state in the 2026-02-09 file).
- **Independent review (subagent, 2026-11-08): revision-required, then repaired in the same change.** B01: the chart's red times-the-line highlight now reads the program's `isFarAboveEnrollmentLine` instead of a hard-coded 5. B02: the page reads `enrollmentLineIsKnown` (enrollment share and national total both known). B03: flagged years take the line and multiple from the service-year, so the radar, case file and chart show one figure. B04: the unused `readSeries` helper is deleted. B05: the atom is named for its output and keeps the term "enrollment line". P-A: the top-10 share per year is written by the atom.

## Change 2026-11-08: radar header redesign (Director-approved mockup)

The five KPI cards are replaced by one sentence, a bar splitting the year's dollars above the enrollment line by suggested tier ("Worth review" = HIGH + VERIFY; "Likely convention" = CONVENTION?), and a state tile map colored by worth-review dollars (default) or all dollars above the line, with a dot on states that have a HIGH row. A panel beside the map shows the selected state's tier counts and its services with the most dollars above the line. Clicking a state filters the ranked list; clicking it again clears the filter.

- **Rule configuration.** `WORTH_REVIEW_TIER_KEYS` (`['high', 'verify']`) names the tiers counted as worth review. It is a rule of `PotentialFraudSignalReview`, alongside `TIER_RULE`.
- **Program change.** `SummarizeYears` adds `tiers` (services and dollars above the enrollment line per suggested tier), `worthReviewServices` and `worthReviewAboveEnrollment`, and drops the `high` and `verify` counts, which `tiers` now holds (independent review H01). `SummarizeStatesByYear` adds the same `tiers` shape (H02), `worthReviewServices` and `worthReviewAboveEnrollment`, and drops its `high` count. A new question atom, `IsMostAboveEnrollmentConvention`, runs after `SummarizeYears` and writes `mostAboveEnrollmentIsConvention` on each year summary (INITIAL `false`): the CONVENTION? tier holds more than half the dollars above the line. It picks the sentence's closing clause (H03). `TIER_RULE` entries carry a `shortLabel`, and each service-year's tier carries it too, so the page reads it instead of splitting the label (H05).
- **Presentation.** `RadarOverview.jsx` renders the bar, map and panel. The map's color bins (10, 50, 150 and 300 million for worth review; 0.25, 0.5, 1 and 3 billion for all dollars) are display bins, not rules. The panel sorts the state's rows by dollars above the line.
- **No new business object, coordination mechanism or persistence.**
- **Independent review (subagent, 2026-11-08): revision-required, then repaired in the same change.** H01: the `high` and `verify` aliases are removed and the readers use `tiers`. H02: both summaries use one `tiers` shape. H03: the question atom `IsMostAboveEnrollmentConvention`. H04: a test asserts that `TIER_DISPLAY_ORDER` and `TIER_COLORS` cover exactly the `TIER_RULE` keys. H05: `shortLabel` lives on the rule. H06: the `WORTH_REVIEW_TIER_KEYS` comment names the tiers instead of repeating 40. H07: this section now says which fields are added and which are dropped.

## Change 2026-11-08: radar filters and one-line rows (Director-approved mockup)

The radar's dropdowns become one-click pills: year pills; tier pills with a swatch and a service count (click again to clear); pattern pills with a count, where every pattern picked must match; an above-line slider (any, $1M, $5M, $10M, $25M, $50M, $100M). The header tile map stays the state filter. Sorting is a click on the Paid, Share vs enrolled, × or Score · tier heading. Each row is one line: rank, state, service and code, a paid-by-year sparkline over every year in the file for that state and code (most start in 2018) with the row's year marked, a share bar with the enrollment share as a tick, the multiple, a seven-cell signal fingerprint (one cell per scored signal, shaded by how much of its weight it earned), a known-case tag, and a score bar with the short tier label.

- **Rule configuration.** `SCREEN_PATTERNS` lists the owner's four screen patterns in the order the radar shows them. It is a rule of `PotentialFraudSignalReview`, alongside `SIGNAL_WEIGHTS`.
- **Program change.** `MeasureSignalPoints` also writes `signalStrength` on each service-year: each signal's points over its `SIGNAL_WEIGHTS` weight, 0 to 1, with every signal key present (INITIAL all zero, and all zero for a collapse-only row). `SummarizeYears` adds `patternServices` (services meeting each `SCREEN_PATTERNS` pattern, every pattern counted from 0) and `incompleteReportingServices` (services whose reporting is incomplete for the year). `SummarizeStatesByYear` adds the same `patternServices`. No atom is added.
- **Presentation.** The pill counts read the selected state's summary when the list is filtered to a state, otherwise the year's. A state with no flagged service in the year has no `StateYearSummaries` entry, which the page shows as zero counts (no services), not as a missing figure (independent review I04). The fingerprint's shade bands (none, under 40%, under 80%, the rest), the share bar's full scale (80% of US) and the slider stops are display choices, not rules. The per-row "preliminary" tag is replaced by one count in the note above the table, because every 2024 row is preliminary; each row's tooltip still says whether its reporting is complete. The "dollars above the enrollment line" sort is dropped, since the approved mockup sorts on paid, share, multiple and score; the above-line slider filters on those dollars.
- **No new business object, coordination mechanism or persistence.**
- **Independent review (subagent, 2026-11-08): revision-required, then repaired in the same change.** I01: both summaries count over `SCREEN_PATTERNS`, so an unknown pattern adds no key (tested). I02: the sparkline column is headed "Paid by year", since the series starts in 2018 for most codes. I03: a test checks that `PATTERN_LABELS` covers exactly `SCREEN_PATTERNS`. I04: the absent state-year reading is recorded above. I05: the note says a darker cell earns more of its weight.

## Change 2026-11-08: case file redesign (Director-approved mockup)

The case file page gets a tier-grouped list of the state's case files for the year (HIGH, VERIFY and CLOSED open; CONVENTION?, LOOK-BACK and LOW collapsed until clicked; the open case's group always shows), a title with the short tier and score, one sentence and a bar of paid against the enrollment line (the fair share in green, the rest in red), a strip of facts, an 18-tile signal grid (fired, clear, rule out, pending; a click shows the check's detail), Yes / Partly / No buttons for the explanation review, a five-step bar for where the case stands, and a row of actions.

- **Director decision (2026-11-08).** The five steps are Opened, Explanations checked, Claims requested, Referred and Closed. Picking Closed shows "closed as" buttons: billing convention, program design, known case, no issue found. The packet records the stage and the reason. This replaces the disposition dropdown.
- **Program change.** `AssessCaseSignals` gives each check a `shortLabel` (and `PENDING_CASE_SIGNALS` entries carry one) and writes, on each service-year, `checkCounts` (how many checks are of each `CHECK_KINDS` kind: fired, clear, explain, pending), `publicCheckCount` (checks judged from the screen's own figures, including a new-biller check that is too early to tell before 2020) and `dataCheckCount` (the `PENDING_CASE_SIGNALS` checks that wait on a join or non-public data). All start at 0 in the record literal. No atom is added.
- **Presentation.** The list's group counts read the state-year summary's `tiers`. The subtitle's "N of M public signals fired · K checks wait on data" reads `checkCounts.fired`, `publicCheckCount` and `dataCheckCount`. The explanation answers start as '' (not yet answered) for every question. The bar's scale is the larger of paid and the enrollment line. The stage and closed-as reason are session-only reviewer entries, the same D3 disposition as the other reviewer answers. Kept beyond the mockup: the payment-suspension test (42 CFR 455.23) button. Dropped: the "run the pending joins" button, since the waiting tiles now show what each join needs.
- **No new business object, coordination mechanism or persistence.**
- **Independent review (subagent, 2026-11-08): revision-required, then repaired in the same change.** C01: the program writes `publicCheckCount` and `dataCheckCount`, so a 2019 case reads "of 10 public signals" with 8 waiting on data (tested). C02: the last `.pfd-check` rule is removed. C03 and C04: the counts are written over `CHECK_KINDS` without re-creating the record. C05: the program header and molecule step 12 describe the checklist as it is. C06: the test asserts fixed counts and the 2019 case. C07: every explanation answer starts as ''. Re-review: C08, the legend counts tiles by kind and labels the pending kind "pending", so it no longer reads as the data-check count beside the subtitle (a 2019 case shows 9 pending tiles and 8 checks waiting on data); C09, the legend order is the program's `CHECK_KINDS`.

## Change 2026-11-08: reallocation what-if redesign (Director-approved mockup)

The reallocation page becomes one row of controls, a dollar funnel and need meters. The controls are "Level to" buttons that show the total above each line, the services in scope, an "assume upheld" slider and a "money goes" toggle (Stay in Medicaid, To General Fund). The funnel runs from paid on the flagged services to above the line, upheld, who paid it (federal and state) and available to plan, every bar on the paid scale. Each documented need shows its allocation against its gap on a meter, with − and + buttons of $10M, a gap the reviewer can click to edit (with the cost per unit and what a unit is) and the people reached. "Allocated $X of $Y" sits over a gauge that turns red when over, with Fit to available, + Add a need, Save scenario and Export for subcommittee.

- **Director decision (2026-11-07, Q3).** "Let users edit them": a reviewer can change gaps and unit costs and add needs for the session. The catalog's figures stay the defaults and stay labeled illustrative; edits and added needs last only the session and are marked "edited this session" or "Added this session". A blank unit cost means no people-reached estimate.
- **Program change.** `LevelServicesToLine` writes each service's dollars above every `LEVELING_LINES` line, and a new PASSIVE atom `TotalDollarsAboveEachLine` writes `DollarsAboveEachLine` (INITIAL 0 for every line key in `ResetReallocationRun`), so the line buttons compare the lines without three page-side runs. `AreReallocationInputsValid` also refuses a need without an id, a positive gap and a unit cost of zero or more.
- **Presentation.** The page stages the catalog's needs with the reviewer's edits (gap, unit cost, what a unit is) and added needs as `Needs`: session-only reviewer entries, the same D3 disposition as the case-file answers. A − or + stages the need's held allocation plus or minus $10M, and saving an edit stages the held allocation unchanged; the program alone holds each allocation to [0, gap]. Catalog needs are staged with `added` false and `edited` true only when the reviewer edited the need this session. The funnel, meter and gauge widths are presentation scaling of program fields. Kept beyond the mockup: the services-in-scope buttons, where the freed dollars came from, the peer-state note, the FMAP source, the guardrails and the saved-scenario comparison. The separate people-reached table is folded into each need row.
- **No new business object, coordination mechanism or persistence.**
- **Independent review (subagent, 2026-11-08): revision-required, then repaired in the same change.** V01 and V02: the page no longer repeats the program's clamps when it steps an allocation or saves an edit. V03: a test ties each leveled service's `aboveByLine` keys to `LEVELING_LINES`. V04: the refusal names every need requirement the question checks. V05: catalog needs are staged with `added` false and `edited` set, never undefined. Re-review: pass; V08, this plan wording, corrected. V06: an unstyled class is dropped. V07 (boundary parsers repeat gap > 0) is recorded above as boundary normalization; the program's question stays authoritative. Pre-existing, not changed here: the signal program copies `aboveEnrollment` and `abovePriorShare` without a finiteness guard (the export has none non-finite today), and the page's HIGH count, top service and other-sources sum are carried over from before.

## Change 2026-11-08: tools and data coverage redesign (Director-approved mockup)

The tools page becomes a coverage bar (running, ready to build, needs a data load), a row of data-source chips and the 24 analyses as tiles in four tier rows, colored by status. Clicking a source dims the analyses it does not feed and says how many it feeds and whether it is loaded; clicking a tile says what it checks, which sources it uses and what it waits on. The header keeps the last scan, the candidate count, the known cases reproduced and a disabled "Run scan" (the scan runs in the warehouse). The scan console stays below.

- **Director decision (2026-11-07, Q5).** Keep the true statuses: 10 running, 9 ready, 5 needing a data load. A catalog test holds the counts.
- **Catalog change, not a program change.** Each `DETECTION_ANALYSES` entry gains a tile name (`short`), the `DETECTION_SOURCES` keys it uses (`sources`) and the keys that would extend it (`waitingOn`). Each source gains a `key` and a chip name. New sources: NPPES (shown as partial: at most 40 organization name lookups per state inside the crosswalk load, with no enumeration date or taxonomy, and never with the crosswalk's row count as its own), known cases and KFF FMAP (shipped with the module), policy dates and the Medicare revocation list (not loaded). `ANALYSIS_STATUSES` and `ANALYSIS_TIERS` declare the order the bar and rows count over. `standingOfSource` says how a source stands against the export's coverage (loaded, partial, bundled, missing); the page and the test both use it. A test holds the map to the statuses against the shipped coverage: a running or ready analysis uses only sources on hand, a needs-data analysis uses at least one that is not, and `waitingOn` lists only sources not on hand.
- **Applicability.** Presentation over catalog facts and the radar export's coverage list: whether a source is loaded is read from coverage, and the page counts statuses over the declared list. No business decision, no program container touched.
- **Presentation.** Dropped: the KPI cards, folded into the header line and the bar; the per-analysis "needs" text in the tile, now in the tile's detail line; and the right-hand sources table, whose as-of date and row count now show on a chip's click. A source that feeds no analysis (KFF FMAP, used by the reallocation what-if) dims no tiles. The dead `.pfd-kpi*`, `.pfd-grid4`, `.pfd-tool` and `.pfd-st*` rules are removed.
- **No new business object, coordination mechanism or persistence.**
- **Independent review (subagent, 2026-11-08): revision-required, then repaired in the same change.** Applicability not-applicable, agreed. T01: NPPES shows as partial through the crosswalk load, without the crosswalk's row count, and its analysis says enumeration date and taxonomy are not captured (it stays ready, per the Director's statuses). T02: one `standingOfSource` rule serves the page and the test, which reads the shipped coverage. T03: the test pins the edges the page shows. T04: code migration waits on policy dates. T05: the status words live in the catalog, keyed by `ANALYSIS_STATUSES`. T06: running analyses computed from the screen export list the screen as a source, and FMAP is marked as used by the reallocation what-if. T07: this section names the removed sources table. Pre-existing, not changed: the console's hardcoded "next" line, the page's lookups of the spending and enrollment loads by id, and the tier note's free text. Re-review: pass; R01, the chip and detail words for each source standing, moved into the catalog keyed by `SOURCE_STANDINGS` and tested. R02 (the NPPES tile reads ready while its enumeration date and taxonomy are not captured) follows the Director's statuses and is left for the NPPES join.

## Change 2026-11-08: backtests redesign (Director-approved mockup)

The backtests table becomes a headline with the pass count, one small chart per known fraud case (the state's share of US payments for the code by year, a dot on each known case-year with its suggested tier and score, a dashed line at the enforcement year) and a conventions card drawing the most states that billed each innocent code against the ten-state filter. Clicking a case-year dot opens its case file.

- **Data.** Verdicts, pass counts, the states-billing counts, the filter and the billing threshold all come from the screen run through the radar export (see the screen plan's 2026-11-08 change). The share line is `PotentialFraudSignalReview.YearlySeriesByStateCode`; the dots read each case-year's tier and score from the scored service-years. Nothing is re-decided on the page: it counts the exported `ok` verdicts, a case-year is flagged or missed by the exported `detected` verdict alone (`caseYearPoint`; a flagged case-year without a scored row is drawn flagged without tier or score), and the convention bars are drawn out of the `STATE_NAMES` jurisdictions, which a test holds equal to the states the export carries.
- **Catalog.** `KNOWN_CASE_ENFORCEMENT_YEARS` (Arizona 2023, from `PROGRAM_EVENTS`; a test holds it to an event of that year) and `BACKTEST_SERVICE_TITLES` (short card titles; the conventions' codes have no plain label in the export).
- **Applicability.** Presentation over program and export facts: `groupKnownCases` only groups the export's entries by state and code and orders the cards (most recent first case-year first); it is tested against the shipped export and against a failing case. No business decision, no program container touched.
- **Presentation.** The page moves to `BacktestPage.jsx`; the old table and the dead `.pfd-note-cell` rule are removed.
- **No new business object, coordination mechanism or persistence.**
- **Independent review.** Pass. B01 (the page could label a detected case-year MISSED) repaired with `caseYearPoint`; B02 (exporter untested) repaired with `ExportPotentialFraudRadarForUi.test.ts`; B04 renamed the atom `MeasureMostStatesBillingEachCode`; B05, B06 and B07 tightened the tests and this section; B03 (loop locals, the container's existing style) left for a container remodel.
