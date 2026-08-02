/** Keep in sync with styles.css tablet / handheld media queries. */
export const TABLET_MAX_WIDTH = 1024;
export const HANDHELD_MAX_WIDTH = 640;

/**
 * @param {number} width
 * @returns {'desktop' | 'tablet' | 'handheld'}
 */
export function resolveViewportLayout(width) {
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return 'desktop';
  if (w <= HANDHELD_MAX_WIDTH) return 'handheld';
  if (w <= TABLET_MAX_WIDTH) return 'tablet';
  return 'desktop';
}

/** Tablet + handheld: content-first shell with drawer navigation. */
export function isCompactLayout(layout) {
  return layout === 'tablet' || layout === 'handheld';
}

export function readViewportLayout() {
  if (typeof window === 'undefined') return 'desktop';
  return resolveViewportLayout(window.innerWidth);
}
