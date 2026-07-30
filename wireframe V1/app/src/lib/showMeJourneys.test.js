import { describe, expect, it } from 'vitest';
import {
  SHOW_ME_JOURNEYS,
  buildShowMeSteps,
  getShowMeJourney,
  listShowMeJourneys,
  resolveJourneyLeadRow,
  resolveLeadRow,
  validateShowMeFixtures,
} from '../data/showMeJourneys.js';
import { ROLE_IDS, ROLE_PROFILES } from '../data/roleProfiles.js';
import { ROOM_CONFIGS } from '../data/alp/roomConfigs.js';

describe('showMeJourneys fixtures', () => {
  it('validates seven roles × three priorities with restoration metadata', () => {
    const result = validateShowMeFixtures();
    expect(result.errors, result.errors.join('\n')).toEqual([]);
    expect(result.ok).toBe(true);
    expect(listShowMeJourneys()).toHaveLength(21);
    expect(Object.keys(SHOW_ME_JOURNEYS)).toHaveLength(21);
  });

  it('keeps unique journey and priority ids wired to role homes', () => {
    const journeyIds = new Set();
    const priorityIds = new Set();
    for (const roleId of ROLE_IDS) {
      const priorities = ROLE_PROFILES[roleId].homePriorities;
      expect(priorities).toHaveLength(3);
      for (const priority of priorities) {
        expect(priority.id).toBeTruthy();
        expect(priority.detail).toMatch(/you /i);
        expect(priority.outcome).toBeTruthy();
        expect(priority.showMeJourneyId).toBeTruthy();
        expect(priorityIds.has(priority.id)).toBe(false);
        priorityIds.add(priority.id);
        const journey = getShowMeJourney(priority.showMeJourneyId);
        expect(journey, priority.showMeJourneyId).toBeTruthy();
        expect(journey.roleId).toBe(roleId);
        expect(journey.priorityId).toBe(priority.id);
        expect(journeyIds.has(journey.id)).toBe(false);
        journeyIds.add(journey.id);
      }
    }
    expect(priorityIds.size).toBe(21);
    expect(journeyIds.size).toBe(21);
  });

  it('uses only room-supported filter dimensions', () => {
    for (const journey of listShowMeJourneys()) {
      for (const step of journey.steps) {
        const roomId = step.apply?.activeEvidenceId;
        const filters = step.apply?.guidedFilters;
        if (!roomId || !filters || !Object.keys(filters).length) continue;
        const config = ROOM_CONFIGS[roomId];
        expect(config, `${journey.id} room ${roomId}`).toBeTruthy();
        const allowed = new Set(config.filters.map((f) => f.key));
        for (const key of Object.keys(filters)) {
          expect(allowed.has(key), `${journey.id}: ${roomId} lacks filter ${key}`).toBe(true);
        }
      }
    }
  });

  it('resolves a lead row under filters and interpolates narrative', () => {
    const journey = getShowMeJourney('journey-legislator-district-story');
    const filterStep = journey.steps.find((s) => s.apply?.guidedFilters?.region);
    const lead = resolveLeadRow('county', filterStep.apply.guidedFilters);
    expect(lead).toBeTruthy();
    expect(lead.id).toBeTruthy();
    const steps = buildShowMeSteps(journey, { leadRow: lead });
    expect(steps.every((step) => Boolean(step.example))).toBe(true);
    const leadStep = steps.find((s) => s.id === 'open-lead');
    expect(leadStep.narrative).toContain(lead.title);
    expect(leadStep.mode).toBe('show-me');
    const last = steps[steps.length - 1];
    expect(last.apply.view).toBe('role-home');
    expect(last.apply.highlightPriorityId).toBe('legislator-district-story');
    expect(last.target).toBe('role-home-priority-legislator-district-story');
  });

  it('covers all four journey patterns', () => {
    const patterns = new Set(listShowMeJourneys().map((j) => j.pattern));
    expect(patterns).toEqual(
      new Set([
        'evidence-investigation',
        'blender-synthesis',
        'trust-provenance',
        'legislative-linkage',
      ]),
    );
  });

  it('adds role-task examples to every Show Me bubble', () => {
    for (const journey of listShowMeJourneys()) {
      const steps = buildShowMeSteps(journey);
      for (const step of steps) {
        expect(step.example, `${journey.id}:${step.id}`).toBeTruthy();
      }
    }
  });

  it('resolves the semantically preferred lead row within each filtered slice', () => {
    for (const journey of listShowMeJourneys()) {
      if (!journey.preferredLeadTitle) continue;
      const roomStep = journey.steps.find((step) => step.apply?.activeEvidenceId);
      const filterStep = journey.steps.find(
        (step) => Object.keys(step.apply?.guidedFilters || {}).length,
      );
      const lead = resolveLeadRow(
        roomStep.apply.activeEvidenceId,
        filterStep.apply.guidedFilters,
        journey.preferredLeadTitle,
      );
      expect(lead.title.toLowerCase(), journey.id).toContain(
        journey.preferredLeadTitle.toLowerCase(),
      );
    }
  });

  it('initializes journey copy from the non-empty guided filter slice', () => {
    const journey = getShowMeJourney('journey-budget-cost-drivers');
    const lead = resolveJourneyLeadRow(journey);
    expect(lead.title).toBe('Pharmacy — Disabled');
    const leadExample = buildShowMeSteps(journey, { leadRow: lead })
      .find((step) => step.id === 'open-lead').example;
    expect(leadExample).toContain('Pharmacy — Disabled');
  });
});
