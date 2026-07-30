import { describe, expect, it } from 'vitest';
import { EVIDENCE_ROOMS } from '../data/fixtures.js';
import { ROLE_IDS, orderedEvidenceRooms } from '../data/roleProfiles.js';
import {
  listWalkthroughCoverageKeys,
  resolveRoleTourSteps,
  resolveWalkthroughSteps,
  roleTourKey,
} from '../data/walkthroughs.js';

describe('walkthroughs', () => {
  it('provides one role tour key for each supported role', () => {
    const keys = listWalkthroughCoverageKeys();
    expect(keys).toEqual(ROLE_IDS.map((id) => `role-tour:${id}`));
    for (const id of ROLE_IDS) expect(roleTourKey(id)).toBe(`role-tour:${id}`);
    expect(roleTourKey(null)).toBeNull();
  });

  it('builds the complete role-ordered destination sequence for all seven roles', () => {
    for (const roleId of ROLE_IDS) {
      const profileRooms = orderedEvidenceRooms(roleId, EVIDENCE_ROOMS);
      const steps = resolveRoleTourSteps(roleId);
      const expectedTargets = [
        'role-home-priorities',
        'role-home-rooms',
        'role-home-actions',
        'nav-evidence-index',
        ...profileRooms.map((room) => `nav-room-${room.id}`),
        'nav-blender',
        'nav-pack',
        'nav-brief',
        'nav-legislation',
        'nav-ask-sam',
      ];

      expect(steps.map((step) => step.target)).toEqual(expectedTargets);
      expect(steps).toHaveLength(18);

      const ids = steps.map((step) => step.id);
      const targets = steps.map((step) => step.target);
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(targets).size).toBe(targets.length);

      for (const step of steps) {
        expect(step.title).toBeTruthy();
        expect(step.purpose).toBeTruthy();
        expect(step.data).toBeTruthy();
        expect(step.functionality).toBeTruthy();
        expect(step.example).toBeTruthy();
        expect(step.route).toBeTruthy();
      }

      expect(steps[3].route).toMatchObject({ view: 'evidence', activeEvidenceId: null });
      profileRooms.forEach((room, index) => {
        expect(steps[index + 4].route).toMatchObject({
          view: 'evidence',
          activeEvidenceId: room.id,
        });
      });
      expect(steps.at(-5).route).toMatchObject({ view: 'blender' });
      expect(steps.at(-4).route).toMatchObject({ view: 'pack' });
      expect(steps.at(-3).route).toMatchObject({ view: 'brief' });
      expect(steps.at(-2).route).toMatchObject({ view: 'legislation' });
      expect(steps.at(-1).route).toEqual({ askSamOpen: true });
    }
  });

  it('does not resolve page-scoped or role-selector walkthroughs', () => {
    const ordinaryPageContexts = [
      { view: 'role-selector' },
      { view: 'evidence', evidenceId: 'mco' },
      { view: 'blender' },
      { view: 'legislation' },
    ];

    for (const ctx of ordinaryPageContexts) expect(resolveWalkthroughSteps(ctx)).toEqual([]);
  });
});
