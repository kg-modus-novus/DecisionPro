// CodeXen-Container: v1 kind=program container=LeveledDollarReallocation
/**
 * LeveledDollarReallocation: program container for the reallocation what-if,
 * "if the flagged dollars are fraud, where could they go?" (Director requirement
 * 2026-11-07). One Business Action, ModelLeveledDollarReallocation:
 *
 * - take one state's flagged services in the latest year (scored by
 *   PotentialFraudSignalReview) and keep those in the chosen scope: all, the
 *   HIGH tier only, or one service;
 * - level each to the chosen line and sum the dollars above it:
 *     enrollment line  national paid x the state's enrollment share
 *                      (the screen owner's figure, read as written);
 *     prior-year line  national paid x the state's prior-year share (owner's);
 *     peer-state line  national paid x the state's enrollment share x the median,
 *                      across the other states billing the code that year, of
 *                      (share of national paid / enrollment share);
 *   each floored at zero, with the national total held constant; the total
 *   above every line is written too, so each line can be compared before it is
 *   chosen;
 * - assume the chosen share is upheld on review; split what that frees by the
 *   state's FY2024 regular FMAP into federal and state money; the amount
 *   available is all of it when it stays inside Medicaid (the match is drawn
 *   again) or the state share only when it returns to the General Fund;
 * - pair it with documented needs (the catalog's, with any gap the reviewer
 *   edits or need the reviewer adds this session, staged by the caller): each
 *   need must carry a positive gap and a unit cost of zero or more; each
 *   allocation is held to the need's gap,
 *   over-allocation is reported with the allocations fitted to what is
 *   available, and people reached = allocation / unit cost (illustrative unit
 *   costs).
 *
 * A planning model, not a recovery: it writes nothing. Run cycle: stage the
 * inputs; ModelLeveledDollarReallocation; read the outputs and Errors. Each run
 * restores run state to INITIAL first.
 */

export const LEVELING_LINES = Object.freeze([
  { key: 'enrollment', label: 'Enrollment share' },
  { key: 'prior-year', label: 'Prior-year share' },
  { key: 'peer-state', label: 'Peer-state median' },
]);

export class LeveledDollarReallocation {
  constructor() {
    this.InitializeReallocation();
  }

  InitializeReallocation() {
    // Inputs staged by the caller (normalized at the boundary).
    this.State = '';                 // two-letter state
    this.Services = [];              // the state's scored service-years in the latest year
    this.LatestYearStatePaid = {};   // { hcpcs: [[state, paid], ...] } every state's paid that year
    this.EnrollmentShareByState = {};// { state: share } for the latest year (owner's figures)
    this.Line = 'enrollment';        // a LEVELING_LINES key
    this.Scope = 'all';              // 'all' | 'high' | 'service:<hcpcs>'
    this.UpheldSharePct = 60;        // 0..100
    this.FederalMatchingRate = 0;    // the state's FY2024 regular FMAP, 0..1
    this.Destination = 'medicaid';   // 'medicaid' | 'general-fund'
    this.Needs = [];                 // [{ id, label, gap > 0, unitCost >= 0, unitLabel }]
    this.Allocations = {};           // { needId: dollars }
    this.ResetReallocationRun();
  }

  // Business Action
  ModelLeveledDollarReallocation() {
    this.ResetReallocationRun();
    this.AreReallocationInputsValid();
    if (!this.ReallocationInputsAreValid) {
      this.RejectInvalidReallocationInputs();
      return;
    }
    this.SelectServicesInScope();
    this.MeasurePeerStateLines();
    this.LevelServicesToLine();
    this.TotalDollarsAboveLine();
    this.TotalDollarsAboveEachLine();
    this.CalculateUpheldDollars();
    this.SplitByFederalMatchingRate();
    this.CalculateAvailableDollars();
    this.AllocateToDocumentedNeeds();
    this.IsAllocationOverAvailable();
    this.FitAllocationsToAvailableDollars();
    this.EstimatePeopleReached();
    this.RankSourcesOfFreedDollars();
  }

