// CodeXen: v1 not-applicable
// Durable operation ledger (D2). ADR-001 Decision 4 (R1, restart and resume from a durable ledger).
//
// Every background or long-running operation is written here before it starts. An attempt that
// fails at runtime is recorded and waits for the next boot; there is no runtime retry. At boot,
// resumeAtBoot re-queues operations with attempts remaining and fails the rest; the failures are
// shown to the account that started them (GET /me). There is no runtime sweeper, lease or heartbeat.
//
// Operation kinds today: none (ADR-001). A kind is registered with registerOperationKind and must be
// added to ADR-001 with its attempt cap and what the user sees.

import { randomUUID } from 'node:crypto';

// architecture-record: R1 ADR-001
export const DEFAULT_MAX_ATTEMPTS = 3;

export function createOperationLedger({ database, clock }) {
  const kinds = new Map();
  const nowIso = () => new Date(clock.now()).toISOString();

  async function markOperation(operationId, status, failureReason = '') {
    await database.query(
      'UPDATE operation_ledger SET operation_status = $2, failure_reason = $3, updated_at = $4 WHERE operation_id = $1',
      [operationId, status, failureReason, nowIso()],
    );
  }

  const ledger = {
    registerOperationKind(operationKind, { run, maxAttempts = DEFAULT_MAX_ATTEMPTS }) {
      if (typeof run !== 'function') throw new Error(`Operation kind ${operationKind} needs a run function`);
      kinds.set(operationKind, { run, maxAttempts });
    },

    listOperationKinds() {
      return [...kinds.keys()];
    },

    // Writes the operation before it starts.
    async recordOperation({ operationKind, ownerAccountId, payload = {} }) {
      const kind = kinds.get(operationKind);
      if (!kind) throw new Error(`Unknown operation kind ${operationKind}`);
      const operationId = randomUUID();
      await database.query(
        `INSERT INTO operation_ledger (operation_id, operation_kind, owner_account_id, operation_status, attempts, max_attempts,
           payload, failure_reason, created_at, updated_at)
         VALUES ($1, $2, $3, 'queued', 0, $4, $5, '', $6, $6)`,
        [operationId, operationKind, ownerAccountId, kind.maxAttempts, JSON.stringify(payload), nowIso()],
      );
      return operationId;
    },

    // Runs one attempt of a queued operation. A failed attempt with attempts remaining stays queued
    // and is re-run at the next boot (R1); there is no runtime retry, sweeper or timer.
    // architecture-record: R1 ADR-001
    async runOperation(operationId) {
      const result = await database.query(
        'SELECT operation_id, operation_kind, operation_status, attempts, max_attempts, payload FROM operation_ledger WHERE operation_id = $1',
        [operationId],
      );
      if (result.rowCount === 0) return 'absent';
      const row = result.rows[0];
      if (row.operation_status !== 'queued') return row.operation_status;
      const kind = kinds.get(row.operation_kind);
      if (!kind) {
        await markOperation(operationId, 'failed', 'unknown operation kind');
        return 'failed';
      }
      const attempts = row.attempts + 1;
      await database.query(
        `UPDATE operation_ledger SET operation_status = 'running', attempts = $2, updated_at = $3 WHERE operation_id = $1`,
        [operationId, attempts, nowIso()],
      );
      try {
        await kind.run(JSON.parse(row.payload));
      } catch (error) {
        const status = attempts < row.max_attempts ? 'queued' : 'failed';
        await markOperation(operationId, status, String(error?.message ?? error).slice(0, 500));
        return status;
      }
      await markOperation(operationId, 'succeeded');
      return 'succeeded';
    },

    // R1 boot step 2: re-queue operations with attempts remaining; mark the rest failed.
    // architecture-record: T1 R1 ADR-001
    async resumeAtBoot() {
      const result = await database.query(
        `SELECT operation_id, operation_kind, attempts, max_attempts FROM operation_ledger
          WHERE operation_status IN ('queued', 'running') ORDER BY created_at`,
      );
      const requeued = [];
      let failed = 0;
      for (const row of result.rows) {
        if (!kinds.has(row.operation_kind)) {
          await markOperation(row.operation_id, 'failed', 'unknown operation kind');
          failed += 1;
        } else if (row.attempts >= row.max_attempts) {
          await markOperation(row.operation_id, 'failed', 'attempts exhausted before restart');
          failed += 1;
        } else {
          await markOperation(row.operation_id, 'queued');
          requeued.push(row.operation_id);
        }
      }
      return { requeued, failed };
    },

    // What the user sees: their failed operations.
    async listFailedOperations(ownerAccountId) {
      const result = await database.query(
        `SELECT operation_id, operation_kind, attempts, failure_reason, updated_at FROM operation_ledger
          WHERE owner_account_id = $1 AND operation_status = 'failed' ORDER BY updated_at DESC`,
        [ownerAccountId],
      );
      return result.rows.map((row) => ({
        operationId: row.operation_id,
        operationKind: row.operation_kind,
        attempts: row.attempts,
        failureReason: row.failure_reason,
        failedAt: new Date(row.updated_at).toISOString(),
      }));
    },
  };
  return ledger;
}
