# DecisionPro Kentucky / Florida dashboard review, operationalization, and build plan

**Status:** reviewed; Kentucky public-source ETL and action-oriented Operational Intelligence V1 implemented; production Florida ETL and Source Reconciliation pending  
**App ID:** `decisionpro`  
**Reviewed:** 2026-08-27; Kentucky action-workbench implementation verified 2026-08-28  
**Input reviewed:** `DPROFL-FLORIDA-INGESTION-SPEC.md` from the Director-provided Claude scratchpad path  
**Rendered evidence class:** `headless-validated` for the external comparison; `isolated-rendered` for the local KY/FL MVP; no visible-host session used  
**Product boundary:** public aggregate / de-identified information only; no PHI or person-level Medicaid data

## Executive conclusion

Florida AHCA has broader **public operational subject coverage** than the current Kentucky source mix: plan-level performance, prior authorization, enforcement, managed-care financial categories, facility capacity, ownership changes, PACE, and hospital financial reporting. Its public experience is nevertheless eleven separate Tableau workbooks. It does not provide a single evidence chain from a signal to a validated case, accountable owner, intervention, outcome measure, and decision record.

DecisionPro should not copy Florida's dashboard architecture. It should add the valuable Florida domains to its existing role-based, provenance-first workflow and differentiate on five capabilities:

1. join plan performance, prior authorization, complaints, enforcement, financial, and program-integrity evidence by plan and period;
2. retain source definition, period, grain, freshness, and permission metadata on every fact;
3. convert a signal into a controlled investigation/remediation queue with an owner and success measure;
4. compare Kentucky and Florida only on aligned definitions, using federal sources where possible;
5. preserve explicit gaps and non-causal guardrails instead of presenting anomaly detection as a waste finding.

The highest-value new Kentucky source is not a Kentucky website. It is the official CMS **Managed Care Program Annual Report Public Use File (MCPAR PUF) 2024**. A live probe found:

| Slice | Rows | Question IDs | Programs | Reporting entities |
|---|---:|---:|---:|---:|
| Kentucky | 1,018 | 176 | 1 | 9 |
| Florida | 2,501 | 182 | 4 | 17 |

Kentucky MCPAR coverage includes medical-loss-ratio reporting, encounter timeliness, grievances, appeals, access, quality, sanctions/corrective actions, overpayment reporting, and program integrity. It closes several draft Kentucky gaps without waiting for a new state Tableau deployment.

## Kentucky action-oriented Operational Intelligence V1 — implemented

The Director authorized an action-first redesign on 2026-08-28. The Kentucky Operational Intelligence page now leads with six goal categories rather than source inventory:

1. Optimize Spending;
2. Improve Coverage & Access;
3. Identify Quality Gaps;
4. Contract Accountability;
5. Protect Program Integrity;
6. Trend & Budget Planning.

The default Goals viewport now contains only six quiet intent tiles. Each reads **“If you want to”**, names the goal, and begins its invitation with **“Click here to…”**. Selecting a tile replaces the index with a dedicated governed Decision Case page rather than expanding details beneath the full grid. An **All goals** control returns to the index.

Each goal-detail page has three visible lanes: **Inputs → Analysis & transformations → Potential actions**. Potential actions are sorted by recommended **review priority**, while a separate **implementation status** prevents “review first” from being misread as authorization to implement. Every input, transformation, and action opens an explanation that records source or method, affected people/services/spending/oversight, limitations or guardrails, and—where applicable—owner, authority, prerequisites, time horizon, and success measures.

Every Kentucky potential-action tile and explanation now answers seven delivery questions directly: **Who acts? What must they do? How do they do it? What benefit is expected? How long should it take? What will it cost? What could it save?** Costs and savings remain evidence-governed: unsupported figures are labeled not yet estimated, and the `$5.1M` overpayment value is explicitly a candidate reconciliation pool rather than a savings forecast. The top navigation uses bordered, filled tab controls, and the selected Decision Case uses a higher-contrast panel and boundary so it does not blend into the page background.

