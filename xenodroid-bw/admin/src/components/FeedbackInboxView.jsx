import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../parlance.js';
import {
  fetchFeedbackInbox,
  fetchFeedbackItem,
  patchFeedbackItem,
} from '../api/feedbackClient.js';
import { FIXTURE_FEEDBACK } from '../data/feedbackFixtures.js';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

function statusClass(status) {
  if (status === 'done') return 'status-completed';
  if (status === 'triaged') return 'status-active';
  return 'status-upcoming';
}

export function FeedbackInboxView({ parlance, toast }) {
  const [mode, setMode] = useState('loading');
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const snap = await fetchFeedbackInbox();
      const list = Array.isArray(snap.items) ? snap.items : [];
      setItems(list);
      setMode('live');
      if (selectedId && !list.some((row) => row.id === selectedId)) {
        setSelectedId(list[0]?.id || null);
      } else if (!selectedId && list[0]) {
        setSelectedId(list[0].id);
      }
    } catch (e) {
      setItems(FIXTURE_FEEDBACK);
      setMode('fixture');
      setLoadError(e instanceof Error ? e.message : String(e));
      if (!selectedId) setSelectedId(FIXTURE_FEEDBACK[0]?.id || null);
    }
  }, [selectedId]);

  useEffect(() => {
    void refresh();
    // Initial load only; refresh() is recreated when selectedId changes but we
    // avoid a refresh loop by not listing it here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      if (mode === 'fixture') {
        setDetail(FIXTURE_FEEDBACK.find((row) => row.id === selectedId) || null);
        return;
      }
      try {
        const item = await fetchFeedbackItem(selectedId);
        if (!cancelled) setDetail(item);
      } catch {
        if (!cancelled) {
          setDetail(items.find((row) => row.id === selectedId) || null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, mode, items]);

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'suggestion' || filter === 'problem') {
      return items.filter((row) => row.category === filter);
    }
    return items.filter((row) => row.status === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const next = { new: 0, triaged: 0, done: 0, suggestion: 0, problem: 0 };
    for (const row of items) {
      if (next[row.status] != null) next[row.status] += 1;
      if (next[row.category] != null) next[row.category] += 1;
    }
    return next;
  }, [items]);

  async function setStatus(status) {
    if (!selectedId || mode === 'fixture') {
      toast?.('Status updates need a live Feedback API');
      return;
    }
    setBusy(true);
    try {
      const updated = await patchFeedbackItem(selectedId, { status });
      setItems((prev) => prev.map((row) => (row.id === selectedId ? { ...row, ...updated } : row)));
      setDetail((prev) => (prev ? { ...prev, ...updated } : updated));
      toast?.(`Marked ${status}`);
    } catch (e) {
      toast?.(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="feedback-inbox" aria-label="Feedback Inbox">
      <header className="page-head">
        <div>
          <h2>{t(parlance, 'feedbackInbox')}</h2>
          <p className="hint">
            Review Suggestion and Problem packages from the DecisionPro wireframe. Live queue is
            served by the Feedback API on port 5040 (or VITE_FEEDBACK_API_BASE).
          </p>
        </div>
        <div className="toolbar-row">
          <span className={`pill ${mode === 'live' ? 'status-completed' : 'status-upcoming'}`}>
            {mode === 'loading' ? 'Loading…' : mode === 'live' ? 'Live queue' : 'Fixture fallback'}
          </span>
          <button type="button" className="btn" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </header>

      {loadError ? (
        <p className="hint">
          Could not reach Feedback API ({loadError}). Showing fixture packages for layout review.
        </p>
      ) : null}

      <div className="feedback-inbox-counts">
        <span className="pill status-upcoming">{counts.new} new</span>
        <span className="pill status-active">{counts.triaged} triaged</span>
        <span className="pill status-completed">{counts.done} done</span>
        <span className="pill">{counts.suggestion} suggestions</span>
        <span className="pill">{counts.problem} problems</span>
      </div>

      <div className="feedback-inbox-filters">
        {[
          ['all', 'All'],
          ['new', 'New'],
          ['triaged', 'Triaged'],
          ['done', 'Done'],
          ['suggestion', 'Suggestions'],
          ['problem', 'Problems'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn ${filter === id ? 'active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="feedback-inbox-layout">
        <ul className="feedback-inbox-list">
          {visible.length ? (
            visible.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`feedback-inbox-row ${selectedId === row.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <span className={`pill ${statusClass(row.status)}`}>{row.status}</span>
                  <strong>{row.category === 'problem' ? 'Problem' : 'Suggestion'}</strong>
                  <span className="muted">{formatWhen(row.receivedAt)}</span>
                  <span className="feedback-inbox-preview">{row.message}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="hint">No packages in this filter.</li>
          )}
        </ul>

        <article className="feedback-inbox-detail">
          {detail ? (
            <>
              <header className="feedback-detail-head">
                <div>
                  <h3>
                    {detail.category === 'problem' ? 'Problem' : 'Suggestion'} · {detail.id}
                  </h3>
                  <p className="muted">{formatWhen(detail.receivedAt)}</p>
                </div>
                <div className="toolbar-row">
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || detail.status === 'triaged'}
                    onClick={() => void setStatus('triaged')}
                  >
                    Triage
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || detail.status === 'done'}
                    onClick={() => void setStatus('done')}
                  >
                    Done
                  </button>
                </div>
              </header>

              <p className="feedback-detail-message">{detail.message}</p>

              {detail.contact ? (
                <p>
                  <strong>Contact.</strong> {detail.contact}
                </p>
              ) : null}

              {detail.tags?.length ? (
                <p className="feedback-tags">
                  {detail.tags.map((tag) => (
                    <span key={tag} className="pill">
                      {tag}
                    </span>
                  ))}
                </p>
              ) : null}

              <dl className="feedback-detail-dl">
                <dt>Role</dt>
                <dd>{detail.context?.roleId || '—'}</dd>
                <dt>View</dt>
                <dd>{detail.context?.view || '—'}</dd>
                <dt>Evidence room</dt>
                <dd>{detail.context?.activeEvidenceId || '—'}</dd>
                <dt>Guide step</dt>
                <dd>
                  {detail.context?.walkthrough?.open
                    ? `${detail.context.walkthrough.stepTitle || detail.context.walkthrough.stepId || 'open'} (#${detail.context.walkthrough.index ?? '—'})`
                    : '—'}
                </dd>
                <dt>Host</dt>
                <dd>{detail.context?.host || '—'}</dd>
              </dl>

              {detail.screenshotDataUrl ? (
                <figure className="feedback-screenshot">
                  <figcaption>Screenshot</figcaption>
                  <img src={detail.screenshotDataUrl} alt="Submitted UI screenshot" />
                </figure>
              ) : detail.hasScreenshot ? (
                <p className="hint">Screenshot was attached (open live detail to preview).</p>
              ) : (
                <p className="hint">No screenshot attached.</p>
              )}

              <details>
                <summary>Raw context JSON</summary>
                <pre>{JSON.stringify(detail.context || {}, null, 2)}</pre>
              </details>
            </>
          ) : (
            <p className="hint">Select a package to review.</p>
          )}
        </article>
      </div>
    </section>
  );
}
