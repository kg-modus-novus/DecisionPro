/** Fixture catalog for Phase-1 admin wireframe (not live Postgres). */

export const SOURCE_SYSTEMS = [
  {
    id: 'CMS_DATA_MEDICAID_ENR',
    technicalName: 'CMS_DATA_MEDICAID_ENR',
    publisher: 'CMS / data.medicaid.gov',
    tosGrade: 'SAFE',
    baseUri: 'https://download.medicaid.gov/data/pi-dataset-june-2026-release.csv',
    status: 'active',
  },
  {
    id: 'KY_DMS_MCO_CONTRACTS',
    technicalName: 'KY_DMS_MCO_CONTRACTS',
    publisher: 'Kentucky CHFS / DMS',
    tosGrade: 'ATTRIBUTABLE',
    baseUri: 'https://chfs.ky.gov/agencies/dms/dhpo/Pages/mco-contracts.aspx',
    status: 'active',
  },
  {
    id: 'TEST_FIXTURE_PACK',
    technicalName: 'TEST_FIXTURE_PACK',
    publisher: 'DecisionPro TEST',
    tosGrade: 'SAFE',
    baseUri: 'xenodroid-bw/src/fixtures/',
    status: 'test-only',
  },
];

/** InfoProviders in DecisionPro BW (Detail DSO, Cube, Query). */
export const INFO_PROVIDERS = [
  {
    id: 'DSO_ENROLLMENT_STATE',
    technicalName: 'DSO_ENROLLMENT_STATE',
    type: 'detailDso',
    typeLabel: 'Detail DSO',
    description: 'KY Medicaid & CHIP enrollment by period',
    measures: ['M-001', 'M-002'],
    dataFlowId: 'enrollment',
    status: 'active',
    rowCount: 107,
    loadClass: 'REAL',
  },
  {
    id: 'DSO_MCO_ROSTER',
    technicalName: 'DSO_MCO_ROSTER',
    type: 'detailDso',
    typeLabel: 'Detail DSO',
    description: 'KY DMS MCO contract roster',
    measures: ['M-007'],
    dataFlowId: 'mco',
    status: 'active',
    rowCount: 6,
    loadClass: 'REAL',
  },
  {
    id: 'CUBE_EXEC_LANDING',
    technicalName: 'CUBE_EXEC_LANDING',
    type: 'cube',
    typeLabel: 'Cube',
    description: 'Executive accurate-path aggregate for DecisionPro landing',
    measures: ['M-001', 'M-002', 'M-007'],
    dataFlowId: 'enrollment',
    status: 'active',
    rowCount: 3,
    loadClass: 'REAL',
  },
  {
    id: 'Q_LANDING_ACCURATE',
    technicalName: 'Q_LANDING_ACCURATE',
    type: 'report',
    typeLabel: 'Query',
    description: 'Accurate Path query / export surface → DecisionPro UI',
    measures: ['M-001', 'M-002', 'M-007'],
    dataFlowId: 'enrollment',
    status: 'active',
    rowCount: null,
    loadClass: 'REAL',
  },
];

/** InfoObjects — characteristics and key figures used on accurate path. */
export const INFO_OBJECTS = [
  {
    id: '0STATE_CODE',
    technicalName: '0STATE_CODE',
    kind: 'characteristic',
    description: 'US state code',
    dataType: 'CHAR(2)',
    usedBy: ['DSO_ENROLLMENT_STATE', 'DSO_MCO_ROSTER', 'CUBE_EXEC_LANDING'],
    status: 'active',
  },
  {
    id: '0PERIOD_YM',
    technicalName: '0PERIOD_YM',
    kind: 'characteristic',
    description: 'Reporting period YYYYMM',
    dataType: 'NUMC(6)',
    usedBy: ['DSO_ENROLLMENT_STATE', 'CUBE_EXEC_LANDING'],
    status: 'active',
  },
  {
    id: '0AS_OF_DATE',
    technicalName: '0AS_OF_DATE',
    kind: 'characteristic',
    description: 'As-of calendar date for provenance',
    dataType: 'DATS',
    usedBy: ['DSO_ENROLLMENT_STATE', 'CUBE_EXEC_LANDING', 'Q_LANDING_ACCURATE'],
    status: 'active',
  },
  {
    id: '0FROM_SYS_ID',
    technicalName: '0FROM_SYS_ID',
    kind: 'characteristic',
    description: 'Source system technical id',
    dataType: 'CHAR(32)',
    usedBy: ['PSA', 'DSO_ENROLLMENT_STATE', 'DSO_MCO_ROSTER'],
    status: 'active',
  },
  {
    id: '0LOAD_CLASS',
    technicalName: '0LOAD_CLASS',
    kind: 'characteristic',
    description: 'TEST vs REAL load class',
    dataType: 'CHAR(8)',
    usedBy: ['All accurate-path providers'],
    status: 'active',
  },
  {
    id: 'ZMCO_NAME',
    technicalName: 'ZMCO_NAME',
    kind: 'characteristic',
    description: 'Managed care organization name',
    dataType: 'CHAR(80)',
    usedBy: ['DSO_MCO_ROSTER'],
    status: 'active',
  },
  {
    id: 'ZMCO_STATUS',
    technicalName: 'ZMCO_STATUS',
    kind: 'characteristic',
    description: 'MCO status (active / exited)',
    dataType: 'CHAR(16)',
    usedBy: ['DSO_MCO_ROSTER'],
    status: 'active',
  },
  {
    id: 'ZTOT_ENROLL',
    technicalName: 'ZTOT_ENROLL',
    kind: 'keyFigure',
    description: 'Total Medicaid & CHIP enrollment (M-001)',
    dataType: 'DEC',
    unit: 'persons',
    measureId: 'M-001',
    usedBy: ['DSO_ENROLLMENT_STATE', 'CUBE_EXEC_LANDING'],
    status: 'active',
  },
  {
    id: 'ZYOY_ENR_PCT',
    technicalName: 'ZYOY_ENR_PCT',
    kind: 'keyFigure',
    description: 'YoY enrollment change % (M-002)',
    dataType: 'DEC',
    unit: 'percent',
    measureId: 'M-002',
    usedBy: ['CUBE_EXEC_LANDING'],
    status: 'active',
  },
  {
    id: 'ZACTIVE_MCO_CNT',
    technicalName: 'ZACTIVE_MCO_CNT',
    kind: 'keyFigure',
    description: 'Active MCO roster count (M-007)',
    dataType: 'INT4',
    unit: 'count',
    measureId: 'M-007',
    usedBy: ['CUBE_EXEC_LANDING'],
    status: 'active',
  },
];

