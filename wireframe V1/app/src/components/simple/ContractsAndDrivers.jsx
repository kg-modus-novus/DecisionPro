// CodeXen: v1 not-applicable
// Contract ledger (plan item #10, Rep. Moser: "a data dashboard for every
// contract") and why spending rose while enrollment fell (#13). Presentation
// only: figures, funding shares and statuses come from the sourced research
// file; a status says whether public documents define an outcome, never a
// judgment of the vendor.
import { Fragment, useState } from 'react';
import { formatNumber } from '../../lib/simpleMode/measureModel.js';
import { useLazyArea } from '../../lib/simpleMode/lazyAreas.js';
import { DataAgeBadge, SourceCite } from './SimpleBlocks.jsx';
import { MethodInfo } from './MethodInfo.jsx';

const usd = (v) => formatNumber(v, 'usd', { compact: true });

function termText(term) {
  if (!term) return '—';
  if (term.start && term.end) {
    const range = `${term.start.slice(0, 4)}–${term.end.slice(0, 4)}`;
    return term.extendedTo ? `${range}, extended to ${term.extendedTo.slice(0, 4)}` : range;
  }
  return term.currentAmendment ? `Amendment ${term.currentAmendment}${term.amendmentEffective ? ` (${term.amendmentEffective.slice(0, 4)})` : ''}` : '—';
}

