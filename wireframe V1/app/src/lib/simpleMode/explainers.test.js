import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXPLAINERS, effectiveSubtab, explainerFor } from './explainers.js';
import { SIMPLE_SUBTABS } from './simpleAreas.js';

describe('explainer registry', () => {
  it('has a published video file for every pop-up', () => {
    for (const e of EXPLAINERS) {
      for (const v of e.videos) {
        const file = new URL(`../../../public/${v.src}`, import.meta.url);
        expect(existsSync(file), v.src).toBe(true);
        expect(statSync(file).size, v.src).toBeGreaterThan(200_000);
      }
    }
  });

  it('covers every new sub-tab, and nothing on an Overview', () => {
    const newSubtabs = Object.entries(SIMPLE_SUBTABS).flatMap(([view, subs]) => subs.filter((s) => !['overview', 'counties'].includes(s.id)).map((s) => `${view}:${s.id}`));
    const covered = EXPLAINERS.filter((e) => e.subtab).map((e) => `${e.view}:${e.subtab}`);
    expect(covered.sort()).toEqual(newSubtabs.sort());
    expect(explainerFor('simple-access', null)).toBeNull();
    expect(effectiveSubtab('simple-rates', null)).toBe('medicare');
    expect(explainerFor('simple-rates', null).id).toBe('medicare-by-state');
  });

  it('lists 21 videos in all', () => {
    expect(EXPLAINERS.flatMap((e) => e.videos)).toHaveLength(21);
  });
});
