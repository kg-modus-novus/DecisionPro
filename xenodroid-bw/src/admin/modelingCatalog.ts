/**
 * Static modeling overlay for admin workbench.
 * Technical names match runner molecules / DSO / cube tables.
 * Live counts and load status are filled by AssembleAdminWorkbenchSnapshot.
 */

export type FlowNodeTemplate = {
  id: string;
  type: 'psa' | 'transformation' | 'detailDso' | 'dtp' | 'cube' | 'report';
  technicalName: string;
  titleKey: string;
  title: string;
  meta?: string;
};

export const FLOW_GRAPH_TEMPLATES: Record<
  string,
  {
    id: string;
    technicalName: string;
    title: string;
    subtitle: string;
    dataRequestId: string;
    measures: string[];
    sourceSystem: string;
    targetCube: string;
    targetReport: string;
    canvasId: string;
    nodes: FlowNodeTemplate[];
  }
> = {
  enrollment: {
    id: 'enrollment',
    technicalName: 'DF_KY_ENROLLMENT_ACCURATE',
    title: 'KY Enrollment Accurate Path',
    subtitle: 'CMS PI → DSO_ENROLLMENT_STATE → CUBE_EXEC_LANDING',
    dataRequestId: 'DR-REAL-PI-ENROLLMENT',
    measures: ['M-001', 'M-002'],
    sourceSystem: 'CMS_DATA_MEDICAID_ENR',
    targetCube: 'CUBE_EXEC_LANDING',
    targetReport: 'Q_LANDING_ACCURATE',
    canvasId: 'enrollment',
    nodes: [
      {
        id: 'psa-enr',
        type: 'psa',
        technicalName: 'PSA_CMS_DATA_MEDICAID_ENR',
        titleKey: 'psa',
        title: 'PSA · CMS enrollment',
      },
      {
        id: 'trfn-enr',
        type: 'transformation',
        technicalName: 'TRFN_ENR_CLEANSE',
        titleKey: 'transformation',
        title: 'TRFN_ENR_CLEANSE',
        meta: 'Dedupe period · attach AsOfDate',
      },
      {
        id: 'dso-enr',
        type: 'detailDso',
        technicalName: 'DSO_ENROLLMENT_STATE',
        titleKey: 'detailDso',
        title: 'DSO_ENROLLMENT_STATE',
      },
      {
        id: 'dtp-enr',
        type: 'dtp',
        technicalName: 'DTP_DSO_TO_CUBE_ENR',
        titleKey: 'dtp',
        title: 'DTP_DSO_TO_CUBE_ENR',
      },
      {
        id: 'cube-enr',
        type: 'cube',
        technicalName: 'CUBE_EXEC_LANDING',
        titleKey: 'cube',
        title: 'CUBE_EXEC_LANDING',
        meta: 'M-001 · M-002',
      },
      {
        id: 'report-enr',
        type: 'report',
        technicalName: 'Q_LANDING_ACCURATE',
        titleKey: 'infoProvider',
        title: 'DecisionPro Accurate Path',
        meta: 'Role home export',
      },
    ],
  },
  mco: {
    id: 'mco',
    technicalName: 'DF_KY_MCO_ROSTER',
    title: 'MCO Roster Path',
    subtitle: 'KY DMS contracts · ATTRIBUTABLE',
    dataRequestId: 'DR-REAL-MCO-ROSTER',
    measures: ['M-007'],
    sourceSystem: 'KY_DMS_MCO_CONTRACTS',
    targetCube: 'CUBE_EXEC_LANDING',
    targetReport: 'Q_LANDING_ACCURATE',
    canvasId: 'mco',
    nodes: [
      {
        id: 'psa-mco',
        type: 'psa',
        technicalName: 'PSA_KY_DMS_MCO_CONTRACTS',
        titleKey: 'psa',
        title: 'PSA · MCO contracts',
      },
      {
        id: 'trfn-mco',
        type: 'transformation',
        technicalName: 'TRFN_MCO_ROSTER',
        titleKey: 'transformation',
        title: 'TRFN_MCO_ROSTER',
        meta: 'Active vs exited',
      },
      {
        id: 'dso-mco',
        type: 'detailDso',
        technicalName: 'DSO_MCO_ROSTER',
        titleKey: 'detailDso',
        title: 'DSO_MCO_ROSTER',
      },
      {
        id: 'dtp-mco',
        type: 'dtp',
        technicalName: 'DTP_MCO_TO_CUBE',
        titleKey: 'dtp',
        title: 'DTP_MCO_TO_CUBE',
      },
      {
        id: 'cube-mco',
        type: 'cube',
        technicalName: 'CUBE_EXEC_LANDING',
        titleKey: 'cube',
        title: 'CUBE_EXEC_LANDING',
        meta: 'M-007',
      },
      {
        id: 'report-mco',
        type: 'report',
        technicalName: 'Q_LANDING_ACCURATE',
        titleKey: 'infoProvider',
        title: 'DecisionPro Accurate Path',
        meta: 'Role home export',
      },
    ],
  },
  'public-hydration': {
    id: 'public-hydration',
    technicalName: 'DF_KY_PUBLIC_HYDRATION',
    title: 'Public Hydration Pack',
    subtitle: 'Multi-source REAL pack → cube_exec_landing / cube_room_row',
    dataRequestId: 'DR-REAL-PUBLIC-HYDRATION',
    measures: ['M-003', 'M-004', 'M-010', 'M-011', 'M-012'],
    sourceSystem: 'MULTI',
    targetCube: 'CUBE_EXEC_LANDING',
    targetReport: 'Q_LANDING_ACCURATE',
    canvasId: 'public-hydration',
    nodes: [
      {
        id: 'psa-hyd',
        type: 'psa',
        technicalName: 'PSA_PUBLIC_HYDRATION',
        titleKey: 'psa',
        title: 'PSA · Public hydration',
      },
      {
        id: 'trfn-hyd',
        type: 'transformation',
        technicalName: 'TRFN_PUBLIC_HYDRATION',
        titleKey: 'transformation',
        title: 'TRFN_PUBLIC_HYDRATION',
        meta: 'Pack normalize · gap objects',
      },
      {
        id: 'dso-hyd',
        type: 'detailDso',
        technicalName: 'CUBE_ROOM_ROW',
        titleKey: 'detailDso',
        title: 'CUBE_ROOM_ROW (room facts)',
        meta: 'Room-oriented detail surface',
      },
      {
        id: 'dtp-hyd',
        type: 'dtp',
        technicalName: 'DTP_HYDRATION_TO_CUBE',
        titleKey: 'dtp',
        title: 'DTP_HYDRATION_TO_CUBE',
      },
      {
        id: 'cube-hyd',
        type: 'cube',
        technicalName: 'CUBE_EXEC_LANDING',
        titleKey: 'cube',
        title: 'CUBE_EXEC_LANDING',
      },
      {
        id: 'report-hyd',
        type: 'report',
        technicalName: 'Q_LANDING_ACCURATE',
        titleKey: 'infoProvider',
        title: 'DecisionPro Accurate Path',
      },
    ],
  },
};

