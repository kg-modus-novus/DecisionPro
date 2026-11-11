import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GlossaryProvider } from '../../lib/GlossaryContext.jsx';
import { BillingCode } from './fraudFormat.jsx';

const withGlossary = (node) => renderToStaticMarkup(<GlossaryProvider>{node}</GlossaryProvider>);

describe('BillingCode', () => {
  it('puts a "?" beside a code that names its own glossary entry and carries the description', () => {
    const html = withGlossary(<BillingCode code="H2027" />);
    expect(html).toContain('<span class="pfd-code">H2027</span>');
    expect(html).toContain('data-code-help="H2027"');
    expect(html).toContain('aria-label="What is H2027? Opens H2027 in the glossary."');
    expect(html).toMatch(/title="H2027: The HCPCS code for psychoeducational service, billed per 15 minutes\./);
  });

  it('describes a code without an entry of its own by its code family, or by what a billing code is', () => {
    expect(withGlossary(<BillingCode code="H0015" />)).toContain('Opens H codes in the glossary.');
    expect(withGlossary(<BillingCode code="97535" />)).toContain('Opens HCPCS code in the glossary.');
  });

  it('adds no text of its own, so a heading reads the same with it', () => {
    const html = withGlossary(<h1>Psychoeducation · <BillingCode code="H2027" plain /></h1>);
    expect(html.replace(/<[^>]+>/g, '')).toBe('Psychoeducation · H2027');
    expect(html).not.toContain('pfd-code"');
  });

  it('shows the code alone outside the glossary', () => {
    const html = renderToStaticMarkup(<BillingCode code="H2027" />);
    expect(html).toContain('H2027');
    expect(html).not.toContain('pfd-code-help');
  });
});
