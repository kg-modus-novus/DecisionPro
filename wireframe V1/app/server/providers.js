/**
 * LLM providers for Ask Sam. Keys stay server-side only.
 */

import { buildSamSystemPrompt, normalizeHistory } from './prompt.js';

export function resolveProvider(env = process.env) {
  const forced = (env.ASK_SAM_PROVIDER || '').toLowerCase().trim();
  if (forced === 'anthropic' && env.ANTHROPIC_API_KEY) {
    return {
      id: 'anthropic',
      model: env.ASK_SAM_MODEL || env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
    };
  }
  if (forced === 'openai' && env.OPENAI_API_KEY) {
    return {
      id: 'openai',
      model: env.ASK_SAM_MODEL || env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }
  if (forced === 'cursor' && env.CURSOR_API_KEY) {
    return {
      id: 'cursor',
      model: env.ASK_SAM_MODEL || env.CURSOR_MODEL || 'composer-2.5',
    };
  }
  if (env.ANTHROPIC_API_KEY) {
    return {
      id: 'anthropic',
      model: env.ASK_SAM_MODEL || env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
    };
  }
  if (env.OPENAI_API_KEY) {
    return {
      id: 'openai',
      model: env.ASK_SAM_MODEL || env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }
  if (env.CURSOR_API_KEY) {
    return {
      id: 'cursor',
      model: env.ASK_SAM_MODEL || env.CURSOR_MODEL || 'composer-2.5',
    };
  }
  return null;
}

export async function callProvider({ provider, message, context, history, env = process.env }) {
  const system = buildSamSystemPrompt(context);
  const messages = [...normalizeHistory(history), { role: 'user', content: String(message).slice(0, 6000) }];

  if (provider.id === 'anthropic') {
    return callAnthropic({ system, messages, model: provider.model, apiKey: env.ANTHROPIC_API_KEY });
  }
  if (provider.id === 'openai') {
    return callOpenAI({ system, messages, model: provider.model, apiKey: env.OPENAI_API_KEY });
  }
  if (provider.id === 'cursor') {
    return callCursor({ system, messages, model: provider.model, apiKey: env.CURSOR_API_KEY });
  }
  throw new Error(`Unknown provider: ${provider.id}`);
}

async function callAnthropic({ system, messages, model, apiKey }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system,
      messages: messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Anthropic HTTP ${res.status}`);
  }
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('Anthropic returned empty content');
  return text;
}

async function callOpenAI({ system, messages, model, apiKey }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 1200,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI HTTP ${res.status}`);
  }
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenAI returned empty content');
  return text;
}

async function callCursor({ system, messages, model, apiKey }) {
  let Agent;
  try {
    ({ Agent } = await import('@cursor/sdk'));
  } catch {
    throw new Error(
      'CURSOR_API_KEY is set but @cursor/sdk is not installed. Run: npm install @cursor/sdk --save-optional',
    );
  }

  const transcript = messages
    .map((m) => `${m.role === 'assistant' ? 'Sam' : 'User'}: ${m.content}`)
    .join('\n\n');
  const prompt = `${system}\n\n---\nConversation so far:\n${transcript}\n\nReply as Sam only. Do not use tools. Do not modify files.`;

  const result = await Agent.prompt(prompt, {
    apiKey,
    model: { id: model },
    local: { cwd: process.cwd() },
  });

  const text = String(result?.result || result?.text || '').trim();
  if (!text) {
    throw new Error(`Cursor agent returned no text (status: ${result?.status || 'unknown'})`);
  }
  return text;
}
