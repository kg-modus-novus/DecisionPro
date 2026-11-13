# Small-cell display rule on the radar pages: CodeXen plan (2026-11-12)

Director decision OPA-01 (2026-11-12): pages show no figure for a group of fewer than 11 billers; data files and the ranking keep exact inputs. On 2026-11-12 the Director extended it ("Yes, apply it") from the five oversight pages to the National radar, Program blow-ups, Case files and Reallocation pages, and to the top-ten billers' share everywhere.

## Perspective and architecture record
Unchanged (docs/CODEXEN-SCOPE.md). The change adds no lock, lease, cache, queue, timer or persistence path. Both programs write nothing.

## Applicability
- `PotentialFraudSignalReview` (program container): a rule and its answers. Applicable.
- `OversightReview` (program container): reads the answers instead of computing the rule again. Applicable.
- Pages: presentation that reads the answers. Not applicable, apart from the boundary filter on the Reallocation page, which stages only service-years the review answers may be shown.

## Business objects and owners
None new. The radar export's candidates and series stay owned by the warehouse owners. The minimum is run state staged on the review: `SmallCellMinimum`, INITIAL `SMALL_CELL_MINIMUM` (11). `OversightReview` loads the review only when the review's minimum equals the oversight export's.

## Container fields (PotentialFraudSignalReview)
- Run state: `YearPaidIsWithheld` and `YearNewBillersAreWithheld` (Maps by `state|code|year`, INITIAL empty).
- Each service-year: `statePaidIsWithheld`, `priorYearPaidIsWithheld`, `twoYearsPriorPaidIsWithheld`, `newBillersAreWithheld`, `recentlyEnumeratedAreWithheld`, `offTaxonomyAreWithheld`, `paidChangeIsWithheld`, `displacementSharesAreWithheld` (INITIAL false), and `signalStrengthIsShown` (INITIAL all false).
- Each yearly series row: `paidIsWithheld` and `newBillersAreWithheld`.
- Each state-year summary: `withheldServices`, `shownStatePaid`, `shownAboveEnrollment` and `shownWorthReviewAboveEnrollment` (INITIAL 0), and `dollarsAreWithheld` (INITIAL false).

## Molecule sequence (ScorePotentialFraudCandidates, additions)
1. After `DecodeCandidateRows`: the question atoms `WhichYearsArePaidToFewerBillersThanTheMinimum` and `WhichYearsHaveFewerNewBillersThanTheMinimum`.
2. After `ReadNppesCounts`: the question atom `WhichServiceYearFiguresAreWithheld`.
3. `AssessCaseSignals`, `DateRiseEvents` and `MeasureYearlySeriesAgainstEnrollmentLine` (PASSIVE) word and carry the answers.
4. `SummarizeStatesByYear` (PASSIVE) adds the shown totals.
5. After it: the question atom `AreStateYearDollarsWithheld`.

## OversightReview
The question atom `WhichYearsArePaidToFewerBillersThanTheMinimum` becomes the PASSIVE `ReadYearsPaidToFewerBillersThanTheMinimum`, which reads the review's map. The annual flag, the known cases and the brief rows read each service-year's `statePaidIsWithheld` and `priorYearPaidIsWithheld`. `IsReviewLoaded` checks that the minimums agree.

## Exceptions
None: no parameters, returns or locals beyond the existing loop variables.

## Boundaries
The rule binds what pages show. Sorting, the score and the minimum-above-line slider read exact figures (ranking inputs, OPA-01). The national year totals are kept. The pages and the exports from them (the CSV, the case packet) show "withheld" or "fewer than 11".

## Re-review repairs (2026-11-13)

The independent re-review (R1-R6, CX4) left these, now applied:

- **R1** `PotentialFraudSignalReview.WhichServiceYearFiguresAreWithheld` writes `billersAreWithheld` (INITIAL false): the count is withheld when it is 1 to 10 or the year's dollars are withheld, whatever was paid. The case file, blow-up, CSV, checklist and new-entrant strength read it.
- **CX4** Question atom `IsSmallCellMinimumValid` writes `SmallCellMinimumIsValid` (INITIAL false): a whole number no lower than `SMALL_CELL_MINIMUM`. `RejectInvalidSmallCellMinimum` stops the run before anything is scored.
- **R2, R3** `OversightReview.MeasureBriefRows` carries `paidIsWithheld`, `billersAreWithheld` (the review's answers), `changeOnPriorYearIsWithheld` (either end withheld) and a series with withheld years as null. The page shows no share, multiple, paid change or bar for them. `WhichReadingFitsEachBriefRow` does not read NEW · SMALL from withheld dollars. `SummarizeStateBriefs` writes `shownAboveEnrollment` and `withheldRows`, and the large blow-ups count only shown rows.
- **R4** `MeasureNationalCodeYears` folds a state-year whose dollars are withheld, or whose count is not on file, into all other states.
- **R5, R6** Presentation only: a withheld signal strength shades as withheld; the reallocation note reads the review's minimum.

The heat-map selectors (`OversightPicker` in `oversightShared.jsx`) are presentation: they tint by the review's signal scores and decide nothing. Not applicable.
