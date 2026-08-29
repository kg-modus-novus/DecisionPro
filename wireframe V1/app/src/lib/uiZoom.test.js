import { describe, expect, it, vi } from 'vitest';
import {
  UI_ZOOM_OPTIONS,
  UI_ZOOM_STORAGE_KEY,
  normalizeUiZoom,
  readStoredUiZoom,
  stepUiZoom,
  storeUiZoom,
} from './uiZoom.js';

describe('DecisionPro UI zoom', () => {
  it('offers selectable values from 20% through 200% in 10% increments', () => {
    expect(UI_ZOOM_OPTIONS[0]).toBe(20);
    expect(UI_ZOOM_OPTIONS.at(-1)).toBe(200);
    expect(UI_ZOOM_OPTIONS).toHaveLength(19);
    expect(UI_ZOOM_OPTIONS.every((value, index) => index === 0 || value - UI_ZOOM_OPTIONS[index - 1] === 10)).toBe(true);
  });

  it('accepts typed whole-number percentages while enforcing the 20%-200% bounds', () => {
    expect(normalizeUiZoom(null)).toBe(100);
    expect(normalizeUiZoom('115%')).toBe(115);
    expect(normalizeUiZoom('20')).toBe(20);
    expect(normalizeUiZoom('200')).toBe(200);
    expect(normalizeUiZoom('5')).toBe(20);
    expect(normalizeUiZoom('250')).toBe(200);
  });

  it('moves +/- controls by 10% and stops at the bounds', () => {
    expect(stepUiZoom(100, -1)).toBe(90);
    expect(stepUiZoom(100, 1)).toBe(110);
    expect(stepUiZoom(20, -1)).toBe(20);
    expect(stepUiZoom(200, 1)).toBe(200);
  });

  it('persists and restores the selected percentage', () => {
    const storage = {
      getItem: vi.fn(() => '135'),
      setItem: vi.fn(),
    };
    expect(readStoredUiZoom(storage)).toBe(135);
    expect(storeUiZoom(145, storage)).toBe(145);
    expect(storage.setItem).toHaveBeenCalledWith(UI_ZOOM_STORAGE_KEY, '145');
  });
});
