import { describe, expect, it } from 'vitest';
import { isTableRow, isTableSeparator, parseMarkdownBlocks, splitTableCells } from './askSamFormat.js';

describe('askSamFormat', () => {
  it('detects markdown table rows and separators', () => {
    expect(isTableRow('| Item | Status |')).toBe(true);
    expect(isTableSeparator('|------|--------|')).toBe(true);
    expect(splitTableCells('| Screen | Consideration Blender |')).toEqual([
      'Screen',
      'Consideration Blender',
    ]);
  });

  it('parses pipe tables into structured blocks', () => {
    const text = [
      '**On your session specifically**',
      '',
      '| Item | Status |',
      '|------|--------|',
      '| Screen | Consideration Blender · Results |',
      '| Focus | budget, care |',
      '| Findings | none blended yet |',
      '',
      'I would propose examining that pack.',
    ].join('\n');

    const blocks = parseMarkdownBlocks(text);
    expect(blocks[0]).toEqual({ type: 'heading', text: 'On your session specifically' });
    expect(blocks[1].type).toBe('table');
    expect(blocks[1].header).toEqual(['Item', 'Status']);
    expect(blocks[1].rows).toHaveLength(3);
    expect(blocks[1].rows[0][0]).toBe('Screen');
    expect(blocks[2].type).toBe('paragraph');
  });

  it('treats --- as a horizontal rule, not raw text', () => {
    const blocks = parseMarkdownBlocks('Before\n---\nAfter');
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'hr', 'paragraph']);
  });
});
