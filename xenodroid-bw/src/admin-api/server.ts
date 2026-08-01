import http from 'node:http';
import { URL } from 'node:url';
import { closePool, withClient } from '../db/pool.js';
import { AssembleAdminWorkbenchSnapshot } from '../molecules/AssembleAdminWorkbenchSnapshot.js';
import {
  DisplayDtpMonitor,
  DisplayWarehouseObjectData,
} from '../molecules/DisplayWarehouseObjectData.js';

export const ADMIN_API_PORT = Number(process.env.DECISIONPRO_BW_ADMIN_API_PORT || 5044);

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const host = req.headers.host || `127.0.0.1:${ADMIN_API_PORT}`;
  const url = new URL(req.url || '/', `http://${host}`);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && path === '/api/bw/health') {
      await withClient(async (c) => {
        await c.query('SELECT 1');
      });
      sendJson(res, 200, {
        ok: true,
        mode: 'live',
        port: ADMIN_API_PORT,
        generatedAt: new Date().toISOString(),
      });
      return;
    }

    if (req.method === 'GET' && path === '/api/bw/workbench') {
      const snap = await withClient(async (c) => {
        const m = new AssembleAdminWorkbenchSnapshot(c);
        await m.Run();
        if (m.Status !== 'SUCCEEDED') throw new Error(m.ErrorMessage || 'assemble failed');
        return m.Snapshot;
      });
      sendJson(res, 200, snap);
      return;
    }

    if (req.method === 'GET' && path === '/api/bw/load-monitor') {
      const rows = await withClient(async (c) => {
        const r = await c.query(
          `SELECT load_history_id AS id, data_request_id AS "dataRequestId",
                  status, load_class AS "loadClass", row_count AS "rowCount",
                  as_of_date::text AS "asOfDate",
                  coalesce(completed_at, started_at)::text AS "completedAt",
                  source_uri AS "sourceUri", notes
           FROM bw_ctl.load_history
           ORDER BY started_at DESC
           LIMIT 200`,
        );
        return r.rows;
      });
      sendJson(res, 200, { mode: 'live', rows });
      return;
    }

    if (req.method === 'GET' && path === '/api/bw/display-data') {
      const objectName = url.searchParams.get('object') || '';
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100)));
      const result = await withClient(async (c) => {
        const m = new DisplayWarehouseObjectData(c);
        m.ObjectName = objectName;
        m.Limit = limit;
        await m.Run();
        if (m.Status !== 'SUCCEEDED') throw new Error(m.ErrorMessage || 'display failed');
        return m.Result;
      });
      sendJson(res, 200, { mode: 'live', data: result });
      return;
    }

    if (req.method === 'GET' && path === '/api/bw/dtp-monitor') {
      const objectName = url.searchParams.get('object') || '';
      const result = await withClient(async (c) => {
        const m = new DisplayDtpMonitor(c);
        m.TechnicalName = objectName;
        await m.Run();
        if (m.Status !== 'SUCCEEDED') throw new Error(m.ErrorMessage || 'monitor failed');
        return m.Result;
      });
      sendJson(res, 200, { mode: 'live', data: result });
      return;
    }

    sendJson(res, 404, { error: 'not_found', path });
  } catch (e) {
    sendJson(res, 500, {
      error: 'server_error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function startAdminApiServer() {
  const server = http.createServer((req, res) => {
    void handle(req, res);
  });
  await new Promise<void>((resolve, reject) => {
    server.listen(ADMIN_API_PORT, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
  console.log(`XenoDroid BW admin API listening on http://127.0.0.1:${ADMIN_API_PORT}`);
  return server;
}

export async function runAdminApiMain() {
  const server = await startAdminApiServer();
  const shutdown = async () => {
    server.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}
