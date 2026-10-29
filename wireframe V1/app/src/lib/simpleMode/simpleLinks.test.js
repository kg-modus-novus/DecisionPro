import { describe, expect, it } from 'vitest';
import { readSimpleLink, simpleLinkHref, writeSimpleLink } from './simpleLinks.js';

describe('simple-mode page links', () => {
  it('reads a page and sub-tab', () => {
    expect(readSimpleLink('?state=KY&view=simple&page=county&tab=zips')).toEqual({ view: 'simple-county', anchor: 'zips' });
    expect(readSimpleLink('?page=simple-rates')).toEqual({ view: 'simple-rates', anchor: null });
  });

  it('ignores unknown or missing pages', () => {
    expect(readSimpleLink('?state=KY&view=simple')).toBeNull();
    expect(readSimpleLink('?page=nowhere&tab=x')).toBeNull();
  });

  it('writes only known sub-tabs and clears both off simple mode', () => {
    const url = new URL('https://demo.example/?state=KY&view=simple');
    writeSimpleLink(url, 'simple-access', 'vulnerability');
    expect(url.searchParams.get('page')).toBe('access');
    expect(url.searchParams.get('tab')).toBe('vulnerability');
    writeSimpleLink(url, 'simple-access', 'not-a-subtab');
    expect(url.searchParams.has('tab')).toBe(false);
    writeSimpleLink(url, 'role-home', null);
    expect(url.searchParams.has('page')).toBe(false);
  });

  it('builds a shareable link that round-trips', () => {
    const href = simpleLinkHref('https://demo.DecisionPro.io/', 'simple-rates', 'codes');
    expect(href).toBe('https://demo.decisionpro.io/?state=KY&view=simple&page=rates&tab=codes');
    expect(readSimpleLink(new URL(href).search)).toEqual({ view: 'simple-rates', anchor: 'codes' });
  });
});