export function ContractLedger() {
  const area = useLazyArea('contracts');
  const [group, setGroup] = useState('all');
  const [open, setOpen] = useState(null);
  if (!area) return <p className="sm-note" role="status">Loading the contract ledger…</p>;
  const m = area.get('contract-ledger');
  if (!m) return null;
  const groups = [...new Set(m.rows.map((r) => r.group))];
  const rows = m.rows.filter((r) => group === 'all' || r.group === group);
  const counts = m.statusCounts || {};
  return (
    <div className="sm-ledger" data-ledger>
      <div className="sm-ledger-head">
        <p className="sm-note">
          {m.rows.length} contracts and programs. <strong>{counts['outcome defined'] || 0}</strong> have an outcome or performance standard written into public documents;{' '}
          <strong>{counts['no outcome defined'] || 0}</strong> do not. None can yet be shown on or off track: no contract has a published target and a published result for the same period.
          {' '}<DataAgeBadge measure={m} short /> <MethodInfo measure={m} />
        </p>
        <label className="sm-mco-sort">
          <span>Show</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">All contracts</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
      </div>
      <div className="sm-table-wrap">
        <table className="sm-table" aria-label="Contract ledger">
          <thead>
            <tr>
              <th scope="col">Contract</th>
              <th scope="col" className="is-num">A year’s spending</th>
              <th scope="col" className="is-num">Contract ceiling</th>
              <th scope="col">Term</th>
              <th scope="col" className="is-num">Federal / state</th>
              <th scope="col">Outcome held to</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.key}>
                <tr data-contract={r.key}>
                  <th scope="row">
                    <button type="button" className="sm-link" aria-expanded={open === r.key} onClick={() => setOpen(open === r.key ? null : r.key)}>{r.label}</button>
                    <small>{r.group}</small>
                  </th>
                  <td className="is-num">{Number.isFinite(r.annualValue) ? <>{usd(r.annualValue)}<small>{r.annualPeriod}</small></> : '—'}</td>
                  <td className="is-num">{Number.isFinite(r.value) ? usd(r.value) : '—'}</td>
                  <td>{termText(r.term)}</td>
                  <td className="is-num">{Number.isFinite(r.federalSharePct) ? `${Math.round(r.federalSharePct)}% / ${Math.round(100 - r.federalSharePct)}%` : '—'}</td>
                  <td><span className={`sm-status is-${r.status === 'outcome defined' ? 'defined' : 'none'}`}>{r.status === 'outcome defined' ? 'Outcome defined' : 'No outcome defined'}</span><small>{r.outcomeType && r.outcomeType !== 'none' ? r.outcomeType : ''}</small></td>
                </tr>
                {open === r.key ? (
                  <tr className="sm-ledger-detail">
                    <td colSpan={6}>
                      {r.outcomeMeasures?.length ? (
                        <ul>
                          {r.outcomeMeasures.map((o, i) => (
                            <li key={o.code || i}>
                              <strong>{o.code ? `${o.code}: ` : ''}{o.label}</strong>
                              {o.weightPct ? ` · ${o.weightPct}% weight` : ''}{o.role ? ` · ${o.role}` : ''}
                              {o.target ? <span>Target: {o.target}</span> : null}
                              {o.section ? <small>{o.section}</small> : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {r.statusNote ? <p className="sm-note">{r.statusNote}</p> : null}
                      {r.stateActions2024?.count ? <p className="sm-note">State actions reported in 2024: {r.stateActions2024.count}{r.stateActions2024.monetaryPenaltiesUsd ? `, including ${usd(r.stateActions2024.monetaryPenaltiesUsd)} in penalties` : ''}.</p> : null}
                      <p className="sm-note">{r.valueBasis ? `Ceiling: ${r.valueBasis}. ` : ''}{r.fundingBasis ? `Funding: ${r.fundingBasis}` : ''}</p>
                      {r.term?.extensionBasis ? <p className="sm-note">Extension: {r.term.extensionBasis}</p> : null}
                      <SourceCite source={r.source} />
                      {r.outcomeSource ? <SourceCite source={r.outcomeSource} /> : null}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sm-note">The contract ceiling is the most the state may pay over the term, not what it has paid. A status describes the public contract documents; it is not a finding about the vendor.</p>
    </div>
  );
}

function DriverBars({ rows, unit = 'usd' }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)).filter(Number.isFinite));
  return (
    <ul className="sm-drivers">
      {rows.map((r) => (
        <li key={r.key} className={r.value < 0 ? 'is-down' : 'is-up'}>
          <span className="sm-driver-label">{r.label}</span>
          <span className="sm-driver-track">{Number.isFinite(r.value) ? <i style={{ width: `${max ? (Math.abs(r.value) / max) * 50 : 0}%` }} /> : null}</span>
          <span className="sm-driver-value">{Number.isFinite(r.value) ? `${r.value < 0 ? '−' : '+'}${formatNumber(Math.abs(r.value), unit, { compact: true })}` : 'Amount not given'}{Number.isFinite(r.sharePctOfChange) ? <small> {r.sharePctOfChange}%</small> : null}</span>
        </li>
      ))}
    </ul>
  );
}

export function SpendingDrivers() {
  const area = useLazyArea('contracts');
  if (!area) return <p className="sm-note" role="status">Loading the spending breakdown…</p>;
  const four = area.get('spending-change-four-part-ffy2022-2024');
  const byPop = area.get('spending-change-by-population-fy2021-2023');
  const dms = area.get('dms-growth-attribution-sfy2020-2025');
  if (!four) return null;
  const parts = four.rows.filter((r) => !['total-change', 'spend-change-pct', 'enrollee-change-pct'].includes(r.key));
  const pick = (k) => four.rows.find((r) => r.key === k)?.value;
  return (
    <div className="sm-drivers-wrap" data-drivers>
      <article className="sm-measure is-estimate" data-measure-id={four.id}>
        <header className="sm-measure-head">
          <h3>{four.label}</h3>
          <span className="sm-measure-badges"><MethodInfo measure={four} /></span>
        </header>
        <p className="sm-drivers-lede">
          Benefit spending rose <strong>{usd(pick('total-change'))}</strong> ({pick('spend-change-pct')}%) while members fell {Math.abs(pick('enrollee-change-pct'))}%.
          Fewer members pulled spending down; payments per member pushed it up.
        </p>
        <DriverBars rows={parts} />
        <p className="sm-measure-period">{four.period} <DataAgeBadge measure={four} short /></p>
        <SourceCite source={four.source} />
      </article>
      {byPop ? (
        <article className="sm-measure" data-measure-id={byPop.id}>
          <header className="sm-measure-head"><h3>{byPop.label}</h3><span className="sm-measure-badges"><MethodInfo measure={byPop} /></span></header>
          <div className="sm-table-wrap">
            <table className="sm-table" aria-label={byPop.label}>
              <thead><tr><th scope="col">Group</th><th scope="col" className="is-num">Change</th><th scope="col" className="is-num">From enrollment</th><th scope="col" className="is-num">From mix</th><th scope="col" className="is-num">From cost per member</th><th scope="col" className="is-num">Members</th></tr></thead>
              <tbody>
                {byPop.rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{r.label}</th>
                    <td className="is-num">{usd(r.value)}</td>
                    <td className="is-num">{usd(r.enrollmentEffect)}</td>
                    <td className="is-num">{usd(r.mixEffect)}</td>
                    <td className="is-num">{usd(r.costPerEnrolleeEffect)}</td>
                    <td className="is-num">{Number.isFinite(r.enrolleeChangePct) ? `${r.enrolleeChangePct > 0 ? '+' : ''}${r.enrolleeChangePct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sm-measure-period">{byPop.period} <DataAgeBadge measure={byPop} short /></p>
          {byPop.comparability ? <p className="sm-proxy">{byPop.comparability}</p> : null}
        </article>
      ) : null}
      {dms ? (
        <article className="sm-measure" data-measure-id={dms.id}>
          <header className="sm-measure-head"><h3>{dms.label}</h3><span className="sm-measure-badges"><MethodInfo measure={dms} /></span></header>
          <DriverBars rows={dms.rows.map((r) => ({ ...r, sharePctOfChange: r.pctOfGrowth }))} />
          <p className="sm-measure-period">{dms.period} <DataAgeBadge measure={dms} short /></p>
          <SourceCite source={dms.source} />
        </article>
      ) : null}
    </div>
  );
}
