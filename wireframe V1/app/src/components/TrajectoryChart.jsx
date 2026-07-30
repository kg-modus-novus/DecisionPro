/** Shared status-quo trajectory chart for blender spine + Consideration Brief. */

export function TrajectoryChart({ caption } = {}) {
  const w = 320;
  const h = 120;
  const series = [
    { name: 'Pharmacy trend', color: '#c45c26', pts: [100, 108, 117, 128, 141, 155] },
    { name: 'Avoidable ED', color: '#1d4f91', pts: [100, 104, 109, 116, 122, 130] },
    { name: 'Postpartum FU', color: '#1f7a5c', pts: [100, 101, 103, 104, 106, 107] },
    { name: 'State share press.', color: '#5b4a9a', pts: [100, 103, 107, 112, 118, 125] },
  ];
  const years = ['2025', '2026', '2027', '2028', '2029', '2030'];
  return (
    <div className="cb-traj">
      <h4>Key indicator trajectory (index, 2025 = 100)</h4>
      {caption ? <p className="hint">{caption}</p> : null}
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Status quo trajectory">
        {[40, 70, 100].map((y) => (
          <line
            key={y}
            x1="28"
            x2={w - 8}
            y1={h - 18 - (y / 160) * (h - 30)}
            y2={h - 18 - (y / 160) * (h - 30)}
            className="chart-axis"
          />
        ))}
        {series.map((s) => {
          const points = s.pts
            .map((v, i) => {
              const x = 28 + (i / (s.pts.length - 1)) * (w - 40);
              const y = h - 18 - (v / 160) * (h - 30);
              return `${x},${y}`;
            })
            .join(' ');
          return <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2" points={points} />;
        })}
        {years.map((y, i) => (
          <text key={y} x={28 + (i / 5) * (w - 40)} y={h - 4} textAnchor="middle" className="chart-label">
            {y}
          </text>
        ))}
      </svg>
      <ul className="cb-legend">
        {series.map((s) => (
          <li key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
