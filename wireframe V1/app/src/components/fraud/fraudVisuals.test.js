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
