import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { KY_COUNTY_SHAPES } from '../../data/alp/kyCountyShapes.js';
import { SmartTileVisual } from '../../lib/smartTileVisuals.jsx';
import {
  formatMeasureValue,
  formatNumber,
  sourceLabel,
  trendOf,
  visualFor,
} from '../../lib/simpleMode/measureModel.js';
import { bandIndexFor, quantileBands } from '../../lib/simpleMode/simpleModeData.js';
import { BAND_COLORS } from '../KyCountyHeatMap.jsx';

/** A small button that opens a dismissible pop-up (Escape or a click outside closes it). */
function InfoPopover({ buttonClass, buttonLabel, buttonContent, title, tone = 'warn', children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);
  return (
    <span className="sm-estimate" ref={ref}>
      <button
        type="button"
        className={buttonClass}
        aria-label={buttonLabel}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        {buttonContent}
      </button>
      {open ? (
        <span className={`sm-estimate-pop is-${tone}`} id={id} role="dialog" aria-label={title}>
          <span className="sm-estimate-pop-head">
            <strong>{title}</strong>
            <button type="button" className="sm-tool" aria-label="Close" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>✕</button>
          </span>
          <span className="sm-estimate-pop-body">{children}</span>
        </span>
      ) : null}
    </span>
  );
}

/**
 * The Estimate pill. With a method note it is a button that opens a pop-up
 * explaining how the figure is estimated; without one it is a plain label.
 */
export function EstimatePill({ note, small = false }) {
  const Tag = small ? 'small' : 'span';
  if (!note) return <Tag className="sm-estimate-chip">Estimate</Tag>;
  return (
    <InfoPopover buttonClass="sm-estimate-chip is-button" buttonContent="Estimate" title="How this is estimated">
      {note}
    </InfoPopover>
  );
}

/** The "?" button on a tile or card: its source, with the link, in a pop-up. */
export function SourceInfo({ source, period, asOf, label = 'this figure' }) {
  if (!source) return null;
  const text = sourceLabel(source);
  return (
    <InfoPopover buttonClass="sm-info-btn" buttonLabel={`Source for ${label}`} buttonContent="?" title="Source" tone="info">
      {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{text}</a> : text}
      {source.page ? `, ${source.page}` : ''}
      {period ? ` · ${period}` : ''}
      {asOf ? ` · as of ${asOf}` : ''}
    </InfoPopover>
  );
}

export function SourceCite({ source, asOf, period }) {
  if (!source) return null;
  const label = sourceLabel(source);
  return (
    <p className="sm-source">
      Source:{' '}
      {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{label}</a> : label}
      {source.page ? `, ${source.page}` : ''}
      {period ? ` · ${period}` : ''}
      {asOf ? ` · as of ${asOf}` : ''}
    </p>
  );
}

function TrendLine({ measure }) {
  const trend = trendOf(measure);
  if (!trend) return null;
  if (trend.direction === 'flat') return <div><dt>Trend</dt><dd>No change since {trend.from}</dd></div>;
  const arrow = trend.direction === 'up' ? '▲' : '▼';
  const reading = trend.crossesBreak ? ' (method changed; not comparable)' : trend.improving == null ? '' : trend.improving ? ' (improving)' : ' (worsening)';
  return (
    <div>
      <dt>Trend</dt>
      <dd className={trend.improving == null ? '' : trend.improving ? 'is-good' : 'is-bad'}>
        {arrow} {formatNumber(Math.abs(trend.change), measure.unit === 'percent' ? 'points' : measure.unit)}
        {measure.unit === 'percent' ? ' points' : ''} since {trend.from}{reading}
      </dd>
    </div>
  );
}

