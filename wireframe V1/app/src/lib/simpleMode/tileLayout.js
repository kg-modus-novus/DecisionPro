// CodeXen: v1 not-applicable
// Per-browser dashboard layout for simple mode: which tiles show, in what
// order, and which are pinned. A UI preference, not business data (see
// simple-mode-release-2-plan.md §7: cross-device layouts wait on the
// architecture record). Supersedes decisionpro.simple.pins.v1, whose pins are
// carried over on first read.
import { PINNED_TILES_STORAGE_KEY } from './pinnedTiles.js';

export const TILE_LAYOUT_STORAGE_KEY = 'decisionpro.simple.layout.v2';
export const PINNED_LIMIT = 5;

export function defaultLayout(defaultIds) {
  return { shown: [...defaultIds], pinned: [] };
}

export function normalizeLayout(value, catalogIds, defaultIds) {
  if (!value || !Array.isArray(value.shown)) return defaultLayout(defaultIds);
  const known = new Set(catalogIds);
  const shown = [...new Set(value.shown.filter((id) => known.has(id)))];
  const pinned = [...new Set((value.pinned || []).filter((id) => shown.includes(id)))].slice(0, PINNED_LIMIT);
  return { shown, pinned };
}

function storageOf(storage) {
  return storage || globalThis.localStorage;
}

export function readLayout(catalogIds, defaultIds, storage = null) {
  try {
    const target = storageOf(storage);
    const raw = target?.getItem(TILE_LAYOUT_STORAGE_KEY);
    if (raw) return normalizeLayout(JSON.parse(raw), catalogIds, defaultIds);
    const legacyPins = JSON.parse(target?.getItem(PINNED_TILES_STORAGE_KEY) || '[]');
    const layout = defaultLayout(defaultIds);
    if (Array.isArray(legacyPins)) layout.pinned = legacyPins.filter((id) => layout.shown.includes(id)).slice(0, PINNED_LIMIT);
    return layout;
  } catch {
    return defaultLayout(defaultIds);
  }
}

export function storeLayout(layout, storage = null) {
  try {
    storageOf(storage)?.setItem(TILE_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage can be disabled; the layout then lasts for this visit only.
  }
  return layout;
}

export function togglePin(layout, id) {
  if (layout.pinned.includes(id)) return { ...layout, pinned: layout.pinned.filter((x) => x !== id) };
  if (layout.pinned.length >= PINNED_LIMIT) return layout;
  return { ...layout, pinned: [...layout.pinned, id] };
}

export function addTile(layout, id) {
  if (layout.shown.includes(id)) return layout;
  return { ...layout, shown: [...layout.shown, id] };
}

export function removeTile(layout, id) {
  return { shown: layout.shown.filter((x) => x !== id), pinned: layout.pinned.filter((x) => x !== id) };
}

/** Move `id` to the position currently held by `targetId` (drag and drop). */
export function moveTileTo(layout, id, targetId) {
  if (id === targetId) return layout;
  const shown = layout.shown.filter((x) => x !== id);
  const at = shown.indexOf(targetId);
  if (at < 0) return layout;
  const from = layout.shown.indexOf(id);
  const to = layout.shown.indexOf(targetId);
  shown.splice(from < to ? at + 1 : at, 0, id);
  return { ...layout, shown };
}

/** Keyboard reorder: step -1 (earlier) or +1 (later). */
export function nudgeTile(layout, id, step) {
  const i = layout.shown.indexOf(id);
  const j = i + step;
  if (i < 0 || j < 0 || j >= layout.shown.length) return layout;
  const shown = [...layout.shown];
  [shown[i], shown[j]] = [shown[j], shown[i]];
  return { ...layout, shown };
}

/** Pinned tiles first (in pin order), then the rest in layout order. */
export function orderedTileIds(layout) {
  return [...layout.pinned, ...layout.shown.filter((id) => !layout.pinned.includes(id))];
}
