/** Known presentation styles — see docs/planning/smart-tile-style-catalog.md */
export const SMART_TILE_VISUALS = [
  'metric',
  'areaTrend',
  'barCompare',
  'bullet',
  'radial',
  'heroBreakdown',
  'status',
  'gap',
];

/** Omit unit when the display value already carries it (e.g. "-6.27%" + "percent"). */
export function resolveDisplayUnit(value, unit) {
  if (!unit) return null;
  const v = String(value ?? '').trim();
  const u = String(unit).trim();
  if (!u) return null;
  if (u.toLowerCase() === 'percent' && v.includes('%')) return null;
  if (v.toLowerCase().includes(u.toLowerCase())) return null;
  return u;
}

/**
 * Label/tick density budget for compact tile charts.
 * Assumes ~tile plot width and a minimum readable label slot in rem.
 * Prefer this over “one tick per period” once PI history gets dense.
 */
export const TILE_CHART_ASSUMED_WIDTH_REM = 18;
export const TILE_CHART_MIN_LABEL_REM = 3.25;

/** Max labeled ticks that fit the tile budget (always at least first+last). */
export function maxSeriesMarkersForTile(
  assumedWidthRem = TILE_CHART_ASSUMED_WIDTH_REM,
  minLabelRem = TILE_CHART_MIN_LABEL_REM,
) {
  const width = Number(assumedWidthRem);
  const min = Number(minLabelRem);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(min) || min <= 0) return 2;
  return Math.max(2, Math.floor(width / min));
}

/**
 * Indices to label/tick on a dense series.
 * Always includes first and last; spaces intermediates so at most maxMarkers show.
 */
export function selectSeriesMarkerIndices(count, maxMarkers = maxSeriesMarkersForTile()) {
  if (!Number.isFinite(count) || count < 2) return [];
  const cap = Math.max(2, Math.floor(Number(maxMarkers) || 2));
  if (count <= cap) return Array.from({ length: count }, (_, i) => i);
  const indices = [];
  for (let m = 0; m < cap; m += 1) {
    indices.push(Math.round((m / (cap - 1)) * (count - 1)));
  }
  return [...new Set(indices)];
}

/** X positions (0–100) for sparse period ticks in an area/spark series. */
export function seriesTickPositions(count, maxMarkers = maxSeriesMarkersForTile()) {
  return selectSeriesMarkerIndices(count, maxMarkers).map((i) => (i / (count - 1)) * 100);
}

/**
 * Compact tile labels for series points (1.3M, 198K, -6.3%).
 * Prefer fitting under a spark over full significant digits.
 */
export function formatCompactNumber(n, { unit } = {}) {
  if (!Number.isFinite(Number(n))) return '—';
  const num = Number(n);
  const u = String(unit || '').toLowerCase();
  const asPercent = u === 'percent' || u === '%' || u.includes('percent');
  if (asPercent) {
    const fixed = Math.abs(num) >= 10 ? num.toFixed(1) : num.toFixed(1);
    return `${fixed}%`;
  }
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}${k >= 100 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(1);
}

/**
 * SAP ComparisonMicroChart-style pills:
 * small label + value on top, filled track below (internal coloring).
 */
