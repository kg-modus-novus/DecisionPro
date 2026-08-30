/**
 * Ask Sam suggestion chips — three insightful questions grounded in the
 * Accurate Landing + role-home tiles the user actually sees for their role.
 */
import { getHomeSmartTiles } from '../data/homeSmartTiles.js';
import { getRoleLandingTiles } from '../data/roleTileProfiles.js';

const FALLBACK_PROMPTS = [
  'Why is Kentucky Medicaid enrollment changing on the Accurate Landing tiles?',
  'Which dashboard Gap should we examine first before a hearing or brief?',
  'How should we read cost, quality, and access together without inventing missing data?',
];

function measureValue(tile) {
  if (!tile) return null;
  return tile.value || tile.measure?.displayValue || null;
}

function numericOf(tile) {
  const n = tile?.measure?.numericValue;
  return Number.isFinite(Number(n)) ? Number(n) : null;
}

function findTile(tiles, measureId) {
  return tiles.find((t) => (t.measureId || t.measure?.measureId) === measureId) || null;
}

function pushUnique(bucket, score, text) {
  const q = String(text || '').trim();
  if (!q || bucket.some((b) => b.text === q)) return;
  bucket.push({ score, text: q });
}

/**
 * @param {{ roleId?: string|null, view?: string|null }} [ctx]
 * @returns {string[]} exactly three prompts
 */
export function buildAskSamStarterPrompts(ctx = {}) {
  if (String(ctx.stateCode || '').toUpperCase() === 'FL') {
    return [
      'What Florida opportunity should I review first, and what evidence, owner, cost, timing, and benefit support it?',
      'Which Florida AHCA dashboard domains are hydrated, and which remain explicit gaps because export is disabled?',
      'How should I use the selected Florida Evidence Room without treating a public signal as a finding?',
    ];
  }
  const roleId = ctx.roleId || null;
  const landing = roleId ? getRoleLandingTiles(roleId) : [];
  const home = roleId ? getHomeSmartTiles(roleId) : [];
  const tiles = [...landing, ...home];
  const scored = [];

  const m001 = findTile(tiles, 'M-001');
  const m002 = findTile(tiles, 'M-002');
  const m003 = findTile(tiles, 'M-003');
  const m004 = findTile(tiles, 'M-004');
  const m007 = findTile(tiles, 'M-007');
  const m010 = findTile(tiles, 'M-010');
  const m011 = findTile(tiles, 'M-011');
  const m012 = findTile(tiles, 'M-012');
  const m014 = findTile(tiles, 'M-014');
  const m017 = findTile(tiles, 'M-017');
  const m021 = findTile(tiles, 'M-021');

  const yoy = numericOf(m002);
  const enrollVal = measureValue(m001);
  const yoyVal = measureValue(m002);

  if (m002 && yoy != null && yoy < 0) {
    pushUnique(
      scored,
      100,
      `Why is Medicaid enrollment down ${yoyVal} year over year on my dashboard?`,
    );
    pushUnique(
      scored,
      96,
      'How can we improve enrollment — what options should Kentucky examine first?',
    );
  } else if (m001 && enrollVal) {
    pushUnique(
      scored,
      92,
      `What is driving the current Kentucky enrollment level of ${enrollVal}?`,
    );
  }

  if (m012 && measureValue(m012)) {
    pushUnique(
      scored,
      88,
      `Why is postpartum / maternal care at ${measureValue(m012)}, and what should we examine before a hearing?`,
    );
  }

  if (m010 && measureValue(m010)) {
    pushUnique(
      scored,
      84,
      `How should we read child well-care (WCV-CH) at ${measureValue(m010)} against peer benchmarks?`,
    );
  }

  if (m011 && measureValue(m011)) {
    pushUnique(
      scored,
      82,
      `What does the breast-cancer screening rate of ${measureValue(m011)} imply for adult quality oversight?`,
    );
  }

  if (m017 && measureValue(m017)) {
    const spend = String(measureValue(m017)).startsWith('$')
      ? measureValue(m017)
      : `$${measureValue(m017)}M`;
    pushUnique(
      scored,
      90,
      `Why is pharmacy spend ${spend}, and what cost-driver questions belong in a budget brief?`,
    );
  }

  if (m004 && measureValue(m004)) {
    pushUnique(
      scored,
      80,
      `How does federal Kentucky expenditure of ${measureValue(m004)}M frame the fiscal story on Accurate Landing?`,
    );
  }

  if (m003 && measureValue(m003)) {
    pushUnique(
      scored,
      78,
      `What does ${measureValue(m003)} tell us about county membership pressure versus statewide enrollment?`,
    );
  }

  if (m007 && measureValue(m007)) {
    pushUnique(
      scored,
      86,
      `With ${measureValue(m007)} MCOs on the roster, what accountability questions should leadership ask first?`,
    );
  }

  if (m014) {
    pushUnique(
      scored,
      76,
      'What does the EQRO / evaluation signal on my tiles mean for MCO quality oversight?',
    );
  }

  if (m021 && measureValue(m021)) {
    pushUnique(
      scored,
      72,
      `How should we use the ACS uninsured context (${measureValue(m021)}) without treating it as Medicaid enrollment?`,
    );
  }

  for (const tile of home) {
    if (!tile?.gap?.gapId) continue;
    const title = tile.title || tile.gap.gapId;
    pushUnique(
      scored,
      85,
      `What does the “${title}” Gap mean for my role, and what authorized data would close it?`,
    );
  }

  const catalogue = landing.find((t) => /catalogue|source inventory/i.test(String(t.kind || t.title || '')));
  if (catalogue || roleId === 'data-steward' || roleId === 'oversight-auditor') {
    pushUnique(
      scored,
      74,
      'Which authoritative sources are loaded versus blocked or Gaps, and what should we verify next?',
    );
  }

  if (roleId === 'legislator' || roleId === 'legislative-staff') {
    pushUnique(
      scored,
      70,
      'How should I brief my district on enrollment, care gaps, and labeled Gaps without overstating the data?',
    );
  }
  if (roleId === 'budget-analyst') {
    pushUnique(
      scored,
      70,
      'Which cost and enrollment signals on my landing tiles should lead a fiscal examination pack?',
    );
  }
  if (roleId === 'medicaid-leadership') {
    pushUnique(
      scored,
      70,
      'Which statewide attention signals and MCO cues on my dashboard warrant an ops brief first?',
    );
  }
  if (roleId === 'policy-analyst') {
    pushUnique(
      scored,
      70,
      'How do the quality rates on my tiles line up with pharmacy and access trade-offs for policy options?',
    );
  }

  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, 3).map((s) => s.text);

  for (const fallback of FALLBACK_PROMPTS) {
    if (picked.length >= 3) break;
    if (!picked.includes(fallback)) picked.push(fallback);
  }

  return picked.slice(0, 3);
}

export { FALLBACK_PROMPTS };
