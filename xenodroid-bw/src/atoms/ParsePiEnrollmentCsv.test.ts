import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ParseAllStateEnrollmentFromPiCsv, ParseKentuckyEnrollmentFromPiCsv } from './ParsePiEnrollmentCsv.js';

// Run: node --import tsx --test src/atoms/ParsePiEnrollmentCsv.test.ts

const HEADER = 'State Abbreviation,State Name,Reporting Period,State Expanded Medicaid,Preliminary or Updated,Final Report,Total Medicaid and CHIP Enrollment,Total Medicaid Enrollment,Total CHIP Enrollment';
const CSV = [
  HEADER,
  'KY,Kentucky,202401,Y,P,N,"1,500,000","1,400,000","100,000"',
  'KY,Kentucky,202401,Y,U,Y,"1,437,820","1,337,820","100,000"',
  'AZ,Arizona,202401,Y,U,Y,"2,100,000","2,000,000","100,000"',
  'DC,District of Columbia,202401,Y,U,Y,"270,000","255,000","15,000"',
  'XX,Not a state,202401,N,U,Y,"1","1","0"',
  'AZ,Arizona,2024,Y,U,Y,"9","9","0"',
].join('\n');

describe('ParseAllStateEnrollmentFromPiCsv', () => {
  it('keeps one row per state and period, preferring the updated final report', () => {
    const rows = ParseAllStateEnrollmentFromPiCsv(CSV);
    assert.deepEqual(rows.map((r) => `${r.state_code}|${r.period_ym}|${r.total_enrollment}`), [
      'AZ|202401|2100000',
      'DC|202401|270000',
      'KY|202401|1437820',
      'XX|202401|1',
    ]);
  });

  it('agrees with the Kentucky parse on Kentucky', () => {
    const ky = ParseKentuckyEnrollmentFromPiCsv(CSV);
    const all = ParseAllStateEnrollmentFromPiCsv(CSV).filter((r) => r.state_code === 'KY');
    assert.deepEqual(all, ky);
  });

  it('rejects a file without the enrollment columns', () => {
    assert.throws(() => ParseAllStateEnrollmentFromPiCsv('State Abbreviation,Reporting Period\nKY,202401'), /missing required columns/);
  });
});
