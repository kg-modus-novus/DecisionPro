// CodeXen: v1 not-applicable
// Shareable links to a simple-mode page and sub-tab, e.g.
// ?state=KY&view=simple&page=county&tab=zips opens "Medicaid in my county" →
// "Zip codes". `page` is the simple view without its "simple-" prefix; `tab` is
// a sub-tab id from SIMPLE_SUBTABS (or any section/measure anchor the page knows).
import { SIMPLE_SUBTABS, SIMPLE_VIEWS } from './simpleAreas.js';

const PREFIX = 'simple-';

/** The simple view and anchor a URL asks for, or null when it names none (or an unknown page). */
export function readSimpleLink(search) {
  const params = new URLSearchParams(search);
  const page = (params.get('page') || '').trim().toLowerCase();
  if (!page) return null;
  const view = page.startsWith(PREFIX) ? page : `${PREFIX}${page}`;
  if (!SIMPLE_VIEWS.includes(view)) return null;
  const tab = (params.get('tab') || '').trim();
  return { view, anchor: tab || null };
}

/** Write page/tab for a simple view into a URL object; clears them for any other view. */
export function writeSimpleLink(url, view, anchor) {
  if (!SIMPLE_VIEWS.includes(view)) {
    url.searchParams.delete('page');
    url.searchParams.delete('tab');
    return url;
  }
  url.searchParams.set('page', view.slice(PREFIX.length));
  const known = (SIMPLE_SUBTABS[view] || []).some((s) => s.id === anchor);
  if (anchor && known) url.searchParams.set('tab', anchor);
  else url.searchParams.delete('tab');
  return url;
}

/** A full link to a simple page and sub-tab under a base URL (for emails, decks and briefs). */
export function simpleLinkHref(base, view, anchor = null) {
  const url = new URL(base);
  url.searchParams.set('state', 'KY');
  url.searchParams.set('view', 'simple');
  return writeSimpleLink(url, view, anchor).toString();
}
