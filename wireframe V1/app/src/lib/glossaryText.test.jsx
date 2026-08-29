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

describe('GlossaryText', () => {
  it('links complete operational terms without matching acronyms inside longer words', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(
      <GlossaryProvider>
        <p><GlossaryText text="MCPAR uses a public API for capacity analysis and LEIE review." /></p>
        <GlossaryModal />
      </GlossaryProvider>,
    ));

    const links = [...host.querySelectorAll('.glossary-term-link')];
    expect(links.map((link) => link.textContent)).toEqual(['MCPAR', 'public API', 'LEIE']);
    expect(links.some((link) => link.textContent.toLowerCase() === 'api' && link.parentElement.textContent.includes('capacity'))).toBe(false);

    act(() => links[0].dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.querySelector('.glossary-modal h3')?.textContent).toBe('MCPAR');
    expect(document.querySelector('.glossary-detail-pane')?.textContent).toContain('Authoritative reference');
    act(() => root.unmount());
  });
});
