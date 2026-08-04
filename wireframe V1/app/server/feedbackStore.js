/**
 * Persistent feedback queue for local Vite; /tmp on serverless.
 * No PHI — packages must stay aggregate / UI context only.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STATUSES = new Set(['new', 'triaged', 'done']);
const CATEGORIES = new Set(['suggestion', 'problem']);
const MAX_MESSAGE = 4000;
const MAX_SCREENSHOT_CHARS = 1_800_000;
const MAX_QUEUE = 500;

function storePath(env = process.env) {
  if (env.FEEDBACK_STORE_PATH) return path.resolve(env.FEEDBACK_STORE_PATH);
  if (env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'decisionpro-feedback-queue.json');
  }
  const root = process.env.LOCALAPPDATA || os.tmpdir();
  return path.join(root, 'decisionpro-feedback-queue', 'queue.json');
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readQueue(env = process.env) {
  const file = storePath(env);
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items, env = process.env) {
  const file = storePath(env);
  ensureDir(file);
  const trimmed = items.slice(0, MAX_QUEUE);
  fs.writeFileSync(file, `${JSON.stringify(trimmed, null, 2)}\n`, 'utf8');
  return trimmed;
}

function newId() {
  return `fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeContext(context = {}) {
  if (!context || typeof context !== 'object') return {};
  return {
    roleId: context.roleId ?? null,
    view: context.view ?? null,
    activeEvidenceId: context.activeEvidenceId ?? null,
    activeLawId: context.activeLawId ?? null,
    activePackId: context.activePackId ?? null,
    evidenceObjectId: context.evidenceObjectId ?? null,
    walkthrough: context.walkthrough
      ? {
          open: Boolean(context.walkthrough.open),
          stepId: context.walkthrough.stepId ?? null,
          stepTitle: context.walkthrough.stepTitle ?? null,
          index: Number.isFinite(context.walkthrough.index) ? context.walkthrough.index : null,
        }
      : null,
    host: typeof context.host === 'string' ? context.host.slice(0, 200) : null,
    href: typeof context.href === 'string' ? context.href.slice(0, 500) : null,
    userAgent: typeof context.userAgent === 'string' ? context.userAgent.slice(0, 300) : null,
    appVersion: typeof context.appVersion === 'string' ? context.appVersion.slice(0, 80) : null,
    capturedAt: typeof context.capturedAt === 'string' ? context.capturedAt : null,
  };
}

export function createFeedbackPackage(body = {}, env = process.env) {
  const category = String(body.category || '').trim().toLowerCase();
  if (!CATEGORIES.has(category)) {
    return { error: 'category must be suggestion or problem', status: 400 };
  }

  const message = String(body.message || '').trim();
  if (!message) {
    return { error: 'message is required', status: 400 };
  }
  if (message.length > MAX_MESSAGE) {
    return { error: `message must be ${MAX_MESSAGE} characters or fewer`, status: 400 };
  }

  let screenshotDataUrl = null;
  if (typeof body.screenshotDataUrl === 'string' && body.screenshotDataUrl.startsWith('data:image/')) {
    if (body.screenshotDataUrl.length > MAX_SCREENSHOT_CHARS) {
      return { error: 'screenshot is too large', status: 413 };
    }
    screenshotDataUrl = body.screenshotDataUrl;
  }

  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => String(t).slice(0, 80)).filter(Boolean).slice(0, 12)
    : [];

  const contact =
    typeof body.contact === 'string' && body.contact.trim()
      ? body.contact.trim().slice(0, 200)
      : null;

  const item = {
    id: newId(),
    category,
    message,
    contact,
    tags,
    context: sanitizeContext(body.context),
    hasScreenshot: Boolean(screenshotDataUrl),
    screenshotDataUrl,
    status: 'new',
    notes: '',
    receivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const queue = readQueue(env);
  queue.unshift(item);
  writeQueue(queue, env);

  return {
    status: 201,
    body: {
      id: item.id,
      status: item.status,
      receivedAt: item.receivedAt,
      hasScreenshot: item.hasScreenshot,
    },
  };
}

export function listFeedbackPackages({ includeScreenshot = false } = {}, env = process.env) {
  const items = readQueue(env).map((item) => {
    if (includeScreenshot) return item;
    const { screenshotDataUrl, ...rest } = item;
    return { ...rest, hasScreenshot: Boolean(item.hasScreenshot || screenshotDataUrl) };
  });
  return { items, count: items.length, store: storePath(env) };
}

export function getFeedbackPackage(id, env = process.env) {
  const item = readQueue(env).find((row) => row.id === id);
  if (!item) return null;
  return item;
}

export function updateFeedbackPackage(id, patch = {}, env = process.env) {
  const queue = readQueue(env);
  const index = queue.findIndex((row) => row.id === id);
  if (index < 0) return { error: 'not found', status: 404 };

  const next = { ...queue[index] };
  if (patch.status != null) {
    const status = String(patch.status).trim().toLowerCase();
    if (!STATUSES.has(status)) {
      return { error: 'status must be new, triaged, or done', status: 400 };
    }
    next.status = status;
  }
  if (typeof patch.notes === 'string') {
    next.notes = patch.notes.slice(0, 2000);
  }
  next.updatedAt = new Date().toISOString();
  queue[index] = next;
  writeQueue(queue, env);

  const { screenshotDataUrl, ...rest } = next;
  return {
    status: 200,
    body: { ...rest, hasScreenshot: Boolean(next.hasScreenshot || screenshotDataUrl) },
  };
}

export const FEEDBACK_CATEGORIES = [...CATEGORIES];
export const FEEDBACK_STATUSES = [...STATUSES];
