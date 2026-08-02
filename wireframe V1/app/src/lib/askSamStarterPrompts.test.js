import { describe, expect, it } from 'vitest';
import { ROLE_IDS } from '../data/roleProfiles.js';
import { buildAskSamStarterPrompts } from './askSamStarterPrompts.js';

describe('buildAskSamStarterPrompts', () => {
  it('returns three unique dashboard-grounded questions for each role', () => {
    for (const roleId of ROLE_IDS) {
      const prompts = buildAskSamStarterPrompts({ roleId });
      expect(prompts).toHaveLength(3);
      expect(new Set(prompts).size).toBe(3);
      for (const p of prompts) {
        expect(p.endsWith('?')).toBe(true);
        expect(p.length).toBeGreaterThan(20);
      }
    }
  });

  it('surfaces enrollment decline for legislator Accurate Landing', () => {
    const prompts = buildAskSamStarterPrompts({ roleId: 'legislator' });
    expect(prompts.some((p) => /enrollment down/i.test(p))).toBe(true);
    expect(prompts.some((p) => /improve enrollment/i.test(p))).toBe(true);
  });

  it('surfaces pharmacy / cost framing for budget analyst', () => {
    const prompts = buildAskSamStarterPrompts({ roleId: 'budget-analyst' });
    expect(prompts.some((p) => /pharmacy|cost-driver|fiscal/i.test(p))).toBe(true);
  });

  it('falls back when no role is selected', () => {
    const prompts = buildAskSamStarterPrompts({});
    expect(prompts).toHaveLength(3);
  });
});
