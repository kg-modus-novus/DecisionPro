import { EVIDENCE_ROOMS } from '../data/fixtures.js';
import { ensureSentence } from './explainProse.js';
import { formatResultantCubeLine } from './resultantCubeDisplay.js';

const ROOM_BY_ID = new Map(EVIDENCE_ROOMS.map((r) => [r.id, r]));

const ROOM_PURPOSE = {
  'command-center':
    'This cube feeds the Legislative Command Center, where staff see attention signals and top changes.',
  'cost-drivers':
    'This cube feeds Cost Drivers views for spend, growth, and population-level cost contribution.',
  utilization:
    'This cube feeds Utilization and Access views for patterns such as ED use, inpatient use, and distance to care.',
  outcomes:
    'This cube feeds Outcomes and Quality views for typed quality measures and peer position.',
  mco: 'This cube feeds MCO Accountability views for contract and withholding themes.',
  provider:
    'This cube feeds Provider and Delivery-System views for unadjusted and risk-adjusted performance context.',
  county:
    'This cube feeds County and District views for local and legislative-district comparison.',
  benchmarks:
    'This cube feeds Benchmarks views for historical, peer, CMS, and contract reference points.',
  'measure-definitions':
    'This cube feeds Measure Definitions and Data Quality views for owners, sources, freshness, and limitations.',
};

export function describeEvidenceRoom(roomId) {
  const room = ROOM_BY_ID.get(roomId);
  if (room) {
    return {
      id: room.id,
      title: room.title,
      blurb:
        ROOM_PURPOSE[room.id] ||
        ensureSentence(room.blurb || 'This Evidence Room presents related legislative evidence.'),
    };
  }
  return {
    id: roomId,
    title: roomId,
    blurb: 'This Evidence Room cube feeds DecisionPro screens.',
  };
}

/**
 * Explain Resultant (cubes) tile contents — Evidence Room cubes, not measures.
 */
export function buildResultantCubeExplain(row, factTotals) {
  if (!row) return null;
  const cubes = row.loadedDepth?.resultantCubes || [];
  const rooms = cubes.map((c) => {
    const line = formatResultantCubeLine(c, factTotals);
    const meta = describeEvidenceRoom(c.cubeId || c.label);
    return {
      ...meta,
      sourceRowCount: line.sourceRowCount,
      factRowCount: line.factRowCount,
      countsSentence:
        `This source contributes ${line.sourceRowCount.toLocaleString()} REAL row${
          line.sourceRowCount === 1 ? '' : 's'
        } to this cube, ` +
        `and the cube fact table currently holds ${line.factRowCount.toLocaleString()} REAL row${
          line.factRowCount === 1 ? '' : 's'
        } across all sources.`,
    };
  });

  return {
    title: `${row.fromSysId} — Resultant cubes`,
    overview:
      'These names are Evidence Room cubes — warehouse tables shaped for DecisionPro screens. They are not measure IDs. Measures such as M-001 are separate catalogue objects, and one cube can hold many measures.',
    howToRead:
      cubes.length === 0
        ? 'This source does not currently feed any Evidence Room cube fact rows.'
        : 'Each line names one Evidence Room cube that this source feeds. The first number is how many REAL rows from this source are in that cube. The fact number is the full size of that cube’s fact table across all sources.',
    rooms,
  };
}
