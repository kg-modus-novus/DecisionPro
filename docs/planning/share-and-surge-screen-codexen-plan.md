# Share-and-surge screen: CodeXen plan

Date: 2026-11-07. Director instruction: "Yes, build it" (the share-and-surge screen into the
warehouse), after the assessment
`Modus Novus/Projects/DecisionPro/medicaid-fraud-detection-assessment-2026-11-07.md`.

## Perspective

`docs/CODEXEN-SCOPE.md`, Director statement 2026-10-28: DecisionPro operates on public and later
DUA Kentucky Medicaid aggregate measures so legislators and staff can see where money goes, whether
people get care, whether health improves, and who is responsible. DecisionPro never holds
person-level Medicaid data.

Applied here: a state-by-procedure-code spending aggregate and the review candidates a screen
derives from it are aggregate measures of where money goes. Billing NPIs appear only as counts
(providers billing, providers new to the code, top-ten share). No NPI identity is loaded in this
release; the provider screen is a later step with its own plan.

## Architecture record

ADR-001 (T1 + A1 + L1 + R1, P1) governs `decisionpro-api`. The warehouse is a batch loader run
from the CLI in one process under one `load_history` row; this change adds no lock, lease,
heartbeat, retry, reload, cache, poll, timer, interval, queue, or duration, so no mechanism needs
a citation. Readers decide from the warehouse tables (`DISTINCT ON ... load_history_id DESC`,
the existing BW authority convention); the app reads a generated export and holds no copy that
is authoritative.

## Applicability

| Unit | Classification | Container |
| --- | --- | --- |
| `xenodroid-bw/scripts/tmsis/stage_tmsis_aggregates.py` (DuckDB over the 2.9 GB publisher parquet, emits CSV at state x code x year and state x month) | Not applicable: data staging and serialization of the publisher file at a declared grain. The attribution rule (billing NPI practice state, else servicing NPI, else `UNMATCHED`) is the published methodology, recorded in the catalog and checked by the loader (state rows plus `UNMATCHED` reconcile to the national total). | none |
| Load of the staged aggregate into `bw_dso` with PSA retention and reconciliation checks | Coordinated business-data access | object container `TmsisStateCodeSpendingOwner` |
| All-state enrollment from the retained PI extract (the existing owner parses Kentucky only) | Coordinated business-data access, same datum, same owner widened | object container `RetrieveAndLoadEnrollment` (existing) |
| Share measurement, completeness gate, four pattern decisions, ten-state filter, candidate selection, backtest | Rules and decisions | object container `ShareAndSurgeCandidateOwner` |
| Export of every candidate, its yearly series and the load dates to `alp/potentialFraudRadar.js` (`ExportPotentialFraudRadarForUi`) | Not applicable: serialization of a read-only projection; no score or tier is computed there | technical export class, as every BW export |

## Business Actions

- `LoadStateCodeSpendingAggregate` (owner `TmsisStateCodeSpendingOwner`)
- `LoadAllStateEnrollmentFromRetainedExtract` (owner `RetrieveAndLoadEnrollment`)
- `DetectShareAndSurgeCandidates` (owner `ShareAndSurgeCandidateOwner`)

## Business objects and owners

| Object | Identity | Owner | Persistence | Holders |
| --- | --- | --- | --- | --- |
| State-code spending aggregate | (state_code, hcpcs, year) and (state_code, month) | `TmsisStateCodeSpendingOwner` | `bw_dso.dso_tmsis_state_code_year`, `bw_dso.dso_tmsis_state_month` | none; read by the candidate owner and the export |
| State enrollment (existing) | (state_code, period_ym) | `RetrieveAndLoadEnrollment` | `bw_dso.dso_enrollment_state` | none |
| Share-and-surge candidate | (state_code, hcpcs, year, pattern) | `ShareAndSurgeCandidateOwner` | `bw_dso.dso_share_surge_candidate` | none; read by the export |

State-transition diagram, review candidate: absent -> detected (this release, written by
`DetectShareAndSurgeCandidates`). Later arrows, detected -> under validation -> disposed
(explained | referred), are human dispositions that need the API (ADR-001) and are not drawn
until that plan exists; the app shows every candidate as Detected.

