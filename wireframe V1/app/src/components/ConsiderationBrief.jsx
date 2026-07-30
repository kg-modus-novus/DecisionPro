import { useState } from 'react';
import { FOCUS_TABS } from '../data/fixtures.js';
import { radarProfile } from '../lib/blend.js';
import kySeal from '../assets/ky-commonwealth-seal.png';
import { ChartPair } from './ChartPair.jsx';
import { LawCiteLink } from './LegislationObjectPage.jsx';
import { PrimarySourceLinks } from './PrimarySourceLinks.jsx';
import { PageTitleWithBack } from './ContentBackBar.jsx';
import { TrajectoryChart } from './TrajectoryChart.jsx';

const OUTLINE = [
  { id: 's1', n: 1, label: 'Problem statement' },
  { id: 's2', n: 2, label: 'Evidence chain from focus tabs' },
  { id: 's3', n: 3, label: 'Competition summary' },
  { id: 's4', n: 4, label: 'Win-Win-Win option packs examined' },
  { id: 's5', n: 5, label: 'Status-quo trajectory if no change' },
  { id: 's6', n: 6, label: 'Law & pending legislation notes' },
  { id: 's7', n: 7, label: 'Trust & gaps' },
  { id: 's8', n: 8, label: 'Constituent narrative' },
  { id: 's9', n: 9, label: 'Colleague one-pager talking points' },
  { id: 's10', n: 10, label: 'Explicit non-prescriptions disclaimer' },
];

