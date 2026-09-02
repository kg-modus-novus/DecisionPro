# Operational briefing strip and depot inference plan

**Status:** Director-authorized 2026-09-02 ("integrate into your existing plan and build it") after the Funding & Resilience inference brief and the briefing-format discussion; implemented the same day. Acceptance evidence is recorded at the end of this document.
**App ID:** `decisionpro`
**Scope:** Kentucky and Florida Operational Intelligence pages, the Funding & Resilience Evidence Room, and the XenoDroid BW exporters that feed them.
**Product boundary:** public aggregate / de-identified information only; no PHI, no person-level data, no adverse conclusions.

## Why

The 2026-09-02 review of the OFR additions found that the governance layer was
sound but the data supply was not: every OFR export capped its list (15, 20,
25 rows) before the UI could join anything, so every cross-source join
replayed on the bundle returned zero rows; the funding runway ranked the
routine federal-fiscal-year Title XIX grant as the most urgent cliff because no
award class was stored; the Grants.gov successor-opportunity join key was
dropped at export; the MCPAR plan-period record that Contract Accountability
needs was collapsed to two statewide numbers; and the inferences the depot can
already support (facility × rating × payer mix, county access exposure, cliff
cascades, relevance-gated liquidity) were not surfaced anywhere.

The Director asked for those inferences above the fold on every Operational
Intelligence page, in a format that reads like a brief rather than a tile set.

## Design decisions

1. **Briefing strip, not news.** Cards carry a headline, a lede naming the
   sources and join key, key figures, the validation question, the accountable
   owner, the evidence kind (observed / inferred ◆ / gap), a status, an as-of
   date, and a button that opens the goal page or the pre-filtered Evidence
   Room. Status is case-like (Detected → Under validation → Disposed), not
   story-like; nothing ages out because it is old.
2. **Governed headline rule.** Every headline is a template filled from data.
   It states the joined fact and the open question and never a verdict: no
   waste, fraud, breach, distress, improper, misconduct, violation, savings, or
   abuse wording, and no plan is ranked on a measure whose reporting
   definition is unconfirmed. Enforced by `operationalBriefings.test.js` and by
   the isolated-rendered scenario, which scans the rendered strip.
3. **Warehouse-produced semantics.** The UI joins already-exported facts and
   computes no new source figures. Every new join key (prime award key,
   assistance listing on NOFO events, provider context by CCN, depot-linked
   EINs, award class, renewal history) is emitted by a BW exporter that runs
   its own reconciliation check.
4. **Ranking by decision value.** Goals touched, then observed before
   inferred, then nearest deadline. Never novelty.
5. **Gaps are cards too.** When a join cannot run because a source slice is
   not loaded (Florida nursing-facility ratings), the card says so with the
   unblock path instead of rendering an empty list.

## Requirements

