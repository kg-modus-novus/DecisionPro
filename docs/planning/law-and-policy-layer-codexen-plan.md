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
- The export (item 3) carries the events, the search coverage and the rule the load ran under, and refuses a load without the rule.

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

## 9. Open points for Ken

1. **Confirm the events. Done 2026-11-11:** Ken confirmed the eight events on file (Kentucky 6, Arizona 1, West Virginia 1), and each is recorded as confirmed by Ken Greenwood on that day. He asked for nine; the ninth is the District of Columbia event, added on 2026-11-11 and confirmed by him that day.
2. **May a file edit withdraw or demote a confirmed event?** Today it may, and the load lists it in its notes and on the console. The alternative is to refuse such a load unless the withdrawal is declared.
3. **Warehouse architecture record.** ADR-001 covers the sign-in service only. The warehouse loaders run as one process at a time, but no record says so, and `bw_ctl.load_history` and `bw_psa_meta.object_index` are written by every loader with no declared owner. A proposed line is in the scope file, marked pending.
4. **Events inside the first flagged year.** Decision 2 counts events from 24 months before the first flagged year. Annual data cannot say whether an event inside that year came before or after the rise. Recommendation for item 4: count it and say "same year".
5. **District of Columbia. Decided 2026-11-11 (Ken):** an enforcement release that names a person may be linked when the event's own summary and quote name no one. The District event is on file and Ken confirmed it on 2026-11-11. Still open: a policy source for the District.
