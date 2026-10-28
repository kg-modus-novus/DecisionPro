// CodeXen-Container: v1 kind=object container=MeasureTargetOwner owns=measure-target
/**
 * MeasureTargetOwner: object container for the business object MeasureTarget, a target a user (or,
 * later, the committee) sets for one simple-mode measure. It is the only writer of `measure_target`
 * and of its own log `measure_target_revision`.
 *
 * Identity: (OwnerScope, MeasureId), one current target per scope per measure. OwnerScope is the
 * account id now and, later, COMMITTEE. Persisted in the P1 tenant key column owner_account_id.
 *
 * State diagram (docs/planning/measure-targets-codexen-plan.md):
 *   absent  ──SetMeasureTarget──▶    active
 *   active  ──ReviseMeasureTarget──▶ active    (revision + 1, previous revision kept in the log)
 *   active  ──RetireMeasureTarget──▶ retired
 *   retired ──SetMeasureTarget──▶    active    (same identity, revision + 1)
 * There is no delete: retiring is a state.
 *
 * Fields keep one name per datum: the requested inputs (TargetValue, TargetNote, TargetNoteChange),
 * the stored row (CurrentTargetStatus, CurrentTargetRevision, StoredTarget*), and the revision about
 * to be written (NextTarget*). The current row is written only if its revision is still the one
 * this action read (conditional upsert); a lost race is refused, never overwritten.
 *
 * Run cycle: the caller stages OwnerScope, MeasureId, TargetValue, TargetNote, TargetNoteChange
 * ('replace', or 'keep' to keep the stored note) and TransactionHandle (an open transaction from
 * Database.beginTransaction), invokes one Business Action, and reads Errors. The caller commits or
 * rolls back. ReadActiveMeasureTargets needs only OwnerScope and reads outside a transaction;
 * ReadMeasureTargetStatus needs the transaction.
 *
 * Instances: one instance per request, as request isolation (ADR-001 Decision 1; the canon's
 * concurrency exception). MyTargetsEditing constructs its own.
 */

import { NO_TRANSACTION } from '../platform/db.mjs';

export const PERCENT_UNIT = 'percent';
// Dollar targets may be any finite number, negative included (e.g. net payments): Director ruling,
// ADR-001 "Business rules recorded with this ADR".
export const DOLLAR_UNITS = Object.freeze(['usd', 'usd_pmpm']);
export const PERCENT_MINIMUM = 0;
export const PERCENT_MAXIMUM = 100;
export const UNIT_MINIMUM = 0;
export const TARGET_DATE_TIME_ZONE = 'America/New_York';
export const NOTE_REPLACE = 'replace';
export const NOTE_KEEP = 'keep';

const INITIAL_CATALOG_ENTRY = Object.freeze({ id: '', unit: '', betterDirection: '', label: '' });

const TARGET_COLUMNS = `owner_account_id, measure_id, target_value, target_unit, better_direction, target_note,
  effective_date, target_status, target_revision, updated_at`;

export class MeasureTargetOwner {
  constructor({ Database, MeasureCatalog, Clock }) {
    // Dependencies, set at construction.
    this.Database = Database;
    this.MeasureCatalog = MeasureCatalog; // [{ id, unit, betterDirection, label }], bundled with the API
    this.Clock = Clock;
    this.InitializeMeasureTarget();
  }

  // Initialization molecule: every field to its INITIAL value.
  InitializeMeasureTarget() {
    // Inputs staged by the caller.
    this.OwnerScope = '';
    this.MeasureId = '';
    this.TargetValue = 0;
    this.TargetNote = '';
    this.TargetNoteChange = NOTE_REPLACE;
    this.TransactionHandle = NO_TRANSACTION;
    this.#ResetMeasureTargetOutcome();
  }

