/**
 * Clickable chart card that opens the maximize modal via onEnlarge.
 */
export function MaximizableChart({ explain, title, subtitle, onEnlarge, children, className = '' }) {
  const heading = title || explain.title;

  return (
    <article className={`chart-explain ${className}`.trim()} data-chart={explain.id}>
      <button
        type="button"
        className="chart-explain-toggle"
        onClick={onEnlarge}
        aria-haspopup="dialog"
        title="Enlarge chart — how to read, next steps, and live weight controls"
      >
        <header className="chart-explain-head">
          <div>
            <h4>{heading}</h4>
            {subtitle ? <p className="hint">{subtitle}</p> : null}
          </div>
          <span className="chart-explain-badge" aria-hidden="true">
            Enlarge ⌄
          </span>
        </header>
        <div className="chart-explain-plot">{children}</div>
        <p className="chart-explain-cue">Click to maximize · how to read · next steps</p>
      </button>
    </article>
  );
}
