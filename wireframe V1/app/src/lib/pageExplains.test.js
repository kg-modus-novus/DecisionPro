import { describe, expect, it } from 'vitest';
import { resolvePageExplain, roomExplain } from './pageExplains.js';

describe('pageExplains', () => {
  it('resolves blender, pack, brief, legislation, law-object, roles', () => {
    expect(resolvePageExplain({ view: 'blender' }).id).toBe('blender');
    expect(resolvePageExplain({ view: 'pack' }).schematic.sections.length).toBeGreaterThan(3);
    expect(resolvePageExplain({ view: 'brief' }).pageName).toMatch(/Brief/i);
    expect(resolvePageExplain({ view: 'legislation' }).dataSource.length).toBeGreaterThan(0);
    expect(resolvePageExplain({ view: 'law-object' }).id).toBe('law-object');
    expect(resolvePageExplain({ view: 'role-selector' }).id).toBe('role-selector');
    expect(resolvePageExplain({ view: 'role-selector' }).schematic.layout).toBe('simple');
    expect(resolvePageExplain({ view: 'role-home' }).id).toBe('role-home');
    expect(resolvePageExplain({ view: 'role-home' }).schematic.layout).toBe('simple');
  });

  it('resolves evidence index vs room', () => {
    expect(resolvePageExplain({ view: 'evidence' }).id).toBe('evidence-index');
    const room = resolvePageExplain({ view: 'evidence', evidenceRoomId: 'mco' });
    expect(room.id).toBe('evidence:mco');
    expect(room.pageName).toMatch(/MCO/i);
    expect(room.schematic.layout).toBe('alp');
  });

  it('room explain includes required guide fields', () => {
    const e = roomExplain('cost-drivers');
    expect(e.overview).toBeTruthy();
    expect(e.dataDisplayed.length).toBeGreaterThan(0);
    expect(e.upToDate).toMatch(/refresh|freshness|cadence/i);
    expect(e.howToUse.length).toBeGreaterThan(0);
    expect(e.schematic.sections.every((s) => s.alone && s.system)).toBe(true);
  });
});
