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
