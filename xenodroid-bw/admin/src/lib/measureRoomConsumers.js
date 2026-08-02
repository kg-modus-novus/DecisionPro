/** Measure → Evidence Room consumers (aligned with dataSpectrumAvailable measureConsumers). */
export const MEASURE_ROOM_CONSUMERS = {
  'M-001': ['command-center'],
  'M-002': ['command-center'],
  'M-003': ['county', 'utilization'],
  'M-004': ['command-center', 'cost-drivers'],
  'M-005': ['cost-drivers'],
  'M-006': ['cost-drivers'],
  'M-007': ['mco'],
  'M-009': ['outcomes', 'benchmarks'],
  'M-010': ['outcomes', 'benchmarks'],
  'M-011': ['outcomes', 'benchmarks'],
  'M-012': ['outcomes', 'benchmarks'],
  'M-014': ['mco'],
  'M-017': ['cost-drivers'],
  'M-021': ['county', 'measure-definitions'],
  'M-022': ['provider'],
  'M-023': ['provider'],
  'M-028': ['measure-definitions'],
};

export const EVIDENCE_ROOM_TITLES = {
  'command-center': 'Legislative Command Center',
  'cost-drivers': 'Cost Drivers',
  utilization: 'Utilization & Access',
  outcomes: 'Outcomes & Quality',
  mco: 'MCO Accountability',
  provider: 'Provider & Delivery-System',
  county: 'County & District View',
  benchmarks: 'Benchmarks',
  'measure-definitions': 'Measure Definitions & Data Quality',
};

export function roomsForMeasures(measureIds) {
  const rooms = new Set();
  for (const mid of measureIds || []) {
    for (const roomId of MEASURE_ROOM_CONSUMERS[mid] || []) {
      rooms.add(roomId);
    }
  }
  return [...rooms].sort();
}
