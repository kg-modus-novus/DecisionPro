/**
 * Human-readable why-blocked / what-unblocks guidance for catalogue rows.
 * Soft product copy from catalogue fields — not a legal determination.
 */

const TOS_WHY = {
  RESTRICTED:
    'Terms of use are graded RESTRICTED — license, research DUA, or redistribution limits block auto-ingest on the public POC path.',
  OUT_OF_POC: 'This source is graded OUT_OF_POC and is not in the current accurate-demo load set.',
  UNKNOWN: 'TOS grade is UNKNOWN until Director clearance — not auto-ingested.',
};

export function sourceUnblockGuidance(source) {
  if (!source) return null;
  const status = source.loadStatus || '';
  if (status !== 'BLOCKED' && status !== 'CATALOGUED') return null;

  const explicitWhy = source.blockReason || '';
  const need =
    source.unblockNeed ||
    source.paidFollowOnTodo ||
    (status === 'CATALOGUED'
      ? 'Director-approved public retrieve/load into XenoDroid BW (LoadClass=REAL) for this catalogue entry.'
      : 'Director-authorized licensed or attributable feed, then a REAL load.');

  const why =
    explicitWhy ||
    source.attributionNotes ||
    TOS_WHY[source.tosGrade] ||
    (status === 'CATALOGUED'
      ? 'Catalogued but not yet loaded into the accurate path.'
      : 'Blocked on the accurate path.');

  return {
    status,
    title: status === 'BLOCKED' ? 'To unblock' : 'To load',
    why,
    need,
  };
}
