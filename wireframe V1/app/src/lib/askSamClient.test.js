import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PUBLIC_ASK_SAM_API_BASE,
  resolveAskSamApiBase,
} from './askSamClient.js';

describe('resolveAskSamApiBase', () => {
  it('prefers and normalizes an explicit deployment override', () => {
    expect(resolveAskSamApiBase(' https://api.example.test/// ', 'demo.decisionpro.io'))
      .toBe('https://api.example.test');
  });

  it.each([
    'demo.decisionpro.io',
    'DEMO.DECISIONPRO.IO',
    'kg-modus-novus.github.io',
  ])('uses the documented public API for %s', (hostname) => {
    expect(resolveAskSamApiBase('', hostname)).toBe(DEFAULT_PUBLIC_ASK_SAM_API_BASE);
  });

  it.each(['localhost', '127.0.0.1', 'preview.example.test', ''])
    ('keeps same-origin routing for non-public host %s', (hostname) => {
      expect(resolveAskSamApiBase('', hostname)).toBe('');
    });
});
