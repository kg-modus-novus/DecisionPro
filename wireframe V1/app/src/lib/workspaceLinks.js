// CodeXen: v1 not-applicable
// Shareable links to any page of the expert workspace (?view=sme), the
// counterpart of lib/simpleMode/simpleLinks.js for simple mode. The address
// always holds the page on screen, so it can be copied from the browser and
// opened by someone else (after the demo sign-in) on the same page:
//
//   ?state=KY&view=sme&role=legislator&go=fraud&fraud=early&fstate=KY&fid=KY%7CH2027%7C2024
//
//   role    the role the workspace is seen as (roleProfiles.js); a link without
//           one opens as a legislator
//   go      the workspace view (role-home, evidence, fraud, legislation, ...)
//   room    the evidence room (with go=evidence)
//   object  the evidence object open in that room
//   law     the law object (with go=law-object)
//   pack    the briefing pack (with go=pack or brief)
//   fraud   the Potential Fraud Detection page (radar, early, brief, ...)
//   fstate  the state that module focuses on
//   fid     the service-year that module focuses on (state|code|year)

export const WORKSPACE_VIEWS = Object.freeze([
  'role-home', 'blender', 'pack', 'brief', 'evidence', 'sources', 'operational', 'fraud', 'legislation', 'law-object',
]);
export const DEFAULT_LINK_ROLE = 'legislator';

const WORKSPACE_KEYS = Object.freeze(['role', 'go', 'room', 'object', 'law', 'pack']);
const FRAUD_KEYS = Object.freeze(['fraud', 'fstate', 'fid']);
const clean = (v) => {
  const s = (v ?? '').trim();
  return s === '' ? null : s;
};

/**
 * The workspace page a URL asks for, or null when it names none. `roles` is the
 * list of known role ids; an unknown role or view makes the link name nothing,
 * so a bad link opens the role selector as before.
 */
export function readWorkspaceLink(search, roles) {
  const params = new URLSearchParams(search);
  if (params.get('view') !== 'sme') return null;
  const go = clean(params.get('go'));
  const role = clean(params.get('role'));
  if (!go && !role) return null;
  if (go && !WORKSPACE_VIEWS.includes(go)) return null;
  if (role && !roles.includes(role)) return null;
  return {
    role: role ?? DEFAULT_LINK_ROLE,
    view: go ?? null,
    room: clean(params.get('room')),
    object: clean(params.get('object')),
    law: clean(params.get('law')),
    pack: clean(params.get('pack')),
  };
}

/**
 * Write the workspace page on screen into a URL object; clears the workspace
 * keys when `page` is null (simple mode, the selectors) and the module keys
 * whenever the page is not Potential Fraud Detection.
 */
export function writeWorkspaceLink(url, page) {
  for (const k of WORKSPACE_KEYS) url.searchParams.delete(k);
  if (!page || !page.role || !WORKSPACE_VIEWS.includes(page.view)) {
    for (const k of FRAUD_KEYS) url.searchParams.delete(k);
    return url;
  }
  url.searchParams.set('role', page.role);
  url.searchParams.set('go', page.view);
  if (page.view === 'evidence' && page.room) url.searchParams.set('room', page.room);
  if (page.view === 'evidence' && page.room && page.object) url.searchParams.set('object', page.object);
  if (page.view === 'law-object' && page.law) url.searchParams.set('law', page.law);
  if ((page.view === 'pack' || page.view === 'brief') && page.pack) url.searchParams.set('pack', page.pack);
  if (page.view !== 'fraud') for (const k of FRAUD_KEYS) url.searchParams.delete(k);
  return url;
}

/** The Potential Fraud Detection page, state and service-year a URL asks for; unknown pages are ignored. */
export function readFraudLink(search, pageIds) {
  const params = new URLSearchParams(search);
  const page = clean(params.get('fraud'));
  return {
    page: page && pageIds.includes(page) ? page : null,
    state: clean(params.get('fstate'))?.toUpperCase() ?? null,
    focusId: clean(params.get('fid')),
  };
}

/** Write the module's page, state and service-year into a URL object. */
export function writeFraudLink(url, { page, state, focusId }) {
  url.searchParams.set('fraud', page);
  if (state) url.searchParams.set('fstate', state);
  else url.searchParams.delete('fstate');
  if (focusId) url.searchParams.set('fid', focusId);
  else url.searchParams.delete('fid');
  return url;
}

/** Replace the address bar's query with the URL object's, keeping history entries as they are. */
export function replaceAddress(url) {
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  window.history.replaceState(window.history.state, '', next);
}
