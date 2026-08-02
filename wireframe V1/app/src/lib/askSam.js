/**
 * Ask Sam — wireframe assistant.
 * Default: context-aware replies (no API key).
 * Live path: Vite middleware POST /api/ask-sam (see ASK_SAM.md / .env.example).
 */

import { buildAskSamStarterPrompts, FALLBACK_PROMPTS } from './askSamStarterPrompts.js';

/** @deprecated Prefer buildAskSamStarterPrompts({ roleId }) for role-dashboard questions. */
const STARTER_PROMPTS = FALLBACK_PROMPTS;

function viewLabel(view, evidenceId) {
  if (view === 'role-selector') return 'Role selector';
  if (view === 'role-home') return 'Role home';
  if (view === 'evidence') return evidenceId ? `Evidence Room (${evidenceId})` : 'Evidence Rooms index';
  if (view === 'blender') return 'Consideration Blender';
  if (view === 'pack') return 'Win-Win-Win Pack';
  if (view === 'brief') return 'Consideration Brief';
  if (view === 'legislation') return 'Legislative Analysis';
  if (view === 'law-object') return 'Legislation object';
  return view;
}

function nextStepHint(topic) {
  return `Next, I would ${topic}`;
}

export function buildSamReply(userText, ctx = {}) {
  const q = String(userText || '').toLowerCase().trim();
  const where = viewLabel(ctx.view, ctx.evidenceId);
  const focuses = (ctx.focuses || []).join(', ') || 'none selected';
  const findingTitles = (ctx.findings || []).map((f) => f.title).filter(Boolean);
  const packTitle = ctx.pack?.title || 'none selected';
  const roleHint = ctx.askSamHint || ctx.roleHint || null;
  const roleLine = roleHint
    ? `\n\nPerspective guidance (not access control): ${roleHint}`
    : '';

  if (!q) {
    return (
      'Ask me anything about navigating DecisionPro, reading evidence rooms, blending trade-offs, or examining legislative blockers.'
      + roleLine
    );
  }

  if (/how (do i |to )?use|getting started|help|tutorial|navigat|role/.test(q)) {
    return [
      `You're currently on **${where}**.`,
      roleHint ? `Active role perspective: ${roleHint}` : 'Choose a role on the selector to tailor defaults — roles are perspectives, not permissions.',
      '',
      'Suggested path:',
      '1. Pick a **role perspective** (or switch from the top bar).',
      '2. Open an **Evidence Room** (Analytical List Page) and adapt visual filters.',
      '3. Open a row into the **object page** for identification, facets, and related lists.',
      '4. In the **Consideration Blender**, select focus tabs, add findings, and adjust weights.',
      '5. Unlock **Win-Win-Win Pack** and the **Consideration Brief**.',
      '6. Use **Legislative Analysis** for bi-directional law ↔ blender blockers and draft wording.',
      '',
      nextStepHint(
        'ground every answer in your live session context, cite measure definitions/freshness, and refuse PHI while still proposing examination options.',
      ),
    ].join('\n');
  }

  if (/budget|cost|pmpm|pharmacy|spend/.test(q)) {
    return [
      `Budget lens · context: ${where}; focuses: ${focuses}.`,
      '',
      'Start in **Cost Drivers** or **Command Center**, filter by population/region/period, then bring high-contribution findings into the blender.',
      findingTitles.length
        ? `You already blended: ${findingTitles.join('; ')}.`
        : 'You have not blended findings yet — add at least two to unlock packs.',
      '',
      nextStepHint(
        'query the warehouse cube for contribution-to-increase, separate size vs growth, and attach rebate/run-out caveats automatically before any talking point.',
      ),
    ].join('\n');
  }

  if (/blender|weight|radar|quadrant|trade-?off|win-?win/.test(q)) {
    return [
      `Blender status · focuses **${focuses}** · pack **${packTitle}** · findings ${findingTitles.length}.`,
      '',
      findingTitles.length >= 2
        ? 'You can open Win-Win-Win Pack and Brief. Try raising Access or Care weights and watch the radar reshape.'
        : 'Select focus tabs, then **Add to blender** on at least two findings so packs unlock.',
      '',
      nextStepHint(
        'persist weights per lawmaker session, score packs against live evidence strength, and explain which axes moved because of which findings.',
      ),
    ].join('\n');
  }

  if (/law|bill|legislation|blocker|draft|krs|statute/.test(q)) {
    return [
      'Open **Legislative Analysis → Law ↔ blender**.',
      '',
      'There you can explore existing/pending instruments, score blockers vs openings against your focuses/pack, and read draft bill wording for examination (sometimes surgical).',
      '',
      nextStepHint(
        'retrieve curated + authorized bill text, map blockers to the exact blender opportunities, and generate examination drafts with counsel review gates — never as legal advice.',
      ),
    ].join('\n');
  }

  if (/analy[sz]e|analysis|findings|propose|solution|option/.test(q)) {
    return [
      `Analysis pass on **${where}**.`,
      focuses !== 'none selected' ? `Active focuses: ${focuses}.` : 'No focuses selected yet.',
      findingTitles.length
        ? `Blended findings:\n- ${findingTitles.join('\n- ')}`
        : 'No findings blended — I would normally refuse a firm recommendation and instead ask which evidence rooms to scan.',
      packTitle !== 'none selected' ? `Active pack under examination: ${packTitle}.` : '',
      '',
      'Proposal (options to examine, not prescriptions):',
      '1. Confirm freshness labels before using any peer benchmark.',
      '2. Pair one budget finding with one access/care finding in the blender.',
      '3. Check Legislative Analysis for blockers that would stall the pack.',
      '4. Export a Consideration Brief for talking points only.',
      '',
      nextStepHint(
        'run a structured molecule that classifies interventions, surfaces who may gain/bear cost, and attaches trust caveats before any export.',
      ),
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (/phi|privacy|person|member-level|claim line/.test(q)) {
    return [
      'DecisionPro is designed around aggregate / de-identified legislative views.',
      'Views never include PHI or person-level Medicaid records.',
      '',
      nextStepHint(
        'enforce suppression, access control, and auditability as first-class requirements whenever a query approaches small-N risk.',
      ),
    ].join('\n');
  }

  if (/llm|api|cursor|real ai|gpt|claude/.test(q)) {
    return [
      'Right now I answer with a context-aware assistant brain (no live model call).',
      '',
      'A live LLM is feasible, but not by dropping a Cursor IDE key into the browser.',
      'Safer pattern: a tiny local/server proxy with CURSOR_API_KEY or a provider key, never exposed to the client.',
      '',
      nextStepHint(
        'call an approved model with retrieval over measure definitions, blender state, and authorized law notes, streaming answers into this same chat dock.',
      ),
    ].join('\n');
  }

  return [
    `I heard: “${userText.trim()}”.`,
    `Current screen: **${where}**. Focuses: ${focuses}. Pack: ${packTitle}.`,
    roleHint ? `Role perspective: ${roleHint}` : '',
    '',
    'I can help with navigation, evidence reading, blender trade-offs, legislative blockers, or examination options.',
    '',
    nextStepHint('ground this answer in live metrics and cite sources for the active session.'),
  ]
    .filter(Boolean)
    .join('\n');
}

export { STARTER_PROMPTS, buildAskSamStarterPrompts };
