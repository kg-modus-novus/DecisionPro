# Organization Funding & Resilience Intelligence (OFR) — build plan

**Status:** Director-authorized 2026-08-31; execution delegated to an autonomous agent run per `docs/planning/ofr-kickoff-prompt.md`. OFR-00, OFR-01, and OFR-02 (identity crosswalk spine, state-neutral KY+FL) implemented and gate-green as of 2026-08-31; OFR-03..09 not yet started. A security incident (SAM.gov key briefly exposed in the conversation transcript via an unredacted error message, never persisted to any repo/database/export artifact) occurred and was resolved during OFR-02 — see `docs/planning/ofr-completion-report.md` "Security incident (OFR-02)" section. **Plan amended 2026-08-31 after OFR-01:** SAM.gov key provisioned — `SAM_ENTITY` upgraded to hybrid-preferred and OFR-02's seed order revised accordingly; SAM key-expiry monitoring (BW admin dashboard banner) implemented directly by the Director's session — re-read the `SAM_ENTITY` row, OFR-02 row, and credential gate before resuming.
**App ID:** `decisionpro`
**Origin:** DataRepublican.com discovery scan (SOL assessment, 2026-08-31) reviewed, corrected, and extended by Claude; all sources below are official publishers — no DataRepublican code, data, or calculated fields are adopted
**Product boundary:** public aggregate / de-identified information only; no PHI, no person-level Medicaid data, no person-level exports of any kind
**States:** Kentucky and Florida through the shared `state` dimension — one adapter set, two hydrations, no fork

## Executive summary

DecisionPro today is a *spend and performance* intelligence product. OFR adds an
*organizational viability and funding-continuity* layer: who delivers
Medicaid-adjacent services in each state, who funds them, how fragile that
funding and those organizations are, and which award expirations, financial
deteriorations, or ownership changes threaten access next. Neither the Florida
AHCA dashboards nor any Kentucky publication offers this as one integrated,
provenance-governed workflow.

Every OFR source is federal and state-neutral, so each package hydrates Kentucky
and Florida from the same governed adapter, following the MCPAR pattern.

## Grounding corrections to the SOL assessment

1. **A USAspending adapter already exists but is shallow.** `USA_SPENDING`
   (SOT-FED-AWARD-01) currently lands only fiscal-year obligation aggregates for
   assistance listing 93.778
   (`psa/USA_SPENDING/REAL/.../ky-93778-obligations-by-fiscal-year.json` and the
   Florida equivalent). OFR-01 deepens the existing adapter to award/recipient
   grain; it does not create a new one.
2. **State-neutrality doubles the value.** SOL framed the capability as
   Kentucky-only. Every OFR fact carries the `state` dimension and hydrates both
   products.
3. **Person-level guardrail.** DecisionPro exports HHS-OIG LEIE aggregate-only
   and never promotes names, birth dates, or addresses to the UI. OFR inherits
   that posture. IRS 990 officer/compensation records are person-level: **no
   officer-level ingestion in this package.** Organization-level financials only.

## Explicitly not adopted (from the SOL assessment, confirmed)

