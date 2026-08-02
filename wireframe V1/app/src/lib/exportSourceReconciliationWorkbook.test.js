import { describe, expect, it } from 'vitest';
import { SOURCE_RECONCILIATION } from '../data/alp/sourceReconciliation.js';
import { buildSourceReconciliationWorkbook } from './exportSourceReconciliationWorkbook.js';

describe('exportSourceReconciliationWorkbook', () => {
  it('builds summary, process, and results sheets from last-run export', async () => {
    const wb = buildSourceReconciliationWorkbook(SOURCE_RECONCILIATION);
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Executive_Summary',
      'Process_Steps',
      'Reconciliation_Results',
    ]);
    const results = wb.getWorksheet('Reconciliation_Results');
    expect(results.rowCount).toBeGreaterThan(1);
    const summary = wb.getWorksheet('Executive_Summary');
    const statusCell = [...summary.getColumn(2).values].find((v) =>
      /^(PASS|FAIL)$/.test(String(v || '')),
    );
    expect(statusCell).toMatch(/PASS|FAIL/);
  });

  it('includes process steps and executive bullets when present', () => {
    const wb = buildSourceReconciliationWorkbook(SOURCE_RECONCILIATION);
    const steps = wb.getWorksheet('Process_Steps');
    expect(steps.rowCount).toBeGreaterThan(1);
    expect(SOURCE_RECONCILIATION.lastRun?.summary?.checksTotal).toBeGreaterThan(0);
  });
});