Operational Intelligence now uses three page-level tabs: **Goals**, **Evidence & Data**, and **Data Sources**. Hydrated metrics, the operating loop, and completion boundaries live only on Evidence & Data. The **Free and public source coverage** catalog lives only on Data Sources. The former duplicate Kentucky operational-play queue remains suppressed; Florida retains its current competitive-preview priorities until the common action schema is populated with Florida evidence.

Implemented artifacts:

- `wireframe V1/app/src/data/operationalGoals.js`
- `wireframe V1/app/src/components/OperationalActionWorkbench.jsx`
- `wireframe V1/app/src/components/OperationalIntelligence.jsx`
- `wireframe V1/app/src/lib/operationalActionWorkbench.test.jsx`
- `wireframe V1/app/src/lib/operationalIntelligence.test.js`
- `docs/research/decisionpro-fl-2026-08-27/verify-local-variants.cjs`

Verification completed:

- 47 test files / 194 tests passed;
- Scriptorium `npm run harness:verify` passed;
- all six goal categories opened through semantic browser interaction;
- input and action explanations opened and closed, with source, impact, priority, authority, prerequisites, guardrails, and success measures asserted;
- button contrast passed at a minimum observed ratio of 5.94:1, with no browser console or response errors;
- evidence class `isolated-rendered` at `docs/evidence/harness-workbench/isolated/20260828T160852750Z/`.

## Evidence and method

The review used Chrome 151 in headless mode at a 1440×1000 viewport. The audit:

- loaded `https://ahca.myflorida.com/medicaid/agency-dashboards.html` with the honest user agent `DecisionPro-Research/1.0 (+https://decisionpro.io/research)`;
- enumerated all dashboard links and opened the plan-transparency, Medicaid-financial, prior-authorization, hospital-financial, and compliance workbooks;
- captured semantic headings and controls, screenshots, URLs, and Tableau interaction surfaces;
- loaded the current `https://demo.decisionpro.io`, selected Budget / Fiscal Analyst, and inspected Role Home, Authoritative Sources, Evidence Rooms, and Legislative Analysis;
- live-probed the official CMS MCPAR dataset metadata and CSV, then parsed Kentucky and Florida slices;
- verified relevant official federal and state publisher documentation.

Evidence is stored under:

- `docs/research/decisionpro-fl-2026-08-27/evidence/headless-audit.json`
- `docs/research/decisionpro-fl-2026-08-27/evidence/florida-agency-dashboards.png`
- `docs/research/decisionpro-fl-2026-08-27/evidence/fl-1-health-plan-transparency-dashboard.png`
- `docs/research/decisionpro-fl-2026-08-27/evidence/fl-2-compare-medicaid-financial-data.png`
- `docs/research/decisionpro-fl-2026-08-27/evidence/fl-3-prior-authorization-metrics.png`
- `docs/research/decisionpro-fl-2026-08-27/evidence/fl-5-explore-compliance-actions.png`
- `docs/research/decisionpro-fl-2026-08-27/evidence/decisionpro-ky-budget-home.png`
- `docs/research/decisionpro-fl-2026-08-27/evidence/decisionpro-ky-authoritative-sources.png`
- `docs/research/decisionpro-fl-2026-08-27/evidence/decisionpro-ky-evidence-rooms.png`
- `docs/research/decisionpro-fl-2026-08-27/evidence/local-variant-verification.json`
- `docs/evidence/harness-workbench/isolated/20260827T223657331Z/local-variant-verification.json`
- `docs/evidence/harness-workbench/isolated/20260827T223657331Z/local-state-landing.png`
- `docs/evidence/harness-workbench/isolated/20260827T223657331Z/local-ky-operational.png`
- `docs/evidence/harness-workbench/isolated/20260827T223657331Z/local-ky-source-catalog-button.png`
- `docs/evidence/harness-workbench/isolated/20260827T223657331Z/local-fl-operational.png`
- `docs/evidence/harness-workbench/isolated/20260827T223657331Z/local-zoom-dropdown.png`
- `docs/evidence/harness-workbench/isolated/20260827T223657331Z/local-zoom-20.png`
- `docs/evidence/harness-workbench/isolated/20260827T223657331Z/local-zoom-200.png`