export const PLANNED_FLOWS = [
  {
    id: 'county',
    technicalName: 'DF_KY_COUNTY_ENROLLMENT',
    title: 'County Enrollment (planned)',
    description: 'Dedicated M-003 path — today carried inside public hydration pack',
    status: 'planned' as const,
    measures: ['M-003'],
    sourceSystem: 'KY_DMS_COUNTY_COUNTS',
    targetCube: 'CUBE_EXEC_LANDING',
    targetReport: 'Q_LANDING_ACCURATE',
    note: 'Planned dedicated graph — values already land via public hydration',
    canvasId: null,
  },
  {
    id: 'scorecard',
    technicalName: 'DF_KY_SCORECARD',
    title: 'Core Set / Scorecard (planned)',
    description: 'Dedicated Core Set path — today inside public hydration',
    status: 'planned' as const,
    measures: ['M-010', 'M-011', 'M-012'],
    sourceSystem: 'CMS_MEDICAID_SCORECARD',
    targetCube: 'CUBE_EXEC_LANDING',
    targetReport: 'Q_LANDING_ACCURATE',
    note: 'Planned dedicated graph',
    canvasId: null,
  },
];

export const INFO_OBJECT_TEMPLATES = [
  {
    id: '0STATE_CODE',
    technicalName: '0STATE_CODE',
    kind: 'characteristic',
    description: 'US state code',
    dataType: 'CHAR(2)',
    usedBy: ['DSO_ENROLLMENT_STATE', 'DSO_MCO_ROSTER', 'CUBE_EXEC_LANDING'],
    columnHint: 'state_code',
  },
  {
    id: '0PERIOD_YM',
    technicalName: '0PERIOD_YM',
    kind: 'characteristic',
    description: 'Reporting period YYYYMM',
    dataType: 'NUMC(6)',
    usedBy: ['DSO_ENROLLMENT_STATE', 'CUBE_EXEC_LANDING'],
    columnHint: 'period_ym',
  },
  {
    id: '0AS_OF_DATE',
    technicalName: '0AS_OF_DATE',
    kind: 'characteristic',
    description: 'As-of calendar date for provenance',
    dataType: 'DATS',
    usedBy: ['DSO_ENROLLMENT_STATE', 'CUBE_EXEC_LANDING', 'Q_LANDING_ACCURATE'],
    columnHint: 'as_of_date',
  },
  {
    id: '0FROM_SYS_ID',
    technicalName: '0FROM_SYS_ID',
    kind: 'characteristic',
    description: 'Source system technical id',
    dataType: 'CHAR(32)',
    usedBy: ['PSA', 'DSO_ENROLLMENT_STATE', 'DSO_MCO_ROSTER'],
    columnHint: 'from_sys_id',
  },
  {
    id: '0LOAD_CLASS',
    technicalName: '0LOAD_CLASS',
    kind: 'characteristic',
    description: 'TEST vs REAL load class',
    dataType: 'CHAR(8)',
    usedBy: ['All accurate-path providers'],
    columnHint: 'load_class',
  },
  {
    id: 'ZMCO_NAME',
    technicalName: 'ZMCO_NAME',
    kind: 'characteristic',
    description: 'Managed care organization name',
    dataType: 'CHAR(80)',
    usedBy: ['DSO_MCO_ROSTER'],
    columnHint: 'mco_label',
  },
  {
    id: 'ZMCO_STATUS',
    technicalName: 'ZMCO_STATUS',
    kind: 'characteristic',
    description: 'MCO status (active / exited)',
    dataType: 'CHAR(16)',
    usedBy: ['DSO_MCO_ROSTER'],
    columnHint: 'status',
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
    columnHint: 'total_enrollment',
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
    columnHint: 'numeric_value',
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
    columnHint: 'numeric_value',
  },
];

