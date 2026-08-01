import { useState } from 'react';
import { descriptionOf, labelOf, shortLabelOf } from '../../data/alp/dimensions.js';
import { asFilterIds, toggleDimensionFilter } from '../../lib/alpCube.js';
import {
  isNonCalendarPeriodId,
  isYearToken,
  monthScaleOptions,
  rollupSeriesByYear,
  selectedIdsForYearScale,
  selectedYearTokensFromPeriodFilter,
  yearScaleOptions,
} from '../../lib/periodScale.js';
import { signedValueDomain, valueToPlotY } from '../../lib/miniChartScale.js';
import { selectSeriesMarkerIndices } from '../../lib/smartTileVisuals.jsx';
import { filterTileExplain } from '../../lib/tileExplains.js';
import { TileInfoButton } from './TileInfoButton.jsx';

function maxOf(items) {
  return Math.max(1, ...items.map((x) => x.value || 0));
}

function formatNodeValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) {
    const v = abs / 1_000_000_000;
    return `${sign}${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}B`;
  }
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `${sign}${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}M`;
  }
  if (abs >= 10_000) {
    const v = abs / 1_000;
    return `${sign}${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}K`;
  }
  if (abs >= 100) return `${sign}${Math.round(abs).toLocaleString()}`;
  if (Number.isInteger(n)) return String(n);
  return `${sign}${Math.round(abs * 10) / 10}`;
}

function EmptyFilterSeries({ label }) {
  return (
    <p className="alp-mini-empty hint">
      Not stratified in public REAL for {label.toLowerCase()} — no invented slices.
    </p>
  );
}

export function VisualFilterBar({ config, filters, seriesByFilter = {}, onFilter }) {
  return (
    <section
      className="alp-visual-filters sap-vf"
      aria-label="Visual filters"
      data-walkthrough-target="alp-visual-filters"
    >
      <div className="alp-vf-toolbar">
        <strong className="sap-vf-title">Visual Filters</strong>
        <button type="button" className="alp-linkish" onClick={() => onFilter({})}>
          Clear Filters
        </button>
      </div>
      <div className="alp-vf-grid">
        {config.filters.map((filter) =>
          filter.key === 'period' ? (
            <PeriodFilterCard
              key={filter.key}
              filter={filter}
              config={config}
              filters={filters}
              series={seriesByFilter[filter.key] || []}
              onFilter={onFilter}
            />
          ) : (
            <StandardFilterCard
              key={filter.key}
              filter={filter}
              config={config}
              filters={filters}
              series={seriesByFilter[filter.key] || []}
              onFilter={onFilter}
            />
          ),
        )}
      </div>
    </section>
  );
}

function StandardFilterCard({ filter, config, filters, series, onFilter }) {
  const selectedIds = asFilterIds(filters[filter.key]);
  const selectedSet = new Set(selectedIds);
  const peak = maxOf(series);
  const options =
    filter.options[0]?.id === 'all'
      ? filter.options
      : [{ id: 'all', label: `All ${filter.label.toLowerCase()}` }, ...filter.options];
  const selectValue =
    selectedIds.length === 0 ? 'all' : selectedIds.length === 1 ? selectedIds[0] : '__multi__';
  const dimOptions = filter.options.filter((o) => o.id !== 'all');

  return (
    <article className={`alp-vf-card ${selectedIds.length ? 'is-selected' : ''}`}>
      <header>
        <div className="alp-vf-title-row">
          <h3>{filter.label}</h3>
          <TileInfoButton explain={filterTileExplain(filter, config)} />
        </div>
        <select
          value={selectValue}
          onChange={(e) => {
            const value = e.target.value;
            const next = { ...filters };
            if (value === 'all' || value === '__multi__') delete next[filter.key];
            else next[filter.key] = value;
            onFilter(next);
          }}
          aria-label={`Filter ${filter.label}`}
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
          {selectedIds.length > 1 ? (
            <option value="__multi__">{selectedIds.length} selected</option>
          ) : null}
        </select>
      </header>
      <div className={`alp-mini alp-mini-${filter.chart}`}>
        {!series.length ? (
          <EmptyFilterSeries label={filter.label} />
        ) : filter.chart === 'line' ? (
          <MiniLine
            series={series}
            options={dimOptions}
            selectedIds={selectedSet}
            onSelect={(id) => onFilter(toggleDimensionFilter(filters, filter.key, id))}
          />
        ) : filter.chart === 'donut' ? (
          <MiniDonut
            series={series}
            options={dimOptions}
            selectedIds={selectedSet}
            onSelect={(id) => onFilter(toggleDimensionFilter(filters, filter.key, id))}
            showDescriptions={filter.key === 'freshness'}
          />
        ) : (
          <MiniBars
            series={series}
            options={dimOptions}
            peak={peak}
            selectedIds={selectedSet}
            onSelect={(id) => onFilter(toggleDimensionFilter(filters, filter.key, id))}
          />
        )}
      </div>
    </article>
  );
}

