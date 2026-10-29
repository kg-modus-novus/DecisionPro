import { describe, expect, it } from 'vitest';
import { SIMPLE_SUBTABS, SIMPLE_TABS } from './simpleAreas.js';
import { EXPLAINERS, explainerFor } from './explainers.js';
import { simplePageExplain } from './simplePageExplains.js';
import { resolvePageExplain } from '../pageExplains.js';

describe('Explain this Page in simple mode', () => {
  it('explains every simple tab as itself, never as the Consideration Blender', () => {
    for (const { view, label } of SIMPLE_TABS) {
      const e = resolvePageExplain({ stateCode: 'KY', view });
      expect(e.pageName.startsWith(label)).toBe(true);
      expect(e.overview).not.toMatch(/blender/i);
      expect(e.dataSource.length).toBeGreaterThan(0);
      expect(e.howToUse.length).toBeGreaterThan(0);
    }
  });

  it('gives every analysis sub-tab its own description', () => {
    for (const [view, subs] of Object.entries(SIMPLE_SUBTABS)) {
      const seen = new Set();
      for (const { id } of subs) {
        if (id === 'overview') continue;
        const e = simplePageExplain(view, id);
        expect(seen.has(e.overview), `${view}:${id}`).toBe(false);
        seen.add(e.overview);
        expect(e.schematic.sections.length, `${view}:${id}`).toBeGreaterThan(0);
      }
    }
  });

  it('offers exactly the explainer videos made for the page or sub-tab on screen', () => {
    for (const { view } of SIMPLE_TABS) {
      for (const anchor of [null, ...(SIMPLE_SUBTABS[view] || []).map((s) => s.id)]) {
        const expected = explainerFor(view, anchor);
        expect(simplePageExplain(view, anchor).videos).toEqual(expected ? expected.videos : []);
      }
    }
    const offered = new Set(SIMPLE_TABS.flatMap(({ view }) => [null, ...(SIMPLE_SUBTABS[view] || []).map((s) => s.id)].flatMap((a) => simplePageExplain(view, a).videos.map((v) => v.id))));
    expect([...offered].sort()).toEqual(EXPLAINERS.flatMap((e) => e.videos.map((v) => v.id)).sort());
  });
});
