/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { GlossaryModal } from '../components/GlossaryModal.jsx';
import { GlossaryText } from '../components/GlossaryTerm.jsx';
import { GlossaryProvider } from './GlossaryContext.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('operational glossary links', () => {
  it('links new operational and source terms, opens the definition, and respects word boundaries', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => root.render(
      <GlossaryProvider>
        <p><GlossaryText text="MCPAR candidate pool from the CMS Provider Data Catalog through a public API; ordinary capability text stays plain." /></p>
        <GlossaryModal />
      </GlossaryProvider>,
    ));

    const links = [...host.querySelectorAll('.glossary-term-link')];
    expect(links.map((link) => link.textContent)).toEqual(expect.arrayContaining([
      'MCPAR', 'candidate pool', 'CMS Provider Data Catalog', 'public API',
    ]));
    expect(links.some((link) => link.textContent === 'api' && link.parentElement.textContent.includes('capability'))).toBe(false);

    act(() => links.find((link) => link.textContent === 'MCPAR').click());
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Managed Care Program Annual Report');
    expect(dialog.textContent).toContain('Authoritative reference');
    expect(dialog.querySelector('a[href*="medicaid.gov"]')).toBeTruthy();

    act(() => root.unmount());
  });
});
