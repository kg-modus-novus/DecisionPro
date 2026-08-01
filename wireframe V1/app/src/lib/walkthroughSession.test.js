/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearWalkthroughSeen,
  hasSeenWalkthrough,
  isWalkthroughSkipAll,
  markWalkthroughSeen,
  resetWalkthroughRuntime,
  setWalkthroughSkipAll,
  shouldAutoStartWalkthrough,
} from './walkthroughSession.js';
import { roleTourKey } from '../data/walkthroughs.js';

afterEach(() => {
  resetWalkthroughRuntime();
});

describe('walkthroughSession', () => {
  it('auto-starts once per role tour unless skip-all', () => {
    const key = roleTourKey('legislator');
    expect(shouldAutoStartWalkthrough(key)).toBe(true);
    markWalkthroughSeen(key);
    expect(hasSeenWalkthrough(key)).toBe(true);
    expect(shouldAutoStartWalkthrough(key)).toBe(false);
    clearWalkthroughSeen(key);
    expect(shouldAutoStartWalkthrough(key)).toBe(true);

    setWalkthroughSkipAll(true);
    expect(isWalkthroughSkipAll()).toBe(true);
    expect(shouldAutoStartWalkthrough(key)).toBe(false);
    setWalkthroughSkipAll(false);
    expect(shouldAutoStartWalkthrough(key)).toBe(true);
  });

  it('clears runtime state on explicit reset', () => {
    const key = roleTourKey('data-steward');
    markWalkthroughSeen(key);
    setWalkthroughSkipAll(true);
    expect(shouldAutoStartWalkthrough(key)).toBe(false);

    resetWalkthroughRuntime();
    expect(shouldAutoStartWalkthrough(key)).toBe(true);
  });

  it('persists skip-all across a simulated module remount in the same tab', async () => {
    const key = roleTourKey('legislator');
    setWalkthroughSkipAll(true);
    expect(shouldAutoStartWalkthrough(key)).toBe(false);

    vi.resetModules();
    const reloaded = await import('./walkthroughSession.js');
    expect(reloaded.shouldAutoStartWalkthrough(key)).toBe(false);
    reloaded.resetWalkthroughRuntime();
  });
});