| ID | Requirement | Status |
|---|---|---|
| `OBI-01` | Lift the OFR export caps: full negative-margin watchlist, full sub-award edge list, full horizon event list; UI keeps a display cap only. | Implemented (`ExportFacilityDistressForUi`, `ExportSubawardFlowGraphForUi`, `ExportProgramHorizonEventsForUi`). |
| `OBI-02` | Add join keys: `primeAwardKey` / `primeAwardId` / `primeAwardEnd` on edges; `assistanceListing` on NOFO events; `providerContext` (CMS Care Compare by CCN) on watchlist facilities; `depotLinks` on 990 filings. | Implemented. |
| `OBI-03` | Award class from published facts only: `title-xix-state-grant` when listing 93.778 is awarded to a reviewed state agency; otherwise `recipient-award`. Renewal history as published prior periods, never a probability. Successor opportunities paired by listing, never a continuation decision. | Implemented (`ExportFederalAwardGrainForUi`). |
| `OBI-04` | Relevance-gated resilience list: 990 filings for EINs reached through an exact crosswalk assertion or an identity-resolved sub-award edge, latest period per EIN, with two-period low-liquidity flag. | Implemented (`ExportNonprofitFinancialsForUi.depotLinkedCandidates`); the room uses it when present. |
| `OBI-05` | MCPAR plan × program × period accountability record from the byte-faithful PUF in PSA for KY and FL: plan measures, derived ratios, comparability state (10× dispersion rule), positional sanction records, publisher-side data-quality flags, program context. Person-level question IDs never read; structural scan in reconciliation. | Implemented (`ExportMcparPlanPeriodForUi`, `mcparPlanPeriod.js`). |
| `OBI-06` | Reviewed Florida agency aliases (AHCA, DCF, DOH) in both the warehouse registry and the UI mirror; raw labels retained. | Implemented. |
| `OBI-07` | Briefing strip above the goal tiles on both state pages, with the governed headline rule, kind chips, figures, question, owner, sources, guardrail, and goal / room deep-links. | Implemented (`OperationalBriefingStrip.jsx`, `operationalBriefings.js`). |
| `OBI-08` | Plan-period accountability record rendered inside the Contract Accountability encounter case (KY) and the Strengthen Plan Accountability case (FL), and as the body of the MCPAR briefing cards. | Implemented (`PlanAccountabilityRecord.jsx`, `evidencePanels` on the two cases). |
| `OBI-09` | Regenerate bundles from the warehouse without re-fetching any source; a Release A label refresh must not regress continuation assessments. | Implemented (`ofr-depot-export` runs label backfill → continuation assessment → exports). |
| `OBI-10` | Tests, production build, canonical harness, and a hidden-desktop rendered journey for both states. | See acceptance record. |

## Briefing catalogue (both states unless noted)

| ID | Kind | Join | Goal |
|---|---|---|---|
| `mcpar-overpayment-concentration` | observed | MCPAR plan pivot: overpayment share ≥ 40% and ≥ 2× enrollment share | Contract Accountability / Strengthen Plan Accountability |
| `mcpar-comparability` | observed | derived-ratio dispersion > 10× | same |
| `mcpar-sanctions` | observed | positional sanction group; clause citations | same |
| `publisher-divergence-compliance` (FL) | observed | MCPAR sanctions vs AHCA compliance export | Strengthen Plan Accountability |
| `runway-composition` | observed | award class × renewal history × 12-month window | Trend & Budget/Program Planning |
| `successor-opportunities` | inferred | expiring recipient awards × NOFO by listing | same |
| `cliff-cascade` | observed | edges × prime award end within 12 months | Optimize Spending |
| `program-overlap` | observed | identity-resolved sub-recipients under > 1 listing | Optimize Spending |
| `county-access` | inferred | HCRIS county rollup flags (all negative, single facility) | Improve Coverage & Access |
| `compound-facility` (KY) / `compound-facility-gap` (FL) | inferred / gap | HCRIS × Care Compare by CCN (margin, 1–2 stars, > 60% Medicaid days) | Identify Quality Gaps / Provider & Facility Oversight |
| `depot-linked-liquidity` | inferred | 990 × crosswalk × sub-award EIN | Contract Accountability / Strengthen Plan Accountability |

## Gates that still apply

- No-adverse-conclusion, person-level, identity-separation, credential, and
  reconciliation gates from the OFR plan apply unchanged.
- The MCPAR record excludes `submitterName`, `submitterEmailAddress`,
  `contactName`, and `contactEmailAddress` structurally.
- CMS Care Compare `chain_name` can be an individual owner's name; the product
  keys chain context on CCN and never renders that field. (The chain-graph
  extension on `chain_id` remains a follow-on.)
- Florida premium-revenue responses that are implausibly small for the
  reported enrollment withhold the overpayment-to-premium ratio and carry the
  `PREMIUM-BASIS-UNVERIFIED` flag; nothing is imputed.

## Gap closure (2026-09-02, second pass)