## Functional comparison

| Capability | Florida AHCA | Current DPro-KY | DecisionPro response |
|---|---|---|---|
| Role-based workspace | No; dashboard-by-topic index | Yes; seven role perspectives | Preserve DecisionPro advantage |
| Cross-domain evidence chain | No; manual joins across workbooks | Partial through Evidence Rooms, sources, blender, and briefs | Add explicit plan-period and intervention joins |
| Plan performance | Rich 31-metric transparency view with target, rank, and prior quarter | MCO accountability and EQRO/public gaps, less plan-detail depth | Add MCPAR plus state/EQRO plan accountability |
| Prior authorization | Plan-level approval, denial, appeal, timeliness, extension, and service views | Public gap | Add federal MCPAR when reported; add state source where available |
| Enforcement | CAP, liquidated-damage, sanction, category, period, and assessed-dollar views | Public gap | MCPAR first; state enforcement feed second |
| Managed-care financial categories | Annual plan × service-category table | Federal/KY aggregate cost context, not comparable plan category detail | Add MCPAR MLR/financials and governed state accounting adapter |
| Hospital/facility finance | Ten-year hospital ratios | Limited facility financial depth | Add CMS Provider Data and state facility financial sources where definitions permit |
| Licensed beds / provider ownership | Yes | Provider and delivery-system room with public gaps | Add CMS Provider Data, NPPES, state licensure, and identity reconciliation |
| PACE | Yes | Not a dedicated domain | Add only when program relevance and source grain justify it |
| County eligibility | Published monthly PDFs outside the dashboard index | Kentucky monthly county membership already loaded | Correct Florida draft; build a document adapter |
| Fee schedules | Published outside the dashboard index | Kentucky schedules catalogued | Correct Florida draft; ingest effective-date documents, never equate rates to paid claims |
| Source definition/provenance UI | Limited; metric definitions exist, upstream `Metric Source` is not prominent | Strong: source catalogue, PSA, lineage, reconciliation, timeline, accuracy gate | Preserve and extend |
| Explicit missing-data objects | No | Yes | Preserve DecisionPro advantage |
| Insight-to-action lifecycle | No persistent owner/intervention/outcome record | Options/blender/brief, but operational accountability was incomplete | Add Detect → Validate → Act → Measure → Learn |
| Cross-state comparison | No | Federal benchmark concepts exist | Add state dimension and definition-aligned KY/FL comparisons |
| Export/share | Tableau download, full screen, share | JSON/Markdown/Excel-oriented evidence exports and brief packaging | Preserve both governed data and decision-record exports |

## Gaps worth filling in DPro-KY

### P0 — CMS MCPAR managed-care accountability

Load Kentucky MCPAR before building fragile state-document scrapers. The source is official, free, machine-readable, and directly relevant to:

- MLR / financial performance;
- encounter-data reporting and correction performance;
- grievances, appeals, fair hearings, and favorable resolutions;
- availability, access, and network-adequacy reporting;
- quality and performance measures;
- sanctions and corrective-action plans;
- overpayment reporting and program integrity;
- prior authorization as the federal reporting cycle matures.

Required controls:

- model `Question_ID` as a versioned measure/question dimension;
- retain response type, measure number, plan/program, reporting period, and raw response;
- do not count all `Plan_or_BSS` members as active MCOs;
- normalize denominators before plan comparisons;
- treat `N/A`, blank, zero, and not-reported as distinct states;
- preserve state-reported status and annual lag;
- reconcile active-plan identity to effective Kentucky contracts.

### P1 — Contract intelligence

Build an obligation-to-performance model from public Kentucky DMS contracts/amendments and MCPAR:

- contract clause / obligation;
- effective period and amendment lineage;
- responsible plan/vendor;
- required report or service-level measure;
- observed performance evidence;
- enforcement/remedy authority;
- validation state and owner;
- intervention and closure evidence.

Do not let an LLM infer breach from contract text plus an adverse metric. It may create a review candidate; an authorized human determines contractual meaning and action.

### P1 — Budget intelligence

