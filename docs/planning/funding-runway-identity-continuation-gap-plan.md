# Funding runway identity, continuation, and gap-assessment plan

**Status:** Active implementation plan, 2026-09-01  
**App ID:** `decisionpro`  
**Scope:** Kentucky and Florida Organization Funding & Resilience Intelligence (OFR)  
**Decision boundary:** Published award end dates are deadlines, not proof that funding or services will stop.

## Execution checkpoint — 2026-09-01

The plan was challenged in a three-turn, context-free SOL Ultra debate and the
final reconciled Release A design was accepted. The debate added the
byte-faithful/append-only evidence requirement, assessment-completeness rule,
source-identity boundary, stage-specific release gates, and prohibition on REAL
Release A gap conclusions.

**Implemented:** Release A schema, CodeXen rules, stable source-identity/display
assertions, reviewed Kentucky agency/institution aliases with raw-name
provenance, explicit Gap objects, warehouse-produced assessment defaults,
award/export contracts, runway list/detail/CSV fields, and USAspending
transaction source-plane ingestion with byte-faithful PSA pages and append-only
action observations. The transaction adapter uses the official public
`/api/v2/transactions/` contract and does not interpret a transaction as a
continuation decision.

**Verified:** 67 application test files / 297 tests; production build; canonical
`harness:verify`; focused TypeScript compilation; warehouse offline rules; and
KY+FL hidden-desktop rendered journey at
`docs/evidence/harness-workbench/isolated/20260901T200219520Z`.

**Not hydrated in this checkpoint:** local Postgres was unreachable, so the new
migration, Release A backfill, and public transaction observations could not be
written into the local warehouse or regenerated into the committed BW export.
The UI uses the same reviewed Release A contract as a defensive adapter over the
last reconciled export. The next reachable-DB command is
`tsx src/cli.ts funding-runway-public-evidence` from `xenodroid-bw`.

**Still incomplete:** TAGGS/CMS continuation normalization and all internal
dependency, balance/burn, replacement-funding, service-impact, and lead-time
inputs. These remain Releases B/C and the Gap registry below; no `monitor`,
`potential_gap`, `gap_mitigated`, or `confirmed_gap` conclusion is claimed.

## Outcome

Replace source-shaped organization labels with governed display identities, and
turn the current deadline list into an evidence-led continuation review. Each
runway row must say what the organization is, retain the exact publisher label,
show the money and award identifiers, distinguish public continuation evidence
from its absence, and explain whether a funding gap can actually be assessed.

This plan does not authorize a claim that an organization is distressed, that
an award will lapse, or that a service gap is likely from an end date alone.

## Requirements

| ID | Requirement |
|---|---|
| `FRI-01` | Within the bounded runway journey (list, detail, search/filter text, accessible representation, CSV, and any graph/recommendation control showing that runway entity), every organization name resolves through one governed display assertion or is visibly marked as the unreviewed source label. |
| `FRI-02` | Preserve `raw_source_name`, source system, source URI, identifier, match method, confidence, verification date, and reviewer status; never overwrite source evidence. |
| `FRI-03` | Exact and inferred identity assertions remain structurally separate. An inferred match cannot supply a confirmed display identity. |
| `FRI-04` | Use explicit aliases and authoritative identifiers; do not title-case, reorder, expand, spell-correct, or otherwise guess organization names with a generic heuristic. |
| `FRI-05` | Every award deadline carries award ID, assistance listing, amount, published end date, recipient identifiers where available, and provenance. |
| `FRI-06` | Continuation status is one of `confirmed_continued`, `extension_pending`, `temporary_extension`, `successor_opportunity_identified`, `no_public_continuation_found`, `not_assessed`, or `confirmed_ending`. |
| `FRI-07` | `no_public_continuation_found` means only that the governed public-source search found no affirmative evidence as of its retrieval date. It must never render as “no extension exists.” |
| `FRI-08` | Gap status is one of `not_assessable`, `monitor`, `potential_gap`, `gap_mitigated`, or `confirmed_gap`, with a rule version and explicit evidence/missing-input list. |
| `FRI-09` | `potential_gap` requires an assessment-complete trace: a deadline inside the versioned action window; a completed, reconciled public search with no continuation evidence or explicit ending evidence; recipient-confirmed material program/service dependency and documented impact; and a completed replacement-funding assessment with none identified. Unknown, blocked, failed, or unassessed predicates cannot satisfy the rule. |
| `FRI-10` | Missing internal or non-public evidence becomes an explicit Gap object with owner and unblock path; TEST fixtures never stand in for REAL evidence. |
| `FRI-11` | The UI consumes warehouse-produced identity and assessment semantics; it may calculate days remaining and format dates, but must not infer continuation or gap outcomes. |
| `FRI-12` | No person-level data, PHI, credentials, or adverse conclusions enter DSO exports or UI surfaces. |
| `FRI-13` | Land byte-faithful source responses before transformation and retain append-only retrieval observations/status versions. Each fact traces to a PSA object and source field; failed refreshes preserve the last valid snapshot and create staleness/Gap evidence. |

