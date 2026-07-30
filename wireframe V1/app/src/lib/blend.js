const FRESHNESS_TRUST = {
  'Near current': 1,
  Recent: 0.85,
  Lagged: 0.55,
  Historical: 0.35,
  Provisional: 0.4,
};

export function freshnessTrustFactor(freshness) {
  return FRESHNESS_TRUST[freshness] ?? 0.5;
}

/** Visual weight of a finding after freshness/confidence shrinkage. */
export function findingDisplayWeight(finding) {
  const freshness = freshnessTrustFactor(finding.freshness);
  return clamp01(finding.confidence * freshness * (0.5 + 0.5 * finding.magnitudeValue));
}

export function normalizeWeights(weights) {
  const keys = Object.keys(weights);
  const sum = keys.reduce((acc, key) => acc + Number(weights[key] || 0), 0);
  if (sum <= 0) {
    const even = 1 / keys.length;
    return Object.fromEntries(keys.map((key) => [key, even]));
  }
  return Object.fromEntries(keys.map((key) => [key, Number(weights[key] || 0) / sum]));
}

/**
 * Radar = evidence strength × legislator priority.
 * Slider weights must visibly reshape axes (they previously canceled in both
 * numerator and denominator).
 */
export function radarProfile(findings, weights) {
  const w = normalizeWeights(weights);
  const priority = normalizeWeights({
    budget: w.budget || 0,
    care: w.care || 0,
    access: w.access || 0,
    mco: w.mco || 0,
    political: ((w.district || 0) + (w.bill || 0)) / 2,
  });

  return {
    budget: blendAxis(evidenceAxis(findings, (f) => f.budgetRelief), priority.budget),
    care: blendAxis(evidenceAxis(findings, (f) => f.careResults), priority.care),
    access: blendAxis(evidenceAxis(findings, (f) => focusMatch(f, 'access')), priority.access),
    mco: blendAxis(evidenceAxis(findings, (f) => focusMatch(f, 'mco')), priority.mco),
    political: blendAxis(
      evidenceAxis(
        findings,
        (f) => focusMatch(f, 'district') * 0.7 + focusMatch(f, 'bill') * 0.3,
      ),
      priority.political,
    ),
  };
}

function focusMatch(finding, focusId) {
  return finding.focusId === focusId ? finding.magnitudeValue : finding.magnitudeValue * 0.35;
}

function evidenceAxis(findings, valueFn) {
  if (!findings.length) return 0.25;
  let num = 0;
  let den = 0;
  for (const finding of findings) {
    const tw = findingDisplayWeight(finding);
    num += valueFn(finding) * tw;
    den += tw;
  }
  return den === 0 ? 0.25 : clamp01(num / den);
}

/** Priority-forward mix so slider moves clearly stretch the matching axis. */
function blendAxis(evidence, priority) {
  return clamp01(0.35 * evidence + 0.65 * priority);
}

export function scoreOptionPack(pack, weights, findings) {
  const w = normalizeWeights(weights);
  const focusCoverage = pack.tags.reduce((acc, tag) => acc + (w[tag] ?? 0), 0);
  const axisFit =
    (pack.axes.budget || 0) * (w.budget || 0) +
    (pack.axes.care || 0) * (w.care || 0) +
    (pack.axes.access || 0) * (w.access || 0) +
    (pack.axes.mco || 0) * (w.mco || 0) +
    (pack.axes.political || 0) * ((w.district || 0) + (w.bill || 0)) / 2;

  const findingFocusIds = new Set(findings.map((f) => f.focusId));
  const tagHit = pack.tags.filter((tag) => findingFocusIds.has(tag)).length / Math.max(pack.tags.length, 1);
  const trustPenalty =
    1 -
    findings.reduce((acc, f) => acc + (1 - freshnessTrustFactor(f.freshness)), 0) /
      Math.max(findings.length * 2, 1);

  return clamp01(0.35 * focusCoverage + 0.4 * axisFit + 0.15 * tagHit + 0.1 * trustPenalty);
}

export function rankOptionPacks(packs, weights, findings) {
  return [...packs]
    .map((pack) => ({ ...pack, score: scoreOptionPack(pack, weights, findings) }))
    .sort((a, b) => b.score - a.score);
}

