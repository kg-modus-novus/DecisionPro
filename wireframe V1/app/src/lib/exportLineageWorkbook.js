/**
 * Build / download an Excel workbook for Data Lineage & Provenance.
 * Sheet 1 (Report) — visual filters, results, and formulas referencing tile sheets.
 * Remaining sheets — one per lineage tile (Query → Aggregate → DSO → Transformation → PSA…).
 */

import ExcelJS from 'exceljs';
import { asFilterIds } from './alpCube.js';
import {
  ATTENTION,
  FRESHNESS,
  PERIODS,
  POPULATIONS,
  REGIONS,
  labelOf,
} from '../data/alp/dimensions.js';

export const LINEAGE_EXPORT_COLUMNS = [
  { key: 'id', label: 'Row ID' },
  { key: 'title', label: 'Title' },
  { key: 'rowKind', label: 'Kind' },
  { key: 'displayValue', label: 'Value' },
  { key: 'metricKey', label: 'Metric' },
  { key: 'metricValue', label: 'Metric value' },
  { key: 'period', label: 'Period' },
  { key: 'asOfDate', label: 'As of' },
  { key: 'fromSysId', label: 'FromSysID' },
  { key: 'gapId', label: 'Gap ID' },
  { key: 'attention', label: 'Attention' },
  { key: 'population', label: 'Population' },
  { key: 'region', label: 'Region' },
  { key: 'freshness', label: 'Freshness' },
];

