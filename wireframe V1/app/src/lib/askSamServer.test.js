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
    expect(prompt).toMatch(/options to examine/i);
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
