import { describe, expect, it } from 'vitest';
import { EVIDENCE_ROOMS, FOCUS_TABS } from '../data/fixtures.js';
import {
  ROLE_IDS,
  ROLE_PROFILES,
  getRoleProfile,
  listRoleProfiles,
  orderedEvidenceRooms,
} from '../data/roleProfiles.js';

const REQUIRED_KEYS = [
  'id',
  'label',
  'shortLabel',
  'category',
  'accent',
  'icon',
  'eyebrow',
  'purpose',
  'dataEmphasis',
  'functionality',
  'homePriorities',
  'keyMeasures',
  'recommendedRooms',
  'primaryActions',
  'navRoomOrder',
  'initialState',
  'askSamHint',
  'briefEmphasis',
  'limitations',
];

const FOCUS_IDS = new Set(FOCUS_TABS.map((t) => t.id));
const ROOM_IDS = new Set(EVIDENCE_ROOMS.map((r) => r.id));

describe('roleProfiles', () => {
  it('defines exactly seven roles', () => {
    expect(ROLE_IDS).toHaveLength(7);
    expect(listRoleProfiles()).toHaveLength(7);
    expect(Object.keys(ROLE_PROFILES).sort()).toEqual([...ROLE_IDS].sort());
  });

  it('each profile is complete with valid defaults', () => {
    for (const id of ROLE_IDS) {
      const profile = getRoleProfile(id);
      expect(profile).toBeTruthy();
      for (const key of REQUIRED_KEYS) {
        expect(profile[key], `${id}.${key}`).toBeTruthy();
      }
      expect(profile.id).toBe(id);
      expect(profile.dataEmphasis.length).toBeGreaterThan(1);
      expect(profile.functionality.length).toBeGreaterThan(1);
      expect(profile.homePriorities.length).toBeGreaterThan(1);
      expect(profile.keyMeasures.length).toBeGreaterThan(0);
      expect(profile.recommendedRooms.every((r) => ROOM_IDS.has(r))).toBe(true);
      expect(profile.navRoomOrder.every((r) => ROOM_IDS.has(r))).toBe(true);
      expect(new Set(profile.navRoomOrder).size).toBe(profile.navRoomOrder.length);

      const init = profile.initialState;
      expect(init.view).toBe('role-home');
      expect(init.selectedFocuses.every((f) => FOCUS_IDS.has(f))).toBe(true);
      for (const focus of FOCUS_IDS) {
        expect(typeof init.weights[focus]).toBe('number');
      }
      if (init.activeEvidenceId) {
        expect(ROOM_IDS.has(init.activeEvidenceId)).toBe(true);
      }
      expect(profile.primaryActions.every((a) => a.id && a.label && a.view)).toBe(true);
      expect(profile.askSamHint.toLowerCase()).not.toMatch(/permission|authorize|acl/);
    }
  });

  it('orders evidence rooms by role without dropping rooms', () => {
    const ordered = orderedEvidenceRooms('legislator', EVIDENCE_ROOMS);
    expect(ordered).toHaveLength(EVIDENCE_ROOMS.length);
    expect(ordered[0].id).toBe('county');
    expect(new Set(ordered.map((r) => r.id))).toEqual(ROOM_IDS);

    const fallback = orderedEvidenceRooms('missing', EVIDENCE_ROOMS);
    expect(fallback.map((r) => r.id)).toEqual(EVIDENCE_ROOMS.map((r) => r.id));
  });
});
