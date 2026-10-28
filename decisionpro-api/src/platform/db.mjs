// CodeXen: v1 not-applicable
// Database adapter (D2, conventional code). Wraps a `pg`-compatible Pool behind a small interface:
//   query(text, params)   -> { rows, rowCount }   (autocommit)
//   beginTransaction()    -> TransactionHandle    (one pooled client, BEGIN issued)
//   close()
// A TransactionHandle has isOpen, query(), commit(), rollback(). NO_TRANSACTION is the INITIAL value
// containers hold in their TransactionHandle field; it refuses every statement.

import pg from 'pg';

export const NO_TRANSACTION = Object.freeze({
  isOpen: false,
  async query() { throw new Error('No transaction is open'); },
  async commit() { throw new Error('No transaction is open'); },
  async rollback() { throw new Error('No transaction is open'); },
});

export function createDatabase(pool) {
  return {
    async query(text, params = []) {
      const result = await pool.query(text, params);
      return { rows: result.rows ?? [], rowCount: result.rowCount ?? 0 };
    },

    async beginTransaction() {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
      } catch (error) {
        client.release();
        throw error;
      }
      const handle = {
        isOpen: true,
        async query(text, params = []) {
          if (!handle.isOpen) throw new Error('Transaction is closed');
          const result = await client.query(text, params);
          return { rows: result.rows ?? [], rowCount: result.rowCount ?? 0 };
        },
        async commit() {
          if (!handle.isOpen) throw new Error('Transaction is closed');
          handle.isOpen = false;
          try { await client.query('COMMIT'); } finally { client.release(); }
        },
        async rollback() {
          if (!handle.isOpen) throw new Error('Transaction is closed');
          handle.isOpen = false;
          try { await client.query('ROLLBACK'); } finally { client.release(); }
        },
      };
      return handle;
    },

    async close() {
      await pool.end();
    },
  };
}

// TLS, when enabled, verifies the server certificate. sslCa is an optional PEM bundle for a server
// whose certificate is not signed by a public CA. On Railway, prefer the private network URL
// (postgres.railway.internal), which stays inside the project network and needs no TLS.
export function connectDatabase({ connectionString, ssl, sslCa = '' }) {
  const pool = new pg.Pool({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: true, ...(sslCa ? { ca: sslCa } : {}) } : false,
    max: 10,
  });
  return createDatabase(pool);
}
