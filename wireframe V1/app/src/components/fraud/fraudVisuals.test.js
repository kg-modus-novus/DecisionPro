import { describe, expect, it } from 'vitest';
import { TIER_RULE } from '../../lib/fraud/potentialFraudSignalProgram.js';
import { TIER_COLORS, TIER_DISPLAY_ORDER, tierShortLabel } from './fraudVisuals.jsx';
import { TIER_CLASS } from './fraudFormat.jsx';

describe('fraud visuals', () => {
  it('lists and colors every suggested tier exactly once, so the money bar adds up', () => {
    const ruleKeys = TIER_RULE.map((t) => t.key).sort();
    expect([...TIER_DISPLAY_ORDER].sort()).toEqual(ruleKeys);
    expect(Object.keys(TIER_COLORS).sort()).toEqual(ruleKeys);
    expect(Object.keys(TIER_CLASS).sort()).toEqual(ruleKeys);
  });

  it('reads the short tier label from the rule', () => {
    expect(TIER_RULE.map((t) => tierShortLabel(t))).toEqual(['CLOSED', 'EXPLAINED', 'LOOK-BACK', 'HIGH', 'VERIFY', 'CONVENTION?', 'LOW']);
  });
});

describe('explanation labels', () => {
  it('words every tag, kind of explanation and timing the program names, and nothing else', async () => {
    const { EXPLANATION_TAGS, EXPLANATION_KINDS, POLICY_EVENT_TIMINGS, INNOCENT_EXPLANATION_TAGS } = await import('../../lib/fraud/potentialFraudSignalProgram.js');
    const { EXPLANATION_TAG_LABELS, EXPLANATION_TAG_CLASS, EXPLANATION_KIND_LABELS, POLICY_TIMING_LABELS } = await import('./fraudVisuals.jsx');
    expect(Object.keys(EXPLANATION_TAG_LABELS).sort()).toEqual([...EXPLANATION_TAGS].sort());
    expect(Object.keys(EXPLANATION_TAG_CLASS).sort()).toEqual([...EXPLANATION_TAGS].sort());
    expect(Object.keys(EXPLANATION_KIND_LABELS).sort()).toEqual([...EXPLANATION_KINDS].sort());
    expect(Object.keys(POLICY_TIMING_LABELS).sort()).toEqual([...POLICY_EVENT_TIMINGS].sort());
    // The Director's labels, as decided.
    expect(EXPLANATION_TAG_LABELS).toMatchObject({ explained: 'EXPLAINED', 'safeguard-relaxed': 'safeguard relaxed', 'may-explain': 'may explain', 'none-found': 'none found', 'partly-searched': 'partly searched', 'not-searched': 'not searched', 'restriction-or-enforcement': 'restriction or enforcement' });
    expect(POLICY_TIMING_LABELS['same-year']).toBe('same year');
    expect([...INNOCENT_EXPLANATION_TAGS]).toEqual(['explained', 'may-explain']);
  });
});

describe('signal fingerprint', () => {
  it('labels exactly the screen patterns', async () => {
    const { SCREEN_PATTERNS } = await import('../../lib/fraud/potentialFraudSignalProgram.js');
    const { PATTERN_LABELS } = await import('../../data/potentialFraudCatalog.js');
    expect(Object.keys(PATTERN_LABELS).sort()).toEqual([...SCREEN_PATTERNS].sort());
  });

  it('names every scored signal once, in the weights order', async () => {
    const { SIGNAL_WEIGHTS } = await import('../../lib/fraud/potentialFraudSignalProgram.js');
    const { SIGNAL_SHORT_LABELS } = await import('./fraudVisuals.jsx');
    expect(Object.keys(SIGNAL_SHORT_LABELS)).toEqual(Object.keys(SIGNAL_WEIGHTS));
  });
});
