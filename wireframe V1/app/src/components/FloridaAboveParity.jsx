import { useMemo, useState } from 'react';
import { FL_OPERATIONAL_SOURCES } from '../data/alp/flOperationalSources.js';
import { FL_OPERATIONAL_GOALS } from '../data/flOperationalGoals.js';
import { GlossaryText } from './GlossaryTerm.jsx';

const analytics = FL_OPERATIONAL_SOURCES.analytics || {};

const ROOM_ANALYTICS = {
  'fl-plan-accountability': { title: 'Plan accountability comparison', dataset: 'mcparEntityCoverage', label: 'entity', value: 'responseRows', valueLabel: 'MCPAR response rows', columns: ['entity', 'program', 'responseRows', 'questions', 'numericResponses'] },
  'fl-prior-authorization': { title: 'Prior authorization plan comparison', dataset: 'priorAuthorizationByPlan', label: 'plan', value: 'requests', valueLabel: 'reported requests', columns: ['plan', 'measure', 'percent', 'events', 'requests'] },
  'fl-enforcement': { title: 'Compliance action comparison', dataset: 'complianceByCategory', label: 'subcategory', value: 'records', valueLabel: 'published records', columns: ['category', 'subcategory', 'records', 'assessed'] },
  'fl-financial': { title: 'Financial evidence inventory', dataset: null, label: 'label', value: 'numericValue', valueLabel: 'published value', columns: ['label', 'displayValue', 'asOfDate', 'sourceStatus'] },
  'fl-facilities': { title: 'County capacity comparison', dataset: 'facilityCapacityByCounty', label: 'county', value: 'beds', valueLabel: 'licensed beds', columns: ['county', 'facilities', 'beds'] },
  'fl-hospital-reporting': { title: 'Hospital reporting coverage', dataset: 'hospitalCountyCoverage', label: 'county', value: 'reportingCells', valueLabel: 'reporting cells', columns: ['county', 'hospitals', 'reportingCells', 'latestQuarter'] },
  'fl-quality': { title: 'Quality source-native review', dataset: null, label: 'label', value: 'numericValue', valueLabel: 'published value', columns: ['label', 'displayValue', 'asOfDate', 'sourceStatus'] },
  'fl-malpractice': { title: 'Malpractice source-native review', dataset: null, label: 'label', value: 'numericValue', valueLabel: 'published value', columns: ['label', 'displayValue', 'asOfDate', 'sourceStatus'] },
};

const LABELS = {
  entity: 'Reporting entity', program: 'Program', responseRows: 'Response rows', questions: 'Question IDs', numericResponses: 'Numeric responses',
  plan: 'Plan', measure: 'Measure', percent: 'Percent', events: 'Events', requests: 'Requests', category: 'Category', subcategory: 'Subcategory',
  records: 'Records', assessed: 'Amount assessed', county: 'County', facilities: 'Facilities', beds: 'Licensed beds', hospitals: 'Hospitals',
  reportingCells: 'Reporting cells', latestQuarter: 'Latest quarter', label: 'Measure', displayValue: 'Value', asOfDate: 'As of', sourceStatus: 'Evidence status',
};

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function download(name, type, text) {
  const href = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = href; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

function asCsv(rows, columns) {
  return [columns.map((key) => csvCell(LABELS[key] || key)).join(','), ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(','))].join('\n');
}

