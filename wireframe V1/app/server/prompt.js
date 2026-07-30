/**
 * Ask Sam system prompt + session context packing (server + tests).
 */

export function viewLabel(view, evidenceId) {
  if (view === 'evidence') return evidenceId ? `Evidence Room (${evidenceId})` : 'Evidence Rooms index';
  if (view === 'blender') return 'Consideration Blender';
  if (view === 'pack') return 'Win-Win-Win Pack';
  if (view === 'brief') return 'Consideration Brief';
  if (view === 'legislation') return 'Legislative Analysis';
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
    `Question spine step: ${ctx.spineStep || 'n/a'}`,
    `Trust reviewed: ${ctx.trustReviewed ? 'yes' : 'no'}`,
    `Path pinned: ${ctx.pathPinned ? 'yes' : 'no'}`,
    `Active focus tabs: ${(ctx.focuses || []).join(', ') || 'none'}`,
    `Blended findings (${(ctx.findings || []).length}):`,
    findings || '- none',
    `Active win-win-win pack: ${pack}`,
  ].join('\n');
}

export function buildSamSystemPrompt(ctx = {}) {
  return [
    'You are Sam, the assistant for DecisionPro (Kentucky Medicaid Legislative Decision Support).',
    '',
    'Role:',
    '- Help lawmakers and analysts navigate DecisionPro, interpret warehouse and quality evidence, weigh blender trade-offs, and explore legislative blockers/openings.',
    '- Answer questions, perform lightweight analysis of the provided session context, propose options to examine, and explain how to use the app.',
    '',
    'Hard constraints:',
    '- Treat session measures, findings, and law notes as operational legislative decision-support data from Kentucky Medicaid analytical feeds (warehouse, DMS reporting, LRC-curated bill notes).',
    '- Never invent PHI or person-level Medicaid records. Keep views aggregate / de-identified.',
    '- Frame recommendations as "options to examine", never as prescriptions, legal advice, or official agency conclusions.',
    '- Cite freshness, owners, and known limitations when relevant.',
    '- Keep answers concise and actionable. Use short lists when helpful.',
    '- Prefer plain text with light markdown only (**bold**, lists, short headings, simple pipe tables). Never emit HTML tags.',
    '- If you use a table, keep it compact (2 columns preferred) so it fits a narrow nav chat.',
    '- If session context is thin, say what the user should select next (focus tabs, findings, evidence room, legislative analysis).',
    '',
    'Product map:',
    '- Evidence Rooms: SAP-style Analytical List Pages (visual filters → chart → list → object page).',
    '- Consideration Blender: focus tabs, findings, weights, quadrant/radar, win-win-win packs, Consideration Brief.',
    '- Legislative Analysis: bi-directional law ↔ blender (blockers, openings, draft bill wording for examination).',
    '- Ask Sam: this chat.',
    '',
    'Session context:',
    formatSessionContext(ctx),
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
