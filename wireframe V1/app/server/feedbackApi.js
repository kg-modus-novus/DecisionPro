/**
 * Feedback HTTP API — Vite middleware and Vercel serverless.
 * POST packages from the wireframe; GET/PATCH for BW Admin Feedback Inbox.
 */

import {
  createFeedbackPackage,
  getFeedbackPackage,
  listFeedbackPackages,
  updateFeedbackPackage,
} from './feedbackStore.js';

const DEFAULT_CORS_ORIGINS = [
  'https://demo.decisionpro.io',
  'https://demo.DecisionPro.io',
  'https://kg-modus-novus.github.io',
  'http://localhost:5040',
  'http://127.0.0.1:5040',
  'http://localhost:5043',
  'http://127.0.0.1:5043',
];

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

export function resolveFeedbackCorsOrigin(req, env = process.env) {
  const configured = String(env.FEEDBACK_CORS_ORIGINS || env.ASK_SAM_CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = configured.length ? configured : DEFAULT_CORS_ORIGINS;
  const origin = String(req.headers?.origin || req.headers?.Origin || '');
  if (allowed.includes('*')) return '*';
  if (origin && allowed.includes(origin)) return origin;
  if (origin.endsWith('.github.io') || origin === 'https://kg-modus-novus.github.io') {
    return origin;
  }
  return allowed[0] || '*';
}

export function applyFeedbackCors(req, res, env = process.env) {
  const origin = resolveFeedbackCorsOrigin(req, env);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch (err) {
      return Promise.reject(err);
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function matchesFeedbackPath(urlPath = '') {
  const path = String(urlPath).split('?')[0].replace(/\/+$/, '') || '/';
  return path === '/api/feedback' || path.startsWith('/api/feedback/');
}

export async function handleFeedbackRequest(req, res, env = process.env) {
  applyFeedbackCors(req, res, env);

  const url = new URL(req.url || '/', 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (path === '/api/feedback' && req.method === 'GET') {
    const includeScreenshot = url.searchParams.get('includeScreenshot') === '1';
    sendJson(res, 200, listFeedbackPackages({ includeScreenshot }, env));
    return;
  }

  if (path === '/api/feedback' && req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }
    const result = createFeedbackPackage(body, env);
    if (result.error) {
      sendJson(res, result.status || 400, { error: result.error });
      return;
    }
    sendJson(res, result.status, result.body);
    return;
  }

  const detailMatch = path.match(/^\/api\/feedback\/([^/]+)$/);
  if (detailMatch) {
    const id = decodeURIComponent(detailMatch[1]);

    if (req.method === 'GET') {
      const item = getFeedbackPackage(id, env);
      if (!item) {
        sendJson(res, 404, { error: 'Not found' });
        return;
      }
      sendJson(res, 200, item);
      return;
    }

    if (req.method === 'PATCH') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON body' });
        return;
      }
      const result = updateFeedbackPackage(id, body, env);
      if (result.error) {
        sendJson(res, result.status || 400, { error: result.error });
        return;
      }
      sendJson(res, result.status, result.body);
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found' });
}