## Governed identity model

Add a display-label assertion at one row per source identity:

- `source_identity_id` and `display_assertion_id`
- optional `exact_identity_cluster_ref` (never created by label curation)
- `canonical_display_name`
- `entity_type` (`government_agency`, `nonprofit`, `healthcare_provider`,
  `for_profit`, `other`, `unknown`)
- `raw_source_name`
- source identifiers (`UEI`, `EIN`, `NPI`, `CCN`, recipient ID) when present
- `name_authority`, `source_uri`, `match_method`, `confidence`
- `verified_at`, `review_status`, and `load_history_id`

Authority order is specific to the entity and identifier, not a blanket source
ranking:

1. An official government agency directory for agency display names.
2. SAM entity registration for UEI legal business names, when accessible.
3. CMS provider data for facility legal names and CCNs.
4. IRS exempt-organization records for EIN legal names.
5. USAspending recipient profile or latest award transaction.
6. A reviewed DecisionPro alias assertion with its evidence citation.

The initial reviewed alias set corrects known source-order artifacts, including
`HEALTH SERVICES KENTUCKY CABINET FOR` to `Kentucky Cabinet for Health and
Family Services`, while retaining the former as `raw_source_name`. It also
normalizes trailing-article forms such as `UNIVERSITY OF KENTUCKY RESEARCH
FOUNDATION, THE` only where an authoritative or reviewed citation supports the
display form.

## Continuation evidence acquisition

| Evidence | What it can establish | Limit |
|---|---|---|
| USAspending award transactions | Later actions, modifications, action dates, action type/description, and obligations for the same award | A missing action is not evidence that no continuation exists |
| HHS TAGGS award history | Published competing/non-competing continuation actions for HHS grants | Coverage and identifiers must reconcile to the tracked award; page retrieval can fail |
| Medicaid.gov Section 1115 pages/documents | Extension applications, temporary extensions, approvals, STCs, and authority expiration | Applies to waiver authority, not every award |
| Grants.gov forecasts and NOFOs | A published successor opportunity | An opportunity is not a continuation award and does not prove recipient eligibility |
| Federal Audit Clearinghouse / SEFA | Lagged expenditures and federal-program dependency context | Not current liquidity or proof of continuation |
| State grant administration and accounting | Notice of Award, renewal workflow, encumbrance, balance, burn rate, replacement award | Internal access is not documented; record as a Gap until authorized/provided |
| Program/contract operations | Services and capacity dependent on the award, mitigations, replacement funding, transition lead time | Required for a meaningful service-gap assessment; not inferred from funding magnitude |

