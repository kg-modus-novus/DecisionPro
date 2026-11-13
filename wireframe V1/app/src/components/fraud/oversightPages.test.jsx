import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OversightReview } from '../../lib/fraud/oversightProgram.js';
import { PotentialFraudSignalReview } from '../../lib/fraud/potentialFraudSignalProgram.js';
import { POTENTIAL_FRAUD_RADAR } from '../../data/alp/potentialFraudRadar.js';
import { POLICY_EVENTS } from '../../data/alp/policyEvents.js';
import { OVERSIGHT_AGGREGATES } from '../../data/alp/oversightAggregates.js';
import { SERVICE_LABELS, STATE_NAMES } from '../../data/potentialFraudCatalog.js';
import { EarlyWarningPage } from './EarlyWarningPage.jsx';
import { FollowBillersPage } from './FollowBillersPage.jsx';
import { ProviderPatternsPage } from './ProviderPatternsPage.jsx';
import { ExplanationLedgerPage } from './ExplanationLedgerPage.jsx';
import { StateBriefPage } from './StateBriefPage.jsx';
import { FRAUD_PAGES } from './PotentialFraudDetection.jsx';

const review = new PotentialFraudSignalReview();
review.Radar = POTENTIAL_FRAUD_RADAR;
review.CodeLabels = SERVICE_LABELS;
review.PolicyEventsExport = POLICY_EVENTS;
review.ScorePotentialFraudCandidates();
const o = new OversightReview();
o.Oversight = OVERSIGHT_AGGREGATES;
o.Radar = POTENTIAL_FRAUD_RADAR;
o.Review = review;
o.CodeLabels = SERVICE_LABELS;
o.StateNames = STATE_NAMES;
o.ReviewEarlyWarning();
o.ReviewBillerGroups();
o.RankBillerProfiles();
o.SummarizeExplanationLedgers();
o.NameStateBriefReadings();
const byId = new Map(review.ServiceYears.map((s) => [s.id, s]));
const noop = () => {};
const PAGES = { early: EarlyWarningPage, follow: FollowBillersPage, patterns: ProviderPatternsPage, ledger: ExplanationLedgerPage, brief: StateBriefPage };

function render(page, focusState, focusId = null) {
  const Page = PAGES[page];
  return renderToStaticMarkup(
    <Page radar={POTENTIAL_FRAUD_RADAR} review={review} oversight={o} byId={byId} focusState={focusState} setFocusState={noop}
      focusId={focusId} setFocusId={noop} openCase={noop} setPage={noop} />,
  );
}

describe('oversight pages', () => {
  it('are five new tabs of the module', () => {
    expect(FRAUD_PAGES.filter((p) => p.isNew).map((p) => p.id)).toEqual(['early', 'follow', 'patterns', 'ledger', 'brief']);
  });

  it('render for every state without error', () => {
    for (const st of Object.keys(STATE_NAMES)) for (const page of Object.keys(PAGES)) expect(() => render(page, st)).not.toThrow();
  });

  it('show Kentucky psychoeducation\'s first alert, groups, signs and ledger', () => {
    const id = 'KY|H2027|2024';
    expect(render('early', 'KY', id)).toContain('First alert: Jul 2023');
    expect(render('early', 'KY', id)).toContain('$182.8M');
    expect(render('follow', 'KY', id)).toContain('data-watch-list="KY|H2027|2024"');
    const patterns = render('patterns', 'KY', id);
    expect(patterns).toContain('126 of 171');
    expect(patterns).toContain('fewer than 11');
    expect(patterns).not.toMatch(/\bNPI\b\s*\d{10}/);
    expect(render('ledger', 'KY', id)).toContain('data-ledger-row="ky-');
  });

  it('withholds the dollars of brief rows with fewer than 11 billers', () => {
    const html = render('brief', 'WV');
    expect(html).toContain('West Virginia');
    const b = o.StateBriefs.WV;
    expect(b.withheldRows).toBeGreaterThan(0);
    expect(html).toContain(`leaving out ${b.withheldRows} service`);
    expect(html).not.toContain('$300.9M'); // the total with the withheld services in it
    const withheld = b.rows.slice(0, 10).filter((r) => r.billersAreWithheld);
    for (const r of withheld) expect(html).toMatch(new RegExp(`data-brief-row="${r.hcpcs}".*?withheld`));
  });
});
