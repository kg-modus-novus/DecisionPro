import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_STATUSES, ANALYSIS_STATUS_DETAIL, ANALYSIS_STATUS_LABELS, ANALYSIS_STATUS_LEGEND, ANALYSIS_TIERS, DETECTION_ANALYSES, DETECTION_SOURCES, SOURCE_STANDINGS, SOURCE_STANDING_PREFIX, SOURCE_STANDING_SUFFIX, standingOfSource,
} from './potentialFraudCatalog.js';
import { POTENTIAL_FRAUD_RADAR } from './alp/potentialFraudRadar.js';

const sourceByKey = Object.fromEntries(DETECTION_SOURCES.map((s) => [s.key, s]));
const coverage = Object.fromEntries(POTENTIAL_FRAUD_RADAR.coverage.map((c) => [c.dataRequestId, c]));
/** On hand against the shipped radar export, by the same rule the page uses. */
const onHand = (key) => standingOfSource(sourceByKey[key], coverage).standing !== 'missing';
const feeding = (key) => DETECTION_ANALYSES.filter((a) => a.sources.includes(key) || a.waitingOn.includes(key)).map((a) => a.short);

describe('detection tools catalog', () => {
  it('keeps the true statuses: 12 running, 9 ready, 4 need a data load', () => {
    const counts = Object.fromEntries(ANALYSIS_STATUSES.map((k) => [k, DETECTION_ANALYSES.filter((a) => a.status === k).length]));
    expect(counts).toEqual({ running: 12, ready: 9, needs: 4 });
    for (const words of [ANALYSIS_STATUS_LABELS, ANALYSIS_STATUS_LEGEND, ANALYSIS_STATUS_DETAIL]) expect(Object.keys(words)).toEqual([...ANALYSIS_STATUSES]);
  });

  it('places every analysis in a declared tier with a unique tile name', () => {
    const tiers = ANALYSIS_TIERS.map((t) => t.key);
    expect(DETECTION_ANALYSES.every((a) => tiers.includes(a.tier))).toBe(true);
    expect(new Set(DETECTION_ANALYSES.map((a) => a.short)).size).toBe(DETECTION_ANALYSES.length);
  });

  it('maps every analysis to listed sources, with unique source keys', () => {
    expect(new Set(DETECTION_SOURCES.map((s) => s.key)).size).toBe(DETECTION_SOURCES.length);
    for (const a of DETECTION_ANALYSES) {
      expect(a.sources.length).toBeGreaterThan(0);
      for (const k of [...a.sources, ...a.waitingOn]) expect(sourceByKey[k], `${a.short} → ${k}`).toBeDefined();
    }
  });

  it('agrees with each status against the shipped coverage: running and ready use only sources on hand; needs data uses one that is not', () => {
    for (const a of DETECTION_ANALYSES) {
      if (a.status === 'needs') expect(a.sources.some((k) => !onHand(k)), a.short).toBe(true);
      else expect(a.sources.every(onHand), a.short).toBe(true);
    }
    for (const a of DETECTION_ANALYSES) for (const k of a.waitingOn) expect(onHand(k), `${a.short} → ${k}`).toBe(false);
  });

  it('pins the edges the page shows', () => {
    expect(feeding('leie')).toEqual(['Exclusion list vs billers']);
    expect(feeding('segments')).toEqual(['Billing outside enrollment']);
    expect(feeding('nppes')).toEqual(['NPPES: new, taxonomy', 'NPPES: shared address']);
    expect(feeding('policy-dates')).toEqual(['Policy-event overlay']);
    expect(feeding('code-changes')).toEqual(['Code migration']);
    expect(standingOfSource(sourceByKey['policy-dates'], coverage).standing).toBe('bundled');
    expect(standingOfSource(sourceByKey['code-changes'], coverage).standing).toBe('missing');
    expect(feeding('prevalence')).toEqual(['Expected vs prevalence', 'Can health explain it']);
    expect(feeding('fmap')).toEqual([]);
    expect(sourceByKey.fmap.usedBy).toBe('the reallocation what-if');
    expect(feeding('screen').length).toBe(9);
  });

  it('shows NPPES as partial, through the T-MSIS staging, never with that load\'s row count as its own', () => {
    const s = standingOfSource(sourceByKey.nppes, coverage);
    expect(s.standing).toBe('partial');
    expect(s.load.dataRequestId).toBe('DR-REAL-TMSIS-STATE-CODE-SPENDING');
    expect(sourceByKey.nppes.dataRequestId).toBeNull();
    expect(standingOfSource(sourceByKey.leie, coverage).standing).toBe('loaded');
    expect(standingOfSource(sourceByKey['known-cases'], coverage).standing).toBe('bundled');
    expect(standingOfSource(sourceByKey.segments, coverage).standing).toBe('missing');
    expect(standingOfSource(sourceByKey.leie, {}).standing).toBe('missing');
    for (const words of [SOURCE_STANDING_PREFIX, SOURCE_STANDING_SUFFIX]) expect(Object.keys(words)).toEqual([...SOURCE_STANDINGS]);
    for (const s of DETECTION_SOURCES) expect(SOURCE_STANDINGS).toContain(standingOfSource(s, coverage).standing);
  });
});