/** DataSources — extract definitions bound to Source Systems / PSA. */
export const DATA_SOURCES = [
  {
    id: 'DS_CMS_PI_ENROLLMENT',
    technicalName: 'DS_CMS_PI_ENROLLMENT',
    sourceSystemId: 'CMS_DATA_MEDICAID_ENR',
    psa: 'PSA_CMS_DATA_MEDICAID_ENR',
    description: 'CMS PI Medicaid & CHIP enrollment CSV',
    tosGrade: 'SAFE',
    status: 'active',
    loadClass: 'REAL',
    dataRequestId: 'DR-REAL-PI-ENROLLMENT',
    dataFlowId: 'enrollment',
  },
  {
    id: 'DS_KY_MCO_CONTRACTS',
    technicalName: 'DS_KY_MCO_CONTRACTS',
    sourceSystemId: 'KY_DMS_MCO_CONTRACTS',
    psa: 'PSA_KY_DMS_MCO_CONTRACTS',
    description: 'Curated KY DMS MCO contract roster',
    tosGrade: 'ATTRIBUTABLE',
    status: 'active',
    loadClass: 'REAL',
    dataRequestId: 'DR-REAL-MCO-ROSTER',
    dataFlowId: 'mco',
  },
  {
    id: 'DS_PUBLIC_HYDRATION',
    technicalName: 'DS_PUBLIC_HYDRATION',
    sourceSystemId: 'MULTI',
    psa: 'PSA_PUBLIC_HYDRATION',
    description: 'Public hydration pack (county / expenditure / etc.)',
    tosGrade: 'MIXED',
    status: 'active',
    loadClass: 'REAL',
    dataRequestId: 'DR-REAL-PUBLIC-HYDRATION',
    dataFlowId: null,
  },
  {
    id: 'DS_TEST_FIXTURE_PACK',
    technicalName: 'DS_TEST_FIXTURE_PACK',
    sourceSystemId: 'TEST_FIXTURE_PACK',
    psa: 'PSA_TEST_FIXTURE_PACK',
    description: 'Synthetic TEST extracts for accuracy gate',
    tosGrade: 'SAFE',
    status: 'test-only',
    loadClass: 'TEST',
    dataRequestId: 'DR-TEST-ENROLLMENT',
    dataFlowId: null,
  },
];

export const LOAD_HISTORY = [
  {
    id: 'LH-REAL-ENR-001',
    dataRequestId: 'DR-REAL-PI-ENROLLMENT',
    status: 'SUCCEEDED',
    loadClass: 'REAL',
    rowCount: 107,
    asOfDate: '2026-03-31',
    completedAt: '2026-08-01T15:42:03Z',
  },
  {
    id: 'LH-REAL-MCO-001',
    dataRequestId: 'DR-REAL-MCO-ROSTER',
    status: 'SUCCEEDED',
    loadClass: 'REAL',
    rowCount: 6,
    asOfDate: '2025-01-01',
    completedAt: '2026-08-01T15:42:04Z',
  },
  {
    id: 'LH-PURGE-001',
    dataRequestId: 'DR-PURGE-TEST',
    status: 'PURGED',
    loadClass: 'TEST',
    rowCount: 8,
    asOfDate: null,
    completedAt: '2026-08-01T15:41:50Z',
  },
];

/**
 * Catalog of data flows known to DecisionPro BW (fixture list).
 * `canvasId` links to DATA_FLOWS when a graph is modeled; planned rows have null.
 */
