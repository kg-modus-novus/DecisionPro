/**
 * Generic CSV export. buildCsvText is pure and unit-testable; downloadCsv
 * triggers a browser download (mirrors the Blob-URL pattern already used by
 * exportLineageWorkbook.js's downloadLineageWorkbook).
 */

function csvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** @param {Array<Record<string, unknown>>} rows @param {string[]} [columns] */
export function buildCsvText(rows, columns) {
  const cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
  const lines = [cols.join(',')];
  for (const row of rows) {
    lines.push(cols.map((c) => csvCell(row[c])).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCsv(rows, { columns, fileName } = {}) {
  const text = buildCsvText(rows, columns);
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'decisionpro-export.csv';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
