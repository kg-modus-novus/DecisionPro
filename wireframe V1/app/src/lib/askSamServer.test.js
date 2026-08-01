import { describe, expect, it } from 'vitest';
import { buildSamSystemPrompt, normalizeHistory } from '../../server/prompt.js';
import { resolveProvider } from '../../server/providers.js';
import { getAskSamStatus } from '../../server/askSamApi.js';

describe('Ask Sam server prompt/providers', () => {
  it('builds a system prompt with session context', () => {
    const prompt = buildSamSystemPrompt({
      view: 'blender',
      focuses: ['budget', 'care'],
      findings: [{ title: 'Specialty pharmacy contribution', focusId: 'budget' }],
      pack: { title: 'Access pack', tags: ['access'] },
    });
    expect(prompt).toMatch(/You are Sam/);
    expect(prompt).toMatch(/Specialty pharmacy contribution/);
    expect(prompt).toMatch(/web search/i);
  });

  it('embeds evidence pack and Accurate Landing in the system prompt', () => {
    const prompt = buildSamSystemPrompt({
      view: 'role-home',
      roleId: 'legislator',
      evidencePack: {
        schema: 'decisionpro/ask-sam-evidence-pack/v1',
        landing: { accurateLandingTiles: [{ measureId: 'M-001', value: '1,294,021' }] },
        gaps: [{ gapId: 'GAP-HD-EXPENDITURE', title: 'House district expenditure' }],
      },
    });
    expect(prompt).toMatch(/Accurate Landing/i);
    expect(prompt).toMatch(/Session evidence pack/);
    expect(prompt).toMatch(/M-001/);
    expect(prompt).toMatch(/GAP-HD-EXPENDITURE/);
    expect(prompt).toMatch(/full analytical capability/i);
  });

  it('defaults openai to gpt-5.6-sol', () => {
    const p = resolveProvider({ OPENAI_API_KEY: 'x' });
    expect(p).toEqual({ id: 'openai', model: 'gpt-5.6-sol' });
  });

  it('normalizes history roles', () => {
    const hist = normalizeHistory([
      { role: 'user', text: 'Hi' },
      { role: 'sam', text: 'Hello' },
      { role: 'assistant', text: 'Also' },
    ]);
    expect(hist).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'assistant', content: 'Also' },
    ]);
  });

  it('resolves anthropic before openai when both present', () => {
    const p = resolveProvider({
      ANTHROPIC_API_KEY: 'a',
      OPENAI_API_KEY: 'b',
    });
    expect(p.id).toBe('anthropic');
  });

  it('honors ASK_SAM_PROVIDER force', () => {
    const p = resolveProvider({
      ASK_SAM_PROVIDER: 'openai',
      ANTHROPIC_API_KEY: 'a',
      OPENAI_API_KEY: 'b',
    });
    expect(p.id).toBe('openai');
  });

  it('reports live status when a key exists', () => {
    expect(getAskSamStatus({}).live).toBe(false);
    expect(getAskSamStatus({ OPENAI_API_KEY: 'x' }).live).toBe(true);
  });
});