Every evidence record stores award/event key, evidence type, published status,
action/effective date, amount where published, source URI, retrieval date,
content hash, and reconciliation result. Contradictory records remain visible.
The PSA capture stores original response bytes, a credential-redacted request
manifest, HTTP status and content type, retrieval time, pagination, ETag or
Last-Modified where available, and byte hash. Stable natural keys or document
hashes identify observations; list position does not. Latest-state projections
come from views or exports over append-only observations.

## Decision rules

### Continuation

- `confirmed_continued`: a reconciled publisher record identifies a continuation
  or replacement award and its effective period covers the assessed deadline.
- `extension_pending`: the owning publisher explicitly lists an extension or
  renewal application as pending.
- `temporary_extension`: the owning publisher explicitly grants temporary
  authority through a stated date.
- `successor_opportunity_identified`: a reconciled forecast/NOFO exists, but no
  recipient continuation award is confirmed. Display as “Opportunity identified;
  continuation unconfirmed.”
- `confirmed_ending`: an owning authority explicitly says the award or authority
  ends without continuation. This status cannot be inferred from silence.
- `no_public_continuation_found`: the configured public sources were searched
  successfully and produced no affirmative continuation record.
- `not_assessed`: the search has not run, was blocked, or did not reconcile.

### Gap assessment

The assessment returns `not_assessable` until the following evidence is known:

1. Continuation or ending status.
2. The program/service/capacity materially supported by the award.
3. Dependency amount or share and the measurement basis/date.
4. Available balance and eligible burn rate, or another approved runway basis.
5. Replacement funding and mitigation status.
6. Operational lead time and accountable owner.

`FRI-GAP-v1` uses an assessment date at UTC midnight and an inclusive action
window from 180 days before expiration through 90 days after expiration. A
longer pre-expiration window requires cited operational lead-time evidence and a
new rule version. `monitor` requires a complete, fresh, reconciled assessment
and either a deadline outside the action window or at least one explicitly false
gap predicate. Unknown, stale, failed, unreconciled, and `not_assessed` values do
not satisfy FRI-09.

Where balance and spend are valid and reconciled, an estimated runout date may
be calculated as `assessment date + available balance / average eligible daily
spend`. USAspending obligation/outlay totals are contextual federal award facts,
not a substitute for the recipient's available balance or eligible burn rate.

## Implementation sequence

1. **Schema and rule contracts.** Add canonical-label assertions, continuation
   evidence, gap inputs/assessments, enumerated statuses, provenance, and
   reconciliation constraints. Implement the decisions as CodeXen atoms and
   molecules.
2. **Identity backfill.** Load the reviewed agency aliases and derive display
   assertions only for identifier-exact or explicitly reviewed source labels.
   Export raw and display names together and add an unresolved-label queue.
3. **Public continuation pass.** Retrieve USAspending transaction history for
   deadline awards; reconcile award IDs; merge applicable Medicaid.gov horizon
   evidence; support HHS TAGGS evidence when a reconciled public page is
   available. Failures create Gaps, not empty success.
4. **Assessment.** Produce continuation status from evidence and a separately
   versioned gap assessment. Populate missing-input Gaps for state/internal
   evidence that DecisionPro does not currently possess.
5. **Presentation.** Use canonical labels throughout the Funding & Resilience
   room and relationship graphs. Runway rows show entity type, raw publisher
   label when different, award amount/ID/listing, days left, continuation status,
   gap status, evidence links, missing inputs, and last assessment date.
6. **Exports and accessibility.** Preserve all fields in accessible-list and CSV
   paths; status must not rely on color; links and controls receive accessible
   labels and keyboard focus.
7. **Verification and review.** Run warehouse offline/DB gates as available,
   application tests/build, canonical harness, and the Funding & Resilience
   hidden-desktop journey for both KY and FL. Independently inspect the final
   diff and rendered evidence.

## Release boundary

