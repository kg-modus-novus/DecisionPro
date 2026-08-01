import { useEffect, useMemo, useState } from 'react';
import {
  ATTENTION,
  CONTRACT_CLASSES,
  COUNTIES,
  FRESHNESS,
  MCOS,
  MEASURE_TYPES,
  PERIODS,
  POPULATIONS,
  PROVIDER_GROUPS,
  REGIONS,
  SERVICE_CATEGORIES,
  labelOf,
} from '../../data/alp/dimensions.js';
import { LAW_INSTRUMENTS, DRAFT_BILL_TEMPLATES } from '../../data/alp/legislation.js';
import { listChildLineItems, listSlice } from '../../lib/alpCube.js';
import { LawCiteLink } from '../LegislationObjectPage.jsx';
import { PrimarySourceLinks } from '../PrimarySourceLinks.jsx';
import { PageTitleWithBack } from '../ContentBackBar.jsx';

const FACETS = [
  { id: 'overview', label: 'Overview' },
  { id: 'identification', label: 'Identification' },
  { id: 'related', label: 'Related aggregates' },
  { id: 'legislation', label: 'Legislative touchpoints' },
  { id: 'options', label: 'Options to examine' },
];

function metricEntries(row) {
  const entries = [];
  const push = (label, value) => {
    if (value != null && value !== '') entries.push({ label, value });
  };
  push('Dollar impact ($M)', row.dollarImpactM);
  push('Contribution ($M)', row.contributionM);
  push('Spend ($M)', row.spendM);
  push('Growth %', row.growthPct != null ? `${row.growthPct}%` : null);
  push('Δ %', row.deltaPct != null ? `${row.deltaPct}%` : null);
  push('Rate', row.rate);
  push('Peer rate', row.peerRate);
  push('Trend (pts)', row.trendPts);
  push('Withholding ($M)', row.withholdingM);
  push('Enrollment (K)', row.enrollmentK);
  push('PMPM', row.pmpm);
  push('Risk-adj %', row.riskAdjPct);
  push('Unadj %', row.unadjPct);
  push('Readmit %', row.readmitPct);
  push('Value', row.value);
  push('Vs state %', row.vsStatePct != null ? `${row.vsStatePct}%` : null);
  push('KY value', row.kyValue);
  push('Benchmark', row.benchmarkValue);
  push('Gap (pts)', row.gapPts);
  push('Magnitude', row.magnitude);
  push('Controllable', row.controllable);
  push('Earned back', row.earnedBack);
  push('Missed measures', row.missedCount);
  push('Social risk', row.socialRisk);
  push('Distance (mi)', row.distanceMiles);
  push('Source', row.source);
  push('Refresh cadence', row.refreshCadence);
  push('Limitation', row.limitation);
  return entries;
}

function dimensionEntries(row) {
  const entries = [
    ['Population', labelOf(POPULATIONS, row.population)],
    ['Region', labelOf(REGIONS, row.region)],
    ['Period', labelOf(PERIODS, row.period)],
    ['MCO', labelOf(MCOS, row.mco)],
  ];
  if (row.service) entries.push(['Service', labelOf(SERVICE_CATEGORIES, row.service)]);
  if (row.measureType) entries.push(['Measure type', labelOf(MEASURE_TYPES, row.measureType)]);
  if (row.freshness) entries.push(['Freshness', labelOf(FRESHNESS, row.freshness)]);
  if (row.attention) entries.push(['Attention', labelOf(ATTENTION, row.attention)]);
  if (row.contractClass) entries.push(['Contract class', labelOf(CONTRACT_CLASSES, row.contractClass)]);
  if (row.providerGroup) entries.push(['Provider group', labelOf(PROVIDER_GROUPS, row.providerGroup)]);
  if (row.county) entries.push(['County', labelOf(COUNTIES, row.county)]);
  if (row.district) entries.push(['District', row.district]);
  if (row.owner) entries.push(['Owner', row.owner]);
  if (row.source) entries.push(['Source system', row.source]);
  return entries.filter(([, v]) => v != null && v !== '');
}

function statusPills(row) {
  const pills = [];
  if (row.attention) pills.push({ tone: row.attention === 'urgent' ? 'danger' : 'warn', text: labelOf(ATTENTION, row.attention) });
  if (row.freshness) pills.push({ tone: row.freshness === 'lagged' || row.freshness === 'historical' ? 'warn' : 'ok', text: labelOf(FRESHNESS, row.freshness) });
  if (row.controllable) pills.push({ tone: 'neutral', text: `Controllable: ${row.controllable}` });
  if (row.earnedBack) pills.push({ tone: row.earnedBack === 'earned' ? 'ok' : 'warn', text: `Withhold: ${row.earnedBack}` });
  pills.push({ tone: 'neutral', text: 'Aggregate detail' });
  return pills;
}

