import { useMemo } from 'react';
import { t } from '../parlance.js';
import { ListFilters, SortableTh, useListControls } from './listControls.jsx';

function kindLabel(parlance, kind) {
  if (kind === 'characteristic') return t(parlance, 'characteristic');
  if (kind === 'keyFigure') return t(parlance, 'keyFigure');
  return kind;
}

export function InfoProvidersView({ parlance, rows, onAction, onOpenFlow }) {
  const facets = useMemo(
    () => [
      { key: 'typeLabel', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'loadClass', label: 'Load' },
    ],
    [],
  );
  const controls = useListControls(rows, {
    searchKeys: ['technicalName', 'typeLabel', 'description', 'status', 'loadClass', (r) => r.measures],
    facets,
    initialSort: { key: 'technicalName', dir: 'asc' },
  });

  return (
    <div className="panel">
      <header className="panel-head">
        <h2>{t(parlance, 'infoProvider')}s</h2>
        <p className="hint">Detail DSO, Cube, and Query surfaces on the DecisionPro accurate path.</p>
      </header>
      <ListFilters controls={controls} searchPlaceholder="Filter InfoProviders…" />
      <table className="grid">
        <thead>
          <tr>
            <SortableTh label="Technical name" sortKey="technicalName" controls={controls} />
            <SortableTh label="Type" sortKey="typeLabel" controls={controls} />
            <SortableTh label="Description" sortKey="description" controls={controls} />
            <SortableTh
              label="Measures"
              sortKey="measures"
              controls={controls}
              getValue={(r) => r.measures.join(', ')}
            />
            <SortableTh
              label="Rows"
              sortKey="rowCount"
              controls={controls}
              getValue={(r) => r.rowCount ?? -1}
            />
            <SortableTh label="Status" sortKey="status" controls={controls} />
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {controls.rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="empty-row">
                No InfoProviders match the current filters.
              </td>
            </tr>
          ) : (
            controls.rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong className="mono">{r.technicalName}</strong>
                </td>
                <td>{r.typeLabel}</td>
                <td>{r.description}</td>
                <td>{r.measures.join(', ')}</td>
                <td>{r.rowCount ?? '—'}</td>
                <td>
                  <span className="pill status-completed">{r.status}</span>
                </td>
                <td className="actions-cell">
                  <button
                    type="button"
                    className="linkish"
                    onClick={() =>
                      onAction?.('Display Data', {
                        technicalName: r.technicalName,
                        type: r.type,
                        title: r.technicalName,
                        status: r.status,
                        detail: {
                          layer: r.typeLabel,
                          measures: r.measures,
                          loadClass: r.loadClass,
                          rowCount: r.rowCount,
                        },
                      })
                    }
                  >
                    Display
                  </button>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() =>
                      onAction?.('Show Lineage', {
                        technicalName: r.technicalName,
                        type: r.type,
                        title: r.technicalName,
                        status: r.status,
                      })
                    }
                  >
                    Lineage
                  </button>
                  {r.dataFlowId ? (
                    <button type="button" className="linkish" onClick={() => onOpenFlow?.(r.dataFlowId)}>
                      Data Flow
                    </button>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function InfoObjectsView({ parlance, rows, onAction }) {
  const facets = useMemo(
    () => [
      { key: 'kind', label: 'Kind' },
      { key: 'status', label: 'Status' },
    ],
    [],
  );
  const controls = useListControls(rows, {
    searchKeys: [
      'technicalName',
      'kind',
      'description',
      'dataType',
      'measureId',
      'unit',
      (r) => r.usedBy,
    ],
    facets,
    initialSort: { key: 'technicalName', dir: 'asc' },
  });

  return (
    <div className="panel">
      <header className="panel-head">
        <h2>{t(parlance, 'infoObject')}s</h2>
        <p className="hint">
          {t(parlance, 'characteristic')}s and {t(parlance, 'keyFigure')}s used by accurate-path providers.
        </p>
      </header>
      <ListFilters controls={controls} searchPlaceholder="Filter InfoObjects…" />
      <table className="grid">
        <thead>
          <tr>
            <SortableTh label="Technical name" sortKey="technicalName" controls={controls} />
            <SortableTh label="Kind" sortKey="kind" controls={controls} />
            <SortableTh label="Description" sortKey="description" controls={controls} />
            <SortableTh label="Data type" sortKey="dataType" controls={controls} />
            <SortableTh
              label="Measure"
              sortKey="measureId"
              controls={controls}
              getValue={(r) => r.measureId || r.unit || ''}
            />
            <SortableTh
              label="Used by"
              sortKey="usedBy"
              controls={controls}
              getValue={(r) => r.usedBy.join(', ')}
            />
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {controls.rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="empty-row">
                No InfoObjects match the current filters.
              </td>
            </tr>
          ) : (
            controls.rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong className="mono">{r.technicalName}</strong>
                </td>
                <td>{kindLabel(parlance, r.kind)}</td>
                <td>{r.description}</td>
                <td className="mono">{r.dataType}</td>
                <td>{r.measureId || (r.unit ? r.unit : '—')}</td>
                <td>
                  <span className="cell-sub tight">{r.usedBy.join(', ')}</span>
                </td>
                <td>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() =>
                      onAction?.('Edit', {
                        technicalName: r.technicalName,
                        type: 'infoObject',
                        title: r.description,
                        status: r.status,
                        detail: {
                          layer: 'InfoObject',
                          kind: r.kind,
                          dataType: r.dataType,
                          measureId: r.measureId,
                          unit: r.unit,
                          usedBy: r.usedBy,
                        },
                      })
                    }
                  >
                    Display
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function DataSourcesView({ parlance, rows, onAction, onOpenFlow }) {
  const facets = useMemo(
    () => [
      { key: 'tosGrade', label: 'TOS' },
      { key: 'loadClass', label: 'Load' },
      { key: 'status', label: 'Status' },
    ],
    [],
  );
  const controls = useListControls(rows, {
    searchKeys: [
      'technicalName',
      'description',
      'sourceSystemId',
      'psa',
      'tosGrade',
      'loadClass',
      'dataRequestId',
      'status',
    ],
    facets,
    initialSort: { key: 'technicalName', dir: 'asc' },
  });

  return (
    <div className="panel">
      <header className="panel-head">
        <h2>{t(parlance, 'dataSource')}s</h2>
        <p className="hint">Extract definitions bound to Source Systems and PSA objects.</p>
      </header>
      <ListFilters controls={controls} searchPlaceholder="Filter DataSources…" />
      <table className="grid">
        <thead>
          <tr>
            <SortableTh label="Technical name" sortKey="technicalName" controls={controls} />
            <SortableTh label="Source System" sortKey="sourceSystemId" controls={controls} />
            <SortableTh label="PSA" sortKey="psa" controls={controls} />
            <SortableTh label="TOS" sortKey="tosGrade" controls={controls} />
            <SortableTh label="Load" sortKey="loadClass" controls={controls} />
            <SortableTh label="Data Request" sortKey="dataRequestId" controls={controls} />
            <SortableTh label="Status" sortKey="status" controls={controls} />
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {controls.rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="empty-row">
                No DataSources match the current filters.
              </td>
            </tr>
          ) : (
            controls.rows.map((r) => (
              <tr key={r.id} className={r.status === 'test-only' ? 'row-muted' : ''}>
                <td>
                  <strong className="mono">{r.technicalName}</strong>
                  <div className="cell-sub">{r.description}</div>
                </td>
                <td className="mono">{r.sourceSystemId}</td>
                <td className="mono">{r.psa}</td>
                <td>
                  <span className={`tos tos-${r.tosGrade === 'MIXED' ? 'ATTRIBUTABLE' : r.tosGrade}`}>
                    {r.tosGrade}
                  </span>
                </td>
                <td>{r.loadClass}</td>
                <td className="mono">{r.dataRequestId || '—'}</td>
                <td>{r.status}</td>
                <td className="actions-cell">
                  <button
                    type="button"
                    className="linkish"
                    onClick={() =>
                      onAction?.('Display Data', {
                        technicalName: r.psa,
                        type: 'psa',
                        title: r.technicalName,
                        status: r.status === 'active' ? 'completed' : 'upcoming',
                        detail: {
                          layer: 'DataSource',
                          dataSource: r.technicalName,
                          fromSysId: r.sourceSystemId,
                          loadClass: r.loadClass,
                          dataRequestId: r.dataRequestId,
                        },
                      })
                    }
                  >
                    Display
                  </button>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() =>
                      onAction?.('Edit DataSource', {
                        technicalName: r.technicalName,
                        type: 'psa',
                        title: r.description,
                        status: r.status,
                        detail: {
                          layer: 'DataSource',
                          sourceSystemId: r.sourceSystemId,
                          psa: r.psa,
                          tosGrade: r.tosGrade,
                          dataRequestId: r.dataRequestId,
                        },
                      })
                    }
                  >
                    Edit
                  </button>
                  {r.dataFlowId ? (
                    <button type="button" className="linkish" onClick={() => onOpenFlow?.(r.dataFlowId)}>
                      Data Flow
                    </button>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
