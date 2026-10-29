// CodeXen-Container: v1 kind=program container=FeeComparison
/**
 * FeeComparison: program container for plan item #24, the normalization every
 * Medicaid fee comparison passes through before it reaches the page
 * (Indiana Secretary Sachdev, subcommittee 2026-10-28: dollars, not
 * percentages; the same bundle; Medicare as the common benchmark).
 *
 * Business Actions:
 *   CompareRatesOnNormalizedBasis      Medicaid rates for one code and setting, by state;
 *   MeasureRateSpreadOnNormalizedBasis how far one service's rates spread between states;
 *   CompareClaimPaymentsAcrossStates   T-MSIS paid amounts for one code, by state.
 *
 * CompareRatesOnNormalizedBasis rules, in order. A rate is compared only when it:
 *   1. is for the chosen procedure code;
 *   2. is for the chosen setting (facility, non-facility, or n/a for unsplit codes);
 *   3. is a posted dollar rate, never a chargemaster charge (a rate posted only as
 *      a percent of Medicare is converted to dollars first, and keeps its posting);
 *   4. is in the same unit of service as the comparison's reference unit;
 *   5. is the state's primary practitioner tier;
 *   6. is not flagged not comparable (a state defines the code differently);
 *   7. has a percent of Medicare that agrees with its dollars and its Medicare
 *      amount (within half a point).
 * Each excluded rate keeps its reason so the page can say why it is missing,
 * and each compared rate carries the bundle its setting pays for (BUNDLES).
 *
 * MeasureRateSpreadOnNormalizedBasis applies rules 3, 4 and 6 to one service's
 * spread rows, keeps a rate whose setting matches Kentucky's or is not split
 * ('n/a': the code has no facility split), then measures the highest and lowest
 * neighbor and Kentucky against them.
 *
 * CompareClaimPaymentsAcrossStates keeps a state only when its figure is
 * published, it has claim lines, and CMS does not rate its data unusable; it
 * then ranks the states and takes their median. The source pools units,
 * modifiers and settings, so no percent of Medicare is computed for it.
 *
 * Reads published research rows (sourced fees and tmsis); writes nothing. Run cycle:
 * stage RateRows (through stageRateRow, the boundary normalization),
 * SelectedCode, SelectedSetting; CompareRatesOnNormalizedBasis; read
 * ComparedRows, ExcludedRows, ReferenceUnit and the counters. Each run restores
 * run state to INITIAL first; the page creates one instance per recompute.
 */

export const PERCENT_AGREEMENT_POINTS = 0.5;
const CHARGE_POSTING = /\bcharge(master)?s?\b|\bbilled charges?\b/i;
const UNUSABLE_DATA = /\bunusable\b/i;

/** What a rate in each setting pays for, so only like bundles are compared (Secretary Sachdev). */
export const BUNDLES = Object.freeze({
  'non-facility': 'Professional fee including office costs (practice expense)',
  facility: 'Professional fee only; the hospital or facility bills its own fee separately',
  'n/a': 'One rate for the whole service (not split by setting)',
});

/**
 * Boundary normalization for one published rate row: numbers stay numbers, a
 * missing percent of Medicare becomes 0 with percentOfMedicareIsPublished false,
 * a missing or zero Medicare amount becomes 0 with medicareAmountIsPublished
 * false, a research-sheet column prefix ("col3 ") is dropped from the tier, and
 * missing text becomes ''. Nothing null reaches the container.
 */
export function stageRateRow(row) {
  const published = Number.isFinite(row?.pctOfMedicare);
  return {
    ...row,
    state: String(row?.state || ''),
    hcpcs: String(row?.hcpcs || ''),
    setting: String(row?.setting || ''),
    unit: String(row?.unit || ''),
    posted: String(row?.posted || ''),
    value: Number.isFinite(row?.value) ? row.value : 0,
    valueIsPublished: Number.isFinite(row?.value),
    medicareAmount: Number.isFinite(row?.medicareAmount) && row.medicareAmount > 0 ? row.medicareAmount : 0,
    medicareAmountIsPublished: Number.isFinite(row?.medicareAmount) && row.medicareAmount > 0,
    practitionerTier: String(row?.practitionerTier || '').replace(/^col\d+\s+/i, ''),
    pctOfMedicare: published ? row.pctOfMedicare : 0,
    percentOfMedicareIsPublished: published,
    comparable: row?.comparable !== false,
    comparableReason: String(row?.comparableReason || ''),
    primary: row?.primary !== false,
  };
}

