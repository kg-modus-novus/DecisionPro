/** Presentation glossary only — technical IDs stay SAP. */
export const PARLANCE = {
  sap: {
    id: 'sap',
    label: 'SAP',
    terms: {
      dataFlow: 'Data Flow',
      infoProvider: 'InfoProvider',
      infoObject: 'InfoObject',
      characteristic: 'Characteristic',
      keyFigure: 'Key Figure',
      dataSource: 'DataSource',
      sourceSystem: 'Source System',
      processChain: 'Process Chain',
      detailDso: 'Detail DSO',
      transformation: 'Transformation',
      dtp: 'DTP',
      cube: 'Cube',
      psa: 'PSA',
      evidenceRoom: 'Evidence Room',
      modeling: 'Modeling',
      administration: 'Administration',
      loadMonitor: 'Load Monitor',
      feedbackInbox: 'Feedback Inbox',
    },
  },
  common: {
    id: 'common',
    label: 'Common',
    terms: {
      dataFlow: 'Data flow',
      infoProvider: 'Provider',
      infoObject: 'Field object',
      characteristic: 'Dimension',
      keyFigure: 'Measure',
      dataSource: 'Source extract',
      sourceSystem: 'Source system',
      processChain: 'Load sequence',
      detailDso: 'Detail store',
      transformation: 'Mapping',
      dtp: 'Load step',
      cube: 'Aggregate',
      psa: 'Landing area',
      evidenceRoom: 'Evidence room',
      modeling: 'Modeling',
      administration: 'Administration',
      loadMonitor: 'Load monitor',
      feedbackInbox: 'Feedback inbox',
    },
  },
};

export function t(parlanceId, key) {
  return PARLANCE[parlanceId]?.terms[key] || PARLANCE.sap.terms[key] || key;
}