  // PASSIVE: restore run state and outputs to INITIAL; staged inputs are kept.
  ResetReallocationRun() {
    this.ReallocationInputsAreValid = false;
    this.ServicesInScope = [];
    this.PeerLineByCode = {};
    this.LeveledServices = [];
    this.StatePaidInScope = 0;
    this.DollarsAboveLine = 0;
    this.DollarsAboveEachLine = Object.fromEntries(LEVELING_LINES.map((l) => [l.key, 0]));
    this.UpheldDollars = 0;
    this.FederalShare = 0;
    this.StateShare = 0;
    this.AvailableDollars = 0;
    this.NeedOutcomes = [];
    this.AllocatedDollars = 0;
    this.UnallocatedDollars = 0;
    this.AllocationIsOverAvailable = false;
    this.AllocationsFittedToAvailable = {};
    this.SourcesOfFreedDollars = [];
    this.ServicesWithoutPeerLine = 0;
    this.Errors = [];
  }

  // Question: are the line, scope, upheld share, matching rate and needs usable?
  AreReallocationInputsValid() {
    this.ReallocationInputsAreValid = LEVELING_LINES.some((l) => l.key === this.Line)
      && Array.isArray(this.Services) && Array.isArray(this.Needs)
      && this.Needs.every((n) => typeof n.id === 'string' && n.id !== '' && Number.isFinite(n.gap) && n.gap > 0 && Number.isFinite(n.unitCost) && n.unitCost >= 0)
      && typeof this.Scope === 'string' && (this.Scope === 'all' || this.Scope === 'high' || this.Scope.startsWith('service:'))
      && Number.isFinite(this.UpheldSharePct) && this.UpheldSharePct >= 0 && this.UpheldSharePct <= 100
      && Number.isFinite(this.FederalMatchingRate) && this.FederalMatchingRate > 0 && this.FederalMatchingRate < 1
      && (this.Destination === 'medicaid' || this.Destination === 'general-fund');
  }

  // PASSIVE: say why nothing was modeled.
  RejectInvalidReallocationInputs() {
    this.Errors.push(`Choose a leveling line, a scope, an upheld share from 0 to 100 percent, and a state with a published matching rate${this.State ? ` (${this.State})` : ''}; each need needs an id, a gap above zero and a unit cost of zero or more.`);
  }

  // PASSIVE: the services the chosen scope keeps.
  SelectServicesInScope() {
    if (this.Scope === 'high') this.ServicesInScope = this.Services.filter((s) => s.tier?.key === 'high');
    else if (this.Scope.startsWith('service:')) this.ServicesInScope = this.Services.filter((s) => s.hcpcs === this.Scope.slice(8));
    else this.ServicesInScope = [...this.Services];
  }

  // PASSIVE: the peer-state line per code (median over the other billing states of share / enrollment share).
  MeasurePeerStateLines() {
    for (const s of this.ServicesInScope) {
      const ratios = (this.LatestYearStatePaid[s.hcpcs] ?? [])
        .filter(([state, paid]) => state !== this.State && paid > 0 && this.EnrollmentShareByState[state] > 0)
        .map(([state, paid]) => (paid / s.nationalPaid) / this.EnrollmentShareByState[state])
        .sort((a, b) => a - b);
      if (ratios.length === 0) {
        this.ServicesWithoutPeerLine += 1;
        continue;
      }
      const mid = Math.floor(ratios.length / 2);
      const median = ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
      this.PeerLineByCode[s.hcpcs] = { medianMultiple: median, peerStates: ratios.length, line: s.nationalPaid * s.enrollmentShare * median };
    }
  }

