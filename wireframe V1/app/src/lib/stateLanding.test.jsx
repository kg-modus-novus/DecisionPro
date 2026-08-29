import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StateLanding } from '../components/StateLanding.jsx';
import { parseProductState } from '../data/operationalIntelligence.js';

describe('DecisionPro state landing', () => {
  it('publishes explicit and cohesive Kentucky and Florida routes', () => {
    const html = renderToStaticMarkup(<StateLanding />);
    expect(html).toContain('href="?state=KY"');
    expect(html).toContain('href="?state=FL"');
    expect(html).toContain('DecisionPro Kentucky');
    expect(html).toContain('DecisionPro Florida');
  });

  it('keeps the bare or invalid state route neutral', () => {
    expect(parseProductState(null)).toBeNull();
    expect(parseProductState('')).toBeNull();
    expect(parseProductState('KY')).toBe('KY');
    expect(parseProductState('fl')).toBe('FL');
    expect(parseProductState('XX')).toBeNull();
  });
});