export const DATA_FLOW_CATALOG = [
  {
    id: 'enrollment',
    technicalName: 'DF_KY_ENROLLMENT_ACCURATE',
    title: 'KY Enrollment Accurate Path',
    description: 'CMS PI → DSO_ENROLLMENT_STATE → CUBE_EXEC_LANDING → accurate landing',
    status: 'active',
    loadClass: 'REAL',
    lastLoadStatus: 'SUCCEEDED',
    lastLoadAt: '2026-08-01T15:42:03Z',
    asOfDate: '2026-03-31',
    measures: ['M-001', 'M-002'],
    sourceSystem: 'CMS_DATA_MEDICAID_ENR',
    targetCube: 'CUBE_EXEC_LANDING',
    targetReport: 'Q_LANDING_ACCURATE',
    dataRequestId: 'DR-REAL-PI-ENROLLMENT',
    canvasId: 'enrollment',
  },
  {
    id: 'mco',
    technicalName: 'DF_KY_MCO_ROSTER',
    title: 'MCO Roster Path',
    description: 'KY DMS contracts → DSO_MCO_ROSTER → CUBE_EXEC_LANDING (M-007)',
    status: 'active',
    loadClass: 'REAL',
    lastLoadStatus: 'SUCCEEDED',
    lastLoadAt: '2026-08-01T15:42:04Z',
    asOfDate: '2025-01-01',
    measures: ['M-007'],
    sourceSystem: 'KY_DMS_MCO_CONTRACTS',
    targetCube: 'CUBE_EXEC_LANDING',
    targetReport: 'Q_LANDING_ACCURATE',
    dataRequestId: 'DR-REAL-MCO-ROSTER',
    canvasId: 'mco',
  },
  {
    id: 'public-hydration',
    technicalName: 'DF_KY_PUBLIC_HYDRATION',
    title: 'Public Hydration Pack',
    description: 'Broader public extracts via DR-REAL-PUBLIC-HYDRATION (operator pack)',
    status: 'active',
    loadClass: 'REAL',
    lastLoadStatus: 'SUCCEEDED',
    lastLoadAt: '2026-08-01T17:04:16Z',
    asOfDate: '2025-01-01',
    measures: ['M-003', 'M-004', 'M-010', 'M-011', 'M-012'],
    sourceSystem: 'MULTI',
    targetCube: 'CUBE_EXEC_LANDING',
    targetReport: 'Q_LANDING_ACCURATE',
    dataRequestId: 'DR-REAL-PUBLIC-HYDRATION',
    canvasId: 'public-hydration',
    note: 'Multi-source REAL pack → CUBE_EXEC_LANDING / room facts',
  },
  {
    id: 'county',
    technicalName: 'DF_KY_COUNTY_ENROLLMENT',
    title: 'County Enrollment (planned)',
    description: 'Provisional M-003 dedicated path — measure catalog only until modeled',
    status: 'planned',
    loadClass: null,
    lastLoadStatus: null,
    lastLoadAt: null,
    asOfDate: null,
    measures: ['M-003'],
    sourceSystem: 'KY_DMS_COUNTY_COUNTS',
    targetCube: 'CUBE_EXEC_LANDING',
    targetReport: 'Q_LANDING_ACCURATE',
    dataRequestId: null,
    canvasId: null,
    note: 'Planned — no dedicated Data Flow graph yet',
  },
  {
    id: 'expenditure',
    technicalName: 'DF_KY_EXPENDITURE',
    title: 'Federal Expenditure (planned)',
    description: 'Provisional M-004 / M-005 / M-006 path',
    status: 'planned',
    loadClass: null,
    lastLoadStatus: null,
    lastLoadAt: null,
    asOfDate: null,
    measures: ['M-004', 'M-005', 'M-006'],
    sourceSystem: 'CMS_DATA_MEDICAID',
    targetCube: 'CUBE_EXEC_LANDING',
    targetReport: 'Q_LANDING_ACCURATE',
    dataRequestId: null,
    canvasId: null,
    note: 'Planned — no dedicated Data Flow graph yet',
  },
  {
    id: 'scorecard',
    technicalName: 'DF_KY_SCORECARD',
    title: 'Core Set / Scorecard (planned)',
    description: 'Provisional M-009 quality transparency path',
    status: 'planned',
    loadClass: null,
    lastLoadStatus: null,
    lastLoadAt: null,
    asOfDate: null,
    measures: ['M-010', 'M-011', 'M-012'],
    sourceSystem: 'CMS_MEDICAID_SCORECARD',
    targetCube: 'CUBE_EXEC_LANDING',
    targetReport: 'Q_LANDING_ACCURATE',
    dataRequestId: null,
    canvasId: null,
    note: 'Planned — no dedicated Data Flow graph yet',
  },
];

