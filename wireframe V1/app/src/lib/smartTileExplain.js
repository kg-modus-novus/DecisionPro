/**
 * Value-specific I-button copy for Accurate Landing + role-signal smart tiles.
 * Prose must cite the tile’s actual displayed numbers / Gap labels — not generic placeholders.
 */

function displayValue(tile) {
  const raw = tile?.value;
  if (raw == null || raw === '') return '—';
  const unit = tile.unit ? String(tile.unit).trim() : '';
  const scale = tile.scale ? String(tile.scale).trim() : '';
  const v = String(raw).trim();
  if (scale && !v.includes(scale)) return `${v}${scale}`;
  if (unit && !v.toLowerCase().includes(unit.toLowerCase()) && !v.includes('%')) {
    return `${v} ${unit}`;
  }
  return v;
}

function asOfCue(tile) {
  const c = String(tile?.comparison || '');
  const m = c.match(/As of\s+([0-9-]+)/i);
  if (m) return m[1];
  if (tile?.measure?.asOfDate) return tile.measure.asOfDate;
  return null;
}

function fromSysCue(tile) {
  return tile?.measure?.fromSysId || null;
}

function seriesCue(tile) {
  const labels = tile?.seriesLabels || [];
  if (labels.length >= 2) {
    return `${labels[0]} through ${labels[labels.length - 1]}`;
  }
  return null;
}

function interpretGap(tile, shown) {
  const gapId = tile.gap?.gapId || tile.comparison || 'this Gap';
  const path = tile.gap?.accessPath;
  return [
    `Here, “${shown}” is an Explicit Gap label — not a missing chart and not a synthetic magnitude.`,
    gapId ? `The identifier ${gapId} names the authorized feed or authority still required.` : '',
    path ? `Access path called out on the tile: ${path}.` : '',
    tile.why || '',
  ]
    .filter(Boolean)
    .join(' ');
}

function interpretStatus(tile, shown) {
  const detail = tile.status?.detail;
  return [
    `Here, “${shown}” is a status flag for this perspective, not a calculated rate you should quote as a KPI.`,
    detail ? `The tile elaborates: ${detail}.` : '',
    tile.why || '',
  ]
    .filter(Boolean)
    .join(' ');
}

function interpretRadial(tile, shown) {
  const pct = tile.radial?.percent;
  const caption = tile.radial?.caption;
  return [
    `Here, ${shown} is the published rate shown on the radial (${pct != null ? `${pct}% of 100` : 'percent of 100'}${caption ? `; ${caption}` : ''}).`,
    'Read it as a bounded public indicator — open provenance before using it in a hearing packet.',
    tile.why || '',
  ]
    .filter(Boolean)
    .join(' ');
}

function interpretBullet(tile, shown) {
  const b = tile.bullet || {};
  const target = b.targetLabel || (Number.isFinite(Number(b.target)) ? String(b.target) : 'the reference');
  return [
    `Here, ${shown} is plotted against ${target} on the bullet scale${b.label ? ` (${b.label})` : ''}.`,
    Number.isFinite(Number(b.current)) && Number.isFinite(Number(b.target))
      ? `Current value ${b.current} versus reference ${b.target} — the marker position is the interpretation cue, not a second invented number.`
      : '',
    tile.why || '',
  ]
    .filter(Boolean)
    .join(' ');
}

function interpretArea(tile, shown) {
  const span = seriesCue(tile);
  return [
    `Here, ${shown} is the latest point on the multi-period area chart${span ? ` spanning ${span}` : ''}.`,
    'Intermediate ticks mark every published period in the series so a gap between labels is not a missing load.',
    tile.why || '',
  ]
    .filter(Boolean)
    .join(' ');
}

function interpretBars(tile, shown) {
  const bars = tile.bars || [];
  const parts = bars
    .slice(0, 4)
    .map((b) => `${b.label}: ${b.display ?? b.value}`)
    .join('; ');
  return [
    shown && shown !== '—' ? `Here, ${shown} is the hero figure above the comparison bars.` : 'Here, the comparison bars are the reading.',
    parts ? `Bar values on this tile: ${parts}.` : '',
    tile.why || '',
  ]
    .filter(Boolean)
    .join(' ');
}