export function buildBrief({ focuses, findings, weights, packs, spineStep, trustReviewed = false, pathPinned = false }) {
  const ranked = rankOptionPacks(packs, weights, findings).slice(0, 3);
  const w = normalizeWeights(weights);
  const problemFocus = focuses.length
    ? focuses.join(', ')
    : 'budget and care';
  const hasLaggedOrProvisional = findings.some(
    (f) => f.freshness === 'Lagged' || f.freshness === 'Provisional',
  );
  return {
    title: 'Consideration Brief',
    briefId: 'CB-KY-2025-001',
    dateLabel: 'May 15, 2025',
    perspective: 'Kentucky statewide · Medicaid legislative view',
    timeHorizon: 'FY2025–FY2027',
    preparedBy: 'LRC Analytical Services — DecisionPro Kentucky',
    disclaimer: 'Options to examine — not prescriptions. Aggregate / de-identified views only.',
    spineStep,
    trustReviewed,
    pathPinned,
    focuses,
    findings: findings.map((f) => ({
      id: f.id,
      title: f.title,
      magnitude: f.magnitude,
      freshness: f.freshness,
      trustNote: f.sourceIncentiveNote,
      primarySources: f.primarySources || [],
      budgetRelief: f.budgetRelief,
      careResults: f.careResults,
      focusId: f.focusId,
    })),
    weights: w,
    packs: ranked.map((p, i) => ({
      id: p.id,
      index: i + 1,
      title: p.title,
      score: p.score,
      budgetWin: p.budgetWin,
      careWin: p.careWin,
      politicalWin: p.politicalWin,
      trustCaveats: p.trustCaveats,
      evidenceLevel: p.evidenceLevel,
      axes: p.axes,
      distributional: i === 0 ? 'Balanced' : i === 1 ? 'Targeted' : 'Broad',
      fiscalImpact: i === 1 ? 'Near-neutral' : 'Neutral to modest cost',
      stars: Math.max(1, Math.round(p.score * 5)),
    })),
    problemStatement:
      findings.length > 0
        ? `Under current blender inputs (${problemFocus}), material Medicaid pressure is concentrated in a small set of service and population drivers. The brief frames where spending and access are changing, what may be controllable, and which option packs warrant examination—not enactment.`
        : `Add findings in the Consideration Blender to populate a problem statement.`,
    statusQuo: [
      'Specialty pharmacy and avoidable ED growth continue to outpace enrollment if unaddressed.',
      'Rural access and postpartum follow-up gaps persist unevenly by region.',
      'MCO withholding and network adequacy remain uneven without clearer oversight packaging.',
      'Lagged national benchmarks continue to sit beside nearer-current claims without warnings.',
    ],
    lawNotes: [
      {
        instrumentId: 'krs-205-admin',
        ref: 'KRS Ch. 205 (selected)',
        note: 'Medicaid program administration / eligibility framing.',
      },
      {
        instrumentId: 'krs-304-ins',
        ref: 'KRS Ch. 304 (selected)',
        note: 'Insurance / managed-care adjacent provisions.',
      },
      {
        instrumentId: 'bill-maternal-a',
        ref: 'HB 412 — pending maternal measure',
        note: 'Committee/caucus discussion — provisional bill linkage pending LRC counsel review.',
      },
      {
        instrumentId: 'krs-205-managed',
        ref: 'KRS 205.5601 et seq. — quality withholding',
        note: 'Existing MCO value-based / withholding measures.',
      },
    ],
    trustRows: [
      {
        category: 'Freshness mix',
        details: findings.some((f) => f.freshness === 'Lagged' || f.freshness === 'Provisional')
          ? 'Includes lagged or provisional inputs beside nearer-current claims.'
          : 'Included findings are nearer-current / recent in this session slice.',
        mitigation: 'Show freshness chips; do not juxtapose without labels.',
      },
      {
        category: 'Source incentives',
        details: 'Mix of claims warehouse, HEDIS-style, and MCO-reported encounters.',
        mitigation: 'Name owners; shrink visual weight for incentive-skewed sources.',
      },
      {
        category: 'Coverage / suppression',
        details: 'Legislative views are aggregate only; cell suppression applies.',
        mitigation: 'No PHI; document min cell-size rules on definitions page.',
      },
    ],
    constituentNarrative:
      findings.length > 0
        ? `For constituents, the story is not a wall of charts—it is where care is getting harder to reach, where costs are rising fastest, and what oversight levers exist. District framing should stay aggregate and avoid implying individual outcomes.`
        : `Blend findings to generate a constituent-facing narrative from the active evidence chain.`,
    talkingPoints: [
      'This is a decision-support brief, not a scorecard or prescription.',
      'Lead with material changes, population concentration, and controllable vs expected drivers.',
      'Pair every finding with freshness, owner, and known limitations.',
      'Win-win-win packs are examination options with explicit tradeoffs.',
      'Pending-law notes reflect LRC-curated bill language until a Director-approved live feed is linked.',
    ],
    trustWarning: hasLaggedOrProvisional
      ? 'Trust context incomplete or includes lagged/provisional inputs. Review caveats before legislative use.'
      : trustReviewed
        ? 'Trust stage reviewed for included inputs.'
        : 'Trust stage not yet marked reviewed in the blender spine. Review caveats before legislative use.',
    overallQuality: findings.some((f) => f.freshness === 'Lagged' || f.freshness === 'Provisional')
      ? 'Medium'
      : findings.length
        ? 'Medium-High'
        : 'Incomplete',
    evidenceRecency: findings.length ? 'Mixed' : 'None loaded',
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
