import { describe, expect, it } from 'vitest';
import { evaluateCredentialAlerts } from './credentialExpiry.js';

const SAM_KEY = {
  id: 'sam-gov-api-key',
  label: 'SAM.gov API key',
  expiresOn: '2026-11-30',
  warnDays: 30,
  rotation: 'Rotate at SAM.gov.',
  degradation: 'SAM-dependent loads degrade to the recorded-gap fallback.',
};

describe('evaluateCredentialAlerts', () => {
  it('stays silent more than warnDays before expiry', () => {
    const alerts = evaluateCredentialAlerts([SAM_KEY], new Date(2026, 9, 30)); // 2026-10-30
    expect(alerts).toEqual([]);
  });

  it('raises an expiring alert exactly 30 days out', () => {
    const alerts = evaluateCredentialAlerts([SAM_KEY], new Date(2026, 9, 31)); // 2026-10-31
    expect(alerts).toHaveLength(1);
    expect(alerts[0].status).toBe('expiring');
    expect(alerts[0].daysRemaining).toBe(30);
    expect(alerts[0].message).toContain('expires in 30 days');
  });

  it('reports expires-today on the expiry date', () => {
    const alerts = evaluateCredentialAlerts([SAM_KEY], new Date(2026, 10, 30, 12)); // 2026-11-30 noon
    expect(alerts).toHaveLength(1);
    expect(alerts[0].status).toBe('expiring');
    expect(alerts[0].daysRemaining).toBe(0);
    expect(alerts[0].message).toContain('expires today');
  });

  it('reports expired with the degradation note after expiry', () => {
    const alerts = evaluateCredentialAlerts([SAM_KEY], new Date(2026, 11, 1)); // 2026-12-01
    expect(alerts).toHaveLength(1);
    expect(alerts[0].status).toBe('expired');
    expect(alerts[0].message).toContain('expired on 2026-11-30');
    expect(alerts[0].message).toContain('recorded-gap fallback');
  });

  it('ignores malformed dates and sorts soonest first', () => {
    const alerts = evaluateCredentialAlerts(
      [
        { id: 'bad', label: 'Bad', expiresOn: 'not-a-date' },
        { ...SAM_KEY, id: 'later', expiresOn: '2026-12-15' },
        SAM_KEY,
      ],
      new Date(2026, 11, 5), // 2026-12-05
    );
    expect(alerts.map((a) => a.id)).toEqual(['sam-gov-api-key', 'later']);
    expect(alerts[0].status).toBe('expired');
    expect(alerts[1].status).toBe('expiring');
  });
});
