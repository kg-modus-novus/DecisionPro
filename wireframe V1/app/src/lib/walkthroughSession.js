// Persist within the browser tab session so Skip All / Finish survive Vite
// restarts and soft refresh. A new browser session starts clean.
const STORAGE_KEY = 'decisionpro.walkthrough.session.v1';

const seenTourKeys = new Set();
let skipAll = false;
let hydrated = false;

function canUseStorage() {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage != null;
  } catch {
    return false;
  }
}

function hydrateFromStorage() {
  if (hydrated) return;
  hydrated = true;
  if (!canUseStorage()) return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.seen)) {
      for (const key of parsed.seen) {
        if (typeof key === 'string' && key) seenTourKeys.add(key);
      }
    }
    skipAll = Boolean(parsed?.skipAll);
  } catch {
    // Ignore corrupt session payloads.
  }
}

function persist() {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        seen: [...seenTourKeys],
        skipAll,
      }),
    );
  } catch {
    // Quota / private mode — keep in-memory behavior only.
  }
}

hydrateFromStorage();

export function isWalkthroughSkipAll() {
  hydrateFromStorage();
  return skipAll;
}

export function setWalkthroughSkipAll(value) {
  hydrateFromStorage();
  skipAll = Boolean(value);
  persist();
}

export function hasSeenWalkthrough(tourKey) {
  hydrateFromStorage();
  if (!tourKey) return false;
  return seenTourKeys.has(tourKey);
}

export function markWalkthroughSeen(tourKey) {
  hydrateFromStorage();
  if (!tourKey) return;
  seenTourKeys.add(tourKey);
  persist();
}

export function clearWalkthroughSeen(tourKey) {
  hydrateFromStorage();
  if (!tourKey) return;
  seenTourKeys.delete(tourKey);
  persist();
}

export function resetWalkthroughRuntime() {
  seenTourKeys.clear();
  skipAll = false;
  hydrated = true;
  if (canUseStorage()) {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export function shouldAutoStartWalkthrough(tourKey) {
  hydrateFromStorage();
  if (!tourKey) return false;
  if (isWalkthroughSkipAll()) return false;
  return !hasSeenWalkthrough(tourKey);
}
