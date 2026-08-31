import { FL_OPERATIONAL_SOURCES } from '../data/alp/flOperationalSources.js';
import { FL_SOURCE_HEALTH } from '../data/flOperationalGoals.js';
import { PageTitleWithBack } from './ContentBackBar.jsx';
import { GlossaryText } from './GlossaryTerm.jsx';
import { FloridaDecisionWorkspace, FloridaEvidenceExplorer } from './FloridaAboveParity.jsx';

export const FL_EVIDENCE_ROOMS = [
  { id: 'fl-plan-accountability', title: 'Plan Accountability', subtitle: 'Performance, targets, complaints, finance and contract actions', sourceIds: ['FL_AHCA_HPT', 'FL_AHCA_FINANCIAL', 'FL_AHCA_COMPLIANCE', 'CMS_MCPAR'] },
  { id: 'fl-prior-authorization', title: 'Prior Authorization', subtitle: 'Approval, denial, appeals, extensions and decision time', sourceIds: ['FL_AHCA_PRIORAUTH'] },
  { id: 'fl-enforcement', title: 'Compliance & Enforcement', subtitle: 'Corrective actions, liquidated damages, sanctions, assessed amounts and exclusion aggregates', sourceIds: ['FL_AHCA_COMPLIANCE', 'HHS_OIG_LEIE'] },
  { id: 'fl-financial', title: 'Financial & Budget', subtitle: 'Managed-care, hospital, enrollment, federal award and published rate context with explicit grain limits', sourceIds: ['FL_AHCA_FINANCIAL', 'FL_AHCA_HOSPITAL_FINANCIAL', 'FL_ELIGIBILITY_REPORTS', 'FL_FEE_SCHEDULES', 'USA_SPENDING', 'CMS_MCPAR'] },
  { id: 'fl-facilities', title: 'Facilities & Access', subtitle: 'Licensed beds, provider/owner changes, PACE and county eligibility by geography', sourceIds: ['FL_AHCA_BEDS', 'FL_AHCA_PROVIDERS', 'FL_AHCA_PACE', 'FL_ELIGIBILITY_REPORTS', 'CMS_PROVIDER_DATA'] },
  { id: 'fl-hospital-reporting', title: 'Hospital Reporting', subtitle: 'Hospital-quarter reporting coverage and county expense context', sourceIds: ['FL_AHCA_IMMIGRATION'] },
  { id: 'fl-quality', title: 'Quality Initiatives', subtitle: 'Rendered reference with publisher export restriction clearly labeled', sourceIds: ['FL_AHCA_QUALITY'] },
  { id: 'fl-malpractice', title: 'Malpractice Claims', subtitle: 'Rendered reference with publisher export restriction clearly labeled', sourceIds: ['FL_AHCA_MALPRACTICE'] },
  { id: 'funding-resilience', title: 'Funding & Resilience', subtitle: 'Federal award cliffs, identity crosswalk, nonprofit and facility resilience, ownership, sub-awards, waiver/grant horizon (state-neutral KY+FL)', sourceIds: ['USA_SPENDING', 'SAM_ENTITY', 'IRS_EO_BMF', 'NPPES', 'IRS_990_EXTRACT', 'CMS_HCRIS', 'CMS_OWNERSHIP', 'CMS_1115_DEMO', 'GRANTS_GOV'] },
];

const metrics = FL_OPERATIONAL_SOURCES.metrics || [];
const sources = [...(FL_OPERATIONAL_SOURCES.federalSources || []), ...(FL_OPERATIONAL_SOURCES.sources || [])];
const datasets = FL_OPERATIONAL_SOURCES.datasets || [];
const gaps = FL_OPERATIONAL_SOURCES.gaps || [];

function SourceStatus({ source }) {
  const state = source?.status === 'REAL data hydrated' ? 'ready' : source?.status === 'GAP' ? 'gap' : 'warn';
  return <span className={`fl-status fl-status-${state}`}>{source?.status || 'Not available'}</span>;
}