## Dispositions

- State-code spending aggregate: **D1**. Q1 yes (where the money goes, by state and
  service, is what the business operates on); Q2 yes (attribution rule, suppression, completeness
  carry domain rules); Q3 yes (a second writer would silently change every share). Owning
  container and scope-table row added.
- Share-and-surge candidate: **D1**. Retained, cited and relied on output (the goal case
  and the briefings cite it; Q1, Q2 on the pattern rules and the never-a-finding guardrail, Q3).
  Owning container and scope-table row added.
- Stage CSV files under `data-cache/tmsis/stage/` and the PSA copies: **D3**, the stage script and
  the loader are their sole writers by construction; PSA retention is the existing technical
  convention.
- Load history and PSA object index rows: existing D2 technical conventions of the warehouse.

## Container fields

`TmsisStateCodeSpendingOwner` (INITIAL in parentheses): `Status` ('INITIAL'), `ErrorMessage` (''),
`LoadHistoryID` (''), `StageDirectory` (''), `StateCodeYearBytes` (empty buffer),
`StateMonthBytes` (empty buffer), `StateCodeYearRows` ([]), `StateMonthRows` ([]),
`PublisherTotalPaid` (0), `StateCodeYearPaidSum` (0), `StateMonthPaidSum` (0), `RowsInserted` (0),
`Checks` ([]), `Notes` ([]), `AsOfDate` ('2026-02-09').

`RetrieveAndLoadEnrollment` (existing) gains: `RetainedExtractKey` (''), `AllStateRows` ([]),
`StatesParsed` (0).

`ShareAndSurgeCandidateOwner`: `Status`, `ErrorMessage`, `LoadHistoryID`, `SpendingRows` ([]),
`StateMonthRows` ([]), `EnrollmentRows` ([]), `KnownCases` (the backtest list, staged by the CLI),
`NationalPaidByCodeYear` ({}), `StatesBillingByCodeYear` ({}), `EnrollmentShareByStateYear` ({}),
`ReportingCompleteByStateYear` ({}), `ShareRows` ([]: one per state-code-year with share,
enrollment share, excess multiple, prior-year share and paid, and the four answer fields
`ShareIsSurging`, `SpendingTripledAndKeptGrowing`, `ShareCollapsed`,
`ShareIsPersistentlyAboveEnrollment`), `Candidates` ([]), `BacktestResults` ([]),
`RowsRead` (0), `CandidatesDetected` (0), `KnownCasesDetected` (0), `KnownNegativesFired` (0),
`CandidatesInserted` (0), `Checks` ([]), `Notes` ([]). Each candidate also carries `leadScore`
(paid x excess multiple) and, for the leveling what-if the Director asked for on 2026-11-07,
`paidAboveEnrollmentLevel` (paid less national paid x enrollment share, floored at zero) and
`paidAbovePriorShareLevel` (paid less national paid x prior-year share, floored at zero), both
first-order with the national total held constant; persisted as `paid_above_enrollment_level`
and `paid_above_prior_share_level`. The export sums them per state-year over distinct services;
the app adds only the federal matching rate (`federalMatchingRate.js`, KFF from the Federal
Register) to say how much of a redirected dollar is state money. A what-if, never a recovery.

