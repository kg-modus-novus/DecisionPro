import { describe, expect, it } from 'vitest';
import { buildAsOfExplain } from '../components/AsOfRangeInfoButton.jsx';
import { describeSeriesKind, ensureSentence } from './explainProse.js';
import { buildPsaLoadExplain } from './psaLoadExplain.js';
import { buildResultantCubeExplain } from './resultantCubeExplain.js';

describe('explain prose', () => {
  it('ensures sentences end with terminal punctuation', () => {
    expect(ensureSentence('hello world')).toBe('Hello world.');
    expect(ensureSentence('Already done.')).toBe('Already done.');
  });

  it('writes as-of explanations in full sentences', () => {
    const explain = buildAsOfExplain({
      fromSysId: 'KY_DMS_MCO_CONTRACTS',
      disposition: 'LOADED',
      provides: {
        cadence: 'event / page update',
        seriesKind: 'snapshot',
        grain: 'state × as-of roster',
      },
      availableDepth:
        'Active MCO contract roster on DMS contracts page — snapshot / event, not a continuous numerical series',
      loadedDepth: {
        earliestAsOf: '2025-01-01',
        latestAsOf: '2025-01-01',
      },
      inconsistencies: [],
    });
    expect(explain.range).toMatch(/^DecisionPro currently has a single as-of date/);
    expect(explain.range.endsWith('.')).toBe(true);
    expect(explain.publisherAvailable.endsWith('.')).toBe(true);
    expect(explain.cadence).toMatch(/^This source publishes/);
    expect(explain.cadence).toContain(describeSeriesKind('snapshot'));
    expect(explain.grain).toMatch(/^Each published record is organized as/);
    expect(explain.gaps[0]).toMatch(/single as-of date/);
  });

  it('writes PSA comparisons in full sentences', () => {
    const explain = buildPsaLoadExplain({
      fromSysId: 'CMS_RX',
      disposition: 'LOADED',
      loadedDepth: {
        sourceRecordCount: 18511,
        sourceRecordUnit: 'rows',
        loadedRowCount: 1,
        sourceScale: {
          recordCount: 18511,
          recordUnit: 'rows',
          note: 'KY program total in DecisionPro is a curated aggregate bind, not a rollup of national drug rows.',
        },
      },
    });
    expect(explain.comparison.endsWith('.')).toBe(true);
    expect(explain.comparison).toMatch(/^The publisher Source of Truth/);
    expect(explain.reason.endsWith('.')).toBe(true);
  });

  it('writes resultant cube room blurbs as full sentences', () => {
    const explain = buildResultantCubeExplain(
      {
        fromSysId: 'CMS_DATA_MEDICAID',
        loadedDepth: {
          resultantCubes: [
            { cubeId: 'command-center', label: 'command-center', rowCount: 1, factRowCount: 2 },
          ],
        },
      },
      new Map([['command-center', 2]]),
    );
    expect(explain.overview.endsWith('.')).toBe(true);
    expect(explain.tileLines).toEqual(['command-center: 1 · fact 2']);
    expect(explain.rooms[0].blurb).toMatch(/^This cube feeds/);
    expect(explain.rooms[0].countsSentence).toMatch(/^This source contributes/);
  });
});
