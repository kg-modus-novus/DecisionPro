/**
 * LLM providers for Ask Sam. Keys stay server-side only.
 * OpenAI supports allowlisted tool calling; Anthropic/Cursor receive evidence pack only.
 */

import { ASK_SAM_TOOL_DEFINITIONS, executeAskSamTool } from './askSamTools.js';
import { buildSamSystemPrompt, normalizeHistory } from './prompt.js';

const OPENAI_MAX_TOOL_ROUNDS = 6;

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
      model: env.ASK_SAM_MODEL || env.OPENAI_MODEL || 'gpt-5.6-sol',
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
      model: env.ASK_SAM_MODEL || env.OPENAI_MODEL || 'gpt-5.6-sol',
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
    return callOpenAI({
      system,
      messages,
      model: provider.model,
      apiKey: env.OPENAI_API_KEY,
      env,
      sessionContext: context,
    });
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

function usesOpenAIResponsesApi(model) {
  return /^(gpt-5|o[1-9])/i.test(String(model || ''));
}

function toResponsesFunctionTools(tools = []) {
  return tools.map((t) => {
    const fn = t.function || t;
    return {
      type: 'function',
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters || { type: 'object', properties: {} },
    };
  });
}

function buildResponsesTools(tools = [], env = process.env) {
  const out = [];
  const webSearchOff = String(env.ASK_SAM_WEB_SEARCH || 'true').toLowerCase() === 'false';
  if (!webSearchOff) {
    out.push({ type: 'web_search' });
  }
  out.push(...toResponsesFunctionTools(tools));
  return out;
}

function extractResponsesText(data) {
  const chunks = [];
  for (const item of data?.output || []) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part.type === 'output_text' && part.text) chunks.push(part.text);
        if (part.type === 'text' && part.text) chunks.push(part.text);
      }
    }
  }
  if (!chunks.length && data?.output_text) chunks.push(data.output_text);
  return chunks.join('\n').trim();
}

/**
 * OpenAI provider — Responses API for GPT-5.x / o-series; Chat Completions otherwise.
 */
export async function callOpenAI({
  system,
  messages,
  model,
  apiKey,
  env = process.env,
  sessionContext = {},
  fetchImpl = fetch,
  tools = ASK_SAM_TOOL_DEFINITIONS,
  maxToolRounds = OPENAI_MAX_TOOL_ROUNDS,
}) {
  if (usesOpenAIResponsesApi(model)) {
    return callOpenAIResponses({
      system,
      messages,
      model,
      apiKey,
      env,
      sessionContext,
      fetchImpl,
      tools,
      maxToolRounds,
    });
  }
  return callOpenAIChatCompletions({
    system,
    messages,
    model,
    apiKey,
    env,
    sessionContext,
    fetchImpl,
    tools,
    maxToolRounds,
  });
}

async function callOpenAIResponses({
  system,
  messages,
  model,
  apiKey,
  env,
  sessionContext,
  fetchImpl,
  tools,
  maxToolRounds,
}) {
  const input = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));
  let previousResponseId = null;

  for (let round = 0; round < maxToolRounds; round += 1) {
    const body = {
      model,
      instructions: system,
      max_output_tokens: 4096,
      reasoning: { effort: 'medium' },
      tool_choice: 'auto',
    };
    const responseTools = buildResponsesTools(tools, env);
    if (responseTools.length) body.tools = responseTools;
    if (previousResponseId) body.previous_response_id = previousResponseId;
    body.input = input;

    const res = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || `OpenAI Responses HTTP ${res.status}`);
    }

    previousResponseId = data.id || previousResponseId;
    const functionCalls = (data.output || []).filter((item) => item.type === 'function_call');
    if (functionCalls.length) {
      const outputs = [];
      for (const fc of functionCalls) {
        let args = {};
        try {
          args = JSON.parse(fc.arguments || '{}');
        } catch {
          args = {};
        }
        const result = await executeAskSamTool(fc.name, args, {
          env,
          sessionContext,
        });
        outputs.push({
          type: 'function_call_output',
          call_id: fc.call_id,
          output: result,
        });
      }
      input.length = 0;
      input.push(...outputs);
      continue;
    }

    const text = extractResponsesText(data);
    if (!text) throw new Error('OpenAI Responses returned empty content');
    return text;
  }

  throw new Error(`OpenAI Responses tool loop exceeded ${maxToolRounds} rounds`);
}

async function callOpenAIChatCompletions({
  system,
  messages,
  model,
  apiKey,
  env,
  sessionContext,
  fetchImpl,
  tools,
  maxToolRounds,
}) {
  const msgs = [{ role: 'system', content: system }, ...messages];

  for (let round = 0; round < maxToolRounds; round += 1) {
    const body = {
      model,
      temperature: 0.4,
      max_tokens: 2400,
      messages: msgs,
    };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || `OpenAI HTTP ${res.status}`);
    }

    const choice = data?.choices?.[0]?.message;
    if (!choice) throw new Error('OpenAI returned empty message');

    const toolCalls = choice.tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length) {
      msgs.push({
        role: 'assistant',
        content: choice.content || null,
        tool_calls: toolCalls,
      });
      for (const tc of toolCalls) {
        let args = {};
        try {
          args = JSON.parse(tc.function?.arguments || '{}');
        } catch {
          args = {};
        }
        const result = await executeAskSamTool(tc.function?.name, args, {
          env,
          sessionContext,
        });
        msgs.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        });
      }
      continue;
    }

    const text = String(choice.content || '').trim();
    if (!text) throw new Error('OpenAI returned empty content');
    return text;
  }

  throw new Error(`OpenAI tool loop exceeded ${maxToolRounds} rounds`);
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