/** Node positions are relative layout units; canvas maps them for bottom-up vs LTR. */
export const DATA_FLOWS = {
  enrollment: {
    id: 'enrollment',
    title: 'KY Enrollment Accurate Path',
    subtitle: 'PSA → Report · DecisionPro XenoDroid BW',
    nodes: [
      {
        id: 'psa-enr',
        type: 'psa',
        technicalName: 'PSA_CMS_DATA_MEDICAID_ENR',
        titleKey: 'psa',
        title: 'PSA · CMS enrollment',
        meta: 'FromSysID CMS_DATA_MEDICAID_ENR · REAL',
        status: 'completed',
        detail: {
          layer: 'PSA',
          fromSysId: 'CMS_DATA_MEDICAID_ENR',
          loadClass: 'REAL',
          objectKey: 'psa/CMS_DATA_MEDICAID_ENR/REAL/…/pi.csv',
          rows: 'file land',
        },
      },
      {
        id: 'trfn-enr',
        type: 'transformation',
        technicalName: 'TRFN_ENR_CLEANSE',
        titleKey: 'transformation',
        title: 'TRFN_ENR_CLEANSE',
        meta: 'Dedupe period · attach AsOfDate',
        status: 'completed',
        detail: {
          layer: 'Transformation',
          rules: 'Direct map + period quality preference (Updated/Final)',
          loadClass: 'REAL',
        },
      },
      {
        id: 'dso-enr',
        type: 'detailDso',
        technicalName: 'DSO_ENROLLMENT_STATE',
        titleKey: 'detailDso',
        title: 'DSO_ENROLLMENT_STATE',
        meta: '107 periods · KY',
        status: 'completed',
        detail: {
          layer: 'Detail DSO',
          table: 'bw_dso.dso_enrollment_state',
          rowCount: 107,
          loadClass: 'REAL',
        },
      },
      {
        id: 'dtp-enr',
        type: 'dtp',
        technicalName: 'DTP_DSO_TO_CUBE_ENR',
        titleKey: 'dtp',
        title: 'DTP_DSO_TO_CUBE_ENR',
        meta: 'Last run SUCCEEDED',
        status: 'active',
        detail: {
          layer: 'DTP',
          source: 'DSO_ENROLLMENT_STATE',
          target: 'CUBE_EXEC_LANDING',
          filter: 'load_class = REAL',
          status: 'SUCCEEDED',
        },
      },
      {
        id: 'cube-enr',
        type: 'cube',
        technicalName: 'CUBE_EXEC_LANDING',
        titleKey: 'cube',
        title: 'CUBE_EXEC_LANDING',
        meta: 'M-001 · M-002',
        status: 'upcoming',
        detail: {
          layer: 'Cube',
          measures: ['M-001', 'M-002'],
          loadClass: 'REAL',
        },
      },
      {
        id: 'report-enr',
        type: 'report',
        technicalName: 'Q_LANDING_ACCURATE',
        titleKey: 'infoProvider',
        title: 'DecisionPro Accurate Path',
        meta: 'Role home export',
        status: 'upcoming',
        detail: {
          layer: 'Query / Report',
          export: 'accurateLanding.js',
          ui: 'http://localhost:5040/',
        },
      },
    ],
  },
  mco: {
    id: 'mco',
    title: 'MCO Roster Path',
    subtitle: 'KY DMS contracts · ATTRIBUTABLE',
    nodes: [
      {
        id: 'psa-mco',
        type: 'psa',
        technicalName: 'PSA_KY_DMS_MCO_CONTRACTS',
        titleKey: 'psa',
        title: 'PSA · MCO contracts',
        meta: 'Curated roster extract',
        status: 'completed',
        detail: { layer: 'PSA', fromSysId: 'KY_DMS_MCO_CONTRACTS', loadClass: 'REAL' },
      },
      {
        id: 'trfn-mco',
        type: 'transformation',
        technicalName: 'TRFN_MCO_ROSTER',
        titleKey: 'transformation',
        title: 'TRFN_MCO_ROSTER',
        meta: 'Active vs exited',
        status: 'completed',
        detail: { layer: 'Transformation', rules: 'Status normalize · effective dating' },
      },
      {
        id: 'dso-mco',
        type: 'detailDso',
        technicalName: 'DSO_MCO_ROSTER',
        titleKey: 'detailDso',
        title: 'DSO_MCO_ROSTER',
        meta: '6 rows',
        status: 'active',
        detail: { layer: 'Detail DSO', table: 'bw_dso.dso_mco_roster', rowCount: 6 },
      },
      {
        id: 'dtp-mco',
        type: 'dtp',
        technicalName: 'DTP_MCO_TO_CUBE',
        titleKey: 'dtp',
        title: 'DTP_MCO_TO_CUBE',
        meta: 'Pending refresh',
        status: 'upcoming',
        detail: { layer: 'DTP', target: 'CUBE_EXEC_LANDING', measure: 'M-007' },
      },
      {
        id: 'cube-mco',
        type: 'cube',
        technicalName: 'CUBE_EXEC_LANDING',
        titleKey: 'cube',
        title: 'CUBE_EXEC_LANDING',
        meta: 'M-007',
        status: 'upcoming',
        detail: { layer: 'Cube', measures: ['M-007'] },
      },
      {
        id: 'report-mco',
        type: 'report',
        technicalName: 'Q_LANDING_ACCURATE',
        titleKey: 'infoProvider',
        title: 'DecisionPro Accurate Path',
        meta: 'Role home export',
        status: 'upcoming',
        detail: { layer: 'Query / Report', export: 'accurateLanding.js' },
      },
    ],
  },
  'public-hydration': {
    id: 'public-hydration',
    title: 'Public Hydration Pack',
    subtitle: 'Multi-source REAL pack → cube_exec_landing / cube_room_row',
    nodes: [
      {
        id: 'psa-hyd',
        type: 'psa',
        technicalName: 'PSA_PUBLIC_HYDRATION',
        titleKey: 'psa',
        title: 'PSA · Public hydration',
        meta: 'Shared pack land',
        status: 'completed',
        detail: { layer: 'PSA', fromSysId: 'MULTI', loadClass: 'REAL' },
      },
      {
        id: 'trfn-hyd',
        type: 'transformation',
        technicalName: 'TRFN_PUBLIC_HYDRATION',
        titleKey: 'transformation',
        title: 'TRFN_PUBLIC_HYDRATION',
        meta: 'Pack normalize · gap objects',
        status: 'completed',
        detail: { layer: 'Transformation' },
      },
      {
        id: 'dso-hyd',
        type: 'detailDso',
        technicalName: 'CUBE_ROOM_ROW',
        titleKey: 'detailDso',
        title: 'CUBE_ROOM_ROW (room facts)',
        meta: 'Room-oriented detail surface',
        status: 'completed',
        detail: { layer: 'Detail DSO', table: 'bw_cube.cube_room_row' },
      },
      {
        id: 'dtp-hyd',
        type: 'dtp',
        technicalName: 'DTP_HYDRATION_TO_CUBE',
        titleKey: 'dtp',
        title: 'DTP_HYDRATION_TO_CUBE',
        meta: 'Landing + room binds',
        status: 'active',
        detail: { layer: 'DTP', target: 'CUBE_EXEC_LANDING' },
      },
      {
        id: 'cube-hyd',
        type: 'cube',
        technicalName: 'CUBE_EXEC_LANDING',
        titleKey: 'cube',
        title: 'CUBE_EXEC_LANDING',
        meta: 'M-003 · M-004 · Core Set',
        status: 'upcoming',
        detail: { layer: 'Cube', measures: ['M-003', 'M-004', 'M-010', 'M-011', 'M-012'] },
      },
      {
        id: 'report-hyd',
        type: 'report',
        technicalName: 'Q_LANDING_ACCURATE',
        titleKey: 'infoProvider',
        title: 'DecisionPro Accurate Path',
        meta: 'Role home export',
        status: 'upcoming',
        detail: { layer: 'Query / Report', export: 'accurateLanding.js' },
      },
    ],
  },
};