export function ConsiderationBrief({
  brief,
  findings,
  weights,
  onBack,
  onOpenLaw,
  roleEmphasis = null,
}) {
  const [activeSection, setActiveSection] = useState('s1');
  const focusMeta = FOCUS_TABS.filter((t) => (brief.focuses || []).includes(t.id));
  const weightEntries = FOCUS_TABS.map((t) => ({
    ...t,
    weight: brief.weights?.[t.id] || 0,
    included: (brief.focuses || []).includes(t.id) || (brief.weights?.[t.id] || 0) > 0.05,
  }));

  const radar = radarProfile(findings.length ? findings : [], weights);

  function scrollTo(id) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function copyTalkingPoints() {
    const text = (brief.talkingPoints || []).map((t, i) => `${i + 1}. ${t}`).join('\n');
    navigator.clipboard?.writeText(text);
  }

  function copyJson() {
    navigator.clipboard?.writeText(JSON.stringify(brief, null, 2));
  }

  return (
    <main className="main brief-ideated">
      <header className="cb-toolbar" data-walkthrough-target="brief-toolbar">
        <PageTitleWithBack
          actions={
            <div className="cb-toolbar-actions">
              <button type="button" onClick={() => window.print()}>Export PDF</button>
              <button type="button" onClick={copyTalkingPoints}>Export One-pager</button>
              <button type="button" disabled title="Coming soon">Share with caucus</button>
              <button type="button" onClick={copyTalkingPoints}>Copy talking points</button>
            </div>
          }
        >
          <div>
            <h1>Consideration Brief — Export</h1>
            {roleEmphasis ? <p className="hint role-perspective-hint">{roleEmphasis}</p> : null}
          </div>
        </PageTitleWithBack>
      </header>

      <div className="cb-layout" data-walkthrough-target="brief-body">
        <aside className="cb-rail">
          <section className="cb-rail-card">
            <h3>Brief outline</h3>
            <ol>
              {OUTLINE.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={activeSection === item.id ? 'on' : ''}
                    onClick={() => scrollTo(item.id)}
                  >
                    <span>{item.n}</span>
                    {item.label}
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section className="cb-rail-card">
            <h3>Included blender inputs</h3>
            <ul className="cb-inputs">
              {weightEntries.map((item) => (
                <li key={item.id}>
                  <i style={{ background: item.color }} />
                  <div>
                    <strong>{item.label}</strong>
                    <span>Weight: {Math.round(item.weight * 100)}%</span>
                  </div>
                  {item.included ? <em>✓</em> : <em>·</em>}
                </li>
              ))}
            </ul>
            <p className="hint">Blender method: Weighted sum</p>
            <p className="hint">Perspective: Kentucky statewide</p>
          </section>
        </aside>

        <div className="cb-document">
          <header className="cb-doc-head">
            <div className="cb-brand">
              <img
                className="cb-seal-img"
                src={kySeal}
                alt="Seal of the Commonwealth of Kentucky"
                width={92}
                height={92}
              />
              <div className="cb-doc-title">
                <h2>{brief.title || 'Consideration Brief'}</h2>
                <p className="cb-doc-tagline">
                  Aggregate analysis for legislative consideration
                </p>
                <p className="cb-doc-prepared">Prepared by {brief.preparedBy}</p>
              </div>
            </div>
            <dl className="cb-meta">
              <div><dt>Brief ID</dt><dd>{brief.briefId}</dd></div>
              <div><dt>Date</dt><dd>{brief.dateLabel}</dd></div>
              <div><dt>Perspective</dt><dd>{brief.perspective}</dd></div>
              <div><dt>Time horizon</dt><dd>{brief.timeHorizon}</dd></div>
            </dl>
          </header>

          <p className="disclaimer">{brief.disclaimer}</p>
          {brief.trustWarning ? <p className="trust-warn">{brief.trustWarning}</p> : null}

          <div className="cb-grid">
            <section id="s1" className="cb-card">
              <SectionHead n={1} title="Problem statement" />
              <p>{brief.problemStatement}</p>
              {focusMeta.length ? (
                <p className="hint">Focuses in play: {focusMeta.map((f) => f.label).join(' · ')}</p>
              ) : null}
            </section>

            <section id="s2" className="cb-card">
              <SectionHead n={2} title="Evidence chain from focus tabs" />
              {brief.findings.length ? (
                <ul className="cb-evidence">
                  {brief.findings.map((f) => (
                    <li key={f.id || f.title}>
                      <strong>{f.title}</strong>
                      <span>{f.magnitude} · {f.freshness}</span>
                      <em>{f.trustNote}</em>
                      <PrimarySourceLinks
                        sources={f.primarySources}
                        title="Primary sources"
                        className="cb-finding-sources"
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint">No findings blended yet — add inputs in the blender.</p>
              )}
            </section>

            <section id="s3" className="cb-card">
              <SectionHead n={3} title="Competition summary" />
              <ChartPair
                className="cb-comp"
                variant="brief"
                findings={brief.findings}
                radar={radar}
                packs={brief.packs}
              />
            </section>

            <section id="s4" className="cb-card cb-wide">
              <SectionHead n={4} title="Win-Win-Win option packs examined" />
              <div className="cb-table-wrap">
                <table className="cb-table">
                  <thead>
                    <tr>
                      <th>Option pack</th>
                      <th>Core strategy summary</th>
                      <th>Relative net impact</th>
                      <th>Distributional balance</th>
                      <th>Fiscal impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brief.packs.length ? brief.packs.map((p) => (
                      <tr key={p.id || p.title}>
                        <td>
                          <span className={`cb-pack-num n${p.index}`}>{p.index}</span>
                          {p.title}
                        </td>
                        <td>
                          <div>{p.budgetWin}</div>
                          <div>{p.careWin}</div>
                          <div>{p.politicalWin}</div>
                        </td>
                        <td>
                          <span className="cb-stars">{'★'.repeat(p.stars)}{'☆'.repeat(5 - p.stars)}</span>
                          <div className="hint">Score {(p.score * 100).toFixed(0)}</div>
                        </td>
                        <td>{p.distributional}</td>
                        <td>{p.fiscalImpact}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="hint">Blend 2+ findings to unlock packs.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="s5" className="cb-card">
              <SectionHead n={5} title="Status-quo trajectory if no change" />
              <ul className="cb-bullets">
                {(brief.statusQuo || []).map((line) => <li key={line}>{line}</li>)}
              </ul>
              <TrajectoryChart />
            </section>

            <section id="s6" className="cb-card">
              <SectionHead n={6} title="Law & pending legislation notes" />
              <ul className="cb-law">
                {(brief.lawNotes || []).map((item) => (
                  <li key={item.instrumentId || item.ref}>
                    <LawCiteLink instrumentId={item.instrumentId} onOpenLaw={onOpenLaw}>
                      <strong>{item.ref}</strong>
                    </LawCiteLink>
                    <span>{item.note}</span>
                  </li>
                ))}
              </ul>
              <p className="hint">
                Cite links open the legislation object page. Verify against official LRC / General
                Assembly sources.
              </p>
            </section>

            <section id="s7" className="cb-card">
              <SectionHead n={7} title="Trust & gaps" />
              <table className="cb-table compact">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Details</th>
                    <th>Mitigation</th>
                  </tr>
                </thead>
                <tbody>
                  {(brief.trustRows || []).map((row) => (
                    <tr key={row.category}>
                      <td>{row.category}</td>
                      <td>{row.details}</td>
                      <td>{row.mitigation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="cb-trust-foot">
                Overall data quality: <strong>{brief.overallQuality}</strong>
                {' · '}
                Evidence recency: <strong>{brief.evidenceRecency}</strong>
              </p>
            </section>

            <section id="s8" className="cb-card">
              <SectionHead n={8} title="Constituent narrative" />
              <p>{brief.constituentNarrative}</p>
            </section>

            <section id="s9" className="cb-card">
              <SectionHead n={9} title="Colleague one-pager talking points" />
              <ul className="cb-bullets">
                {(brief.talkingPoints || []).map((t) => <li key={t}>{t}</li>)}
              </ul>
            </section>

            <section id="s10" className="cb-card">
              <SectionHead n={10} title="Explicit non-prescriptions disclaimer" />
              <p>
                DecisionPro surfaces examination options and evidence relationships. It does not prescribe
                legislation, allocate blame to providers or members, or assert causal certainty beyond
                what the published evidence supports. Director acceptance remains required for policy
                meaning.
              </p>
              <p className="hint">{brief.disclaimer}</p>
            </section>
          </div>

          <footer className="cb-footer">
            <div>
              <strong>Data freshness</strong>
              <span>Near-current claims mixed with lagged peers per measure freshness</span>
              <em className="ok-pill">Demo up to date</em>
            </div>
            <div>
              <strong>Data owners</strong>
              <span>LRC Analytical Services · Legislative Research Commission</span>
            </div>
            <div>
              <strong>Contact</strong>
              <span>demo@decisionpro.io · (502) 555-0100</span>
            </div>
            <div>
              <strong>Usage note</strong>
              <span>Aggregate / de-identified views only. No PHI.</span>
            </div>
            <button type="button" className="ghost" onClick={copyJson}>Copy brief JSON</button>
          </footer>
        </div>
      </div>
    </main>
  );
}

function SectionHead({ n, title }) {
  return (
    <header className="cb-section-head">
      <span className="cb-num">{n}</span>
      <h3>{title}</h3>
    </header>
  );
}