The Director asked for the four gaps left open by the first pass to be filled.

| Gap | Closure |
|---|---|
| `GAP-PROVIDER-CONTEXT-FL` — no Florida nursing-home slice | **Closed.** `RetrieveAndLoadProviderFacilities` (state-neutral) loads the CMS Care Compare slice for KY and FL into `dso_provider_facility` (now carrying `state_code`, `chain_id`, `chain_label`, `chain_label_status`, `chain_facility_count`, `changed_ownership_12mo`; migration 013). Florida: 694 facilities; the compound facility list is now computable for Florida (118 facility-years) and Florida OFR-05 chains carry rating and fine context. The Kentucky operational loader replaces only Kentucky rows. |
| SAM.gov coverage 0 | **Closed as a resumable process.** `ResolveSamEntities` (`ofr-sam-resolve`) persists every UEI lookup outcome in `bw_ctl.sam_entity_resolution`, honors Retry-After with exponential backoff, stops after three consecutive HTTP 429s, and resumes on the next run; resolved UEIs become `SAM_ENTITY` identity records and the SAM-vs-USAspending disagreement queue and SAM coverage metric are recomputed. The UEI universe comes from the crosswalk's USAspending recipient identity records (the award-search API omits `recipient_uei` on most rows, which is the real reason the one-shot stage resolved nothing). First run: 103 candidates, 13 attempted, 10 resolved before the public-tier burst quota returned 429; 90 resume on later runs. The key is read from the runtime environment or the Director's provided file into `process.env` only. |
| Chain graph on CMS `chain_id` | **Closed.** `ChainLabelAtoms.ResolveChainLabel` is an organization-marker allowlist: a chain label is stored only when the publisher's `chain_name` carries an organization marker; otherwise the label is withheld and the chain is identified by its CMS id (KY: 17 chains / 177 facilities, 4 labels withheld; FL: 47 / 518, 8 withheld). Exported as `ownershipNetwork.js` `cmsChains` (schema v3), rendered as a third relationship-graph mode ("CMS-reported chain → facilities") and as ownership-chain items in Funding & Resilience, with a `cms-chains` briefing on both state pages. |
| Contract section index | **Closed.** `IndexContractSections` extracts every numbered section and appendix heading from the retained Kentucky MCO contract PDFs with pdfjs (5 documents, 1,958 sections; Anthem has no retained document and is an explicit gap), writes `dso_contract_section` (title, PDF page, text hash, excerpt) and `contractSectionIndex.js` with obligation anchors (Liquidated Damages, Encounter Data, Medical Loss Ratio, …). `ExportMcparPlanPeriodForUi` joins each sanction record's cited section numbers (e.g. "26.13", "Appendix A") to a section title and page: 12 of 33 Kentucky records resolve; the plan-period sanction table shows the "Contract section (indexed)" column. Applicability remains the reviewer's determination. |

## Follow-ons executed (2026-09-02, third pass)