/** Boundary normalization for a spread row, whose key is the state and which has no tier split. */
export function stageSpreadRow(row) {
  return stageRateRow({ ...row, state: row?.state || row?.key, primary: true });
}

/** Boundary normalization for a T-MSIS state row: numbers stay numbers, text becomes ''. */
export function stageClaimRow(row) {
  return {
    key: String(row?.key || ''),
    label: String(row?.label || row?.key || ''),
    value: Number.isFinite(row?.value) ? row.value : 0,
    valueIsPublished: Number.isFinite(row?.value),
    claimLines: Number.isFinite(row?.claimLines) ? row.claimLines : 0,
    dataQuality: String(row?.dqFlag || ''),
    dataUnusable: row?.greyOut === true || UNUSABLE_DATA.test(String(row?.dqFlag || '')),
  };
}

export class FeeComparison {
  constructor() {
    this.InitializeFeeComparison();
  }

  InitializeFeeComparison() {
    // Inputs staged by the caller, each row through stageRateRow.
    this.RateRows = [];
    this.SelectedCode = '';
    this.SelectedSetting = '';
    this.SpreadRows = [];        // one service's rows by state, each through stageSpreadRow
    this.ClaimRows = [];         // one T-MSIS measure's rows by state, each through stageClaimRow
    this.ResetFeeComparisonRun();
    this.ResetRateSpreadRun();
    this.ResetClaimComparisonRun();
  }

  // Business Action
  CompareRatesOnNormalizedBasis() {
    this.ResetFeeComparisonRun();
    this.IsSelectionComplete();
    if (!this.SelectionIsComplete) {
      this.RejectIncompleteSelection();
      return;
    }
    this.StageRowsForChosenCode();
    this.ExcludeOtherSettings();
    this.ExcludeChargePostings();
    this.ConvertPercentPostingsToDollars();
    this.LabelRateBundles();
    this.FindKentuckyReferenceRows();
    this.CountUnitFrequency();
    this.FindReferenceUnit();
    this.ExcludeOtherUnits();
    this.ExcludeNonPrimaryTiers();
    this.ExcludeRatesNotComparable();
    this.ExcludeDisagreeingPercentOfMedicare();
    this.PublishComparedRates();
  }

  // PASSIVE: restore run state and outputs to INITIAL; staged inputs are kept.
  ResetFeeComparisonRun() {
    this.SelectionIsComplete = false;
    this.CandidateRows = [];
    this.KentuckyReferenceRows = [];
    this.KentuckyReferenceRowCount = 0;
    this.UnitFrequency = new Map();
    this.ReferenceUnit = '';
    this.ComparedRows = [];
    this.ExcludedRows = [];      // [{ state, label, reason }]
    this.ComparedRowCount = 0;
    this.ExcludedRowCount = 0;
    this.ConvertedRowCount = 0;
    this.ComparedBundle = '';
    this.Errors = [];
  }

  // Question: has the caller chosen both a code and a setting?
  IsSelectionComplete() {
    this.SelectionIsComplete = this.SelectedCode !== '' && this.SelectedSetting !== '';
  }

  // PASSIVE: say why nothing was compared.
  RejectIncompleteSelection() {
    this.Errors.push('Choose a procedure code and a setting.');
  }

  // PASSIVE: rule 1, the chosen code only.
  StageRowsForChosenCode() {
    this.CandidateRows = this.RateRows.filter((r) => r.hcpcs === this.SelectedCode);
  }

  // PASSIVE: rule 2, the chosen setting only.
  ExcludeOtherSettings() {
    this.CandidateRows = this.CandidateRows.filter((r) => r.setting === this.SelectedSetting);
  }

  // PASSIVE: rule 3, a chargemaster charge is never compared.
  ExcludeChargePostings() {
    this.CandidateRows = this.CandidateRows.filter((r) => {
      if (!CHARGE_POSTING.test(r.posted)) return true;
      this.ExcludedRows.push({ state: r.state, label: r.label, reason: 'a charge, not a payment rate' });
      return false;
    });
  }

  // PASSIVE: a rate posted only as a percent of Medicare becomes dollars; the posting is kept.
  ConvertPercentPostingsToDollars() {
    this.CandidateRows = this.CandidateRows.map((r) => {
      if (r.valueIsPublished || !r.percentOfMedicareIsPublished || r.medicareAmount === 0) return r;
      this.ConvertedRowCount += 1;
      return { ...r, value: Math.round(r.medicareAmount * r.pctOfMedicare) / 100, valueIsPublished: true, convertedFromPercent: true };
    });
  }

