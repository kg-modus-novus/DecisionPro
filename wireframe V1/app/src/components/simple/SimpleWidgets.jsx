import { useState } from 'react';
import { formatNumber } from '../../lib/simpleMode/measureModel.js';
import { maybeMeasure } from '../../lib/simpleMode/sourcedData.js';
import { ORDERABLE_COLUMNS, SANCTIONS, SANCTIONS_SOURCE, SCORECARD_COLUMNS, scorecardRows } from '../../lib/simpleMode/planScorecard.js';
import { SourceCite } from './SimpleBlocks.jsx';

export function PlanScorecard() {
  const [sortId, setSortId] = useState('enrollment-by-plan');
  const rows = scorecardRows(sortId);
  const col = SCORECARD_COLUMNS.find((c) => c.id === sortId);
  return (
    <div className="sm-mco">
      <label className="sm-mco-sort">
        <span>Order plans by</span>
        <select value={sortId} onChange={(e) => setSortId(e.target.value)}>
          {ORDERABLE_COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <p className="sm-note">
        {col?.better
          ? `Ordered with ${col.better === 'lower' ? 'the lowest' : 'the highest'} first. Plans define some of these figures differently, and none is adjusted for how sick each plan’s members are.`
          : col?.id === 'enrollment-by-plan'
            ? 'Ordered largest first. Membership describes size, not performance.'
            : 'Ordered largest first. This column has no better or worse direction.'}
        {' '}Estimates are not used to order plans, and a column where every plan reports the same value is shown but not ordered.
      </p>
      <div className="sm-table-wrap">
        <table className="sm-table sm-scorecard" aria-label="Health plans side by side">
          <thead>
            <tr>
              <th scope="col">Plan</th>
              {SCORECARD_COLUMNS.map((c) => (
                <th key={c.id} scope="col" className={`is-num${c.id === sortId ? ' is-sorted' : ''}`}>
                  {c.label}
                  <small>{c.period}{c.estimate ? ' · estimate' : ''}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.exited ? 'is-exited' : ''}>
                <th scope="row">{r.name}{r.exited ? <small>{r.exited}</small> : null}</th>
                {SCORECARD_COLUMNS.map((c) => {
                  const v = c.values.get(r.key);
                  return <td key={c.id} className={`is-num${c.id === sortId ? ' is-sorted' : ''}`}>{Number.isFinite(v) ? formatNumber(v, c.unit, { compact: c.unit === 'usd' }) : '—'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sm-source">
        Sources:{' '}
        {[...new Map(SCORECARD_COLUMNS.filter((c) => c.source?.url).map((c) => [c.source.url, c.source])).values()].map((s, i) => (
          <span key={s.url}>{i ? ' · ' : ''}<a href={s.url} target="_blank" rel="noreferrer">{s.publisher || s.title}</a></span>
        ))}
      </p>
    </div>
  );
}

export function SanctionsTable() {
  if (!SANCTIONS.length) return null;
  return (
    <>
      <div className="sm-table-wrap">
        <table className="sm-table" aria-label="Sanctions and corrective actions">
          <thead>
            <tr><th scope="col">Plan</th><th scope="col">Action</th><th scope="col">Topic</th><th scope="col">Contract section</th><th scope="col">Date</th><th scope="col">Resolved</th></tr>
          </thead>
          <tbody>
            {SANCTIONS.map((s, i) => (
              <tr key={`${s.plan}-${i}`}>
                <th scope="row">{s.plan}</th>
                <td>{s.type}{Number.isFinite(s.dollars) ? <small>{formatNumber(s.dollars, 'usd')}</small> : null}</td>
                <td>{s.topic}</td>
                <td>{s.citation || s.reason}</td>
                <td>{s.date}</td>
                <td>{s.remediated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SourceCite source={SANCTIONS_SOURCE} />
    </>
  );
}

function formatWait(days) {
  if (!Number.isFinite(days)) return 'No waitlist';
  if (days < 60) return `${Math.round(days)} days`;
  return days < 365 ? `${Math.round(days / 30.4)} months` : `${(days / 365).toFixed(1)} years`;
}

export function WaiverTable() {
  const waitlist = maybeMeasure('waiver-waitlist-by-waiver');
  const funded = maybeMeasure('waiver-slots-funded');
  const filled = maybeMeasure('waiver-slots-filled');
  const days = maybeMeasure('waiver-avg-days-waiting');
  const added = maybeMeasure('waiver-slots-added-2026-28');
  const cost = maybeMeasure('waiver-cost-per-member');
  if (!waitlist) return null;
  const val = (m, key) => m?.rows.find((r) => r.key === key)?.value;
  const costKey = (key) => cost?.rows.find((r) => r.key === key || r.label.toLowerCase().startsWith(String(key).toLowerCase()))?.value;
  return (
    <>
      <div className="sm-table-wrap">
        <table className="sm-table" aria-label="1915(c) waivers">
          <thead>
            <tr>
              <th scope="col">Waiver</th>
              <th scope="col" className="is-num">Funded slots</th>
              <th scope="col" className="is-num">Filled</th>
              <th scope="col" className="is-num">On the waitlist</th>
              <th scope="col" className="is-num">Average wait</th>
              <th scope="col" className="is-num">New slots, 2026–28 budget</th>
              <th scope="col" className="is-num">Yearly cost per member</th>
            </tr>
          </thead>
          <tbody>
            {waitlist.rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                <td className="is-num">{formatNumber(r.funded ?? val(funded, r.key), 'count')}</td>
                <td className="is-num">{formatNumber(r.filled ?? val(filled, r.key), 'count')}</td>
                <td className="is-num">{formatNumber(r.value, 'count')}</td>
                <td className="is-num">{formatWait(val(days, r.key) ?? (r.value ? NaN : NaN))}</td>
                <td className="is-num">{Number.isFinite(val(added, r.key)) ? formatNumber(val(added, r.key), 'count') : '—'}</td>
                <td className="is-num">{Number.isFinite(costKey(r.key)) ? formatNumber(costKey(r.key), 'usd') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SourceCite source={waitlist.source} period={waitlist.period} asOf={waitlist.asOf} />
      {days ? <SourceCite source={days.source} period={`Average wait ${days.period}`} /> : null}
      {added ? <SourceCite source={added.source} period={`New slots ${added.period}`} /> : null}
    </>
  );
}