function PeriodFilterCard({ filter, config, filters, series, onFilter }) {
  const [scale, setScale] = useState('year');
  const catalog = filter.options || [];
  const selectedIds = asFilterIds(filters.period);
  const yearTokens = selectedYearTokensFromPeriodFilter(selectedIds, catalog);
  const yearOpts = yearScaleOptions(catalog);
  const monthOpts = monthScaleOptions(catalog, yearTokens);
  const scaleOptions = scale === 'year' ? yearOpts : monthOpts;
  const displaySeries =
    scale === 'year' ? rollupSeriesByYear(series, catalog) : series.filter((s) => monthOpts.some((o) => o.id === s.id));
  const selectedSet =
    scale === 'year' ? selectedIdsForYearScale(selectedIds) : new Set(selectedIds.filter((id) => !isYearToken(id)));

  const selectValue =
    selectedIds.length === 0
      ? 'all'
      : selectedIds.length === 1
        ? selectedIds[0]
        : '__multi__';

  const dropdownOptions = [
    { id: 'all', label: scale === 'year' ? 'All years' : 'All periods' },
    ...scaleOptions,
  ];

  function onSelectScalePoint(id) {
    if (scale === 'year') {
      onFilter(toggleDimensionFilter(filters, 'period', id));
      return;
    }
    // Month click replaces year tokens with the month (drill), toggle month if already native.
    if (isYearToken(id) || isNonCalendarPeriodId(id)) {
      onFilter(toggleDimensionFilter(filters, 'period', id));
      return;
    }
    const withoutYears = {
      ...filters,
      period: asFilterIds(filters.period).filter((x) => !isYearToken(x)),
    };
    if (!withoutYears.period.length) delete withoutYears.period;
    else if (withoutYears.period.length === 1) withoutYears.period = withoutYears.period[0];
    onFilter(toggleDimensionFilter(withoutYears, 'period', id));
  }

  return (
    <article className={`alp-vf-card alp-vf-period ${selectedIds.length ? 'is-selected' : ''}`}>
      <header>
        <div className="alp-vf-title-row">
          <h3>{filter.label}</h3>
          <TileInfoButton explain={filterTileExplain(filter, config)} />
        </div>
        <div className="alp-vf-period-controls">
          <div className="alp-period-scale" role="group" aria-label="Period scale">
            {['year', 'month'].map((mode) => (
              <button
                key={mode}
                type="button"
                className={scale === mode ? 'on' : ''}
                onClick={() => setScale(mode)}
              >
                {mode === 'year' ? 'Year' : 'Month'}
              </button>
            ))}
          </div>
          <select
            value={
              selectValue === '__multi__'
                ? '__multi__'
                : scaleOptions.some((o) => o.id === selectValue) || selectValue === 'all'
                  ? selectValue
                  : selectedIds.length
                    ? '__multi__'
                    : 'all'
            }
            onChange={(e) => {
              const value = e.target.value;
              const next = { ...filters };
              if (value === 'all' || value === '__multi__') delete next.period;
              else next.period = value;
              onFilter(next);
            }}
            aria-label="Filter period"
          >
            {dropdownOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
            {selectedIds.length > 1 ||
            (selectedIds.length === 1 && !scaleOptions.some((o) => o.id === selectedIds[0])) ? (
              <option value="__multi__">{selectedIds.length} selected</option>
            ) : null}
          </select>
        </div>
      </header>
      <div className="alp-mini alp-mini-line">
        {!displaySeries.length ? (
          <EmptyFilterSeries label={filter.label} />
        ) : (
          <MiniLine
            series={displaySeries}
            options={scaleOptions}
            selectedIds={selectedSet}
            onSelect={onSelectScalePoint}
            ariaLabel={scale === 'year' ? 'Period by year' : 'Period by month'}
          />
        )}
      </div>
    </article>
  );
}

function MiniBars({ series, options, peak, selectedIds, onSelect }) {
  const hasSelection = selectedIds.size > 0;
  return (
    <ul className={`alp-mini-bars ${hasSelection ? 'has-selection' : ''}`}>
      {series.slice(0, 6).map((item) => {
        const isOn = selectedIds.has(item.id);
        return (
          <li key={item.id}>
            <button
              type="button"
              className={`${isOn ? 'on' : ''} ${hasSelection && !isOn ? 'dim' : ''}`}
              onClick={() => onSelect(item.id)}
              title={labelOf(options, item.id)}
              aria-pressed={isOn}
            >
              <span className="lbl">{labelOf(options, item.id)}</span>
              <span className="track">
                <span className="fill" style={{ width: `${(item.value / peak) * 100}%` }} />
              </span>
              <span className="val">{Math.round(item.value).toLocaleString()}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MiniLine({ series, options, selectedIds, onSelect, ariaLabel = 'Period trend' }) {
  const ordered = [...series].sort((a, b) => {
    const ao = options.find((o) => o.id === a.id)?.sort ?? 0;
    const bo = options.find((o) => o.id === b.id)?.sort ?? 0;
    return ao - bo || String(a.id).localeCompare(String(b.id));
  });
  const { min, max } = signedValueDomain(ordered.map((item) => item.value));
  const w = 240;
  const h = 100;
  const plotBottom = h - 22;
  const plotTop = 18;
  const plotFloor = plotBottom - 8;
  const points = ordered.map((item, i) => {
    const x = ordered.length <= 1 ? w / 2 : (i / (ordered.length - 1)) * (w - 20) + 10;
    const y = valueToPlotY(item.value, min, max, plotTop, plotFloor);
    return {
      x,
      y,
      id: item.id,
      label: shortLabelOf(options, item.id),
      valueLabel: formatNodeValue(item.value),
    };
  });
  // Axis labels density-capped; value labels on those markers + any selected points (or all if sparse).
  const axisIdx = new Set(selectSeriesMarkerIndices(points.length, 5));
  const valueIdx =
    points.length <= 8 ? new Set(points.map((_, i) => i)) : new Set([...axisIdx]);
  const linePts = points.map((p) => `${p.x},${p.y}`).join(' ');
  const zeroY = valueToPlotY(0, min, max, plotTop, plotFloor);
  const showZero = min < 0 && max > 0;
  const areaBaseY = showZero ? zeroY : plotBottom;
  const areaD =
    points.length > 0
      ? `M ${points[0].x} ${areaBaseY} L ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} L ${points[points.length - 1].x} ${areaBaseY} Z`
      : '';
  const spacing =
    ordered.length <= 1 ? w - 24 : (w - 20) / Math.max(1, ordered.length - 1);
  const bandW = Math.max(12, Math.min(spacing * 0.72, 28));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="alp-mini-line" role="img" aria-label={ariaLabel}>
      <rect x="0" y="0" width={w} height={h} fill="rgba(255,255,255,0.06)" />
      {points.map((p) =>
        selectedIds.has(p.id) ? (
          <rect
            key={`band-${p.id}`}
            className="alp-period-band"
            x={p.x - bandW / 2}
            y={4}
            width={bandW}
            height={plotBottom - 2}
            rx="2"
          />
        ) : null,
      )}
      <line x1="8" y1={plotBottom} x2={w - 8} y2={plotBottom} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      {showZero ? (
        <line
          x1="8"
          y1={zeroY}
          x2={w - 8}
          y2={zeroY}
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      ) : null}
      {areaD ? <path d={areaD} fill="rgba(110, 200, 255, 0.18)" stroke="none" /> : null}
      <polyline fill="none" stroke="#6ec8ff" strokeWidth="2" points={linePts} />
      {points.map((p, i) => {
        const isOn = selectedIds.has(p.id);
        const showAxis = axisIdx.has(i) || isOn;
        const showValue = (valueIdx.has(i) || isOn) && p.valueLabel !== '';
        const valueAbove = p.y > plotTop + 12;
        return (
          <g key={p.id} onClick={() => onSelect(p.id)} style={{ cursor: 'pointer' }}>
            <rect
              x={p.x - bandW / 2}
              y={4}
              width={bandW}
              height={plotBottom - 2}
              fill="transparent"
            />
            {isOn ? (
              <circle cx={p.x} cy={p.y} r="7" fill="none" stroke="#9fd8ff" strokeWidth="2" />
            ) : null}
            <circle
              cx={p.x}
              cy={p.y}
              r={isOn || showAxis ? 4.5 : 2.5}
              fill={isOn ? '#9fd8ff' : '#6ec8ff'}
            />
            {showValue ? (
              <text
                x={p.x}
                y={valueAbove ? p.y - 8 : p.y + 12}
                textAnchor="middle"
                className={`alp-period-val ${isOn ? 'on' : ''}`}
              >
                {p.valueLabel}
              </text>
            ) : null}
            {showAxis ? (
              <text
                x={p.x}
                y={h - 6}
                textAnchor="middle"
                className={`alp-period-lbl ${isOn ? 'on' : ''}`}
              >
                {p.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

const DONUT_COLORS = ['#6ec8ff', '#b08d57', '#7ddeb4', '#f07178', '#e2c16b', '#c4a8ff'];

function MiniDonut({ series, options, selectedIds, onSelect, showDescriptions = false }) {
  // Total only the slices we draw — including omitted rows in the denominator
  // leaves a wedge gap at 12 o'clock (seen when measure types > slice cap).
  const visible = series.slice(0, 6);
  const total = visible.reduce((a, b) => a + b.value, 0) || 1;
  const hasSelection = selectedIds.size > 0;
  let angle = 0;
  const slices = visible.map((item, i) => {
    const portion = item.value / total;
    const start = angle;
    angle += portion * Math.PI * 2;
    return { ...item, start, end: angle, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });
  if (slices.length) {
    slices[slices.length - 1].end = Math.PI * 2;
  }
  const cx = 48;
  const cy = 48;
  const r = 34;
  return (
    <div
      className={`alp-mini-donut-wrap ${hasSelection ? 'has-selection' : ''} ${showDescriptions ? 'with-desc' : ''}`}
    >
      <svg viewBox="0 0 96 96" className="alp-mini-donut">
        <circle cx={cx} cy={cy} r="40" fill="rgba(8, 21, 37, 0.55)" />
        {slices.map((slice) => {
          const isOn = selectedIds.has(slice.id);
          return (
            <path
              key={slice.id}
              d={arcPath(cx, cy, r, slice.start, slice.end)}
              fill={slice.color}
              opacity={hasSelection && !isOn ? 0.35 : 1}
              stroke={isOn ? '#9fd8ff' : 'rgba(8, 21, 37, 0.55)'}
              strokeWidth={isOn ? 2 : 0.6}
              onClick={() => onSelect(slice.id)}
              style={{ cursor: 'pointer' }}
            >
              <title>
                {labelOf(options, slice.id)}
                {descriptionOf(options, slice.id) ? ` — ${descriptionOf(options, slice.id)}` : ''}
              </title>
            </path>
          );
        })}
        <circle cx={cx} cy={cy} r="18" fill="#0e1f33" />
      </svg>
      <ul>
        {slices.map((s) => {
          const isOn = selectedIds.has(s.id);
          const desc = descriptionOf(options, s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`${isOn ? 'on' : ''} ${hasSelection && !isOn ? 'dim' : ''}`}
                onClick={() => onSelect(s.id)}
                aria-pressed={isOn}
                title={desc || labelOf(options, s.id)}
              >
                <i style={{ background: s.color }} />
                <span className="donut-legend-text">
                  <span className="donut-legend-label">{labelOf(options, s.id)}</span>
                  {showDescriptions && desc ? (
                    <span className="donut-legend-desc">{desc}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function arcPath(cx, cy, r, start, end) {
  const sweep = end - start;
  if (sweep <= 0) return '';
  // Full circle cannot be drawn as one SVG arc — use two semicircles.
  if (sweep >= Math.PI * 2 - 0.0005) {
    const x = cx;
    const yTop = cy - r;
    const yBot = cy + r;
    return `M ${cx} ${cy} L ${x} ${yTop} A ${r} ${r} 0 1 1 ${x} ${yBot} A ${r} ${r} 0 1 1 ${x} ${yTop} Z`;
  }
  // Tiny overlap closes anti-alias hairlines between neighbors.
  const pad = Math.min(0.012, sweep * 0.25);
  const drawnEnd = Math.min(end + pad, start + Math.PI * 2 - 0.0005);
  const x1 = cx + r * Math.cos(start - Math.PI / 2);
  const y1 = cy + r * Math.sin(start - Math.PI / 2);
  const x2 = cx + r * Math.cos(drawnEnd - Math.PI / 2);
  const y2 = cy + r * Math.sin(drawnEnd - Math.PI / 2);
  const large = drawnEnd - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}
