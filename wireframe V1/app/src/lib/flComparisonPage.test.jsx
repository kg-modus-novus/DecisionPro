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

  it('distinguishes new Funding & Resilience capability from parity-extension capability', () => {
    const html = renderToStaticMarkup(<FloridaComparisonPage />);
    expect(html).toContain('AHCA&#x27;s own dashboards don&#x27;t publish');
    expect(html).toContain('Federal award-cliff calendar');
    expect(html).toContain('Organization identity crosswalk');
    expect(html).toContain('Sub-award funding-flow graph');
    expect(html).toContain('Waiver &amp; grant funding horizon');
    expect(html).not.toMatch(/waste|fraud|breach/i);
    expect((html.match(/class="comparison-unique-grid"/g) || []).length).toBe(1);
  });
});
