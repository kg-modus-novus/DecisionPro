import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FloridaComparisonPage } from '../components/FloridaComparisonPage.jsx';

describe('DecisionPro Florida marketing comparison', () => {
  it('presents an evidence-bounded above-parity story and clear calls to action', () => {
    const html = renderToStaticMarkup(<FloridaComparisonPage />);
    expect(html).toContain('DecisionPro makes the evidence operational');
    expect(html).toContain('Florida public dashboard experience');
    expect(html).toContain('DecisionPro Florida above-parity layer');
    expect(html).toContain('11</strong><span>AHCA dashboard domains connected');
    expect(html).toContain('Modeled benefit is not labeled realized savings');
    expect(html).toContain('Florida AHCA remains the source of record');
    expect((html.match(/<tbody>/g) || []).length).toBe(1);
    expect((html.match(/<tr>/g) || []).length).toBe(9);
  });
});
