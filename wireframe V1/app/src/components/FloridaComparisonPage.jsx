import { FL_OPERATIONAL_SOURCES } from '../data/alp/flOperationalSources.js';
import { FUNDING_RESILIENCE_ROOM, FUNDING_RESILIENCE_SOURCE_IDS, FUNDING_RESILIENCE_TYPES } from '../data/alp/fundingResilienceRoom.js';

const uniqueCapabilities = [
  ['Federal award-cliff calendar', 'Which federally funded Medicaid-adjacent capacity has an award expiring soon, and where funding is concentrated in a single tracked stream.'],
  ['Organization identity crosswalk', 'Links UEI, EIN, NPI, and facility/provider IDs across nine federal sources — exact matches and human-review candidates kept visibly separate, never merged.'],
  ['Nonprofit & facility financial-resilience signals', 'Liquidity and grant-dependency ratios from IRS Form 990 filings, and Medicare cost-report margin signals from CMS HCRIS — organization-level only, never a distress finding.'],
  ['Common-ownership network tracing', 'Facilities under shared ownership or control, traced through CMS ownership filings — a review candidate for coordination context, never itself a finding.'],
  ['Sub-award funding-flow graph', 'Where prime federal awards actually flow once passed to sub-recipients, with identity confidence labeled on every edge.'],
  ['Waiver & grant funding horizon', "Section 1115 demonstration expiration dates and posted deliverables, plus open federal grant opportunities — each citing its source document and retrieval date."],
];

const rows = [
  ['Public reach', 'Eleven public Florida health-care dashboard domains', 'One governed catalogue connecting all eleven AHCA domains plus federal managed-care evidence'],
  ['Interactive review', 'Publisher-native filters, comparisons, detail and downloads', 'Preserves the source-native experience and adds normalized search, sorting, charts and cross-source rooms'],
  ['Evidence governance', 'Definitions and context remain with each publisher dashboard', 'Adds provenance, load history, content hashes, period labels, limitations and explicit Gap objects'],
  ['Opportunity discovery', 'Reviewers interpret individual dashboard signals', 'Six operational goal portfolios surface quantified opportunities with confidence and calculation boundaries'],
  ['From insight to action', 'Public reporting supports monitoring and investigation', 'Connects inputs to transformations, accountable owners, due dates, workpapers and review status'],
  ['Decision reporting', 'Dashboard- and export-specific views', 'Integrated room reports, consideration packs, executive briefs and legislative oversight framing'],
  ['Benefit accountability', 'No cross-dashboard realization workflow is assumed', 'Separates modeled benefit from reviewer-entered realized value and implementation status'],
  ['Restricted exports', 'Some public views disable or parameterize export', 'Keeps the authoritative source-native interaction, labels the ingestion boundary and never fabricates parity'],
];

const journey = [
  ['01', 'Observe', 'Open the public evidence and see the publisher’s own interaction.'],
  ['02', 'Connect', 'Compare permitted aggregates across plan, county, facility, program and period.'],
  ['03', 'Prioritize', 'Rank quantified opportunities by impact, evidence, feasibility and urgency.'],
  ['04', 'Act', 'Assign an owner, due date, workpaper and review disposition.'],
  ['05', 'Measure', 'Record realized value separately from the original model or planning estimate.'],
];

