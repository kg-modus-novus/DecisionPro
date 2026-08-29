import { useNavHistory } from '../lib/navHistory.js';

/**
 * Navigation-stack Back control.
 */
export function BackButton({ className = '', onBack = null, backTitle = null }) {
  const { canGoBack, goBack, revealsNav = false } = useNavHistory();
  const hasLocalBack = typeof onBack === 'function';
  const handleBack = () => {
    if (!hasLocalBack || onBack() === false) goBack();
  };
  return (
    <button
      type="button"
      className={`content-back-btn ${className}`.trim()}
      onClick={handleBack}
      disabled={!hasLocalBack && !canGoBack}
      title={
        backTitle || (revealsNav && !hasLocalBack
          ? 'Show navigation'
          : hasLocalBack || canGoBack
            ? 'Go back'
            : 'No previous page in this session')
      }
    >
      ← Back
    </button>
  );
}

/**
 * Invisible 2–3 column title table:
 * Back (col 1) · title lines (col 2) · optional actions (col 3, right-aligned).
 * All columns top-align; height is content-driven.
 */
export function PageTitleWithBack({ children, className = '', actions = null, onBack = null, backTitle = null }) {
  const hasActions = actions != null;
  return (
    <div
      className={`page-title-with-back${hasActions ? ' page-title-with-back-has-actions' : ''} ${className}`.trim()}
    >
      <div className="page-title-back-col">
        <BackButton onBack={onBack} backTitle={backTitle} />
      </div>
      <div className="page-title-with-back-text">{children}</div>
      {hasActions ? <div className="page-title-actions-col">{actions}</div> : null}
    </div>
  );
}

/** @deprecated Prefer PageTitleWithBack beside page titles */
export function ContentBackBar() {
  return (
    <div className="content-back-bar">
      <BackButton />
    </div>
  );
}