- **Release A — identity and governance readiness (current milestone):** the
  bounded runway journey uses reviewed labels with raw provenance; warehouse
  contracts produce `not_assessed` / `not_assessable` defaults with reason,
  missing inputs, and Gap references. No REAL Release A row is `monitor`,
  `potential_gap`, `gap_mitigated`, or `confirmed_gap`.
- **Release B — public continuation evidence:** byte-faithful USAspending,
  applicable TAGGS, and CMS observations are hydrated, reconciled, and normalized.
- **Release C — assessable gap decisions:** accountable dependency, balance/burn,
  replacement, mitigation, impact, and lead-time inputs support versioned FRI-09
  outcomes.

Release A is not represented as a completed continuation or gap assessment.
Labels elsewhere in OFR remain a follow-on unless they appear inside the bounded
runway journey. Loading a display alias changes zero matching keys and zero
exact/inferred identity assertions. An exact cluster may propagate a label only
for exact-published or human-reviewed exact-derived identity.

## Acceptance gates

- Known malformed/order-artifact labels no longer appear as primary display
  labels, and their raw values remain visible in provenance.
- No generic text-normalization rule can silently alter a legal organization
  name.
- Every runway record is ordered by published date and shows date, days left,
  identity/type, award amount and ID, continuation status, gap status, evidence,
  missing inputs, and assessment date.
- The UI contains none of the former blanket assumptions
  `continuationKnown: false` or “gap likelihood not assessable” generated only
  from item type; these values arrive from governed exported assessments.
- A no-result public search renders “No public continuation evidence found as
  of …”, never “No continuation” or “No extension.”
- No record becomes `potential_gap` without all four `FRI-09` predicates.
- No `potential_gap` unless assessment completeness is true, every versioned
  predicate is explicitly true, no predicate comes from a blocked/failed search,
  and the decision trace cites its evidence.
- Every Release A `not_assessed` has a reason code and Gap reference; every
  `not_assessable` has nonempty missing inputs and Gap references.
- Reviewed aliases retain the raw label, authority URI, source hash, reviewer
  status, and verification date. List, detail, search, accessibility, and CSV use
  the same display assertion; the UI performs no raw-name or outcome inference.
- A sampled PSA hash reproduces the captured source bytes; two-refresh fixtures
  preserve prior versions; a failed refresh keeps the last valid snapshot and
  surfaces staleness plus a Gap; no credential-bearing URI enters evidence.
- KY and FL remain state-isolated; exact and inferred identities remain
  separate; all REAL facts carry provenance/reconciliation.
- Unit, reconciliation, application, build, harness, and isolated-rendered gates
  pass, or any unavailable external/DB gate is explicitly recorded with the
  exact limitation.

## Initial Gap registry

| Gap ID | Missing evidence | Owner / unblock path |
|---|---|---|
| `GAP-FRI-GRANT-ADMIN` | Current Notice of Award, renewal workflow, and grant-manager disposition | State grants administration supplies an authorized aggregate export or governed connection |
| `GAP-FRI-RUNWAY-BASIS` | Available award balance and eligible daily spend | State accounting/grants owner supplies definitions and reconciled balance/burn data |
| `GAP-FRI-SERVICE-DEPENDENCY` | Award-to-service/capacity dependency and transition lead time | Program/contract owner validates service mapping and materiality |
| `GAP-FRI-REPLACEMENT-FUNDING` | Replacement award, bridge, state appropriation, or other mitigation | Budget/grants owner provides approved funding evidence |
| `GAP-FRI-TAGGS-COVERAGE` | Reconciled TAGGS history for any HHS award not discoverable from public identifiers | Grants owner confirms FAIN/award mapping or supplies the official award notice |

## Stop conditions

- Do not create accounts, request credentials, or accept terms.
- Do not promote a fuzzy/inferred identity to a canonical fact.
- Do not infer continuation or non-continuation from an end date or a failed
  search.
- Do not call a funding gap likely without the `FRI-09` evidence predicates.
- Do not export person names, PHI, secret-bearing URIs, or unsupported adverse
  conclusions.
