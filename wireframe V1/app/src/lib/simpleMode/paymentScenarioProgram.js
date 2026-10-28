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
 *   same percent as its paid amount.
 * It is an illustration on published aggregates, not a forecast, and it writes
 * nothing. It reads published county rows owned by their sources.
 *
 * Run cycle: InitializePaymentScenario, stage CountyPayments, CountyIndex,
 * RedirectSharePct; ModelPaymentRedistribution; read CountyOutcomes,
 * NonmetroShareBefore/After and NonmetroPaymentChangePct.
 * Runs are synchronous, so one instance per page serves every recompute.
 */

export const REDIRECT_SHARE_MAX_PCT = 25;

export class PaymentRedistributionScenario {
  constructor() {
    this.InitializePaymentScenario();
  }

  InitializePaymentScenario() {
    // Inputs staged by the caller.
    this.CountyPayments = [];   // [{ fips, paid, metro }] published paid amounts by county
    this.CountyIndex = [];      // [{ fips, index }] deprivation index 0–100
    this.RedirectSharePct = 0;  // share of the pool redirected, 0 to REDIRECT_SHARE_MAX_PCT
    // Run state.
    this.IndexByCounty = new Map();
    this.ScenarioRows = [];
    this.PoolTotal = 0;
    this.RedirectedTotal = 0;
    this.WeightTotal = 0;
    this.CountiesWithoutIndex = 0;
    this.RedirectShareIsValid = false;
    // Outputs.
    this.CountyOutcomes = [];   // [{ fips, metro, before, after, change, changePct }]
    this.NonmetroShareBefore = 0;
    this.NonmetroShareAfter = 0;
    this.NonmetroPaymentChangePct = 0;
    this.MetroPaymentChangePct = 0;
    this.Errors = [];
  }

  // Business Action
  ModelPaymentRedistribution() {
    this.ResetScenarioRun();
    this.IsRedirectShareValid();
    if (!this.RedirectShareIsValid) return;
    this.IndexCountyDeprivation();
    this.StageScenarioRows();
    this.CountCountiesWithoutIndex();
    this.TotalThePool();
    this.CalculateRedirectedTotal();
    this.CalculateDeprivationWeights();
    this.RedistributeRedirectedTotal();
    this.SummarizeByRurality();
    this.PublishCountyOutcomes();
  }

  // PASSIVE: clear the previous run's state so a recompute starts from INITIAL values.
  ResetScenarioRun() {
    this.IndexByCounty = new Map();
    this.ScenarioRows = [];
    this.PoolTotal = 0;
    this.RedirectedTotal = 0;
    this.WeightTotal = 0;
    this.CountiesWithoutIndex = 0;
    this.RedirectShareIsValid = false;
    this.CountyOutcomes = [];
    this.NonmetroShareBefore = 0;
    this.NonmetroShareAfter = 0;
    this.NonmetroPaymentChangePct = 0;
    this.MetroPaymentChangePct = 0;
    this.Errors = [];
  }

  // Question: is the chosen share within the scenario's range?
  IsRedirectShareValid() {
    this.RedirectShareIsValid = Number.isFinite(this.RedirectSharePct)
      && this.RedirectSharePct >= 0
      && this.RedirectSharePct <= REDIRECT_SHARE_MAX_PCT;
    if (!this.RedirectShareIsValid) this.Errors.push(`Choose a share from 0 to ${REDIRECT_SHARE_MAX_PCT} percent.`);
  }

  // PASSIVE: deprivation index by county.
  IndexCountyDeprivation() {
    this.IndexByCounty = new Map(this.CountyIndex.filter((c) => Number.isFinite(c.index)).map((c) => [c.fips, c.index]));
  }

  // PASSIVE: one working row per county with a published paid amount.
  StageScenarioRows() {
    this.ScenarioRows = this.CountyPayments
      .filter((c) => Number.isFinite(c.paid) && c.paid >= 0)
      .map((c) => ({ fips: c.fips, metro: c.metro === true, before: c.paid, index: this.IndexByCounty.get(c.fips) ?? 0, weight: 0, after: c.paid }));
  }

  // PASSIVE: counties with no index receive nothing back; count them for the page.
  CountCountiesWithoutIndex() {
    this.CountiesWithoutIndex = this.ScenarioRows.filter((r) => !this.IndexByCounty.has(r.fips)).length;
  }

  // PASSIVE: the pool is the sum of county paid amounts.
  TotalThePool() {
    this.PoolTotal = this.ScenarioRows.reduce((sum, r) => sum + r.before, 0);
  }

  // PASSIVE: the amount each county gives up, in total.
  CalculateRedirectedTotal() {
    this.RedirectedTotal = this.PoolTotal * (this.RedirectSharePct / 100);
  }

  // PASSIVE: a county's claim on the redirected amount is its paid amount times its index.
  CalculateDeprivationWeights() {
    this.ScenarioRows.forEach((r) => { r.weight = r.before * r.index; });
    this.WeightTotal = this.ScenarioRows.reduce((sum, r) => sum + r.weight, 0);
  }

  // PASSIVE: give up the share everywhere, return the redirected total by weight.
  RedistributeRedirectedTotal() {
    if (this.WeightTotal === 0) return;
    this.ScenarioRows.forEach((r) => {
      r.after = r.before * (1 - this.RedirectSharePct / 100) + this.RedirectedTotal * (r.weight / this.WeightTotal);
    });
  }

  // PASSIVE: nonmetro share of the pool and the change in nonmetro and metro payments.
  SummarizeByRurality() {
    const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);
    const nonmetro = this.ScenarioRows.filter((r) => !r.metro);
    const metro = this.ScenarioRows.filter((r) => r.metro);
    const total = sum(this.ScenarioRows, 'before');
    this.NonmetroShareBefore = total ? (sum(nonmetro, 'before') / total) * 100 : 0;
    this.NonmetroShareAfter = total ? (sum(nonmetro, 'after') / total) * 100 : 0;
    this.NonmetroPaymentChangePct = sum(nonmetro, 'before') ? ((sum(nonmetro, 'after') / sum(nonmetro, 'before')) - 1) * 100 : 0;
    this.MetroPaymentChangePct = sum(metro, 'before') ? ((sum(metro, 'after') / sum(metro, 'before')) - 1) * 100 : 0;
  }

  // PASSIVE: freeze the published outcomes.
  PublishCountyOutcomes() {
    this.CountyOutcomes = this.ScenarioRows.map((r) => Object.freeze({
      fips: r.fips,
      metro: r.metro,
      before: r.before,
      after: r.after,
      change: r.after - r.before,
      changePct: r.before ? ((r.after / r.before) - 1) * 100 : 0,
    }));
  }
}