- DataRepublican calculated fields ("Indirect Government Monies," "Total
  Taxpayer Dollars") — no governed definition or reconciliation trail.
- "Possible EIN" matches as confirmed identity — candidate crosswalks only.
- AI-generated mission/ideological/alignment classifications.
- Funding magnitude as evidence of waste, duplication, misconduct, or savings.
- Donor, voter-turnout, and ideological-network tools — outside scope.
- DataRepublican as publisher of record; direct reuse of its repository code or
  packaged datasets (no license found).

## Governed data model additions

State-neutral objects, filtered by `state` at presentation:

| Object | Grain | Key fields |
|---|---|---|
| `federal_award` | one row per award (or award-period snapshot) | award ID, UEI, recipient name, awarding/funding agency, assistance listing, obligation, outlay, period of performance start/end, place of performance state/county, source action date, load history, content hash |
| `federal_subaward` | one row per subaward | prime award ID, prime UEI, sub-UEI/sub-recipient, amount, action date, place of performance, description |
| `nonprofit_org` | one row per EIN (from IRS EO BMF) | EIN, name, city/state, NTEE code, ruling date, foundation code, filing requirement |
| `nonprofit_filing` | one row per EIN × tax period (IRS annual extract) | receipts, program/admin/fundraising expense, assets, liabilities, government-grant revenue where reported, form type, tax period, extract vintage |
| `cost_report` | one row per CCN × fiscal year | facility identity, total/operating margin, Medicaid share of days or charges, uncompensated care, net assets/days cash where published |
| `ownership_interest` | one row per owner × facility × snapshot | CCN, owner/entity name role type, ownership percentage band, association date, snapshot date — PSA retains publisher detail; UI exports entity/chain aggregates only |
| `organization_crosswalk` | one row per identity assertion | UEI, EIN, NPI, CCN, state provider/facility ID, match method (`exact-published`, `exact-derived`, `inferred`), confidence, evidence citation, validation status. Exact and inferred assertions live in **separate collections**. |
| `funding_edge` | one row per funder→recipient×period | source org, recipient org, amount, period, source fact reference, identity confidence |
| `program_horizon_event` | one row per event | type (award expiration, waiver expiration, waiver deliverable, NOFO opportunity), program, state, event date, source document, status |
| `operational_signal` | existing Signal object | threshold + rule version, observed facts, interpretation, caveat, accountable owner, validation action, due date, expected benefit, realized measure |

## Source additions to both state catalogues

| FromSysID | Publisher / dataset | Access | TOS | Notes |
|---|---|---|---|---|
| `USA_SPENDING` (extend) | USAspending API v2 — awards, recipients, subawards | Official public API, no auth | `SAFE` | Deepen existing adapter; preserve assistance-listing, recipient-location, and period filters |
| `IRS_EO_BMF` | IRS Exempt Organizations Business Master File (state files) | Official public CSV | `SAFE` | Org-level only; crosswalk seed (EIN, name, NTEE) |
| `IRS_990_EXTRACT` | IRS annual Form 990 extract CSVs (SOI) | Official public CSV | `SAFE` | Org-level financials; the retired AWS S3 990 bucket must not be referenced — IRS hosts downloads directly. XML e-file corpus is a later phase, out of OFR scope |
| `CMS_HCRIS` | data.cms.gov Hospital / SNF cost report datasets | Official open-data API/CSV | `SAFE` | Medicare cost-report basis; label as such — not Medicaid payment truth |
| `CMS_OWNERSHIP` | data.cms.gov ownership PUFs (Hospital/SNF/Hospice/HHA all-owners; change-of-ownership) | Official open-data API/CSV | `SAFE` | UI exports chain/entity aggregates and flags only |
| `CMS_WAIVERS` | Medicaid.gov state waiver list & demonstration documents (KY TEAMKY, FL MMA, 1915 authorities) | Public web/PDF | `ATTRIBUTABLE` | Revision-aware document adapter; cite document + retrieval date |
| `GRANTS_GOV` | Grants.gov Search2 API | Official public API | `SAFE` | Forward-looking NOFO opportunity feed |
| `SAM_ENTITY` | SAM.gov Entity Management API (UEI↔EIN linkage) | Public API, **key provisioned** | `ATTRIBUTABLE` | **Hybrid-preferred.** SAM.gov is the federal registrar of record for UEI, so it is the *primary* source for UEI↔EIN assertions (`exact-published`). Director-provisioned key at `..\SAM.gov API Key Expires 11-30-2026.txt` (sibling of the repo, outside git); load into local env (`SAM_GOV_API_KEY`) at runtime — never commit, log, print, or export it. Key expires **2026-11-30**: rotation monitoring is implemented (2026-08-31) as a credential-expiry banner at the top of the XenoDroid BW admin dashboard — amber from 30 days out, red once expired — driven by `xenodroid-bw/admin/src/data/credentialRegistry.js` + `lib/credentialExpiry.js`; update `expiresOn` there on rotation, and register any future managed credential (metadata only, never key values) in the same registry. Respect published rate limits with serial pacing/backoff; prefer bulk/extract retrieval over per-entity calls where the key's tier permits, and fall back to targeted lookups for crosswalked orgs only. USAspending recipient data corroborates; IRS EO BMF/NPPES/CMS extend the spine to EIN↔NPI↔CCN, which SAM does not carry |
| `NPPES` (extend if present) | NPPES downloadable file / API | Official public | `ATTRIBUTABLE` | Organization NPI records only (entity type 2); no individual-provider promotion |

## Work packages

Effort is a planning range for one experienced full-stack/data engineer (or one
autonomous agent run with review); it is not a delivery commitment. OFR-04 may
run parallel to OFR-03. OFR-05 and OFR-06 gate on OFR-02 reconciliation tests.

| Package | Scope | Exit gate | Planning effort |
|---|---|---|---:|
| OFR-00 — Baseline checkpoint | Record clean git baseline; run full test/build/harness suite; freeze current KY/FL export schemas | All existing tests green; baseline evidence recorded | 0.5 day |
| OFR-01 — USAspending award grain | Extend the existing adapter to award/recipient grain for KY and FL recipients across the HHS/CMS assistance-listing inventory (at minimum 93.775, 93.777, 93.778, 93.791; add SAMHSA/HRSA listings that fund Medicaid-adjacent capacity); land `federal_award`; export award-expiration-horizon and single-stream-dependency aggregates; "federal funding cliff calendar" UI slice for both states | Award facts reconcile to API control totals per listing×FY; FY2026 labeled partial; existing FY-aggregate outputs unchanged or superseded with lineage | 3–5 days |
| OFR-02 — Identity crosswalk spine | `organization_crosswalk` with exact/inferred separation, confidence, evidence, validation status. **Hybrid seed order:** SAM.gov entity records are the primary UEI↔EIN authority (`exact-published`); USAspending recipient records corroborate — a SAM/USAspending disagreement is flagged for review, never silently resolved; IRS EO BMF, NPPES org records, CMS Provider Data CCNs, and CMS ownership entities extend the spine to EIN↔NPI↔CCN↔state IDs. If the SAM key is absent or expired at run time, degrade to the USAspending-seeded path and record an explicit gap | No inferred match ever presented as identity; sampled exact matches verify against published source pairs; SAM-vs-USAspending disagreement queue exported; crosswalk coverage stats exported with method breakdown | 4–7 days |
| OFR-03 — IRS 990 org financials | Ingest EO BMF (KY+FL) and annual 990 extract rows for crosswalked orgs; compute resilience ratios (government-grant dependency, months-of-net-assets liquidity, program-vs-admin expense trend); financial-resilience-review signals | Ratios reproducible from retained extract rows; zero person-level fields in any export; filing vintage and form type on every fact | 3–5 days |
| OFR-04 — Facility financial distress (HCRIS) | Hospital + SNF cost-report ingestion for KY and FL; margin/Medicaid-share/uncompensated-care facts; county-level closure-risk / access-continuity watchlist joined to licensed-bed and eligible-to-bed signals | Sampled facility rows reconcile to the published dataset; every UI value labeled Medicare-cost-report basis; FL AHCA hospital-financial Gap annotated with this federal fallback layer, not silently replaced | 4–6 days |
| OFR-05 — Ownership & control network | CMS ownership PUF + change-of-ownership ingestion; chain-level rollups of quality/penalty/staffing across commonly owned facilities; ownership-churn signals for Protect Program Integrity | Chain rollups reproducible; owner-person detail confined to PSA; every ownership signal labeled review candidate, never adverse finding | 4–6 days |
| OFR-06 — Sub-award flow graph | `federal_subaward` + `funding_edge` for state-agency prime awards; funding-concentration and program-overlap review views by county/program | Edges only between crosswalk-reconciled identities or explicitly labeled unresolved; concentration metrics carry identity-confidence caveats | 3–5 days |
| OFR-07 — Waiver & grant horizon watch | `program_horizon_event` from Medicaid.gov waiver documents (KY TEAMKY, FL MMA, 1915 authorities) and Grants.gov NOFO feed; expiration/renewal-milestone signals beside the award-cliff calendar | Every event cites source document and retrieval date; no renewal outcome predicted, only dates and published status | 2–4 days |
| OFR-08 — Funding & Resilience Evidence Room + Operational Intelligence integration | New state-aware Evidence Room (both states): filters, charts, aggregate rows, drill-down, lineage, CSV export, glossary, page guide/walkthrough per parity contract; new signals wired into the six existing goal categories with owner/authority/validation/guardrail fields; Authoritative Sources rows for all new FromSysIDs | Room passes the same gates as existing rooms; walkthrough coverage per shared sequence; no KY magnitude on FL routes and vice versa | 5–8 days |
| OFR-09 — Acceptance, evidence, and completion report | Full `npm run test` / `build` / `harness:verify`; headless then isolated-rendered verification; catalogue and README/AGENTS updates; completion-boundary report | All acceptance gates green; evidence labeled per Scriptorium classes; Director review package produced | 2–3 days |

Sequential range: approximately **31–50 engineer-days**.

## Signal portfolio by existing goal category

| Goal | New OFR signals |
|---|---|
| Optimize Spending | Program-overlap review candidates (multiple funding streams, same objective — reconcile scope/population before describing overlap); open NOFO opportunities the state could pursue |
| Improve Coverage & Access | County closure-risk watchlist (cost-report distress × licensed beds × eligible population); grant-supported capacity in shortage counties for least-cost access remediation |
| Identify Quality Gaps | Chain-level quality/penalty rollups across commonly owned facilities |
| Contract Accountability | Funding-continuity exposure for contracted-plan-adjacent organizations; waiver deliverable milestones |
| Protect Program Integrity | Ownership-churn review candidates; crosswalk-strengthened exclusion screening (still aggregate-only in UI) |
| Trend & Budget Planning | Federal funding cliff calendar (award + waiver expirations); single-stream dependency; funding concentration by county/program |

Every signal keeps the existing standard: accountable owner, authority,
intervention threshold, validation steps, source and as-of date, caveats,
expected benefit, and realized-outcome measure.

## Gates and stop conditions

1. **Licensing gate:** no DataRepublican code, packaged data, or calculated
   fields anywhere in the repository.
2. **Person-level gate:** no officer, owner-person, or any individual's name,
   birth date, or address in any warehouse export or UI surface. PSA retention
   of publisher-supplied raw files is permitted with hashes.
3. **Identity gate:** exact and inferred crosswalk assertions are separate
   collections; inferred matches are review candidates and never join facts on
   a REAL presentation path without an explicit confidence label.
4. **No-adverse-conclusion gate:** no funding amount, financial ratio,
   ownership structure, or network position is labeled waste, fraud, breach,
   distress-as-fact, or savings. Signals produce validation work, not verdicts.
5. **Credential gate:** the build must not create accounts, register API keys,
   or accept terms of service. The Director-provisioned SAM.gov key (see
   `SAM_ENTITY` row) is the sole permitted credential: loaded from the
   provided file into local env at runtime, never committed to git, never
   written to logs, PSA metadata, exports, or evidence files. Any other
   key-gated source becomes an explicit catalogue gap.
6. **Reconciliation gate:** no fact becomes `accurate` or supports a quantified
   opportunity until it reconciles to the owning published source (control
   totals, sampled row checks, or document citation as grain permits).
7. **Basis-labeling gate:** Medicare-cost-report and IRS-filing bases are
   labeled at point of use; neither is presented as Medicaid payment truth.
8. **No-fake-green gate:** blocked, key-gated, or unreconciled sources remain
   explicit Gap objects; fixtures never replace them on a REAL path.

## Acceptance gates

- `npm run test`, `npm run build`, and `npm run harness:verify` pass.
- BW TEST → thorough checks → purge → REAL ETL → accuracy sequence passes for
  every new adapter.
- Both `?state=KY` and `?state=FL` render the Funding & Resilience room and new
  signals from their own hydrations; no cross-state leakage.
- All new catalogue rows present in both state source catalogues with TOS
  grades, attribution notes, and paid follow-on TODOs.
- Evidence recorded and labeled `headless-validated` and `isolated-rendered`
  per the Scriptorium isolated UI testing standard; no visible-host session.
- Completion report distinguishes implemented, gap, and out-of-scope per layer.

## Explicit out-of-scope (paid follow-on candidates)

| Item | Why deferred |
|---|---|
| IRS 990 XML e-file corpus (officer/compensation detail) | Person-level; requires an authorized review workflow design first |
| SAM.gov exclusions API ingestion | Overlaps HHS-OIG LEIE already loaded; defer until LEIE-vs-SAM reconciliation is designed. Entity Management API is now **in scope** (key provisioned; see `SAM_ENTITY` row) |
| State accounting/eMARS or FL FLAIR payment joins to awards | Requires authority; Kentucky Transparency has no supported public API |
| Causal claims linking funding change to access/quality outcomes | Needs authorized operational grain and validated methodology |