/** Excel sheet names: max 31 chars, no []:*?/\\ */
export function excelSafeSheetName(raw, used = new Set()) {
  let base = String(raw || 'Sheet')
    .replace(/[\[\]\*\/\\?:]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 31);
  if (!base) base = 'Sheet';
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = `_${n}`;
    name = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

function quoteSheet(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

function countTitleFormula(sheetName) {
  return `COUNTA(${quoteSheet(sheetName)}!B:B)-1`;
}

function formatFilterLabel(key, id, config) {
  const filter = (config?.filters || []).find((f) => f.key === key);
  const options = filter?.options;
  if (options) return labelOf(options, id) || id;
  if (key === 'period') return labelOf(PERIODS, id) || id;
  if (key === 'population') return labelOf(POPULATIONS, id) || id;
  if (key === 'region') return labelOf(REGIONS, id) || id;
  if (key === 'attention') return labelOf(ATTENTION, id) || id;
  if (key === 'freshness') return labelOf(FRESHNESS, id) || id;
  return id;
}

export function listActiveVisualFilters(filters = {}, config) {
  const rows = [];
  for (const [key, value] of Object.entries(filters || {})) {
    const ids = asFilterIds(value);
    if (!ids.length) continue;
    const filter = (config?.filters || []).find((f) => f.key === key);
    const dimLabel = filter?.label || key;
    for (const id of ids) {
      rows.push({
        dimension: key,
        dimensionLabel: dimLabel,
        valueId: id,
        valueLabel: formatFilterLabel(key, id, config),
      });
    }
  }
  return rows;
}

/** Tile sheets in report-friendly order: results near the front, PSA sources last. */
export function lineageTilesForExport(lineage) {
  if (!lineage?.layers) return [];
  return [
    lineage.layers.query,
    lineage.layers.aggregate,
    lineage.layers.dso,
    lineage.layers.transformation,
    ...(lineage.layers.psa || []),
  ].filter(Boolean);
}

function cellValue(col, row) {
  const raw = row?.[col.key];
  if (col.key === 'period' && raw != null && raw !== '') {
    return labelOf(PERIODS, raw) || String(raw);
  }
  if (col.key === 'attention' && raw != null && raw !== '') {
    return labelOf(ATTENTION, raw) || String(raw);
  }
  if (col.key === 'population' && raw != null && raw !== '') {
    return labelOf(POPULATIONS, raw) || String(raw);
  }
  if (col.key === 'region' && raw != null && raw !== '') {
    return labelOf(REGIONS, raw) || String(raw);
  }
  if (col.key === 'freshness' && raw != null && raw !== '') {
    return labelOf(FRESHNESS, raw) || String(raw);
  }
  if (raw == null) return '';
  if (typeof raw === 'number') return raw;
  return String(raw);
}

function writeDataSheet(workbook, sheetName, node) {
  const ws = workbook.addWorksheet(sheetName);
  ws.columns = LINEAGE_EXPORT_COLUMNS.map((col) => ({
    header: col.label,
    key: col.key,
    width: Math.min(36, Math.max(12, col.label.length + 4)),
  }));
  ws.getRow(1).font = { bold: true };

  const rows = Array.isArray(node.rows) ? node.rows : [];
  for (const row of rows) {
    const values = {};
    for (const col of LINEAGE_EXPORT_COLUMNS) {
      values[col.key] = cellValue(col, row);
    }
    ws.addRow(values);
  }

  const metaStart = rows.length + 3;
  ws.getCell(`A${metaStart}`).value = 'Layer';
  ws.getCell(`B${metaStart}`).value = node.detail?.layer || node.title || '';
  ws.getCell(`A${metaStart + 1}`).value = 'Technical name';
  ws.getCell(`B${metaStart + 1}`).value = node.technicalName || '';
  ws.getCell(`A${metaStart + 2}`).value = 'Note';
  ws.getCell(`B${metaStart + 2}`).value = node.detail?.note || node.meta || '';

  return { sheetName, rowCount: rows.length, node };
}

function roleForNode(node) {
  const layer = node.layer || node.type || '';
  if (layer === 'query' || node.type === 'report') {
    return 'Report result set returned to the Analytical List Page under the filters above.';
  }
  if (layer === 'aggregate' || node.type === 'cube') {
    return 'Filtered cube cardinality (REAL + labeled Gaps) after visual filters.';
  }
  if (layer === 'dso' || node.type === 'detailDso') {
    return 'Detail DSO REAL rows in scope (Gaps bypass Transformation/DSO cardinality).';
  }
  if (layer === 'transformation' || node.type === 'transformation') {
    return 'REAL rows after cleanse under current filters.';
  }
  return 'Source partition contributing rows that union into the filtered cube.';
}

/**
 * Create workbook. Report sheet is always first.
 */
export async function buildLineageWorkbook({ lineage, config, filters = {} }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DecisionPro Kentucky';
  workbook.created = new Date();
  workbook.modified = new Date();

  const usedNames = new Set(['report']);
  const tiles = lineageTilesForExport(lineage);
  const tileSheets = [];

  const report = workbook.addWorksheet('Report', {
    properties: { tabColor: { argb: 'FF0B5F8A' } },
  });

  for (const node of tiles) {
    const sheetName = excelSafeSheetName(node.technicalName || node.id, usedNames);
    tileSheets.push(writeDataSheet(workbook, sheetName, node));
  }

  report.getColumn(1).width = 32;
  report.getColumn(2).width = 44;
  report.getColumn(3).width = 28;
  report.getColumn(4).width = 22;
  report.getColumn(5).width = 58;
  report.getColumn(6).width = 18;
  report.getColumn(7).width = 22;

  let r = 1;
  report.getCell(`A${r}`).value = 'DecisionPro — Data Lineage & Provenance export';
  report.getCell(`A${r}`).font = { bold: true, size: 14 };
  r += 1;
  report.getCell(`A${r}`).value = config?.title || lineage.roomId || 'Evidence Room';
  r += 1;
  report.getCell(`A${r}`).value = `Exported ${new Date().toISOString()}`;
  report.getCell(`A${r}`).font = { italic: true, color: { argb: 'FF666666' } };
  r += 2;

  report.getCell(`A${r}`).value = '1. Visual filters (graphical / adapted filters)';
  report.getCell(`A${r}`).font = { bold: true, size: 12 };
  r += 1;
  report.getCell(`A${r}`).value = 'Dimension';
  report.getCell(`B${r}`).value = 'Filter value';
  report.getCell(`C${r}`).value = 'Value id';
  report.getRow(r).font = { bold: true };
  r += 1;

  const filterRows = listActiveVisualFilters(filters, config);
  if (!filterRows.length) {
    report.getCell(`A${r}`).value = '(none)';
    report.getCell(`B${r}`).value = 'No adapted filters — full room cube';
    r += 1;
  } else {
    for (const fr of filterRows) {
      report.getCell(`A${r}`).value = fr.dimensionLabel;
      report.getCell(`B${r}`).value = fr.valueLabel;
      report.getCell(`C${r}`).value = fr.valueId;
      r += 1;
    }
  }
  r += 1;

  report.getCell(`A${r}`).value = 'Filter scope summary';
  report.getCell(`B${r}`).value = lineage.filterSummary || '';
  r += 2;

  report.getCell(`A${r}`).value = '2. How filters combine into report results';
  report.getCell(`A${r}`).font = { bold: true, size: 12 };
  r += 1;
  report.getCell(`A${r}`).value =
    'Bottom-up warehouse path: PSA source sheets → Transformation (REAL cleanse) → Detail DSO → Aggregate cube → Query (ALP report). Record counts are Excel formulas (COUNTA of Title on each tile sheet, minus header).';
  report.mergeCells(`A${r}:E${r}`);
  report.getCell(`A${r}`).alignment = { wrapText: true };
  report.getRow(r).height = 40;
  r += 2;

  report.getCell(`A${r}`).value = 'Layer';
  report.getCell(`B${r}`).value = 'Technical name';
  report.getCell(`C${r}`).value = 'Sheet';
  report.getCell(`D${r}`).value = 'Record count (formula)';
  report.getCell(`E${r}`).value = 'Role in combination';
  report.getRow(r).font = { bold: true };
  r += 1;

  for (const tile of tileSheets) {
    report.getCell(`A${r}`).value = tile.node.detail?.layer || tile.node.title || '';
    report.getCell(`B${r}`).value = tile.node.technicalName || '';
    report.getCell(`C${r}`).value = tile.sheetName;
    report.getCell(`D${r}`).value = { formula: countTitleFormula(tile.sheetName) };
    report.getCell(`E${r}`).value = roleForNode(tile.node);
    r += 1;
  }
  r += 1;

  report.getCell(`A${r}`).value = '3. Combination checks (formulas)';
  report.getCell(`A${r}`).font = { bold: true, size: 12 };
  r += 1;

  const findSheet = (id) => tileSheets.find((t) => t.node.id === id);
  const queryTile = findSheet('query');
  const aggTile = findSheet('aggregate');
  const dsoTile = findSheet('dso');
  const trfnTile = findSheet('trfn');
  const psaTiles = tileSheets.filter((t) => t.node.layer === 'psa');

  report.getCell(`A${r}`).value = 'Query record count';
  if (queryTile) report.getCell(`B${r}`).value = { formula: countTitleFormula(queryTile.sheetName) };
  r += 1;

  report.getCell(`A${r}`).value = 'Aggregate record count';
  if (aggTile) report.getCell(`B${r}`).value = { formula: countTitleFormula(aggTile.sheetName) };
  r += 1;

  report.getCell(`A${r}`).value = 'Query equals Aggregate?';
  if (queryTile && aggTile) {
    report.getCell(`B${r}`).value = {
      formula: `IF((${countTitleFormula(queryTile.sheetName)})=(${countTitleFormula(aggTile.sheetName)}),"Yes — report rows match filtered cube","No")`,
    };
  }
  r += 1;

  report.getCell(`A${r}`).value = 'Transformation (REAL) count';
  if (trfnTile) report.getCell(`B${r}`).value = { formula: countTitleFormula(trfnTile.sheetName) };
  r += 1;

  report.getCell(`A${r}`).value = 'Detail DSO (REAL) count';
  if (dsoTile) report.getCell(`B${r}`).value = { formula: countTitleFormula(dsoTile.sheetName) };
  r += 1;

  report.getCell(`A${r}`).value = 'Sum of PSA sheet counts';
  if (psaTiles.length) {
    report.getCell(`B${r}`).value = {
      formula: psaTiles.map((t) => `(${countTitleFormula(t.sheetName)})`).join('+'),
    };
  } else {
    report.getCell(`B${r}`).value = 0;
  }
  r += 1;

  report.getCell(`A${r}`).value = 'PSA sum equals Query?';
  if (queryTile && psaTiles.length) {
    const psaSum = psaTiles.map((t) => `(${countTitleFormula(t.sheetName)})`).join('+');
    report.getCell(`B${r}`).value = {
      formula: `IF((${psaSum})=(${countTitleFormula(queryTile.sheetName)}),"Yes — source partitions cover the filtered report set","Review PSA vs Query")`,
    };
  }
  r += 2;

  report.getCell(`A${r}`).value = '4. Report results preview (references into Query sheet)';
  report.getCell(`A${r}`).font = { bold: true, size: 12 };
  r += 1;
  report.getCell(`A${r}`).value =
    'Cells below pull live values from the Query tile sheet so you can see how filtered inputs become the ALP result set.';
  report.mergeCells(`A${r}:G${r}`);
  r += 1;

  const previewHeaders = ['Title', 'Kind', 'Value', 'Period', 'As of', 'FromSysID', 'Gap ID'];
  // LINEAGE_EXPORT_COLUMNS: B title, C kind, D value, G period, H asOf, I fromSysId, J gapId
  const previewCols = ['B', 'C', 'D', 'G', 'H', 'I', 'J'];
  previewHeaders.forEach((h, i) => {
    const cell = report.getCell(r, i + 1);
    cell.value = h;
    cell.font = { bold: true };
  });
  r += 1;

  const previewRows = 25;
  if (queryTile) {
    for (let i = 0; i < previewRows; i += 1) {
      const srcRow = 2 + i;
      for (let c = 0; c < previewCols.length; c += 1) {
        const ref = `${quoteSheet(queryTile.sheetName)}!${previewCols[c]}${srcRow}`;
        report.getCell(r, c + 1).value = {
          formula: `IF(${ref}="","",${ref})`,
        };
      }
      r += 1;
    }
  }
  r += 2;

  report.getCell(`A${r}`).value = 'Notes';
  report.getCell(`A${r}`).font = { bold: true };
  r += 1;
  report.getCell(`A${r}`).value =
    'Aggregate / de-identified legislative decision-support only — no PHI. Gaps are labeled and carry no synthetic magnitudes. Open each tile sheet for full row-level detail.';
  report.mergeCells(`A${r}:E${r}`);
  report.getCell(`A${r}`).alignment = { wrapText: true };

  return workbook;
}

export async function downloadLineageWorkbook({ lineage, config, filters = {}, fileName }) {
  const workbook = await buildLineageWorkbook({ lineage, config, filters });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const safeRoom = String(lineage.roomId || 'room').replace(/[^\w-]+/g, '_');
  const name = fileName || `DecisionPro-lineage-${safeRoom}-${stamp}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return name;
}
