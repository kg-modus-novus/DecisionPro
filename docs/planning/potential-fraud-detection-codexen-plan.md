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
12. `AssessCaseSignals`. Every check carries an `id`, and the radar's chips render the fired checks.
13. `MeasureEnrollmentAndPaidChanges`
14. `CanEnrollmentExplainRises` (question, writes `enrollmentShareIsFlat`, `enrollmentIsFlatOrDown` and `riseIsUnexplainedByEnrollment` by `HEALTH_EXPLANATION_RULE`; an unknown figure answers false)
15. `IndexFirstBlowupYears`
16. `DateRiseEvents` (writes `riseEvents` with their fit: start of rise, matches or after, known case, displacement. The blow-up page adds only the catalog's policy events and the reviewer's session events.)
17. `MeasureYearlySeriesAgainstEnrollmentLine` (writes `YearlySeriesByStateCode`: for each flagged state-code, every year's paid, national total, share, top-10 billers' share, enrollment line = national paid x enrollment share, paid as a multiple of the line, `enrollmentLineIsKnown`, `isFarAboveEnrollmentLine` by `SIGNAL_THRESHOLDS.excessMultipleFloor`, and whether the screen flagged the year and as a blow-up. A flagged year takes its line and multiple from the service-year (the owner's figures). A line that cannot be measured stays 0 with `enrollmentLineIsKnown` false. The page calls the line "fair share" as a plain label only. Added 2026-11-08 for the blow-up chart.)
18. `RankServiceYears`
19. `SummarizeYears`
20. `SummarizeStatesByYear`
21. `PublishSignalReview`

`ModelLeveledDollarReallocation`. Every atom is PASSIVE, and question atoms are marked:

1. `ResetReallocationRun`
2. `AreReallocationInputsValid` (question). If the inputs are not valid, `RejectInvalidReallocationInputs` runs and the action stops.
3. `SelectServicesInScope`
4. `MeasurePeerStateLines`
5. `LevelServicesToLine`
6. `TotalDollarsAboveLine`
7. `CalculateUpheldDollars`
8. `SplitByFederalMatchingRate`
9. `CalculateAvailableDollars`
10. `AllocateToDocumentedNeeds`
11. `IsAllocationOverAvailable` (question)
12. `FitAllocationsToAvailableDollars`. The page's "fit to available" button stages this field as the new allocations; the page computes no allocation itself.
13. `EstimatePeopleReached`
14. `RankSourcesOfFreedDollars`

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
and keys before staging. The state's FMAP comes from `federalMatchingRate.js`, and a missing rate
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