export const PROCESS_CHAIN = {
  id: 'PC_POC_ACCURACY_GATE',
  title: 'POC Accuracy Gate',
  steps: [
    { id: 's1', title: 'Start', status: 'completed', meta: 'Operator' },
    { id: 's2', title: 'Load TEST fixtures', status: 'completed', meta: 'DR-TEST-*' },
    { id: 's3', title: 'Thorough tests', status: 'completed', meta: 'parser + DB assert' },
    { id: 's4', title: 'Purge TEST', status: 'completed', meta: 'PurgeTestLoads' },
    { id: 's5', title: 'Empty check', status: 'active', meta: 'VerifyWarehouseEmptyOfTest' },
    { id: 's6', title: 'REAL ETL', status: 'upcoming', meta: 'DR-REAL-*' },
    { id: 's7', title: 'Refresh cubes', status: 'upcoming', meta: 'CUBE_EXEC_LANDING' },
    { id: 's8', title: 'Export UI', status: 'upcoming', meta: 'accurateLanding.js' },
    { id: 's9', title: 'End', status: 'upcoming', meta: 'Gate complete' },
  ],
};

export const CONTEXT_ACTIONS = {
  psa: ['Display Data', 'Show Lineage', 'Edit DataSource', 'Open Source System'],
  transformation: [
    'Show Field Mapping',
    'Display',
    'Edit',
    'Modify Rules',
    'Check',
    'Activate',
    'Display Data',
    'Where-Used',
  ],
  detailDso: ['Show Structure', 'Display Data', 'Edit', 'Show Lineage', 'Where-Used', 'Open InfoProvider'],
  dtp: ['Run DTP', 'Display Data', 'Display Monitor', 'Edit DTP', 'Modify Filters', 'Simulate', 'Show Lineage'],
  cube: ['Show Structure', 'Display Data', 'Edit', 'Refresh', 'Show Lineage', 'Open Query'],
  evidenceRoom: ['Display', 'Open DecisionPro UI', 'Show Lineage'],
  report: ['Show Structure', 'Open DecisionPro UI', 'Show Export', 'Show Lineage', 'Edit Binding'],
  chain: ['Run Gate', 'Display Log', 'Edit Chain', 'Simulate'],
};