export function floridaSourceLabel(item) {
  return item?.publisher === 'Florida Agency for Health Care Administration'
    ? 'Florida AHCA'
    : item?.publisher || 'Authoritative publisher';
}

function MetricCard({ item }) {
  return (
    <article className="fl-kpi-card">
      <span>{item.publisher || item.fromSysId}</span>
      <strong>{item.displayValue}</strong>
      <h4><GlossaryText text={item.label} /></h4>
      <p><GlossaryText text={`As of ${item.asOfDate || 'source record'} · ${item.unit}`} /></p>
      <a href={item.sourcePageUri} target="_blank" rel="noreferrer">Open {floridaSourceLabel(item)} source ↗</a>
    </article>
  );
}

export function FloridaRoleHome({ roleProfile, onOpenOperational, onOpenRoom, onBrowseSources }) {
  const featured = metrics.slice(0, 6);
  return (
    <main className="main fl-workspace" data-walkthrough-target="role-home-page">
      <section className="fl-hero" data-walkthrough-target="role-home-header">
        <p className="sap-alp-eyebrow">DecisionPro Florida · {roleProfile?.shortLabel || 'Decision maker'} perspective</p>
        <h2>Turn Florida’s public health-care dashboards into accountable action</h2>
        <p>DecisionPro joins permitted AHCA and federal evidence across plan performance, prior authorization, finance, facilities, PACE, hospital reporting and compliance—while keeping publisher-restricted domains visible as explicit gaps.</p>
        <div className="fl-hero-stats">
          <div><strong>{FL_SOURCE_HEALTH.hydrated}</strong><span>AHCA domains hydrated</span></div>
          <div><strong>{FL_OPERATIONAL_SOURCES.datasetCount}</strong><span>governed public datasets</span></div>
          <div><strong>{FL_SOURCE_HEALTH.gaps}</strong><span>explicit gaps / review items</span></div>
          <div><strong>6</strong><span>operational goal portfolios</span></div>
        </div>
      </section>
      <section data-walkthrough-target="role-home-priorities">
        <div className="fl-section-title"><div><p className="sap-alp-eyebrow">What you can get from this page</p><h3>Current Florida decision signals</h3></div><button type="button" onClick={onOpenOperational}>Open Operational Intelligence →</button></div>
        <div className="fl-kpi-grid">{featured.map((item) => <MetricCard key={item.metricId} item={item} />)}</div>
      </section>
      <section data-walkthrough-target="role-home-rooms">
        <div className="fl-section-title"><div><p className="sap-alp-eyebrow">Evidence rooms</p><h3>Trace every signal to its source, period and limitation</h3></div></div>
        <div className="fl-room-grid">{FL_EVIDENCE_ROOMS.map((room) => <button type="button" key={room.id} onClick={() => onOpenRoom(room.id)} data-walkthrough-target={`role-home-room-${room.id}`}><strong>{room.title}</strong><span>{room.subtitle}</span><small>Open governed evidence →</small></button>)}</div>
      </section>
      <section data-walkthrough-target="role-home-actions">
        <div className="fl-section-title"><div><p className="sap-alp-eyebrow">Trust boundary</p><h3>What is loaded and what remains unavailable</h3></div><button type="button" onClick={() => onBrowseSources(null)}>Review Authoritative Sources →</button></div>
        <p className="fl-boundary">Florida AHCA remains the source of record. DecisionPro uses permitted exports for reference with attribution, does not train models on AHCA content, does not redistribute raw files as a standalone product, and does not infer person-level facts.</p>
      </section>
    </main>
  );
}

