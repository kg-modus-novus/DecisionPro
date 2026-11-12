# Law-and-policy layer for Potential Fraud Detection: plan, 2026-11-11

**Status:** all six decisions made by Ken on 2026-11-11 (section 5). Build started 2026-11-11 on `feat/law-and-policy-layer`, one commit per item of section 7.

**Why:** the module flags a rise without knowing whether a law, rule, code or reporting change sits behind it. On the 2026-11-11 call Jeremy asked for exactly this, and Bobby said his own screen already does it. A check of Kentucky's documents found one such change the module does not show: behavioral health prior authorization was suspended during the COVID emergency and stayed suspended until House Bill 695 reinstated it, effective June 25, 2025.

---

## 1. What it does, in plain terms

1. **Load dated public events** for each state: laws, state plan amendments, waivers, agency provider letters, rate changes, billing-code changes, reporting changes, enforcement.
2. **Match them to each flagged rise.** An event matches when it covers the service and takes effect in the window before the rise.
3. **Say what kind of explanation it is.** Four kinds, treated differently:

| Kind | Example | What the module does |
|---|---|---|
| Measurement artifact | A billing code replaced another; a state changed how it reports | Rated "EXPLAINED" with its reason ("billing code changed", "reporting changed"); its dollars leave "worth review" (Decisions 1 and 5) |
| Intended growth | New benefit, rate increase, eligibility expansion, waiver | Tagged "may explain"; a reviewer decides |
| Policy opening | Prior authorization suspended, a limit removed, a new provider type allowed | Stays on the list, tagged "safeguard relaxed" |
| Restriction or enforcement | Limits set, coverage ended, prosecutions | Explains a fall; dates where to watch for displacement |

4. **Say when it has not looked.** "No event found" and "not searched" are different answers. Every state and source carries a searched-through date, and a rise in a state that was never searched reads "not searched".

## 2. Sources and order

| Phase | Source | Covers | Form | Gives |
|---|---|---|---|---|
| 1 | Curated event files for Kentucky, Arizona, District of Columbia, West Virginia | 4 states | Each event read from the publisher's document, with a link and a quote; suggested until a person confirms it | The showcase and the backtest |
| 2 | CMS HCPCS quarterly update files | All states | Published files | Billing-code changes; turns on the "code migration" check |
| 3 | CMS DQ Atlas ratings (partly downloaded already) | All states | Published files | Reporting changes by state and year |
| 4 | Medicaid.gov state plan amendment list (about 16,800 entries) and Section 1115 waiver pages | All states | Web pages; no download or API found | Dated events with a coarse topic; "may be related" only |
| 5 | AI-assisted search per flagged rise | Any state | Suggestions for a person to confirm | What Bobby described; never affects a rating until confirmed |
| 6 | In-app confirm and reject | Any state | Needs the API | Replaces the curated files |

Kentucky's legislative record and fee schedules are already in the source catalogue (SOT-LEG-01, SOT-FEE). LegiScan covers every state's bills: free for one state, $25 a year per state, $1,000 a year for all 50. Not needed for phase 1.

## 3. Where it shows

- **Radar:** a tag on each row, and a filter for "unexplained only".
- **Program blow-ups:** events pinned on the yearly chart.
- **Case file:** the ledger replaces the hand-answered policy question; the reviewer can still override for the session.
- **Explanation ledger page** (mockup 4), **state brief** and each page's **"What to look for"** panel.

## 4. Tests it must pass before it is trusted

- Kentucky psychoeducation carries the prior-authorization suspension as a policy opening and stays HIGH.
- Arizona's collapse carries the 2023 enforcement.
- None of the five known case-years is downgraded.
- At least one known measurement artifact (a replaced billing code, found in phase 2) is rated as an artifact.
- A state with no search on file reads "not searched", never "none found".
- An unconfirmed suggestion of a measurement artifact changes no rating, no count and no filter.

## 5. Decisions for Ken

| # | Decision | Recommendation |
|---|---|---|
| 1 | May a confirmed measurement artifact lower a rating, or are events shown only? | **Decided 2026-11-11 (Ken): yes, artifacts only.** Openings and intended growth never lower a rating. |
| 2 | How far back does an event count? | **Decided 2026-11-11 (Ken):** 24 months before the first flagged year for permanent changes, plus any temporary measure still in force when the rise starts (see the note below) |
| 3 | Which states get curated files first? | **Decided 2026-11-11 (Ken):** Kentucky, Arizona, District of Columbia, West Virginia |
| 4 | May unconfirmed AI suggestions be shown? | **Decided 2026-11-11 (Ken): show them, labeled.** They appear on the case file marked as unconfirmed. They never change a rating, a count or a filter (Decision 1 covers confirmed events only). The recommendation was to keep them out, because the app has no real access boundary today. |
| 5 | Wording for the new rating and labels | **Decided 2026-11-11 (Ken):** plain labels: rating "EXPLAINED" with its reason ("billing code changed", "reporting changed"); tags "safeguard relaxed", "may explain", "none found", "not searched", "unconfirmed suggestion" |
| 6 | Pay for LegiScan? | **Decided 2026-11-11 (Ken): hold off.** Revisit at phase 5; try Open States first. |

**Note on Decision 2.** A plain 24-month window would miss the Kentucky example: prior authorization was suspended in 2020 and the first flagged year is 2023. So an event carries an end date when it is temporary (a suspension, an emergency flexibility), and a temporary measure counts whenever it is still in force at the start of the rise. A permanent change (a new benefit, a rate) counts only inside the window, so a benefit added ten years ago does not explain a rise today.

---

## 6. CodeXen plan

### Perspective
Director statement of 2026-10-28 and amendment of 2026-11-07, `docs/CODEXEN-SCOPE.md`. A dated public policy event is public context DecisionPro reads so that a state's spending on a service can be compared fairly. It names no provider and holds no person-level data.