Kentucky publishes spending/contract searches and budget documents, but no supported public accounting/budget API was identified. Build governed adapters after supported APIs:

- revision-aware appropriations from OSBD documents;
- agency/vendor/contract payments from Kentucky Transparency;
- federal award context from USAspending;
- enrollment, rate, benefit, service mix, and timing explanations;
- benefit-realization records for approved interventions.

The primary analytic object is **explained versus unexplained variance**, not “overspend equals waste” or “underspend equals efficiency.”

### P1 — Provider integrity and access

Join public institutional/entity data:

- CMS Provider Data Catalog: capacity, staffing, quality, deficiencies, ownership, fines, and payment denials;
- HHS-OIG LEIE: current exclusions and monthly supplements;
- NPPES/public state directories: provider identity and location;
- KyGovMaps/KyGeoNet: geography and transportation/access context;
- HRSA/Census/CDC: workforce, denominator, and population-health context.

Fuzzy matches must remain review candidates. They are never adverse findings.

### P2 — State-supported near-real-time operational feeds

Public data cannot support causal claim-level cost attribution, member-level assignment, or near-real-time utilization management. Preserve explicit gaps for:

- MMIS/MCO claims and encounters;
- eligibility/application outcomes;
- payment/recovery transaction detail;
- electronic EQRO/HEDIS source feeds;
- real-time authorization workflow events.

## Public, free, and legal source plan

This table is a technical/access classification, not legal advice. Production use still needs recorded source terms and counsel/owner review where indicated.

| Source | Access | KY operational value | DecisionPro posture |
|---|---|---|---|
| CMS MCPAR PUF | Official API/CSV, public | MCO finance, MLR, encounter, complaints/appeals, access, quality, sanctions/CAP, integrity, evolving PA | `SAFE`; P0 ingest |
| data.medicaid.gov existing datasets | Official API/CSV, public | Enrollment, expenditure, quality, pharmacy | Already core; refresh most recent attributable period |
| CMS Provider Data Catalog | Official API/CSV; no registration currently required | Facility capacity, staffing, quality, ownership, deficiencies/penalties | `SAFE`; P1 ingest |
| HHS-OIG LEIE | Official public CSV | Provider/vendor integrity screening | `SAFE`; P1 with identity guardrails |
| NPPES Read API/download | Official public API/files | Provider identity/location | `ATTRIBUTABLE`; P1 identity only |
| USAspending API v2 | Public, currently no auth | Federal award/grant/subaward context | `SAFE`; context only, not state payment truth |
| SAM.gov opportunity/entity/exclusions APIs | Public API key required for relevant endpoints | Vendor/opportunity and federal exclusion context | `ATTRIBUTABLE`; optional, secret-managed |
| Census Data API | Free key now required | County/tract denominators, insurance and socioeconomic context | `SAFE`; secret-managed and rate-limited |
| CDC PLACES API | Public open-data API | County/tract population-health context | `SAFE`; context/proxy only |
| KyGovMaps OGC Search / KyGeoNet ArcGIS REST | Public APIs | Geography, facilities, transportation/access joins | `SAFE` per dataset metadata |
| Kentucky Transparency | Public search, no documented public API found | Contract and non-contract state payments | `ATTRIBUTABLE`; governed adapter, no invented API contract |
| Kentucky OSBD | Public documents, no documented public API found | Appropriations, revenue estimates, fiscal baselines | `ATTRIBUTABLE`; revision-aware document adapter |
| Kentucky DMS contracts/reports | Public web/PDF | Obligations, amendments, quality and roster | `ATTRIBUTABLE`; document lineage and manual/legal review |

## Review of the Florida ingestion draft

### What the draft gets right

- DPro-FL should be a second hydration of one product, not a code fork.
- `allow_export_data` must be an absolute per-run gate.
- Honest user-agent, attribution, no model training, pacing, cookie persistence, and no browser impersonation are sound controls.
- Raw CSV plus decoded workbook configuration belongs in PSA provenance.
- Data-derived freshness and workbook publication freshness must both be retained.
- Parameter-driven sheets require a verified retrieval contract before production claims.
- A shared `state` dimension is the correct cross-state architecture.
- Rendered-to-export reconciliation and definition alignment are mandatory.
- Expired contract targets must be flagged rather than silently compared.
- The strongest DPro-FL demonstration is the cross-dashboard plan-period join.

