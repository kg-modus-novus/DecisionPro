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
| 1 | Curated event files for Kentucky, Arizona, District of Columbia, West Virginia | 4 states | Hand-confirmed, each with a link and a quote | The showcase and the backtest |
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
- `LoadPolicyEvents` (owner `PolicyEventOwner`)
- `ScorePotentialFraudCandidates` (existing, widened)

### Business objects and owners
| Object | Identity | Owner | Persistence | Arrows |
|---|---|---|---|---|
| Policy event (carries an effective date and, when temporary, an end date) | (source, source document, state or US, effective date) | `PolicyEventOwner`, `xenodroid-bw/src/molecules/PolicyEventOwner.ts` | `bw_dso.dso_policy_event` | absent → loaded (replaced whole per source under one load history) |

### Dispositions
- **Policy event: D1.** Q1: public context the declared business reads to compare spending fairly, like the published fee schedules already in the object table. Q2: it carries rules (a source link, a document date, an effective date, a scope, a kind). Q3: several sources and loaders would otherwise write it incoherently.
- **Search coverage** (state, source, searched-through date): data of the policy-event load, written by the same owner in the load manifest. No separate object.
- **Explanation standing of a service-year:** computed on demand by the program. Not an object.
- **AI suggestions (phase 5): a state of the policy event, not a separate file** (changed by Decision 4). Because suggestions are shown in the app, they are loaded and exported as policy events with standing `suggested`. A person confirms one by moving it into a curated file, which loads it with standing `confirmed`; a rejected suggestion is dropped at the next load. Arrows: absent → suggested → confirmed, and absent → confirmed for hand-entered events. The program decides only from `confirmed` events.
- **Reviewer override in the case file: D3**, session-only, as the other reviewer answers are today.

### Container fields
`PolicyEventOwner` (INITIAL in parentheses): `Status` ('INITIAL'), `ErrorMessage` (''), `SourceKey` (''), `StageManifest` (INITIAL_MANIFEST), `EventRows` ([]), `SearchCoverageRows` ([]), `EventsWithoutSourceLink` (0), `EventsWithoutEffectiveDate` (0), `EventsWithoutScope` (0), `EventsOfUnknownKind` (0), `LoadHistoryId` ('').

`PotentialFraudSignalReview` gains: `PolicyEvents` ([]), `PolicySearchCoverageByState` ({}), `PolicyEventLookbackMonths` (0, read from the export's rule), and on each service-year `policyEvents` ([]), `measurementArtifactEvents` (0), `policyOpeningEvents` (0), `intendedGrowthEvents` (0), `restrictionEvents` (0), `suggestedPolicyEvents` ([]), `suggestedEvents` (0), `policySearchIsOnFile` (false), `explanationStanding` ('not-searched'). The four kind counters count confirmed events only.

Rule constants, named in the containers: `POLICY_EVENT_KINDS`, `EXPLANATION_KIND_BY_EVENT_KIND`, `POLICY_EVENT_LOOKBACK_MONTHS` (24, Decision 2).

### Molecule sequence
`LoadPolicyEvents`:
1. `ResetLoad` PASSIVE
2. `ReadStageManifest` ACTIVE
3. `ParseEventRows` PASSIVE
4. `CountEventsOutsideTheirRules` PASSIVE (the four counters)
5. `AreEventRowsClean` question, writes `EventRowsAreClean`
6. `OpenLoadHistory` ACTIVE
7. `RetainStageInPsa` ACTIVE
8. `ReplaceEventRows` ACTIVE
9. `CompleteLoadHistory` ACTIVE

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
- The staging adapters reject an event with no source link, document date or effective date, and normalize dates to ISO with a stated precision (day, month or year).
- Persistence: `sql/017_policy_event.sql`, one table, refusing constraints only (NOT NULL, CHECK on kind and precision). No trigger, no cascade.
- The export carries the events, the search coverage and the rule the load ran under, and refuses a load without the rule.

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