### Architecture record
ADR-001 (T1, A1, L1, R1, P1) governs `decisionpro-api`. Phases 1 to 5 add no lock, lease, timer, cache, queue or background operation: they are warehouse batch loads on the existing load-history pattern, and the app stays read-only. Phase 6 writes through the API and needs its own plan against ADR-001. (The CodeXen context tool reports the architecture record as missing; the scope file names ADR-001. No decision is needed for phases 1 to 5.)

### Applicability
| Unit | Classification | Container |
|---|---|---|
| Load of policy events with refusal rules | Coordinated business-data access | object container `PolicyEventOwner` (new) |
| Matching events to a rise; kind of explanation; rating effect | Rule and decision | program container `PotentialFraudSignalReview` (existing) |
| Staging scripts for HCPCS, DQ Atlas, state plan amendment list | Not applicable: adapters | none |
| Suggestion script (phase 5) | Not applicable: research tooling; writes a candidates file nothing decides from | none |
| Export of events and search coverage | Not applicable: serialization | export class |
| Pages | Not applicable: presentation of program fields | none |

### Business Actions
- `LoadPolicyEventsAndSearchCoverage` (owner `PolicyEventOwner`)
- `ScorePotentialFraudCandidates` (existing, widened)

### Business objects and owners
| Object | Identity | Owner | Persistence | Arrows |
|---|---|---|---|---|
| Policy event (carries an effective date and, when temporary, an end) | `event_id`, a hand-written id unique in the load | `PolicyEventOwner`, `xenodroid-bw/src/molecules/PolicyEventOwner.ts` | `bw_dso.dso_policy_event`, and beside it `bw_dso.dso_policy_search` | absent → suggested → confirmed; absent → confirmed; suggested → absent; confirmed → suggested; confirmed → absent |

The curated files are the authoritative copy and each load replaces the source whole. So a file edit moves an event along any of these arrows: adding it, confirming it, dropping a rejected suggestion, demoting a confirmed event or withdrawing it. The load does not refuse a withdrawal or demotion of a confirmed event; it lists the affected ids in the load history notes. Whether that should instead be refused is an open point for Ken (section 9).

### Dispositions
- **Policy event: D1.** Q1: public context the declared business reads to compare spending fairly, like the published fee schedules already in the object table. Q2: it carries rules (a source link, a document date, an effective date, a scope, a kind). Q3: several sources and loaders would otherwise write it incoherently.
- **Search coverage** (state, source, topic, searched-through day, partial or full): data of the policy-event load, kept in a table beside the events and written by the same owner in the same transaction. No separate object.
- **Explanation standing of a service-year:** computed on demand by the program. Not an object.
- **AI suggestions (phase 5): a state of the policy event, not a separate file** (changed by Decision 4). Because suggestions are shown in the app, they are loaded and exported as policy events with standing `suggested`. A person confirms one by moving it into a curated file, which loads it with standing `confirmed`; a rejected suggestion is dropped at the next load. Arrows: absent → suggested → confirmed, and absent → confirmed for hand-entered events. The program decides only from `confirmed` events.
- **Reviewer override in the case file: D3**, session-only, as the other reviewer answers are today.

### Container fields
`PolicyEventOwner` as built in item 2 (INITIAL in parentheses): `Status` ('INITIAL'), `ErrorMessage` (''), `LoadDay` (''), `LoadHistoryID` (''), `LoadHistoryIsOpen` (false), `EventsDirectory` (config), `DirectoryEntryNames` ([]), `EventFileNames` ([]), `EventFileTexts` ([]), `RetainedBytes` (empty), `RetainedPsaKey` (''), `RetainedByteLength` (0), `PsaIndexRowsInserted` (0), `ParsedFiles` ([]), `EventRows` ([]), `SearchRows` ([]), `PreviouslyConfirmedEventIds` ([]), `ConfirmedEventIdsWithdrawn` ([]), the rule counters `FilesNotNamedForTheirState`, `FilesWithoutSearch`, `EventsOutsideTheirFileState`, `EventsWithoutIdOrSummary`, `EventsWithDuplicateId`, `EventsOfUnknownKindOrDirection`, `EventsWithoutEffectiveDate`, `EventsStatingTwoEnds`, `EventsEndedByNoKnownEvent`, `EventsEndingBeforeTheyStart`, `ConfirmedEventsEndedByUnconfirmedEvents`, `EventsWithoutScope`, `EventsWithMalformedScope`, `EventsWithoutNamedSource`, `EventsWithoutSourceQuote`, `EventsOfUnknownStanding`, `EventsWithMismatchedConfirmation`, `EventsDatedAfterTheLoadDay`, `EventsBeyondTheInsertLimit`, `SearchesWithoutNamedSource`, `SearchesWithoutSearchedThroughDay`, `SearchesOfUnknownCompleteness`, `SearchesWithDuplicateIdentity`, `SearchesDatedAfterTheLoadDay` (each 0), `SuggestedEvents` (0), `ConfirmedEvents` (0), `ReconciliationIsClean` (false), `TransactionIsOpen` (false), `EventRowsInserted` (0), `SearchRowsInserted` (0), `RowsInserted` (0), `Checks` ([]), `Notes` ([]), `PsaStamp` (''), `AsOfDate` ('').

