import { MaximizableChart } from './MaximizableChart.jsx';
import { RADAR_EXPLAIN } from '../lib/chartExplains.js';

const AXES = [
  { key: 'budget', label: 'Budget' },
  { key: 'care', label: 'Care' },
  { key: 'access', label: 'Access' },
  { key: 'mco', label: 'MCO' },
  { key: 'political', label: 'Political' },
];

const PACK_FILLS = ['rgba(29,79,145,0.25)', 'rgba(196,92,38,0.22)', 'rgba(31,122,92,0.22)'];
const PACK_STROKES = ['#1d4f91', '#c45c26', '#1f7a5c'];

function pct(n) {
  return `${Math.round(Number(n || 0) * 100)}%`;
}

/**
 * Radar blend-profile plot (SVG only).
 */
export function RadarPlot({
  profile = {},
  overlays = [],
  variant = 'blender',
  showUnits = false,
  size = 280,
  compact = false,
}) {
  // Extra pad so axis labels stay inside the viewBox when maximized.
  const pad = showUnits ? 36 : 8;
  const plot = size;
  const cx = plot / 2;
  const cy = plot / 2;
  const radius = showUnits ? (compact ? 118 : 145) : compact ? 68 : 95;
  const labelOut = showUnits ? 22 : 14;
  const points = AXES.map((axis, index) => {
    const angle = -Math.PI / 2 + (index / AXES.length) * Math.PI * 2;
    const value = profile[axis.key] ?? 0.2;
    return {
      ...axis,
      value,
      x: cx + Math.cos(angle) * radius * value,
      y: cy + Math.sin(angle) * radius * value,
      lx: cx + Math.cos(angle) * (radius + labelOut),
      ly: cy + Math.sin(angle) * (radius + labelOut),
    };
  });
  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');
  const rings = compact && !showUnits ? [0.33, 0.66, 1] : [0.25, 0.5, 0.75, 1];
  const vb = plot + pad * 2;

  function polyFromAxes(values) {
    return AXES.map((axis, index) => {
      const angle = -Math.PI / 2 + (index / AXES.length) * Math.PI * 2;
      const value = values?.[axis.key] ?? 0.2;
      const x = cx + Math.cos(angle) * radius * value;
      const y = cy + Math.sin(angle) * radius * value;
      return `${x},${y}`;
    }).join(' ');
  }

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${vb} ${vb}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={variant === 'brief' ? 'Impact radar' : 'Radar blend profile'}
    >
      {rings.map((ring) => (
        <polygon
          key={ring}
          className="radar-ring"
          points={AXES.map((_, index) => {
            const angle = -Math.PI / 2 + (index / AXES.length) * Math.PI * 2;
            const x = cx + Math.cos(angle) * radius * ring;
            const y = cy + Math.sin(angle) * radius * ring;
            return `${x},${y}`;
          }).join(' ')}
        />
      ))}
      {points.map((p) => (
        <line key={p.key} x1={cx} y1={cy} x2={p.lx} y2={p.ly} className="chart-axis" />
      ))}
      <polygon points={polygon} className="radar-fill" />
      {(overlays || []).slice(0, 3).map((pack, i) => (
        <polygon
          key={pack.id || pack.title || i}
          points={polyFromAxes(pack.axes || {})}
          fill={PACK_FILLS[i % PACK_FILLS.length]}
          stroke={PACK_STROKES[i % PACK_STROKES.length]}
          strokeWidth="1.5"
        >
          <title>{pack.title || `Pack ${i + 1}`}</title>
        </polygon>
      ))}
      {points.map((p) => (
        <g key={p.key}>
          {showUnits ? <circle cx={p.x} cy={p.y} r={5} className="radar-vertex" /> : null}
          <text x={p.lx} y={p.ly} textAnchor="middle" className="chart-label">
            {showUnits ? `${p.label} ${pct(p.value)}` : p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function RadarChart({
  profile = {},
  overlays = [],
  onEnlarge,
  variant = 'blender',
  compact = false,
}) {
  const size = compact ? 200 : 280;
  const title = variant === 'brief' ? RADAR_EXPLAIN.title : RADAR_EXPLAIN.shortTitle;
  const subtitle =
    variant === 'brief'
      ? overlays.length
        ? 'Blend profile with option-pack overlays'
        : 'Relative blend profile'
      : 'Evidence × your priorities — moves with the sliders';

  return (
    <MaximizableChart
      explain={RADAR_EXPLAIN}
      title={title}
      subtitle={subtitle}
      onEnlarge={onEnlarge}
      className={compact ? '' : 'chart-card'}
    >
      <RadarPlot
        profile={profile}
        overlays={overlays}
        variant={variant}
        size={size}
        compact={compact}
      />
    </MaximizableChart>
  );
}
