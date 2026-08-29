export const UI_ZOOM_MIN = 20;
export const UI_ZOOM_MAX = 200;
export const UI_ZOOM_STEP = 10;
export const UI_ZOOM_DEFAULT = 100;
export const UI_ZOOM_STORAGE_KEY = 'decisionpro.ui.zoom.percent.v1';

export const UI_ZOOM_OPTIONS = Array.from(
  { length: ((UI_ZOOM_MAX - UI_ZOOM_MIN) / UI_ZOOM_STEP) + 1 },
  (_, index) => UI_ZOOM_MIN + (index * UI_ZOOM_STEP),
);

export function normalizeUiZoom(value, fallback = UI_ZOOM_DEFAULT) {
  const cleaned = String(value ?? '').replace('%', '').trim();
  if (!cleaned) return fallback;
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(UI_ZOOM_MAX, Math.max(UI_ZOOM_MIN, Math.round(numeric)));
}

export function stepUiZoom(value, direction) {
  const current = normalizeUiZoom(value);
  const delta = direction < 0 ? -UI_ZOOM_STEP : UI_ZOOM_STEP;
  return normalizeUiZoom(current + delta);
}

export function readStoredUiZoom(storage = null) {
  try {
    const target = storage || globalThis.localStorage;
    return normalizeUiZoom(target?.getItem(UI_ZOOM_STORAGE_KEY), UI_ZOOM_DEFAULT);
  } catch {
    return UI_ZOOM_DEFAULT;
  }
}

export function storeUiZoom(value, storage = null) {
  const normalized = normalizeUiZoom(value);
  try {
    const target = storage || globalThis.localStorage;
    target?.setItem(UI_ZOOM_STORAGE_KEY, String(normalized));
  } catch {
    // Storage can be disabled; the current session still receives the zoom value.
  }
  return normalized;
}
