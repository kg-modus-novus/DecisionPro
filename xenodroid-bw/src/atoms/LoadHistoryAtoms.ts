import crypto from 'node:crypto';
import type pg from 'pg';

export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function InsertLoadHistory(
  client: pg.PoolClient,
  row: {
    load_history_id: string;
    data_request_id: string;
    started_at: Date;
    source_uri: string;
    load_class: 'TEST' | 'REAL';
    status?: string;
  },
) {
  await client.query(
    `INSERT INTO bw_ctl.load_history
      (load_history_id, data_request_id, started_at, source_uri, status, load_class)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      row.load_history_id,
      row.data_request_id,
      row.started_at.toISOString(),
      row.source_uri,
      row.status ?? 'RUNNING',
      row.load_class,
    ],
  );
}

export async function CompleteLoadHistory(
  client: pg.PoolClient,
  load_history_id: string,
  patch: {
    status: 'SUCCEEDED' | 'FAILED' | 'PURGED';
    row_count?: number;
    content_hash?: string;
    as_of_date?: string | null;
    notes?: string;
  },
) {
  await client.query(
    `UPDATE bw_ctl.load_history
     SET completed_at = NOW(),
         status = $2,
         row_count = COALESCE($3, row_count),
         content_hash = COALESCE($4, content_hash),
         as_of_date = COALESCE($5::date, as_of_date),
         notes = COALESCE($6, notes)
     WHERE load_history_id = $1`,
    [
      load_history_id,
      patch.status,
      patch.row_count ?? null,
      patch.content_hash ?? null,
      patch.as_of_date ?? null,
      patch.notes ?? null,
    ],
  );
}
