// CodeXen: v1 not-applicable
// Enqueue lock table (D2). ADR-001 Decision 3 (L1, representative enqueue locks on business keys)
// and Decision 4 (R1, locks survive a restart).
//
// The table lives in this process's memory (T1: exactly one process owns it). Every acquire and
// release is persisted to enqueue_lock so that boot can restore it. Map mutations happen
// synchronously before the persistence await, so two requests interleaving on the event loop cannot
// both be granted the same key; a failed persist restores the previous entry and throws.
//
// A lock is released on save, on cancel, on sign-out (releaseAllForSession), or when its session
// ends. The holder is the user session: tabs in one browser share it and are not denied against
// each other; the denial applies between browsers and devices. A session that ended by reaching its 12-hour lifetime has no event: its lock is released at
// the next contention for that key, or at boot. There is no sweeper, lease or heartbeat.

export const TARGET_SET = 'TARGET_SET';

export function buildLockKey(ownerScope, lockObject) {
  return `${ownerScope}|${lockObject}`;
}

// Kentucky spans Eastern and Central time; holder times are shown in Eastern time and labelled ET.
const DEFAULT_TIME_ZONE = 'America/New_York';
const TIME_ZONE_LABEL = 'ET';

function formatClockTime(epochMs, timeZone) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(epochMs)) + ` ${TIME_ZONE_LABEL}`;
}

// What a denied user is told (ADR-001 Decision 3).
const HOLDER_DESCRIPTIONS = {
  [TARGET_SET]: (entry, timeZone) =>
    `Your targets are open for editing in another browser or device (since ${formatClockTime(entry.acquiredAt, timeZone)}). ` +
    'Close it, or sign out there, to edit here.',
};

export function createEnqueue({ database, clock, timeZone = DEFAULT_TIME_ZONE }) {
  // architecture-record: T1 A1 L1 ADR-001
  const locks = new Map();

  function holderSessionHasEnded(entry) {
    // architecture-record: L1 ADR-001
    return entry.sessionExpiresAt <= clock.now();
  }

  async function persistAcquire(entry) {
    // architecture-record: T1 L1 R1 ADR-001
    await database.query(
      `INSERT INTO enqueue_lock (lock_key, owner_scope, lock_object, session_id, acquired_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (lock_key) DO UPDATE SET owner_scope = EXCLUDED.owner_scope, lock_object = EXCLUDED.lock_object,
         session_id = EXCLUDED.session_id, acquired_at = EXCLUDED.acquired_at`,
      [entry.lockKey, entry.ownerScope, entry.lockObject, entry.sessionId, new Date(entry.acquiredAt).toISOString()],
    );
  }

  async function persistRelease(entry) {
    // architecture-record: T1 L1 R1 ADR-001
    await database.query('DELETE FROM enqueue_lock WHERE lock_key = $1 AND session_id = $2', [entry.lockKey, entry.sessionId]);
  }

  const enqueue = {
    // Grants the lock to the session, or denies it and names the holder.
    async acquire({ ownerScope, lockObject, sessionId, sessionExpiresAt }) {
      const lockKey = buildLockKey(ownerScope, lockObject);
      const held = locks.get(lockKey);
      if (held && held.sessionId === sessionId) {
        return { granted: true, lockKey, holderDescription: '' };
      }
      if (held && !holderSessionHasEnded(held)) {
        return { granted: false, lockKey, holderDescription: enqueue.describeHolder(lockKey) };
      }
      const entry = { lockKey, ownerScope, lockObject, sessionId, sessionExpiresAt, acquiredAt: clock.now() };
      locks.set(lockKey, entry);
      try {
        await persistAcquire(entry);
      } catch (error) {
        if (locks.get(lockKey) === entry) {
          if (held) locks.set(lockKey, held);
          else locks.delete(lockKey);
        }
        throw error;
      }
      return { granted: true, lockKey, holderDescription: '' };
    },

    isHeldBySession(lockKey, sessionId) {
      const held = locks.get(lockKey);
      return Boolean(held) && held.sessionId === sessionId && !holderSessionHasEnded(held);
    },

    // Who holds the lock, for a denied user; '' when no live session holds it.
    describeHolder(lockKey) {
      const held = locks.get(lockKey);
      if (!held || holderSessionHasEnded(held)) return '';
      const describe = HOLDER_DESCRIPTIONS[held.lockObject];
      return describe ? describe(held, timeZone) : `This item is open for editing elsewhere (since ${formatClockTime(held.acquiredAt, timeZone)}).`;
    },

    // Releases the lock if this session holds it. Returns the number of locks released (0 or 1).
    async release(lockKey, sessionId) {
      const held = locks.get(lockKey);
      if (!held || held.sessionId !== sessionId) return 0;
      locks.delete(lockKey);
      try {
        await persistRelease(held);
      } catch (error) {
        if (!locks.has(lockKey)) locks.set(lockKey, held);
        throw error;
      }
      return 1;
    },

    // Sign-out and session end release every lock the session holds (ADR-001 Decision 3).
    async releaseAllForSession(sessionId) {
      let released = 0;
      for (const entry of [...locks.values()]) {
        if (entry.sessionId === sessionId) released += await enqueue.release(entry.lockKey, sessionId);
      }
      return released;
    },

    // R1 boot step 1: restore locks whose session is still valid (they wait for their session to
    // return); release the rest.
    // architecture-record: T1 L1 R1 ADR-001
    async restoreAtBoot() {
      const result = await database.query(
        `SELECT l.lock_key, l.owner_scope, l.lock_object, l.session_id, l.acquired_at, s.session_status, s.expires_at
           FROM enqueue_lock l JOIN user_session s ON s.session_id = l.session_id`,
      );
      let restored = 0;
      let released = 0;
      for (const row of result.rows) {
        const entry = {
          lockKey: row.lock_key,
          ownerScope: row.owner_scope,
          lockObject: row.lock_object,
          sessionId: row.session_id,
          sessionExpiresAt: new Date(row.expires_at).getTime(),
          acquiredAt: new Date(row.acquired_at).getTime(),
        };
        if (row.session_status === 'active' && !holderSessionHasEnded(entry)) {
          locks.set(entry.lockKey, entry);
          restored += 1;
        } else {
          await persistRelease(entry);
          released += 1;
        }
      }
      return { restored, released };
    },

    // Read-only view for diagnostics and tests.
    listLocks() {
      return [...locks.values()].map((entry) => ({ ...entry }));
    },
  };
  return enqueue;
}
