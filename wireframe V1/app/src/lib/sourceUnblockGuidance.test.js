import { describe, expect, it } from 'vitest';
import { sourceUnblockGuidance } from './sourceUnblockGuidance.js';

describe('sourceUnblockGuidance', () => {
  it('returns null for LOADED sources', () => {
    expect(sourceUnblockGuidance({ loadStatus: 'LOADED' })).toBeNull();
  });

  it('explains what unblocks a RESTRICTED / BLOCKED source', () => {
    const g = sourceUnblockGuidance({
      fromSysId: 'AHRQ_HCUP',
      tosGrade: 'RESTRICTED',
      loadStatus: 'BLOCKED',
      attributionNotes: 'KY SEDD/SID microdata typically licensed — not auto-ingested',
      paidFollowOnTodo: 'Licensed HCUP aggregates or free published KY tables',
    });
    expect(g.title).toBe('To unblock');
    expect(g.need).toMatch(/HCUP/i);
    expect(g.why).toMatch(/licensed/i);
  });

  it('prefers explicit unblockNeed / blockReason', () => {
    const g = sourceUnblockGuidance({
      loadStatus: 'BLOCKED',
      tosGrade: 'RESTRICTED',
      blockReason: 'DUA required',
      unblockNeed: 'Execute AHRQ DUA',
      paidFollowOnTodo: 'ignored when unblockNeed set',
    });
    expect(g.why).toBe('DUA required');
    expect(g.need).toBe('Execute AHRQ DUA');
  });
});
