// CodeXen-Container: v1 kind=program container=FeeComparison
/**
 * FeeComparison: program container for plan item #24, the normalization every
 * fee and price comparison passes through before it reaches the page
 * (Indiana Secretary Sachdev, subcommittee 2026-10-28: dollars, not
 * percentages; the same bundle; Medicare as the common benchmark).
 *
 * Rules applied, in order. A rate is compared only when it:
 *   1. is for the chosen procedure code;
 *   2. is a posted dollar rate, never a chargemaster charge;
 *   3. is for the chosen setting (facility, non-facility, or n/a for unsplit codes);
 *   4. is in the same unit of service as the comparison's reference unit;
 *   5. is the state's primary practitioner tier;
 *   6. is not flagged not comparable (a state defines the code differently);
 *   7. has a percent of Medicare that agrees with its dollars and its Medicare
 *      amount (within half a point).
 * Each excluded rate keeps its reason so the page can say why it is missing.
 *
 * Reads published research rows (sourced fees); writes nothing. Run cycle:
 * InitializeFeeComparison, stage RateRows, SelectedCode, SelectedSetting;
 * CompareRatesOnNormalizedBasis; read ComparedRows, ExcludedRows, ReferenceUnit.
 */

export const PERCENT_AGREEMENT_POINTS = 0.5;
const CHARGE_POSTING = /charge(master)?s?\b|\bbilled charge/i;

export class FeeComparison {
  constructor() {
    this.InitializeFeeComparison();
  }

  InitializeFeeComparison() {
    // Inputs staged by the caller.
    this.RateRows = [];          // normalized research rows (hcpcs, unit, setting, value, posted, pctOfMedicare, medicareAmount, comparable, primary, state)
    this.SelectedCode = '';
    this.SelectedSetting = '';
    // Run state.
    this.SelectionIsComplete = false;
    this.CandidateRows = [];
    this.ReferenceUnit = '';
    // Outputs.
    this.ComparedRows = [];
    this.ExcludedRows = [];      // [{ state, label, reason }]
    this.ComparedRowCount = 0;
    this.ExcludedRowCount = 0;
    this.Errors = [];
  }

  // Business Action
  CompareRatesOnNormalizedBasis() {
    this.ResetFeeComparisonRun();
    this.IsSelectionComplete();
    if (!this.SelectionIsComplete) return;
    this.StageRowsForChosenCode();
    this.ExcludeChargePostings();
    this.ExcludeOtherSettings();
    this.FindReferenceUnit();
    this.ExcludeOtherUnits();
    this.ExcludeNonPrimaryTiers();
    this.ExcludeRatesNotComparable();
    this.ExcludeDisagreeingPercentOfMedicare();
    this.PublishComparedRates();
  }

  // PASSIVE: every recompute starts from INITIAL run state.
  ResetFeeComparisonRun() {
    this.SelectionIsComplete = false;
    this.CandidateRows = [];
    this.ReferenceUnit = '';
    this.ComparedRows = [];
    this.ExcludedRows = [];
    this.ComparedRowCount = 0;
    this.ExcludedRowCount = 0;
    this.Errors = [];
  }

  // Question: has the caller chosen both a code and a setting?
  IsSelectionComplete() {
    this.SelectionIsComplete = this.SelectedCode !== '' && this.SelectedSetting !== '';
    if (!this.SelectionIsComplete) this.Errors.push('Choose a procedure code and a setting.');
  }

  // PASSIVE: rule 1, the chosen code only.
  StageRowsForChosenCode() {
    this.CandidateRows = this.RateRows.filter((r) => r.hcpcs === this.SelectedCode);
  }

  // PASSIVE: rule 2, a chargemaster charge is never compared.
  ExcludeChargePostings() {
    this.CandidateRows = this.CandidateRows.filter((r) => {
      if (!CHARGE_POSTING.test(String(r.posted || ''))) return true;
      this.ExcludedRows.push({ state: r.state, label: r.label, reason: 'a charge, not a payment rate' });
      return false;
    });
  }

  // PASSIVE: rule 3, the chosen setting only.
  ExcludeOtherSettings() {
    this.CandidateRows = this.CandidateRows.filter((r) => r.setting === this.SelectedSetting);
  }

  // PASSIVE: the unit Kentucky's rate is posted in, or else the most common unit.
  FindReferenceUnit() {
    const kentucky = this.CandidateRows.find((r) => r.state === 'KY' && r.primary !== false);
    if (kentucky) {
      this.ReferenceUnit = kentucky.unit;
      return;
    }
    const counts = new Map();
    this.CandidateRows.forEach((r) => counts.set(r.unit, (counts.get(r.unit) || 0) + 1));
    this.ReferenceUnit = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
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
    this.CandidateRows = this.CandidateRows.filter((r) => r.primary !== false);
  }

  // PASSIVE: rule 6, codes a state defines differently.
  ExcludeRatesNotComparable() {
    this.CandidateRows = this.CandidateRows.filter((r) => {
      if (r.comparable !== false) return true;
      this.ExcludedRows.push({ state: r.state, label: r.label, reason: r.comparableReason || 'defined differently in this state' });
      return false;
    });
  }

  // PASSIVE: rule 7, the percent of Medicare must agree with the dollars.
  ExcludeDisagreeingPercentOfMedicare() {
    this.CandidateRows = this.CandidateRows.filter((r) => {
      if (!Number.isFinite(r.pctOfMedicare) || !Number.isFinite(r.medicareAmount) || !Number.isFinite(r.value) || r.medicareAmount === 0) return true;
      const recomputed = (r.value / r.medicareAmount) * 100;
      if (Math.abs(recomputed - r.pctOfMedicare) <= PERCENT_AGREEMENT_POINTS) return true;
      this.ExcludedRows.push({ state: r.state, label: r.label, reason: 'its percent of Medicare does not match its dollars' });
      return false;
    });
  }

  // PASSIVE: highest percent of Medicare first; freeze what is published.
  PublishComparedRates() {
    this.ComparedRows = [...this.CandidateRows]
      .sort((a, b) => (b.pctOfMedicare ?? -1) - (a.pctOfMedicare ?? -1))
      .map((r) => Object.freeze({ ...r }));
    this.ComparedRowCount = this.ComparedRows.length;
    this.ExcludedRowCount = this.ExcludedRows.length;
  }
}
