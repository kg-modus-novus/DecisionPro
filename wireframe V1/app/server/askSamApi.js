/**
 * Ask Sam HTTP API — Vite middleware and Vercel serverless.
 * Keys never leave the server process.
 */

import { buildSamReply } from '../src/lib/askSam.js';
import { callProvider, resolveProvider } from './providers.js';

const DEFAULT_CORS_ORIGINS = [
  'https://demo.decisionpro.io',
  'https://demo.DecisionPro.io',
  'https://kg-modus-novus.github.io',
  'http://localhost:5040',
  'http://127.0.0.1:5040',
];

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

export function resolveAskSamCorsOrigin(req, env = process.env) {
  const configured = String(env.ASK_SAM_CORS_ORIGINS || '')
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

export function applyAskSamCors(req, res, env = process.env) {
  const origin = resolveAskSamCorsOrigin(req, env);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

export function getAskSamStatus(env = process.env) {
  const provider = resolveProvider(env);
  return {
    live: Boolean(provider),
    provider: provider?.id || null,
    model: provider?.model || null,
    fallback: 'wireframe',
    mode: provider ? 'live' : 'local',
  };
}

export async function handleAskSamRequest(req, res, env = process.env) {
  applyAskSamCors(req, res, env);

  const url = new URL(req.url || '/', 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if ((path === '/api/ask-sam/status' || path.endsWith('/api/ask-sam/status')) && req.method === 'GET') {
    sendJson(res, 200, getAskSamStatus(env));
    return;
  }

  if ((path === '/api/ask-sam' || path.endsWith('/api/ask-sam')) && req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const message = String(body.message || '').trim();
    if (!message) {
      sendJson(res, 400, { error: 'message is required' });
      return;
    }

    const context = body.context || {};
    const history = body.history || [];
    const provider = resolveProvider(env);

    if (!provider) {
      sendJson(res, 200, {
        mode: 'fallback',
        provider: 'wireframe',
        reply: buildSamReply(message, context),
        note: 'No LLM API key configured. Using wireframe Sam. See .env.example.',
      });
      return;
    }

    try {
      const reply = await callProvider({
        provider,
        message,
        context,
        history,
        env,
      });
      sendJson(res, 200, {
        mode: 'live',
        provider: provider.id,
        model: provider.model,
        reply,
      });
    } catch (err) {
      sendJson(res, 200, {
        mode: 'fallback',
        provider: 'wireframe',
        reply: buildSamReply(message, context),
        note: `Live provider failed (${err.message}). Fell back to wireframe Sam.`,
        error: String(err.message || err),
      });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

export function matchesAskSamPath(urlPath = '') {
  const path = String(urlPath).split('?')[0].replace(/\/+$/, '');
  return path === '/api/ask-sam' || path === '/api/ask-sam/status';
}
