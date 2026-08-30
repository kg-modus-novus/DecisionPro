import { useEffect, useRef, useState } from 'react';
import {
  OPERATING_LOOP,
  getOperationalIntelligence,
} from '../data/operationalIntelligence.js';
import { PageTitleWithBack } from './ContentBackBar.jsx';
import { GlossaryTerm, GlossaryText } from './GlossaryTerm.jsx';
import { OperationalActionWorkbench } from './OperationalActionWorkbench.jsx';

const SOURCE_GLOSSARY_IDS = {
  CMS_MCPAR_2024: 'mcpar',
  CMS_PROVIDER_DATA: 'provider-data-catalog',
  HHS_OIG_LEIE: 'leie',
  USA_SPENDING: 'usaspending',
  KY_TRANSPARENCY: 'budget-variance',
  KY_OSBD: 'appropriation',
  KY_DMS_CONTRACTS: 'mco',
  KY_OPEN_GIS: 'arcgis-rest',
  FL_AHCA_PLAN: 'ahca',
  FL_AHCA_FINANCIAL: 'ahca',
  FL_AHCA_PRIOR_AUTH: 'prior-authorization',
  FL_AHCA_COMPLIANCE: 'corrective-action-plan',
  FL_ELIGIBILITY_REPORTS: 'ahca',
  FL_FEE_SCHEDULES: 'ahca',
  FL_RESTRICTED_EXPORTS: 'ahca',
};

const STATUS_LABELS = {
  hydrated: 'REAL data hydrated',
  'source-verified': 'Source manifest verified',
  ready: 'API / file ready',
  'source-ready': 'Source ready',
  'source-observed': 'Source observed',
  'adapter-needed': 'Adapter needed',
  catalogued: 'Catalogued',
  context: 'Context only',
  gap: 'Labeled gap',
};

function StatusPill({ status }) {
  return (
    <span className={`ops-status ops-status-${status || 'unknown'}`}>
      <GlossaryText text={STATUS_LABELS[status] || status || 'Unknown'} />
    </span>
  );
}

