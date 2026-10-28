// CodeXen: v1 not-applicable
// How old each simple-mode figure is: the date its data runs through, read
// from the measure's reporting period, and its age today. Presentation only:
// it reads period labels and formats a badge; no business rules live here.
// Subcommittee 2026-10-28 (plan item #3): every tile shows its data age, so
// "latest published" is never read as "current".

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_INDEX = Object.fromEntries(MONTHS.map((m, i) => [m.toLowerCase(), i]));

const endOfMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0));
const endOfYear = (y) => new Date(Date.UTC(y, 11, 31));

/**
 * The last date a reporting period covers, or null when the label names a
 * release rather than a data period (e.g. "Care Compare Aug 2026 release").
 * Core Set periods run through their measurement year ("FFY 2025 · MY 2024").
 */
export function periodEnd(raw) {
  const full = String(raw || '');
  if (!full) return null;
  // A parenthetical is context ("Nov-Dec 2024 (FY 2025)"); read it only when nothing else dates the period.
  const main = full.replace(/\([^)]*\)/g, ' ').trim();
  return (main && main !== full ? endOf(main) : null) || endOf(full);
}

function endOf(text) {
  const ends = [];
  const add = (d) => { if (d && !Number.isNaN(d.getTime())) ends.push(d); };

  const my = [...text.matchAll(/\bMY\s*(\d{4})\b/gi)];
  if (my.length) return endOfYear(Math.max(...my.map((m) => Number(m[1]))));
  const coreSet = text.match(/\bCore Set\s*(\d{4})\b/i);
  if (coreSet) return endOfYear(Number(coreSet[1]) - 1);
  if (/\brelease\b/i.test(text) && !/\b(?:SFY|FFY|FY|CY)\s*\d{4}/i.test(text)) return null;

  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) add(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
  for (const m of text.matchAll(/\b(\d{4})-(0[1-9]|1[0-2])\b(?!-\d)/g)) add(endOfMonth(+m[1], +m[2] - 1));
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) add(new Date(Date.UTC(+m[3], +m[1] - 1, +m[2])));
  for (const m of text.matchAll(/\bSFY\s*(\d{4})(?:\s*-\s*(\d{2,4}))?/gi)) {
    const last = m[2] ? (m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])) : Number(m[1]);
    add(new Date(Date.UTC(last, 5, 30)));
  }
  for (const m of text.matchAll(/\bFFY\s*(\d{4})/gi)) add(new Date(Date.UTC(+m[1], 8, 30)));
  // A bare "FY" in Kentucky documents is the state fiscal year.
  for (const m of text.matchAll(/(?<![SF])\bFY\s*(\d{4})/g)) add(new Date(Date.UTC(+m[1], 5, 30)));
  for (const m of text.matchAll(/\bCY\s*(\d{4})/gi)) add(endOfYear(+m[1]));
  for (const m of text.matchAll(/\bQ([1-4])\s*(\d{4})/gi)) add(endOfMonth(+m[2], Number(m[1]) * 3 - 1));
  for (const m of text.matchAll(/\b([A-Z][a-z]{2})(?:-[A-Z][a-z]{2})?\s+(\d{4})\b/g)) {
    const range = m[0].match(/-([A-Z][a-z]{2})/);
    const month = MONTH_INDEX[(range ? range[1] : m[1]).toLowerCase()];
    if (month != null) add(endOfMonth(+m[2], month));
  }
  if (!ends.length) {
    const years = [...text.matchAll(/\b(19|20)(\d{2})\b/g)].map((m) => Number(m[1] + m[2]));
    if (years.length) add(endOfYear(Math.max(...years)));
  }
  if (!ends.length) return null;
  return new Date(Math.max(...ends.map((d) => d.getTime())));
}

function parseDate(text) {
  const m = String(text || '').match(/\b(\d{4})-(\d{2})(?:-(\d{2}))?\b/);
  if (!m) return null;
  return m[3] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : endOfMonth(+m[1], +m[2] - 1);
}

/** Whole months from `from` to `to` (never negative). */
export function monthsBetween(from, to) {
  const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  return Math.max(0, to.getUTCDate() < from.getUTCDate() ? months - 1 : months);
}

export function ageText(months) {
  if (months < 1) return 'under a month old';
  if (months < 24) return `${months} mo old`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} yr ${rest} mo old` : `${years} yr old`;
}

const monthLabel = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/** Fresh: within a year of today; aging: one to two years; old: more than two. */
export function freshnessTone(months) {
  if (months <= 12) return 'fresh';
  if (months <= 24) return 'aging';
  return 'old';
}

/**
 * Data age of a measure. Uses the data period when it can be read, otherwise
 * the publication date (`basis: 'published'`). Returns null when neither is known.
 */
/** Core Set results are labeled by reporting year; the care they measure is the year before. */
function isCoreSetMeasure(measure) {
  return /^(cs|coreset|est)-/.test(String(measure?.id || '')) || Boolean(measure?.coreSetAbbr);
}

export function dataAge(measure, now = new Date()) {
  const raw = String(measure?.periodLabel || measure?.rawPeriod || measure?.period || '');
  const end = periodEnd(isCoreSetMeasure(measure) && !/\bMY\b/.test(raw) ? raw.replace(/\bFFY\s*(\d{4})/i, 'Core Set $1') : raw);
  // Budgets and contract terms run into the future; date those by publication.
  const through = end && end <= now ? end : null;
  const published = parseDate(measure?.asOfRaw ?? measure?.asOf);
  const date = through || published;
  if (!date) return null;
  const months = monthsBetween(date, now);
  const basis = through ? 'through' : 'published';
  return {
    date,
    basis,
    months,
    tone: freshnessTone(months),
    label: `${basis === 'through' ? 'Data through' : 'Published'} ${monthLabel(date)} · ${ageText(months)}`,
    short: `${monthLabel(date)} · ${ageText(months)}`,
  };
}

/** Oldest and newest data on a page, for the page-level freshness line. */
export function freshnessRange(measures, now = new Date()) {
  const ages = measures.map((m) => dataAge(m, now)).filter(Boolean);
  if (!ages.length) return null;
  const sorted = [...ages].sort((a, b) => a.date - b.date);
  return { oldest: sorted[0], newest: sorted[sorted.length - 1], count: ages.length };
}

/** Why public data lags, shown beside the page freshness line. */
export const DATA_LAG_NOTE = 'Public data always trails the present. Claims take three to six months to be paid and settled before they can be counted, federal reports are released a year or more after the period they cover, and annual surveys are published the following year. Each figure here is the latest the publisher has released, and the badge shows how far behind today it is. Unpublished, more recent state data can be added under a data use agreement.';
