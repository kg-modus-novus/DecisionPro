// Builds the public simple-mode data module from the researched source files.
//
//   node scripts/build-simple-sourced.mjs
//
// Reads  src/lib/simpleMode/sourced/*.json   (research output, schema in RESEARCH_BRIEF.md)
// Writes src/lib/simpleMode/sourcedDisplay.generated.js  (display fields only; do not hand-edit)
//        ../../docs/planning/simple-mode-data-load-backlog.md (internal: what BW must load)
//
// Internal fields (loadNote, unresolved, notes, research inputs' raw detail) never
// reach the public bundle; they go to the backlog document instead.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const sourcedDir = join(appRoot, 'src/lib/simpleMode/sourced');
const outModule = join(appRoot, 'src/lib/simpleMode/sourcedDisplay.generated.js');
const outBacklog = resolve(appRoot, '../../docs/planning/simple-mode-data-load-backlog.md');

const DISPLAY_FIELDS = [
  'id', 'label', 'value', 'unit', 'period', 'asOf', 'dimension', 'rows', 'series', 'comparison',
  'target', 'betterDirection', 'responsible', 'method', 'methodNote', 'proxyFor', 'source', 'caveat',
];

function displayInputs(inputs = []) {
  return inputs.map((i) => ({ label: i.label, value: i.value, source: i.source ? pickSource(i.source) : undefined }));
}

// Citations name the public publisher and document; repository paths never ship.
function cleanCitation(text) {
  return text == null ? text : String(text)
    .replace(/\s*\((?:via )?BW export[^)]*\)/gi, '')
    .replace(/,?\s*as loaded in [\w./-]+\.js/gi, '')
    .trim();
}

function pickSource(s) {
  const url = /^https?:\/\//.test(s.url || '') ? s.url : undefined;
  return { title: cleanCitation(s.title), publisher: cleanCitation(s.publisher), url, page: s.page };
}

// Research measures kept out of the public page, with the reason (recorded in the backlog).
const EXCLUDED = {
  'clean-claims-30day-estimate': 'Placeholder equal to the contract floor, not a modeled estimate; the contract standard (clean-claims-30day-standard) is shown instead.',
  'ltc-eligibility-decision-days-est': 'Adds an assumed 7.5-day level-of-care step with no source; the published DCBS figure (ltc-eligibility-decision-days) is shown instead.',
  'nf-medicaid-spend-est': 'Rough estimate superseded by the CMS-64 nursing facility figure in spending.json (nursing-facility-ffs-spending).',
  'nf-weekend-hprd': 'Value not found in the cited Care Compare state-averages file (independent review 2026-10-01); re-source before showing.',
};

// Public labels that replace research wording.
const LABEL_OVERRIDES = {
  'waiver-sept2025-baseline': 'Waiver slots and waitlist, September 2025',
  'bh-appt-routine-within-30-days': 'Behavioral health centers reached by secret shoppers that offered a routine appointment within 30 days',
};

// Series whose points use different definitions are shown as the latest point only.
const DROP_SERIES = {
  'pa-standard-denied-pct': 'SFY 2023 figure counts partial approvals as denials (UM-01); CY 2025 plan postings do not.',
};

// Core Set measures Kentucky moved to claims-only reporting in FFY 2024 (outcomes.json notes).
const METHOD_BREAK_PREFIXES = ['cs-cis', 'cs-ima', 'cs-ccs', 'cs-ppc', 'cs-cbp', 'cs-hbd'];
const METHOD_BREAK = {
  period: 'FFY 2024',
  caveat: 'Kentucky began reporting this measure from claims alone in federal fiscal year 2024, so years before and after are not directly comparable.',
};

// Research notes are written for the builder; the public page shows only sentences
// that describe the method, never research process or repository detail.
const INTERNAL_SENTENCE = /this session|reviewData|hand-entered|entered by hand|\bBW\b|\brepo\b|wireframe V1|\.js\b|placeholder|checked against|LOW CONFIDENCE|illustrative only/i;

