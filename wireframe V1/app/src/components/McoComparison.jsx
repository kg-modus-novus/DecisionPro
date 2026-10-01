import { useState } from 'react';
import {
  MCO_MEASURES,
  MCO_COMPARABLE_MEASURE_IDS,
  MCO_UNIFORM_MEASURE_IDS,
  MCPAR_SOURCE,
  compareMcos,
  formatMeasure,
} from '../lib/simpleMode/simpleModeData.js';

export function McoComparison({ onBrowseSources }) {
  const [measureId, setMeasureId] = useState('enrollment');
  const { measure, comparable, rows } = compareMcos(measureId);
  const shown = MCO_MEASURES.filter((m) => MCO_COMPARABLE_MEASURE_IDS.includes(m.id));
  const orderable = shown.filter((m) => !MCO_UNIFORM_MEASURE_IDS.includes(m.id));
  const uniform = shown.filter((m) => MCO_UNIFORM_MEASURE_IDS.includes(m.id));
  const withheld = MCO_MEASURES.filter((m) => !MCO_COMPARABLE_MEASURE_IDS.includes(m.id));

  return (
    <div className="sm-mco">
      <label className="sm-mco-sort">
        <span>Order plans by</span>
        <select value={measureId} onChange={(event) => setMeasureId(event.target.value)}>
          {orderable.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>
      <p className="sm-note">
        {comparable
          ? `${measure.higherLabel}. This is an ordering on one measure, not a ranking of which plans to keep.`
          : 'This measure is not comparable across plans, so plans stay in published order.'}
      </p>
      <div className="sm-table-wrap">
        <table className="sm-table" aria-label="Managed care plans compared">
          <thead>
            <tr>
              <th scope="col">Plan</th>
              {shown.map((m) => (
                <th key={m.id} scope="col" className={`is-num${m.id === measureId ? ' is-sorted' : ''}`}>{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.plan}>
                <th scope="row">
                  {row.plan}
                  {row.dataQualityFlags.map((flag) => (
                    <small key={flag.id} className="sm-flag">Check before comparing: {flag.text}</small>
                  ))}
                </th>
                {shown.map((m) => (
                  <td key={m.id} className={`is-num${m.id === measureId ? ' is-sorted' : ''}`}>
                    {formatMeasure(row.values[m.id], m.kind)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {uniform.length ? (
        <p className="sm-note">
          Every plan reports the same value for {uniform.map((m) => m.label).join('; ')}, so it does not set an order.
        </p>
      ) : null}
      {withheld.length ? (
        <p className="sm-note">
          Not shown because plans report them too differently to compare yet:{' '}
          {withheld.map((m) => m.label).join('; ')}.
        </p>
      ) : null}
      <SourceLine source={MCPAR_SOURCE} onBrowseSources={onBrowseSources} />
    </div>
  );
}

export function SourceLine({ source, onBrowseSources }) {
  return (
    <p className="sm-source">
      Source: {source.label} · {source.period}
      {onBrowseSources ? (
        <>
          {' · '}
          <button type="button" className="sm-link" onClick={() => onBrowseSources(source.sysId)}>
            See where this comes from
          </button>
        </>
      ) : null}
    </p>
  );
}

// REVIEW BUILD ONLY: every measure orderable, top 3 current plans marked.
export function ReviewMcoComparison({ onBrowseSources, measures, rank, comparableIds, sources }) {
  const [measureId, setMeasureId] = useState('encounterTimelyPercent');
  const { measure, rows, top3 } = rank(measureId);
  const comparable = comparableIds.includes(measure.id);
  return (
    <div className="sm-mco">
      <label className="sm-mco-sort">
        <span>Rank plans by</span>
        <select value={measureId} onChange={(event) => setMeasureId(event.target.value)}>
          {measures.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>
      <p className="sm-note sm-review-note">
        {measure.better
          ? `Draft ranking: ${measure.better === 'lower' ? 'lower' : 'higher'} is treated as better, and the top 3 current plans are marked. Which measures to rank on is for Adam to decide.`
          : 'Ordered largest first. This measure says nothing about which plan is better, so no top 3 is marked.'}
        {comparable ? '' : ' Caution: plans report this measure too differently to compare reliably yet.'}
      </p>
      <div className="sm-table-wrap">
        <table className="sm-table" aria-label="Managed care plans ranked">
          <thead>
            <tr>
              <th scope="col">Plan</th>
              {measures.map((m) => (
                <th key={m.id} scope="col" className={`is-num${m.id === measureId ? ' is-sorted' : ''}`}>{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.plan} className={row.exited ? 'is-exited' : ''}>
                <th scope="row">
                  {top3.has(row.plan) ? <span className="sm-top3">Top 3</span> : null}
                  {row.plan}
                  <small>{row.status}</small>
                  {row.dataQualityFlags.map((flag) => (
                    <small key={flag.id} className="sm-flag">Check before comparing: {flag.text}</small>
                  ))}
                </th>
                {measures.map((m) => (
                  <td key={m.id} className={`is-num${m.id === measureId ? ' is-sorted' : ''}`}>
                    {formatMeasure(row.values[m.id], m.kind)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SourceLine source={MCPAR_SOURCE} onBrowseSources={onBrowseSources} />
      {sources.map((s) => <p key={s.label} className="sm-source">Entered by hand from: {s.label}</p>)}
    </div>
  );
}