Rule constants, named in the container: `MINIMUM_STATES_BILLING` 10 (Empower's filter),
`MINIMUM_STATE_PAID` $1,000,000 in the pattern year, `ENROLLMENT_EXCESS_MULTIPLE` 5 (a share
"far above" enrollment), `SURGE_SHARE_MULTIPLE` 2 (share at least doubled on the prior year),
`TRIPLE_MULTIPLE` 3 (paid at least 3x two years earlier with no down year), `COLLAPSE_FRACTION`
0.6 (share fell by at least 60% from a year that was far above enrollment),
`PERSISTENT_YEARS` 3, `REPORTING_TAIL_FRACTION` 0.5 (a month under half the state's trailing
median marks the state-year preliminary). Calibrated on the backtest, recorded in the export.

## Molecule sequence

`LoadStateCodeSpendingAggregate`:
1. `InitializeLoadRunState` PASSIVE.
2. `OpenLoadHistory` ACTIVE (insert load_history).
3. `ReadStagedStateCodeYearFile` ACTIVE (one read into `StateCodeYearBytes`; error if empty).
4. `ReadStagedStateMonthFile` ACTIVE.
5. `RetainStageFilesInPsa` ACTIVE x2 (PutObject each; index rows).
6. `ParseStagedRows` PASSIVE (CSV to typed rows; `UNMATCHED` kept as a state value; empty cells rejected).
7. `ReconcileStagedTotals` PASSIVE (state-code-year paid sum, state-month paid sum and the
   manifest's publisher total less the set-aside rows agree within the rounding tolerance of
   half a cent per staged row; pushes Checks).
8. `ReplaceStateCodeYearRows` ACTIVE (delete REAL rows, then batched insert as one statement per
   batch; the delete and inserts run inside one transaction whose handle is the client field).
9. `ReplaceStateMonthRows` ACTIVE.
10. `CompleteLoadHistory` ACTIVE (SUCCEEDED or FAILED with the failed check).

`LoadAllStateEnrollmentFromRetainedExtract`:
1. `InitializeRunState` PASSIVE. 2. `OpenLoadHistory` ACTIVE. 3. `ReadLatestRetainedPiExtract`
ACTIVE (latest REAL object under `psa/CMS_DATA_MEDICAID_ENR/REAL`). 4. `ParseAllStateEnrollment`
PASSIVE (same column rules as the Kentucky parse, every state abbreviation, final reports
preferred). 5. `IsEnrollmentCoverageSufficient` PASSIVE (51 states, every month 2018-2024;
counters). 6. `InsertAllStateEnrollmentRows` ACTIVE. 7. `CompleteLoadHistory` ACTIVE.

`DetectShareAndSurgeCandidates`:
1. `InitializeScreenRunState` PASSIVE. 2. `OpenLoadHistory` ACTIVE.
3. `LoadSpendingRows` ACTIVE (latest REAL load, DISTINCT ON). 4. `LoadStateMonthRows` ACTIVE.
5. `LoadEnrollmentRows` ACTIVE (latest REAL load per state-period).
6. `MeasureNationalPaidByCodeYear` PASSIVE (every row including `UNMATCHED`).
7. `CountStatesBillingEachCodeYear` PASSIVE (states with at least $100,000; `UNMATCHED` excluded).
8. `MeasureEnrollmentShareByStateYear` PASSIVE (mean of monthly total Medicaid and CHIP
   enrollment per year over the national mean).
9. `IsStateYearReportingComplete` PASSIVE (from state-month rows and `REPORTING_TAIL_FRACTION`).
10. `MeasureStateShareOfNational` PASSIVE (builds `ShareRows`); `AttachPriorYearAndPeakContext`
    PASSIVE (prior year, two years prior and the running peak of each state-code group in one
    ordered walk; a row-by-row scan does not finish on 800,000 state-code-years).
11. `IsShareSurging` PASSIVE. 12. `HasSpendingTripledAndKeptGrowing` PASSIVE.
13. `HasShareCollapsed` PASSIVE. 14. `IsSharePersistentlyAboveEnrollment` PASSIVE.
15. `SelectReviewCandidates` PASSIVE (ten-state filter, minimum paid, one candidate per pattern
    fired; a preliminary state-year is kept and labeled, never dropped, because Empower kept 2024).
15a. `MeasureLevelingWhatIf` PASSIVE (the two above-the-line amounts on each candidate).
16. `BacktestKnownCases` PASSIVE (each known positive must appear; each known negative must not).
17. `ReplaceCandidateRows` ACTIVE (delete REAL, batched insert; transaction on the client field).
18. `CompleteLoadHistory` ACTIVE. The backtest failing sets FAILED and the CLI stops before export.

## Coordination mechanisms

None added or altered. Transactions: each owner's replace runs delete and insert on the one
client inside one `BEGIN`/`COMMIT`, the client being a container field; rollback on error.

## Exceptions

Constructors take the `pg.PoolClient` (existing BW convention, request isolation per CLI run).
Exported pure parse functions take the CSV text and return rows so they can be unit-tested
without Postgres; this follows the warehouse's existing parser convention (`ParseKentucky
EnrollmentFromPiCsv`, `ParseKentuckyCountyMembership`) and is the documented look-alike
consolidation of the third CSV parser of the same shape. No other parameters, returns or locals
in molecules or atoms; per-row answers live on the row records inside the container's `ShareRows`.

## Boundaries

- Stage script: writes CSV with explicit empty strings never, zeros for suppressed-to-nothing
  cells, and a `manifest.json` with the publisher total paid, row counts and the parquet sha256.
- Loader: rejects a row with a non-numeric amount; `UNMATCHED` is a value, not null.
- Tables: `NOT NULL` on every column, `CHECK (load_class IN ('TEST','REAL'))`, primary keys on the
  identity plus load_history; no foreign key actions beyond `REFERENCES` (RESTRICT by default);
  no triggers.
- Export: a generated module; app components read figures and never recompute a pattern.
- Deletes: only the owner's replace molecules delete their own REAL rows before reinserting.

## Scope changes

- Object table: two D1 rows (aggregate, review candidate) with owners and persistence as above.
- Program containers: none (both new containers are object containers).
- Markers: `// CodeXen-Container: v1 kind=object container=TmsisStateCodeSpendingOwner owns=state-code-spending-aggregate`
  and `... container=ShareAndSurgeCandidateOwner owns=share-and-surge-candidate` on the two new
  molecule files. Other BW molecules are unclassified (no legacy banner), so no directory upgrade
  is triggered. No `codexen-index` script exists in this repository; recorded as before.
- Catalog: source `HHS_OPEN_DATA_TMSIS` (publisher HHS Open Data, from CMS T-MSIS), data requests
  `DR-REAL-TMSIS-STATE-CODE-SPENDING`, `DR-REAL-PI-ENROLLMENT-ALL-STATES`,
  `DR-REAL-SHARE-SURGE-SCREEN`; migration `015_tmsis_share_surge.sql` added to the migrate list.
- CLI: `tmsis-screen` (load aggregate, load all-state enrollment, detect, export) and the export
  appended to `ofr-depot-export`.
- App: `BRIEFING_SOURCE_LABELS.HHS_OPEN_DATA_TMSIS`; fourth case on `program-integrity` and on
  `provider-integrity`; templates `shareAgainstEnrollment` and `growthBeyondEnrollment`.

## Revision 2026-11-07 (evening)

The Program Integrity goal case, the three briefing cards, the leveling card and the KY+FL export
`alp/shareAndSurgeScreen.js` were removed: the Director had not authorized that surface. The screen
now feeds the dedicated Potential Fraud Detection module through `ExportPotentialFraudRadarForUi`
(plan: [potential-fraud-detection-codexen-plan.md](potential-fraud-detection-codexen-plan.md)).

## Change 2026-11-08: states billing on each backtest verdict

The backtests page draws each innocent convention as the most states that ever billed its code against the ten-state filter. That count was only in the known case's note text, so the screen owner now records it.

- **Container.** `ShareAndSurgeCandidateOwner` (object container) gains the run-state field `MostStatesBillingByCode` (INITIAL `{}` in `InitializeScreenRunState`) and the PASSIVE atom `MeasureMostStatesBillingEachCode`, sequenced right after `CountStatesBillingEachCodeYear` and reading only `StatesBillingByCodeYear`, so the count is the one the ten-state filter uses (states other than UNMATCHED paid at least `STATE_BILLING_THRESHOLD` on the code in a year). `BacktestKnownCases` writes it onto each `BacktestResult` as `mostStatesBilling`, and `RecordScreenChecks` carries it in the run's `backtest-json:` note.
- **No new persistence or transition.** The candidate rows, their columns and the absent -> detected arrow are unchanged; the note is the screen run's load-history record, already written by `CompleteScreen`. No lock, retry, cache or timer.
- **Export.** `ExportPotentialFraudRadarForUi` passes `mostStatesBilling` onto each backtest entry, refuses a screen run whose verdicts predate it, and adds `minimumStatesBilling` and `stateBillingThreshold` from the owner's constants, so the app never parses either from prose.
- **Test.** The owner test pins the counts on the synthetic world (12 states on the screened codes, 5 on the convention, 1 on the small code) and the note's JSON.