/** Fixture payloads for context-menu display panels (not live Postgres). */
export const DISPLAY_DATA = {
  PSA_CMS_DATA_MEDICAID_ENR: {
    objectName: 'PSA_CMS_DATA_MEDICAID_ENR',
    kind: 'PSA',
    hitCount: 1,
    filters: [
      { key: 'from_sys_id', value: 'CMS_DATA_MEDICAID_ENR' },
      { key: 'load_class', value: 'REAL' },
    ],
    columns: ['object_key', 'from_sys_id', 'load_class', 'as_of_date', 'bytes'],
    rows: [
      [
        'psa/CMS_DATA_MEDICAID_ENR/REAL/…/pi.csv',
        'CMS_DATA_MEDICAID_ENR',
        'REAL',
        '2026-03-31',
        '1.2 MB',
      ],
    ],
  },
  DSO_ENROLLMENT_STATE: {
    objectName: 'DSO_ENROLLMENT_STATE',
    kind: 'Detail DSO',
    hitCount: 107,
    filters: [
      { key: 'state_code', value: 'KY' },
      { key: 'period_ym', value: '202001–202603' },
      { key: 'load_class', value: 'REAL' },
    ],
    columns: [
      'state_code',
      'period_ym',
      'total_enrollment',
      'from_sys_id',
      'as_of_date',
      'load_class',
    ],
    rows: [
      ['KY', '202601', '1,325,311', 'CMS_DATA_MEDICAID_ENR', '2026-01-31', 'REAL'],
      ['KY', '202602', '1,312,425', 'CMS_DATA_MEDICAID_ENR', '2026-02-28', 'REAL'],
      ['KY', '202603', '1,294,021', 'CMS_DATA_MEDICAID_ENR', '2026-03-31', 'REAL'],
    ],
  },
  DSO_MCO_ROSTER: {
    objectName: 'DSO_MCO_ROSTER',
    kind: 'Detail DSO',
    hitCount: 6,
    filters: [
      { key: 'state_code', value: 'KY' },
      { key: 'load_class', value: 'REAL' },
    ],
    columns: ['mco_name', 'status', 'effective_date', 'from_sys_id', 'load_class'],
    rows: [
      ['Aetna Better Health of Kentucky', 'active', '2021-01-01', 'KY_DMS_MCO_CONTRACTS', 'REAL'],
      ['Anthem Blue Cross and Blue Shield', 'active', '2021-01-01', 'KY_DMS_MCO_CONTRACTS', 'REAL'],
      ['Humana Healthy Horizons in Kentucky', 'active', '2021-01-01', 'KY_DMS_MCO_CONTRACTS', 'REAL'],
      ['Passport Health Plan by Molina', 'active', '2021-01-01', 'KY_DMS_MCO_CONTRACTS', 'REAL'],
      ['UnitedHealthcare Community Plan', 'active', '2021-01-01', 'KY_DMS_MCO_CONTRACTS', 'REAL'],
      ['WellCare of Kentucky', 'exited', '2021-01-01', 'KY_DMS_MCO_CONTRACTS', 'REAL'],
    ],
  },
  CUBE_EXEC_LANDING: {
    objectName: 'CUBE_EXEC_LANDING',
    kind: 'Cube',
    hitCount: 3,
    filters: [{ key: 'load_class', value: 'REAL' }],
    columns: ['measure_id', 'display_value', 'as_of_date', 'from_sys_id', 'load_class'],
    rows: [
      ['M-001', '1,294,021', '2026-03-31', 'CMS_DATA_MEDICAID_ENR', 'REAL'],
      ['M-002', '-6.27%', '2026-03-31', 'CMS_DATA_MEDICAID_ENR', 'REAL'],
      ['M-007', '5', '2025-01-01', 'KY_DMS_MCO_CONTRACTS', 'REAL'],
    ],
  },
  DTP_DSO_TO_CUBE_ENR: {
    objectName: 'DTP_DSO_TO_CUBE_ENR',
    kind: 'DTP staging peek',
    hitCount: 3,
    filters: [{ key: 'load_class', value: 'REAL' }],
    columns: ['measure_id', 'value', 'period_ym', 'status'],
    rows: [
      ['M-001', '1,294,021', '202603', 'mapped'],
      ['M-002', '-6.27', '202603', 'derived'],
      ['—', '107 periods', '—', 'source DSO rows'],
    ],
  },
  DTP_MCO_TO_CUBE: {
    objectName: 'DTP_MCO_TO_CUBE',
    kind: 'DTP staging peek',
    hitCount: 1,
    filters: [{ key: 'load_class', value: 'REAL' }],
    columns: ['measure_id', 'value', 'status'],
    rows: [['M-007', '5', 'pending refresh']],
  },
  TRFN_ENR_CLEANSE: {
    objectName: 'TRFN_ENR_CLEANSE',
    kind: 'Transformation preview',
    hitCount: 3,
    filters: [],
    columns: ['source_field', 'rule', 'target_field'],
    rows: [
      ['State', 'direct', 'state_code'],
      ['Total Medicaid and CHIP Enrollment', 'number', 'total_enrollment'],
      ['Reporting Period', 'prefer Updated/Final · attach AsOfDate', 'period_ym / as_of_date'],
    ],
  },
  TRFN_MCO_ROSTER: {
    objectName: 'TRFN_MCO_ROSTER',
    kind: 'Transformation preview',
    hitCount: 2,
    filters: [],
    columns: ['source_field', 'rule', 'target_field'],
    rows: [
      ['MCO name', 'trim', 'mco_name'],
      ['Status', 'normalize active|exited', 'status'],
    ],
  },
};

