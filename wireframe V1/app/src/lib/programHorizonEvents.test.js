import { describe, expect, it } from 'vitest';
import { PROGRAM_HORIZON_EVENTS } from '../data/alp/programHorizonEvents.js';

describe('OFR-07 waiver & grant horizon watch', () => {
  it('is state-neutral: exactly KY and FL, each populated only from its own hydration', () => {
    expect(Object.keys(PROGRAM_HORIZON_EVENTS.byState).sort()).toEqual(['FL', 'KY']);
    for (const state of ['KY', 'FL']) {
      expect(PROGRAM_HORIZON_EVENTS.byState[state].state).toBe(state);
    }
  });

  it('cites a source document and a retrieval date on every event', () => {
    for (const state of ['KY', 'FL']) {
      const items = PROGRAM_HORIZON_EVENTS.byState[state].events.items;
      expect(items.length).toBeGreaterThan(0);
      for (const event of items) {
        expect(typeof event.sourceDocumentUri).toBe('string');
        expect(event.sourceDocumentUri.length).toBeGreaterThan(0);
        expect(typeof event.retrievedAt).toBe('string');
        expect(event.retrievedAt.length).toBeGreaterThan(0);
      }
    }
  });

  it('labels every event with a valid type, scope, and date kind', () => {
    for (const state of ['KY', 'FL']) {
      for (const event of PROGRAM_HORIZON_EVENTS.byState[state].events.items) {
        expect(['waiver_expiration', 'waiver_milestone', 'nofo_opportunity']).toContain(event.eventType);
        expect(['state', 'national']).toContain(event.scope);
        if (event.eventType === 'waiver_expiration' || event.eventType === 'waiver_milestone') {
          expect(event.scope).toBe('state');
        }
        if (event.eventType === 'nofo_opportunity') {
          expect(event.scope).toBe('national');
        }
      }
    }
  });

  it('includes a waiver expiration event for each state\'s named 1115 demonstration', () => {
    for (const state of ['KY', 'FL']) {
      const items = PROGRAM_HORIZON_EVENTS.byState[state].events.items;
      const expirations = items.filter((event) => event.eventType === 'waiver_expiration');
      expect(expirations.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('never predicts a renewal outcome — every status is a published date/status only', () => {
    for (const state of ['KY', 'FL']) {
      const slice = PROGRAM_HORIZON_EVENTS.byState[state];
      expect(slice.note).toMatch(/never a predicted renewal outcome/i);
      for (const event of slice.events.items) {
        expect(event.status).not.toMatch(/will lapse|will not renew|denial predicted|approved renewal/i);
      }
    }
  });

  it('caps the event list', () => {
    for (const state of ['KY', 'FL']) {
      expect(PROGRAM_HORIZON_EVENTS.byState[state].events.items.length).toBeLessThanOrEqual(40);
    }
  });

  it('passed Source Reconciliation on the last gate run (no fake green)', () => {
    expect(PROGRAM_HORIZON_EVENTS.reconciliation.status).toBe('PASS');
    expect(PROGRAM_HORIZON_EVENTS.reconciliation.claimAllowed).toBe(true);
    for (const check of PROGRAM_HORIZON_EVENTS.reconciliation.checks) {
      expect(check.ok).toBe(true);
    }
  });
});
