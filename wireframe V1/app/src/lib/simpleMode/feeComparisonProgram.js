// CodeXen-Container: v1 kind=program container=FeeComparison
/**
 * FeeComparison: program container for plan item #24, the normalization every
 * Medicaid fee comparison passes through before it reaches the page
 * (Indiana Secretary Sachdev, subcommittee 2026-10-28: dollars, not
 * percentages; the same bundle; Medicare as the common benchmark).
 *
 * Rules applied, in order. A rate is compared only when it:
 *   1. is for the chosen procedure code;
 *   2. is for the chosen setting (facility, non-facility, or n/a for unsplit codes);
 *   3. is a posted dollar rate, never a chargemaster charge;
 *   4. is in the same unit of service as the comparison's reference unit;
 *   5. is the state's primary practitioner tier;
 *   6. is not flagged not comparable (a state defines the code differently);
 *   7. has a percent of Medicare that agrees with its dollars and its Medicare
 *      amount (within half a point).
 * Each excluded rate keeps its reason so the page can say why it is missing.
 *
 * Reads published research rows (sourced fees); writes nothing. Run cycle:
 * stage RateRows (through stageRateRow, the boundary normalization),
 * SelectedCode, SelectedSetting; CompareRatesOnNormalizedBasis; read
 * ComparedRows, ExcludedRows, ReferenceUnit and the counters. Each run restores
 * run state to INITIAL first; the page creates one instance per recompute.
 */

export const PERCENT_AGREEMENT_POINTS = 0.5;
const CHARGE_POSTING = /\bcharge(master)?s?\b|\bbilled charges?\b/i;

/**
 * Boundary normalization for one published rate row: numbers stay numbers, a
 * missing percent of Medicare becomes 0 with percentOfMedicareIsPublished false,
 * and missing text becomes ''. Nothing null reaches the container.
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
    medicareAmount: Number.isFinite(row?.medicareAmount) ? row.medicareAmount : 0,
    pctOfMedicare: published ? row.pctOfMedicare : 0,
    percentOfMedicareIsPublished: published,
    comparable: row?.comparable !== false,
    comparableReason: String(row?.comparableReason || ''),
    primary: row?.primary !== false,
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
    this.ResetFeeComparisonRun();
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
}