### Material corrections

1. **Florida county Medicaid eligibility is published.** AHCA's Medicaid Eligible Reports page contains current monthly age-by-county and program-group-by-county PDFs. Replace `GAP-FL-COUNTY-MEDICAID-ENROLLMENT` with a public-document adapter gap until ingested.
2. **Florida fee schedules are published.** They are outside the Agency Dashboards index. Replace `GAP-FL-FEE-SCHEDULE` with an effective-date publication adapter; preserve the distinction between published rates and paid claims.
3. **MCPAR materially changes the state comparison.** Kentucky already has a federal public source for sanctions/CAP topics, MLR, encounter reporting, grievances/appeals, overpayment reporting, and program integrity. The draft's “not published by KY” language should become “not present on the Kentucky DMS dashboard/publication path; available federally through MCPAR, subject to annual lag and state reporting.”
4. **`ATTRIBUTABLE` is appropriate for undocumented Tableau exports, but robots directives are not a legal license.** Preserve the draft's legal-review gate and source-of-record/non-redistribution constraints.
5. **The proposed new Florida DSOs should be reviewed against reusable question/value and intervention models.** State-named tables are acceptable where grain is genuinely Florida-specific, but MCPAR should use state-neutral managed-care facts.
6. **Operationalization is missing.** Add Intervention, Decision Record, Benefit Realization, Owner, Threshold/Rule Version, Validation Result, and Review Window objects and state transitions.

## Operational recommendations: turning insight into action

Every operational play must implement this lifecycle:

`Detected → Awaiting validation → Validated / dismissed → Assigned → In intervention → Measuring → Closed effective / closed ineffective / superseded`

Minimum fields:

- signal ID, source facts, definition versions, periods, grains, and comparisons;
- alternative explanations tested;
- validation owner and result;
- accountable operational owner;
- authority/contract clause where applicable;
- intervention hypothesis and expected mechanism;
- baseline, target, leading measure, outcome measure, and balancing measures;
- due dates and review window;
- realized benefit method and confidence;
- decision record and closure reason.

Recommended investigation patterns:

| Pattern | Candidate signal | Required validation | Possible controlled action | Outcome / balancing measure |
|---|---|---|---|---|
| Overpayment/recovery | Plan-reported amount, repeat integrity topic | Reconcile source, contract, payment, recovery status | Recovery case, control repair, clause enforcement | Confirmed recovery, recurrence, admin cost |
| Encounter reliability | Timeliness/quality below requirement | File acceptance and denominator checks | Corrective file cycle, validation rule, escalation | Accepted-file rate, correction time, released measures |
| Appeals/grievances friction | High normalized appeal/overturn or unresolved rate | Service/request mix and denominator alignment | Rule clarification, provider education, workflow repair | Appeal rate, overturn rate, decision time, care delay |
| Prior authorization burden | Extension use, slow decisions, high overturn | Clinical/service alignment and appropriateness | Gold card, automation, requirement retirement, SLA | Cycle time, burden, inappropriate use, quality |
| Budget variance | Material unexplained appropriation/payment variance | Timing, encumbrance, enrollment, rate, mix | Reforecast, procurement change, contract correction | Explained share, realized benefit, service balance |
| Vendor concentration | High spend/criticality concentration | Contract scope, market, performance, switching cost | Competition/continuity plan, SLA changes | Risk exposure, performance, transition cost |
| Facility/access risk | Capacity/quality/ownership deterioration | Entity match, geography, demand and population | Targeted network/facility intervention | Capacity, wait/travel, staffing, quality |

These are investigation and intervention designs. They are not findings that money is being wasted.

### Implemented Kentucky recovery-reconciliation deliverable

The highest-priority Optimize Spending action now opens a DecisionPro-produced review workpaper rather than a procedural explanation:

