/**
 * Human-facing Source Reconciliation copy for the Authoritative sources tab.
 * Kept separate from the gate export so prose can improve without re-running ETL.
 */

export const RECON_STEPS = [
  {
    id: 'lineage',
    title: 'Confirm the lineage',
    summary:
      'We walk each number from the screen back through the cube, Detail DSO, and PSA landing file to the LoadHistory record that cites the published source, period, and retrieval time.',
  },
  {
    id: 'owning-source',
    title: 'Match the owning published source',
    summary:
      'We re-open the same government extract that owns the measure and compare it to the warehouse value. A pass means the dashboard reproduces that published aggregate within documented rounding rules.',
  },
  {
    id: 'definition',
    title: 'Check definition, grain, and period',
    summary:
      'We verify that the numerator, denominator, population, geography, and reporting period match the measure catalog so we are not comparing unlike figures.',
  },
  {
    id: 'concordance',
    title: 'Review related sources (advisory)',
    summary:
      'Where helpful, we glance at related authoritative publications for context. Differences here often reflect methodology or lag, so this step informs judgment but does not by itself pass or fail the claim.',
    advisory: true,
  },
  {
    id: 'record',
    title: 'Record the outcome',
    summary:
      'Every check is recorded as pass, fail, or an intentional gap, with citations you can follow. Failures must be repaired and rechecked before DecisionPro may claim the number is accurate.',
  },
];

export function triggerLabel(trigger) {
  switch (trigger) {
    case 'accuracy-check':
      return 'a Source Reconciliation run after REAL data was loaded';
    case 'export-ui':
      return 'a UI export that refreshed the reconciliation snapshot';
    case 'gate':
      return 'the Accuracy Gate cutover sequence';
    default:
      return trigger ? `trigger “${trigger}”` : 'the most recent reconciliation run';
  }
}

export function buildExecutiveParagraphs({ lastRun, summary, results, overall, claimAllowed }) {
  const total = summary.checksTotal ?? results.length ?? 0;
  const passed = summary.checksPassed ?? results.filter((r) => r.ok).length;
  const failed = summary.checksFailed ?? Math.max(0, total - passed);
  const when = lastRun?.ranAt
    ? new Date(lastRun.ranAt).toLocaleString(undefined, {
        dateStyle: 'long',
        timeStyle: 'short',
      })
    : 'the most recent warehouse export';

  const what =
    'Source Reconciliation is DecisionPro’s independent check that the figures shown on this dashboard still match the authoritative public sources that own them. It is not the Accuracy Gate. The Accuracy Gate controls how test data is purged and real data is released; Source Reconciliation proves the released numbers themselves are faithful to their published extracts.';

  const why =
    'Legislators and staff should be able to trust a number without guessing whether it was typed by hand, left over from a demo fixture, or quietly drifted after a refresh. We implemented this process so every accuracy claim rests on a repeatable, citeable comparison—and so failures block the claim until the warehouse is repaired.';

  const whenItRuns =
    'Source Reconciliation runs after every REAL data refresh or curated upload, and again as a required step inside the Accuracy Gate before the accurate path may be treated as claim-ready. You do not need a full gate cutover for an ordinary refresh; you do need this reconciliation whenever displayed magnitudes can change.';

  let resultsPara;
  if (!total) {
    resultsPara =
      'No reconciliation results are available in the current export. Ask an operator to run Source Reconciliation (`npm run bw:accuracy`) after the latest REAL load.';
  } else if (claimAllowed && String(overall).toUpperCase() === 'PASS') {
    resultsPara = `The latest run completed on ${when} after ${triggerLabel(lastRun?.trigger)}. All ${total} automated checks passed (${passed} passed, ${failed} failed). DecisionPro may state accuracy claims for the measures covered by this run. Use the headline figures and verify links below to open the same published sources we compared against.`;
  } else {
    resultsPara = `The latest run completed on ${when} after ${triggerLabel(lastRun?.trigger)}. Of ${total} automated checks, ${passed} passed and ${failed} failed. Accuracy claims remain blocked until every failed check is repaired, reloaded, and rechecked. Review the check results table for the expected versus actual values and source citations.`;
  }

  return { what, why, whenItRuns, resultsPara };
}
