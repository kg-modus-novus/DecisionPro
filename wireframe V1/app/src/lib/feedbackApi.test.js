import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createFeedbackPackage,
  listFeedbackPackages,
  updateFeedbackPackage,
} from '../../server/feedbackStore.js';
import { buildFeedbackContext, buildFeedbackPayload } from './buildFeedbackPackage.js';

const tempDirs = [];

function tempEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-feedback-'));
  tempDirs.push(dir);
  return { FEEDBACK_STORE_PATH: path.join(dir, 'queue.json') };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('feedback package builder', () => {
  it('builds a PHI-safe context snapshot', () => {
    const ctx = buildFeedbackContext({
      roleId: 'legislator',
      view: 'evidence',
      activeEvidenceId: 'county',
      walkthrough: { open: true, stepId: 'legislator-home-rooms', stepTitle: 'Rooms', index: 1 },
    });
    expect(ctx.roleId).toBe('legislator');
    expect(ctx.walkthrough.stepId).toBe('legislator-home-rooms');
    expect(ctx.appVersion).toBe('wireframe-v1');
  });

  it('omits empty contact and screenshot from payload', () => {
    const payload = buildFeedbackPayload({
      category: 'suggestion',
      message: 'Add a clearer district shortcut',
      contact: '  ',
      tags: ['walkthrough'],
      context: { roleId: 'legislator' },
      screenshotDataUrl: null,
    });
    expect(payload.contact).toBeUndefined();
    expect(payload.screenshotDataUrl).toBeUndefined();
    expect(payload.tags).toEqual(['walkthrough']);
  });
});

describe('feedback store', () => {
  it('queues, lists, and updates packages', () => {
    const env = tempEnv();
    const created = createFeedbackPackage(
      {
        category: 'problem',
        message: 'Guide sounded unnatural on step 2',
        tags: ['guide-hard-to-understand'],
        context: { roleId: 'legislator', view: 'role-home' },
      },
      env,
    );
    expect(created.status).toBe(201);
    expect(created.body.id).toMatch(/^fb-/);

    const listed = listFeedbackPackages({}, env);
    expect(listed.count).toBe(1);
    expect(listed.items[0].message).toContain('unnatural');
    expect(listed.items[0].hasScreenshot).toBe(false);

    const updated = updateFeedbackPackage(created.body.id, { status: 'triaged' }, env);
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('triaged');
  });

  it('rejects invalid category', () => {
    const env = tempEnv();
    const result = createFeedbackPackage({ category: 'ticket', message: 'x' }, env);
    expect(result.status).toBe(400);
  });
});
