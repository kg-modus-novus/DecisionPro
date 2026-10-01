// CodeXen-Container: v1 kind=program container=PlanComparison
/**
 * PlanComparison — program container that orders managed care plans on one
 * measure for the simple-mode MCO comparison (requirements FR-3).
 *
 * Decision rule: plans are ordered only on a measure at least two plans
 * report, and, for a derived ratio, only when the BW export's MCPAR-COMPARE-v1
 * verdict says the measure is comparable. The verdict is read from the export,
 * never recomputed here. The result is an ordering, never a ranking verdict.
 *
 * Reads MCPAR plan rows owned by the BW export; holds read copies only.
 * Run cycle: InitializePlanComparison, stage inputs, OrderPlansOnComparableMeasure,
 * read MeasureIsComparable and OrderedPlanRows. Runs are synchronous.
 */

export class PlanComparison {
  constructor() {
    this.InitializePlanComparison();
  }

  InitializePlanComparison() {
    // Inputs staged by the caller.
    this.PlanRows = [];                  // [{ plan, values: { [measureId]: number|null } }]
    this.MeasureId = '';
    this.MeasureIsDerivedRatio = false;
    this.ExportedComparabilityVerdict = false; // export's MCPAR-COMPARE-v1 verdict for a derived ratio
    this.OrderDescending = true;
    // Run state.
    this.ReportingPlanCount = 0;
    this.MeasureIsComparable = false;
    // Output.
    this.OrderedPlanRows = [];
  }

  // Business Action
  OrderPlansOnComparableMeasure() {
    this.CountReportingPlans();
    this.IsMeasureComparable();
    if (this.MeasureIsComparable) this.OrderPlansByMeasure();
    else this.KeepPlansInPublishedOrder();
  }

  // PASSIVE: how many plans report a value for the measure.
  CountReportingPlans() {
    this.ReportingPlanCount = this.PlanRows.filter((row) => Number.isFinite(row.values?.[this.MeasureId])).length;
  }

  // Question: may plans be ordered on this measure?
  IsMeasureComparable() {
    this.MeasureIsComparable = this.ReportingPlanCount >= 2
      && (!this.MeasureIsDerivedRatio || this.ExportedComparabilityVerdict === true);
  }

  // ACTIVE: order on the measure; plans without a value sort last.
  OrderPlansByMeasure() {
    if (!this.MeasureIsComparable) return;
    this.OrderedPlanRows = [...this.PlanRows].sort((a, b) => (
      Number(Number.isFinite(b.values?.[this.MeasureId])) - Number(Number.isFinite(a.values?.[this.MeasureId]))
      || (Number.isFinite(a.values?.[this.MeasureId])
        ? (b.values[this.MeasureId] - a.values[this.MeasureId]) * (this.OrderDescending ? 1 : -1)
        : 0)
    ));
    if (this.OrderedPlanRows.length !== this.PlanRows.length) {
      throw new Error('PlanComparison: ordering dropped a plan');
    }
  }

  // PASSIVE: a non-comparable measure leaves plans in published order.
  KeepPlansInPublishedOrder() {
    this.OrderedPlanRows = [...this.PlanRows];
  }
}
