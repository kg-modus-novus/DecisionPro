// CodeXen-Container: v1 kind=program container=PaymentDeprivationAssessment
/**
 * PaymentDeprivationAssessment: program container for the subcommittee
 * follow-up (2026-10-29) "does Medicaid pay less where people are more
 * deprived?". It reads the research file's published figures (sourced rural:
 * paid per office visit by deprivation quarter of counties, the counties' rank
 * correlation with the deprivation index, and states' fee index against state
 * deprivation) and decides what the page may say about them. Writes nothing.
 *
 * Decisions:
 *   - relation strength from a rank correlation: below RELATION_NONE_BELOW in
 *     size is 'none', below RELATION_WEAK_BELOW is 'weak', otherwise 'clear';
 *   - the gap between the most and least deprived quarters, line-weighted and
 *     between their middle counties;
 *   - the gap is volume-driven when the middle-county gap is under half the
 *     line-weighted gap (a few high-volume counties make it, not a pattern).
 *
 * Run cycle: stage QuarterRows (through stageQuarterRow), CountyRankCorrelation,
 * CountyRankCorrelationIsPublished, StateRows (through stageStateRow),
 * StateRankCorrelation, StateRankCorrelationIsPublished, StatesCompared;
 * AssessPaymentDeprivationRelation; read the outputs. Each run restores run
 * state to INITIAL first.
 */

export const RELATION_NONE_BELOW = 0.2;
export const RELATION_WEAK_BELOW = 0.4;

/** Boundary normalization for one deprivation-quarter row. */
export function stageQuarterRow(row) {
  return {
    key: String(row?.key || ''),
    value: Number.isFinite(row?.value) ? row.value : 0,
    valueIsPublished: Number.isFinite(row?.value),
    countyMedian: Number.isFinite(row?.countyMedian) ? row.countyMedian : 0,
    countyMedianIsPublished: Number.isFinite(row?.countyMedian),
  };
}

/** Boundary normalization for one state row of the fee-index-against-deprivation measure. */
export function stageStateRow(row) {
  return {
    key: String(row?.key || ''),
    value: Number.isFinite(row?.value) ? row.value : 0,
    deprivationRank: Number.isFinite(row?.deprivationRank) ? row.deprivationRank : 0,
  };
}

const EMPTY_QUARTER_ROW = Object.freeze(stageQuarterRow({}));
const EMPTY_STATE_ROW = Object.freeze(stageStateRow({}));

export class PaymentDeprivationAssessment {
  constructor() {
    this.InitializePaymentDeprivationAssessment();
  }

  InitializePaymentDeprivationAssessment() {
    // Inputs staged by the caller (normalized at the boundary).
    this.QuarterRows = [];
    this.CountyRankCorrelation = 0;
    this.CountyRankCorrelationIsPublished = false;
    this.StateRows = [];
    this.StateRankCorrelation = 0;
    this.StateRankCorrelationIsPublished = false;
    this.StatesCompared = 0;
    this.ResetPaymentDeprivationRun();
  }

  // Business Action
  AssessPaymentDeprivationRelation() {
    this.ResetPaymentDeprivationRun();
    this.StagePublishedQuarters();
    this.FindExtremeQuarters();
    this.IsCountyAssessmentPossible();
    if (this.CountyAssessmentIsPossible) {
      this.ClassifyCountyRelation();
      this.CalculateQuarterGap();
      this.CalculateMiddleCountyGap();
      this.IsGapVolumeDriven();
    }
    this.FindKentuckyStateRow();
    this.IsStateAssessmentPossible();
    if (this.StateAssessmentIsPossible) this.ClassifyStateRelation();
  }

  // PASSIVE: restore run state and outputs to INITIAL; staged inputs are kept.
  ResetPaymentDeprivationRun() {
    this.PublishedQuarterRows = [];
    this.LeastDeprivedQuarter = EMPTY_QUARTER_ROW;
    this.MostDeprivedQuarter = EMPTY_QUARTER_ROW;
    this.ExtremeQuarterCount = 0;
    this.CountyAssessmentIsPossible = false;
    this.CountyRelation = '';        // 'none' | 'weak' | 'clear'
    this.QuarterGapPercent = 0;
    this.MiddleCountyGapPercent = 0;
    this.MiddleCountyGapIsPublished = false;
    this.GapIsVolumeDriven = false;
    this.KentuckyStateRows = [];
    this.KentuckyStateRow = EMPTY_STATE_ROW;
    this.KentuckyStateRowCount = 0;
    this.StateAssessmentIsPossible = false;
    this.StateRelation = '';         // 'none' | 'weak' | 'clear'
  }

