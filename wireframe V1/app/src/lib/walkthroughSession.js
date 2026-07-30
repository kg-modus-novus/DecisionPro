// Runtime state intentionally resets on a full browser refresh. Within one
// loaded app, each role tour auto-starts only once and Skip All suppresses
// subsequent role tours until the user refreshes or replays one explicitly.
const seenTourKeys = new Set();
let skipAll = false;

export function isWalkthroughSkipAll() {
  return skipAll;
}

export function setWalkthroughSkipAll(value) {
  skipAll = Boolean(value);
}

export function hasSeenWalkthrough(tourKey) {
  if (!tourKey) return false;
  return seenTourKeys.has(tourKey);
}

export function markWalkthroughSeen(tourKey) {
  if (!tourKey) return;
  seenTourKeys.add(tourKey);
}

export function clearWalkthroughSeen(tourKey) {
  if (!tourKey) return;
  seenTourKeys.delete(tourKey);
}

export function resetWalkthroughRuntime() {
  seenTourKeys.clear();
  skipAll = false;
}

export function shouldAutoStartWalkthrough(tourKey) {
  if (!tourKey) return false;
  if (isWalkthroughSkipAll()) return false;
  return !hasSeenWalkthrough(tourKey);
}