- XenoDroid BW filters the latest governed Kentucky MCPAR load to the plan-level reported-overpayment and corresponding-premium questions.
- The exporter produces a versioned `decisionpro/ky-recovery-reconciliation/v1` package with source URI, content hash, load-history ID, reporting period, question IDs, Kentucky authority responses, and six plan rows.
- The current CY 2024 package contains six plans and an exact reported candidate pool of **$5,088,460.77**.
- DecisionPro calculates each candidate amount as a share of corresponding premium revenue and initializes every row as **Awaiting authorized recovery record**. It does not infer recovery, debt, waste, misconduct, or savings from MCPAR.
- The review workspace provides reviewer dispositions (recovered, outstanding, duplicate, non-actionable, disputed, or awaiting evidence), recovered-amount entry, evidence references, notes, live confirmed totals, a review-workpaper CSV, and an authorized recovery-status template.
- Question-mark controls explain every summary measure, estimate, table heading, and reviewer field in plain language, including source grain, decision meaning, and why an estimate must not be treated as a confirmed value.
- Every operational goal detail begins with permanent, screen-specific usage guidance: where to start, how to read Inputs → Analysis & transformations → Potential actions, what clicking a card does, and where period/scope controls will appear when a prepared workpaper supports them.
- The recovery workpaper displays a visibly read-only **Review period** in **Review setup** because CY 2024 is the only loaded official MCPAR period; it does not imply that the reviewer can change it. The adjacent working **Plan scope** control selects all six plans or one plan and recalculates rows, totals, estimates, and downloads. Guidance states that a data operator must run the governed MCPAR ingestion outside the dashboard to add a period, and every instruction names the exact on-screen control or authorized external DMS step required.
- Where governed actuals are unavailable, the workspace supplies a labeled planning sensitivity range: 10%–50% of the candidate pool with a 25% planning case, 72–120 estimated review hours, $4,320–$9,600 estimated review cost, and 3–6 estimated weeks after authorized records arrive. The attached justification states that no governed Kentucky historical recovery-rate series is available and tells DMS to replace the assumptions when authorized history is supplied.
- Kentucky's MCPAR-stated authority locator and monitoring path (Section 34 / Appendix J; PI-02, CP-06, and PI-06) appear beside the workpaper, subject to exact contract and case verification.
- The public-source workpaper is review-ready; final classifications still require an authorized aggregate or plan-level recovery ledger/payment record. PHI and person-level uploads are prohibited. Reviewer edits in this MVP are session-only and explicitly labeled as not persisted.

This converts DPro's help from “tell DMS how to reconcile” to “prepare the mechanical reconciliation and give DMS the bounded decisions that require authoritative review.”

## DPro-FL product design

### Competitive position

DPro-FL should compete on integration and execution:

- one role-based shell across finance, quality, plan, facility, access, and enforcement domains;
- one plan-period identity across AHCA and CMS sources;
- source definition and permission provenance visible at the point of use;
- state-neutral federal comparisons with definition breaks labeled;
- operational owner, intervention, and measured outcome attached to every promoted signal;
- explicit gaps for blocked AHCA exports and unavailable operational grain.

### Implemented MVP

- The bare URL opens a state-neutral DecisionPro landing page with Kentucky and Florida product tiles.
- `?state=KY` and `?state=FL` provide explicit, cohesive state-product URLs without a repository fork.
- Shared state product selector in the selected DecisionPro shell; the DecisionPro logo returns to the neutral landing.
- Florida brand and evidence badge flow through the Role Selector, header, and footer.
- Selecting a Florida role opens the state-aware Operational Intelligence surface.
- Kentucky-only Evidence Rooms, source catalogue, blender, legislation, and Ask Sam are hidden on the Florida preview so Kentucky data is never relabeled as Florida.
- Kentucky receives the same Operational Intelligence surface as a new nav item.
- The page exposes official source links, access method, cadence, operational use, caveat, readiness, action owner, next action, validation metric, and guardrail.
- The source model records the Florida county-eligibility and fee-schedule corrections.

### Production build sequence