/** One measure, with the full display contract from the release 2 plan §3. */
export function MeasureCard({ measure, compact = false, onOpen = null, children = null }) {
  if (!measure) return null;
  const visual = visualFor(measure);
  const isEstimate = measure.method === 'estimate';
  return (
    <article className={`sm-measure${isEstimate ? ' is-estimate' : ''}${compact ? ' is-compact' : ''}`} data-measure-id={measure.id}>
      <header className="sm-measure-head">
        <h3>{measure.label}</h3>
        <span className="sm-measure-badges">
          {isEstimate ? <EstimatePill note={measure.methodNote} /> : null}
          <SourceInfo source={measure.source} asOf={measure.asOf} label={measure.label} />
        </span>
      </header>
      <div className="sm-measure-visual">
        {visual.visual === 'areaTrend' ? <p className="sm-trend-value">{formatMeasureValue(measure, { compact: true })}</p> : null}
        <SmartTileVisual {...visual} />
      </div>
      <p className="sm-measure-period">{measure.period}{measure.dimension === 'plan' ? ' · by plan' : ''}</p>
      {!compact ? (
        <dl className="sm-contract">
          <TrendLine measure={measure} />
          <div>
            <dt>Target</dt>
            <dd>{measure.target && Number.isFinite(measure.target.value)
              ? `${formatNumber(measure.target.value, measure.unit)} (${measure.target.label})`
              : 'Not set'}</dd>
          </div>
          {measure.comparison && Number.isFinite(measure.comparison.value) ? (
            <div><dt>Compared with</dt><dd>{measure.comparison.label}: {formatNumber(measure.comparison.value, measure.unit)}</dd></div>
          ) : null}
          {measure.responsible ? <div><dt>Responsible</dt><dd>{measure.responsible}</dd></div> : null}
        </dl>
      ) : null}
      {measure.caveat ? <p className="sm-proxy">{measure.caveat}</p> : null}
      {measure.proxyFor ? <p className="sm-proxy">Closest published measure for: {measure.proxyFor}</p> : null}
      {children}
      {onOpen ? <button type="button" className="sm-link" onClick={onOpen}>See the detail</button> : null}
    </article>
  );
}

/** A breakdown table (by plan, waiver, category …) for one or more measures sharing row keys. */
export function MeasureTable({ caption, measures, rowLabel = 'Group', sortBy = null }) {
  const keys = useMemo(() => {
    const seen = new Map();
    for (const m of measures) for (const r of m.rows || []) if (!seen.has(r.key)) seen.set(r.key, r.label);
    const list = [...seen.entries()];
    if (sortBy) {
      const m = measures.find((x) => x.id === sortBy);
      const val = (k) => m?.rows?.find((r) => r.key === k)?.value ?? -Infinity;
      list.sort((a, b) => val(b[0]) - val(a[0]));
    }
    return list;
  }, [measures, sortBy]);
  if (!keys.length) return null;
  return (
    <div className="sm-table-wrap">
      <table className="sm-table" aria-label={caption}>
        <thead>
          <tr>
            <th scope="col">{rowLabel}</th>
            {measures.map((m) => <th key={m.id} scope="col" className="is-num">{m.label}{m.method === 'estimate' ? ' (estimate)' : ''}</th>)}
          </tr>
        </thead>
        <tbody>
          {keys.map(([key, label]) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              {measures.map((m) => {
                const row = m.rows?.find((r) => r.key === key);
                return <td key={m.id} className="is-num">{row ? (row.display ?? formatNumber(row.value, row.unit || m.unit)) : '—'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Kentucky county map shaded by any county measure. */
export function CountyChoropleth({ rows, unit = 'count', legendLabel, selectedFips = null, highlightFips = null, onSelectCounty }) {
  const byFips = useMemo(() => new Map(rows.map((r) => [r.fips, r])), [rows]);
  const bands = useMemo(() => quantileBands(rows.map((r) => r.value)), [rows]);
  const highlight = highlightFips ? new Set(highlightFips) : null;
  return (
    <figure className="sm-map">
      <svg viewBox={KY_COUNTY_SHAPES.viewBox} role="group" aria-label={`Kentucky counties shaded by ${legendLabel}`} className="sm-map-svg">
        {KY_COUNTY_SHAPES.counties.map((shape) => {
          const row = byFips.get(shape.fips);
          const band = bandIndexFor(row?.value, bands);
          const selected = shape.fips === selectedFips;
          const dimmed = highlight && !highlight.has(shape.fips);
          const shown = row ? (row.display ?? formatNumber(row.value, unit)) : '—';
          const label = `${row?.label || shape.name} County: ${shown} ${legendLabel}`;
          return (
            <path
              key={shape.fips}
              d={shape.d}
              data-fips={shape.fips}
              className={`sm-map-county${selected ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}
              fill={band == null ? '#3a4656' : BAND_COLORS[band]}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={selected}
              onClick={() => onSelectCounty?.(selected ? null : shape.fips)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectCounty?.(selected ? null : shape.fips);
                }
              }}
            >
              <title>{label}</title>
            </path>
          );
        })}
      </svg>
      <figcaption className="sm-map-legend" aria-label="Map legend">
        <span>{legendLabel}</span>
        <ol>
          {bands.map((band) => (
            <li key={band.index}>
              <i style={{ background: BAND_COLORS[band.index] }} aria-hidden="true" />
              {formatNumber(band.min, unit, { compact: true })}–{formatNumber(band.max, unit, { compact: true })}
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}

export function SectionHead({ title, note }) {
  return (
    <div className="sm-section-head">
      <h2>{title}</h2>
      {note ? <p className="sm-note">{note}</p> : null}
    </div>
  );
}

export { formatMeasureValue };
