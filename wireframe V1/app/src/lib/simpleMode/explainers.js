// CodeXen: v1 not-applicable
// Explainer videos for the functions added after the 2026-10-28 subcommittee
// meeting: which video belongs to which tab or sub-tab, and the per-browser
// record of which prompts the viewer has dismissed. Presentation only; the
// record is a viewer convenience in browser storage, never business data.
import { SIMPLE_SUBTABS, SIMPLE_TABS } from './simpleAreas.js';

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
  // 2026-11-13: every page that had no video gets one (simple tabs, expert workspace, Potential Fraud Detection).
  ...[
    ['access-overview', 'simple-access', 'overview', 'Can Medicaid members get care?'],
    ['spending-overview', 'simple-spending', 'overview', 'Where is Medicaid money going?'],
    ['outcomes-overview', 'simple-outcomes', 'overview', 'Is members’ health improving?'],
    ['plans-overview', 'simple-plans', 'overview', 'Who is responsible: the health plans'],
    ['waivers', 'simple-waivers', null, 'Waiver waitlists'],
    ['long-term-care', 'simple-ltc', null, 'Long-term care'],
    ['behavioral-health', 'simple-bh', null, 'Behavioral health'],
    ['who-is-covered', 'simple-coverage', null, 'Who is covered'],
    ['county-map', 'simple-county', 'counties', 'Medicaid in my county: the county map'],
    ['my-district', 'simple-district', null, 'My district'],
    ['legislator-home', 'sme:role-home', null, 'Your role home'],
    ['operational', 'sme:operational', null, 'Operational intelligence'],
    ['sources', 'sme:sources', null, 'Authoritative sources'],
    ['evidence-rooms', 'sme:evidence', null, 'Evidence rooms'],
    ['blender', 'sme:blender', null, 'Consideration Blender'],
    ['option-pack', 'sme:pack', null, 'Option pack'],
    ['consideration-brief', 'sme:brief', null, 'Consideration brief'],
    ['legislation', 'sme:legislation', null, 'Legislative analysis'],
    ['law-object', 'sme:law-object', null, 'Law and policy record'],
    ['fraud-radar', 'fraud:radar', null, 'Potential Fraud Detection: National radar'],
    ['fraud-blowups', 'fraud:blowups', null, 'Potential Fraud Detection: Program blow-ups'],
    ['fraud-cases', 'fraud:cases', null, 'Potential Fraud Detection: Case files'],
    ['fraud-realloc', 'fraud:realloc', null, 'Potential Fraud Detection: Reallocation what-if'],
    ['fraud-tools', 'fraud:tools', null, 'Potential Fraud Detection: Tools & data coverage'],
    ['fraud-backtest', 'fraud:backtest', null, 'Potential Fraud Detection: Backtests & known cases'],
    ['fraud-early', 'fraud:early', null, 'Potential Fraud Detection: Early warning'],
    ['fraud-follow', 'fraud:follow', null, 'Potential Fraud Detection: Follow the billers'],
    ['fraud-patterns', 'fraud:patterns', null, 'Potential Fraud Detection: Provider patterns'],
    ['fraud-ledger', 'fraud:ledger', null, 'Potential Fraud Detection: Explanation ledger'],
    ['fraud-brief', 'fraud:brief', null, 'Potential Fraud Detection: State oversight brief'],
  ].map(([id, view, subtab, title]) => ({ id, view, subtab, title, videos: [{ id, label: title, src: video(id) }] })),
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

/**
 * The landing pop-up for a simple page (2026-11-13): its explainer when it has
 * one, otherwise a walkthrough-only entry named after the tab and sub-tab.
 */
export function pageGuideFor(view, anchor) {
  const found = explainerFor(view, anchor);
  if (found) return found;
  const tab = SIMPLE_TABS.find((t) => t.view === view);
  if (!tab) return null;
  const subtab = effectiveSubtab(view, anchor);
  const sub = (SIMPLE_SUBTABS[view] || []).find((s) => s.id === subtab);
  return {
    id: `page-${view}${subtab ? `-${subtab}` : ''}`,
    view,
    subtab,
    title: sub && sub.id !== 'overview' ? `${tab.label}: ${sub.label}` : tab.label,
    videos: [],
  };
}

/** The pop-up for an expert workspace page or a Potential Fraud Detection page; key is "sme:<view>" or "fraud:<page>". */
export function workspaceGuideFor(key, title) {
  return EXPLAINERS.find((e) => e.view === key) || { id: `page-${key.replace(':', '-')}`, view: key, subtab: null, title, videos: [] };
}

const DISMISSED_KEY = 'decisionpro.explainers.dismissed';
const SEEN_KEY = 'decisionpro.explainers.seenThisSession';
const OFF_KEY = 'decisionpro.explainers.off';
const ALL_OFF_KEY = 'decisionpro.explainers.allPagesOff';

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
    if (localStorage.getItem(ALL_OFF_KEY) === '1') return false;
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

/** "Don't show again" with "on every page" ticked: no landing pop-up anywhere in this browser. */
export function turnOffPageGuides() {
  try {
    localStorage.setItem(ALL_OFF_KEY, '1');
  } catch {
    // Storage unavailable: each page's own dismissal still applies this session.
  }
}