export const DTP_TO_DATA_REQUEST: Record<string, string> = {
  DTP_DSO_TO_CUBE_ENR: 'DR-REAL-PI-ENROLLMENT',
  DTP_MCO_TO_CUBE: 'DR-REAL-MCO-ROSTER',
  DTP_HYDRATION_TO_CUBE: 'DR-REAL-PUBLIC-HYDRATION',
};

/** Honest POC inventory — not a full RSA1 landscape. */
export const POC_INVENTORY_NOTE =
  'DecisionPro POC warehouse is intentionally thin: 2 Detail DSOs, 1 executive cube (+ room-row store), 1 query/export, 3 REAL data flows. Many dashboard measures share CUBE_EXEC_LANDING via public hydration — they are not separate cubes/flows yet.';

/** Field mappings from runner cleanse (RetrieveAndLoad* molecules). */
export const TRANSFORMATION_MAPPINGS: Record<
  string,
  {
    technicalName: string;
    source: string;
    target: string;
    rulesNote: string;
    mappings: { source: string; rule: string; target: string; dataType: string }[];
  }
> = {
  TRFN_ENR_CLEANSE: {
    technicalName: 'TRFN_ENR_CLEANSE',
    source: 'PSA_CMS_DATA_MEDICAID_ENR (PI CSV)',
    target: 'DSO_ENROLLMENT_STATE',
    rulesNote: 'ParseKentuckyEnrollmentFromPiCsv · prefer Updated/Final · attach AsOfDate',
    mappings: [
      { source: '(constant KY)', rule: 'literal', target: 'state_code', dataType: 'CHAR(2)' },
      { source: 'Reporting Period', rule: 'normalize YYYYMM', target: 'period_ym', dataType: 'NUMC(6)' },
      {
        source: 'Total Medicaid Enrollment',
        rule: 'number',
        target: 'medicaid_enrollment',
        dataType: 'DEC',
      },
      {
        source: 'Total CHIP Enrollment',
        rule: 'number (if present)',
        target: 'chip_enrollment',
        dataType: 'DEC',
      },
      {
        source: 'Total Medicaid and CHIP Enrollment',
        rule: 'number',
        target: 'total_enrollment',
        dataType: 'DEC',
      },
      { source: 'Reporting Period', rule: 'period end date', target: 'as_of_date', dataType: 'DATS' },
      { source: 'FromSysID', rule: 'request context', target: 'from_sys_id', dataType: 'CHAR(32)' },
      { source: 'LoadClass', rule: 'request context', target: 'load_class', dataType: 'CHAR(8)' },
    ],
  },
  TRFN_MCO_ROSTER: {
    technicalName: 'TRFN_MCO_ROSTER',
    source: 'PSA_KY_DMS_MCO_CONTRACTS (curated JSON)',
    target: 'DSO_MCO_ROSTER',
    rulesNote: 'Normalize active|exited · effective dating from DMS contracts page',
    mappings: [
      { source: 'mco_key', rule: 'direct', target: 'mco_key', dataType: 'CHAR(32)' },
      { source: 'mco_label', rule: 'trim', target: 'mco_label', dataType: 'CHAR(80)' },
      { source: 'status', rule: 'normalize active|exited', target: 'status', dataType: 'CHAR(16)' },
      { source: 'effective_date', rule: 'date', target: 'effective_date', dataType: 'DATS' },
      { source: 'as_of_date (pack)', rule: 'direct', target: 'as_of_date', dataType: 'DATS' },
      { source: 'FromSysID', rule: 'request context', target: 'from_sys_id', dataType: 'CHAR(32)' },
      { source: 'LoadClass', rule: 'request context', target: 'load_class', dataType: 'CHAR(8)' },
    ],
  },
  TRFN_PUBLIC_HYDRATION: {
    technicalName: 'TRFN_PUBLIC_HYDRATION',
    source: 'PSA_PUBLIC_HYDRATION (pack JSON)',
    target: 'CUBE_EXEC_LANDING / CUBE_ROOM_ROW / gap_object',
    rulesNote: 'RetrieveAndLoadPublicHydration · measure + room + gap normalize',
    mappings: [
      { source: 'measureId', rule: 'direct', target: 'measure_id', dataType: 'CHAR(16)' },
      { source: 'displayValue', rule: 'direct', target: 'display_value', dataType: 'STRING' },
      { source: 'numericValue', rule: 'number', target: 'numeric_value', dataType: 'DEC' },
      { source: 'asOfDate', rule: 'date', target: 'as_of_date', dataType: 'DATS' },
      { source: 'fromSysId', rule: 'direct', target: 'from_sys_id', dataType: 'CHAR(32)' },
      { source: 'roomId / title / metric*', rule: 'room row map', target: 'cube_room_row.*', dataType: 'mixed' },
      { source: 'gaps[]', rule: 'gap_object insert', target: 'bw_ctl.gap_object', dataType: 'mixed' },
    ],
  },
};

