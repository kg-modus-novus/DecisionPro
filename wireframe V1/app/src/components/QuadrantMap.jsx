import { MaximizableChart } from './MaximizableChart.jsx';
import { QUADRANT_EXPLAIN } from '../lib/chartExplains.js';

function pct(n) {
  return `${Math.round(Number(n || 0) * 100)}`;
}

/**
 * Trade-off / opportunity quadrant plot (SVG only).
 */
export function QuadrantPlot({
  findings = [],
  variant = 'blender',
  showUnits = false,
  size = 280,
  compact = false,
}) {
  const pad = showUnits ? (compact ? 36 : 44) : compact ? 22 : 28;
  const inner = size - pad * 2;
  const points = variant === 'brief' ? findings.slice(0, 6) : findings;

  return (
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={variant === 'brief' ? 'Opportunity quadrant' : 'Four quadrant trade-off map'}
      >
      <rect x={pad} y={pad} width={inner} height={inner} className="chart-frame" />
      <line x1={pad + inner / 2} y1={pad} x2={pad + inner / 2} y2={pad + inner} className="chart-axis" />
      <line x1={pad} y1={pad + inner / 2} x2={pad + inner} y2={pad + inner / 2} className="chart-axis" />
      {variant === 'brief' ? (
        <>
          <text x={size / 2} y={size - 4} textAnchor="middle" className="chart-label">
            Feasibility →
          </text>
          <text
            x={10}
            y={size / 2}
            textAnchor="middle"
            className="chart-label"
            transform={`rotate(-90 10 ${size / 2})`}
          >
            Benefit →
          </text>
        </>
      ) : (
        <>
          <text x={pad + 6} y={pad + 14} className="chart-label">
            Win-win
          </text>
          <text x={pad + inner - 58} y={pad + 14} className="chart-label">
            Tradeoff
          </text>
          <text x={pad + 6} y={pad + inner - 8} className="chart-label">
            Underinvest
          </text>
          <text x={pad + inner - 58} y={pad + inner - 8} className="chart-label">
            Pressure
          </text>
          <text x={size / 2} y={size - 6} textAnchor="middle" className="chart-label">
            Budget constraint relief →
          </text>
          <text
            x={12}
            y={size / 2}
            textAnchor="middle"
            className="chart-label"
            transform={`rotate(-90 12 ${size / 2})`}
          >
            Constituent care →
          </text>
        </>
      )}
      {points.map((f, i) => {
        const br = f.budgetRelief ?? 0.4 + i * 0.08;
        const cr = f.careResults ?? 0.5;
        const x = pad + br * inner;
        const y = pad + (1 - cr) * inner;
        const r = showUnits ? (compact ? 9 : 10) : compact ? 8 : 6;
        return (
          <g key={f.id || f.title || i}>
            <circle cx={x} cy={y} r={r} className={`dot focus-${f.focusId || 'budget'}`} />
            {variant === 'brief' ? (
              <text x={x} y={y + 3} textAnchor="middle" fill="#fff" fontSize={showUnits ? 10 : 8}>
                {i + 1}
              </text>
            ) : null}
            {showUnits ? (
              <text
                x={x}
                y={y - r - 4}
                textAnchor="middle"
                className="chart-unit-label"
              >{`BR ${pct(br)} · CR ${pct(cr)}`}</text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function QuadrantMap({
  findings = [],
  onEnlarge,
  variant = 'blender',
  compact = false,
}) {
  const size = compact ? 200 : 280;
  const title = variant === 'brief' ? QUADRANT_EXPLAIN.title : QUADRANT_EXPLAIN.shortTitle;

  return (
    <MaximizableChart
      explain={QUADRANT_EXPLAIN}
      title={title}
      onEnlarge={onEnlarge}
      className={compact ? '' : 'chart-card'}
    >
      <QuadrantPlot findings={findings} variant={variant} size={size} compact={compact} />
    </MaximizableChart>
  );
}
