import { describe, expect, it } from 'vitest';
import { TIER_RULE } from '../../lib/fraud/potentialFraudSignalProgram.js';
import { TIER_COLORS, TIER_DISPLAY_ORDER, tierShortLabel } from './fraudVisuals.jsx';

describe('fraud visuals', () => {
  it('lists and colors every suggested tier exactly once, so the money bar adds up', () => {
    const ruleKeys = TIER_RULE.map((t) => t.key).sort();
    expect([...TIER_DISPLAY_ORDER].sort()).toEqual(ruleKeys);
    expect(Object.keys(TIER_COLORS).sort()).toEqual(ruleKeys);
  });

  it('reads the short tier label from the rule', () => {
    expect(TIER_RULE.map((t) => tierShortLabel(t))).toEqual(['CLOSED', 'LOOK-BACK', 'HIGH', 'VERIFY', 'CONVENTION?', 'LOW']);
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
