// CodeXen: v1 not-applicable
// Sessions (D2, ADR-001 Identity). The service issues its own session after an ID token is verified.
// The cookie carries an opaque 256-bit random token. At rest only its SHA-256 hash is stored, as
// user_session.session_id; that hash is the session id everywhere else (locks, ledger).

import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'dp_session';
// architecture-record: L1 ADR-001
export const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000; // 12 hours: session lifetime, also bounds how long a lock is held

export function hashSessionToken(sessionToken) {
  return createHash('sha256').update(sessionToken).digest('base64url');
}

export function createSessions({ database, clock }) {
  return {
    async startSession(accountId) {
      const sessionToken = randomBytes(32).toString('base64url');
      const sessionId = hashSessionToken(sessionToken);
      const createdAt = clock.now();
      // architecture-record: L1 ADR-001
      const expiresAt = createdAt + SESSION_LIFETIME_MS;
      await database.query(
        `INSERT INTO user_session (session_id, account_id, session_status, created_at, expires_at)
         VALUES ($1, $2, 'active', $3, $4)`,
        [sessionId, accountId, new Date(createdAt).toISOString(), new Date(expiresAt).toISOString()],
      );
      return { sessionIsActive: true, sessionToken, sessionId, accountId, createdAt, expiresAt };
    },

    // Returns the active session for a cookie token, or a session with sessionIsActive false when the
    // token is unknown, ended, or past its lifetime.
    async findActiveSession(sessionToken) {
      const ended = { sessionIsActive: false, sessionToken: '', sessionId: '', accountId: '', createdAt: 0, expiresAt: 0 };
      if (typeof sessionToken !== 'string' || sessionToken === '') return ended;
      const sessionId = hashSessionToken(sessionToken);
      const result = await database.query(
        'SELECT session_id, account_id, session_status, created_at, expires_at FROM user_session WHERE session_id = $1',
        [sessionId],
      );
      if (result.rowCount === 0) return ended;
      const row = result.rows[0];
      const expiresAt = new Date(row.expires_at).getTime();
      // architecture-record: L1 ADR-001
      if (row.session_status !== 'active' || expiresAt <= clock.now()) return ended;
      return {
        sessionIsActive: true,
        sessionToken,
        sessionId: row.session_id,
        accountId: row.account_id,
        createdAt: new Date(row.created_at).getTime(),
        expiresAt,
      };
    },

    // Ends a session by its id (the token hash).
    async endSession(sessionId) {
      const result = await database.query(
        `UPDATE user_session SET session_status = 'ended', ended_at = $2 WHERE session_id = $1 AND session_status = 'active'`,
        [sessionId, new Date(clock.now()).toISOString()],
      );
      return result.rowCount;
    },
  };
}

export function buildSessionCookie(sessionToken, { cookieDomain, maxAgeSeconds = SESSION_LIFETIME_MS / 1000 }) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${sessionToken}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (cookieDomain) parts.push(`Domain=${cookieDomain}`);
  return parts.join('; ');
}

export function buildClearedSessionCookie({ cookieDomain }) {
  return buildSessionCookie('', { cookieDomain, maxAgeSeconds: 0 });
}

export function readSessionTokenFromCookieHeader(cookieHeader) {
  if (typeof cookieHeader !== 'string') return '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === SESSION_COOKIE_NAME) return part.slice(separator + 1).trim();
  }
  return '';
}