  // PASSIVE: every candidate carries the bundle its setting pays for; one setting means one bundle.
  LabelRateBundles() {
    this.ComparedBundle = BUNDLES[this.SelectedSetting] || '';
    this.CandidateRows = this.CandidateRows.map((r) => ({ ...r, bundle: BUNDLES[r.setting] || '' }));
  }

  // PASSIVE: Kentucky's own primary rate for the code and setting, if posted.
  FindKentuckyReferenceRows() {
    this.KentuckyReferenceRows = this.CandidateRows.filter((r) => r.state === 'KY' && r.primary);
    this.KentuckyReferenceRowCount = this.KentuckyReferenceRows.length;
  }

  // PASSIVE: how many candidate rates are posted in each unit.
  CountUnitFrequency() {
    this.CandidateRows.forEach((r) => this.UnitFrequency.set(r.unit, (this.UnitFrequency.get(r.unit) || 0) + 1));
  }

  // PASSIVE: the unit Kentucky's rate is posted in, or else the most common unit.
  FindReferenceUnit() {
    this.ReferenceUnit = this.KentuckyReferenceRowCount > 0
      ? this.KentuckyReferenceRows[0].unit
      : [...this.UnitFrequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  }

  // PASSIVE: rule 4, one unit of service.
  ExcludeOtherUnits() {
    this.CandidateRows = this.CandidateRows.filter((r) => {
      if (r.unit === this.ReferenceUnit) return true;
      this.ExcludedRows.push({ state: r.state, label: r.label, reason: `priced per ${r.unit}, not per ${this.ReferenceUnit}` });
      return false;
    });
  }

  // PASSIVE: rule 5, the state's primary practitioner tier.
  ExcludeNonPrimaryTiers() {
    this.CandidateRows = this.CandidateRows.filter((r) => r.primary);
  }

  // PASSIVE: rule 6, codes a state defines differently.
  ExcludeRatesNotComparable() {
    this.CandidateRows = this.CandidateRows.filter((r) => {
      if (r.comparable) return true;
      this.ExcludedRows.push({ state: r.state, label: r.label, reason: r.comparableReason || 'defined differently in this state' });
      return false;
    });
  }

  // PASSIVE: rule 7, a published percent of Medicare must agree with the dollars.
  ExcludeDisagreeingPercentOfMedicare() {
    this.CandidateRows = this.CandidateRows.filter((r) => {
      if (!r.percentOfMedicareIsPublished || !r.valueIsPublished || r.medicareAmount === 0) return true;
      if (Math.abs((r.value / r.medicareAmount) * 100 - r.pctOfMedicare) <= PERCENT_AGREEMENT_POINTS) return true;
      this.ExcludedRows.push({ state: r.state, label: r.label, reason: 'its percent of Medicare does not match its dollars' });
      return false;
    });
  }

  // PASSIVE: highest published percent of Medicare first; freeze what is published.
  PublishComparedRates() {
    this.ComparedRows = [...this.CandidateRows]
      .sort((a, b) => (Number(b.percentOfMedicareIsPublished) - Number(a.percentOfMedicareIsPublished)) || (b.pctOfMedicare - a.pctOfMedicare))
      .map((r) => Object.freeze({ ...r }));
    this.ComparedRowCount = this.ComparedRows.length;
    this.ExcludedRowCount = this.ExcludedRows.length;
  }

  // ---- MeasureRateSpreadOnNormalizedBasis ------------------------------------------------

  // Business Action
  MeasureRateSpreadOnNormalizedBasis() {
    this.ResetRateSpreadRun();
    this.StageSpreadCandidates();
    this.ExcludeSpreadRatesNotComparable();
    this.ExcludeSpreadRowsWithoutRate();
    this.ExcludeSpreadChargePostings();
    this.FindKentuckySpreadRow();
    this.FindSpreadReference();
    this.ExcludeSpreadOtherUnits();
    this.ExcludeSpreadOtherSettings();
    this.LabelSpreadBundles();
    this.RankNeighborSpreadRates();
    this.IsSpreadMeasurable();
    if (!this.SpreadIsMeasurable) {
      this.RejectUnmeasurableSpread();
      return;
    }
    this.CalculateSpreadRatios();
  }

  // PASSIVE: restore spread run state and outputs to INITIAL; staged inputs are kept.
  ResetRateSpreadRun() {
    this.SpreadCandidateRows = [];
    this.SpreadExcludedRows = [];  // [{ state, label, reason }]
    this.KentuckySpreadRows = [];
    this.KentuckySpreadRowCount = 0;
    this.SpreadReferenceUnit = '';
    this.SpreadReferenceSetting = '';
    this.NeighborSpreadRows = [];
    this.NeighborSpreadRowCount = 0;
    this.SpreadIsMeasurable = false;
    this.KentuckySpreadRate = 0;
    this.HighestNeighborRow = null;
    this.LowestNeighborRow = null;
    this.HighestToLowestRatio = 0;
    this.KentuckyToHighestRatio = 0;
    this.KentuckyToLowestRatio = 0;
    this.SpreadErrors = [];
  }

  // PASSIVE: every staged spread row is a candidate.
  StageSpreadCandidates() {
    this.SpreadCandidateRows = [...this.SpreadRows];
  }

  // PASSIVE: rule 6, a service a state defines differently.
  ExcludeSpreadRatesNotComparable() {
    this.SpreadCandidateRows = this.SpreadCandidateRows.filter((r) => {
      if (r.comparable) return true;
      this.SpreadExcludedRows.push({ state: r.state, label: r.label, reason: r.comparableReason || 'defined differently in this state' });
      return false;
    });
  }

  // PASSIVE: a state with no published rate is not compared.
  ExcludeSpreadRowsWithoutRate() {
    this.SpreadCandidateRows = this.SpreadCandidateRows.filter((r) => {
      if (r.valueIsPublished && r.value > 0) return true;
      this.SpreadExcludedRows.push({ state: r.state, label: r.label, reason: 'no published rate' });
      return false;
    });
  }

  // PASSIVE: rule 3, a chargemaster charge is never compared.
  ExcludeSpreadChargePostings() {
    this.SpreadCandidateRows = this.SpreadCandidateRows.filter((r) => {
      if (!CHARGE_POSTING.test(r.posted)) return true;
      this.SpreadExcludedRows.push({ state: r.state, label: r.label, reason: 'a charge, not a payment rate' });
      return false;
    });
  }

  // PASSIVE: Kentucky's rate for the service, if posted.
  FindKentuckySpreadRow() {
    this.KentuckySpreadRows = this.SpreadCandidateRows.filter((r) => r.state === 'KY');
    this.KentuckySpreadRowCount = this.KentuckySpreadRows.length;
  }

  // PASSIVE: Kentucky's unit and setting, or else the most common unit and an unsplit setting.
  FindSpreadReference() {
    const counts = new Map();
    this.SpreadCandidateRows.forEach((r) => counts.set(r.unit, (counts.get(r.unit) || 0) + 1));
    this.SpreadReferenceUnit = this.KentuckySpreadRowCount > 0
      ? this.KentuckySpreadRows[0].unit
      : [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    this.SpreadReferenceSetting = this.KentuckySpreadRowCount > 0 ? this.KentuckySpreadRows[0].setting : 'n/a';
  }

  // PASSIVE: rule 4, one unit of service.
  ExcludeSpreadOtherUnits() {
    this.SpreadCandidateRows = this.SpreadCandidateRows.filter((r) => {
      if (r.unit === this.SpreadReferenceUnit) return true;
      this.SpreadExcludedRows.push({ state: r.state, label: r.label, reason: `priced per ${r.unit}, not per ${this.SpreadReferenceUnit}` });
      return false;
    });
  }

  // PASSIVE: rule 2 for spreads, Kentucky's setting, or a rate not split by setting.
  ExcludeSpreadOtherSettings() {
    this.SpreadCandidateRows = this.SpreadCandidateRows.filter((r) => {
      if (r.setting === this.SpreadReferenceSetting || r.setting === 'n/a' || this.SpreadReferenceSetting === 'n/a') return true;
      this.SpreadExcludedRows.push({ state: r.state, label: r.label, reason: `a ${r.setting} rate, not ${this.SpreadReferenceSetting}` });
      return false;
    });
  }

  // PASSIVE: every compared spread rate carries the bundle its setting pays for.
  LabelSpreadBundles() {
    this.SpreadCandidateRows = this.SpreadCandidateRows.map((r) => Object.freeze({ ...r, bundle: BUNDLES[r.setting] || '' }));
  }

  // PASSIVE: neighbors' rates, highest first.
  RankNeighborSpreadRates() {
    this.NeighborSpreadRows = this.SpreadCandidateRows.filter((r) => r.state !== 'KY').sort((a, b) => b.value - a.value);
    this.NeighborSpreadRowCount = this.NeighborSpreadRows.length;
  }

  // Question: are there at least two neighbors to measure a spread between?
  IsSpreadMeasurable() {
    this.SpreadIsMeasurable = this.NeighborSpreadRowCount >= 2;
  }

  // PASSIVE: say why no spread was measured.
  RejectUnmeasurableSpread() {
    this.SpreadErrors.push('Fewer than two neighboring states post a comparable rate for this service.');
  }

  // PASSIVE: highest and lowest neighbor, and Kentucky against each.
  CalculateSpreadRatios() {
    this.HighestNeighborRow = this.NeighborSpreadRows[0];
    this.LowestNeighborRow = this.NeighborSpreadRows[this.NeighborSpreadRowCount - 1];
    this.HighestToLowestRatio = Math.round((this.HighestNeighborRow.value / this.LowestNeighborRow.value) * 100) / 100;
    this.KentuckySpreadRate = this.KentuckySpreadRowCount > 0 ? this.KentuckySpreadRows[0].value : 0;
    this.KentuckyToHighestRatio = this.KentuckySpreadRate ? Math.round((this.KentuckySpreadRate / this.HighestNeighborRow.value) * 100) / 100 : 0;
    this.KentuckyToLowestRatio = this.KentuckySpreadRate ? Math.round((this.KentuckySpreadRate / this.LowestNeighborRow.value) * 100) / 100 : 0;
  }

  // ---- CompareClaimPaymentsAcrossStates --------------------------------------------------

  // Business Action
  CompareClaimPaymentsAcrossStates() {
    this.ResetClaimComparisonRun();
    this.StageClaimCandidates();
    this.ExcludeClaimRowsWithoutFigure();
    this.ExcludeUnusableClaimData();
    this.RankComparedClaimRows();
    this.FindClaimMedian();
    this.FindKentuckyClaimRank();
  }

  // PASSIVE: restore claim run state and outputs to INITIAL; staged inputs are kept.
  ResetClaimComparisonRun() {
    this.ClaimCandidateRows = [];
    this.ClaimComparedRows = [];
    this.ClaimExcludedRows = [];   // [{ key, label, reason }]
    this.ClaimComparedRowCount = 0;
    this.ClaimMedian = 0;
    this.KentuckyClaimRank = 0;
  }

  // PASSIVE: every staged state row is a candidate.
  StageClaimCandidates() {
    this.ClaimCandidateRows = [...this.ClaimRows];
  }

  // PASSIVE: a state with no figure or no claim lines is not compared.
  ExcludeClaimRowsWithoutFigure() {
    this.ClaimCandidateRows = this.ClaimCandidateRows.filter((r) => {
      if (r.valueIsPublished && r.claimLines > 0) return true;
      this.ClaimExcludedRows.push({ key: r.key, label: r.label, reason: 'no claims reported' });
      return false;
    });
  }

  // PASSIVE: a state whose data CMS rates unusable (DQ Atlas) is not compared.
  ExcludeUnusableClaimData() {
    this.ClaimCandidateRows = this.ClaimCandidateRows.filter((r) => {
      if (!r.dataUnusable) return true;
      this.ClaimExcludedRows.push({ key: r.key, label: r.label, reason: 'CMS rates its data unusable' });
      return false;
    });
  }

  // PASSIVE: highest first, ranked 1..n among compared states.
  RankComparedClaimRows() {
    this.ClaimComparedRows = [...this.ClaimCandidateRows]
      .sort((a, b) => b.value - a.value)
      .map((r, i) => Object.freeze({ ...r, rank: i + 1 }));
    this.ClaimComparedRowCount = this.ClaimComparedRows.length;
  }

  // PASSIVE: median of the compared states.
  FindClaimMedian() {
    const v = this.ClaimComparedRows.map((r) => r.value).sort((a, b) => a - b);
    const n = v.length;
    this.ClaimMedian = n === 0 ? 0 : n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  }

  // PASSIVE: Kentucky's rank among compared states (0 when not compared).
  FindKentuckyClaimRank() {
    this.KentuckyClaimRank = this.ClaimComparedRows.find((r) => r.key === 'KY')?.rank || 0;
  }
}
