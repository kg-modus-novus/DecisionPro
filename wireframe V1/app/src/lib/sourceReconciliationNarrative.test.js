import { describe, expect, it } from 'vitest';
import {
  RECON_STEPS,
  buildExecutiveParagraphs,
  triggerLabel,
} from './sourceReconciliationNarrative.js';

describe('sourceReconciliationNarrative', () => {
  it('explains triggers in plain language', () => {
    expect(triggerLabel('accuracy-check')).toMatch(/Source Reconciliation/);
    expect(triggerLabel('export-ui')).toMatch(/export/i);
  });

  it('builds full-sentence executive paragraphs from a passing run', () => {
    const paras = buildExecutiveParagraphs({
      lastRun: { ranAt: '2026-08-02T13:52:44.017Z', trigger: 'accuracy-check' },
      summary: { checksTotal: 33, checksPassed: 33, checksFailed: 0, claimAllowed: true },
      results: Array.from({ length: 33 }, () => ({ ok: true })),
      overall: 'PASS',
      claimAllowed: true,
    });
    expect(paras.what).toMatch(/Source Reconciliation is/);
    expect(paras.why).toMatch(/trust/);
    expect(paras.whenItRuns).toMatch(/after every REAL/);
    expect(paras.resultsPara).toMatch(/All 33 automated checks passed/);
    expect(paras.resultsPara.endsWith('.')).toBe(true);
  });

  it('keeps five ordered reconciliation steps with prose summaries', () => {
    expect(RECON_STEPS).toHaveLength(5);
    expect(RECON_STEPS.every((s) => s.summary.includes('.'))).toBe(true);
    expect(RECON_STEPS.filter((s) => s.advisory)).toHaveLength(1);
  });
});
