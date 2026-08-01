import { describe, expect, it, vi } from 'vitest';
import {
  getMeasureDetail,
  listGaps,
  getGapDetail,
  getAuthoritativeSource,
  summarizeLoadHistoryFromExports,
  summarizeLoadHistoryFromPostgres,
  getBlenderFinding,
  getUiGuidance,
} from '../../server/askSamDataAccess.js';
import { ASK_SAM_TOOL_DEFINITIONS, executeAskSamTool } from '../../server/askSamTools.js';
import { callOpenAI } from '../../server/providers.js';

describe('Ask Sam data tools', () => {
  it('exposes the planned tool names', () => {
    const names = ASK_SAM_TOOL_DEFINITIONS.map((t) => t.function.name).sort();
    expect(names).toEqual(
      [
        'get_authoritative_source',
        'get_blender_finding',
        'get_gap_detail',
        'get_measure_detail',
        'get_ui_guidance',
        'list_gaps',
        'summarize_load_history',
      ].sort(),
    );
  });

  it('get_measure_detail returns M-001 with slim provenance', () => {
    const result = getMeasureDetail('M-001');
    expect(result.ok).toBe(true);
    expect(result.measure.measureId).toBe('M-001');
    expect(result.measure.displayValue).toBeTruthy();
    expect(result.measure.provenance?.psaObjectKey).toBeUndefined();
  });

  it('list_gaps and get_gap_detail work', () => {
    const listed = listGaps({ roomId: 'county' });
    expect(listed.ok).toBe(true);
    expect(listed.gaps.some((g) => g.gapId === 'GAP-HD-EXPENDITURE')).toBe(true);
    const detail = getGapDetail('GAP-HD-EXPENDITURE');
    expect(detail.ok).toBe(true);
    expect(detail.briefing?.whatItIs || detail.gap.need).toBeTruthy();
  });

  it('get_authoritative_source finds CMS enrollment', () => {
    const src = getAuthoritativeSource('CMS_DATA_MEDICAID_ENR');
    expect(src.ok).toBe(true);
    expect(src.source.loadStatus).toBe('LOADED');
  });

  it('summarize_load_history exports digest without inventing rows', () => {
    const dig = summarizeLoadHistoryFromExports();
    expect(dig.ok).toBe(true);
    expect(dig.source).toBe('exports');
    expect(dig.digests.length).toBeGreaterThan(0);
    expect(dig.digests[0].loadHistoryId).toMatch(/^LH-/);
  });

  it('postgres digest degrades when URL unset', async () => {
    const live = await summarizeLoadHistoryFromPostgres(undefined, {});
    expect(live.available).toBe(false);
    expect(live.fallbackHint).toMatch(/export/i);
  });

  it('get_blender_finding and get_ui_guidance', () => {
    expect(getBlenderFinding('f-pharmacy').ok).toBe(true);
    expect(getUiGuidance({ view: 'blender' }).guidance).toMatch(/Blender/i);
  });

  it('executeAskSamTool routes get_measure_detail', async () => {
    const raw = await executeAskSamTool('get_measure_detail', { measureId: 'M-002' });
    const parsed = JSON.parse(raw);
    expect(parsed.ok).toBe(true);
    expect(parsed.measure.measureId).toBe('M-002');
  });

  it('OpenAI Responses tool loop executes tools then returns final text', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (_url, init) => {
      calls += 1;
      const body = JSON.parse(init.body);
      if (calls === 1) {
        expect(_url).toMatch(/\/v1\/responses$/);
        expect(body.model).toBe('gpt-5.6-sol');
        expect(body.tools.some((t) => t.type === 'web_search')).toBe(true);
        expect(body.tools.some((t) => t.type === 'function' && t.name === 'get_measure_detail')).toBe(true);
        return {
          ok: true,
          json: async () => ({
            id: 'resp_1',
            output: [
              {
                type: 'function_call',
                call_id: 'call_1',
                name: 'get_measure_detail',
                arguments: JSON.stringify({ measureId: 'M-001' }),
              },
            ],
          }),
        };
      }
      expect(body.previous_response_id).toBe('resp_1');
      expect(body.input[0].type).toBe('function_call_output');
      return {
        ok: true,
        json: async () => ({
          id: 'resp_2',
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: 'M-001 enrollment is grounded from the export.' }],
            },
          ],
        }),
      };
    });

    const text = await callOpenAI({
      system: 'You are Sam.',
      messages: [{ role: 'user', content: 'What is M-001?' }],
      model: 'gpt-5.6-sol',
      apiKey: 'test-key',
      fetchImpl,
    });
    expect(text).toMatch(/M-001/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
