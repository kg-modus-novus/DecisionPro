/**
 * PSA bind filters for each authoritative FromSysID on the public REAL path.
 * Describes what DecisionPro keeps from the publisher Source of Truth and why.
 */
export const PSA_BIND_FILTERS = {
  CMS_DATA_MEDICAID_ENR: {
    mode: 'filtered',
    criteria: [
      'Geography = Kentucky when forming enrollment facts from the national PI CSV.',
      'Keep Kentucky Reporting Period values across the modern PI monthly series in the current release.',
    ],
    why: 'DecisionPro Kentucky is state-scoped. Other states’ PI rows are not used in Kentucky legislative rooms, while Kentucky’s full period depth is kept so enrollment trends stay continuous.',
  },
  CMS_DATA_MEDICAID: {
    mode: 'curated-aggregate',
    criteria: [
      'Geography = Kentucky.',
      'Bind one curated federal financial-management expenditure aggregate (not every state × program × service-category row).',
      'Use the currently published expenditure vintage available on the public table (not a synthetic multi-year KY stretch).',
    ],
    why: 'The publisher table is a large multi-state expenditure matrix. The POC needs one accurate Kentucky expenditure figure for Command Center and Cost Drivers without inventing claim-grain detail.',
  },
  CMS_MEDICAID_SCORECARD: {
    mode: 'filtered',
    criteria: [
      'Geography = Kentucky.',
      'Measures limited to WCV-CH (well-care), BCS-AD (breast cancer screening), and PPC-AD (postpartum care).',
      'Reporting years limited to published Child/Adult Core Set CSV vintages 2020–2023 (skip missing measure×year cells).',
    ],
    why: 'Those Kentucky Core Set points power Outcomes and Benchmarks rooms for maternal, child, and adult quality questions without loading every measure for every state.',
  },
  CMS_MEDICAID_PHARMACY: {
    mode: 'curated-aggregate',
    criteria: [
      'Bind one curated Kentucky Medicaid pharmacy / drug-spend program aggregate.',
      'Do not roll up national brand/generic drug rows into a Kentucky total.',
    ],
    why: 'CMS Spending by Drug is national drug-level. Rolling those rows into a Kentucky program total would invent attribution the publisher does not provide.',
  },
  KY_DMS_COUNTY_COUNTS: {
    mode: 'document-select',
    criteria: [
      'Documents = verified recent monthly county PDFs (2024-01 and 2025-01).',
      'Extract the published Total Members column for Kentucky counties from those PDFs.',
    ],
    why: 'The fuller DMS archive is not fully inventory-confirmed on the public path. Two verified months give county grain for legislative district views without inventing missing months.',
  },
  CENSUS_ACS: {
    mode: 'filtered',
    criteria: [
      'Geography = Kentucky.',
      'Series = Uninsured share of total population (ACS-based KFF State Health Facts extract).',
      'Years = CY2016–2019 and CY2021–2024 (skip 2020, which is absent from the published tool).',
    ],
    why: 'Demographic context for Kentucky only. Loading all 51 geographies and every coverage category would inflate PSA without helping KY legislative rooms.',
  },
  KY_DMS_MCO_CONTRACTS: {
    mode: 'full-of-scope',
    criteria: [
      'Source page = Kentucky DMS managed-care contracts roster.',
      'Include active contracted plans plus the documented Anthem exit event.',
    ],
    why: 'The publisher roster is already Kentucky-specific and small. DecisionPro lands the full in-scope roster rather than a further geographic filter.',
  },
  KY_DMS_MCO_EVAL: {
    mode: 'document-select',
    criteria: [
      'Primary document = FY2025 Comprehensive Evaluation Summary PDF.',
      'Bind evaluation metadata / theme context from that summary (not a full parse of every Quality Branch PDF).',
    ],
    why: 'Withholding dollars are not structured open data. The summary PDF supplies MCO evaluation context for Accountability rooms without pretending every linked PDF is machine-loaded.',
  },
  KY_DMS_PROVIDER_DIR: {
    mode: 'document-select',
    criteria: [
      'Bind the Provider Directory portal inventory event (state + MCO find-a-provider directories present).',
      'Do not scrape provider-row / NPI-level contents from inside those search tools.',
    ],
    why: 'Provider cardinality lives inside interactive directories, not a downloadable public table. The POC records that the directories exist for Delivery-System context.',
  },
  KY_DMS_FEE_SCHEDULE: {
    mode: 'document-select',
    criteria: [
      'Bind one physician fee-schedule revision / availability event.',
      'Do not land every rate line from all 41 fee/rate PDFs.',
    ],
    why: 'Current legislative tiles need schedule presence and revision context, not a full fee-line warehouse on the public POC path.',
  },
  KY_LRC_RECORD: {
    mode: 'document-select',
    criteria: [
      'Bills / pages limited to maternal and Medicaid touchpoints used for context measures (HB 487 subject index, postpartum sponsor page, HB 2).',
      'Do not land the full Legislative Record corpus.',
    ],
    why: 'Bill-readiness context only needs the verified maternal/Medicaid touchpoint set. The full LRC archive is far larger than this POC scope.',
  },
  HRSA_AHRF: {
    mode: 'none',
    criteria: ['No PSA bind on the public POC path yet (catalogued only).'],
    why: 'AHRF files are large periodic releases and are not auto-loaded until a Director-authorized Data Request binds them.',
  },
  AHRQ_HCUP: {
    mode: 'none',
    criteria: ['No PSA bind on the public POC path (blocked / licensed microdata).'],
    why: 'HCUP encounter microdata requires license or DUA access outside the public accurate path.',
  },
};

export function getPsaBindFilter(fromSysId) {
  return PSA_BIND_FILTERS[fromSysId] || null;
}
