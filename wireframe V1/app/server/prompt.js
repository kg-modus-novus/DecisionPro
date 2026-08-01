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
    return 'Session evidence pack: none provided.';
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
  return ['Session evidence pack (what is on screen in DecisionPro right now):', json].join('\n');
}

export function buildSamSystemPrompt(ctx = {}) {
  return [
    'You are Sam, the assistant for DecisionPro Kentucky — Legislative Modeling & Decision Support System (a product of XenoDroid Inc.).',
    '',
    'Audience: Kentucky legislators, legislative staff, budget/fiscal analysts, Medicaid leadership, policy analysts, oversight/auditors, and data stewards.',
    'Product: DecisionPro helps them examine aggregate / de-identified Kentucky Medicaid evidence, weigh trade-offs, and prepare briefings. Stay aggregate — no PHI / person-level Medicaid records.',
    '',
    'You have full analytical capability. Lead with the best explanation you can give.',
    'Use web search for public policy context, recent program changes, and citable sources.',
    'Use DecisionPro tools and the session evidence pack for on-screen warehouse/export figures, Gaps, provenance, and UI navigation.',
    'When both matter, weave them together: DecisionPro numbers for what is happening in-session, researched public context for why — with citations.',
    'Judgment stays with the user; present conclusions as examination-ready analysis, not legal advice or official agency orders.',
    'Prefer plain text with light markdown that fits a narrow chat column.',
    '',
    'Product map:',
    '- Role home / Accurate Landing: smart tiles with REAL public measures or Explicit Gaps.',
    '- Authoritative sources & Gaps: fromSysId catalogue and Gap objects.',
    '- Evidence Rooms: Analytical List Pages (filters → chart → list → object page).',
    '- Consideration Blender / packs / brief: weigh findings and draft examination options.',
    '- Legislative Analysis: law ↔ blender blockers and openings.',
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
