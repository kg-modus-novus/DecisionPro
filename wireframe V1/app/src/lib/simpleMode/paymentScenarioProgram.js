// CodeXen-Container: v1 kind=program container=PaymentRedistributionScenario
/**
 * PaymentRedistributionScenario: program container for the "what if part of a
 * payment pool followed deprivation?" scenario (plan items #6 and #12; Sen.
 * Meredith, subcommittee 2026-10-28: redirect payments to the neediest areas so
 * practitioners don't practice rural medicine at a discount).
 *
 * Rule modeled, stated plainly on the page:
 * - each county gives up the chosen share of its current paid amount;
 * - the amount given up is returned to counties in proportion to their current
 *   paid amount times their deprivation index (0–100);
 * - visits are held constant, so a county's paid amount per visit moves by the
 *   same percent as its paid amount, and the published rural-vs-metro gap in
 *   paid amount per visit moves with the nonmetro and metro totals.
 * It is an illustration on published aggregates, not a forecast, and it writes
 * nothing. It reads published county rows owned by their sources.
 *
 * Run cycle: stage CountyPayments, CountyIndex, RedirectSharePct and, when
 * published, RuralUrbanPaymentGapPct; ModelPaymentRedistribution; read
 * CountyOutcomes, the rurality summary, RuralUrbanPaymentGapAfterPct and the
 * counters. Each run restores run state to INITIAL first, so the page may
 * create one instance per recompute or reuse one; it creates one per recompute.
 */

export const REDIRECT_SHARE_MAX_PCT = 25;

export class PaymentRedistributionScenario {
  constructor() {
    this.InitializePaymentScenario();
  }

  InitializePaymentScenario() {
    // Inputs staged by the caller (normalized at the boundary: numbers or the INITIAL value).
    this.CountyPayments = [];          // [{ fips, paid, metro }] published paid amounts by county
    this.CountyIndex = [];             // [{ fips, index }] deprivation index 0–100
    this.RedirectSharePct = 0;         // share of the pool redirected, 0 to REDIRECT_SHARE_MAX_PCT
    this.RuralUrbanPaymentGapPct = 0;  // published nonmetro vs metro paid per visit, percent
    this.RuralUrbanPaymentGapIsPublished = false;
    this.ResetScenarioRun();
  }

  // Business Action
  ModelPaymentRedistribution() {
    this.ResetScenarioRun();
    this.IsRedirectShareValid();
    if (!this.RedirectShareIsValid) {
      this.RejectRedirectShareOutOfRange();
      return;
    }
    this.IndexCountyDeprivation();
    this.StageScenarioRows();
    this.CountCountiesWithoutPayment();
    this.CountCountiesWithoutIndex();
    this.TotalThePool();
    this.CalculateDeprivationWeights();
    this.HasDeprivationWeight();
    if (!this.DeprivationWeightIsPresent) {
      this.RejectScenarioWithoutWeight();
      return;
    }
    this.CalculateRedirectedTotal();
    this.RedistributeRedirectedTotal();
    this.TotalByRurality();
    this.SummarizeByRurality();
    this.CalculatePaymentGapAfterScenario();
    this.PublishCountyOutcomes();
  }

  // PASSIVE: restore run state and outputs to INITIAL; staged inputs are kept.
  ResetScenarioRun() {
    this.IndexByCounty = new Map();
    this.ScenarioRows = [];
    this.PoolTotal = 0;
    this.RedirectedTotal = 0;
    this.WeightTotal = 0;
    this.CountiesWithoutIndex = 0;
    this.CountiesWithoutPayment = 0;
    this.RedirectShareIsValid = false;
    this.DeprivationWeightIsPresent = false;
    this.NonmetroPaidBefore = 0;
    this.NonmetroPaidAfter = 0;
    this.MetroPaidBefore = 0;
    this.MetroPaidAfter = 0;
    this.CountyOutcomes = [];
    this.NonmetroShareBefore = 0;
    this.NonmetroShareAfter = 0;
    this.NonmetroPaymentChangePct = 0;
    this.MetroPaymentChangePct = 0;
    this.RuralUrbanPaymentGapAfterPct = 0;
    this.Errors = [];
  }

  // Question: is the chosen share within the scenario's range?
  IsRedirectShareValid() {
    this.RedirectShareIsValid = Number.isFinite(this.RedirectSharePct)
      && this.RedirectSharePct >= 0
      && this.RedirectSharePct <= REDIRECT_SHARE_MAX_PCT;
  }

  // PASSIVE: say why nothing was modeled.
  RejectRedirectShareOutOfRange() {
    this.Errors.push(`Choose a share from 0 to ${REDIRECT_SHARE_MAX_PCT} percent.`);
  }

