/**
 * Excel workbook for Source Reconciliation last-run (executive summary + check detail).
 */

import ExcelJS from 'exceljs';

export function buildSourceReconciliationWorkbook(payload) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DecisionPro';
  wb.created = new Date();

  const process = payload?.process || {};
  const lastRun = payload?.lastRun || {};
  const summary = lastRun.summary || {};
  const results = lastRun.results || [];

  const summarySheet = wb.addWorksheet('Executive_Summary', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 72 },
  ];
  const summaryRows = [
    ['Process', process.name || 'Source Reconciliation'],
    ['Business Action', process.businessAction || 'Reconcile Published Measures'],
    ['Generated at', payload?.generatedAt || ''],
    ['Last run at', lastRun.ranAt || ''],
    ['Trigger', lastRun.trigger || ''],
    ['Overall status', lastRun.overallStatus || ''],
    ['Claim allowed', summary.claimAllowed ? 'YES' : 'NO'],
    ['Checks total', summary.checksTotal ?? results.length],
    ['Checks passed', summary.checksPassed ?? ''],
    ['Checks failed', summary.checksFailed ?? ''],
    ['Check error', lastRun.checkError || ''],
    ['Note', payload?.note || ''],
  ];
  for (const [field, value] of summaryRows) {
    summarySheet.addRow({ field, value: value == null ? '' : String(value) });
  }

  const bullets = summary.executiveBullets || [];
  if (bullets.length) {
    summarySheet.addRow({});
    summarySheet.addRow({ field: 'Executive headline', value: 'Measure' });
    for (const b of bullets) {
      summarySheet.addRow({
        field: b.measureId,
        value: `${b.name || b.measureId}: actual=${b.displayValue} expected=${b.expected} (${b.result}) · ${b.fromSysId || ''} · ${b.sourcePageUri || b.sourceUri || ''}`,
      });
    }
  }

  const stepsSheet = wb.addWorksheet('Process_Steps');
  stepsSheet.columns = [
    { header: 'Step ID', key: 'id', width: 18 },
    { header: 'Title', key: 'title', width: 32 },
    { header: 'Summary', key: 'summary', width: 80 },
    { header: 'Advisory', key: 'advisory', width: 12 },
  ];
  for (const step of process.steps || []) {
    stepsSheet.addRow({
      id: step.id,
      title: step.title,
      summary: step.summary,
      advisory: step.advisory ? 'YES' : 'NO',
    });
  }

  const resultsSheet = wb.addWorksheet('Reconciliation_Results', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  resultsSheet.columns = [
    { header: 'Measure ID', key: 'measureId', width: 16 },
    { header: 'Name', key: 'name', width: 40 },
    { header: 'Result', key: 'result', width: 10 },
    { header: 'Expected', key: 'expected', width: 28 },
    { header: 'Actual', key: 'actual', width: 28 },
    { header: 'Detail', key: 'detail', width: 48 },
    { header: 'FromSysID', key: 'fromSysId', width: 28 },
    { header: 'As of', key: 'asOfDate', width: 14 },
    { header: 'LoadHistory', key: 'loadHistoryId', width: 40 },
    { header: 'Source page', key: 'sourcePageUri', width: 48 },
    { header: 'Source file', key: 'sourceUri', width: 48 },
    { header: 'Publisher', key: 'publisher', width: 28 },
  ];
  for (const r of results) {
    resultsSheet.addRow({
      measureId: r.measureId,
      name: r.name || '',
      result: r.result || (r.ok ? 'PASS' : 'FAIL'),
      expected: r.expected,
      actual: r.actual,
      detail: r.detail,
      fromSysId: r.fromSysId || '',
      asOfDate: r.asOfDate || '',
      loadHistoryId: r.loadHistoryId || '',
      sourcePageUri: r.sourcePageUri || '',
      sourceUri: r.sourceUri || '',
      publisher: r.publisher || '',
    });
  }

  // Hyperlink source columns when URI-like
  for (let i = 2; i <= resultsSheet.rowCount; i += 1) {
    for (const col of [10, 11]) {
      const cell = resultsSheet.getRow(i).getCell(col);
      const v = String(cell.value || '');
      if (/^https?:\/\//i.test(v)) {
        cell.value = { text: v, hyperlink: v };
        cell.font = { color: { argb: 'FF0563C1' }, underline: true };
      }
    }
  }

  return wb;
}

export async function downloadSourceReconciliationWorkbook(payload) {
  const wb = buildSourceReconciliationWorkbook(payload);
  const buffer = await wb.xlsx.writeBuffer();
  const stamp = String(payload?.lastRun?.ranAt || payload?.generatedAt || new Date().toISOString()).slice(0, 10);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `decisionpro-source-reconciliation-${stamp}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
