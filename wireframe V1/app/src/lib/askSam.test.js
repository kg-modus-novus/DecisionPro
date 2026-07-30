import { describe, expect, it } from 'vitest';
import { buildSamReply } from './askSam.js';

describe('askSam wireframe replies', () => {
  it('answers how-to with navigation guidance', () => {
    const reply = buildSamReply('How do I use this application?', {
      view: 'blender',
      focuses: ['budget', 'care'],
      findings: [],
    });
    expect(reply).toMatch(/Evidence Room/i);
    expect(reply).toMatch(/Consideration Blender/i);
  });

  it('references blender findings when analyzing', () => {
    const reply = buildSamReply('Analyze my findings and propose options', {
      view: 'blender',
      focuses: ['budget', 'access'],
      findings: [{ title: 'Specialty pharmacy contribution' }],
      pack: { title: 'Primary-care access pack' },
    });
    expect(reply).toMatch(/Specialty pharmacy contribution/);
    expect(reply).toMatch(/options to examine/i);
  });
});
