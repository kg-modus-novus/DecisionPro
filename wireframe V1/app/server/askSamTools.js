/**
 * Allowlisted Ask Sam tools (OpenAI function-calling schema + executor).
 */

import {
  getAuthoritativeSource,
  getBlenderFinding,
  getGapDetail,
  getMeasureDetail,
  getUiGuidance,
  listGaps,
  summarizeLoadHistory,
} from './askSamDataAccess.js';

export const ASK_SAM_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_measure_detail',
      description:
        'Get a REAL public measure from Accurate Landing exports (and related Evidence Room rows), including slim provenance. Never invent values.',
      parameters: {
        type: 'object',
        properties: {
          measureId: { type: 'string', description: 'Measure id such as M-001' },
        },
        required: ['measureId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_gaps',
      description: 'List Explicit Gap objects from the catalogue. Optionally filter by Evidence Room id.',
      parameters: {
        type: 'object',
        properties: {
          roomId: { type: 'string', description: 'Optional room id e.g. county, utilization' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_gap_detail',
      description: 'Get one Explicit Gap plus its briefing (need, access path, dashboard impact).',
      parameters: {
        type: 'object',
        properties: {
          gapId: { type: 'string', description: 'Gap id such as GAP-HD-EXPENDITURE' },
        },
        required: ['gapId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_authoritative_source',
      description: 'Look up an authoritative fromSysId or curated primary source key (links, load status, attribution).',
      parameters: {
        type: 'object',
        properties: {
          fromSysId: {
            type: 'string',
            description: 'fromSysId (e.g. CMS_DATA_MEDICAID_ENR) or primary source key (e.g. medicaidPharmacy)',
          },
        },
        required: ['fromSysId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_load_history',
      description:
        'Condense load-history lineage for a loadHistoryId (or recent loads). Uses export provenance; optional live Postgres when configured. No PSA dumps.',
      parameters: {
        type: 'object',
        properties: {
          loadHistoryId: {
            type: 'string',
            description: 'Optional load history id (LH-...). Omit for recent digest list from exports/Postgres.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_ui_guidance',
      description: 'Explain how to use the current DecisionPro screen and what to ask next.',
      parameters: {
        type: 'object',
        properties: {
          view: { type: 'string' },
          evidenceId: { type: 'string' },
          roleId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_blender_finding',
      description: 'Get a blender finding by id from the REAL/GAP blender export (disposition, magnitude label, measureId).',
      parameters: {
        type: 'object',
        properties: {
          findingId: { type: 'string', description: 'Finding id such as f-pharmacy' },
        },
        required: ['findingId'],
      },
    },
  },
];

const MAX_TOOL_RESULT_CHARS = 12000;

function safeJson(value) {
  let text;
  try {
    text = JSON.stringify(value);
  } catch {
    text = JSON.stringify({ ok: false, error: 'Failed to serialize tool result' });
  }
  if (text.length > MAX_TOOL_RESULT_CHARS) {
    return `${text.slice(0, MAX_TOOL_RESULT_CHARS)}…(truncated)`;
  }
  return text;
}

/**
 * @param {string} name
 * @param {object} args
 * @param {{ env?: NodeJS.ProcessEnv, sessionContext?: object }} [opts]
 */
export async function executeAskSamTool(name, args = {}, opts = {}) {
  const env = opts.env || process.env;
  const ctx = opts.sessionContext || {};

  try {
    switch (name) {
      case 'get_measure_detail':
        return safeJson(getMeasureDetail(args.measureId));
      case 'list_gaps':
        return safeJson(listGaps({ roomId: args.roomId }));
      case 'get_gap_detail':
        return safeJson(getGapDetail(args.gapId));
      case 'get_authoritative_source':
        return safeJson(getAuthoritativeSource(args.fromSysId || args.key));
      case 'summarize_load_history':
        return safeJson(await summarizeLoadHistory(args.loadHistoryId, env));
      case 'get_ui_guidance':
        return safeJson(
          getUiGuidance({
            view: args.view || ctx.view,
            evidenceId: args.evidenceId || ctx.evidenceId,
            roleId: args.roleId || ctx.roleId,
          }),
        );
      case 'get_blender_finding':
        return safeJson(getBlenderFinding(args.findingId));
      default:
        return safeJson({ ok: false, error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return safeJson({ ok: false, error: String(err.message || err) });
  }
}