export function ComparisonPills({ rows = [] }) {
  if (!rows.length) return null;
  const scalable = rows.filter(
    (r) => !r.isGap && r.bar !== false && Number.isFinite(Number(r.value)) && Math.abs(Number(r.value)) > 0,
  );
  const max = Math.max(...scalable.map((r) => Math.abs(Number(r.value))), 1);
  return (
    <ul className="st-compare-pills">
      {rows.map((row) => {
        const display = row.display ?? row.value;
        const isGap =
          row.isGap ||
          String(display || '')
            .toLowerCase()
            .includes('gap');
        const n = Number(row.value);
        const canScale = !isGap && row.bar !== false && Number.isFinite(n);
        const pct = canScale ? Math.max(10, Math.round((Math.abs(n) / max) * 100)) : 0;
        const tone = row.tone || (isGap ? 'critical' : 'warning');
        return (
          <li key={row.label} className={isGap ? 'is-gap' : undefined}>
            <div className="st-compare-head">
              <span className="st-compare-label">{row.label}</span>
              <strong className={`st-compare-value is-${tone}`}>{display}</strong>
            </div>
            <div
              className={`st-compare-track${isGap ? ' is-gap' : ''}`}
              aria-hidden="true"
              role="presentation"
            >
              {isGap ? (
                <span className="st-compare-fill is-gap" />
              ) : canScale ? (
                <span className={`st-compare-fill is-${tone}`} style={{ width: `${pct}%` }} />
              ) : (
                <span className={`st-compare-fill is-${tone} is-full`} style={{ width: '100%' }} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function parsePlaceAndCount(displayValue) {
  const raw = String(displayValue ?? '').trim();
  const m = raw.match(/^(.+?)\s+([\d,]+(?:\.\d+)?)\s*$/);
  if (!m) return { place: null, count: raw };
  return { place: m[1], count: m[2] };
}

function ShareVisual({ value, unit, share }) {
  const { place, count } = parsePlaceAndCount(value);
  const shownUnit = resolveDisplayUnit(value, unit);
  const pct =
    Number.isFinite(Number(share.current)) && Number.isFinite(Number(share.total)) && Number(share.total) > 0
      ? Math.max(4, Math.min(100, Math.round((Number(share.current) / Number(share.total)) * 100)))
      : 0;
  return (
    <div className="st-visual st-share">
      <p className="st-share-primary">
        {place ? <span className="st-share-place">{place}</span> : null}
        <span className="st-share-number">{count}</span>
        {shownUnit ? <span className="st-share-unit">{shownUnit}</span> : null}
      </p>
      <div className="st-share-bar-block">
        <div className="st-compare-head">
          <span className="st-compare-label">{share.label || 'Share of total'}</span>
          <strong className="st-compare-value is-positive">{share.display}</strong>
        </div>
        <div className="st-compare-track" aria-hidden="true" role="presentation">
          <span className="st-compare-fill is-positive" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function MetricVisual({ value, unit, direction, scale, series, seriesLabels, share, compareRows }) {
  if (Array.isArray(series) && series.length >= 2) {
    return (
      <AreaTrendVisual
        value={value}
        unit={unit}
        series={series}
        seriesLabels={seriesLabels}
        direction={direction}
      />
    );
  }
  if (
    share &&
    Number.isFinite(Number(share.current)) &&
    Number.isFinite(Number(share.total)) &&
    !(Array.isArray(compareRows) && compareRows.length)
  ) {
    return <ShareVisual value={value} unit={unit} share={share} />;
  }
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : null;
  const shownUnit = resolveDisplayUnit(value, unit);
  const pills =
    Array.isArray(compareRows) && compareRows.length
      ? compareRows
      : [
          {
            label: 'Published aggregate',
            display: shownUnit ? `${value} ${shownUnit}` : String(value ?? '—'),
            value: 1,
            tone: direction === 'down' ? 'negative' : direction === 'up' ? 'warning' : 'positive',
            bar: false,
          },
        ];

  return (
    <div className="st-visual st-metric has-pills">
      <div className="st-metric-kpi">
        <p className="role-home-measure-value">
          <span className="st-kpi-number">{value}</span>
          {scale ? <span className="st-kpi-scale">{scale}</span> : null}
          {shownUnit ? <span className="st-kpi-unit">{shownUnit}</span> : null}
          {arrow ? (
            <span className="st-kpi-trend" aria-hidden="true">
              {arrow}
            </span>
          ) : null}
        </p>
      </div>
      <div className="st-metric-graphic">
        <ComparisonPills rows={pills} />
      </div>
    </div>
  );
}

function AreaTrendVisual({ value, unit, series = [], seriesLabels = [], direction }) {
  if (!series.length || series.length < 2) {
    return <MetricVisual value={value} unit={unit} direction={direction} />;
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const coords = series.map((v, i) => {
    const x = (i / (series.length - 1)) * 100;
    const y = 34 - ((v - min) / range) * 26;
    return { x, y, v, label: seriesLabels[i] || `P${i + 1}` };
  });
  const pts = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `0,40 ${pts} 100,40`;
  // Full polyline keeps shape; ticks/labels/dots are density-capped so axes stay readable.
  const markerIdx = selectSeriesMarkerIndices(series.length);
  const markers = markerIdx.map((i) => ({ ...coords[i], index: i }));
  const last = coords[coords.length - 1];
  const compactLatest = formatCompactNumber(last.v, { unit });
  return (
    <div className="st-visual st-area">
      <div className="st-area-plot">
        <svg
          className="st-area-chart"
          viewBox="0 0 100 40"
          role="img"
          aria-label={`${direction || 'stable'} trend across ${series.length} periods; latest ${compactLatest}`}
          preserveAspectRatio="none"
        >
          <polygon points={area} className="st-area-fill" />
          <polyline points={pts} className="st-area-line" />
          {markers.map((c, i) => (
            <line
              key={`tick-${c.index}`}
              x1={c.x}
              y1={i === 0 || i === markers.length - 1 ? 36 : 8}
              x2={c.x}
              y2={40}
              className={
                i === 0 || i === markers.length - 1 ? 'st-area-tick' : 'st-area-tick st-area-tick-mid'
              }
            />
          ))}
          {markers.map((c, i) => (
            <circle
              key={`pt-${c.index}`}
              cx={c.x}
              cy={c.y}
              r={i === markers.length - 1 ? 2.2 : 1.6}
              className={`st-area-point${i === markers.length - 1 ? ' is-latest' : ''}`}
            />
          ))}
        </svg>
        <ol className="st-area-points" aria-label="Selected period values on the chart">
          {markers.map((c, i) => {
            const isLatest = i === markers.length - 1;
            return (
              <li
                key={`${c.label}-${c.index}`}
                className={isLatest ? 'is-latest' : undefined}
                style={{ left: `${c.x}%` }}
              >
                <strong className="st-area-compact">{formatCompactNumber(c.v, { unit })}</strong>
                <span className="st-area-period">
                  {c.label}
                  {isLatest ? <span className="st-area-latest-tag"> latest</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function BarCompareVisual({ bars = [], value, unit, stackBars = false }) {
  if (!bars.length) {
    return <MetricVisual value={value} unit={unit} />;
  }
  const shownUnit = resolveDisplayUnit(value, unit);
  // 3+ comparison rows (e.g. top/bottom county ranks) stack full-width so all bars stay visible.
  const stacked = stackBars || bars.length >= 3;
  return (
    <div className={`st-visual st-bars${stacked ? ' is-stacked' : ''}`}>
      {value && !stacked ? (
        <p className="role-home-measure-value st-bars-hero">
          <span className="st-kpi-number">{value}</span>
          {shownUnit ? <span className="st-kpi-unit">{shownUnit}</span> : null}
        </p>
      ) : null}
      <ComparisonPills rows={bars} />
    </div>
  );
}

function BulletVisual({ value, unit, bullet = {} }) {
  const current = Number(bullet.current);
  const target = Number(bullet.target);
  const hasNums = Number.isFinite(current) && Number.isFinite(target);
  if (!hasNums) {
    return <MetricVisual value={value} unit={unit} />;
  }
  const min = Number.isFinite(bullet.min) ? bullet.min : Math.min(0, current, target);
  const max = Number.isFinite(bullet.max) ? bullet.max : Math.max(Math.abs(current), Math.abs(target), 1);
  const span = max - min || 1;
  const curPct = Math.min(100, Math.max(0, ((current - min) / span) * 100));
  const tgtPct = Math.min(100, Math.max(0, ((target - min) / span) * 100));
  const barEnd = Math.max(curPct, 2);
  const shownUnit = resolveDisplayUnit(value, unit);
  return (
    <div className="st-visual st-bullet">
      <p className="role-home-measure-value">
        <span className="st-kpi-number">{value}</span>
        {shownUnit ? <span className="st-kpi-unit">{shownUnit}</span> : null}
      </p>
      <div className="st-bullet-track" role="img" aria-label={bullet.label || 'Current versus reference'}>
        <span className="st-bullet-range" />
        <span className="st-bullet-actual" style={{ width: `${barEnd}%` }} />
        <span className="st-bullet-target" style={{ left: `${tgtPct}%` }} title={bullet.targetLabel || 'Reference'} />
        <span className="st-bullet-marker" style={{ left: `${curPct}%` }} />
      </div>
      <div className="st-bullet-scale" aria-hidden="true">
        <span>{bullet.minLabel ?? String(min)}</span>
        <span>{bullet.targetLabel || 'target'}</span>
        <span>{bullet.maxLabel ?? String(max)}</span>
      </div>
      <p className="st-bullet-caption hint">{bullet.label || 'vs reference'}</p>
    </div>
  );
}

function RadialVisual({ value, unit, radial = {}, direction }) {
  const pctRaw = Number(radial.percent);
  const pct = Number.isFinite(pctRaw) ? Math.min(100, Math.max(0, pctRaw)) : null;
  if (pct == null) {
    return <MetricVisual value={value} unit={unit} direction={direction} />;
  }
  const r = 15.5;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const shownUnit = resolveDisplayUnit(value, unit);
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : null;
  return (
    <div className="st-visual st-radial">
      <svg className="st-radial-ring" viewBox="0 0 40 40" role="img" aria-label={`${pct} percent`}>
        <circle className="st-radial-track" cx="20" cy="20" r={r} />
        <circle
          className="st-radial-progress"
          cx="20"
          cy="20"
          r={r}
          strokeDasharray={`${dash.toFixed(2)} ${c.toFixed(2)}`}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <div className="st-radial-kpi">
        <p className="role-home-measure-value">
          <span className="st-kpi-number">{value}</span>
          {shownUnit ? <span className="st-kpi-unit">{shownUnit}</span> : null}
          {arrow ? (
            <span className="st-kpi-trend" aria-hidden="true">
              {arrow}
            </span>
          ) : null}
        </p>
        {radial.caption ? <p className="st-radial-caption hint">{radial.caption}</p> : null}
      </div>
    </div>
  );
}

function HeroBreakdownVisual({ value, unit, breakdown = [], scale }) {
  const shownUnit = resolveDisplayUnit(value, unit);
  const rows = breakdown.map((row) => {
    const display = row.display ?? row.value;
    const isGap =
      row.isGap ||
      String(display || '')
        .toLowerCase()
        .includes('gap');
    return {
      ...row,
      display,
      isGap,
      bar: row.bar === false || !Number.isFinite(Number(row.value)) ? false : row.bar,
    };
  });
  return (
    <div className="st-visual st-hero-breakdown">
      <p className="role-home-measure-value st-hero-value">
        <span className="st-kpi-number">{value}</span>
        {scale ? <span className="st-kpi-scale">{scale}</span> : null}
        {shownUnit ? <span className="st-kpi-unit">{shownUnit}</span> : null}
      </p>
      <ComparisonPills rows={rows} />
    </div>
  );
}

function StatusVisual({ value, status = {} }) {
  const tone = status.tone || 'info';
  return (
    <div className="st-visual st-status">
      <div className="st-status-row">
        <svg className="st-status-disc" viewBox="0 0 40 40" role="img" aria-label={`Status ${value || tone}`}>
          <circle className={`st-status-disc-fill is-${tone}`} cx="20" cy="20" r="14" />
          <circle className="st-status-disc-ring" cx="20" cy="20" r="17" />
        </svg>
        <div className="st-status-copy">
          <p className={`st-status-flag is-${tone}`}>{value || status.label || 'Status'}</p>
          {status.detail ? <p className="st-status-detail">{status.detail}</p> : null}
        </div>
      </div>
      {status.chips?.length ? (
        <ul className="st-status-chips">
          {status.chips.map((c) => (
            <li key={c} className="st-chip">
              {c}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function GapVisual({ value, gap = {} }) {
  return (
    <div className="st-visual st-gap">
      <div className="st-gap-row">
        <svg className="st-gap-glyph" viewBox="0 0 48 48" role="img" aria-label="Explicit gap — no published magnitude">
          <circle className="st-gap-ring" cx="24" cy="24" r="16" />
          <line className="st-gap-slash" x1="12" y1="36" x2="36" y2="12" />
          <rect className="st-gap-bar-ghost" x="10" y="22" width="28" height="4" rx="1" />
        </svg>
        <div className="st-gap-copy">
          <p className="st-gap-badge">{value || 'Gap'}</p>
          {gap.gapId ? <p className="st-gap-id">{gap.gapId}</p> : null}
        </div>
      </div>
      {gap.accessPath ? <p className="st-gap-path hint">{gap.accessPath}</p> : null}
    </div>
  );
}

/**
 * Render the visual body for a smart tile presentation model.
 */
export function SmartTileVisual(props) {
  const { visual } = props;
  switch (visual) {
    case 'areaTrend':
      return <AreaTrendVisual {...props} />;
    case 'barCompare':
      return (
        <BarCompareVisual
          bars={props.bars}
          value={props.value}
          unit={props.unit}
          stackBars={props.stackBars}
        />
      );
    case 'bullet':
      return <BulletVisual {...props} />;
    case 'radial':
      return <RadialVisual {...props} />;
    case 'heroBreakdown':
      return <HeroBreakdownVisual {...props} />;
    case 'status':
      return <StatusVisual {...props} />;
    case 'gap':
      return <GapVisual {...props} />;
    case 'metric':
    default:
      return <MetricVisual {...props} />;
  }
}
