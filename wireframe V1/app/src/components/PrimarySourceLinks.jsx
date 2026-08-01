import { containingPageForFromSysId, isDownloadableSourceUri } from '../lib/sourceLinks.js';

/**
 * Compact list of primary authoritative data-source hyperlinks.
 * Optional onOpenCatalogue deep-links into Authoritative sources view.
 * When href is a downloadable file, also link the containing publisher page.
 */
export function PrimarySourceLinks({
  sources = [],
  title = 'Primary data sources',
  className = '',
  onOpenCatalogue,
}) {
  if (!sources?.length) return null;
  return (
    <div className={`primary-source-links ${className}`.trim()}>
      {title ? <h5 className="primary-source-heading">{title}</h5> : null}
      <ul>
        {sources.map((src) => {
          const pageHref =
            src.pageHref ||
            (src.fromSysId ? containingPageForFromSysId(src.fromSysId) : '') ||
            '';
          const showContainingPage =
            isDownloadableSourceUri(src.href) &&
            pageHref &&
            pageHref.replace(/\/$/, '') !== (src.href || '').replace(/\/$/, '');
          return (
            <li key={src.id || src.href}>
              <a href={src.href} target="_blank" rel="noopener noreferrer">
                {src.label}
              </a>
              {showContainingPage ? (
                <>
                  {' '}
                  <a href={pageHref} target="_blank" rel="noopener noreferrer" className="hint">
                    Containing page
                  </a>
                </>
              ) : null}
              {src.publisher ? <span className="hint">{src.publisher}</span> : null}
              {onOpenCatalogue && src.fromSysId ? (
                <button
                  type="button"
                  className="linkish"
                  onClick={() => onOpenCatalogue(src.fromSysId)}
                >
                  Catalogue
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {onOpenCatalogue ? (
        <button type="button" className="linkish sources-browse-all" onClick={() => onOpenCatalogue(null)}>
          Browse all authoritative sources
        </button>
      ) : null}
    </div>
  );
}