function SourceLinks({ ids, sources }) {
  const byId = new Map(sources.map((source) => [source.id, source]));
  return (
    <ul className="ops-source-links" aria-label="Evidence sources">
      {ids.map((id) => {
        const source = byId.get(id);
        if (!source) return null;
        return (
          <li key={id}>
            {SOURCE_GLOSSARY_IDS[id] ? (
              <GlossaryTerm id={SOURCE_GLOSSARY_IDS[id]}>{source.label}</GlossaryTerm>
            ) : <GlossaryText text={source.label} />}
            {' · '}
            <a href={source.href} target="_blank" rel="noreferrer">
              Open evidence source ↗
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function OperationalIntelligence({ stateCode = 'KY', onBrowseSources = null }) {
  const model = getOperationalIntelligence(stateCode);
  const { product, snapshot, sources, plays, hydratedSources } = model;
  const hasGoalPortfolio = Boolean(model.goals?.length);
  const [activePage, setActivePage] = useState(hasGoalPortfolio ? 'goals' : 'priorities');
  const sourceTopScrollRef = useRef(null);
  const sourceTableScrollRef = useRef(null);
  const sourceScrollSizerRef = useRef(null);
  const workbenchRef = useRef(null);
  const pageHistoryRef = useRef([]);

  useEffect(() => {
    pageHistoryRef.current = [];
    setActivePage(hasGoalPortfolio ? 'goals' : 'priorities');
  }, [product.code, hasGoalPortfolio]);

  useEffect(() => {
    if (activePage !== 'sources') return undefined;
    const tableWrap = sourceTableScrollRef.current;
    const sizer = sourceScrollSizerRef.current;
    if (!tableWrap || !sizer) return undefined;

    const updateScrollWidth = () => {
      sizer.style.width = `${tableWrap.scrollWidth}px`;
    };
    updateScrollWidth();
    window.addEventListener('resize', updateScrollWidth);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(updateScrollWidth) : null;
    observer?.observe(tableWrap);
    const table = tableWrap.querySelector('table');
    if (table) observer?.observe(table);
    return () => {
      window.removeEventListener('resize', updateScrollWidth);
      observer?.disconnect();
    };
  }, [activePage, product.code, sources.length]);

  const syncSourceTableScroll = (source, targetRef) => {
    const target = targetRef.current;
    if (target && target.scrollLeft !== source.currentTarget.scrollLeft) {
      target.scrollLeft = source.currentTarget.scrollLeft;
    }
  };

  const navigateToPage = (nextPage) => {
    if (nextPage === activePage) return;
    pageHistoryRef.current.push(activePage);
    setActivePage(nextPage);
  };

  const goBackOneScreen = () => {
    const previousPage = pageHistoryRef.current.pop();
    if (previousPage) {
      setActivePage(previousPage);
      return true;
    }
    return workbenchRef.current?.goBackOneScreen?.() || false;
  };

  const pages = [
    { id: hasGoalPortfolio ? 'goals' : 'priorities', label: hasGoalPortfolio ? 'Goals' : 'Operational priorities' },
    { id: 'evidence', label: 'Evidence & Data' },
    { id: 'sources', label: 'Data Sources' },
  ];

  return (
    <main className="main ops-view" data-product-state={product.code}>
      <PageTitleWithBack onBack={goBackOneScreen} backTitle="Go back one screen">
        <div data-walkthrough-target="operational-header">
          <p className="sap-alp-eyebrow"><GlossaryText text={`${product.shortBrand} · Insight to accountable action`} /></p>
          <h2><GlossaryText text="Operational intelligence" /></h2>
          <p className="hint">
            <GlossaryText text="Choose a goal, inspect its evidence, or review the public sources behind the analysis." />
          </p>
        </div>
      </PageTitleWithBack>

      <nav className="ops-page-tabs" role="tablist" aria-label="Operational intelligence pages" data-walkthrough-target="operational-tabs">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            role="tab"
            aria-selected={activePage === page.id}
            aria-controls={`ops-page-${page.id}`}
            id={`ops-tab-${page.id}`}
            onClick={() => navigateToPage(page.id)}
          >
            {page.label}
          </button>
        ))}
      </nav>

      {activePage === 'goals' && hasGoalPortfolio ? (
        <div
          id="ops-page-goals"
          role="tabpanel"
          aria-labelledby="ops-tab-goals"
          className="ops-page-panel ops-page-panel-goals"
          data-walkthrough-target="operational-current-page"
        >
        <OperationalActionWorkbench ref={workbenchRef} goals={model.goals} sources={sources} />
        </div>
      ) : null}

      {activePage === 'evidence' ? (
      <div
        id="ops-page-evidence"
        role="tabpanel"
        aria-labelledby="ops-tab-evidence"
        className="ops-page-panel"
        data-walkthrough-target="operational-current-page"
      >
      <section className="ops-summary" aria-label={`${product.name} operational source summary`}>
        <div>
          <p className="ops-overline"><GlossaryText text="Verified federal managed-care foundation" /></p>
          <h3><GlossaryText text={snapshot.label} /></h3>
          <p><GlossaryText text={snapshot.note} /></p>
          <a href={snapshot.source} target="_blank" rel="noreferrer">
            Open official dataset ↗
          </a>
        </div>
        <dl className="ops-stat-grid">
          <div>
            <dt><GlossaryText text="State rows" /></dt>
            <dd>{snapshot.rows.toLocaleString()}</dd>
          </div>
          <div>
            <dt><GlossaryText text="Question IDs" /></dt>
            <dd>{snapshot.questionIds.toLocaleString()}</dd>
          </div>
          <div>
            <dt><GlossaryText text="Programs" /></dt>
            <dd>{snapshot.programs}</dd>
          </div>
          <div>
            <dt><GlossaryText text="Reporting entities" /></dt>
            <dd>{snapshot.reportingEntities}</dd>
          </div>
        </dl>
        <p className="ops-as-of">
          <GlossaryText text={`${hydratedSources?.metricCount ? 'Hydrated snapshot' : 'Live probe'} ${snapshot.retrievedAt} · public aggregate data`} />
        </p>
      </section>

      {product.code === 'KY' && hydratedSources?.metrics?.length ? (
        <section className="ops-section" aria-labelledby="ops-hydrated-title">
          <header className="ops-section-head">
            <div>
              <p className="ops-overline"><GlossaryText text="Production public-data pipeline" /></p>
              <h3 id="ops-hydrated-title"><GlossaryText text="Hydrated Kentucky operational datasets" /></h3>
              <p>
                <GlossaryText text={`${hydratedSources.sourceCount} sources · ${hydratedSources.metricCount} governed aggregate metrics · generated ${new Date(hydratedSources.generatedAt).toLocaleString()}`} />
              </p>
            </div>
          </header>
          <div className="ops-hydrated-grid">
            {hydratedSources.metrics
              .filter((metric) => [
                'ky-mcpar-reported-overpayments', 'ky-mcpar-min-encounter-timeliness',
                'ky-provider-facilities', 'ky-provider-low-rating',
                'ky-leie-records', 'ky-usaspending-latest-complete-fy', 'ky-hospital-counties', 'ky-hospital-beds',
                'ky-budget-documents', 'ky-contract-documents',
              ].includes(metric.metricId))
              .map((metric) => (
                <article key={metric.metricId}>
                  <span><GlossaryText text={metric.publisher || metric.fromSysId} /></span>
                  <strong>{metric.displayValue}</strong>
                  <p><GlossaryText text={metric.label} /></p>
                  <small><GlossaryText text={`As of ${metric.asOfDate} · ${metric.sourceStatus.replaceAll('_', ' ').toLowerCase()}`} /></small>
                </article>
              ))}
          </div>
        </section>
      ) : null}

      <section className="ops-section" aria-labelledby="ops-loop-title">
        <header className="ops-section-head">
          <div>
            <p className="ops-overline"><GlossaryText text="Operating model" /></p>
            <h3 id="ops-loop-title"><GlossaryText text="Insight is not complete until an outcome is measured" /></h3>
          </div>
        </header>
        <ol className="ops-loop">
          {OPERATING_LOOP.map((step, index) => (
            <li key={step.id}>
              <span>{index + 1}</span>
              <strong><GlossaryText text={step.label} /></strong>
              <p><GlossaryText text={step.text} /></p>
            </li>
          ))}
        </ol>
      </section>

      <section className="ops-section ops-limitations" aria-labelledby="ops-limits-title">
        <div>
          <p className="ops-overline"><GlossaryText text="Honest completion boundary" /></p>
          <h3 id="ops-limits-title"><GlossaryText text="What this version does not claim" /></h3>
        </div>
        <ul>
          {model.limitations.map((item) => <li key={item}><GlossaryText text={item} /></li>)}
        </ul>
      </section>
      </div>
      ) : null}

      {activePage === 'priorities' ? (
      <section
        id="ops-page-priorities"
        role="tabpanel"
        aria-labelledby="ops-tab-priorities"
        className="ops-section ops-page-panel"
      >
        <header className="ops-section-head">
          <div>
            <p className="ops-overline"><GlossaryText text="Operational decision queue" /></p>
            <h3 id="ops-queue-title"><GlossaryText text="Where to investigate and how to close the loop" /></h3>
            <p><GlossaryText text={model.differentiator} /></p>
          </div>
        </header>
        <div className="ops-play-grid">
          {plays.map((play) => (
            <article key={play.id} className="ops-play-card">
              <header>
                <div>
                  <p><GlossaryText text={play.domain} /></p>
                  <h4><GlossaryText text={play.title} /></h4>
                </div>
                <StatusPill status={play.readiness} />
              </header>
              <dl>
                <div>
                  <dt>Signal</dt>
                  <dd><GlossaryText text={play.signal} /></dd>
                </div>
                <div>
                  <dt>Next controlled action</dt>
                  <dd><GlossaryText text={play.nextAction} /></dd>
                </div>
                <div>
                  <dt>Accountable owner</dt>
                  <dd><GlossaryText text={play.owner} /></dd>
                </div>
                <div>
                  <dt>How success is measured</dt>
                  <dd><GlossaryText text={play.validation} /></dd>
                </div>
                <div className="ops-guardrail">
                  <dt>Decision guardrail</dt>
                  <dd><GlossaryText text={play.guardrail} /></dd>
                </div>
              </dl>
              <SourceLinks ids={play.evidence} sources={sources} />
            </article>
          ))}
        </div>
      </section>
      ) : null}

      {activePage === 'sources' ? (
      <div
        id="ops-page-sources"
        role="tabpanel"
        aria-labelledby="ops-tab-sources"
        className="ops-page-panel"
        data-walkthrough-target="operational-current-page"
      >
      <section className="ops-section" aria-labelledby="ops-source-title">
        <header className="ops-section-head ops-section-head-actions">
          <div>
            <p className="ops-overline"><GlossaryText text="Free and public source coverage" /></p>
            <h3 id="ops-source-title"><GlossaryText text="Supported APIs first; governed document adapters second" /></h3>
            <p>
              <GlossaryText text="“Public” and “free” do not mean interchangeable. Each source retains publisher, access method, cadence, permitted use, and limitation metadata." />
            </p>
          </div>
          {product.code === 'KY' && onBrowseSources ? (
            <button
              type="button"
              className="ops-source-catalog-btn"
              onClick={() => onBrowseSources()}
            >
              Open Full Source Catalog
            </button>
          ) : null}
        </header>
        <div className="ops-source-table-shell">
          <div
            ref={sourceTopScrollRef}
            className="ops-source-horizontal-scroll"
            role="region"
            aria-label="Horizontal source table scroll"
            tabIndex="0"
            onScroll={(event) => syncSourceTableScroll(event, sourceTableScrollRef)}
          ><div ref={sourceScrollSizerRef} aria-hidden="true" /></div>
          <div
            ref={sourceTableScrollRef}
            className="ops-source-table-wrap"
            onScroll={(event) => syncSourceTableScroll(event, sourceTopScrollRef)}
          >
            <table className="ops-source-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Access / status</th>
                <th>Operational use</th>
                <th>Limitation</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id}>
                  <td>
                    {SOURCE_GLOSSARY_IDS[source.id] ? (
                      <GlossaryTerm id={SOURCE_GLOSSARY_IDS[source.id]}>{source.label}</GlossaryTerm>
                    ) : <GlossaryText text={source.label} />}
                    {' · '}
                    <a href={source.href} target="_blank" rel="noreferrer">Open official source ↗</a>
                    <small><GlossaryText text={`${source.publisher} · ${source.cadence}`} /></small>
                  </td>
                  <td>
                    <StatusPill status={source.status} />
                    <small><GlossaryText text={source.access} /></small>
                  </td>
                  <td><GlossaryText text={source.use} /></td>
                  <td><GlossaryText text={source.caveat} /></td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      </section>
      </div>
      ) : null}
    </main>
  );
}
