import { useEffect, useId, useRef } from 'react';

/**
 * Modal guide for the current DecisionPro page — overview + annotated schematic.
 */
export function ExplainThisPage({ open, onClose, explain }) {
  const titleId = useId();
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !explain) return null;

  return (
    <div className="explain-overlay" role="presentation" onClick={onClose}>
      <div
        className="explain-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="explain-modal-head">
          <div>
            <p className="explain-eyebrow">Explain this page</p>
            <h2 id={titleId}>{explain.pageName}</h2>
          </div>
          <button type="button" className="explain-close" onClick={onClose} ref={closeRef}>
            Close
          </button>
        </header>

        <div className="explain-modal-body">
          <section className="explain-block">
            <h3>Overall description</h3>
            <p>{explain.overview}</p>
          </section>

          <div className="explain-grid">
            <ExplainList title="What kind of data it displays" items={explain.dataDisplayed} />
            <ExplainList title="Where this data comes from" items={explain.dataSource} />
            <section className="explain-block">
              <h3>Whether it is up to date</h3>
              <p>{explain.upToDate}</p>
            </section>
            <ExplainList
              title="Why it appears in DecisionPro & how it affects decisions"
              items={explain.whyInDecisionPro}
            />
          </div>

          <ExplainList title="How to use this page for decision support" items={explain.howToUse} />

          <section className="explain-block explain-schematic-wrap">
            <h3>Page map with call-outs</h3>
            <p className="hint">
              Sample layout of <strong>{explain.schematic.label}</strong>. Numbers match the call-outs
              below — what each section is called, how to use it alone, and how it fits the rest of
              DecisionPro.
            </p>
            <div className="explain-schematic-row">
              <PageSchematic layout={explain.schematic.layout} sections={explain.schematic.sections} />
              <ol className="explain-callouts">
                {explain.schematic.sections.map((s) => (
                  <li key={s.id}>
                    <span className="explain-callout-num" aria-hidden="true">
                      {s.id}
                    </span>
                    <div>
                      <strong>{s.name}</strong>
                      <p>
                        <em>By itself:</em> {s.alone}
                      </p>
                      <p>
                        <em>In the system:</em> {s.system}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <p className="explain-foot">
            Aggregate / de-identified views · No PHI · Not a prescription
          </p>
        </div>
      </div>
    </div>
  );
}

function ExplainList({ title, items }) {
  return (
    <section className="explain-block">
      <h3>{title}</h3>
      <ul>
        {(items || []).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function CalloutBadge({ n }) {
  return (
    <span className="schematic-badge" aria-hidden="true">
      {n}
    </span>
  );
}

function PageSchematic({ layout, sections }) {
  const byId = Object.fromEntries((sections || []).map((s) => [s.id, s]));

  if (layout === 'blender') {
    return (
      <div className="page-schematic schematic-blender" role="img" aria-label="Blender page schematic">
        <div className="sch-row sch-tabs">
          <CalloutBadge n="1" />
          <span>Focus tabs</span>
        </div>
        <div className="sch-row sch-spine">
          <CalloutBadge n="2" />
          <span>Question spine</span>
        </div>
        <div className="sch-cols">
          <div className="sch-panel">
            <CalloutBadge n="3" />
            <span>Inputs</span>
            <i />
            <i />
            <i />
          </div>
          <div className="sch-panel sch-wide">
            <CalloutBadge n="4" />
            <span>Competition · weights</span>
            <div className="sch-mini-charts">
              <b />
              <b />
            </div>
          </div>
          <div className="sch-panel">
            <CalloutBadge n="5" />
            <span>Win-Win-Win</span>
            <i />
            <i />
          </div>
        </div>
        <SchematicLegend sections={sections} />
      </div>
    );
  }

  if (layout === 'alp') {
    return (
      <div className="page-schematic schematic-alp" role="img" aria-label="Evidence ALP schematic">
        <div className="sch-row">
          <CalloutBadge n="1" />
          <span>Title · actions</span>
        </div>
        <div className="sch-row sch-kpi">
          <CalloutBadge n="2" />
          <span>Filters · KPIs</span>
        </div>
        <div className="sch-row sch-vf">
          <CalloutBadge n="3" />
          <span>Visual Filters</span>
          <div className="sch-vf-cards">
            <b />
            <b />
            <b />
            <b />
          </div>
        </div>
        <div className="sch-cols">
          <div className="sch-panel sch-wide">
            <CalloutBadge n="4" />
            <span>Content chart</span>
            <div className="sch-bars">
              <i style={{ height: '70%' }} />
              <i style={{ height: '45%' }} />
              <i style={{ height: '90%' }} />
              <i style={{ height: '55%' }} />
            </div>
          </div>
          <div className="sch-panel">
            <CalloutBadge n="5" />
            <span>Detail list</span>
            <i />
            <i />
            <i />
          </div>
        </div>
        <SchematicLegend sections={sections} />
      </div>
    );
  }

  if (layout === 'pack') {
    return (
      <div className="page-schematic schematic-pack" role="img" aria-label="Pack page schematic">
        <div className="sch-row">
          <CalloutBadge n="1" />
          <span>Title · disclaimer</span>
        </div>
        <div className="sch-cols sch-wins">
          <div className="sch-panel">
            <CalloutBadge n="2" />
            <span>Budget win</span>
          </div>
          <div className="sch-panel">
            <span>Care win</span>
          </div>
          <div className="sch-panel">
            <span>Political win</span>
          </div>
        </div>
        <div className="sch-row sch-comp">
          <CalloutBadge n="3" />
          <span>Competition view</span>
          <div className="sch-mini-charts">
            <b />
            <b />
          </div>
        </div>
        <div className="sch-row">
          <CalloutBadge n="4" />
          <span>Pack details</span>
        </div>
        <div className="sch-row sch-actions">
          <CalloutBadge n="5" />
          <span>Actions</span>
        </div>
        <SchematicLegend sections={sections} />
      </div>
    );
  }

  if (layout === 'brief') {
    return (
      <div className="page-schematic schematic-brief" role="img" aria-label="Brief page schematic">
        <div className="sch-row">
          <CalloutBadge n="1" />
          <span>Toolbar</span>
        </div>
        <div className="sch-cols">
          <div className="sch-panel">
            <CalloutBadge n="2" />
            <span>Outline · inputs</span>
            <i />
            <i />
            <i />
          </div>
          <div className="sch-panel sch-wide">
            <div className="sch-row sch-tight">
              <CalloutBadge n="3" />
              <span>Header · disclaimer</span>
            </div>
            <div className="sch-row sch-tight sch-comp">
              <CalloutBadge n="4" />
              <span>Competition charts</span>
              <div className="sch-mini-charts">
                <b />
                <b />
              </div>
            </div>
            <div className="sch-row sch-tight">
              <CalloutBadge n="5" />
              <span>Packs · trust · talking points</span>
            </div>
          </div>
        </div>
        <SchematicLegend sections={sections} />
      </div>
    );
  }

  if (layout === 'evidence-index') {
    return (
      <div className="page-schematic schematic-index" role="img" aria-label="Evidence index schematic">
        <div className="sch-row">
          <CalloutBadge n="1" />
          <span>Rooms catalog</span>
        </div>
        <div className="sch-room-grid">
          <b />
          <b />
          <b />
          <b />
          <b />
          <b />
        </div>
        <div className="sch-row">
          <CalloutBadge n="2" />
          <span>Open room → ALP</span>
        </div>
        <SchematicLegend sections={sections} />
      </div>
    );
  }

  // legislation default
  return (
    <div className="page-schematic schematic-law" role="img" aria-label="Law page schematic">
      <div className="sch-row">
        <CalloutBadge n="1" />
        <span>Context strip</span>
        <em>{byId['1']?.name || ''}</em>
      </div>
      <div className="sch-row sch-law-list">
        <CalloutBadge n="2" />
        <span>Instrument list</span>
        <i />
        <i />
        <i />
      </div>
      <div className="sch-row">
        <CalloutBadge n="3" />
        <span>Back to blender</span>
      </div>
      <SchematicLegend sections={sections} />
    </div>
  );
}

function SchematicLegend({ sections }) {
  return (
    <p className="sch-caption">
      Sample page map · {(sections || []).length} call-outs
    </p>
  );
}
