import { describe, expect, it } from 'vitest';
import {
  HANDHELD_MAX_WIDTH,
  TABLET_MAX_WIDTH,
  isCompactLayout,
  resolveViewportLayout,
} from './viewportLayout.js';

describe('viewportLayout', () => {
  it('classifies desktop, tablet, and handheld widths', () => {
    expect(resolveViewportLayout(1400)).toBe('desktop');
    expect(resolveViewportLayout(TABLET_MAX_WIDTH)).toBe('tablet');
    expect(resolveViewportLayout(800)).toBe('tablet');
    expect(resolveViewportLayout(HANDHELD_MAX_WIDTH)).toBe('handheld');
    expect(resolveViewportLayout(390)).toBe('handheld');
  });

  it('treats tablet and handheld as compact', () => {
    expect(isCompactLayout('desktop')).toBe(false);
    expect(isCompactLayout('tablet')).toBe(true);
    expect(isCompactLayout('handheld')).toBe(true);
  });
});