export function FloridaComparisonPage({ onBack, onOpenFlorida, onOpenKentucky }) {
  const governedSources = FL_OPERATIONAL_SOURCES.sourceCount + FL_OPERATIONAL_SOURCES.federalSourceCount;
  const flFundingResilience = FUNDING_RESILIENCE_ROOM.byState.FL;
  return (
    <main className="main comparison-page">
      <section className="comparison-hero">
        <button type="button" className="comparison-back" onClick={onBack}>← DecisionPro home</button>
        <div className="comparison-hero-grid">
          <div>
            <p className="comparison-kicker">DecisionPro Florida · public evidence to accountable action</p>
            <h1>Florida already has public dashboards.<br /><span>DecisionPro makes the evidence operational.</span></h1>
            <p className="comparison-lede">DPro-FL preserves Florida AHCA’s authoritative public experience, connects legally and technically accessible evidence, and adds the workflow needed to turn a signal into a reviewable decision and a measurable result.</p>
            <div className="comparison-ctas">
              <button type="button" className="comparison-primary" onClick={onOpenFlorida}>Explore DecisionPro Florida →</button>
              <a href="#comparison-matrix">See the capability comparison</a>
            </div>
          </div>
          <div className="comparison-orbit" aria-label="DecisionPro evidence-to-action operating model">
            <div className="comparison-core"><small>DecisionPro</small><strong>Evidence<br />→ Action</strong><span>with accountability</span></div>
            <span className="orbit-chip orbit-one">Public data</span>
            <span className="orbit-chip orbit-two">Analysis</span>
            <span className="orbit-chip orbit-three">Owners</span>
            <span className="orbit-chip orbit-four">Measured value</span>
          </div>
        </div>
        <div className="comparison-stats" aria-label="DecisionPro Florida coverage">
          <article><strong>11</strong><span>AHCA dashboard domains connected</span></article>
          <article><strong>{governedSources}</strong><span>governed source entries</span></article>
          <article><strong>{FL_OPERATIONAL_SOURCES.datasetCount}</strong><span>retained datasets</span></article>
          <article><strong>9</strong><span>Florida Evidence Rooms</span></article>
          <article><strong>6</strong><span>operational goal portfolios</span></article>
        </div>
      </section>

      <section className="comparison-positioning">
        <div><p className="comparison-kicker">The distinction</p><h2>Visibility is essential.<br />Operational follow-through creates value.</h2></div>
        <div className="comparison-position-cards">
          <article><span>Florida public dashboards</span><h3>Authoritative public visibility</h3><p>Publisher-controlled views expose public program, provider, facility, quality, financial and compliance information with their native definitions and interactions.</p></article>
          <div className="comparison-plus">+</div>
          <article className="is-dpro"><span>DecisionPro Florida</span><h3>Integrated decision operations</h3><p>Governed evidence is connected to analytical rooms, quantified opportunities, workpapers, owners, oversight questions and realized-value measurement.</p></article>
        </div>
      </section>

      <section className="comparison-unique" aria-labelledby="comparison-unique-title">
        <header>
          <p className="comparison-kicker">Beyond parity — new capability</p>
          <h2 id="comparison-unique-title">Six signals AHCA's own dashboards don't publish at all</h2>
          <p>
            Everything above extends data Florida already makes public. The Funding & Resilience Evidence
            Room is different: it is built from {FUNDING_RESILIENCE_SOURCE_IDS.length} federal sources —
            USAspending, SAM.gov, IRS filings, CMS cost reports and ownership filings, and CMS/Grants.gov
            waiver and grant data — assembled into {FUNDING_RESILIENCE_TYPES.length} signal types with no
            Florida-dashboard equivalent. Currently {(flFundingResilience?.summary.totalItems || 0).toLocaleString()} rows
            loaded for Florida, every one a labeled review candidate, never a finding.
          </p>
        </header>
        <div className="comparison-unique-grid">
          {uniqueCapabilities.map(([title, copy]) => (
            <article key={title}><h3>{title}</h3><p>{copy}</p></article>
          ))}
        </div>
      </section>

      <section className="comparison-matrix-section" id="comparison-matrix">
        <header><p className="comparison-kicker">Side-by-side capability view</p><h2>Everything public stays reachable. DecisionPro adds the decision layer.</h2><p>This comparison describes product capabilities, not a claim that DecisionPro owns, replaces or can export every publisher-controlled dataset.</p></header>
        <div className="comparison-table-wrap">
          <table className="comparison-table">
            <thead><tr><th>Capability</th><th>Florida public dashboard experience</th><th>DecisionPro Florida above-parity layer</th></tr></thead>
            <tbody>{rows.map(([capability, florida, dpro]) => <tr key={capability}><th>{capability}</th><td>{florida}</td><td><span className="comparison-check">✓</span>{dpro}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="comparison-journey">
        <header><p className="comparison-kicker">One connected operating loop</p><h2>From a published signal to a defensible result</h2></header>
        <div className="comparison-journey-grid">{journey.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="comparison-proof">
        <div><p className="comparison-kicker">Built for credible public-sector analysis</p><h2>Strong claims require strong boundaries.</h2><p>DPro-FL keeps observed facts, modeled opportunities, recommendations and realized outcomes distinct. Export-disabled or unreconciled content remains a visible Gap and stays available through the authoritative source-native dashboard.</p></div>
        <ul><li>No PHI or person-level Medicaid records</li><li>Source ownership and limitations stay visible</li><li>Modeled benefit is not labeled realized savings</li><li>Publisher restrictions are honored on every refresh</li></ul>
      </section>

      <section className="comparison-final-cta">
        <p className="comparison-kicker">See the operating model</p>
        <h2>Move beyond observing the dashboard.<br />Build the accountable next step.</h2>
        <div className="comparison-ctas"><button type="button" className="comparison-primary" onClick={onOpenFlorida}>Open DecisionPro Florida →</button><button type="button" className="comparison-secondary" onClick={onOpenKentucky}>Explore DecisionPro Kentucky</button></div>
        <small>DecisionPro is a product of XenoDroid Inc. Florida AHCA remains the source of record for its published dashboards.</small>
      </section>
    </main>
  );
}