  // PASSIVE: each service's dollars above every LEVELING_LINES line, floored at zero, and above the chosen one.
  LevelServicesToLine() {
    this.LeveledServices = this.ServicesInScope.map((s) => {
      const peer = this.PeerLineByCode[s.hcpcs];
      const aboveByLine = {
        enrollment: s.aboveEnrollment,
        'prior-year': s.abovePriorShare,
        'peer-state': peer ? Math.max(0, s.statePaid - peer.line) : 0,
      };
      return { hcpcs: s.hcpcs, codeLabel: s.codeLabel, tier: s.tier, statePaid: s.statePaid, aboveByLine, above: aboveByLine[this.Line] };
    });
  }

  // PASSIVE: totals in scope.
  TotalDollarsAboveLine() {
    this.StatePaidInScope = this.LeveledServices.reduce((a, s) => a + s.statePaid, 0);
    this.DollarsAboveLine = this.LeveledServices.reduce((a, s) => a + s.above, 0);
  }

  // PASSIVE: the total in scope above each LEVELING_LINES line, for comparing the lines.
  TotalDollarsAboveEachLine() {
    for (const l of LEVELING_LINES) this.DollarsAboveEachLine[l.key] = this.LeveledServices.reduce((a, s) => a + s.aboveByLine[l.key], 0);
  }

  // PASSIVE: the share assumed upheld on review.
  CalculateUpheldDollars() {
    this.UpheldDollars = this.DollarsAboveLine * (this.UpheldSharePct / 100);
  }

  // PASSIVE: federal and state money in what is freed.
  SplitByFederalMatchingRate() {
    this.FederalShare = this.UpheldDollars * this.FederalMatchingRate;
    this.StateShare = this.UpheldDollars - this.FederalShare;
  }

  // PASSIVE: inside Medicaid the match is drawn again; to the General Fund only the state share returns.
  CalculateAvailableDollars() {
    this.AvailableDollars = this.Destination === 'medicaid' ? this.UpheldDollars : this.StateShare;
  }

  // PASSIVE: each allocation held to [0, gap]; totals.
  AllocateToDocumentedNeeds() {
    this.NeedOutcomes = this.Needs.map((n) => {
      const asked = Number(this.Allocations[n.id] ?? 0);
      const allocated = Math.max(0, Math.min(n.gap, Number.isFinite(asked) ? asked : 0));
      return { ...n, allocated, peopleReached: 0 };
    });
    this.AllocatedDollars = this.NeedOutcomes.reduce((a, n) => a + n.allocated, 0);
    this.UnallocatedDollars = this.AvailableDollars - this.AllocatedDollars;
  }

  // Question: do the allocations exceed what is available?
  IsAllocationOverAvailable() {
    this.AllocationIsOverAvailable = this.AllocatedDollars > this.AvailableDollars + 0.5;
  }

  // PASSIVE: the allocations scaled down in proportion, rounded down to $0.1M, so they fit what is
  // available; unchanged when they already fit. The caller stages them when the reviewer asks to fit.
  FitAllocationsToAvailableDollars() {
    const factor = this.AllocatedDollars > 0 ? Math.min(1, Math.max(0, this.AvailableDollars) / this.AllocatedDollars) : 1;
    this.AllocationsFittedToAvailable = Object.fromEntries(this.NeedOutcomes.map((n) => [n.id, factor < 1 ? Math.floor((n.allocated * factor) / 1e5) * 1e5 : n.allocated]));
  }

  // PASSIVE: illustrative people reached per need.
  EstimatePeopleReached() {
    for (const n of this.NeedOutcomes) n.peopleReached = n.unitCost > 0 ? n.allocated / n.unitCost : 0;
  }

  // PASSIVE: where the freed dollars come from, largest first.
  RankSourcesOfFreedDollars() {
    this.SourcesOfFreedDollars = this.LeveledServices
      .filter((s) => s.above > 0)
      .map((s) => ({ ...s, upheld: s.above * (this.UpheldSharePct / 100) }))
      .sort((a, b) => b.above - a.above);
  }
}
