import { STATE_NAMES } from '../../data/potentialFraudCatalog.js';
import { BillingCode } from './fraudFormat.jsx';
import { EXPLANATION_KIND_LABELS, EXPLANATION_TAG_CLASS, EXPLANATION_TAG_LABELS, POLICY_TIMING_LABELS } from './fraudVisuals.jsx';

/**
 * Law and policy on file for one flagged service-year: the tag the program named, when the change
 * it shows starts, what was searched, and every dated public event that covers the service, each
 * with its source. Presentation only: the matching, the timing, what counts and the tag are the
 * program's (PotentialFraudSignalReview). No person is named: an event shows that a person
 * confirmed it and when.
 */

/** A day at the precision its document states: the year, the month, or the day. */
function atPrecision(day, precision) {
  if (precision === 'year') return day.slice(0, 4);
  if (precision === 'month') return day.slice(0, 7);
  return day;
}

/** A policy event's effective date at the precision its document states. */
export function policyDate(event) {
  return atPrecision(event.effectiveDate, event.effectivePrecision);
}

/** A temporary event's end at the precision its document, or the event that ends it, states; '' when it has none. */
export function policyEndDate(event) {
  return event.endDate ? atPrecision(event.endDate, event.endPrecision) : '';
}

/** The tag's words, with the reason on an EXPLAINED service-year. */
export function explanationTagText(s) {
  const label = EXPLANATION_TAG_LABELS[s.explanationTag] ?? s.explanationTag;
  return s.explanationTag === 'explained' && s.explainedReason ? `${label}: ${s.explainedReason}` : label;
}

/** One sentence on what the tag means for this service-year. */
export function explanationTagSentence(s) {
  const fallOrRise = s.collapseOnly ? 'fall' : 'rise';
  switch (s.explanationTag) {
    case 'explained': return `A confirmed measurement change explains this ${fallOrRise}: ${s.explainedReason}. The figures changed, not the spending, so its dollars are not counted as worth review.`;
    case 'known-case': return 'A confirmed measurement change covers this year, but a known case names it, so the rating stands.';
    case 'safeguard-relaxed': return 'A safeguard was relaxed before this rise began, or in the year it began. That does not explain the rise away: it shows where to look.';
    case 'may-explain': return s.collapseOnly
      ? 'A restriction or enforcement act on file may explain this fall.'
      : 'A policy on file that was meant to add spending here may explain this rise. A reviewer decides.';
    case 'restriction-or-enforcement': return 'A restriction or enforcement act is on file by this year. It does not explain a rise.';
    case 'none-found': return 'A full search of the state found no event that explains this.';
    case 'partly-searched': return 'The state was searched in part and nothing found counts. A partial search can miss an event.';
    default: return 'No search on file reaches this year, so nothing can be said about law or policy here.';
  }
}

/** When the change the service-year shows starts, in words. */
export function changeStartSentence(s) {
  if (!s.changeStartIsKnown) return 'Spending was already far above the enrollment line when the figures begin, so the start of the excess is not known and only a restriction or enforcement act can be counted.';
  return s.collapseOnly ? `The fall starts in ${s.changeStartYear}.` : `The rise this year belongs to starts in ${s.changeStartYear}.`;
}

/** What was searched for the service-year's state, in words. */
export function searchCoverageSentence(review, s) {
  const coverage = review.PolicySearchCoverageByState[s.state];
  const name = STATE_NAMES[s.state] ?? s.state;
  if (!coverage) return `No search of ${name}'s laws and policies is on file.`;
  const kind = coverage.fullSearches === 0 ? 'all partial' : `${coverage.fullSearches} full`;
  const reach = s.policySearchReachesChangeStart ? '' : ' That is before the year in question, so it says nothing about it.';
  return `${coverage.searches} ${coverage.searches === 1 ? 'search' : 'searches'} of ${name} on file (${kind}), searched through ${coverage.searchedThrough}.${reach}`;
}

