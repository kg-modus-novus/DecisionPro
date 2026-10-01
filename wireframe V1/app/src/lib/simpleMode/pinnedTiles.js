// CodeXen: v1 not-applicable
// Per-browser pinned tiles for simple mode (requirements FR-1.4). A UI
// preference, not business data; follows the uiZoom localStorage pattern.
export const PINNED_TILES_STORAGE_KEY = 'decisionpro.simple.pins.v1';
export const PINNED_TILES_MAX = 5;

export function normalizePinnedTiles(value, knownIds = null) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const id of value) {
    if (typeof id !== 'string' || seen.has(id)) continue;
    if (knownIds && !knownIds.includes(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length === PINNED_TILES_MAX) break;
  }
  return out;
}

export function readPinnedTiles(knownIds = null, storage = null) {
  try {
    const target = storage || globalThis.localStorage;
    return normalizePinnedTiles(JSON.parse(target?.getItem(PINNED_TILES_STORAGE_KEY) || '[]'), knownIds);
  } catch {
    return [];
  }
}

export function storePinnedTiles(ids, storage = null) {
  const normalized = normalizePinnedTiles(ids);
  try {
    const target = storage || globalThis.localStorage;
    target?.setItem(PINNED_TILES_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Storage can be disabled; pins then last for this visit only.
  }
  return normalized;
}

export function togglePinnedTile(ids, id) {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  if (ids.length >= PINNED_TILES_MAX) return ids;
  return [...ids, id];
}

// Pinned tiles first in pin order, then the default order.
export function orderTilesByPins(tiles, pinnedIds) {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const pinned = pinnedIds.map((id) => byId.get(id)).filter(Boolean);
  return [...pinned, ...tiles.filter((t) => !pinnedIds.includes(t.id))];
}
