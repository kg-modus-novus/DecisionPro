import { describe, expect, it } from 'vitest';
import { EVIDENCE_ROOMS } from '../data/fixtures.js';
import { ROLE_IDS, orderedEvidenceRooms } from '../data/roleProfiles.js';
import {
  listWalkthroughCoverageKeys,
  resolveRoleTourSteps,
  resolveNextWalkthroughRoute,
  resolveWalkthroughSteps,
  roleTourKey,
  walkthroughTourKey,
} from '../data/walkthroughs.js';

describe('walkthroughs', () => {
  it('provides one role tour key for each supported role', () => {
    const keys = listWalkthroughCoverageKeys();
    expect(keys).toEqual(ROLE_IDS.map((id) => `role-tour:${id}`));
    for (const id of ROLE_IDS) expect(roleTourKey(id)).toBe(`role-tour:${id}`);
    expect(roleTourKey(null)).toBeNull();
  });

  it('defaults to a short role-home orientation (not every nav destination)', () => {
    for (const roleId of ROLE_IDS) {
      const steps = resolveRoleTourSteps(roleId);
      expect(steps.map((step) => step.target)).toEqual([
        'role-home-priorities',
        'role-home-rooms',
        'role-home-actions',
      ]);
      expect(steps).toHaveLength(3);
      for (const step of steps) {
        expect(step.route).toMatchObject({ view: 'role-home' });
      }
    }
  });

  it('builds the complete role-ordered destination sequence when requested', () => {
    for (const roleId of ROLE_IDS) {
      const profileRooms = orderedEvidenceRooms(roleId, EVIDENCE_ROOMS);
      const steps = resolveRoleTourSteps(roleId, { includeDestinations: true });
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

  it('resolves a dedicated walkthrough for every Kentucky content section', () => {
    const contexts = [
      { view: 'role-home', first: 'role-home-priorities' },
      { view: 'operational', first: 'operational-header' },
      { view: 'sources', first: 'authoritative-sources' },
      { view: 'evidence', first: 'evidence-index-header' },
      { view: 'evidence', evidenceId: 'mco', first: 'alp-analytical-header' },
      { view: 'evidence', evidenceId: 'mco', evidenceObjectId: 'row-1', first: 'object-header' },
      { view: 'blender', first: 'blender-title' },
      { view: 'pack', first: 'pack-title' },
      { view: 'brief', first: 'brief-toolbar' },
      { view: 'legislation', first: 'legislation-header' },
      { view: 'law-object', lawId: 'law-1', first: 'law-object-header' },
    ];

    for (const { first, ...ctx } of contexts) {
      const steps = resolveWalkthroughSteps({ roleId: 'legislator', ...ctx });
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0].target).toBe(first);
      for (const guideStep of steps) {
        expect(guideStep.title).toBeTruthy();
        expect(guideStep.purpose).toBeTruthy();
        expect(guideStep.data).toBeTruthy();
        expect(guideStep.functionality).toBeTruthy();
      }
    }
  });

  it('keeps page guides isolated by role, page, and opened object', () => {
    expect(walkthroughTourKey({ roleId: 'legislator', view: 'role-home' }))
      .toBe('role-tour:legislator');
    expect(walkthroughTourKey({ roleId: 'legislator', view: 'operational' }))
      .toBe('page-tour:legislator:operational');
    expect(walkthroughTourKey({ roleId: 'legislator', view: 'evidence', evidenceId: 'mco' }))
      .toBe('page-tour:legislator:mco');
    expect(walkthroughTourKey({
      roleId: 'legislator',
      view: 'evidence',
      evidenceId: 'mco',
      evidenceObjectId: 'row-1',
    })).toBe('page-tour:legislator:object:mco:row-1');
  });

  it('does not offer a guide before a role is selected', () => {
    expect(resolveWalkthroughSteps({ view: 'role-selector' })).toEqual([]);
    expect(walkthroughTourKey({ view: 'role-selector' })).toBeNull();
  });

  it('provides a continuous logical route between page guides', () => {
    const roleId = 'legislator';
    expect(resolveNextWalkthroughRoute({ roleId, view: 'role-home' }))
      .toMatchObject({ view: 'operational' });
    expect(resolveNextWalkthroughRoute({ roleId, view: 'operational' }))
      .toMatchObject({ view: 'sources' });
    expect(resolveNextWalkthroughRoute({ roleId, view: 'sources' }))
      .toMatchObject({ view: 'evidence', activeEvidenceId: null });
    expect(resolveNextWalkthroughRoute({ roleId, view: 'evidence' }))
      .toMatchObject({ view: 'blender' });
    expect(resolveNextWalkthroughRoute({ roleId, view: 'blender' }))
      .toMatchObject({ view: 'legislation' });
    expect(resolveNextWalkthroughRoute({ roleId, view: 'legislation' }))
      .toMatchObject({ view: 'role-home' });
    expect(resolveNextWalkthroughRoute({ roleId, view: 'pack' }))
      .toMatchObject({ view: 'brief' });
    expect(resolveNextWalkthroughRoute({ roleId, view: 'law-object' }))
      .toMatchObject({ view: 'legislation' });
    expect(resolveNextWalkthroughRoute({ view: 'role-home' })).toBeNull();
  });
});