function interpretShare(tile, shown) {
  const s = tile.share || {};
  return [
    `Here, ${shown} is the selected county (or slice) count.`,
    s.display
      ? `The share bar shows about ${s.display} of the KY total (${s.label || 'of total'}).`
      : '',
    tile.why || '',
  ]
    .filter(Boolean)
    .join(' ');
}

function interpretHero(tile, shown) {
  const rows = (tile.breakdown || [])
    .map((r) => `${r.label}: ${r.display ?? r.value}`)
    .join('; ');
  return [
    `Here, ${shown} is the hero magnitude.`,
    rows ? `Breakdown rows cite: ${rows}.` : '',
    tile.why || '',
  ]
    .filter(Boolean)
    .join(' ');
}

function interpretMetric(tile, shown) {
  if (tile.share) return interpretShare(tile, shown);
  const asOf = asOfCue(tile);
  return [
    `Here, ${shown} is the published figure on this tile${asOf ? ` (as of ${asOf})` : ''}.`,
    tile.direction === 'down'
      ? 'The downward cue means the latest reading is lower than the comparison context on the accurate path — not a forecast.'
      : tile.direction === 'up'
        ? 'The upward cue means the latest reading is higher than the comparison context on the accurate path — not a forecast.'
        : '',
    tile.why || '',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildInterpret(tile, shown) {
  switch (tile?.visual) {
    case 'gap':
      return interpretGap(tile, shown);
    case 'status':
      return interpretStatus(tile, shown);
    case 'radial':
      return interpretRadial(tile, shown);
    case 'bullet':
      return interpretBullet(tile, shown);
    case 'areaTrend':
      return interpretArea(tile, shown);
    case 'barCompare':
      return interpretBars(tile, shown);
    case 'heroBreakdown':
      return interpretHero(tile, shown);
    case 'metric':
    default:
      return interpretMetric(tile, shown);
  }
}

/**
 * @param {object} tile — SmartTile presentation props (landing or role-signal)
 */
export function buildSmartTileExplain(tile) {
  if (!tile) return null;
  const shown = displayValue(tile);
  const asOf = asOfCue(tile);
  const fromSys = fromSysCue(tile);
  const interpret = buildInterpret(tile, shown);

  const sourceBits = [
    tile.comparison,
    fromSys ? `FromSysID ${fromSys}` : null,
    asOf ? `As of ${asOf}` : null,
    tile.measure?.definition || null,
  ].filter(Boolean);

  const terms = [];
  if (tile.kind) terms.push(`Kind strip: ${tile.kind}`);
  if (tile.gap?.gapId) terms.push(`Gap id: ${tile.gap.gapId}`);
  if (tile.measure?.measureId) terms.push(`Measure: ${tile.measure.measureId}`);
  if (tile.visual) terms.push(`Presentation: ${tile.visual}`);

  return {
    title: tile.title || 'Smart tile',
    interpret,
    about: interpret,
    source:
      sourceBits.join(' · ') ||
      'Accurate public-data path / role signal — REAL published aggregates or Explicit Gaps only.',
    terms,
    useTile: tile.destinationLabel
      ? `Select the tile face to ${tile.destinationLabel.replace(/^./, (c) => c.toLowerCase())}. Use this (i) control for interpretation without navigating away.`
      : 'Select the tile face to open the linked evidence or provenance. Use this (i) control for interpretation without navigating away.',
    useData: [
      `When briefing, cite “${shown}” exactly as shown`,
      asOf ? `with as-of ${asOf}` : null,
      fromSys ? `and source ${fromSys}` : null,
      tile.visual === 'gap'
        ? '— and keep the Gap label visible so listeners do not hear a fabricated dollar or rate.'
        : '— and open provenance before treating it as hearing-ready.',
    ]
      .filter(Boolean)
      .join(' '),
  };
}
