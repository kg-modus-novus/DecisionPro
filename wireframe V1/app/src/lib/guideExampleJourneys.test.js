import { describe, expect, it } from 'vitest';
import { ROLE_IDS } from '../data/roleProfiles.js';
import { resolveRoleTourSteps } from '../data/walkthroughs.js';
import {
  GUIDE_EXAMPLE_JOURNEYS,
  buildGuideExampleSteps,
  getGuideExampleJourney,
  listGuideExampleJourneys,
  resolveGuideExampleLeadRow,
  validateGuideExampleFixtures,
} from '../data/guideExampleJourneys.js';

describe('guideExampleJourneys fixtures', () => {
  it('provides one validated journey for every regular Guide step', () => {
    const result = validateGuideExampleFixtures();
    expect(result.errors, result.errors.join('\n')).toEqual([]);
    expect(result.ok).toBe(true);
    expect(listGuideExampleJourneys()).toHaveLength(133);
    expect(Object.keys(GUIDE_EXAMPLE_JOURNEYS)).toHaveLength(133);
  });

  it('wires every role-tour step to a choice-ending journey with tryStartApply', () => {
    for (const roleId of ROLE_IDS) {
      for (const step of resolveRoleTourSteps(roleId, { includeDestinations: true })) {
        const journey = getGuideExampleJourney(roleId, step.id);
        expect(journey, `${roleId}:${step.id}`).toBeTruthy();
        expect(journey.tryStartApply).toBeTruthy();
        const last = journey.steps.at(-1);
        expect(last.choice).toBe(true);
        expect(last.tryStartApply || journey.tryStartApply).toBeTruthy();
        const built = buildGuideExampleSteps(journey, {
          leadRow: resolveGuideExampleLeadRow(journey),
        });
        expect(built.every((item) => item.mode === 'show-me')).toBe(true);
        expect(built.at(-1).choice).toBe(true);
      }
    }
  });

  it('keeps unique journey ids and concrete narrative targets', () => {
    const ids = listGuideExampleJourneys().map((journey) => journey.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const journey of listGuideExampleJourneys()) {
      for (const step of journey.steps) {
        expect(step.target).toBeTruthy();
        expect(step.narrative).toBeTruthy();
      }
    }
  });
});
