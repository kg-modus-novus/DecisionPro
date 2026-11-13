// CodeXen: v1 not-applicable
// A page walkthrough built from what is on screen (Director request 2026-11-13):
// for pages with no hand-written guide, each visible block of the page (its
// header, each section, each card) becomes one step, titled by the block's own
// heading and described by its first sentence of explanatory text. Presentation
// only; it reads the DOM and decides nothing.

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function shorten(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return stop > max * 0.5 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

const DEFAULT_FALLBACK = 'Each figure here shows its date, its source, and how it is measured; the heading names the question this part answers.';

// A sentence that explains, not a date stamp or a figure label.
function isExplanation(text, title) {
  if (text.length < 40 || text.startsWith(title)) return false;
  if (/^(January|February|March|April|May|June|July|August|September|October|November|December|\d)/.test(text) && text.length < 90) return false;
  return /[a-z]{3,} [a-z]{3,} [a-z]{2,}/.test(text);
}

function isShown(el) {
  return el.getClientRects().length > 0;
}

/**
 * Steps for CalloutWalkthrough from the blocks under `root` that match
 * `blockSelector`, in page order, at most `max`. Each block is tagged with a
 * data-walkthrough-target (its own, when it already has one) so the bubble can
 * point at it.
 */
export function buildDomWalkthrough(root, blockSelector, { max = 7, prefix = 'page-step', textSelector = ':scope > p', fallback = DEFAULT_FALLBACK } = {}) {
  if (!root) return [];
  const blocks = [...root.querySelectorAll(blockSelector)].filter(isShown);
  const steps = [];
  const seenTitles = new Set();
  for (const el of blocks) {
    if (steps.length >= max) break;
    // A block may be a heading itself (a page title): its text is in the paragraphs that follow it.
    const isHeading = /^H[1-4]$/.test(el.tagName);
    const heading = isHeading ? el : el.querySelector('h1, h2, h3, h4');
    const title = clean(heading?.textContent) || clean(el.getAttribute('aria-label'));
    if (!title || seenTitles.has(title)) continue;
    seenTitles.add(title);
    const paragraphs = isHeading
      ? [el.nextElementSibling, el.nextElementSibling?.nextElementSibling].filter((n) => n && n.tagName === 'P')
      : [...el.querySelectorAll(textSelector)];
    const text = paragraphs
      .map((p) => clean(p.textContent))
      .find((t) => isExplanation(t, title)) || '';
    const target = el.getAttribute('data-walkthrough-target') || `${prefix}-${steps.length + 1}`;
    el.setAttribute('data-walkthrough-target', target);
    steps.push({
      id: target,
      target,
      title: shorten(title, 90),
      purpose: text ? shorten(text, 260) : fallback,
      allowShowExample: false,
    });
  }
  return steps;
}
