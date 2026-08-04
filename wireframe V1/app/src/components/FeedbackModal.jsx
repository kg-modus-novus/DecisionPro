import { useEffect, useId, useState } from 'react';
import {
  buildFeedbackContext,
  buildFeedbackPayload,
  captureFeedbackScreenshot,
} from '../lib/buildFeedbackPackage.js';
import { submitFeedbackPackage } from '../lib/feedbackClient.js';

const GUIDE_HARD_TAG = 'guide-hard-to-understand';

export function FeedbackModal({
  open,
  onClose,
  initialCategory = 'suggestion',
  contextSnapshot = {},
}) {
  const titleId = useId();
  const [category, setCategory] = useState(initialCategory);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(initialCategory === 'problem');
  const [guideHard, setGuideHard] = useState(Boolean(contextSnapshot?.walkthrough?.open));
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [receiptId, setReceiptId] = useState('');

  useEffect(() => {
    if (!open) return;
    setCategory(initialCategory);
    setMessage('');
    setContact('');
    setIncludeScreenshot(initialCategory === 'problem');
    setGuideHard(Boolean(contextSnapshot?.walkthrough?.open));
    setStatus('idle');
    setError('');
    setReceiptId('');
  }, [open, initialCategory, contextSnapshot?.walkthrough?.open]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('submitting');
    setError('');
    try {
      let screenshotDataUrl = null;
      if (includeScreenshot) {
        screenshotDataUrl = await captureFeedbackScreenshot();
      }
      const tags = [];
      if (guideHard) tags.push(GUIDE_HARD_TAG);
      if (contextSnapshot?.walkthrough?.open) tags.push('walkthrough');

      const payload = buildFeedbackPayload({
        category,
        message,
        contact,
        tags,
        context: buildFeedbackContext(contextSnapshot),
        screenshotDataUrl,
      });
      const result = await submitFeedbackPackage(payload);
      setReceiptId(result.id || '');
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  return (
    <div className="feedback-modal-layer" role="presentation">
      <button type="button" className="feedback-modal-scrim" aria-label="Close feedback" onClick={onClose} />
      <div
        className="feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="feedback-modal-head">
          <h2 id={titleId}>Feedback</h2>
          <button type="button" className="feedback-modal-close" onClick={onClose}>
            Close
          </button>
        </header>

        {status === 'done' ? (
          <div className="feedback-modal-body">
            <p className="feedback-success">
              Queued for BW Admin review{receiptId ? ` (${receiptId})` : ''}.
            </p>
            <p className="hint">
              Packages include your note, role/view context, and optional screenshot — never person-level
              Medicaid data.
            </p>
            <div className="feedback-modal-actions">
              <button type="button" className="explain-page-btn" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="feedback-modal-body" onSubmit={handleSubmit}>
            <fieldset className="feedback-category">
              <legend>What are you sending?</legend>
              <label>
                <input
                  type="radio"
                  name="feedback-category"
                  value="suggestion"
                  checked={category === 'suggestion'}
                  onChange={() => setCategory('suggestion')}
                />
                Make a Suggestion
              </label>
              <label>
                <input
                  type="radio"
                  name="feedback-category"
                  value="problem"
                  checked={category === 'problem'}
                  onChange={() => setCategory('problem')}
                />
                Report a Problem
              </label>
            </fieldset>

            <label className="feedback-field">
              <span>{category === 'problem' ? 'What went wrong?' : 'What should we improve?'}</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={4000}
                required
                placeholder="Keep it specific. Do not include names, member IDs, or other personal health information."
              />
            </label>

            <label className="feedback-field">
              <span>Contact (optional)</span>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={200}
                placeholder="Email or name if you want a reply"
              />
            </label>

            <label className="feedback-check">
              <input
                type="checkbox"
                checked={includeScreenshot}
                onChange={(e) => setIncludeScreenshot(e.target.checked)}
              />
              Include a screenshot of the current view
            </label>

            {contextSnapshot?.walkthrough?.open || category === 'problem' ? (
              <label className="feedback-check">
                <input
                  type="checkbox"
                  checked={guideHard}
                  onChange={(e) => setGuideHard(e.target.checked)}
                />
                Guide was hard to understand / sounded unnatural
              </label>
            ) : null}

            <p className="hint feedback-context-hint">
              This package will include role, view, room, and
              {contextSnapshot?.walkthrough?.open
                ? ` guide step “${contextSnapshot.walkthrough.stepTitle || contextSnapshot.walkthrough.stepId}”.`
                : ' current navigation context.'}
            </p>

            {error ? <p className="feedback-error">{error}</p> : null}

            <div className="feedback-modal-actions">
              <button type="button" className="explain-page-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="explain-page-btn feedback-submit"
                disabled={status === 'submitting' || !message.trim()}
              >
                {status === 'submitting' ? 'Sending…' : 'Send to review queue'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
