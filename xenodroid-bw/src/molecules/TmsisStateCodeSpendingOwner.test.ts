import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ParseStagedStateCodeYearCsv, ParseStagedStateMonthCsv } from './TmsisStateCodeSpendingOwner.js';

// Run: node --import tsx --test src/molecules/TmsisStateCodeSpendingOwner.test.ts

describe('ParseStagedStateCodeYearCsv', () => {
  it('types every column and marks UNMATCHED rows as attribution none', () => {
    const rows = ParseStagedStateCodeYearCsv([
      'yr,hcpcs,state,attribution,lines,paid,patient_cells,cells,billing_npis,new_billing_npis,top10_paid,zero_paid_lines',
      '2024,H2027,KY,billing-or-servicing,571102,142998855.11,103980,2200,171,124,83200000.00,0',
      '2024,H2027,UNMATCHED,none,12,1000.50,12,1,1,1,1000.50,0',
    ].join('\n'));
    assert.equal(rows.length, 2);
    assert.equal(rows[0].year, 2024);
    assert.equal(rows[0].paid, 142998855.11);
    assert.equal(rows[0].new_billing_npis, 124);
    assert.equal(rows[0].attribution, 'billing-or-servicing');
    assert.equal(rows[1].attribution, 'none');
  });

  it('rejects a non-numeric amount instead of loading a null', () => {
    assert.throws(() => ParseStagedStateCodeYearCsv([
      'yr,hcpcs,state,attribution,lines,paid,patient_cells,cells,billing_npis,new_billing_npis,top10_paid,zero_paid_lines',
      '2024,H2027,KY,billing-or-servicing,571102,,103980,2200,171,124,83200000.00,0',
    ].join('\n')), /non-numeric paid/);
  });
});

describe('ParseStagedStateMonthCsv', () => {
  it('requires a YYYY-MM month', () => {
    assert.deepEqual(ParseStagedStateMonthCsv('month,state,lines,paid\n2024-12,KY,10,108523255.30'), [
      { state_code: 'KY', month_ym: '2024-12', claim_lines: 10, paid: 108523255.3 },
    ]);
    assert.throws(() => ParseStagedStateMonthCsv('month,state,lines,paid\n202412,KY,10,1'), /bad row/);
  });
});