  // Business Action. Arrows: absent → active, retired → active.
  async SetMeasureTarget() {
    this.#ResetMeasureTargetOutcome();
    this.#IsTransactionOpen();
    if (!this.TransactionIsOpen) {
      this.#RejectActionWithoutTransaction();
      return;
    }
    this.#LoadMeasureCatalogEntry();
    this.#IsMeasureInCatalog();
    if (!this.MeasureIsInCatalog) {
      this.#RejectUnknownMeasure();
      return;
    }
    this.#IsTargetValueWithinUnitRange();
    if (!this.TargetValueIsWithinUnitRange) {
      this.#RejectTargetValueOutOfRange();
      return;
    }
    await this.#LoadCurrentTarget();
    this.#CountCurrentTargetRows();
    this.#IsTargetAbsentOrRetired();
    if (!this.TargetIsAbsentOrRetired) {
      this.#RejectSetOfActiveTarget();
      return;
    }
    this.#PrepareTargetRevision();
    await this.#PersistMeasureTarget();
    await this.#PersistMeasureTargetRevision();
  }

  // Business Action. Arrow: active → active. A deliberate duplicate of SetMeasureTarget that differs
  // in the state it requires (canon: duplicate look-alike business actions; consolidation not planned).
  async ReviseMeasureTarget() {
    this.#ResetMeasureTargetOutcome();
    this.#IsTransactionOpen();
    if (!this.TransactionIsOpen) {
      this.#RejectActionWithoutTransaction();
      return;
    }
    this.#LoadMeasureCatalogEntry();
    this.#IsMeasureInCatalog();
    if (!this.MeasureIsInCatalog) {
      this.#RejectUnknownMeasure();
      return;
    }
    this.#IsTargetValueWithinUnitRange();
    if (!this.TargetValueIsWithinUnitRange) {
      this.#RejectTargetValueOutOfRange();
      return;
    }
    await this.#LoadCurrentTarget();
    this.#CountCurrentTargetRows();
    this.#IsTargetActive();
    if (!this.TargetIsActive) {
      this.#RejectReviseOfInactiveTarget();
      return;
    }
    this.#PrepareTargetRevision();
    await this.#PersistMeasureTarget();
    await this.#PersistMeasureTargetRevision();
  }

  // Business Action. Arrow: active → retired.
  async RetireMeasureTarget() {
    this.#ResetMeasureTargetOutcome();
    this.#IsTransactionOpen();
    if (!this.TransactionIsOpen) {
      this.#RejectActionWithoutTransaction();
      return;
    }
    await this.#LoadCurrentTarget();
    this.#CountCurrentTargetRows();
    this.#IsTargetActive();
    if (!this.TargetIsActive) {
      this.#RejectRetireOfInactiveTarget();
      return;
    }
    this.#PrepareTargetRetirement();
    await this.#PersistMeasureTarget();
    await this.#PersistMeasureTargetRevision();
  }

  // Read: the current status of one target (absent, active or retired), locked for update inside the
  // caller's transaction so that the action that follows sees the same row.
  async ReadMeasureTargetStatus() {
    this.#ResetMeasureTargetOutcome();
    this.#IsTransactionOpen();
    if (!this.TransactionIsOpen) {
      this.#RejectActionWithoutTransaction();
      return;
    }
    await this.#LoadCurrentTarget();
    this.#CountCurrentTargetRows();
  }

  // Read: every active target of OwnerScope, outside a transaction (A1: an unheld unit's truth is
  // the row).
  async ReadActiveMeasureTargets() {
    this.#ResetMeasureTargetOutcome();
    await this.#LoadActiveTargets();
    this.#CountActiveTargets();
    this.#ShapeActiveTargets();
  }