| Item | Closure |
|---|---|
| County denominator for the access briefing | **Closed.** `BuildCountyAccessContext` (`county-access-context`) joins, per county, Medicaid members (all 120 Kentucky counties parsed from the latest DMS "Monthly Membership Counts by County" PDF, landed into PSA with its hash; sum reconciles to the PDF's unduplicated statewide count within 0.1%) or eligibles (all 67 Florida counties from the AHCA "Age by County" PDF; sum reconciles to the STATE TOTAL row), the HRSA AHRF 2024-2025 primary-care HPSA code (`hpsa_prim_care_25`, 187 KY+FL counties), CMS Care Compare certified SNF beds and 1–2 star counts, and the HCRIS negative-margin rollup. Table `dso_county_access_context` (migration 014), export `countyAccessContext.js`. The county access briefing now reads: single-facility negative-margin counties serve 60,778 Kentucky members (14 of 15 in a primary-care HPSA) and 140,629 Florida eligibles (2 of 4), with certified beds per 1,000 members per county. Three HCRIS rows carry city names in the county field (JACKSONVILLE, KERSHAW, OCALA) and stay unmatched rather than guessed. |
| USAspending award type | **Closed.** `Award Type` added to `AWARD_FIELDS`; column `award_type` on `dso_federal_award`; the grain was re-fetched (`ofr-award-grain-refresh`: 442 awards, reconciliation PASS, labels and continuation assessments re-derived, 19 / 82 `no_public_continuation_found` preserved). Every award now carries its published assistance type (Project Grant 359, Block Grant 69, Formula Grant 8, Cooperative Agreement 6) and the award class restates that type; the Title XIX rule is unchanged. |
| SAM.gov re-run | **Attempted twice more.** The public-tier burst quota returned 429 on the first three attempts of each later pass; 90 UEIs remain persisted as `rate_limited` and resume on subsequent runs. No new credential was requested. |
| Anthem contract document | **Cannot be closed from public sources.** The DMS contracts page does not carry the exited plan's contract; Anthem citations resolve against the common contract structure and are labeled as such. |
| Pre-existing warehouse type error | **Fixed.** `HcrisFinancialMetrics.test.ts` rewritten on `node:test` + `node:assert` like the other warehouse atom tests; `tsc --noEmit` is clean. |

## Briefing copy review (third pass)

Every headline and lede was re-read against a second rule, now enforced by
test (`PRODUCT_COMMENTARY_TERMS`): copy describes the evidence and its
implication for a decision-maker — the relationship, the exposure, the
question — and never DecisionPro itself (what was added, joined, exported, or
should be built). Ledes that had described product mechanics ("every edge
now carries its prime award key", "the goal page collapsed these") were
rewritten as intelligence ("when a prime award ends, the organizations funded
beneath it lose pass-through dollars unless the prime is renewed").

The Director's follow-up review found the headlines themselves still spoke
the data model's language ("70 sub-award edges sit beneath 4 prime awards",
"identity-resolved sub-recipients"). Every headline was rewritten in the
language of programs, dollars, facilities, and people — "17 organizations
funded through 4 federal awards that end within a year stand to lose $29.2M
in pass-through funding unless those awards are renewed or replaced" — and a
third rule, `HEADLINE_JARGON_TERMS` (edge, node, grain, cube, join, schema,
identity-resolved, exact-derived, crosswalk, PUF, rollup, record, listing),
is enforced by test on headlines. Ledes may still name a method.

## Acceptance record (2026-09-02)

| Gate | Result | Evidence |
|---|---|---|
| Warehouse exports (`ofr-depot-export`, then `funding-runway-assess-export`, `mcpar-plan-period-export`, `ofr-facility-export`) | All six exports reconcile `PASS`; KY 155 / FL 287 awards with continuation statuses preserved (19 / 82 `no_public_continuation_found`); KY 145 / FL 455 watchlist rows; KY 1,197 / FL 575 edges with prime keys; MCPAR 1,018 / 2,501 rows, 33 KY sanction records aligned, overpayment sum reconciles to the hydrated $5,088,460.77 metric; person-level scan 0 | `xenodroid-bw` CLI accuracy lines; `mcparPlanPeriod.js` `reconciliation.checks` |
| Warehouse type-check (`tsc --noEmit`) | exit 0 | bounded 300 s run |
| Application tests (`npm run test`) | 71 files / 320 tests passed (3 new files: `operationalBriefings.test.js`, `mcparPlanPeriod.test.js`, `operationalBriefingStripDom.test.jsx`; two existing cap tests rewritten as display-cap + join-key tests) | headless-validated |
| Production build (`npm run build`) | passed (existing large-chunk advisory only) | headless-validated |
| Canonical harness (`npm run harness:verify`) | `adapter=node-vite`, passed, exit 0 | headless-validated |
| Hidden-desktop rendered journey, KY + FL | passed; strip above the goal grid on both pages (strip top 277 px, grid top 2,048 / 2,014 px), 3 cards by default and 10 after "Show all", first headline free of verdict wording, plan-period record opens in the card with 24 / 40 non-comparable cells shaded, "Open in Contract Accountability" / "Open in Strengthen Plan Accountability" navigate, no browser or page errors, cleanup passed | `docs/evidence/harness-workbench/isolated/20260902T172154226Z/` (isolated-rendered) |

### Second pass (gap closure), 2026-09-02

| Gate | Result | Evidence |
|---|---|---|
| Warehouse loads | Care Compare KY 267 rows / 29 chains (55 labels withheld), FL 694 rows / 62 chains (75 withheld); contract index 5 documents / 1,958 sections; SAM resolve 103 candidates, 13 attempted, 10 resolved, stopped on 3 consecutive 429s (resumable) | CLI logs; `bw_ctl.sam_entity_resolution`; `dso_contract_section` |
| Depot exports (`ofr-depot-export`, `ky-contract-index`, `ofr-sam-resolve`) | All reconcile `PASS`; FL compound list computable (118 facility-years, 382 of 454 watchlist rows with rating context); 12 of 33 KY sanction citations resolve to a section and page; SAM coverage 5 + 5 | regenerated `alp/*.js` bundles |
| Warehouse type-check | Only the pre-existing `HcrisFinancialMetrics.test.ts` vitest-types error remains (not part of this build); no error in any changed file | bounded `tsc --noEmit` |
| Application tests | 71 files / 323 tests passed (new: CMS chain export rule, compound-or-gap per state, chain briefing, citation resolution) | headless-validated |
| Production build, canonical harness | passed, `adapter=node-vite` exit 0 | headless-validated |
| Hidden-desktop rendered journey, KY + FL | passed; 11 cards per state after "Show all"; the KY sanction record shows the indexed contract section and page column | `docs/evidence/harness-workbench/isolated/20260902T175232438Z/` (isolated-rendered) |

### Third pass (follow-ons and copy review), 2026-09-02

| Gate | Result | Evidence |
|---|---|---|
| Warehouse loads | County context: KY 120 counties (sum within 0.1% of the PDF statewide count), FL 67 (sum reconciles to STATE TOTAL), AHRF 187 KY+FL HPSA rows, 190 joined county rows; award grain re-fetched: 442 awards, reconciliation PASS, every award carries a published assistance type | CLI accuracy lines; `dso_county_access_context`; `dso_federal_award.award_type` |
| Warehouse type-check and atom tests | `tsc --noEmit` exit 0 (the vitest-typed test rewritten on `node:test`); 6 atom tests pass under `node --test` | bounded runs |
| Application tests | 71 files / 325 tests passed (new: product-commentary rule, county denominators, award type) | headless-validated |
| Production build, canonical harness | passed, `adapter=node-vite` exit 0 | headless-validated |
| Hidden-desktop rendered journey, KY + FL | passed; 11 cards per state; rewritten headlines render; sanction record shows the contract section column | `docs/evidence/harness-workbench/isolated/20260902T181353792Z/` (isolated-rendered) |
| Headline rewrite (plain decision language, jargon rule) | 325 tests pass with `HEADLINE_JARGON_TERMS` enforced; build and harness pass; rendered journey shows the first Kentucky headline as "17 organizations funded through 4 federal awards that end within a year stand to lose $29.2M in pass-through funding unless those awards are renewed or replaced." | `docs/evidence/harness-workbench/isolated/20260902T183826833Z/` (isolated-rendered) |

Not claimed: no visible-host session was used; nothing has been pushed to
GitHub, gh-pages, or the demo host. The first isolated run
(`20260902T171946170Z`, removed) failed only because the scenario scanned the
whole strip, including guardrail lines that legitimately negate verdict
words; the scenario now scans headlines and ledes, which is the rule.