export function ObjectPage({
  row,
  config,
  filters = {},
  onClose,
  onOpenRelated,
  onOpenLaw,
  guidedFacet = null,
}) {
  const [facet, setFacet] = useState('overview');

  useEffect(() => {
    if (guidedFacet) setFacet(guidedFacet);
  }, [guidedFacet]);

  const related = useMemo(() => {
    if (!row?.roomId) return [];
    const base = { ...filters };
    // Keep one shared dimension so related list feels coherent
    const keep = {};
    if (row.population) keep.population = row.population;
    if (row.region) keep.region = row.region;
    const slice = listSlice(row.roomId, { ...base, ...keep }, { page: 0, pageSize: 8 });
    return slice.rows.filter((r) => r.id !== row.id).slice(0, 6);
  }, [filters, row]);

  const childLines = useMemo(() => listChildLineItems(row, 8), [row]);

  const breakdown = useMemo(() => {
    if (!config?.contentDimension || !row?.roomId) return [];
    // Sibling rows that share most context but vary content dimension — approximate via related list
    return related.slice(0, 5);
  }, [config, related, row]);

  const lawTouchpoints = useMemo(() => {
    const hooks = [row?.service, row?.attention, row?.freshness, row?.region].filter(Boolean);
    return LAW_INSTRUMENTS.filter((law) =>
      hooks.some((h) => (law.blenderHooks || []).some((x) => String(h).includes(x) || x.includes(String(h))))
      || (law.impacts || []).length > 0,
    )
      .slice(0, 4)
      .map((law) => ({
        ...law,
        drafts: DRAFT_BILL_TEMPLATES.filter(
          (d) => d.addresses.includes(law.id) || d.supportsOpportunities.includes(law.id),
        ),
      }));
  }, [row]);

  if (!row) return null;

  const metrics = metricEntries(row);
  const dims = dimensionEntries(row);
  const pills = statusPills(row);
  const primaryMetric = metrics[0];

  return (
    <div className="alp-object-page sap-object" role="dialog" aria-modal="true" aria-label="Object detail">
      <header className="sap-object-header" data-walkthrough-target="object-header">
        <PageTitleWithBack
          actions={
            <div className="sap-object-header-kpis">
              {metrics.slice(0, 3).map((m) => (
                <div key={m.label} className="sap-object-kpi">
                  <span>{m.label}</span>
                  <strong>{String(m.value)}</strong>
                </div>
              ))}
              {!metrics.length && primaryMetric == null ? (
                <div className="sap-object-kpi">
                  <span>Owner</span>
                  <strong>{row.owner || '—'}</strong>
                </div>
              ) : null}
            </div>
          }
        >
          <div className="sap-object-header-main">
            <p className="sap-alp-eyebrow">Object page · aggregate detail</p>
            <h2>{row.title}</h2>
            <p className="alp-object-id">{row.id}</p>
            <div className="sap-pill-row">
              {pills.map((p) => (
                <span key={p.text} className={`sap-pill ${p.tone}`}>
                  {p.text}
                </span>
              ))}
            </div>
          </div>
        </PageTitleWithBack>
      </header>

      <section className="sap-identity" aria-label="Identification area" data-walkthrough-target="object-body">
        <h3>Identification</h3>
        <dl className="sap-identity-grid">
          {dims.slice(0, 8).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div>
            <dt>Room</dt>
            <dd>{config?.title || row.roomId}</dd>
          </div>
          <div>
            <dt>Provenance</dt>
            <dd>
              {row.rowKind === 'GAP'
                ? 'Labeled Gap — paid follow-on required'
                : 'XenoDroid BW REAL · public published cut'}
            </dd>
          </div>
        </dl>
      </section>

      <nav className="sap-facet-nav" aria-label="Object facets">
        {FACETS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={facet === f.id ? 'on' : ''}
            onClick={() => setFacet(f.id)}
            data-walkthrough-target={`object-facet-${f.id}`}
          >
            {f.label}
          </button>
        ))}
      </nav>

      <div className="sap-facet-body">
        {facet === 'overview' && (
          <div className="sap-facet-panels">
            <section className="sap-facet-panel">
              <h3>Explain this change</h3>
              <p>{row.explanation}</p>
              <h4>Key figures</h4>
              <dl className="alp-dl">
                {metrics.map((m) => (
                  <div key={m.label}>
                    <dt>{m.label}</dt>
                    <dd>{String(m.value)}</dd>
                  </div>
                ))}
              </dl>
              <PrimarySourceLinks sources={row.primarySources} />
            </section>
            <section className="sap-facet-panel">
              <h3>Context snapshot</h3>
              <dl className="alp-dl">
                {dims.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="hint">Not prescriptions · aggregate / de-identified · no PHI</p>
            </section>
          </div>
        )}

        {facet === 'identification' && (
          <section className="sap-facet-panel">
            <h3>Full identification</h3>
            <dl className="alp-dl sap-dl-wide">
              {dims.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              {metrics.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd>{String(m.value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {facet === 'related' && (
          <div className="sap-list-areas">
            <section className="sap-facet-panel">
              <h3>Related aggregates</h3>
              <p className="hint">Same population/region neighborhood under current filters</p>
              <table className="alp-table sap-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Population</th>
                    <th>Region</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {related.map((r) => (
                    <tr key={r.id}>
                      <td>{r.title}</td>
                      <td>{labelOf(POPULATIONS, r.population)}</td>
                      <td>{labelOf(REGIONS, r.region)}</td>
                      <td>
                        <button type="button" className="alp-obj-link" onClick={() => onOpenRelated?.(r)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!related.length && (
                    <tr>
                      <td colSpan={4} className="hint">
                        No related rows in this slice.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
            <section className="sap-facet-panel">
              <h3>Sibling breakdown (list area)</h3>
              <ul className="er-list">
                {breakdown.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="alp-obj-link" onClick={() => onOpenRelated?.(r)}>
                      {r.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {facet === 'legislation' && (
          <div className="sap-list-areas">
            <section className="sap-facet-panel">
              <h3>Related law & gaps</h3>
              <p className="hint">Cite links open the legislation object page — then use Law ↔ blender for bi-directional blocker/opportunity work</p>
              <ul className="sap-law-list">
                {lawTouchpoints.map((law) => (
                  <li key={law.id}>
                    <LawCiteLink instrumentId={law.id} onOpenLaw={onOpenLaw}>
                      <strong>{law.cite}</strong>
                    </LawCiteLink>
                    <span>{law.title}</span>
                    <em>{law.status}</em>
                    <p>{law.summary}</p>
                  </li>
                ))}
              </ul>
            </section>
            <section className="sap-facet-panel">
              <h3>Draft bill sketches linked here</h3>
              <ul className="er-list">
                {lawTouchpoints.flatMap((law) => law.drafts).map((d) => (
                  <li key={d.id}>
                    <strong>{d.title}</strong> — {d.summary}
                    {d.surgical ? ' · surgical' : ''}
                  </li>
                ))}
                {!lawTouchpoints.some((l) => l.drafts.length) && (
                  <li className="hint">No draft templates linked to these touchpoints.</li>
                )}
              </ul>
            </section>
          </div>
        )}

        {facet === 'options' && (
          <section className="sap-facet-panel">
            <h3>Options to examine</h3>
            <ul className="er-list">
              {(row.actions || []).map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
            <p className="hint">Not prescriptions · aggregate / de-identified · no PHI</p>
          </section>
        )}

        <section className="sap-facet-panel sap-line-items" aria-label="Child and related line items">
          <header className="sap-section-head">
            <div>
              <h3>Child / related line items</h3>
              <p className="hint">
                Claim-line rollups under this aggregate · {childLines.length} lines
              </p>
            </div>
          </header>
          <div className="alp-table-wrap sap-table-wrap">
            <table className="alp-table sap-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Line item</th>
                  <th>Kind</th>
                  <th>Amount</th>
                  <th>Share %</th>
                  <th>Status</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {childLines.map((line, idx) => (
                  <tr key={line.id} className={idx % 2 ? 'alt' : ''}>
                    <td>{line.lineNo}</td>
                    <td>{line.label}</td>
                    <td>{line.kind}</td>
                    <td>{line.amount == null ? '—' : line.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{line.sharePct}</td>
                    <td>
                      <span className={`sap-pill ${line.status === 'Watch' ? 'warn' : 'ok'}`}>{line.status}</span>
                    </td>
                    <td>{line.owner}</td>
                  </tr>
                ))}
                {!childLines.length && (
                  <tr>
                    <td colSpan={7} className="hint">
                      No child lines for this object.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {related.length > 0 ? (
            <div className="sap-related-inline">
              <h4>Related aggregates</h4>
              <ul className="er-list">
                {related.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <button type="button" className="alp-obj-link" onClick={() => onOpenRelated?.(r)}>
                      {r.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
