/**
 * Resolve a tabular PSA land preview for the Loaded (PSA) info popover.
 * Prefers an export-attached psaPreview; otherwise builds from curated REAL fixtures.
 */
import hydrationPack from '../../../../xenodroid-bw/src/fixtures/realPublicHydrationPack.json';
import mcoRoster from '../../../../xenodroid-bw/src/fixtures/realMcoRosterCurated.json';

const PREVIEW_ROW_CAP = 250;

const HYDRATION_COLUMNS = [
  'measure_id',
  'display_value',
  'numeric_value',
  'unit',
  'as_of_date',
  'period_id',
  'from_sys_id',
  'source_uri',
  'note',
];

function cell(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString('en-US');
  return String(value);
}

function truncatePreview(columns, rows, totalRowCount, note) {
  const shown = rows.slice(0, PREVIEW_ROW_CAP);
  return {
    columns,
    rows: shown,
    totalRowCount,
    shownRowCount: shown.length,
    truncated: shown.length < totalRowCount,
    note,
  };
}

function previewFromHydration(fromSysId, loadedRowCount) {
  const measures = (hydrationPack.landingMeasures || []).filter((m) => m.fromSysId === fromSysId);
  if (!measures.length) return null;
  const rows = measures.map((m) => [
    cell(m.measureId),
    cell(m.displayValue),
    cell(m.numericValue),
    cell(m.unit),
    cell(m.asOfDate),
    cell(m.periodId),
    cell(m.fromSysId),
    cell(m.sourceUri),
    cell(m.note),
  ]);
  const total = loadedRowCount > 0 ? loadedRowCount : rows.length;
  return truncatePreview(
    HYDRATION_COLUMNS,
    rows,
    total,
    'Rows from the PUBLIC_HYDRATION PSA pack slice for this FromSysID (curated REAL bind).',
  );
}

function previewFromMco(loadedRowCount) {
  const mcos = mcoRoster.mcos || [];
  if (!mcos.length) return null;
  const columns = ['mco_key', 'mco_label', 'status', 'effective_date', 'as_of_date', 'source_uri'];
  const rows = mcos.map((m) => [
    cell(m.mco_key),
    cell(m.mco_label),
    cell(m.status),
    cell(m.effective_date),
    cell(mcoRoster.as_of_date),
    cell(mcoRoster.source_uri),
  ]);
  const total = loadedRowCount > 0 ? loadedRowCount : rows.length;
  return truncatePreview(
    columns,
    rows,
    total,
    'Rows from the dedicated KY DMS MCO contracts PSA land (curated REAL roster).',
  );
}

function previewFromEnrollmentPeriods(row) {
  const d = row?.loadedDepth || {};
  const periods = d.periodIds || [];
  const asOfs = d.asOfDates || [];
  if (!periods.length && !asOfs.length) return null;
  const n = Math.max(periods.length, asOfs.length);
  const columns = ['reporting_period', 'as_of_date', 'from_sys_id', 'load_class', 'note'];
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    rows.push([
      cell(periods[i]),
      cell(asOfs[i]),
      cell(row.fromSysId),
      'REAL',
      'Kentucky period represented from the landed PI PSA CSV',
    ]);
  }
  const totalLand = Number(d.loadedRowCount ?? d.rowCount ?? rows.length) || rows.length;
  return truncatePreview(
    columns,
    rows,
    totalLand,
    `Showing Kentucky reporting periods extracted from the landed PI PSA. The full publisher CSV in PSA holds ${totalLand.toLocaleString('en-US')} rows (all states × periods); this table lists the Kentucky period keys DecisionPro binds for legislative use.`,
  );
}

/**
 * @returns {{
 *   columns: string[],
 *   rows: string[][],
 *   totalRowCount: number,
 *   shownRowCount: number,
 *   truncated: boolean,
 *   note: string,
 * } | null}
 */
export function buildPsaPreview(row) {
  if (!row || row.kind === 'gap' || row.disposition === 'GAP') {
    return {
      columns: ['note'],
      rows: [['No PSA rows — this catalogue entry is an Explicit Gap.']],
      totalRowCount: 0,
      shownRowCount: 1,
      truncated: false,
      note: 'Gaps are labeled holes, not landed PSA extracts.',
    };
  }

  const attached = row.loadedDepth?.psaPreview;
  if (attached?.columns?.length && Array.isArray(attached.rows)) {
    const total = Number(attached.totalRowCount ?? attached.rows.length) || attached.rows.length;
    return truncatePreview(
      attached.columns,
      attached.rows.map((r) => (Array.isArray(r) ? r.map(cell) : [cell(r)])),
      total,
      attached.note || 'PSA land preview from Accuracy Gate export.',
    );
  }

  const loaded = Number(row.loadedDepth?.loadedRowCount ?? row.loadedDepth?.rowCount ?? 0) || 0;
  if (loaded <= 0) {
    return {
      columns: ['note'],
      rows: [['No records are currently landed in the PSA for this FromSysID.']],
      totalRowCount: 0,
      shownRowCount: 1,
      truncated: false,
      note: 'Catalogued or blocked sources have an empty Loaded (PSA) count until a REAL bind lands.',
    };
  }

  if (row.fromSysId === 'KY_DMS_MCO_CONTRACTS') {
    return previewFromMco(loaded);
  }
  if (row.fromSysId === 'CMS_DATA_MEDICAID_ENR') {
    return previewFromEnrollmentPeriods(row);
  }

  const hydration = previewFromHydration(row.fromSysId, loaded);
  if (hydration) return hydration;

  return {
    columns: ['from_sys_id', 'loaded_row_count', 'note'],
    rows: [[cell(row.fromSysId), cell(loaded), 'PSA preview rows are not yet attached for this source.']],
    totalRowCount: loaded,
    shownRowCount: 1,
    truncated: loaded > 1,
    note: 'Count is known from LoadHistory; row-level preview will attach on the next spectrum export that can read the local PSA object.',
  };
}

export const PSA_PREVIEW_ROW_CAP = PREVIEW_ROW_CAP;