export const DTP_MONITORS = {
  DTP_DSO_TO_CUBE_ENR: {
    technicalName: 'DTP_DSO_TO_CUBE_ENR',
    source: { type: 'Detail DSO', name: 'DSO_ENROLLMENT_STATE' },
    target: { type: 'Cube', name: 'CUBE_EXEC_LANDING' },
    extractionMode: 'Full',
    filter: 'load_class = REAL',
    requests: [
      {
        id: 'REQ-ENR-003',
        status: 'success',
        records: 107,
        start: '2026-08-01T15:41:55Z',
        end: '2026-08-01T15:42:03Z',
        duration: '8s',
        message: 'DTP completed successfully',
      },
      {
        id: 'REQ-ENR-002',
        status: 'success',
        records: 107,
        start: '2026-07-28T09:15:00Z',
        end: '2026-07-28T09:15:09Z',
        duration: '9s',
        message: 'DTP completed successfully',
      },
      {
        id: 'REQ-ENR-001',
        status: 'warning',
        records: 105,
        start: '2026-07-21T09:15:00Z',
        end: '2026-07-21T09:15:11Z',
        duration: '11s',
        message: '2 periods skipped (missing Updated/Final)',
      },
    ],
  },
  DTP_MCO_TO_CUBE: {
    technicalName: 'DTP_MCO_TO_CUBE',
    source: { type: 'Detail DSO', name: 'DSO_MCO_ROSTER' },
    target: { type: 'Cube', name: 'CUBE_EXEC_LANDING' },
    extractionMode: 'Full',
    filter: 'load_class = REAL',
    requests: [
      {
        id: 'REQ-MCO-001',
        status: 'success',
        records: 6,
        start: '2026-08-01T15:42:00Z',
        end: '2026-08-01T15:42:04Z',
        duration: '4s',
        message: 'DTP completed successfully',
      },
    ],
  },
};

export const LINEAGE = {
  PSA_CMS_DATA_MEDICAID_ENR: [
    'CMS_DATA_MEDICAID_ENR (Source System)',
    'PSA_CMS_DATA_MEDICAID_ENR',
    'TRFN_ENR_CLEANSE',
    'DSO_ENROLLMENT_STATE',
    'DTP_DSO_TO_CUBE_ENR',
    'CUBE_EXEC_LANDING',
    'Q_LANDING_ACCURATE → DecisionPro UI',
  ],
  TRFN_ENR_CLEANSE: [
    'PSA_CMS_DATA_MEDICAID_ENR',
    'TRFN_ENR_CLEANSE',
    'DSO_ENROLLMENT_STATE',
    'CUBE_EXEC_LANDING',
  ],
  DSO_ENROLLMENT_STATE: [
    'PSA_CMS_DATA_MEDICAID_ENR → TRFN_ENR_CLEANSE',
    'DSO_ENROLLMENT_STATE',
    'DTP_DSO_TO_CUBE_ENR → CUBE_EXEC_LANDING',
    'Q_LANDING_ACCURATE (M-001, M-002)',
  ],
  DTP_DSO_TO_CUBE_ENR: [
    'DSO_ENROLLMENT_STATE',
    'DTP_DSO_TO_CUBE_ENR',
    'CUBE_EXEC_LANDING',
    'Q_LANDING_ACCURATE',
  ],
  CUBE_EXEC_LANDING: [
    'DSO_ENROLLMENT_STATE / DSO_MCO_ROSTER',
    'CUBE_EXEC_LANDING',
    'Q_LANDING_ACCURATE → http://localhost:5040/',
  ],
  Q_LANDING_ACCURATE: [
    'CUBE_EXEC_LANDING',
    'ExportAccurateLandingForUi → accurateLanding.js',
    'DecisionPro role home (Accurate Path)',
  ],
  PSA_KY_DMS_MCO_CONTRACTS: [
    'KY_DMS_MCO_CONTRACTS',
    'PSA_KY_DMS_MCO_CONTRACTS',
    'TRFN_MCO_ROSTER',
    'DSO_MCO_ROSTER',
    'DTP_MCO_TO_CUBE',
    'CUBE_EXEC_LANDING (M-007)',
  ],
  TRFN_MCO_ROSTER: ['PSA_KY_DMS_MCO_CONTRACTS', 'TRFN_MCO_ROSTER', 'DSO_MCO_ROSTER'],
  DSO_MCO_ROSTER: ['TRFN_MCO_ROSTER', 'DSO_MCO_ROSTER', 'DTP_MCO_TO_CUBE → CUBE_EXEC_LANDING'],
  DTP_MCO_TO_CUBE: ['DSO_MCO_ROSTER', 'DTP_MCO_TO_CUBE', 'CUBE_EXEC_LANDING (M-007)'],
};

export const WHERE_USED = {
  TRFN_ENR_CLEANSE: [
    { object: 'DSO_ENROLLMENT_STATE', role: 'target' },
    { object: 'DF_KY_ENROLLMENT_ACCURATE', role: 'data flow' },
  ],
  DSO_ENROLLMENT_STATE: [
    { object: 'DTP_DSO_TO_CUBE_ENR', role: 'source' },
    { object: 'CUBE_EXEC_LANDING', role: 'via DTP' },
    { object: 'M-001 / M-002', role: 'measure grain' },
  ],
  TRFN_MCO_ROSTER: [
    { object: 'DSO_MCO_ROSTER', role: 'target' },
    { object: 'DF_KY_MCO_ROSTER', role: 'data flow' },
  ],
  DSO_MCO_ROSTER: [
    { object: 'DTP_MCO_TO_CUBE', role: 'source' },
    { object: 'M-007', role: 'measure grain' },
  ],
};

