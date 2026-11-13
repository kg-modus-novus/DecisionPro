// CodeXen: v1 not-applicable
// The landing pop-up on every simple-mode page (Director requests 2026-10-28
// and 2026-11-13): the first time a viewer lands on a tab or sub-tab in a
// session, a dialog offers its explainer video and a walkthrough of the page,
// with Skip and Don't show again. A "How this works" button keeps both one
// click away. Presentation only.
import { useState } from 'react';
import { pageGuideFor } from '../../lib/simpleMode/explainers.js';
import { buildDomWalkthrough } from '../../lib/domWalkthrough.js';
import { PageGuidePrompt } from '../PageGuidePrompt.jsx';
import { CalloutWalkthrough } from '../CalloutWalkthrough.jsx';

export function ExplainerPrompt({ view, anchor }) {
  const guide = pageGuideFor(view, anchor);
  const [steps, setSteps] = useState(null);
  const startWalkthrough = () => {
    const root = document.querySelector('main.sm-home');
    const built = buildDomWalkthrough(root, '.sm-hero, .sm-section', { prefix: 'simple-step', textSelector: ':scope > p, .sm-lede, .sm-section-head p, .sm-section-note' });
    if (built.length) setSteps(built);
  };
  if (!guide) return null;
  return (
    <>
      <PageGuidePrompt guide={guide} onWalkthrough={startWalkthrough} />
      <CalloutWalkthrough
        open={Boolean(steps)}
        steps={steps || []}
        onClose={() => setSteps(null)}
        onSkipAll={() => setSteps(null)}
        onComplete={() => setSteps(null)}
      />
    </>
  );
}
