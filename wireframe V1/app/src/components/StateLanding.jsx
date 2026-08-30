import { PRODUCT_STATES } from '../data/operationalIntelligence.js';
import { GlossaryText } from './GlossaryTerm.jsx';

const STATE_SUMMARIES = {
  KY: {
    eyebrow: 'Operational Kentucky product',
    description:
      'The established legislative workspace with role-based Evidence Rooms, source provenance, operational intelligence, Ask Sam, and consideration workflows.',
    capabilities: ['Public REAL data', 'Kentucky Evidence Rooms', 'Operational accountability'],
  },
  FL: {
    eyebrow: 'Competitive Florida preview',
    description:
      'A state-aware Florida product combining federal managed-care evidence with observed AHCA dashboard domains and an evidence-to-action operating model.',
    capabilities: ['Federal REAL foundation', 'Florida source coverage', 'Operational investigation queue'],
  },
};

export function StateLanding({ onSelectState, onOpenComparison }) {
  return (
    <main className="main state-landing">
      <section className="state-landing-hero" aria-labelledby="state-landing-title">
        <p className="state-landing-eyebrow">Decision intelligence for public program oversight</p>
        <h1 id="state-landing-title">Choose a DecisionPro state product</h1>
        <p className="state-landing-lede">
          <GlossaryText text="DecisionPro connects authoritative public evidence to transparent analysis, accountable action, and measured outcomes. Select a state to enter its role-based demonstration." />
        </p>
        <p className="hint"><GlossaryText text="New to DecisionPro? Select any underlined term—such as operational intelligence, provenance, aggregate data, de-identified, managed care organization, AHCA, or PHI—to open its plain-language definition." /></p>
        <ul className="state-landing-principles" aria-label="DecisionPro operating principles">
          <li><GlossaryText text="Aggregate and de-identified" /></li>
          <li><GlossaryText text="Provenance and limitations visible" /></li>
          <li>Options to examine, not prescriptions</li>
        </ul>
      </section>

      <section className="state-product-grid" aria-label="Available state products">
        {Object.values(PRODUCT_STATES).map((product) => {
          const summary = STATE_SUMMARIES[product.code];
          return (
            <a
              key={product.code}
              className={`state-product-card state-product-${product.code.toLowerCase()}`}
              href={`?state=${product.code}`}
              onClick={(event) => {
                event.preventDefault();
                onSelectState?.(product.code);
              }}
            >
              <span className="state-product-code" aria-hidden="true">{product.code}</span>
              <span className="state-product-copy">
                <small>{summary.eyebrow}</small>
                <strong>{product.brand}</strong>
                <span>{summary.description}</span>
                <ul>
                  {summary.capabilities.map((capability) => <li key={capability}>{capability}</li>)}
                </ul>
                <em>Open {product.name} <span aria-hidden="true">→</span></em>
              </span>
            </a>
          );
        })}
      </section>

      <section className="state-comparison-tile" aria-labelledby="state-comparison-title">
        <div className="state-comparison-mark" aria-hidden="true"><span>FL</span><i>+</i><strong>DPro</strong></div>
        <div>
          <small>New · capability comparison</small>
          <h2 id="state-comparison-title">See how DecisionPro Florida goes beyond the public dashboard</h2>
          <p>Compare public visibility with DPro’s integrated analysis, operational recommendations, accountable workpapers, legislative framing and measured-value controls.</p>
        </div>
        <a href="?compare=FL" onClick={(event) => { event.preventDefault(); onOpenComparison?.(); }}>Explore the comparison <span aria-hidden="true">→</span></a>
      </section>

      <footer className="state-landing-footer">
        <GlossaryText text="DecisionPro is a product of XenoDroid Inc. · Public aggregate evidence only · No PHI" />
      </footer>
    </main>
  );
}