`PotentialFraudSignalReview` gains: `PolicyEvents` ([]), `PolicySearchCoverageByState` ({}), `PolicyEventLookbackMonths` (0, read from the export's rule), and on each service-year `policyEvents` ([]), `measurementArtifactEvents` (0), `policyOpeningEvents` (0), `intendedGrowthEvents` (0), `restrictionEvents` (0), `suggestedPolicyEvents` ([]), `suggestedEvents` (0), `policySearchIsOnFile` (false), `explanationStanding` ('not-searched'). The four kind counters count confirmed events only.

Rule constants, named in the containers. Owner: `POLICY_EVENT_KINDS`, `POLICY_EVENT_DIRECTIONS`, `POLICY_EVENT_STANDINGS`, `POLICY_SCOPE_BASES`, `POLICY_SEARCH_COMPLETENESS`, `POLICY_EVENT_LOOKBACK_MONTHS` (24, Decision 2), `POLICY_EVENT_INSERT_LIMIT` (2,000 events in one load). Program (item 4): `EXPLANATION_KIND_BY_EVENT_KIND`.

### Molecule sequence
*The `ScorePotentialFraudCandidates` additions below are the pre-build sketch. The sequence as built, with its atom names, is in the item 4 entry of section 8.*

`LoadPolicyEventsAndSearchCoverage` as built in item 2:
1. `InitializeLoadRunState` PASSIVE
2. `ReadEventsDirectory` ACTIVE, `SelectCuratedEventFileNames` PASSIVE (one file per state, in name order)
3. `ReadCuratedEventFiles` ACTIVE
4. `NameLoadHistoryAndRetainedCopy` PASSIVE, `OpenLoadHistory` ACTIVE, `MarkLoadHistoryOpen` PASSIVE
5. `ComposeRetainedCopy` PASSIVE, `EnsurePsaRootIsReady` ACTIVE, `RetainEventFilesInPsa` ACTIVE, `IndexRetainedPsaObject` ACTIVE
6. `ParseCuratedEventFiles` PASSIVE (the pure parse rejects an unknown key, a wrong type, a malformed date, and a confirmation or searched-through date that is not a day; nothing stated is read as absent)
7. `CountEventsStatingTwoEnds` PASSIVE, `DateEventsEndedByAnotherEvent` PASSIVE
8. `CountFilesOutsideTheirRules`, `CountEventsOutsideTheirRules`, `CountSearchesOutsideTheirRules`, `CountEventsByStanding` PASSIVE
9. `ReconcilePolicyEvents` PASSIVE (one check per counter; the rule recorded as the note `policy-rule-json:`)
10. `IsReconciliationClean` question, writes `ReconciliationIsClean`; `RefuseUncleanLoad` PASSIVE records an unclean load as failed
11. `DateLoadAsOfLatestSearch` PASSIVE
12. `ReadPreviouslyConfirmedEventIds` ACTIVE, `ListConfirmedEventsWithdrawn` PASSIVE
13. `BeginReplaceTransaction`, `DeleteEventRows`, `InsertEventRows`, `DeleteSearchRows`, `InsertSearchRows` ACTIVE (replace whole for this source; nothing is replaced when reconciliation is not clean)
14. `SumRowsInserted` PASSIVE, `CompleteLoad` ACTIVE (the success record, inside the transaction), `CommitReplaceTransaction` ACTIVE, `MarkLoadSucceeded` PASSIVE
15. `FailLoad` ACTIVE closes an unclean load as failed (only on a load history this run opened). On a thrown error, at the molecule's boundary: `RollbackReplaceTransaction` ACTIVE, then `FailLoad`

The owner is a look-alike of `TmsisStateCodeSpendingOwner` (same load-history, PSA and replace-whole shape), duplicated on purpose. Each insert statement and its values are built from one column list, so they cannot fall out of line.

`ScorePotentialFraudCandidates` adds, after `DateRiseEvents`:
1. `ReadPolicyRule` PASSIVE
2. `IsPolicySearchOnFile` question, writes `policySearchIsOnFile`
3. `MatchPolicyEventsToRise` PASSIVE (scope covers the code; effective date inside the lookback, or a temporary event still in force at the start of the rise)
4. `CountMatchedEventsByExplanationKind` PASSIVE
5. `DoesMeasurementArtifactCoverRise` question
6. `DoesPolicyOpeningPrecedeRise` question
7. `NameExplanationStanding` PASSIVE (not-searched, none-found, artifact, opening, intended-growth, restriction)
8. The tier atom reads `explanationStanding` under Decision 1.

The hand-typed `PROGRAM_EVENTS` list in the catalog is removed once the three cases are in the curated files.

### Coordination mechanisms
None added.

### Exceptions
None planned.

### Boundaries
- Curated files: one JSON file per state under `xenodroid-bw/policy-events/`, named for the state (`KY.json`).
- The pure parse normalizes a stated date (`YYYY`, `YYYY-MM` or `YYYY-MM-DD`, as text) to a day with its precision: a start takes the first day of the stated period, an end the last. It rejects an unknown key at every level, a wrong type, a malformed date, unreadable JSON (naming the file), and a confirmation or searched-through date that is stated but is not a day. Absent text becomes '' and an absent list [].
- The owner, not the parse, refuses on the rules: source named and quoted, effective date, scope and its basis, one end, standing and confirmation, dates not after the load day, file named for its state, searches named, dated and unrepeated.
- A scope says whether the document names the codes (`named-in-document`) or the codes stand in for a service family the document names (`stands-in-for-service-family`, with a note). A proxy is always labeled.
- A temporary event ends by its own stated end date, or by another event of the load (`endedBy`), whose effective date becomes its end. Each end is therefore sourced. Two events may not end each other, and a confirmed event is ended only by a confirmed event, so no unconfirmed suggestion decides how long a confirmed event was in force.
- A confirmation is not dated before its document, and no document, confirmation or search is dated after the load day (the local day of the machine that runs the load).
- A search carries a completeness of partial or full, so a partial search never reads as "none found".
- Curated research is loaded with standing `suggested`. Only a person sets `confirmed`, with their name and the day.
- Persistence: `sql/017_policy_event.sql`: `bw_dso.dso_policy_event` and, beside it, `bw_dso.dso_policy_search`. Refusing constraints only, each restating a rule the owner keeps. A permanent event's absent end date and a suggested event's absent confirmation day cross the database boundary as NULL. No trigger, no cascade.
- The success record is written inside the replace transaction, so rows never commit under a load that is not recorded as succeeded.
- The curated source is kept out of the app's authoritative-sources list and its data-spectrum source list: it is DecisionPro's own curation, not an outside source, and has no public link.
- The export (item 3) carries the events, the search coverage and the rule the load ran under. It refuses when there is no succeeded load, when the load does not record its rule or its lookback months, and when the tables do not hold the rows the load recorded.

### Scope changes
- Object table: add Policy event (D1, `PolicyEventOwner`).
- Program table: widen the `PotentialFraudSignalReview` entry.
- Marker: `CodeXen-Container: v1 kind=object container=PolicyEventOwner owns=policy-event`.

## 7. Build order (one commit per item)

1. Plan and scope file.
2. `PolicyEventOwner`, migration, curated files for the four states, with tests.
3. Export.
4. Program atoms, tests and the backtest additions.
5. Case file ledger and blow-up chart pins.
6. HCPCS code changes.
7. DQ Atlas ratings.
8. State plan amendment and waiver index.
9. Suggestion script.
10. Explanation ledger page.

Each item gets the CodeXen self-check and an independent review by a subagent. Nothing is deployed until Ken says "deploy".

## 8. Build log

**Item 2, 2026-11-11.** `PolicyEventOwner`, migration 017, the catalog entries (`DECISIONPRO_CURATED_POLICY_EVENTS`, `DR-REAL-POLICY-EVENTS`), the CLI command `policy-events-load`, and three curated files with eight events, each read from the publisher's document and loaded as `suggested`:

| State | Event | Effective | Ends |
|---|---|---|---|
| KY | Prior authorization suspended for medical claims, including behavioral health (reported by the Kentucky Medical Association) | 2020-02-04 | 2025-06-25, by the reinstatement |
| KY | Behavioral health prior authorization still suspended as of the tracker | 2023-04-25 (the tracker's date) | 2025-06-25, by the reinstatement |
| KY | Limits and prior authorization for psychoeducation and peer support | 2025-01-01 | 2025-04-08, by the partial rescission |
| KY | That letter rescinded in part | 2025-04-08 (the letter's date) | permanent |
| KY | Behavioral health prior authorization ordered reinstated (2025 House Bill 695) | 2025-06-25 | permanent |
| KY | Psychoeducation no longer reimbursed (2026 House Bill 470) | 2026-07-15 | permanent |
| AZ | Payment suspensions on credible allegations of fraud announced | 2023-05-16 | permanent |
| WV | Residential treatment, peer recovery support and withdrawal management scheduled under the Section 1115 demonstration | 2018-07-01 | permanent |

Every search is recorded as partial, each dated to the document that was read. Each summary claims only what its quote or its scope note supports.

**District of Columbia was held back, then added on 2026-11-11.** The one document read is an arraignment release that names a charged individual. Whether a link to such a release fits "DecisionPro names no provider" was a Director decision (section 9, point 5). Ken decided to add it: the name is public, and the event's summary and quote name no one. See "District of Columbia event added" below.

**Reviews.** Self-check: pass after six repairs.

First independent review (subagent): revision-required, 14 findings (1 major). All addressed:
- I01 (major): the parse no longer reads a stated value as absent. It rejects unknown keys, non-text dates and a confirmation or searched-through date that is not a day.
- I02: the owner keeps the invariants the load depends on (file named for its state, unrepeated searches, well-formed scope, no date after the load day).
- I03: the confirmation constraint states the whole rule.
- I04: the arrows a file edit can cause are in the scope file and section 6; the load lists withdrawn or demoted confirmed events, and the CLI prints them.
- I05: the success record is inside the transaction.
- I06: the tests read the statements, their order and their columns, and cover the short insert, the failed success record, the failed commit and the missing cases.
- I07, I08, I09: names state the full effect; ACTIVE atoms hold one statement with an error-only check; no locals carry workflow state.
- I10, P1, P2: recorded as open points for Ken (section 9), with a proposed scope-file line.
- I11: this document agrees with the code.
- I12: the 2020 suspension is its own event; ends are sourced through the ending event; proxy scopes are labeled; searches are dated to what was read.
- I13: the curated source is not listed in the app's authoritative-sources list or its data-spectrum source list.
- I14: unreadable JSON names its file; the insert limit is a refusal rule.

Second independent review (same subagent): revision-required, narrowly. Addressed:
- N01: a confirmed event is ended only by a confirmed event (new counter and check).
- N02: the curated summaries, scope notes and search dates were cut back to what each quote supports; West Virginia reads "scheduled"; the District file is held back.
- N03: the withdraw and demote arrows are marked pending in the scope file; the CLI prints withdrawn or demoted confirmed events.
- N04: the load day is the local day; the byte-order mark is written as an escape; two events may not end each other; a confirmation is not dated before its document.

Third pass (same subagent): **pass, with advisories.** Two were applied afterwards: the load day no longer depends on locale data, and the confirmation-not-before-document rule has its own constraint. Carried as advisories: a ring of three events ending each other on one day still loads; the transaction atoms set their open flag after their statement; a failure while recording an unclean load escapes the molecule.

**Notes for item 4.** The load's as-of date is the latest searched-through day (2026-04-24), not the day the curation was done; the export should label it so. The limits event ends on 2025-04-08 through a partial rescission, so the program should not read it as fully lifted.  Kentucky's 2020 suspension and the 2023 "still suspended" event describe one continuing policy over the same codes, so the program must count the policy once, not twice. West Virginia's only search runs through 2017.

**Evidence (headless-validated).** 24 owner tests and the 16 existing warehouse tests pass; the type check is clean. The full chain (migrations 001 to 017, seed, load, reload) ran against a throwaway PostgreSQL 16 database: the events and searches loaded, the reload replaced rather than added, and four refusing constraints were checked. The local warehouse database was not loaded: its container could not start because Windows had reserved port 5042.

**Confirmation, 2026-11-11.** Ken confirmed the eight events on file. The curated files now carry standing `confirmed`, `confirmedBy` Ken Greenwood, `confirmedOn` 2026-11-11.

**Requirement from Ken, 2026-11-11: every code is described.** Wherever an event shows a code (an HCPCS billing code, or a code family that stands in for a service family), the screen gives its description through a "?" pop-up, and the code is in the glossary. The glossary carries the billing code or the code prefix on the entry, and a test fails when an event names a code the glossary does not describe.

**Codes described, 2026-11-11.** The glossary now has entries for HCPCS code, H codes, H2027 and H0038, each code entry carrying the billing code or prefix it describes. The case file and program blow-up headings show a "?" beside the code that gives its description and opens the glossary there. A test fails when a curated event names a code or code family the glossary does not describe. Still to come: the events themselves reach the screen in item 5 and use the same "?"; a description for every one of the radar's codes needs the HCPCS description file that item 6 loads. Evidence: isolated-rendered, 20261111T183321473Z.

**District of Columbia event added, 2026-11-11.** Ken's decision: add the event with a summary that names no one and a link to the release. On file as `dc-community-support-worker-arraigned-2025-09`, kind enforcement. Loaded as `suggested`; Ken confirmed it the same day, so it now carries standing `confirmed`, `confirmedBy` Ken Greenwood, `confirmedOn` 2026-11-11. All nine events on file are confirmed.
- The release's headline and link do not contain the name. The summary and the quote are name-free fragments of the release, each checked word for word against the page.
- The event is dated to the arraignment (2025-09-08); the release is dated 2025-09-10.
- The summary says the charges are an allegation and that this is one person's case, not a change in policy. The release puts the amount at over $234,500.
- The release names community support services, not a billing code. H0036 stands in for them, and the glossary now describes H0036.
- For item 4: the event falls after the District's flagged years for H0036 (2020 to 2024), so under Decision 2 it cannot explain them. It shows as later enforcement only. The District still has no policy source for the 2022 rise in H0036.

**Item 3, 2026-11-11: the export.** `ExportPolicyEventsForUi` (`xenodroid-bw/src/molecules/ExportPolicyEventsForUi.ts`), the CLI command `policy-events-export`, the config path `policyEventsExportPath`, and the app file `wireframe V1/app/src/data/alp/policyEvents.js`.
- **Carries:** every event of the latest succeeded load, confirmed or suggested, each with its standing, scope, source and dates (a day with its precision); every search with its searched-through day and whether it was partial or full; the rule as the load recorded it (the lookback months and the allowed values), never the owner's current constants; the load's id, times, notes and row count; and the hash of the curated files as the load retained them.
- **Labels the as-of date:** the load's as-of date leaves as `latestSearchedThrough`, because it is the latest searched-through day of any search on file, not the day the curation was done (the note for item 4 above).
- **Refuses, and writes nothing:** no succeeded load; a load without its rule or without its lookback months; tables that do not hold the rows the load recorded.
- **Does not decide:** it matches no event to a rise, names no explanation and touches no rating. That is item 4, in `PotentialFraudSignalReview`, from confirmed events only.
- **Kept in step:** an app test (`policyEventsExport.test.js`) compares the export with the curated files event by event and search by search, and fails when a file edit or a confirmation has not been exported. The code guard also runs over the export.
- **The file on record came from a throwaway database.** The local warehouse database still cannot start (Windows holds its port), so the four curated files were loaded into a throwaway PostgreSQL 16 database and exported from it. The `loadHistoryId`, the load times and the load notes in the file describe that throwaway load, which no longer exists; "0 confirmed events withdrawn" there says nothing about the warehouse. The events, searches and rule are the curated files' own: an app test recomputes the content hash from the files and compares the export with them event by event. The file must be regenerated from the local warehouse before any page shows load provenance and before any deploy (section 9, point 6).
- **Stable bytes:** `xenodroid-bw/policy-events/.gitattributes` keeps the curated files' line endings the same on every checkout, so the hash the load records does not depend on the machine.
- **CodeXen:** not applicable, as planned in section 6: serialization. The refusals guard the export's own inputs; no business rule is decided.
- **Independent review (subagent):** CodeXen not applicable; correctness sound, no blocking or major finding. Six minor findings and three advisories, addressed in the same change:
  - R01: the throwaway provenance is stated above and is now an open point and a deploy prerequisite (section 9, point 6).
  - R02: the tests use a lookback that is not the owner's constant, so they tell the recorded rule from the current one.
  - R03: a rule that cannot be read is refused in the export's own words; the note separator is named. Still known in two places (the owner joins, the export splits); moving the parse beside the owner's is left for a change that opens the owner.
  - R04: the tests pin the order of both reads.
  - R05: the app test recomputes the content hash, compares curated values as the load normalizes them, and a warehouse test fails when the export on record was made under a rule the owner no longer records.
  - R06: the confirmer's name is in the export nine times; whether it ships to the public site is an open point (section 9, point 7).
  - R07: dates leave the database through `to_char`, whatever the session's date style.
  - R08: the scope file names the export as the read copy.
  - R09 (a `__proto__` key in the recorded rule) is not reachable from the owner's note and is left.
  - Pre-existing, shared with the radar export and not changed here: no RUNNING state on the run-once guard, timestamps typed as text, a write that is not atomic, row order by database collation, and app tests that do not strip a byte-order mark.
- **Evidence (headless-validated):** 10 export tests, and the 40 existing warehouse tests, pass; the type check is clean. Against the throwaway database the export refused before any load, then wrote 9 events (all confirmed), 7 searches and the rule for 4 states. 614 of 615 app tests pass (the one failure, OFR-08, predates this branch); the production build is clean. No page reads the file yet, so there is nothing to render.

**Item 4, 2026-11-11: the program reads the events.** `PotentialFraudSignalReview` (`wireframe V1/app/src/lib/fraud/potentialFraudSignalProgram.js`) now matches the policy events to each flagged service-year, and the module stages the export into it. No page shows the result yet (item 5), except that the radar lists a seventh tier, EXPLAINED, with nothing in it, and the blow-up page's dated events now tell a service's first surge from the start of the rise a year belongs to.

*CodeXen plan for the item, as built.* This entry supersedes the pre-build sequence in section 6.
- **Applicability:** rule and decision, in the existing program container. No new container, no business object written, no coordination mechanism. The export is a read copy; the program holds run state only.
- **Staged input:** `PolicyEventsExport` ({}), the policy events export. Without it every service-year reads not-searched and nothing else changes.
- **Run state (INITIAL):** `PolicyEventsAreLoaded` (false), `PolicyEventsProblem` (''), `PolicyEventLookbackMonths` (0), `PolicySearchedThrough` (''), `PolicyEvents` ([]), `PolicyEventsByState` (empty), `PolicySearchCoverageByState` ({}), `BlowupYearsByStateCode` ({}), `CollapseYearsByStateCode` ({}), `FirstFlaggedYearByStateCode` ({}), `FirstYearOnFile` (0).
- **On each service-year (INITIAL):** `knownCaseNamesServiceYear` (false), `changeStartYear` (0), `changeStartIsKnown` (false), `policySearchReachesChangeStart` (false), `fullPolicySearchReachesChangeStart` (false), `coveringPolicyEvents` ([]), `policyEvents` ([]), `laterPolicyEvents` ([]), `suggestedPolicyEvents` ([]), `measurementArtifactMeasures`, `policyOpeningMeasures`, `intendedGrowthMeasures`, `restrictionMeasures`, `suggestedEvents` (each 0), `measurementArtifactExplainsChange` (false), `policyOpeningMayExplainRise` (false), `explanationStanding` ('not-searched'), `explainedReason` ('').
- **Rule constants, named in the container:** `POLICY_EVENTS_EXPORT_SCHEMA`, `POLICY_EVENT_STANDINGS`, `EXPLANATION_KINDS`, `EXPLANATION_KIND_BY_EVENT_KIND`, `POLICY_EVENT_TIMINGS`, `EXPLAINING_TIMINGS`, `EXPLANATION_STANDINGS`, `EXPLAINED_REASONS`; `TIER_RULE` gains EXPLAINED. The lookback is not a constant here: it is read from the export's rule.
- **Sequence added to `ScorePotentialFraudCandidates`:** `DoesKnownCaseNameServiceYear` (question) after the blow-up question. Then, after `TotalSignalScores`: `MeasureYearlySeriesAgainstEnrollmentLine` (moved up, unchanged), `IndexBlowupYears`, `IndexCollapseYears`, `IndexFirstFlaggedYears`, `ReadFirstYearOnFile`, `DateChangeStarts` (PASSIVE); `ArePolicyEventsLoaded` (question); `ReadPolicyRule`, `ReadPolicySearchedThrough`, `DecodePolicyEvents`, `IndexPolicyEventsByState`, `IndexPolicySearchCoverage` (PASSIVE); `DoesPolicySearchReachChangeStart`, `DoesFullPolicySearchReachChangeStart` (questions); `ListPolicyEventsCoveringService`, `TimeCoveringPolicyEvents`, `SplitTimedPolicyEvents` (PASSIVE); `DoConfirmedEventsCountTowardExplanation` (question); `CountCountedMeasuresByExplanationKind`, `CountSuggestedEvents` (PASSIVE); `DoesMeasurementArtifactExplainChange`, `MayPolicyOpeningExplainRise` (questions); `NameExplanationStanding` (PASSIVE); `SuggestReviewTiers` (reads the artifact answer, and the known-case answer for both CLOSED and EXPLAINED); `NameExplainedReason` (PASSIVE). `DateRiseEvents` now reads the change start, and the first-blow-up index it used is gone. Every atom is PASSIVE; the program writes nothing.
- **Exceptions:** the new atoms loop over service-years with loop locals, as the container's recorded exception B03 already allows. Five small pure helpers sit at module level beside `clamp01` (`isIsoDay`, `isCodeText`, `scopeCoversCode`, `byEffectiveDate`, `startOfLatestRun`); they take parameters and return values and hold no state. **Scope changes:** the program row in the scope file is widened.

*The rules, in plain terms.*
1. **When the change a service-year shows starts.** This departs from the wording of Decision 2 and **needs Ken's confirmation (section 9, point 8).** Decision 2 says "the first flagged year", and its note assumed that year is 2023 for Kentucky psychoeducation. The screen in fact first flagged it in 2019, on a small surge, and has flagged it every year since. Read literally, the 2020 suspension would come after the rise began and the plan's own Kentucky test would fail. So:
   - *A rise with a surge.* A service can blow up more than once. The rise is the latest run of blow-up years in a row (share surge, or paid tripled) that began by the service-year, and it starts in the run's first year. Kentucky psychoeducation: 2023.
   - *A rise with no surge* (flagged only for running far above its enrollment line). It starts in the first year of the run of years, ending at the service-year, in which paid ran far above the line. The start is known when the year before that run can be told not to be far above the line: it is on file and the service has nothing paid in it, or its line could be measured. Otherwise the excess may already be there when the figures begin and **the start is not known**. This is 2,670 of the 5,906 service-years: mostly long-standing billing conventions. "When the figures begin" is in practice the first year the radar export carries an enrollment share for the state: it carries none for 2018, 34 states for 2019 and all 51 from 2020, so a run that begins in 2019 or 2020 usually has no measurable line before it. Carrying the 2018 and 2019 shares in the radar export would date some of these (section 9, point 8).
   - *A fall* (a collapse-only service-year). It starts in the first of the collapse years in a row.
2. **Which events match.** The event is for the service's state, or national, and its scope covers the code: the code itself, a code prefix, or all services. A stand-in scope stays labeled as a stand-in.
3. **When it takes effect, against the year the change starts** (Decision 2, and Ken's decision of 2026-11-11 to count an event inside that year as "same year"):
   - *in force:* a temporary measure that began earlier and has not ended when the change starts;
   - *before:* a permanent change inside the lookback (24 months, read from the export);
   - *same year:* inside the year the change starts;
   - *after the start:* later than that year, by the end of the service-year;
   - *start unknown:* when the start of the excess is not known. The same events match, against the earliest year of the run, and every one by the end of the service-year takes this timing, because its order against the start cannot be told;
   - *later:* after the service-year; carried apart and never counted.
   A permanent change older than the lookback, and a temporary measure that ended before the change starts, is not matched (it is still listed as covering the service).
4. **What kind of explanation it is,** from the event's kind and direction:

   | Event kind | Expands | Restricts | Direction unstated |
   |---|---|---|---|
   | Billing-code change, reporting change | measurement artifact | measurement artifact | measurement artifact |
   | Authorization or limit | policy opening | restriction | context |
   | Coverage, rate, eligibility, funding | intended growth | restriction | context |
   | Enforcement | restriction | restriction | restriction |
   | Governance, external flag | context | context | context |

5. **What counts.** Only confirmed events up to the service-year. An artifact counts in force, before or same year. An opening or intended growth counts at those timings and never on a collapse-only service-year: they explain a rise, not a fall. A restriction counts at any timing. Context never counts. **When the start is not known, only a restriction counts:** a suspension in 2020 cannot explain an excess that was already there in 2018. Events ended by the same event are one continuing measure and count once, so Kentucky's 2020 suspension and its 2023 "still suspended" record are one opening. (Two different measures that one event ends would also count once; only the count is affected, never a standing or a rating.)
6. **The standing,** by precedence: artifact, opening, intended growth, restriction. With nothing counted: none-found when a full search is on file for the state, partly-searched when only partial searches are, not-searched when none is. **A search counts only when it was searched through the end of the year the change starts** (or, when that start is not known, the end of the service-year); one that stops earlier says nothing about it. Every search on file today is partial, so nothing reads none-found yet. A restriction also names the standing of a year that is still rising; item 5's "unexplained only" filter must not treat that as explained.
7. **The rating** (Decision 1). A confirmed measurement artifact that counts makes the tier EXPLAINED, with the reason "billing code changed" or "reporting changed". Its dollars leave "worth review" because that total is the HIGH and VERIFY tiers. A service-year a known case names is never rated EXPLAINED: the program reads the radar's known-case list for this, because the merged row keeps only its first candidate row's case id (see the pre-existing defect below). An explained collapse reads EXPLAINED, not LOOK-BACK. Nothing else about an event moves a tier or a score.
8. **Suggestions** (Decision 4) are carried beside the service-year with their timing. They are never marked as counting and change no count, standing, tier or summary.
9. **An export the program cannot read** (wrong schema, no lookback, an unknown kind, direction or standing, a malformed date or scope, an end named with no end date) is refused whole, with the reason, and every service-year reads not-searched. The radar still scores. No page shows the reason yet (item 5).

*What the shipped data says today* (5,906 flagged service-years):
- Kentucky psychoeducation 2023 and 2024: policy opening (the suspension in force, the 2023 record same year, counted once), still HIGH at 93 and 99. Its 2020 to 2022 years belong to the 2019 rise, which began before the suspension, and read partly-searched.
- Arizona psychoeducation: restriction on 2023 and on the 2024 collapse (the May 2023 payment suspensions fall inside the two years before the fall); 2024 stays CLOSED.
- The District of Columbia's community support years: the 2025 arraignment is later than all of them, counted on none; they read partly-searched.
- West Virginia: the 2018 coverage is intended growth on 9 service-years whose rise began in 2019 or 2020, none of them a collapse. Its one search stops in 2017, so every other West Virginia service-year reads not-searched.
- Standings: opening 15, intended growth 9, restriction 17, partly-searched 426, not-searched 5,439, none-found 0, artifact 0. The backtest pins these.
- **No tier moved,** and the year and state summaries are unchanged, because no billing-code or reporting change is on file until items 6 and 7.

*Plan section 4's tests.* Four of the six run on the shipped exports in `potentialFraudPolicyBacktest.test.js`: Kentucky carries the opening and stays HIGH; Arizona's collapse carries the enforcement; no known case-year is downgraded (and no tier moves at all); an unsearched state reads not-searched and a partial search never reads none-found. A fifth is run on the shipped radar with staged events: with a confirmed billing-code change covering every known case-year, none of them is rated EXPLAINED while more than a hundred other service-years are. The other two run on fixtures in the program's own tests: an unconfirmed suggestion of an artifact changes no rating, count or summary (every event on file is confirmed, so the shipped data cannot show it), and a confirmed artifact is rated EXPLAINED (a real replaced billing code waits for item 6).

*Reviews.* Self-check: pass after five repairs (one purpose per atom; the rise dated by its own surge; no opening on a collapse). First independent review (subagent): CodeXen revision-required, correctness not yet correct; eleven findings, addressed:
- F01 (blocking): the known-case exemption read the merged row's case id, which is empty on four of the five known case-years. A question atom now reads the radar's known-case list, and a backtest stages an artifact over every known case-year.
- F02 (major): an artifact dated in the year of a collapse did not explain it, because a collapse was timed against the rise before it. A collapse-only service-year is now timed against its fall.
- F03 (major): with no blow-up, the start was the first flagged year, which is often years after the excess began. It is now the first year far above the line, or not known.
- F04 (major): staging the export in the module puts it in the app bundle. Section 9 points 6 and 7 are therefore deploy prerequisites as of this item.
- F05: this entry's counts corrected and pinned in the backtest.
- F06: one answer to when a rise started; `DateRiseEvents` reads the change start, and the duplicate index is gone.
- F07: a search must reach the year the change starts.
- F08: a suggestion is never marked as counting; the counters are named for measures; the search and question fields say what they mean; the reason is set only on an EXPLAINED tier.
- F09: the match is three atoms (list, time, split); the helpers are at module level and recorded above.
- F10: tests added for the temporary-measure edge, the reason, the tier class map and the kinds the export's rule allows.
- F11: section 6 points here; the program's policy outputs are frozen; an empty code or prefix and an end named without a date are refused.

Second pass (same subagent): F01 to F05 and F07 to F11 closed, F06 partly; CodeXen revision-required, narrowly; correct on the shipped exports. Eight further findings, addressed:
- G01: one rule for when a start is known, stated once and tested: the year before the run is on file with nothing paid, or its line could be measured. 85 service-years of services whose own figures begin after the file does now have a known start.
- G02: "the first year on file" is said plainly to be the first year with an enrollment share (rule 1 and point 8).
- G03: with the start not known, the same events match as with a known start; an enforcement act of any age no longer counts.
- G04: a surge after the service-year is a "later surge", never the start of that year's rise.
- G05: the search questions are `DoesPolicySearchReachChangeStart` and `DoesFullPolicySearchReachChangeStart`.
- G06: with the start not known, a search must reach the service-year. Still latent, and recorded in point 10: a full search with an uncounted event on file reads none-found.
- G07: CLOSED and EXPLAINED read the same known-case answer; suggestions are counted by their own atom; point 8 says where a fall starts.
- G08: tests for a collapse run with a gap, each branch of the known-start rule, and the year indexes across runs.

Third pass (same subagent): **CodeXen pass; correct on the shipped exports and under the staged-artifact checks; nothing blocks a commit on the branch.** G01 to G08 closed. Two advisories carried: H01, `ReadFirstYearOnFile` would throw on a series entry that is not a list (the exporter never writes one); H02, one guard in `DateChangeStarts` cannot be reached. In that pass 24 of its 26 mutations were killed; the two survivors are the unreachable guard of H02 and a run-state reset that every scored run overwrites.

*Evidence.* headless-validated: 645 of 646 app tests pass (the one failure, OFR-08 in `fundingResilienceRoom.test.js`, predates this branch); the production build is clean. isolated-rendered: `scripts/verify-potential-fraud-isolated.mjs` passed on the hidden desktop after the last code change, evidence `20261112T025203724Z`, including seven tier pills with EXPLAINED at 0.

*Pre-existing, found by the review and not changed here.*
- **The radar's known-case badge is missing on four of the five known case-years.** `MergeServiceYears` keeps the case id of a service-year's first candidate row only, and the owner puts the id on the row whose pattern the case names. Kentucky psychoeducation 2023 and 2024, Arizona 2022 and the District 2022 are affected; the backtest page is not. The rating rule above no longer depends on it. Fixing the merge changes what the radar shows, so it is left for item 5, with a rendered check.
- Loop locals in atoms (recorded exception B03); published rows frozen at the top level only; the two exports' provenance (point 6).
- Search "searched through" days are the dates of the documents read (West Virginia: 2017-10-06, before the event it documents takes effect). That is honest but makes a search look older than it is; point 10.

*Left for item 5.* The pages: tags, the case-file ledger, the chart pins, the EXPLAINED reason, the export problem, the catalog's "Policy-event overlay" status, and the reallocation page's "All" scope, which will include EXPLAINED dollars once an artifact exists. The hand-typed `PROGRAM_EVENTS` list is still what the blow-up page shows beside the screen's own events.

## 9. Open points for Ken

1. **Confirm the events. Done 2026-11-11:** Ken confirmed the eight events on file (Kentucky 6, Arizona 1, West Virginia 1), and each is recorded as confirmed by Ken Greenwood on that day. He asked for nine; the ninth is the District of Columbia event, added on 2026-11-11 and confirmed by him that day.
2. **May a file edit withdraw or demote a confirmed event?** Today it may, and the load lists it in its notes and on the console. The alternative is to refuse such a load unless the withdrawal is declared.
3. **Warehouse architecture record.** ADR-001 covers the sign-in service only. The warehouse loaders run as one process at a time, but no record says so, and `bw_ctl.load_history` and `bw_psa_meta.object_index` are written by every loader with no declared owner. A proposed line is in the scope file, marked pending.
4. **Events inside the first flagged year. Decided 2026-11-11 (Ken): count it, labeled "same year".** Yearly figures cannot say whether an event inside that year came before or after the rise.
5. **District of Columbia. Decided 2026-11-11 (Ken):** an enforcement release that names a person may be linked when the event's own summary and quote name no one. The District event is on file and Ken confirmed it on 2026-11-11. Still open: a policy source for the District.
6. **Regenerate the export from the local warehouse (deploy prerequisite).** `policyEvents.js` was generated from a throwaway database, so its load id, times and notes name a load that no longer exists. Since item 4 the module stages the file, so it is in the app bundle. Regenerate it from the local warehouse before any page shows load provenance, and before any deploy. Needs the local warehouse database to start.
7. **The confirmer's name in the export (deploy prerequisite).** Each confirmed event carries `confirmedBy`, so "Ken Greenwood" is in the export nine times. Since item 4 the module stages the file, so the name is in the app bundle and would reach the public site at the next deploy. Decide before deploy whether the name ships, or whether the app shows only that a person confirmed the event and when.
8. **When a change starts (needs confirmation).** Decision 2 says "the first flagged year". The screen first flagged Kentucky psychoeducation in 2019, not 2023, so that wording would stop the 2020 suspension from explaining the 2023 surge. Item 4 dates each service-year's change three ways: a rise with a surge starts in the first year of its latest run of blow-up years; a rise with no surge starts in the first year paid ran far above its enrollment line, and is "not known" when the year before cannot be measured (2,670 of 5,906 service-years, where only a restriction counts); a collapse starts in the first of its collapse years in a row, which for most falls is two or more years after the share peaked. Confirm, or say what the anchor should be. Related: the radar export carries no enrollment share for 2018 and only 34 states for 2019; carrying them would let some of the 2,670 be dated, and is a warehouse change of its own.
9. **The label for a partial search.** A searched state with nothing matched reads partly-searched in the program, because a partial search may not say "none found". Decision 5 has no label for it. Item 5 needs one: a new label such as "partly searched", or "not searched" with the searched topics shown.
10. **"None found" needs searches that say what they covered.** A search is recorded per state and topic, and the topic is free text. The program reads a state as fully searched, for a given year, when any full search on file was searched through the end of that year. Before any search is marked full, the search record should name the services it covered. Separately, each search's "searched through" day is today the date of the document read, which makes West Virginia's search look as if it stopped in 2017; decide whether it should be the day the search was done. And once a full search exists, a service-year with an event on file that does not count would read "none found"; it needs its own wording.
11. **The kind-of-explanation table** in the item 4 entry maps the ten event kinds, by direction, to the four explanations of section 1 and to "context". It follows section 1's examples; check it.