/**
 * Structural graphics metadata for InfoProviders.
 * DSO table model is honest: POC has Active only (no New/Change Log partitions yet).
 */
export const INFO_PROVIDER_STRUCTURES: Record<string, Record<string, unknown>> = {
  DSO_ENROLLMENT_STATE: {
    kind: 'dso',
    technicalName: 'DSO_ENROLLMENT_STATE',
    dsoType: 'Standard Detail DSO (POC)',
    dsoTypeNote:
      'Modeled as Detail DSO. Physically one Active table keyed by state/period/load — New / Change Log / activation queue not implemented in this POC.',
    tables: [
      {
        name: 'New',
        status: 'not-implemented',
        physical: null,
        note: 'Inbound staging partition not modeled',
      },
      {
        name: 'Active',
        status: 'implemented',
        physical: 'bw_dso.dso_enrollment_state',
        note: 'Queryable active facts',
        fields: [
          { name: 'state_code', dataType: 'CHAR(2)', role: 'key' },
          { name: 'period_ym', dataType: 'NUMC(6)', role: 'key' },
          { name: 'medicaid_enrollment', dataType: 'DEC', role: 'keyFigure' },
          { name: 'chip_enrollment', dataType: 'DEC', role: 'keyFigure' },
          { name: 'total_enrollment', dataType: 'DEC', role: 'keyFigure' },
          { name: 'from_sys_id', dataType: 'CHAR(32)', role: 'attr' },
          { name: 'as_of_date', dataType: 'DATS', role: 'attr' },
          { name: 'load_class', dataType: 'CHAR(8)', role: 'key' },
          { name: 'load_history_id', dataType: 'CHAR(64)', role: 'key' },
        ],
      },
      {
        name: 'Change Log',
        status: 'not-implemented',
        physical: null,
        note: 'Delta/changelog not modeled',
      },
    ],
  },
  DSO_MCO_ROSTER: {
    kind: 'dso',
    technicalName: 'DSO_MCO_ROSTER',
    dsoType: 'Standard Detail DSO (POC)',
    dsoTypeNote:
      'Modeled as Detail DSO. Active table only — New / Change Log not implemented.',
    tables: [
      { name: 'New', status: 'not-implemented', physical: null, note: 'Not modeled' },
      {
        name: 'Active',
        status: 'implemented',
        physical: 'bw_dso.dso_mco_roster',
        note: 'Queryable active roster',
        fields: [
          { name: 'mco_key', dataType: 'CHAR(32)', role: 'key' },
          { name: 'mco_label', dataType: 'CHAR(80)', role: 'attr' },
          { name: 'status', dataType: 'CHAR(16)', role: 'attr' },
          { name: 'effective_date', dataType: 'DATS', role: 'attr' },
          { name: 'from_sys_id', dataType: 'CHAR(32)', role: 'attr' },
          { name: 'as_of_date', dataType: 'DATS', role: 'attr' },
          { name: 'load_class', dataType: 'CHAR(8)', role: 'key' },
          { name: 'load_history_id', dataType: 'CHAR(64)', role: 'key' },
        ],
      },
      { name: 'Change Log', status: 'not-implemented', physical: null, note: 'Not modeled' },
    ],
  },
  CUBE_ROOM_ROW: {
    kind: 'dso',
    technicalName: 'CUBE_ROOM_ROW',
    dsoType: 'Write-optimized / flat store (POC)',
    dsoTypeNote:
      'Room-oriented fact store used by public hydration — not a classic multiprovider cube. Listed under InfoProviders for Display Data.',
    tables: [
      { name: 'New', status: 'not-implemented', physical: null, note: 'Not modeled' },
      {
        name: 'Active',
        status: 'implemented',
        physical: 'bw_cube.cube_room_row',
        note: 'Flat room rows',
        fields: [
          { name: 'row_id', dataType: 'CHAR(64)', role: 'key' },
          { name: 'room_id', dataType: 'CHAR(32)', role: 'attr' },
          { name: 'title', dataType: 'STRING', role: 'attr' },
          { name: 'metric_key', dataType: 'CHAR(64)', role: 'attr' },
          { name: 'metric_value', dataType: 'DEC', role: 'keyFigure' },
          { name: 'display_value', dataType: 'STRING', role: 'attr' },
          { name: 'row_kind', dataType: 'CHAR(8)', role: 'attr' },
          { name: 'from_sys_id', dataType: 'CHAR(32)', role: 'attr' },
          { name: 'as_of_date', dataType: 'DATS', role: 'attr' },
        ],
      },
      { name: 'Change Log', status: 'not-implemented', physical: null, note: 'Not modeled' },
    ],
  },
  CUBE_EXEC_LANDING: {
    kind: 'cube',
    technicalName: 'CUBE_EXEC_LANDING',
    cubeType: 'Executive star (flattened POC)',
    cubeTypeNote:
      'Single fact table holding many measures (M-001…); dimensions are characteristics on the fact row rather than separate dim tables.',
    fact: {
      name: 'F_EXEC_LANDING',
      physical: 'bw_cube.cube_exec_landing',
      fields: [
        { name: 'measure_id', dataType: 'CHAR(16)', role: 'key' },
        { name: 'numeric_value', dataType: 'DEC', role: 'keyFigure' },
        { name: 'display_value', dataType: 'STRING', role: 'attr' },
        { name: 'unit', dataType: 'CHAR(32)', role: 'attr' },
        { name: 'as_of_date', dataType: 'DATS', role: 'key' },
        { name: 'from_sys_id', dataType: 'CHAR(32)', role: 'key' },
        { name: 'load_class', dataType: 'CHAR(8)', role: 'key' },
        { name: 'load_history_id', dataType: 'CHAR(64)', role: 'key' },
        { name: 'provenance_json', dataType: 'JSONB', role: 'attr' },
      ],
    },
    dimensions: [
      {
        name: '0MEASURE',
        description: 'Measure / key figure id',
        fields: [
          { name: 'measure_id', dataType: 'CHAR(16)' },
          { name: 'unit', dataType: 'CHAR(32)' },
        ],
      },
      {
        name: '0CALDAY / AsOf',
        description: 'As-of date grain',
        fields: [{ name: 'as_of_date', dataType: 'DATS' }],
      },
      {
        name: '0FROM_SYS',
        description: 'Source system',
        fields: [{ name: 'from_sys_id', dataType: 'CHAR(32)' }],
      },
      {
        name: '0LOAD_CLASS',
        description: 'TEST vs REAL',
        fields: [{ name: 'load_class', dataType: 'CHAR(8)' }],
      },
    ],
  },
  Q_LANDING_ACCURATE: {
    kind: 'query',
    technicalName: 'Q_LANDING_ACCURATE',
    queryType: 'Query / export surface',
    queryTypeNote: 'Reads CUBE_EXEC_LANDING → ExportAccurateLandingForUi → DecisionPro UI :5040',
    binds: ['CUBE_EXEC_LANDING'],
    exportPath: 'wireframe V1/app/src/data/alp/accurateLanding.js',
  },
};
