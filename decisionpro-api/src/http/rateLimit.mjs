// CodeXen: v1 not-applicable
// Fixed-window limit on sign-in attempts (POST /auth/google, POST /auth/apple) per client IP (D2,
// technical). Recorded in docs/planning/measure-targets-codexen-plan.md, Coordination mechanisms:
// it handles repeated failed sign-ins from one address. The limit allows a legislative office whose
// staff share one public address. Sign-out is not limited. The counters live in this process's
// memory because exactly one process serves the API (ADR-001 T1). Expired windows are pruned on
// each check; there is no timer or sweeper.

// architecture-record: T1 ADR-001
export const SIGN_IN_RATE_LIMIT = Object.freeze({ limit: 60, windowMs: 10 * 60 * 1000 }); // 60 sign-in attempts per IP per 10 minutes

export function createRateLimiter({ limit, windowMs, clock }) {
  const windows = new Map();
  return {
    // Returns true when the request may proceed.
    allow(clientKey) {
      const now = clock.now();
      for (const [key, window] of windows) {
        // architecture-record: T1 ADR-001
        if (now - window.startedAt >= windowMs) windows.delete(key);
      }
      const window = windows.get(clientKey);
      if (!window) {
        windows.set(clientKey, { startedAt: now, count: 1 });
        return true;
      }
      window.count += 1;
      return window.count <= limit;
    },
  };
}

// The client address. Behind Railway's proxy (TRUST_PROXY=true) it is the right-most
// X-Forwarded-For entry, the one the proxy appended; entries to its left are client-supplied.
export function clientAddress(req, trustProxy) {
  if (trustProxy) {
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').map((part) => part.trim()).filter(Boolean);
    if (forwarded.length > 0) return forwarded[forwarded.length - 1];
  }
  return req.socket?.remoteAddress ?? 'unknown';
}
