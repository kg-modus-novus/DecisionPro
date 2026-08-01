import { briefingForGapId } from '../data/alp/gapBriefings.js';

/**
 * Merge exported gap stub with UI briefing for modal display.
 */
export function enrichGap(gap) {
  if (!gap) return null;
  const briefing = briefingForGapId(gap.gapId) || {};
  return {
    ...gap,
    ...briefing,
    gapId: gap.gapId,
    title: gap.title,
    need: gap.need,
    rooms: gap.rooms || [],
    findingIds: gap.findingIds || [],
    paidFollowOn: gap.paidFollowOn || briefing.dashboardImpact || '',
  };
}
