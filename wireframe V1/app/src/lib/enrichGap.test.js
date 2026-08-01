import { describe, expect, it } from 'vitest';
import { GAP_OBJECTS } from '../data/alp/gapObjects.js';
import { GAP_BRIEFINGS } from '../data/alp/gapBriefings.js';
import { enrichGap } from './enrichGap.js';

describe('enrichGap', () => {
  it('covers every exported gap with a briefing', () => {
    for (const g of GAP_OBJECTS.gaps) {
      expect(GAP_BRIEFINGS[g.gapId], `missing briefing for ${g.gapId}`).toBeTruthy();
      const e = enrichGap(g);
      expect(e.whatItIs.length).toBeGreaterThan(20);
      expect(e.incorporateSteps.length).toBeGreaterThan(1);
      expect(e.whoRequests).toBeTruthy();
      expect(e.dashboardImpact).toBeTruthy();
    }
  });
});
