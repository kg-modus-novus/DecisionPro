import { describe, expect, it } from 'vitest';
import { parseDollars, parseMillions } from './ReallocationPage.jsx';

describe('reallocation need entry (page boundary)', () => {
  it('reads a gap in millions and refuses zero, negatives and words', () => {
    expect(parseMillions('60')).toBe(60e6);
    expect(parseMillions('$12.5M')).toBe(12.5e6);
    expect(parseMillions('0')).toBe('');
    expect(parseMillions('-5')).toBe('');
    expect(parseMillions('lots')).toBe('');
  });

  it('reads a unit cost in dollars, with K or M, and treats blank as no estimate', () => {
    expect(parseDollars('75000')).toBe(75_000);
    expect(parseDollars('75,000')).toBe(75_000);
    expect(parseDollars('$75K')).toBe(75_000);
    expect(parseDollars('1.2M')).toBe(1.2e6);
    expect(parseDollars('')).toBe(0);
    expect(parseDollars('-1')).toBe('');
    expect(parseDollars('about 5')).toBe('');
  });
});
