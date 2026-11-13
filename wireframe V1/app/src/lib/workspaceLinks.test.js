import { describe, expect, it } from 'vitest';
import { readFraudLink, readWorkspaceLink, writeFraudLink, writeWorkspaceLink } from './workspaceLinks.js';

const ROLES = ['legislator', 'oversight-auditor'];
const PAGES = ['radar', 'early', 'brief'];

describe('workspace links', () => {
  it('reads a direct link to a workspace page', () => {
    expect(readWorkspaceLink('?state=KY&view=sme&role=oversight-auditor&go=evidence&room=r1&object=o2', ROLES)).toEqual({
      role: 'oversight-auditor', view: 'evidence', room: 'r1', object: 'o2', law: null, pack: null, blend: null, weights: null,
    });
  });

  it('carries the blend and weights on blender, pack and brief links only', () => {
    const url = new URL('https://demo.example/?state=KY&view=sme');
    const weights = { budget: 40, care: 70, access: 65, mco: 35, district: 80, bill: 45 };
    writeWorkspaceLink(url, { role: 'legislator', view: 'brief', pack: 'pack-pc-pharmacy-rural', blend: ['f-pharmacy', 'f-postpartum'], weights });
    expect(url.searchParams.get('blend')).toBe('f-pharmacy,f-postpartum');
    expect(url.searchParams.get('w')).toBe('40.70.65.35.80.45');
    expect(readWorkspaceLink(url.search, ROLES)).toMatchObject({ view: 'brief', pack: 'pack-pc-pharmacy-rural', blend: ['f-pharmacy', 'f-postpartum'], weights });
    writeWorkspaceLink(url, { role: 'legislator', view: 'fraud', blend: ['f-pharmacy'], weights });
    expect(url.searchParams.has('blend')).toBe(false);
    expect(url.searchParams.has('w')).toBe(false);
  });

  it('opens as a legislator when the link names no role', () => {
    expect(readWorkspaceLink('?state=KY&view=sme&go=fraud', ROLES).role).toBe('legislator');
  });

  it('names nothing for simple mode, an unknown view or an unknown role', () => {
    expect(readWorkspaceLink('?state=KY&go=fraud', ROLES)).toBeNull();
    expect(readWorkspaceLink('?state=KY&view=sme', ROLES)).toBeNull();
    expect(readWorkspaceLink('?state=KY&view=sme&go=nowhere', ROLES)).toBeNull();
    expect(readWorkspaceLink('?state=KY&view=sme&role=intruder&go=fraud', ROLES)).toBeNull();
  });

  it('writes the page on screen and round-trips it', () => {
    const url = new URL('https://demo.example/?state=KY&view=sme');
    writeWorkspaceLink(url, { role: 'legislator', view: 'law-object', law: 'KRS-205', room: 'x', pack: 'p' });
    expect(url.search).toBe('?state=KY&view=sme&role=legislator&go=law-object&law=KRS-205');
    expect(readWorkspaceLink(url.search, ROLES)).toMatchObject({ role: 'legislator', view: 'law-object', law: 'KRS-205' });
  });

  it('marks a link in a state without simple mode as an expert page, so it opens cold', () => {
    const url = new URL('https://demo.example/?state=FL');
    writeWorkspaceLink(url, { role: 'legislator', view: 'fraud' });
    expect(url.searchParams.get('view')).toBe('sme');
    expect(readWorkspaceLink(url.search, ROLES)).toMatchObject({ role: 'legislator', view: 'fraud' });
  });

  it('clears workspace and module keys when no workspace page is on screen', () => {
    const url = new URL('https://demo.example/?state=KY&view=sme&role=legislator&go=fraud&fraud=early&fstate=KY&fid=a');
    writeWorkspaceLink(url, null);
    expect(url.search).toBe('?state=KY&view=sme');
  });

  it('clears module keys when leaving Potential Fraud Detection', () => {
    const url = new URL('https://demo.example/?state=KY&view=sme&role=legislator&go=fraud&fraud=early&fstate=KY');
    writeWorkspaceLink(url, { role: 'legislator', view: 'role-home' });
    expect(url.search).toBe('?state=KY&view=sme&role=legislator&go=role-home');
  });

  it('keeps module keys while on Potential Fraud Detection', () => {
    const url = new URL('https://demo.example/?state=KY&view=sme&role=legislator&go=fraud&fraud=early&fstate=OH');
    writeWorkspaceLink(url, { role: 'legislator', view: 'fraud' });
    expect(url.searchParams.get('fraud')).toBe('early');
    expect(url.searchParams.get('fstate')).toBe('OH');
  });
});

describe('Potential Fraud Detection links', () => {
  it('reads page, state and service-year, ignoring unknown pages', () => {
    expect(readFraudLink('?fraud=brief&fstate=oh&fid=OH%7CH2027%7C2024', PAGES)).toEqual({
      page: 'brief', state: 'OH', focusId: 'OH|H2027|2024',
    });
    expect(readFraudLink('?fraud=elsewhere', PAGES)).toEqual({ page: null, state: null, focusId: null });
  });

  it('writes and round-trips the module position', () => {
    const url = new URL('https://demo.example/?state=KY&view=sme&go=fraud&fid=old');
    writeFraudLink(url, { page: 'early', state: 'KY', focusId: null });
    expect(url.searchParams.has('fid')).toBe(false);
    expect(readFraudLink(url.search, PAGES)).toEqual({ page: 'early', state: 'KY', focusId: null });
  });
});
