// CodeXen: v1 not-applicable
// Explainer videos for the functions added after the 2026-10-28 subcommittee
// meeting: which video belongs to which tab or sub-tab, and the per-browser
// record of which prompts the viewer has dismissed. Presentation only; the
// record is a viewer convenience in browser storage, never business data.
import { SIMPLE_SUBTABS } from './simpleAreas.js';

const video = (id) => `explainers/decisionpro-${id}.mp4`;

/** One entry per pop-up: where it appears and the video or videos it offers. */
export const EXPLAINERS = [
  { id: 'compare-states', view: 'simple-states', subtab: null, title: 'Compare Kentucky with every state', videos: [{ id: 'compare-states', label: 'Compare states', src: video('compare-states') }] },
  { id: 'zip-codes', view: 'simple-county', subtab: 'zips', title: 'Build an area from zip codes', videos: [{ id: 'zip-codes', label: 'Zip codes', src: video('zip-codes') }] },
  { id: 'in-your-area', view: 'simple-outcomes', subtab: 'local', title: 'Health measures for your area', videos: [{ id: 'in-your-area', label: 'In your area', src: video('in-your-area') }] },
  { id: 'rural-kentucky', view: 'simple-access', subtab: 'rural', title: 'Rural Kentucky', videos: [{ id: 'rural-kentucky', label: 'Rural Kentucky', src: video('rural-kentucky') }] },
  { id: 'payment-scenario', view: 'simple-access', subtab: 'scenario', title: 'Explore a payment scenario', videos: [{ id: 'payment-scenario', label: 'Payment scenario', src: video('payment-scenario') }] },
  { id: 'social-vulnerability', view: 'simple-access', subtab: 'vulnerability', title: 'Access and social vulnerability', videos: [{ id: 'social-vulnerability', label: 'Social vulnerability', src: video('social-vulnerability') }] },
  { id: 'why-spending-rose', view: 'simple-spending', subtab: 'drivers-breakdown', title: 'Why spending rose', videos: [{ id: 'why-spending-rose', label: 'Why spending rose', src: video('why-spending-rose') }] },
  { id: 'contract-ledger', view: 'simple-plans', subtab: 'contract-ledger', title: 'The contract ledger', videos: [{ id: 'contract-ledger', label: 'Contract ledger', src: video('contract-ledger') }] },
  { id: 'hospitals-doing', view: 'simple-hospitals', subtab: 'margins', title: 'How hospitals are doing', videos: [{ id: 'hospitals-doing', label: 'How hospitals are doing', src: video('hospitals-doing') }] },
  { id: 'hospitals-prices', view: 'simple-hospitals', subtab: 'prices', title: 'Commercial hospital prices', videos: [{ id: 'hospitals-prices', label: 'Commercial prices', src: video('hospitals-prices') }] },
  { id: 'hospitals-medicaid', view: 'simple-hospitals', subtab: 'medicaid', title: 'What Medicaid pays hospitals', videos: [{ id: 'hospitals-medicaid', label: 'What Medicaid pays', src: video('hospitals-medicaid') }] },
  { id: 'hospitals-list', view: 'simple-hospitals', subtab: 'list', title: 'Look up a hospital', videos: [{ id: 'hospitals-list', label: 'Hospital by hospital', src: video('hospitals-list') }] },
  { id: 'hospitals-benefit', view: 'simple-hospitals', subtab: 'benefit', title: 'Community benefit', videos: [{ id: 'hospitals-benefit', label: 'Community benefit', src: video('hospitals-benefit') }] },
  { id: 'medicare-by-state', view: 'simple-rates', subtab: 'medicare', title: 'Medicare physician fees by state', videos: [{ id: 'medicare-by-state', label: 'Medicare by state', src: video('medicare-by-state') }] },
  { id: 'medicaid-vs-medicare', view: 'simple-rates', subtab: 'medicaid', title: 'Medicaid fees against Medicare', videos: [{ id: 'medicaid-vs-medicare', label: 'Medicaid vs Medicare', src: video('medicaid-vs-medicare') }] },
  { id: 'rate-spreads', view: 'simple-rates', subtab: 'spread', title: 'How far rates spread', videos: [{ id: 'rate-spreads', label: 'Rate spreads', src: video('rate-spreads') }] },
  { id: 'deprivation-payments', view: 'simple-rates', subtab: 'deprivation', title: 'Deprivation and what Medicaid pays', videos: [{ id: 'deprivation-payments', label: 'Deprivation and payments', src: video('deprivation-payments') }] },
  { id: 'procedure-codes', view: 'simple-rates', subtab: 'codes', title: 'Procedure codes across states', videos: [{ id: 'procedure-codes', label: 'Procedure codes', src: video('procedure-codes') }] },
  {
    id: 'every-card', view: 'simple-home', subtab: null, title: 'New on every card',
    videos: [
      { id: 'data-age', label: 'How current is each number?', src: video('data-age') },
      { id: 'how-measured', label: 'How each number is measured', src: video('how-measured') },
      { id: 'my-target', label: 'Set your own target', src: video('my-target') },
    ],
  },
];

/** The sub-tab a view is showing: the anchor if it names one of the view's sub-tabs, otherwise its first. */
export function effectiveSubtab(view, anchor) {
  const subs = SIMPLE_SUBTABS[view];
  if (!subs) return null;
  return subs.some((s) => s.id === anchor) ? anchor : subs[0].id;
}

export function explainerFor(view, anchor) {
  const subtab = effectiveSubtab(view, anchor);
  return EXPLAINERS.find((e) => e.view === view && e.subtab === subtab) || null;
}

const DISMISSED_KEY = 'decisionpro.explainers.dismissed';
const SEEN_KEY = 'decisionpro.explainers.seenThisSession';
const OFF_KEY = 'decisionpro.explainers.off';

function readList(storage, key) {
  try {
    const list = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeList(storage, key, list) {
  try {
    storage.setItem(key, JSON.stringify(list));
  } catch {
    // Storage unavailable (private windows): the prompt may appear again; nothing else depends on it.
  }
}

/** Whether to offer this explainer now: not turned off, not dismissed for good, not already offered this session. */
export function shouldOfferExplainer(id) {
  try {
    if (sessionStorage.getItem(OFF_KEY) === '1') return false;
  } catch {
    // ignore
  }
  return !readList(localStorage, DISMISSED_KEY).includes(id) && !readList(sessionStorage, SEEN_KEY).includes(id);
}

/** Offered once per session; "Not now" lets it return in a later session. */
export function markExplainerOffered(id) {
  const seen = readList(sessionStorage, SEEN_KEY);
  if (!seen.includes(id)) writeList(sessionStorage, SEEN_KEY, [...seen, id]);
}

/** "Don't show again", or watched: never offered again in this browser. */
export function dismissExplainerForGood(id) {
  const dismissed = readList(localStorage, DISMISSED_KEY);
  if (!dismissed.includes(id)) writeList(localStorage, DISMISSED_KEY, [...dismissed, id]);
}
