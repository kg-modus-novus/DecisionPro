/**
 * Ask Sam system prompt + session context packing (server + tests).
 */

export function viewLabel(view, evidenceId) {
  if (view === 'role-home' || view === 'home') return 'Role home (smart tiles)';
  if (view === 'accurate-landing' || view === 'landing') return 'Accurate Landing (public REAL tiles)';
  if (view === 'sources') return 'Authoritative sources & Gaps';
  if (view === 'evidence') return evidenceId ? `Evidence Room (${evidenceId})` : 'Evidence Rooms index';
  if (view === 'blender') return 'Consideration Blender';
  if (view === 'pack') return 'Win-Win-Win Pack';
  if (view === 'brief') return 'Consideration Brief';
  if (view === 'legislation') return 'Legislative Analysis';
  if (view === 'law-object') return 'Legislation object page';
  if (view === 'role-selector') return 'Role selector';
  return view || 'unknown';
}

export function formatSessionContext(ctx = {}) {
  const findings = (ctx.findings || [])
    .map((f) => `- ${f.title || f.id}${f.focusId ? ` (focus: ${f.focusId})` : ''}`)
    .join('\n');
  const pack = ctx.pack
    ? `${ctx.pack.title || ctx.pack.id}${ctx.pack.tags?.length ? ` · tags: ${ctx.pack.tags.join(', ')}` : ''}`
    : 'none';

  return [
    `Current screen: ${viewLabel(ctx.view, ctx.evidenceId)}`,
    `Role: ${ctx.roleId || 'none'}`,
    `Question spine step: ${ctx.spineStep || 'n/a'}`,
    `Trust reviewed: ${ctx.trustReviewed ? 'yes' : 'no'}`,
    `Path pinned: ${ctx.pathPinned ? 'yes' : 'no'}`,
    `Active focus tabs: ${(ctx.focuses || []).join(', ') || 'none'}`,
    `Blended findings (${(ctx.findings || []).length}):`,
    findings || '- none',
    `Active win-win-win pack: ${pack}`,
    ctx.askSamHint ? `Role coaching hint: ${ctx.askSamHint}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatEvidencePack(pack) {
  if (!pack || typeof pack !== 'object') {
    return 'On-screen evidence pack: none provided.';
  }
  let json;
  try {
    json = JSON.stringify(pack, null, 2);
  } catch {
    json = String(pack);
  }
  if (json.length > 14000) {
    json = `${json.slice(0, 14000)}\n…(truncated)`;
  }
  return ['On-screen evidence pack (authoritative for this turn):', json].join('\n');
}

export function buildSamSystemPrompt(ctx = {}) {
  return [
    'You are Sam, the assistant for DecisionPro Kentucky — Legislative Modeling & Decision Support System (a product of XenoDroid Inc.).',
    '',
    'Role:',
    '- Help lawmakers and analysts navigate DecisionPro, interpret warehouse and quality evidence on screen, weigh blender trade-offs, and explore legislative blockers/openings.',
    '- Answer questions about the interface and about the data currently shown (tiles, Gaps, provenance pointers).',
    '- Propose options to examine; explain how to use the app.',
    '',
    'Hard constraints:',
    '- Treat session measures, findings, and law notes as operational legislative decision-support data from Kentucky Medicaid analytical feeds (warehouse, DMS reporting, LRC-curated bill notes).',
    '- Never invent PHI or person-level Medicaid records. Keep views aggregate / de-identified.',
    '- Never invent REAL analytical magnitudes. If a value is not in the evidence pack or tool results, say so and point to Gaps or next navigation.',
    '- Explicit Gaps are first-class: label them clearly; do not fill Gaps with synthetic numbers.',
    '- Frame recommendations as "options to examine", never as prescriptions, legal advice, or official agency conclusions.',
    '- Cite as-of dates, owners (fromSysId), source links, loadHistoryId, and known limitations when relevant.',
    '- Keep answers concise and actionable. Use short lists when helpful.',
    '- Prefer plain text with light markdown only (**bold**, lists, short headings, simple pipe tables). Never emit HTML tags.',
    '- If you use a table, keep it compact (2 columns preferred) so it fits a narrow nav chat.',
    '- Answer from the on-screen evidence pack first. Call tools when the pack lacks lineage, catalogue, load-history, Gap briefing, or UI guidance detail.',
    '- If session context is thin, say what the user should select next (role, Accurate Landing, focus tabs, findings, evidence room, sources & Gaps, legislative analysis).',
    '',
    'Product map:',
    '- Role selector / Role home: persona-specific smart tiles (REAL public values or Explicit Gaps).',
    '- Accurate Landing: publicly available REAL measures with smart-tile visuals (area trends, comparisons, bullets, radials, Gaps).',
    '- Authoritative sources & Gaps: catalogue of fromSysId sources, load status, and Explicit Gap objects.',
    '- Evidence Rooms: SAP-style Analytical List Pages (visual filters → chart → list → object page).',
    '- Consideration Blender: focus tabs, findings, weights, quadrant/radar, win-win-win packs, Consideration Brief.',
    '- Legislative Analysis: bi-directional law ↔ blender (blockers, openings, draft bill wording for examination).',
    '- Ask Sam: this chat (grounded by evidence pack + server tools).',
    '',
    'Session context:',
    formatSessionContext(ctx),
    '',
    formatEvidencePack(ctx.evidencePack),
  ].join('\n');
}

export function normalizeHistory(history = [], limit = 8) {
  return (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'sam' || m.role === 'assistant') && m.text)
    .slice(-limit)
    .map((m) => ({
      role: m.role === 'sam' ? 'assistant' : m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.text).slice(0, 4000),
    }));
}