export const EXPORT_FIXTURE = {
  path: 'wireframe V1/app/src/data/alp/accurateLanding.js',
  schema: 'decisionpro/accurate-landing/v1',
  loadClass: 'REAL',
  generatedAt: '2026-08-01T17:04:18.061Z',
  sample: {
    'M-001': '1,294,021',
    'M-002': '-6.27%',
    'M-007': '5',
  },
};

export const CHAIN_LOG = [
  { t: '15:41:40Z', level: 'INFO', msg: 'Gate start · PC_POC_ACCURACY_GATE' },
  { t: '15:41:42Z', level: 'INFO', msg: 'TEST load enrollment + MCO' },
  { t: '15:41:48Z', level: 'INFO', msg: 'Thorough tests passed' },
  { t: '15:41:50Z', level: 'INFO', msg: 'PurgeTestLoads complete' },
  { t: '15:41:51Z', level: 'INFO', msg: 'VerifyWarehouseEmptyOfTest · ACTIVE' },
  { t: '15:42:03Z', level: 'INFO', msg: 'REAL ETL enrollment SUCCEEDED (107)' },
  { t: '15:42:04Z', level: 'INFO', msg: 'REAL ETL MCO SUCCEEDED (6)' },
];

/** Resolve which fixture panel to show for a context action. */
export function resolveContextDisplay(action, node) {
  const name = node?.technicalName || node?.id || '';
  const type = node?.type;

  if (action === 'Show Field Mapping') {
    return {
      kind: 'field-mapping',
      title: 'Field Mapping',
      breadcrumb: `Data Flow > ${name} > Field Mapping`,
      data: { technicalName: name },
      fallbackName: name,
    };
  }
  if (action === 'Show Structure' || action === 'Open InfoProvider') {
    return {
      kind: 'provider-structure',
      title: 'Provider Structure',
      breadcrumb: `InfoProvider > ${name} > Structure`,
      data: { technicalName: name },
      fallbackName: name,
    };
  }
  if (action === 'Display Data' || action === 'Display') {
    const data =
      DISPLAY_DATA[name] ||
      (type === 'cube' ? DISPLAY_DATA.CUBE_EXEC_LANDING : null) ||
      (type === 'report' ? DISPLAY_DATA.CUBE_EXEC_LANDING : null);
    return {
      kind: 'display-data',
      title: 'Display Data',
      breadcrumb: `Data Flow > ${name} > Display Data`,
      data,
      fallbackName: name,
    };
  }
  if (action === 'Display Monitor') {
    return {
      kind: 'monitor',
      title: 'DTP Monitor',
      breadcrumb: `Data Flow > ${name} > Display Monitor`,
      data: DTP_MONITORS[name] || null,
      fallbackName: name,
    };
  }
  if (action === 'Show Lineage') {
    return {
      kind: 'lineage',
      title: 'Show Lineage',
      breadcrumb: `Data Flow > ${name} > Lineage`,
      data: LINEAGE[name] || null,
      fallbackName: name,
    };
  }
  if (action === 'Where-Used') {
    return {
      kind: 'where-used',
      title: 'Where-Used',
      breadcrumb: `Data Flow > ${name} > Where-Used`,
      data: WHERE_USED[name] || null,
      fallbackName: name,
    };
  }
  if (
    action === 'Edit' ||
    action === 'Edit DTP' ||
    action === 'Edit DataSource' ||
    action === 'Edit Binding' ||
    action === 'Modify Rules' ||
    action === 'Modify Filters' ||
    action === 'Open InfoProvider' ||
    action === 'Open Query'
  ) {
    return {
      kind: 'definition',
      title: action,
      breadcrumb: `Data Flow > ${name} > ${action}`,
      data: { node, action },
      fallbackName: name,
    };
  }
  if (action === 'Open Source System') {
    return {
      kind: 'source-system',
      title: 'Open Source System',
      breadcrumb: `Modeling > Source System`,
      data: { fromSysId: node?.detail?.fromSysId || name },
      fallbackName: name,
    };
  }
  if (action === 'Show Export') {
    return {
      kind: 'export',
      title: 'Show Export',
      breadcrumb: `Data Flow > ${name} > Show Export`,
      data: EXPORT_FIXTURE,
      fallbackName: name,
    };
  }
  if (action === 'Open DecisionPro UI') {
    return {
      kind: 'open-ui',
      title: 'Open DecisionPro UI',
      breadcrumb: `Data Flow > ${name}`,
      data: { url: 'http://localhost:5040/' },
      fallbackName: name,
    };
  }
  if (action === 'Run DTP' || action === 'Simulate' || action === 'Refresh' || action === 'Check' || action === 'Activate') {
    return {
      kind: 'run',
      title: action,
      breadcrumb: `Data Flow > ${name} > ${action}`,
      data: { action, node },
      fallbackName: name,
    };
  }
  if (action === 'Display Log' || action === 'Run Gate' || action === 'Edit Chain') {
    return {
      kind: 'chain-log',
      title: action,
      breadcrumb: `Process Chain > ${action}`,
      data: { action, log: CHAIN_LOG },
      fallbackName: name || 'PC_POC_ACCURACY_GATE',
    };
  }
  return {
    kind: 'generic',
    title: action,
    breadcrumb: `Data Flow > ${name} > ${action}`,
    data: { action, node },
    fallbackName: name,
  };
}
