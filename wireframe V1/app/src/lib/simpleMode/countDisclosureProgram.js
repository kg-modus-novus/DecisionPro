// CodeXen-Container: v1 kind=program container=CountDisclosure
/**
 * CountDisclosure — program container for the small-count disclosure rule
 * applied to the Medicaid member counts simple mode displays (requirements FR-2.6).
 *
 * Rule (CMS cell-size suppression policy): a member count from 1 to 10 is
 * never shown; it displays as "<11". When exactly one count in a group is
 * suppressed and the group total is shown, the next-smallest shown count is
 * suppressed too, so the hidden count cannot be recovered by subtraction; if
 * no such count exists, the group total is withheld instead.
 *
 * The container reads published aggregate rows owned by the BW exports and
 * never writes them. Run cycle: InitializeCountDisclosure, stage CountRows and
 * GroupTotalIsShown, DiscloseAggregateCounts, read DisclosedRows and
 * GroupTotalIsWithheld. Runs are synchronous, so one module instance serves all.
 */

export const SMALL_COUNT_MAX = 10;
export const SUPPRESSED_DISPLAY = '<11';

export class CountDisclosure {
  constructor() {
    this.InitializeCountDisclosure();
  }

  InitializeCountDisclosure() {
    // Inputs staged by the caller.
    this.CountRows = [];            // [{ key, count }] published aggregate counts
    this.GroupTotalIsShown = false; // the caller displays the group's total
    // Run state.
    this.SmallCellCount = 0;
    this.ComplementarySuppressionIsNeeded = false;
    this.ComplementaryCandidateRows = [];
    this.ComplementaryCandidateCount = 0;
    // Output.
    this.DisclosedRows = [];        // [{ key, count, display, suppressed, reason }]
    this.GroupTotalIsWithheld = false;
  }

  // Business Action
  DiscloseAggregateCounts() {
    this.StageCountsForDisclosure();
    this.SuppressSmallCounts();
    this.CountSmallCells();
    this.IsComplementarySuppressionNeeded();
    if (this.ComplementarySuppressionIsNeeded) {
      this.FindNextSmallestShownCount();
      this.CountComplementaryCandidates();
      if (this.ComplementaryCandidateCount > 0) this.SuppressNextSmallestCount();
      else this.WithholdGroupTotal();
    }
    this.PublishDisclosedCounts();
  }

  // PASSIVE: copy each staged count into a shown disclosure row.
  StageCountsForDisclosure() {
    this.DisclosedRows = this.CountRows.map((row) => ({
      key: row.key,
      count: row.count,
      display: Number.isFinite(row.count) ? row.count.toLocaleString('en-US') : 'Not reported',
      suppressed: false,
      reason: '',
    }));
  }

  // ACTIVE: hide every count from 1 to the small-count maximum.
  SuppressSmallCounts() {
    if (this.DisclosedRows.length === 0) return;
    this.DisclosedRows
      .filter((row) => Number.isFinite(row.count) && row.count >= 1 && row.count <= SMALL_COUNT_MAX)
      .forEach((row) => Object.assign(row, { display: SUPPRESSED_DISPLAY, suppressed: true, reason: 'small-count' }));
    if (this.DisclosedRows.some((row) => row.count >= 1 && row.count <= SMALL_COUNT_MAX && row.display !== SUPPRESSED_DISPLAY)) {
      throw new Error('CountDisclosure: a small count is still shown');
    }
  }

  // PASSIVE: count the primary-suppressed cells.
  CountSmallCells() {
    this.SmallCellCount = this.DisclosedRows.filter((row) => row.reason === 'small-count').length;
  }

  // Question: does a single hidden cell need a complementary suppression?
  IsComplementarySuppressionNeeded() {
    this.ComplementarySuppressionIsNeeded = this.GroupTotalIsShown && this.SmallCellCount === 1;
  }

  // PASSIVE: the smallest nonzero count still shown (zero counts reveal nothing and stay shown).
  FindNextSmallestShownCount() {
    this.ComplementaryCandidateRows = this.DisclosedRows
      .filter((row) => !row.suppressed && Number.isFinite(row.count) && row.count > 0)
      .sort((a, b) => a.count - b.count)
      .slice(0, 1);
  }

  // PASSIVE: how many candidates were found (zero or one).
  CountComplementaryCandidates() {
    this.ComplementaryCandidateCount = this.ComplementaryCandidateRows.length;
  }

  // ACTIVE: suppress the candidate count.
  SuppressNextSmallestCount() {
    if (this.ComplementaryCandidateCount === 0) return;
    Object.assign(this.ComplementaryCandidateRows[0], { display: SUPPRESSED_DISPLAY, suppressed: true, reason: 'complementary' });
    if (this.DisclosedRows.filter((row) => row.suppressed).length < 2) {
      throw new Error('CountDisclosure: complementary suppression not applied');
    }
  }

  // ACTIVE: with no count to pair with, the total itself must not be shown.
  WithholdGroupTotal() {
    if (this.ComplementaryCandidateCount > 0) return;
    this.GroupTotalIsWithheld = true;
  }

  // PASSIVE: freeze the published rows.
  PublishDisclosedCounts() {
    this.DisclosedRows = this.DisclosedRows.map((row) => Object.freeze(row));
  }
}