  // PASSIVE: restore run-state and output fields to INITIAL, keeping the staged inputs.
  #ResetMeasureTargetOutcome() {
    // Catalog.
    this.CatalogEntryRows = [];
    this.MeasureCatalogEntryCount = 0;
    this.CatalogEntry = { ...INITIAL_CATALOG_ENTRY };
    // The stored row, as read.
    this.CurrentTargetRows = [];
    this.CurrentTargetRowCount = 0;
    this.CurrentTargetStatus = '';
    this.CurrentTargetRevision = 0;
    this.StoredTargetValue = 0;
    this.StoredTargetNote = '';
    this.StoredTargetUnit = '';
    this.StoredBetterDirection = '';
    // The revision about to be written.
    this.NextTargetStatus = '';
    this.NextTargetRevision = 0;
    this.NextTargetValue = 0;
    this.NextTargetNote = '';
    this.NextTargetUnit = '';
    this.NextBetterDirection = '';
    this.EffectiveDate = '';
    this.RecordedAt = '';
    // Answers.
    this.TransactionIsOpen = false;
    this.MeasureIsInCatalog = false;
    this.TargetValueIsWithinUnitRange = false;
    this.TargetIsAbsentOrRetired = false;
    this.TargetIsActive = false;
    // Counters.
    this.TargetRowsWritten = 0;
    this.RevisionRowsWritten = 0;
    // Read output.
    this.ActiveTargetRows = [];
    this.ActiveTargetCount = 0;
    this.ActiveTargets = [];
    this.Errors = [];
  }

  // Question: is the caller's transaction open?
  #IsTransactionOpen() {
    this.TransactionIsOpen = this.TransactionHandle !== NO_TRANSACTION && this.TransactionHandle.isOpen === true;
  }

  // PASSIVE: find the measure in the published catalog bundled with the API.
  #LoadMeasureCatalogEntry() {
    this.CatalogEntryRows = this.MeasureCatalog.filter((entry) => entry.id === this.MeasureId);
    this.MeasureCatalogEntryCount = this.CatalogEntryRows.length;
    this.CatalogEntry = this.MeasureCatalogEntryCount > 0 ? { ...INITIAL_CATALOG_ENTRY, ...this.CatalogEntryRows[0] } : { ...INITIAL_CATALOG_ENTRY };
  }

  // Question: is the measure in the catalog?
  #IsMeasureInCatalog() {
    this.MeasureIsInCatalog = this.MeasureCatalogEntryCount === 1;
  }

  // Question: is the target value within its unit's range? Percent 0–100; dollars (usd, usd_pmpm)
  // any finite number, negative included (Director ruling, ADR-001 Business rules); every other unit (counts,
  // rates, ratios, days, hours, index) zero or more.
  #IsTargetValueWithinUnitRange() {
    this.TargetValueIsWithinUnitRange = Number.isFinite(this.TargetValue) && (
      this.CatalogEntry.unit === PERCENT_UNIT
        ? this.TargetValue >= PERCENT_MINIMUM && this.TargetValue <= PERCENT_MAXIMUM
        : DOLLAR_UNITS.includes(this.CatalogEntry.unit) || this.TargetValue >= UNIT_MINIMUM
    );
  }

  // ACTIVE: read the current target row, locked for update inside the caller's transaction.
  // architecture-record: T1 A1 ADR-001
  async #LoadCurrentTarget() {
    if (!this.TransactionIsOpen || this.OwnerScope === '' || this.MeasureId === '') return;
    this.CurrentTargetRows = (await this.TransactionHandle.query(
      `SELECT ${TARGET_COLUMNS} FROM measure_target WHERE owner_account_id = $1 AND measure_id = $2 FOR UPDATE`,
      [this.OwnerScope, this.MeasureId],
    )).rows;
    if (this.CurrentTargetRows.length > 1) {
      this.Errors.push({ measureId: this.MeasureId, code: 'target-identity-duplicated', message: 'More than one current target carries this identity.' });
    }
  }

  // PASSIVE: how many current target rows were loaded (zero or one), the state they are in, and
  // the stored values.
  #CountCurrentTargetRows() {
    this.CurrentTargetRowCount = this.CurrentTargetRows.length;
    if (this.CurrentTargetRowCount === 0) {
      this.CurrentTargetStatus = 'absent';
      return;
    }
    this.CurrentTargetStatus = this.CurrentTargetRows[0].target_status;
    this.CurrentTargetRevision = Number(this.CurrentTargetRows[0].target_revision);
    this.StoredTargetValue = Number(this.CurrentTargetRows[0].target_value);
    this.StoredTargetNote = this.CurrentTargetRows[0].target_note;
    this.StoredTargetUnit = this.CurrentTargetRows[0].target_unit;
    this.StoredBetterDirection = this.CurrentTargetRows[0].better_direction;
  }

  // Question: is there no target, or only a retired one?
  #IsTargetAbsentOrRetired() {
    this.TargetIsAbsentOrRetired = this.CurrentTargetStatus === 'absent' || this.CurrentTargetStatus === 'retired';
  }

  // Question: is the target active?
  #IsTargetActive() {
    this.TargetIsActive = this.CurrentTargetStatus === 'active';
  }

  // PASSIVE: the next active revision: revision + 1, the requested value, the requested note (or the
  // stored one when the request keeps it), unit and direction from the catalog, effective today in
  // Kentucky (Eastern) time.
  #PrepareTargetRevision() {
    this.NextTargetRevision = this.CurrentTargetRevision + 1;
    this.NextTargetStatus = 'active';
    this.NextTargetValue = this.TargetValue;
    this.NextTargetNote = this.TargetNoteChange === NOTE_KEEP ? this.StoredTargetNote : this.TargetNote;
    this.NextTargetUnit = this.CatalogEntry.unit;
    this.NextBetterDirection = this.CatalogEntry.betterDirection;
    this.RecordedAt = new Date(this.Clock.now()).toISOString();
    this.EffectiveDate = new Intl.DateTimeFormat('en-CA', { timeZone: TARGET_DATE_TIME_ZONE }).format(new Date(this.Clock.now()));
  }

  // PASSIVE: the retiring revision keeps the stored value, unit, direction and note.
  #PrepareTargetRetirement() {
    this.NextTargetRevision = this.CurrentTargetRevision + 1;
    this.NextTargetStatus = 'retired';
    this.NextTargetValue = this.StoredTargetValue;
    this.NextTargetNote = this.StoredTargetNote;
    this.NextTargetUnit = this.StoredTargetUnit;
    this.NextBetterDirection = this.StoredBetterDirection;
    this.RecordedAt = new Date(this.Clock.now()).toISOString();
    this.EffectiveDate = new Intl.DateTimeFormat('en-CA', { timeZone: TARGET_DATE_TIME_ZONE }).format(new Date(this.Clock.now()));
  }

  // ACTIVE: write the current target row, only if its revision is still the one this action read.
  // Arrows: absent/retired → active, active → active, active → retired, as prepared.
  // architecture-record: T1 A1 ADR-001
  async #PersistMeasureTarget() {
    if (!this.TransactionIsOpen || this.NextTargetRevision === 0 || this.NextTargetStatus === '') return;
    this.TargetRowsWritten = (await this.TransactionHandle.query(
      `INSERT INTO measure_target (${TARGET_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (owner_account_id, measure_id) DO UPDATE SET
         target_value = EXCLUDED.target_value, target_unit = EXCLUDED.target_unit,
         better_direction = EXCLUDED.better_direction, target_note = EXCLUDED.target_note,
         effective_date = EXCLUDED.effective_date, target_status = EXCLUDED.target_status,
         target_revision = EXCLUDED.target_revision, updated_at = EXCLUDED.updated_at
       WHERE measure_target.target_revision = EXCLUDED.target_revision - 1`,
      [this.OwnerScope, this.MeasureId, this.NextTargetValue, this.NextTargetUnit, this.NextBetterDirection, this.NextTargetNote,
        this.EffectiveDate, this.NextTargetStatus, this.NextTargetRevision, this.RecordedAt],
    )).rowCount;
    if (this.TargetRowsWritten !== 1) {
      this.Errors.push({ measureId: this.MeasureId, code: 'target-changed', message: 'This target changed while you were saving. Reload and try again.' });
    }
  }

  // ACTIVE: append the revision to the target's log.
  async #PersistMeasureTargetRevision() {
    if (!this.TransactionIsOpen || this.TargetRowsWritten !== 1) return;
    this.RevisionRowsWritten = (await this.TransactionHandle.query(
      `INSERT INTO measure_target_revision (owner_account_id, measure_id, target_revision, target_value, target_unit,
         better_direction, target_note, effective_date, target_status, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [this.OwnerScope, this.MeasureId, this.NextTargetRevision, this.NextTargetValue, this.NextTargetUnit, this.NextBetterDirection,
        this.NextTargetNote, this.EffectiveDate, this.NextTargetStatus, this.RecordedAt],
    )).rowCount;
    if (this.RevisionRowsWritten !== 1) {
      this.Errors.push({ measureId: this.MeasureId, code: 'target-revision-not-recorded', message: 'The target revision could not be recorded.' });
    }
  }

  // ACTIVE: read every active target of the scope.
  async #LoadActiveTargets() {
    if (this.OwnerScope === '') return;
    this.ActiveTargetRows = (await this.Database.query(
      `SELECT ${TARGET_COLUMNS} FROM measure_target WHERE owner_account_id = $1 AND target_status = 'active' ORDER BY measure_id`,
      [this.OwnerScope],
    )).rows;
    if (this.ActiveTargetRows.some((row) => row.owner_account_id !== this.OwnerScope)) {
      this.Errors.push({ measureId: '', code: 'target-scope-mismatch', message: 'A target outside this scope was read.' });
    }
  }

  // PASSIVE: how many active targets were loaded.
  #CountActiveTargets() {
    this.ActiveTargetCount = this.ActiveTargetRows.length;
  }

  // PASSIVE: the owner's view of the active targets, labelled from the catalog.
  #ShapeActiveTargets() {
    this.ActiveTargets = this.ActiveTargetRows.map((row) => ({
      measureId: row.measure_id,
      label: (this.MeasureCatalog.find((entry) => entry.id === row.measure_id) ?? INITIAL_CATALOG_ENTRY).label,
      value: Number(row.target_value),
      unit: row.target_unit,
      betterDirection: row.better_direction,
      note: row.target_note,
      effectiveDate: row.effective_date,
      revision: Number(row.target_revision),
    }));
  }

  // PASSIVE: rejections. Each records why the action did not run.
  #RejectActionWithoutTransaction() {
    this.Errors.push({ measureId: this.MeasureId, code: 'no-transaction', message: 'A target can only be changed inside a save.' });
  }

  #RejectUnknownMeasure() {
    this.Errors.push({ measureId: this.MeasureId, code: 'unknown-measure', message: 'This measure is not in the DecisionPro measure catalog.' });
  }

  #RejectTargetValueOutOfRange() {
    if (this.CatalogEntry.unit === PERCENT_UNIT) {
      this.Errors.push({ measureId: this.MeasureId, code: 'target-value-out-of-range', message: 'A percent target must be between 0 and 100.' });
    } else if (DOLLAR_UNITS.includes(this.CatalogEntry.unit)) {
      this.Errors.push({ measureId: this.MeasureId, code: 'target-value-out-of-range', message: 'A dollar target must be a finite number.' });
    } else {
      this.Errors.push({ measureId: this.MeasureId, code: 'target-value-out-of-range', message: 'This target must be zero or more.' });
    }
  }

  #RejectSetOfActiveTarget() {
    this.Errors.push({ measureId: this.MeasureId, code: 'target-already-active', message: 'This measure already has an active target. Revise it instead.' });
  }

  #RejectReviseOfInactiveTarget() {
    this.Errors.push({ measureId: this.MeasureId, code: 'target-not-active', message: 'This measure has no active target to revise.' });
  }

  #RejectRetireOfInactiveTarget() {
    this.Errors.push({ measureId: this.MeasureId, code: 'target-not-active', message: 'This measure has no active target to retire.' });
  }
}
