/** Shared explain copy for blender / brief competition charts. */

export const QUADRANT_EXPLAIN = {
  id: 'quadrant',
  title: 'Opportunity quadrant (relative)',
  shortTitle: 'Trade-off map',
  what: [
    'Each numbered point is a blended finding plotted by relative budget-constraint relief (horizontal) against constituent care results (vertical).',
    'Positions are relative scores for examination within the current blend — not standalone forecasts.',
  ],
  how: [
    'Upper-right tends toward higher benefit with more feasibility (win-win territory).',
    'Upper-left: care upside with tighter budget room; lower-right: budget relief with weaker care lift; lower-left: underinvest / pressure.',
    'Compare clusters: findings near each other often share similar trade-offs under the current blend.',
  ],
  use: [
    'Spot which evidence items pull toward win-win versus hard trade-offs before opening option packs.',
    'Use the map to prioritize what to examine next in Path, Law ↔ blender, or Evidence Rooms.',
    'Treat gaps between points as questions for trust notes and data owners — not as causal proof.',
  ],
  sliders: [
    'Focus-tab weight sliders (Budget, Care, Access, MCO, District, Bill readiness) rebalance how findings contribute to the blend.',
    'Raising a focus weight pulls related findings’ emphasis; the quadrant points stay tied to each finding’s budgetRelief / careResults scores, while pack ranking and the radar reshape more strongly.',
    'Reset to balanced restores equal emphasis across focuses you have in play.',
  ],
  next: [
    'Adjust weights, then re-check whether the same findings still sit in win-win territory.',
    'Continue to Path to connect findings → drivers → levers, or open an Evidence Room for the source cube.',
    'When 2+ findings are blended, open Win-Win-Win packs and compare them on the impact radar.',
  ],
};

export const RADAR_EXPLAIN = {
  id: 'radar',
  title: 'Impact radar (relative)',
  shortTitle: 'Current blend profile',
  what: [
    'The filled polygon is the current blend profile across five relative axes: Budget, Care, Access, MCO, and Political.',
    'On the Consideration Brief, additional polygons (when present) overlay Win-Win-Win option packs against that same axis set.',
  ],
  how: [
    'Farther from center = stronger relative emphasis on that axis under the current weights and blended findings.',
    'Compare pack outlines to the blend profile: a pack that stretches Care but shrinks Budget may be a deliberate trade-off to examine.',
    'Axes are relative — useful for conversation and comparison, not for scoring legislation by themselves.',
  ],
  use: [
    'See whether your priorities (via sliders) and the evidence you blended agree on where impact shows up.',
    'Use mismatches (e.g. high Access weight but flat Access spike) to ask for more Access-tagged findings.',
    'Carry the shape into talking points: “under these weights, the blend stresses X more than Y.”',
  ],
  sliders: [
    'Moving a focus-tab slider immediately reshapes this radar (evidence × your priorities).',
    'Budget-heavy weights push the Budget spoke out; Care / Access / MCO / District / Bill readiness do the same on their related axes.',
    'Use Reset to balanced when you want a neutral baseline before testing a caucus-specific emphasis.',
  ],
  next: [
    'Nudge one slider at a time and watch which spoke moves — that teaches the weight→profile link.',
    'Open Action / Win-Win-Win packs and compare pack polygons to the blend profile.',
    'Export a Consideration Brief once trust notes are reviewed so colleagues see the same relative picture.',
  ],
};
