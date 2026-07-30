/**
 * Compact list of primary authoritative data-source hyperlinks.
 */
export function PrimarySourceLinks({ sources = [], title = 'Primary data sources', className = '' }) {
  if (!sources?.length) return null;
  return (
    <div className={`primary-source-links ${className}`.trim()}>
      {title ? <h5 className="primary-source-heading">{title}</h5> : null}
      <ul>
        {sources.map((src) => (
          <li key={src.id || src.href}>
            <a href={src.href} target="_blank" rel="noopener noreferrer">
              {src.label}
            </a>
            {src.publisher ? <span className="hint">{src.publisher}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