export function FloridaEvidenceWorkspace({ activeRoomId, onOpenRoom }) {
  const room = FL_EVIDENCE_ROOMS.find((item) => item.id === activeRoomId);
  if (!room) return (
    <main className="main fl-workspace">
      <div data-walkthrough-target="evidence-index-header"><PageTitleWithBack><div><p className="sap-alp-eyebrow">Florida governed evidence</p><h2>Evidence Rooms</h2><p>Open a room to inspect aggregate metrics, retained datasets, publisher status, citations and gaps.</p></div></PageTitleWithBack></div>
      <div className="fl-room-grid" data-walkthrough-target="evidence-index-grid">{FL_EVIDENCE_ROOMS.map((item) => <button type="button" key={item.id} onClick={() => onOpenRoom(item.id)}><strong>{item.title}</strong><span>{item.subtitle}</span><small>{item.sourceIds.length} source domain{item.sourceIds.length === 1 ? '' : 's'} →</small></button>)}</div>
    </main>
  );
  const roomSources = sources.filter((item) => room.sourceIds.includes(item.fromSysId));
  const roomMetrics = metrics.filter((item) => room.sourceIds.includes(item.fromSysId));
  const roomDatasets = datasets.filter((item) => room.sourceIds.includes(item.fromSysId));
  const roomGaps = gaps.filter((item) => roomSources.some((sourceItem) => sourceItem.sourcePageUri === item.sourcePageUri) || room.sourceIds.some((id) => item.gapId.includes(id)));
  return (
    <main className="main fl-workspace" data-walkthrough-target="alp-analytical-header">
      <PageTitleWithBack><div><p className="sap-alp-eyebrow">Florida Evidence Room</p><h2>{room.title}</h2><p>{room.subtitle}</p></div></PageTitleWithBack>
      <section className="fl-room-summary" data-walkthrough-target="alp-visual-filters"><div><strong>{roomMetrics.length}</strong><span>aggregate metrics</span></div><div><strong>{roomDatasets.length}</strong><span>retained datasets</span></div><div><strong>{roomSources.filter((item) => item.exportAllowed).length}</strong><span>export-permitted sources</span></div><div><strong>{roomGaps.length}</strong><span>explicit gaps</span></div></section>
      <section data-walkthrough-target="alp-content"><div className="fl-section-title"><div><p className="sap-alp-eyebrow">Observed public evidence</p><h3>Current aggregate results</h3></div></div>{roomMetrics.length ? <div className="fl-kpi-grid">{roomMetrics.map((item) => <MetricCard key={item.metricId} item={item} />)}</div> : <div className="fl-empty"><strong>No data promoted from this workbook</strong><p>The publisher allows the rendered public view but currently disables data export. DecisionPro preserves this as a visible gap instead of scraping or fabricating a result.</p></div>}</section>
      <FloridaEvidenceExplorer room={room} roomSources={roomSources} roomMetrics={roomMetrics} roomGaps={roomGaps} />
      <section className="fl-source-lineage" data-walkthrough-target="alp-lineage"><h3>Source lineage and permissions</h3>{roomSources.map((item) => <article key={item.fromSysId}><div><strong>{item.label}</strong><SourceStatus source={item} /></div><p>{item.attribution || 'Source: Florida AHCA. Reference use only.'}</p><p>Workbook published: {item.workbookLastPublishedAt || 'not reported'} · Export: {item.exportAllowed === true ? 'permitted at refresh' : item.exportAllowed === false ? 'disabled by publisher' : 'not verified'}</p><a href={item.sourcePageUri} target="_blank" rel="noreferrer">Open source-of-record dashboard ↗</a></article>)}</section>
      {roomGaps.length ? <section className="fl-gap-list"><h3>Explicit gaps and unblock path</h3>{roomGaps.map((gap) => <article key={gap.gapId}><strong>{gap.gapId}: {gap.label}</strong><p>{gap.reason}</p><p><b>What closes it:</b> {gap.unblock}</p></article>)}</section> : null}
    </main>
  );
}