function publicNote(text) {
  if (!text) return undefined;
  const kept = String(text).split(/(?<=[.;])\s+/).filter((s) => !INTERNAL_SENTENCE.test(s));
  return kept.length ? kept.join(' ') : undefined;
}

const files = readdirSync(sourcedDir).filter((f) => f.endsWith('.json')).sort();
const areas = {};
const backlog = [];
for (const file of files) {
  const data = JSON.parse(readFileSync(join(sourcedDir, file), 'utf8'));
  const area = data.area || file.replace(/\.json$/, '');
  areas[area] = {
    researchedAt: data.researchedAt,
    measures: data.measures.filter((m) => !EXCLUDED[m.id]).map((m) => {
      const out = {};
      for (const key of DISPLAY_FIELDS) if (m[key] !== undefined && m[key] !== null) out[key] = m[key];
      if (out.source) out.source = pickSource(out.source);
      if (m.inputs?.length) out.inputs = displayInputs(m.inputs);
      if (LABEL_OVERRIDES[m.id]) out.label = LABEL_OVERRIDES[m.id];
      if (DROP_SERIES[m.id]) delete out.series;
      // Method notes are shown only for derived figures and estimates.
      if (m.method === 'published') delete out.methodNote;
      else if (out.methodNote) {
        const note = publicNote(out.methodNote);
        if (note) out.methodNote = note;
        else delete out.methodNote;
      }
      if (out.caveat) out.caveat = publicNote(out.caveat);
      if (METHOD_BREAK_PREFIXES.some((p) => m.id.startsWith(p)) && m.series?.length) {
        out.methodBreak = METHOD_BREAK.period;
        out.caveat = METHOD_BREAK.caveat;
      }
      return out;
    }),
  };
  backlog.push({ area, file, data });
}

writeFileSync(
  outModule,
  `// GENERATED by scripts/build-simple-sourced.mjs from src/lib/simpleMode/sourced/*.json. Do not hand-edit.\n`
  + `export const SOURCED_DISPLAY = ${JSON.stringify(areas)};\n`,
);

const lines = [
  '# Simple mode — data-load backlog (internal)',
  '',
  'Generated by `wireframe V1/app/scripts/build-simple-sourced.mjs`. Do not hand-edit; edit the',
  'research files in `wireframe V1/app/src/lib/simpleMode/sourced/` and regenerate.',
  '',
  'Director decision 2026-10-01: simple mode shows these researched figures before they pass',
  'through the XenoDroid BW warehouse, with no "entered by hand" labels. Every figure below must',
  'eventually be loaded through BW with its own reconciliation check; each `loadNote` says how.',
  'Estimates (method `estimate`) are modeled and show an Estimate label on the page.',
  '',
];
for (const { area, file, data } of backlog) {
  lines.push(`## ${area} (\`sourced/${file}\`, researched ${data.researchedAt || 'n/a'})`, '');
  lines.push('| Measure | Method | Period | Source | What BW must load |', '|---|---|---|---|---|');
  for (const m of data.measures) {
    const src = m.source?.url ? `[${(m.source.publisher || m.source.title || 'source').replace(/\|/g, '/')}](${m.source.url})` : 'see inputs';
    const note = String(m.loadNote || '').replace(/\|/g, '/').replace(/\s+/g, ' ');
    const excluded = EXCLUDED[m.id] ? ` **Not shown:** ${EXCLUDED[m.id]}` : '';
    lines.push(`| \`${m.id}\` ${m.label.replace(/\|/g, '/')}${excluded} | ${m.method} | ${m.period || ''} | ${src} | ${note} |`);
  }
  lines.push('');
  if (data.unresolved?.length) {
    lines.push('**Unresolved during research**', '');
    for (const u of data.unresolved) lines.push(`- ${u.need}${u.tried?.length ? ` — tried: ${u.tried.join('; ')}` : ''}`);
    lines.push('');
  }
  if (data.notes) lines.push('**Research notes**', '', String(data.notes), '');
}
writeFileSync(outBacklog, `${lines.join('\n')}\n`);
console.log(`Wrote ${Object.values(areas).reduce((n, a) => n + a.measures.length, 0)} measures from ${files.length} files.`);