  // PASSIVE: quarters with a published, positive paid amount.
  StagePublishedQuarters() {
    this.PublishedQuarterRows = this.QuarterRows.filter((r) => r.valueIsPublished && r.value > 0);
  }

  // PASSIVE: the least (q1) and most (q4) deprived quarters, when published.
  FindExtremeQuarters() {
    this.LeastDeprivedQuarter = this.PublishedQuarterRows.find((r) => r.key === 'q1') || EMPTY_QUARTER_ROW;
    this.MostDeprivedQuarter = this.PublishedQuarterRows.find((r) => r.key === 'q4') || EMPTY_QUARTER_ROW;
    this.ExtremeQuarterCount = this.PublishedQuarterRows.filter((r) => r.key === 'q1' || r.key === 'q4').length;
  }

  // Question: are both extreme quarters and the county correlation published?
  IsCountyAssessmentPossible() {
    this.CountyAssessmentIsPossible = this.ExtremeQuarterCount === 2 && this.CountyRankCorrelationIsPublished;
  }

  // PASSIVE: how strongly deprivation and paid per visit move together across counties.
  ClassifyCountyRelation() {
    this.CountyRelation = Math.abs(this.CountyRankCorrelation) < RELATION_NONE_BELOW ? 'none' : Math.abs(this.CountyRankCorrelation) < RELATION_WEAK_BELOW ? 'weak' : 'clear';
  }

  // PASSIVE: most against least deprived quarter, line-weighted, in percent.
  CalculateQuarterGap() {
    this.QuarterGapPercent = ((this.MostDeprivedQuarter.value - this.LeastDeprivedQuarter.value) / this.LeastDeprivedQuarter.value) * 100;
  }

  // PASSIVE: the same gap between each quarter's middle county, when both are published.
  CalculateMiddleCountyGap() {
    this.MiddleCountyGapIsPublished = this.MostDeprivedQuarter.countyMedianIsPublished && this.LeastDeprivedQuarter.countyMedianIsPublished && this.LeastDeprivedQuarter.countyMedian > 0;
    this.MiddleCountyGapPercent = this.MiddleCountyGapIsPublished
      ? ((this.MostDeprivedQuarter.countyMedian - this.LeastDeprivedQuarter.countyMedian) / this.LeastDeprivedQuarter.countyMedian) * 100
      : 0;
  }

  // Question: is the quarter gap made by a few high-volume counties rather than a county-by-county pattern?
  IsGapVolumeDriven() {
    this.GapIsVolumeDriven = this.MiddleCountyGapIsPublished && Math.abs(this.MiddleCountyGapPercent) < Math.abs(this.QuarterGapPercent) / 2;
  }

  // PASSIVE: Kentucky's row among the states.
  FindKentuckyStateRow() {
    this.KentuckyStateRows = this.StateRows.filter((r) => r.key === 'KY');
    this.KentuckyStateRowCount = this.KentuckyStateRows.length;
    this.KentuckyStateRow = this.KentuckyStateRows[0] || EMPTY_STATE_ROW;
  }

  // Question: are the state correlation and Kentucky's row published?
  IsStateAssessmentPossible() {
    this.StateAssessmentIsPossible = this.StateRankCorrelationIsPublished && this.KentuckyStateRowCount === 1 && this.StatesCompared > 0;
  }

  // PASSIVE: how strongly state deprivation and the fee index move together.
  ClassifyStateRelation() {
    this.StateRelation = Math.abs(this.StateRankCorrelation) < RELATION_NONE_BELOW ? 'none' : Math.abs(this.StateRankCorrelation) < RELATION_WEAK_BELOW ? 'weak' : 'clear';
  }
}
