const NODE_WIDTH = 286;
const NODE_HEIGHT = 78;
const HORIZONTAL_MARGIN = 36;
const VERTICAL_MARGIN = 52;
const COLUMN_GAP = 420;

function distribute(count, height) {
  if (count <= 1) return [height / 2];
  const usable = height - (VERTICAL_MARGIN * 2);
  return Array.from({ length: count }, (_, index) => VERTICAL_MARGIN + ((usable * index) / (count - 1)));
}

export function buildRelationshipGraph(items = []) {
  const sourceNames = [...new Set(items.map((item) => item.sourceNode))];
  const targetNames = [...new Set(items.map((item) => item.targetNode))];
  const largestColumn = Math.max(sourceNames.length, targetNames.length, 1);
  const height = Math.max(560, (largestColumn * 98) + (VERTICAL_MARGIN * 2));
  const width = (HORIZONTAL_MARGIN * 2) + (NODE_WIDTH * 2) + COLUMN_GAP;
  const sourceYs = distribute(sourceNames.length, height);
  const targetYs = distribute(targetNames.length, height);
  const sourceMap = new Map();
  const targetMap = new Map();

  const mode = items[0]?.type || 'subaward-edge';

  function describeNode(label, kind) {
    const connections = items.filter((item) => (kind === 'source' ? item.sourceNode : item.targetNode) === label);
    const totalValue = connections.reduce((sum, item) => sum + Number(item.relationshipValue || 0), 0);
    const connectionLabel = `${connections.length} ${connections.length === 1 ? 'relationship' : 'relationships'} shown`;
    if (mode === 'subaward-edge') {
      return {
        roleLabel: kind === 'source' ? 'Prime organization' : 'Sub-recipient organization',
        metricLabel: `Funding shown ${formatCompactCurrency(totalValue)}`,
        connectionLabel,
        totalValue,
        financialLabel: `${formatCurrency(totalValue)} across displayed funding relationships`,
        contextLabel: [...new Set(connections.map((item) => item.detail).filter(Boolean))].join(' · '),
        contextRows: connections.map((item) => item.evidenceContext).filter(Boolean),
      };
    }
    return {
      roleLabel: kind === 'source' ? 'Owner organization' : 'Matched facility',
      metricLabel: kind === 'source'
        ? `${connections.length} matched ${connections.length === 1 ? 'facility' : 'facilities'} shown`
        : `Quality ${connections[0]?.graphMetricValue || connections[0]?.metricValue || 'not reported'}`,
      connectionLabel,
      totalValue: null,
      financialLabel: 'No funding amount is represented by this ownership relationship.',
      contextLabel: connections[0]?.graphDetail || connections[0]?.detail || '',
      contextRows: [],
    };
  }

  const sources = sourceNames.map((label, index) => {
    const node = { id: `source-${index}`, kind: 'source', label, ...describeNode(label, 'source'), x: HORIZONTAL_MARGIN, y: sourceYs[index] - (NODE_HEIGHT / 2), width: NODE_WIDTH, height: NODE_HEIGHT };
    sourceMap.set(label, node);
    return node;
  });
  const targets = targetNames.map((label, index) => {
    const node = { id: `target-${index}`, kind: 'target', label, ...describeNode(label, 'target'), x: width - HORIZONTAL_MARGIN - NODE_WIDTH, y: targetYs[index] - (NODE_HEIGHT / 2), width: NODE_WIDTH, height: NODE_HEIGHT };
    targetMap.set(label, node);
    return node;
  });

  const maxValue = Math.max(1, ...items.map((item) => Number(item.relationshipValue || 0)));
  const edges = items.map((item, index) => {
    const source = sourceMap.get(item.sourceNode);
    const target = targetMap.get(item.targetNode);
    const startX = source.x + source.width;
    const startY = source.y + (source.height / 2);
    const endX = target.x;
    const endY = target.y + (target.height / 2);
    const bend = Math.max(100, (endX - startX) * 0.42);
    const value = Number(item.relationshipValue || 0);
    return {
      id: `edge-${index}`,
      item,
      sourceId: source.id,
      targetId: target.id,
      path: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`,
      width: value > 0 ? 1.6 + (4.4 * Math.sqrt(value / maxValue)) : 2.2,
    };
  });

  return { width, height, nodes: [...sources, ...targets], edges };
}

export function formatCompactCurrency(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(amount >= 10_000_000_000 ? 0 : 1)}B`;
  if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
  if (Math.abs(amount) >= 1_000) return `$${(amount / 1_000).toFixed(amount >= 10_000 ? 0 : 1)}K`;
  return formatCurrency(amount);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
}

export function zoomViewportAtPoint(current, pointX, pointY, deltaY, minScale = 0.65, maxScale = 2.4) {
  const factor = deltaY < 0 ? 1.12 : (1 / 1.12);
  const nextScale = Math.min(maxScale, Math.max(minScale, current.scale * factor));
  if (nextScale === current.scale) return current;
  return {
    scale: nextScale,
    x: pointX - (((pointX - current.x) / current.scale) * nextScale),
    y: pointY - (((pointY - current.y) / current.scale) * nextScale),
  };
}

export function wrapGraphLabel(label, maxLength = 30) {
  const words = String(label || '').split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= 2) return lines;
  const second = lines.slice(1).join(' ');
  return [lines[0], `${second.slice(0, maxLength - 1).trimEnd()}…`];
}