export function FloridaSourcesPanel() {
  return (
    <main className="main fl-workspace" data-walkthrough-target="authoritative-sources">
      <PageTitleWithBack><div><p className="sap-alp-eyebrow">Florida trust surface</p><h2>Authoritative Sources</h2><p>Every AHCA dashboard domain is shown with current export permission, provenance, refresh status and limitation.</p></div></PageTitleWithBack>
      <section className="fl-policy-card" data-walkthrough-target="authoritative-sources-tabs"><h3>Publisher-use contract captured at refresh</h3><p>{FL_OPERATIONAL_SOURCES.publisherPolicy?.interpretation}</p><dl><div><dt>Content signal</dt><dd>{FL_OPERATIONAL_SOURCES.publisherPolicy?.contentSignal}</dd></div><div><dt>Policy hash</dt><dd>{FL_OPERATIONAL_SOURCES.publisherPolicy?.contentHash?.slice(0, 16)}…</dd></div><div><dt>Generated</dt><dd>{FL_OPERATIONAL_SOURCES.generatedAt}</dd></div></dl></section>
      <div className="fl-source-table-wrap" data-walkthrough-target="authoritative-sources-current"><table className="fl-source-table"><thead><tr><th>Source domain</th><th>Permission / load status</th><th>Published / refresh</th><th>Coverage</th><th>Source</th></tr></thead><tbody>{sources.map((item) => { const count = datasets.filter((dataset) => dataset.fromSysId === item.fromSysId).length; return <tr key={item.fromSysId}><td><strong>{item.label}</strong><small>{item.fromSysId}</small></td><td><SourceStatus source={item} /><small>Export {item.exportAllowed === true ? 'allowed' : item.exportAllowed === false ? 'disabled' : 'unverified'}</small></td><td>{item.workbookLastPublishedAt || 'Not reported'}<small>Config {item.configHash?.slice(0, 10) || 'not retained'}…</small></td><td>{count} dataset{count === 1 ? '' : 's'}<small>{metrics.filter((metricItem) => metricItem.fromSysId === item.fromSysId).length} aggregate metrics</small></td><td><a href={item.sourcePageUri} target="_blank" rel="noreferrer">{floridaSourceLabel(item)} ↗</a></td></tr>; })}</tbody></table></div>
      <section className="fl-gap-list"><h3>Governed gaps</h3>{gaps.map((gap) => <article key={gap.gapId}><strong>{gap.gapId}: {gap.label}</strong><p>{gap.reason}</p><p><b>Owner:</b> {gap.owner} · <b>Unblock:</b> {gap.unblock}</p></article>)}</section>
    </main>
  );
}

export function FloridaDecisionSurface({ kind, onOpenOperational, onOpenRoom }) {
  const labels = {
    blender: ['Consideration Blender', 'Blend Florida opportunities across value, access, trust and implementation effort.'],
    pack: ['Win-Win-Win Pack', 'A review package that balances people, program operations and public value.'],
    brief: ['Consideration Brief', 'A Florida decision brief with evidence, assumptions, options, owners and guardrails.'],
    legislation: ['Legislative Analysis', 'Connect Florida operational evidence to authority, oversight questions and possible policy levers without presenting legal advice.'],
  };
  const [title, subtitle] = labels[kind] || labels.blender;
  return (
    <main className="main fl-workspace">
      <div data-walkthrough-target={kind === 'legislation' ? 'legislation-header' : kind === 'pack' ? 'pack-title' : kind === 'brief' ? 'brief-toolbar' : 'blender-title'}><PageTitleWithBack><div><p className="sap-alp-eyebrow">DecisionPro Florida</p><h2>{title}</h2><p>{subtitle}</p></div></PageTitleWithBack></div>
      <div data-walkthrough-target={kind === 'legislation' ? 'legislation-workspace' : kind === 'pack' ? 'pack-wins' : kind === 'brief' ? 'brief-body' : 'blender-focus-tabs'}><FloridaDecisionWorkspace kind={kind} onOpenOperational={onOpenOperational} onOpenRoom={onOpenRoom} /></div>
    </main>
  );
}