function displayValue(value, key) {
  if (key === 'assessed') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
  if (key === 'percent') return `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
  if (typeof value === 'number') return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return value || '—';
}

function SourceNativePanel({ room, roomSources }) {
  const [sourceId, setSourceId] = useState(roomSources[0]?.fromSysId || '');
  const source = roomSources.find((item) => item.fromSysId === sourceId) || roomSources[0];
  if (!source) return <div className="fl-empty"><strong>No source dashboard is assigned.</strong></div>;
  const embed = `${source.sourcePageUri}?%3Aembed=y&%3AshowVizHome=no&%3AshowAppBanner=false`;
  return (
    <section className="fl-native-panel" aria-label={`${room.title} source-native dashboard`}>
      <div className="fl-filter-row">
        <label>Source dashboard<select value={source.fromSysId} onChange={(event) => setSourceId(event.target.value)}>{roomSources.map((item) => <option key={item.fromSysId} value={item.fromSysId}>{item.label}</option>)}</select></label>
        <a className="fl-primary-link" href={source.sourcePageUri} target="_blank" rel="noreferrer">Open authoritative dashboard in a new tab ↗</a>
      </div>
      <div className="fl-native-boundary"><strong>Source-native parity layer.</strong> This live AHCA view preserves publisher-provided filters, comparisons, downloads and detail. DecisionPro does not intercept restricted exports or represent the embedded view as a DecisionPro-owned source.</div>
      <iframe className="fl-native-frame" src={embed} title={`${source.label} — Florida AHCA source-native dashboard`} loading="lazy" />
      <p className="fl-boundary">If the publisher blocks framing or a browser privacy policy prevents loading, use the authoritative-dashboard link above. The DecisionPro analysis remains available in the other tabs.</p>
    </section>
  );
}

export function FloridaEvidenceExplorer({ room, roomSources, roomMetrics, roomGaps }) {
  const spec = ROOM_ANALYTICS[room.id] || ROOM_ANALYTICS['fl-financial'];
  const sourceRows = spec.dataset ? analytics[spec.dataset] || [] : roomMetrics;
  const [tab, setTab] = useState('analysis');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('desc');
  const rows = useMemo(() => [...sourceRows]
    .filter((row) => !query || JSON.stringify(row).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (Number(b[spec.value] || 0) - Number(a[spec.value] || 0)) * (sort === 'desc' ? 1 : -1)), [sourceRows, query, sort, spec.value]);
  const max = Math.max(1, ...rows.map((row) => Number(row[spec.value] || 0)));
  const report = {
    generatedAt: new Date().toISOString(), room: room.title, evidenceClass: FL_OPERATIONAL_SOURCES.loadClass,
    filters: { query: query || 'All', sort }, sources: roomSources.map((item) => ({ id: item.fromSysId, label: item.label, status: item.status, sourcePageUri: item.sourcePageUri })),
    metrics: roomMetrics, analyticalRows: rows, gaps: roomGaps,
    decisionBoundary: 'Aggregate decision support. Validate against the owning source and authorized records before action.',
  };
  return (
    <section className="fl-explorer" data-walkthrough-target="fl-evidence-explorer">
      <div className="fl-subtabs" role="tablist" aria-label={`${room.title} workspace views`}>
        {[['analysis', 'DPro analysis'], ['source', 'Source-native dashboard'], ['report', 'Integrated report']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === 'source' ? <SourceNativePanel room={room} roomSources={roomSources} /> : null}
      {tab === 'analysis' ? <>
        <div className="fl-section-title"><div><p className="sap-alp-eyebrow">Interactive analytical layer</p><h3>{spec.title}</h3><p>Filter and rank normalized public aggregates, then open the source-native view to reconcile the result.</p></div><button type="button" onClick={() => download(`decisionpro-fl-${room.id}.csv`, 'text/csv', asCsv(rows, spec.columns))}>Download filtered CSV</button></div>
        <div className="fl-filter-row"><label>Find a row<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Plan, county, program or category" /></label><label>Order<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="desc">Highest first</option><option value="asc">Lowest first</option></select></label><div><strong>{rows.length.toLocaleString()}</strong><span>matching aggregate rows</span></div></div>
        {rows.length ? <><div className="fl-bar-chart" aria-label={`${spec.title} chart`}>{rows.slice(0, 12).map((row, index) => <div className="fl-bar-row" key={`${row[spec.label]}-${index}`}><span>{row[spec.label] || 'Not specified'}</span><div><i style={{ width: `${Math.max(2, (Number(row[spec.value] || 0) / max) * 100)}%` }} /></div><strong>{displayValue(row[spec.value], spec.value)}</strong></div>)}</div><div className="fl-analytics-table-wrap"><table className="fl-analytics-table"><thead><tr>{spec.columns.map((key) => <th key={key}><GlossaryText text={LABELS[key] || key} /></th>)}</tr></thead><tbody>{rows.slice(0, 100).map((row, index) => <tr key={`${row[spec.label]}-${index}`}>{spec.columns.map((key) => <td key={key}>{displayValue(row[key], key)}</td>)}</tr>)}</tbody></table></div></> : <div className="fl-empty"><strong>No normalized rows are promoted for this source.</strong><p>Use Source-native dashboard for the complete publisher-authorized public interaction. DecisionPro keeps this analytical layer empty rather than fabricating parity.</p></div>}
      </> : null}
      {tab === 'report' ? <section className="fl-integrated-report"><div className="fl-section-title"><div><p className="sap-alp-eyebrow">Full-spectrum reporting</p><h3>{room.title} decision packet</h3><p>One export contains evidence, filters, provenance, gaps and the decision boundary.</p></div><button type="button" onClick={() => download(`decisionpro-fl-${room.id}-report.json`, 'application/json', JSON.stringify(report, null, 2))}>Download governed report</button></div><div className="fl-report-grid"><article><strong>{roomMetrics.length}</strong><span>published metrics</span></article><article><strong>{rows.length}</strong><span>filtered analytical rows</span></article><article><strong>{roomSources.length}</strong><span>source domains</span></article><article><strong>{roomGaps.length}</strong><span>explicit gaps</span></article></div><h4>Recommended reviewer sequence</h4><ol><li>Confirm the period, definition and source permission shown in this packet.</li><li>Reconcile the normalized signal against the source-native dashboard.</li><li>Open Operational Intelligence and select the matching quantified opportunity.</li><li>Assign an owner, due date, status and realized-value measure before implementation.</li></ol></section> : null}
    </section>
  );
}

const SCORE_COMPONENTS = {
  'optimize-spending': [86, 72, 58, 80], 'improve-access': [78, 82, 66, 76], 'strengthen-accountability': [84, 78, 74, 82],
  'provider-integrity': [76, 74, 68, 70], 'hospital-reporting': [72, 86, 82, 62], 'trend-planning': [80, 76, 70, 74],
};

function portfolioRows() {
  return FL_OPERATIONAL_GOALS.flatMap((goal) => goal.cases.flatMap((decisionCase) => decisionCase.actions.map((action) => ({ goal: goal.label, caseTitle: decisionCase.title, ...action }))));
}

export function FloridaDecisionWorkspace({ kind, onOpenOperational, onOpenRoom }) {
  const labels = { blender: ['Consideration Blender', 'Compare Florida opportunities across value, access, evidence and implementation effort.'], pack: ['Win-Win-Win Pack', 'A review package balancing people, program operations and public value.'], brief: ['Consideration Brief', 'A decision-ready Florida brief with evidence, assumptions, options and accountability.'], legislation: ['Legislative Analysis', 'Connect operational evidence to oversight questions and possible policy levers without presenting legal advice.'] };
  const [weights, setWeights] = useState({ impact: 35, evidence: 30, feasibility: 20, urgency: 15 });
  const [tracker, setTracker] = useState(() => Object.fromEntries(portfolioRows().map((row) => [row.id, { status: 'Not started', owner: row.owner, due: '', realized: '' }])));
  const ranked = useMemo(() => FL_OPERATIONAL_GOALS.map((goal) => {
    const [impact, evidence, feasibility, urgency] = SCORE_COMPONENTS[goal.id] || [70, 70, 70, 70];
    const score = (impact * weights.impact + evidence * weights.evidence + feasibility * weights.feasibility + urgency * weights.urgency) / 100;
    return { ...goal, score: Math.round(score), components: { impact, evidence, feasibility, urgency } };
  }).sort((a, b) => b.score - a.score), [weights]);
  const actions = portfolioRows();
  const updateTracker = (id, field, value) => setTracker((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  const exportRows = actions.map((row) => ({ goal: row.goal, action: row.title, modeledBenefit: row.opportunity?.absoluteValue || '', improvement: row.opportunity?.improvementValue || '', status: tracker[row.id]?.status, owner: tracker[row.id]?.owner, due: tracker[row.id]?.due, realizedValue: tracker[row.id]?.realized, guardrail: row.guardrail }));
  const [title, subtitle] = labels[kind] || labels.blender;
  return <>
    <section className="fl-decision-intro"><p className="sap-alp-eyebrow">DecisionPro Florida · full-spectrum reporting</p><h3>{title} workspace</h3><p>{subtitle}</p><div className="fl-report-grid"><article><strong>{FL_OPERATIONAL_SOURCES.sourceCount + FL_OPERATIONAL_SOURCES.federalSourceCount}</strong><span>governed sources</span></article><article><strong>{FL_OPERATIONAL_SOURCES.datasetCount}</strong><span>loaded datasets</span></article><article><strong>{FL_OPERATIONAL_GOALS.length}</strong><span>goal portfolios</span></article><article><strong>{actions.length}</strong><span>accountable actions</span></article></div></section>
    {kind === 'blender' ? <section className="fl-blender-workspace"><div className="fl-section-title"><div><h3>Decision-weighted opportunity ranking</h3><p>Weights change review order—not evidence, observed values or expected outcomes.</p></div></div><div className="fl-weight-grid">{Object.entries(weights).map(([key, value]) => <label key={key}><span>{key} <strong>{value}%</strong></span><input type="range" min="0" max="60" value={value} onChange={(event) => setWeights((current) => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}</div><div className="fl-ranked-goals" data-walkthrough-target="blender-findings">{ranked.map((goal, index) => <article key={goal.id}><span>Review #{index + 1}</span><strong>{goal.score}</strong><h3>{goal.label}</h3><p>{goal.objective}</p><dl>{Object.entries(goal.components).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><button type="button" onClick={onOpenOperational}>Open quantified opportunities →</button></article>)}</div></section> : null}
    {kind === 'pack' ? <section className="fl-win-pack"><div className="fl-win-grid"><article><h3>People</h3><p>Validate access and administrative-friction signals before choosing a remedy.</p><strong>{ranked.find((goal) => goal.id === 'improve-access')?.leadValue}</strong></article><article><h3>Program operations</h3><p>Put every source, gap, owner and review status on one accountable cadence.</p><strong>{actions.length} actions</strong></article><article><h3>Public value</h3><p>Reconcile assessed or modeled value before claiming savings or avoided cost.</p><strong>{ranked.find((goal) => goal.id === 'optimize-spending')?.leadValue}</strong></article></div></section> : null}
    {kind === 'brief' ? <section className="fl-brief"><h3>Executive decision brief</h3><p><b>Decision:</b> Choose the next Florida evidence-to-action tranche using the ranked goals and governed gaps.</p><p><b>Evidence:</b> {FL_OPERATIONAL_SOURCES.datasetCount} datasets and {FL_OPERATIONAL_SOURCES.metricCount} aggregate metrics across AHCA and CMS.</p><p><b>Key limitation:</b> Quality Initiatives and Malpractice remain publisher-restricted; parameterized plan-quarter and hospital-financial values remain source-native until reconciled.</p><p><b>Recommended first move:</b> Approve one plan-period identity and definition crosswalk, then run the highest-ranked action through the tracker below.</p></section> : null}
    {kind === 'legislation' ? <section className="fl-legislative-grid">{ranked.map((goal) => <article key={goal.id}><span>{goal.readiness}</span><h3>{goal.label}</h3><p><b>Oversight question:</b> {goal.question}</p><p><b>Possible lever:</b> Reporting definitions, budget proviso, contract oversight, audit request or bounded pilot—verify authority before use.</p><p><b>Evidence boundary:</b> {goal.confidence}</p><button type="button" onClick={onOpenOperational}>Open evidence and accountable actions →</button></article>)}</section> : null}
    <section className="fl-action-tracker" data-walkthrough-target={kind === 'blender' ? 'blender-spine' : undefined}><div className="fl-section-title"><div><p className="sap-alp-eyebrow">Realized-value control</p><h3>Florida action and benefit tracker</h3><p>Modeled benefit remains separate from reviewer-entered realized value.</p></div><button type="button" onClick={() => download('decisionpro-fl-action-portfolio.csv', 'text/csv', asCsv(exportRows, Object.keys(exportRows[0] || {})))}>Download action portfolio</button></div><div className="fl-analytics-table-wrap"><table className="fl-analytics-table"><thead><tr><th>Goal / action</th><th>Modeled benefit</th><th>Status</th><th>Accountable owner</th><th>Due</th><th>Realized value</th></tr></thead><tbody>{actions.map((row) => <tr key={row.id}><td><strong>{row.goal}</strong><small>{row.title}</small></td><td>{row.opportunity?.absoluteValue || 'Not modeled'}<small>{row.opportunity?.caveat}</small></td><td><select value={tracker[row.id]?.status} onChange={(event) => updateTracker(row.id, 'status', event.target.value)}><option>Not started</option><option>Investigating</option><option>Authorized</option><option>Implemented</option><option>Measured</option><option>Closed</option></select></td><td><textarea value={tracker[row.id]?.owner} onChange={(event) => updateTracker(row.id, 'owner', event.target.value)} aria-label={`${row.title} accountable owner`} /></td><td><input type="date" value={tracker[row.id]?.due} onChange={(event) => updateTracker(row.id, 'due', event.target.value)} aria-label={`${row.title} due date`} /></td><td><input value={tracker[row.id]?.realized} onChange={(event) => updateTracker(row.id, 'realized', event.target.value)} placeholder="Enter after measurement" aria-label={`${row.title} realized value`} /></td></tr>)}</tbody></table></div><p className="fl-boundary">Session-only aggregate planning workspace. Do not enter PHI, person-level records, credentials, or unverified allegations.</p></section>
    <section className="fl-decision-actions"><button type="button" onClick={() => onOpenRoom('fl-plan-accountability')}>Open supporting Evidence Room</button><button type="button" onClick={onOpenOperational}>Review quantified opportunities</button></section>
  </>;
}
