/**
 * Detailed briefings for Explicit Gap tiles (Authoritative sources).
 * Soft product interpretation aligned to the KY Medicaid source catalogue —
 * not a Director-signed commercial SOW. No PHI.
 *
 * "Paid / DUA follow-on" = work beyond free public-web scrape: license, DUA,
 * DMS-authorized feeds, or commercial warehouse build to land LoadClass=REAL.
 */

/** @typedef {{
 *  whatItIs: string,
 *  whyUseful: string,
 *  publisher: string,
 *  cadence: string,
 *  detailLevel: string,
 *  accessConditions: string,
 *  whoRequests: string,
 *  incorporateSteps: string[],
 *  dashboardImpact: string,
 *  relatedFromSysIds?: string[],
 * }} GapBriefing */

/** @type {Record<string, GapBriefing>} */
export const GAP_BRIEFINGS = {
  'GAP-AVOIDABLE-ED': {
    whatItIs:
      'Counts or rates of emergency-department visits that meet a published potentially-avoidable / ambulatory-care-sensitive definition for Kentucky Medicaid members (aggregate, never person-level in DecisionPro).',
    whyUseful:
      'Utilization and Legislative Command Center views need a KY-Medicaid-specific avoidable-ED signal to discuss access, primary-care gaps, and low-value acute use — public Scorecard/Core Set alone does not replace an encounter-based or licensed KY HCUP aggregate.',
    publisher:
      'Preferred: Kentucky DMS / MCO encounter warehouses under DMS authority. Alternate: AHRQ HCUP (KY SEDD aggregates) where licensed or freely published state tables exist.',
    cadence: 'Typically monthly or quarterly for encounter algorithms; annual for many HCUP state files.',
    detailLevel:
      'Aggregate by region, MCO, population, and period. Not claim-line browse; not member-identifiable.',
    accessConditions:
      'Encounter path requires DMS/MCO authorization and usually a DUA. HCUP SID/SEDD microdata is typically RESTRICTED (license); free published KY tables may be usable if redistribution is allowed.',
    whoRequests:
      'DecisionPro / XenoDroid product owner with Director approval, routed through DMS data governance (and AHRQ HCUP Central Distributor if using licensed HCUP).',
    incorporateSteps: [
      'Director scopes the measure definition (algorithm or published table vintage).',
      'Execute DUA / HCUP license or DMS feed agreement as required.',
      'Add or extend a Data Request in XenoDroid BW; land PSA → Cleanse → Cube as LoadClass=REAL.',
      'Export room cubes / blender findings; remove the GAP stub from Utilization.',
      'Label refresh date, definition owner, and known limitations on the object page.',
    ],
    dashboardImpact:
      'Utilization tiles and blender findings gain a REAL avoidable-ED magnitude instead of an Explicit Gap; hearing-ready charts can show trend and MCO/region slices with provenance.',
    relatedFromSysIds: ['AHRQ_HCUP', 'KY_DMS_MCO_CONTRACTS'],
  },
  'GAP-CLAIMS-COST-DRIVERS': {
    whatItIs:
      'Claim- or encounter-grain cost drivers rolled to service category × population (and related slices) for Kentucky Medicaid — the operational cost SoT behind Command Center and Cost Drivers rooms.',
    whyUseful:
      'Federal published expenditure totals (e.g. CMS financial management) are too coarse for legislative “where did the money go?” questions by service and eligibility group.',
    publisher: 'Kentucky DMS and contracted MCOs (encounter and FFS paid amounts) under DMS authority.',
    cadence: 'Monthly warehouse refresh is the usual target; lag depends on encounter completeness.',
    detailLevel:
      'Aggregate cubes by service, population, MCO, region, and period. DecisionPro surfaces remain de-identified aggregates.',
    accessConditions:
      'Not available from public web alone. Requires DMS/MCO authorized feeds plus DUA (or equivalent data-sharing agreement).',
    whoRequests:
      'Director-authorized DecisionPro engagement with DMS data owners / MCO data stewards named in the DUA.',
    incorporateSteps: [
      'Negotiate DUA and feed specs (paid amounts, service taxonomy, population keys).',
      'Stand up retrieve/load Data Requests; map to Cost Drivers / Command Center measures.',
      'Validate against published federal totals where useful as reasonableness checks.',
      'Export REAL cubes; retire GAP-CLAIMS-COST-DRIVERS placeholders.',
    ],
    dashboardImpact:
      'Cost Drivers and Command Center show REAL PMPM / dollar magnitudes with provenance instead of gap tiles; blender options can weight true cost pressure.',
    relatedFromSysIds: ['CMS_DATA_MEDICAID'],
  },
  'GAP-HD-EXPENDITURE': {
    whatItIs:
      'Medicaid expenditure (or paid amount) rollups by Kentucky House district for legislative geography questions.',
    whyUseful:
      'Members and staff often ask spend by district; public county enrollment is a substitute denominator, not a district expenditure SoT.',
    publisher: 'Kentucky DMS geographic claims/encounter aggregates (crosswalk member/provider geo → House district under DMS rules).',
    cadence: 'Monthly or quarterly, aligned to claims completeness windows.',
    detailLevel: 'District × period aggregates; suppression rules for small cells as required by DMS.',
    accessConditions: 'Requires geographic claims aggregates under DMS authority; not reconstructable from open enrollment PDFs alone.',
    whoRequests: 'Director → DMS analytics / Research and Analytics Branch (or named data steward) under DUA.',
    incorporateSteps: [
      'Agree district crosswalk and suppression policy with DMS.',
      'Land authorized geo spend feed as REAL.',
      'Wire County / district room rows; keep county enrollment as complementary public context.',
    ],
    dashboardImpact:
      'County/district views show REAL district spend (or clearly labeled DMS aggregates) instead of GAP-HD-EXPENDITURE.',
    relatedFromSysIds: ['KY_DMS_COUNTY_COUNTS'],
  },
  'GAP-HEDIS-SPEC': {
    whatItIs:
      'Full NCQA HEDIS measure specification text and value sets needed to republish proprietary definition detail inside DecisionPro.',
    whyUseful:
      'Measure Definitions and Benchmarks rooms need precise specs when comparing MCO quality language; public Medicaid Core Set / Scorecard text covers only the public subset.',
    publisher: 'NCQA (HEDIS). Public CMS Core Set / Scorecard remain the SAFE path for published rates.',
    cadence: 'Annual HEDIS measurement year updates; Core Set/Scorecard follow CMS publish cycles.',
    detailLevel: 'Specification-level (value sets, continuous enrollment, exclusions) — not member results.',
    accessConditions:
      'HEDIS specification republication is typically RESTRICTED without an NCQA license. Public Core Set measure text and Scorecard rates may be used with attribution.',
    whoRequests: 'DecisionPro product / Director for NCQA licensing if full spec library is required.',
    incorporateSteps: [
      'Decide whether public Core Set/Scorecard text is sufficient for the POC.',
      'If not, procure NCQA license for the measure library.',
      'Point Measure Definitions at licensed content or keep Scorecard-only definitions; never mirror proprietary specs without license.',
    ],
    dashboardImpact:
      'Definitions room can show licensed HEDIS language where needed; otherwise continues with public Core Set/Scorecard provenance only.',
    relatedFromSysIds: ['CMS_MEDICAID_SCORECARD'],
  },
  'GAP-MCO-WITHHOLDING-DOLLARS': {
    whatItIs:
      'Dollar amounts of MCO quality withholds not earned back (or related financial performance outcomes) by plan and contract year.',
    whyUseful:
      'MCO Accountability needs financial teeth behind quality themes; public EQRO/evaluation PDFs flag themes but rarely publish structured withhold dollars.',
    publisher: 'Kentucky DMS managed-care contract performance / financial files.',
    cadence: 'Annual (contract / evaluation cycle), sometimes mid-year adjustments.',
    detailLevel: 'MCO × FY (or contract period) dollar aggregates — not member-level.',
    accessConditions: 'Requires DMS release of contract performance financial files; not open-web structured data today.',
    whoRequests: 'Director-authorized request to DMS Division of Health Plan Oversight / Quality partners named in the agreement.',
    incorporateSteps: [
      'Obtain structured withhold outcome files or tables under DMS authority.',
      'Map to MCO room measures; keep EQRO PDF themes as complementary ATTRIBUTABLE context.',
      'Export REAL MCO financial rows; clear GAP-MCO-WITHHOLDING-DOLLARS.',
    ],
    dashboardImpact:
      'MCO room and blender findings show REAL withhold dollars with contract provenance instead of a gap stub.',
    relatedFromSysIds: ['KY_DMS_MCO_EVAL', 'KY_DMS_MCO_CONTRACTS'],
  },
  'GAP-PROVIDER-RISK-ADJ': {
    whatItIs:
      'Risk-adjusted provider (or provider-group) performance indicators built from KY payment/encounter data and an agreed risk model.',
    whyUseful:
      'Provider room oversight questions need apples-to-apples performance, not raw volume; public directories alone cannot risk-adjust paid outcomes.',
    publisher: 'Kentucky DMS / MCO payment and encounter warehouses; risk model owner as named in the engagement.',
    cadence: 'Quarterly or annual performance periods, depending on DMS program design.',
    detailLevel:
      'Provider or group aggregates with suppression; DecisionPro does not expose PHI or member lists.',
    accessConditions: 'DUA (or equivalent) for payment/encounter extracts plus approved risk methodology.',
    whoRequests: 'Director → DMS provider/payment data stewards and analytics leads under DUA.',
    incorporateSteps: [
      'Agree risk model, peer groups, and suppression.',
      'Land authorized extracts; compute aggregates off-portal or in BW.',
      'Publish REAL provider-room rows with methodology limitations.',
    ],
    dashboardImpact:
      'Provider room shows risk-adjusted REAL metrics instead of GAP-PROVIDER-RISK-ADJ.',
    relatedFromSysIds: ['KY_DMS_PROVIDER_DIR', 'KY_DMS_FEE_SCHEDULE'],
  },
  'GAP-RURAL-DISTANCE': {
    whatItIs:
      'Average distance (or travel burden) from members to used or assigned care sites for rural Kentucky Medicaid populations.',
    whyUseful:
      'Utilization and access debates need miles-to-care evidence; public provider directories prove listings exist, not realized travel distance from utilization.',
    publisher: 'Authorized KY claims/encounter geo plus network adequacy feeds under DMS/MCO authority.',
    cadence: 'Quarterly recommended; depends on encounter lag and geo refresh.',
    detailLevel: 'Region / rural-urban / MCO aggregates — never member address browse in the UI.',
    accessConditions: 'Claims geo and network files are not public; require authorized feeds and privacy review.',
    whoRequests: 'Director-authorized DecisionPro work with DMS/MCO network and encounter data owners.',
    incorporateSteps: [
      'Define distance metric (e.g. member centroid → rendering NPI) and rural filter.',
      'Land geo feeds under DUA; compute aggregates in BW.',
      'Replace Utilization GAP-RURAL-DISTANCE with REAL rows and method notes.',
    ],
    dashboardImpact:
      'Utilization shows REAL rural distance signals for legislative access questions, with clear methodology limits.',
    relatedFromSysIds: ['KY_DMS_PROVIDER_DIR'],
  },
};

export function briefingForGapId(gapId) {
  return GAP_BRIEFINGS[gapId] || null;
}
