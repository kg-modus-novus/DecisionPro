import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXPLAINERS, effectiveSubtab, explainerFor, workspaceGuideFor } from './explainers.js';
import { SIMPLE_SUBTABS, SIMPLE_TABS } from './simpleAreas.js';
import { FRAUD_PAGES } from '../../components/fraud/PotentialFraudDetection.jsx';

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

  it('covers every simple tab and sub-tab (2026-11-13: every page has a video)', () => {
    for (const { view } of SIMPLE_TABS) {
      const subs = SIMPLE_SUBTABS[view];
      for (const anchor of subs ? subs.map((s) => s.id) : [null]) expect(explainerFor(view, anchor), `${view}:${anchor}`).not.toBeNull();
    }
    expect(explainerFor('simple-access', null).id).toBe('access-overview');
    expect(effectiveSubtab('simple-rates', null)).toBe('medicare');
    expect(explainerFor('simple-rates', null).id).toBe('medicare-by-state');
  });

  it('covers every expert workspace page and every Potential Fraud Detection page', () => {
    for (const view of ['role-home', 'operational', 'sources', 'evidence', 'blender', 'pack', 'brief', 'legislation', 'law-object']) {
      expect(workspaceGuideFor(`sme:${view}`, view).videos, view).toHaveLength(1);
    }
    for (const { id } of FRAUD_PAGES) expect(workspaceGuideFor(`fraud:${id}`, id).videos, id).toHaveLength(1);
  });

  it('lists 51 videos in all', () => {
    expect(EXPLAINERS.flatMap((e) => e.videos)).toHaveLength(51);
  });
});