/** The radar's and the ledger's tag chip. */
export function ExplanationTag({ s }) {
  return (
    <span className={`pfd-sig pfd-sig-policy ${EXPLANATION_TAG_CLASS[s.explanationTag] ?? ''}`} data-explanation-tag={s.explanationTag} title={explanationTagSentence(s)}>
      {explanationTagText(s)}
    </span>
  );
}

/** The codes an event covers, each with its "?" description; a stand-in scope says so. */
function EventScope({ scope }) {
  const parts = [];
  if (scope.allServices) parts.push(<span key="all">all services</span>);
  scope.hcpcs.forEach((code) => parts.push(<BillingCode key={`c-${code}`} code={code} />));
  scope.hcpcsPrefixes.forEach((prefix) => parts.push(<span key={`p-${prefix}`}>codes beginning with <BillingCode code={prefix} /></span>));
  return (
    <span className="pfd-ledger-scope">
      Covers {parts.map((part, i) => <span key={i}>{i > 0 ? ', ' : ''}{part}</span>)}
      {scope.basis === 'stands-in-for-service-family' ? <span className="pfd-ledger-standin" title={scope.note}> · stand-in for the service family the document names</span> : null}
    </span>
  );
}

/** Every event the program carries for the service-year, in the order the ledger lists them. */
export function ledgerEntries(s) {
  return [
    ...s.policyEvents.map((m) => ({ ...m, group: 'on file' })),
    ...s.suggestedPolicyEvents.map((m) => ({ ...m, group: 'suggestion' })),
    ...s.laterPolicyEvents.map((m) => ({ ...m, group: 'later' })),
  ];
}

/** What an entry counts for, in the ledger's words. */
export function entryStandingText(entry) {
  if (entry.group === 'suggestion') return 'unconfirmed suggestion · counts for nothing';
  const confirmed = `confirmed by a person, ${entry.event.confirmedOn}`;
  if (entry.group === 'later') return `${confirmed} · after this year`;
  return `${confirmed} · ${entry.countsTowardExplanation ? 'counted' : 'not counted'}`;
}

export function PolicyLedger({ review, s }) {
  const entries = ledgerEntries(s);
  return (
    <div className="pfd-card pfd-ledger" data-policy-ledger>
      <h3>Law and policy on file</h3>
      {review.PolicyEventsProblem ? <p className="pfd-error" data-policy-problem>The policy events could not be read, so nothing is matched: {review.PolicyEventsProblem}.</p> : null}
      <p className="pfd-ledger-lead">
        <ExplanationTag s={s} /> {explanationTagSentence(s)}
      </p>
      <p className="pfd-note pfd-tight" data-policy-start>{changeStartSentence(s)} {searchCoverageSentence(review, s)}</p>
      {entries.length ? (
        <table className="pfd-table pfd-ledger-table">
          <thead><tr><th>Takes effect</th><th>Event</th><th>Kind</th><th>Against the start</th><th>Source</th></tr></thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={`${entry.group}-${entry.event.id}`} data-policy-event={entry.event.id} data-policy-group={entry.group}>
                <td>{policyDate(entry.event)}{entry.event.endDate ? <span className="pfd-ledger-end"> to {policyEndDate(entry.event)}</span> : null}</td>
                <td>
                  {entry.event.summary}
                  <br /><EventScope scope={entry.event.scope} />
                </td>
                <td>{EXPLANATION_KIND_LABELS[entry.event.explanationKind]}</td>
                <td>
                  {POLICY_TIMING_LABELS[entry.timing]}
                  <br /><span className="pfd-ledger-standing">{entryStandingText(entry)}</span>
                </td>
                <td>
                  <a href={entry.event.source.url} target="_blank" rel="noreferrer" title={`“${entry.event.source.quote}”`}>{entry.event.source.publisher}</a>
                  <br /><span className="pfd-ledger-standing" title="The publisher's own title for the document">&ldquo;{entry.event.source.title}&rdquo;</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="pfd-note" data-policy-empty>No event on file covers this service.</p>}
      <p className="pfd-note">
        Events are dated public documents: laws, agency letters, waivers, enforcement releases. Only an event a person has confirmed is counted, and only a
        confirmed billing-code or reporting change can change a rating. Hover a source for the words it is drawn from.
      </p>
    </div>
  );
}
