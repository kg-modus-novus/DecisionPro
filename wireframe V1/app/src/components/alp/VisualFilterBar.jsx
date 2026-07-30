import { descriptionOf, labelOf, shortLabelOf } from '../../data/alp/dimensions.js';
import { asFilterIds, toggleDimensionFilter } from '../../lib/alpCube.js';
import { filterTileExplain } from '../../lib/tileExplains.js';
import { TileInfoButton } from './TileInfoButton.jsx';

function maxOf(items) {
  return Math.max(1, ...items.map((x) => x.value || 0));
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
        {config.filters.map((filter) => {
          const selectedIds = asFilterIds(filters[filter.key]);
          const selectedSet = new Set(selectedIds);
          const series = seriesByFilter[filter.key] || [];
          const peak = maxOf(series);
          const options =
            filter.options[0]?.id === 'all'
              ? filter.options
              : [{ id: 'all', label: `All ${filter.label.toLowerCase()}` }, ...filter.options];
          const selectValue =
            selectedIds.length === 0 ? 'all' : selectedIds.length === 1 ? selectedIds[0] : '__multi__';
          const dimOptions = filter.options.filter((o) => o.id !== 'all');

          return (
            <article
              key={filter.key}
              className={`alp-vf-card ${selectedIds.length ? 'is-selected' : ''}`}
            >
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
                {filter.chart === 'line' ? (
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
        })}
      </div>
    </section>
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

function MiniLine({ series, options, selectedIds, onSelect }) {
  const ordered = [...series].sort((a, b) => {
    const ao = options.find((o) => o.id === a.id)?.sort ?? 0;
    const bo = options.find((o) => o.id === b.id)?.sort ?? 0;
    return ao - bo;
  });
  const peak = maxOf(ordered);
  const w = 240;
  const h = 92;
  const plotBottom = h - 22;
  const hasSelection = selectedIds.size > 0;
  const points = ordered.map((item, i) => {
    const x = ordered.length <= 1 ? w / 2 : (i / (ordered.length - 1)) * (w - 20) + 10;
    const y = plotBottom - 8 - (item.value / peak) * (plotBottom - 22);
    return { x, y, id: item.id, label: shortLabelOf(options, item.id) };
  });
  const linePts = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaD =
    points.length > 0
      ? `M ${points[0].x} ${plotBottom} L ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} L ${points[points.length - 1].x} ${plotBottom} Z`
      : '';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="alp-mini-line" role="img" aria-label="Period trend">
      <rect x="0" y="0" width={w} height={h} fill="#e4e6e7" />
      <line x1="8" y1={plotBottom} x2={w - 8} y2={plotBottom} stroke="#c9cbcc" strokeWidth="1" />
      {areaD ? <path d={areaD} fill="rgba(10, 110, 209, 0.14)" stroke="none" /> : null}
      <polyline fill="none" stroke="#0a6ed1" strokeWidth="2" points={linePts} />
      {points.map((p) => {
        const isOn = selectedIds.has(p.id);
        return (
          <g key={p.id} onClick={() => onSelect(p.id)} style={{ cursor: 'pointer' }}>
            {isOn ? (
              <circle cx={p.x} cy={p.y} r="8" fill="none" stroke="#0854a0" strokeWidth="2" />
            ) : null}
            <circle
              cx={p.x}
              cy={p.y}
              r={isOn ? 5 : 3.5}
              fill={isOn ? '#0854a0' : hasSelection ? '#89b8e0' : '#0a6ed1'}
              opacity={hasSelection && !isOn ? 0.85 : 1}
            />
            <text
              x={p.x}
              y={h - 6}
              textAnchor="middle"
              className={`alp-period-lbl ${isOn ? 'on' : ''}`}
            >
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const DONUT_COLORS = ['#0a6ed1', '#0854a0', '#427cac', '#89c2f0', '#354a5f'];

function MiniDonut({ series, options, selectedIds, onSelect, showDescriptions = false }) {
  const total = series.reduce((a, b) => a + b.value, 0) || 1;
  const hasSelection = selectedIds.size > 0;
  let angle = 0;
  const slices = series.slice(0, 5).map((item, i) => {
    const portion = item.value / total;
    const start = angle;
    angle += portion * Math.PI * 2;
    return { ...item, start, end: angle, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });
  const cx = 48;
  const cy = 48;
  const r = 34;
  return (
    <div
      className={`alp-mini-donut-wrap ${hasSelection ? 'has-selection' : ''} ${showDescriptions ? 'with-desc' : ''}`}
    >
      <svg viewBox="0 0 96 96" className="alp-mini-donut">
        <circle cx={cx} cy={cy} r="40" fill="#e8eaeb" />
        {slices.map((slice) => {
          const isOn = selectedIds.has(slice.id);
          return (
            <path
              key={slice.id}
              d={arcPath(cx, cy, r, slice.start, slice.end)}
              fill={slice.color}
              opacity={hasSelection && !isOn ? 0.35 : 1}
              stroke={isOn ? '#0854a0' : 'none'}
              strokeWidth={isOn ? 2 : 0}
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
        <circle cx={cx} cy={cy} r="18" fill="#eef0f1" />
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
  if (end - start >= Math.PI * 2 - 0.001) end = start + Math.PI * 2 - 0.001;
  const x1 = cx + r * Math.cos(start - Math.PI / 2);
  const y1 = cy + r * Math.sin(start - Math.PI / 2);
  const x2 = cx + r * Math.cos(end - Math.PI / 2);
  const y2 = cy + r * Math.sin(end - Math.PI / 2);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}
