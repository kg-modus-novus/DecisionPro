export function FieldMappingView({ mapping }) {
  if (!mapping) {
    return <p className="hint">No field mapping metadata for this transformation.</p>;
  }
  return (
    <div className="map-view">
      <header className="map-head">
        <div>
          <p className="eyebrow">Field mapping</p>
          <h3 className="mono">{mapping.technicalName}</h3>
        </div>
        <p className="hint">{mapping.rulesNote}</p>
      </header>
      <div className="map-endpoints">
        <div className="map-end source">
          <span className="eyebrow">Source</span>
          <strong>{mapping.source}</strong>
        </div>
        <div className="map-arrow" aria-hidden="true">
          →
        </div>
        <div className="map-end target">
          <span className="eyebrow">Target</span>
          <strong>{mapping.target}</strong>
        </div>
      </div>
      <div className="map-graph">
        {mapping.mappings.map((m, i) => (
          <div key={i} className="map-row">
            <div className="map-field src">
              <code>{m.source}</code>
            </div>
            <div className="map-rule">
              <span>{m.rule}</span>
              <em>{m.dataType}</em>
            </div>
            <div className="map-field tgt">
              <code>{m.target}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DsoStructureView({ structure }) {
  if (!structure) return <p className="hint">No DSO structure metadata.</p>;
  return (
    <div className="struct-view">
      <header className="map-head">
        <div>
          <p className="eyebrow">Detail DSO structure</p>
          <h3 className="mono">{structure.technicalName}</h3>
        </div>
        <p>
          Type: <strong>{structure.dsoType}</strong>
        </p>
        <p className="hint">{structure.dsoTypeNote}</p>
      </header>
      <div className="dso-tables">
        {structure.tables.map((tbl) => (
          <section
            key={tbl.name}
            className={`dso-table ${tbl.status === 'implemented' ? 'impl' : 'missing'}`}
          >
            <h4>
              {tbl.name}{' '}
              <span className={`pill status-${tbl.status === 'implemented' ? 'completed' : 'upcoming'}`}>
                {tbl.status}
              </span>
            </h4>
            <p className="cell-sub">{tbl.physical || '—'}</p>
            <p className="hint">{tbl.note}</p>
            {tbl.fields?.length ? (
              <table className="grid dense">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Data type</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {tbl.fields.map((f) => (
                    <tr key={f.name}>
                      <td className="mono">{f.name}</td>
                      <td className="mono">{f.dataType}</td>
                      <td>{f.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}

export function CubeStructureView({ structure }) {
  if (!structure) return <p className="hint">No cube structure metadata.</p>;
  const dims = structure.dimensions || [];
  return (
    <div className="struct-view">
      <header className="map-head">
        <div>
          <p className="eyebrow">Cube structure</p>
          <h3 className="mono">{structure.technicalName}</h3>
        </div>
        <p>
          Type: <strong>{structure.cubeType}</strong>
        </p>
        <p className="hint">{structure.cubeTypeNote}</p>
      </header>
      <div className="star-schema">
        {dims.map((d) => (
          <div key={d.name} className="star-dim">
            <strong>{d.name}</strong>
            <p className="cell-sub">{d.description}</p>
            <ul>
              {d.fields.map((f) => (
                <li key={f.name}>
                  <code>{f.name}</code> <span className="cell-sub">{f.dataType}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="star-fact">
          <p className="eyebrow">Fact</p>
          <strong>{structure.fact.name}</strong>
          <p className="cell-sub mono">{structure.fact.physical}</p>
          <table className="grid dense">
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {structure.fact.fields.map((f) => (
                <tr key={f.name}>
                  <td className="mono">{f.name}</td>
                  <td className="mono">{f.dataType}</td>
                  <td>{f.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function QueryStructureView({ structure }) {
  if (!structure) return <p className="hint">No query structure metadata.</p>;
  return (
    <div className="struct-view">
      <header className="map-head">
        <div>
          <p className="eyebrow">Query / InfoProvider surface</p>
          <h3 className="mono">{structure.technicalName}</h3>
        </div>
        <p>
          Type: <strong>{structure.queryType}</strong>
        </p>
        <p className="hint">{structure.queryTypeNote}</p>
      </header>
      <dl className="def-grid">
        <div>
          <dt>Binds</dt>
          <dd className="mono">{(structure.binds || []).join(', ')}</dd>
        </div>
        <div>
          <dt>Export</dt>
          <dd className="mono">{structure.exportPath}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ProviderStructureView({ structure }) {
  if (!structure) return <p className="hint">No structure metadata for this object.</p>;
  if (structure.kind === 'dso') return <DsoStructureView structure={structure} />;
  if (structure.kind === 'cube') return <CubeStructureView structure={structure} />;
  if (structure.kind === 'query') return <QueryStructureView structure={structure} />;
  return <p className="hint">Unsupported structure kind.</p>;
}
