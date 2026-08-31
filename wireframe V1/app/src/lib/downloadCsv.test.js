import { describe, expect, it } from 'vitest';
import { buildCsvText } from './downloadCsv.js';

describe('buildCsvText', () => {
  it('builds a header row from the first object\'s keys when no columns are given', () => {
    const text = buildCsvText([{ a: 1, b: 'x' }, { a: 2, b: 'y' }]);
    expect(text).toBe('a,b\r\n1,x\r\n2,y');
  });

  it('respects an explicit column order/subset', () => {
    const text = buildCsvText([{ a: 1, b: 'x', c: 'z' }], ['b', 'a']);
    expect(text).toBe('b,a\r\nx,1');
  });

  it('quotes and escapes values containing commas, quotes, or newlines', () => {
    const text = buildCsvText([{ title: 'Acme, Inc.', note: 'Says "hello"\nline two' }], ['title', 'note']);
    expect(text).toBe('title,note\r\n"Acme, Inc.","Says ""hello""\nline two"');
  });

  it('renders null/undefined as an empty cell', () => {
    const text = buildCsvText([{ a: null, b: undefined }], ['a', 'b']);
    expect(text).toBe('a,b\r\n,');
  });
});