  // PASSIVE: deprivation index by county.
  IndexCountyDeprivation() {
    this.IndexByCounty = new Map(this.CountyIndex.filter((c) => Number.isFinite(c.index)).map((c) => [c.fips, c.index]));
  }

  // PASSIVE: one working row per county with a published, non-negative paid amount.
  StageScenarioRows() {
    this.ScenarioRows = this.CountyPayments
      .filter((c) => Number.isFinite(c.paid) && c.paid >= 0)
      .map((c) => ({ fips: c.fips, metro: c.metro === true, paid: c.paid, index: this.IndexByCounty.get(c.fips) ?? 0, weight: 0, paidAfter: c.paid }));
  }

  // PASSIVE: counties left out because no usable paid amount is published.
  CountCountiesWithoutPayment() {
    this.CountiesWithoutPayment = this.CountyPayments.length - this.ScenarioRows.length;
  }

  // PASSIVE: counties with no index receive nothing back.
  CountCountiesWithoutIndex() {
    this.CountiesWithoutIndex = this.ScenarioRows.filter((r) => !this.IndexByCounty.has(r.fips)).length;
  }

  // PASSIVE: the pool is the sum of county paid amounts.
  TotalThePool() {
    this.PoolTotal = this.ScenarioRows.reduce((sum, r) => sum + r.paid, 0);
  }

  // PASSIVE: a county's claim on the redirected amount is its paid amount times its index.
  CalculateDeprivationWeights() {
    this.ScenarioRows.forEach((r) => { r.weight = r.paid * r.index; });
    this.WeightTotal = this.ScenarioRows.reduce((sum, r) => sum + r.weight, 0);
  }

  // Question: is there any deprivation weight to redistribute by?
  HasDeprivationWeight() {
    this.DeprivationWeightIsPresent = this.WeightTotal > 0;
  }

  // PASSIVE: with no weight, nothing can be redistributed; nothing is redirected.
  RejectScenarioWithoutWeight() {
    this.Errors.push('No county has both a paid amount and a deprivation score, so nothing can be redistributed.');
  }

  // PASSIVE: the amount every county gives up, in total.
  CalculateRedirectedTotal() {
    this.RedirectedTotal = this.PoolTotal * (this.RedirectSharePct / 100);
  }

  // PASSIVE: give up the share everywhere, return the redirected total by weight.
  RedistributeRedirectedTotal() {
    this.ScenarioRows.forEach((r) => {
      r.paidAfter = r.paid * (1 - this.RedirectSharePct / 100) + this.RedirectedTotal * (r.weight / this.WeightTotal);
    });
  }

  // PASSIVE: nonmetro and metro totals before and after.
  TotalByRurality() {
    this.ScenarioRows.forEach((r) => {
      if (r.metro) {
        this.MetroPaidBefore += r.paid;
        this.MetroPaidAfter += r.paidAfter;
      } else {
        this.NonmetroPaidBefore += r.paid;
        this.NonmetroPaidAfter += r.paidAfter;
      }
    });
  }

  // PASSIVE: nonmetro share of the pool and the change in nonmetro and metro payments.
  SummarizeByRurality() {
    this.NonmetroShareBefore = this.PoolTotal ? (this.NonmetroPaidBefore / this.PoolTotal) * 100 : 0;
    this.NonmetroShareAfter = this.PoolTotal ? (this.NonmetroPaidAfter / this.PoolTotal) * 100 : 0;
    this.NonmetroPaymentChangePct = this.NonmetroPaidBefore ? ((this.NonmetroPaidAfter / this.NonmetroPaidBefore) - 1) * 100 : 0;
    this.MetroPaymentChangePct = this.MetroPaidBefore ? ((this.MetroPaidAfter / this.MetroPaidBefore) - 1) * 100 : 0;
  }

  // PASSIVE: with visits held constant, the per-visit gap moves with the two totals.
  CalculatePaymentGapAfterScenario() {
    if (!this.RuralUrbanPaymentGapIsPublished) return;
    this.RuralUrbanPaymentGapAfterPct = ((1 + this.RuralUrbanPaymentGapPct / 100)
      * (1 + this.NonmetroPaymentChangePct / 100)
      / (1 + this.MetroPaymentChangePct / 100) - 1) * 100;
  }

  // PASSIVE: freeze the published outcomes.
  PublishCountyOutcomes() {
    this.CountyOutcomes = this.ScenarioRows.map((r) => Object.freeze({
      fips: r.fips,
      metro: r.metro,
      paid: r.paid,
      paidAfter: r.paidAfter,
      change: r.paidAfter - r.paid,
      changePct: r.paid ? ((r.paidAfter / r.paid) - 1) * 100 : 0,
    }));
  }
}