1. **Policy/access layer:** source registry, robots snapshot, `allow_export_data`, honest user-agent, pacing, non-training/non-redistribution flags.
2. **CMS MCPAR state-neutral model:** ingest KY and FL; version questions; normalize response states; reconcile plan/program identities.
3. **Operational object model:** Signal, Validation, Intervention, Decision Record, Benefit Realization, Owner, Rule Version.
4. **Kentucky operational release:** MCO accountability, encounter reliability, integrity/recovery, and contract-obligation joins.
5. **Florida source discovery and TEST loads:** workbook config, parameter validation, eligibility/fee document adapters, raw/config PSA retention.
6. **State dimension/backfill:** add `KY` and `FL` to shared facts; prevent state-null presentation rows.
7. **Florida REAL ETL and reconciliation:** permitted AHCA sources, rendered cross-checks, definition/contract-period/encoding rules.
8. **Florida Evidence Rooms:** Plan Accountability, Enforcement, Financial & Budget, Prior Authorization, Facilities & Access, and Hospital Reporting.
9. **Cross-state comparison:** MCPAR and other federal definitions first; labeled proxies only where definitions differ.
10. **Benefit-realization loop:** action queues, owners, outcomes, audit trail, and exports.

## Acceptance gates

- `npm run test` passes.
- `npm run build` passes.
- `npm run harness:verify` passes or reports a bounded external blocker.
- Bare state-neutral landing, Kentucky tile, and Florida tile are headless interaction-validated and `isolated-rendered` for this MVP.
- KY `?state=KY` role flow remains headless interaction-validated and is `isolated-rendered` for this MVP.
- FL `?state=FL` role selection, brand, nav isolation, operational plays, source links, and completion boundary are headless interaction-validated and `isolated-rendered` for this MVP.
- No Kentucky analytical magnitude appears on a Florida route.
- MCPAR facts retain state/program/plan/question/period/raw response and provenance.
- Florida eligibility and fee schedules are not labeled unpublished.
- Blocked AHCA workbooks remain Gap objects.
- No anomaly is labeled waste, breach, savings, or causality without validation evidence.
- Production Florida accurate claims remain blocked until REAL ETL plus Source Reconciliation pass.

## Current completion boundary

| Layer | Status |
|---|---|
| Research and headless external comparison | Complete, `headless-validated` |
| Florida scratchpad review/corrections | Complete |
| KY operational design and UI | MVP implemented |
| State-aware DPro-FL shell and operational preview | MVP implemented |
| Automated tests | Complete: 48 files / 197 tests passed |
| Production build and Scriptorium harness | Complete; `npm run harness:verify` passed |
| Local neutral/KY/FL browser flows | Complete; headless and `isolated-rendered`, no console/response errors |
| Link/button contrast and persistent UI zoom | Complete; visible links and enabled buttons audited at 4.5:1 or better, source-catalog CTA verified at 80% zoom, and zoom verified at 20%-200%, typed values, slider, controls, menu, and reload persistence |
| Kentucky operational public-source ETL | Implemented and live-hydrated: MCPAR (1,018 response rows), CMS Provider Data (267 facilities), aggregate-only LEIE, USAspending FY context, Kentucky licensed-hospital capacity, 7 current budget documents, 5 CY2026 MCO contract documents, and a Kentucky Transparency source manifest. All loads retain load history and content hashes; 27 aggregate metrics are exported to the UI. |
| Kentucky recovery reconciliation | Implemented and pipeline-generated: six CY 2024 plan rows, exact $5,088,460.77 reported candidate pool, premium ratios, Kentucky authority/process context, reviewer dispositions, live totals, review CSV, and recovery-status template. Public MCPAR does not contain recovery status, so final classifications remain pending authorized state evidence. |
| Kentucky Transparency transaction facts | Not claimed: the official search page is retained and monitored, but no documented supported analytical API/export was found. A supported export or governed operator extract remains required. |
| Production AHCA ETL / PSA / DSOs / cubes | Planned, not implemented |
| Florida Source Reconciliation | Pending production ETL |
| Florida REAL Evidence Rooms | Pending production ETL |
| Director visual acceptance | Pending Director review |
