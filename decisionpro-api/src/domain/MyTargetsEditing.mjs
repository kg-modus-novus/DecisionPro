// CodeXen-Container: v1 kind=program container=MyTargetsEditing
/**
 * MyTargetsEditing: program container for the automated workflow segment "edit my targets": open
 * the account's target set for editing under its enqueue lock, save the requested targets in one
 * transaction through MeasureTargetOwner's molecules, and release the lock (or cancel).
 *
 * It owns no business object and holds none: it stages each requested target into
 * MeasureTargetOwner and invokes that owner's SetMeasureTarget, ReviseMeasureTarget or
 * RetireMeasureTarget, sharing the transaction handle it holds.
 *
 * Architecture record ADR-001: T1 (one process owns the lock table), A1 (the lock owner's save is
 * the truth for the held target set), L1 (lock keyed (owner_account_id, 'TARGET_SET'), held by the
 * user session, released on save, cancel, sign-out or session end). The holder is the session: the
 * denial applies between browsers and devices; tabs share the lock. A save releases the lock the tabs
 * share, so another tab must reopen editing before its own save (409 until then).
 *
 * Run cycle: the caller stages AccountId, SessionId, SessionExpiresAt and, for a save,
 * RequestedTargets (normalized at the HTTP boundary: { measureId, value, note, noteChange, retire }),
 * then invokes one Business Action and reads the outcome fields. SaveIsCommitted answers whether
 * the save committed; StorageFailureCount counts storage failures (the route maps these to a status).
 *
 * Instances: one instance per request, as request isolation (ADR-001 Decision 1; the canon's
 * concurrency exception).
 * Each molecule restores run state to INITIAL itself, keeping the staged inputs.
 */

import { NO_TRANSACTION } from '../platform/db.mjs';
import { TARGET_SET, buildLockKey } from '../platform/enqueue.mjs';
import { MeasureTargetOwner } from './MeasureTarget.mjs';

export class MyTargetsEditing {
  constructor({ Database, Enqueue, MeasureCatalog, Clock }) {
    // Dependencies, set at construction.
    this.Database = Database;
    this.Enqueue = Enqueue;
    this.MeasureCatalog = MeasureCatalog;
    this.Clock = Clock;
    this.MeasureTargetOwner = new MeasureTargetOwner({ Database, MeasureCatalog, Clock });
    this.InitializeMyTargetsEditing();
  }

  // Initialization molecule: every field to its INITIAL value.
  InitializeMyTargetsEditing() {
    // Inputs staged by the caller.
    this.AccountId = '';
    this.SessionId = '';
    this.SessionExpiresAt = 0;
    this.RequestedTargets = [];
    this.#ResetEditingRunState();
  }

  // Business Action: open my targets for editing (acquire the target-set lock, or learn its holder).
  async OpenMyTargetsForEditing() {
    this.#ResetEditingRunState();
    this.#IdentifyTargetSetLock();
    await this.#AcquireTargetSetLock();
    this.#IsLockHeldBySession();
  }

  // Business Action: save my targets in one transaction while holding the lock, then release it.
  async SaveMyTargets() {
    this.#ResetEditingRunState();
    this.#IdentifyTargetSetLock();
    this.#IsLockHeldBySession();
    if (!this.LockIsHeld) {
      this.#RejectSaveWithoutLock();
      return;
    }
    this.#CountRequestedTargets();
    await this.#BeginTargetTransaction();
    while (this.RequestedTargetIndex < this.RequestedTargetCount) {
      await this.#ApplyRequestedTarget();
      this.#AdvanceRequestedTargetIndex();
    }
    this.#IsSaveFreeOfErrors();
    if (this.SaveIsFreeOfErrors) await this.#CommitTargetTransaction();
    else await this.#RollBackTargetTransaction();
    this.#IsSaveCommitted();
    this.#CountCommittedTargets();
    this.#ForgetTargetTransaction();
    await this.#ReleaseTargetSetLock();
  }

  // Business Action: cancel editing (release the lock without saving).
  async CancelMyTargetsEditing() {
    this.#ResetEditingRunState();
    this.#IdentifyTargetSetLock();
    this.#IsLockHeldBySession();
    await this.#ReleaseTargetSetLock();
  }

  // Molecule segment of SaveMyTargets for the requested target at RequestedTargetIndex.
  async #ApplyRequestedTarget() {
    this.#StageRequestedTargetForOwner();
    this.#IsRequestedTargetRetirement();
    if (this.RequestedTargetIsRetirement) {
      await this.#RetireRequestedTarget();
    } else {
      await this.#ReadRequestedTargetStatus();
      this.#IsRequestedTargetActive();
      if (this.RequestedTargetIsActive) await this.#ReviseRequestedTarget();
      else await this.#SetRequestedTarget();
    }
    this.#CountRequestedTargetOutcome();
  }

  // PASSIVE: run-state and output fields to INITIAL, keeping the staged inputs.
  #ResetEditingRunState() {
    this.TargetSetLockKey = '';
    this.LockIsHeld = false;
    this.LockHolderDescription = '';
    this.LockReleaseCount = 0;
    this.TransactionHandle = NO_TRANSACTION;
    this.RequestedTargetCount = 0;
    this.RequestedTargetIndex = 0;
    this.RequestedTargetIsRetirement = false;
    this.RequestedTargetIsActive = false;
    this.TargetsSaved = 0;
    this.TargetsRetired = 0;
    this.TargetsRejected = 0;
    this.TargetsCommitted = 0;
    this.StorageFailureCount = 0;
    this.SaveIsFreeOfErrors = false;
    this.SaveIsCommitted = false;
    this.Errors = [];
  }

  // PASSIVE: the representative lock key for this account's target set (ADR-001 Decision 3).
  // architecture-record: T1 L1 ADR-001
  #IdentifyTargetSetLock() {
    if (this.AccountId === '') return;
    this.TargetSetLockKey = buildLockKey(this.AccountId, TARGET_SET);
  }

  // ACTIVE: ask the enqueue lock table for the target-set lock on behalf of this session. A denial
  // is a normal outcome (read by IsLockHeldBySession); only a failure to persist the lock is an error.
  // architecture-record: T1 A1 L1 ADR-001
  async #AcquireTargetSetLock() {
    if (this.TargetSetLockKey === '' || this.SessionId === '' || this.SessionExpiresAt === 0) return;
    try {
      await this.Enqueue.acquire({
        ownerScope: this.AccountId,
        lockObject: TARGET_SET,
        sessionId: this.SessionId,
        sessionExpiresAt: this.SessionExpiresAt,
      });
    } catch {
      this.StorageFailureCount += 1;
      this.Errors.push({ measureId: '', code: 'storage-failure', message: 'Your targets could not be opened for editing. Try again.' });
    }
  }

  // Question: does this session hold the target-set lock? When it does not, who does?
  // architecture-record: T1 L1 ADR-001
  #IsLockHeldBySession() {
    this.LockIsHeld = this.TargetSetLockKey !== '' && this.SessionId !== '' && this.Enqueue.isHeldBySession(this.TargetSetLockKey, this.SessionId);
    this.LockHolderDescription = this.LockIsHeld || this.TargetSetLockKey === '' ? '' : this.Enqueue.describeHolder(this.TargetSetLockKey);
  }

  // PASSIVE: an error for a save attempted without the lock.
  #RejectSaveWithoutLock() {
    this.Errors.push({
      measureId: '',
      code: 'lock-not-held',
      message: this.LockHolderDescription !== '' ? this.LockHolderDescription : 'Open your targets for editing first.',
    });
  }

  // PASSIVE: how many targets were requested.
  #CountRequestedTargets() {
    this.RequestedTargetCount = this.RequestedTargets.length;
  }

  // ACTIVE: open the save transaction.
  async #BeginTargetTransaction() {
    if (!this.LockIsHeld || this.TransactionHandle !== NO_TRANSACTION) return;
    try {
      this.TransactionHandle = await this.Database.beginTransaction();
    } catch {
      this.StorageFailureCount += 1;
      this.Errors.push({ measureId: '', code: 'storage-failure', message: 'The save could not start. Try again.' });
    }
  }

  // PASSIVE: stage the requested target into the owner's inputs, from INITIAL.
  #StageRequestedTargetForOwner() {
    this.MeasureTargetOwner.InitializeMeasureTarget();
    this.MeasureTargetOwner.OwnerScope = this.AccountId;
    this.MeasureTargetOwner.MeasureId = this.RequestedTargets[this.RequestedTargetIndex].measureId;
    this.MeasureTargetOwner.TargetValue = this.RequestedTargets[this.RequestedTargetIndex].value;
    this.MeasureTargetOwner.TargetNote = this.RequestedTargets[this.RequestedTargetIndex].note;
    this.MeasureTargetOwner.TargetNoteChange = this.RequestedTargets[this.RequestedTargetIndex].noteChange;
    this.MeasureTargetOwner.TransactionHandle = this.TransactionHandle;
  }

  // Question: does the request retire this target?
  #IsRequestedTargetRetirement() {
    this.RequestedTargetIsRetirement = this.RequestedTargets[this.RequestedTargetIndex].retire === true;
  }

  // ACTIVE: invoke the owner's RetireMeasureTarget inside the save transaction.
  async #RetireRequestedTarget() {
    if (this.StorageFailureCount > 0 || !this.TransactionHandle.isOpen) return;
    try {
      await this.MeasureTargetOwner.RetireMeasureTarget();
    } catch {
      this.#RecordStorageFailure();
    }
  }

  // ACTIVE: invoke the owner's ReadMeasureTargetStatus (row locked inside the save transaction).
  async #ReadRequestedTargetStatus() {
    if (this.StorageFailureCount > 0 || !this.TransactionHandle.isOpen) return;
    try {
      await this.MeasureTargetOwner.ReadMeasureTargetStatus();
    } catch {
      this.#RecordStorageFailure();
    }
  }

  // Question: is the requested target currently active (read copy of the owner's CurrentTargetStatus)?
  #IsRequestedTargetActive() {
    this.RequestedTargetIsActive = this.MeasureTargetOwner.CurrentTargetStatus === 'active';
  }

  // ACTIVE: invoke the owner's ReviseMeasureTarget inside the save transaction.
  async #ReviseRequestedTarget() {
    if (this.StorageFailureCount > 0 || !this.TransactionHandle.isOpen) return;
    try {
      await this.MeasureTargetOwner.ReviseMeasureTarget();
    } catch {
      this.#RecordStorageFailure();
    }
  }

  // ACTIVE: invoke the owner's SetMeasureTarget inside the save transaction.
  async #SetRequestedTarget() {
    if (this.StorageFailureCount > 0 || !this.TransactionHandle.isOpen) return;
    try {
      await this.MeasureTargetOwner.SetMeasureTarget();
    } catch {
      this.#RecordStorageFailure();
    }
  }

  // PASSIVE: an error for a storage failure while applying the requested target.
  #RecordStorageFailure() {
    this.StorageFailureCount += 1;
    this.Errors.push({
      measureId: this.MeasureTargetOwner.MeasureId,
      code: 'storage-failure',
      message: 'The target could not be saved. Nothing was saved; try again.',
    });
  }

  // PASSIVE: count the requested target as saved, retired or rejected, and keep the owner's errors.
  #CountRequestedTargetOutcome() {
    if (this.StorageFailureCount > 0) return;
    if (this.MeasureTargetOwner.Errors.length > 0) {
      this.TargetsRejected += 1;
      this.Errors.push(...this.MeasureTargetOwner.Errors);
    } else if (this.RequestedTargetIsRetirement) {
      this.TargetsRetired += 1;
    } else {
      this.TargetsSaved += 1;
    }
  }

  // PASSIVE: move to the next requested target.
  #AdvanceRequestedTargetIndex() {
    this.RequestedTargetIndex += 1;
  }

  // Question: can the save commit (no rejection, no storage failure, transaction still open)?
  #IsSaveFreeOfErrors() {
    this.SaveIsFreeOfErrors = this.TargetsRejected === 0 && this.StorageFailureCount === 0 && this.Errors.length === 0 && this.TransactionHandle.isOpen === true;
  }

  // ACTIVE: commit the save (A1: the lock owner's write commits atomically).
  // architecture-record: T1 A1 ADR-001
  async #CommitTargetTransaction() {
    if (!this.SaveIsFreeOfErrors || !this.TransactionHandle.isOpen) return;
    try {
      await this.TransactionHandle.commit();
    } catch {
      this.StorageFailureCount += 1;
      this.Errors.push({ measureId: '', code: 'storage-failure', message: 'The save may not have completed. Reload to check.' });
    }
  }

  // ACTIVE: roll the save back; nothing requested is kept.
  async #RollBackTargetTransaction() {
    if (this.SaveIsFreeOfErrors || !this.TransactionHandle.isOpen) return;
    try {
      await this.TransactionHandle.rollback();
    } catch {
      this.StorageFailureCount += 1;
      this.Errors.push({ measureId: '', code: 'storage-failure', message: 'The save was not completed. Reload to check.' });
    }
  }

  // Question: did the save commit (free of errors, and the commit itself did not fail)?
  #IsSaveCommitted() {
    this.SaveIsCommitted = this.SaveIsFreeOfErrors && this.StorageFailureCount === 0;
  }

  // PASSIVE: how many targets the committed save kept (zero when it did not commit).
  #CountCommittedTargets() {
    this.TargetsCommitted = this.SaveIsCommitted ? this.TargetsSaved + this.TargetsRetired : 0;
  }

  // PASSIVE: the transaction is finished; the handle returns to INITIAL.
  #ForgetTargetTransaction() {
    this.TransactionHandle = NO_TRANSACTION;
  }

  // ACTIVE: release the target-set lock held by this session.
  // architecture-record: T1 L1 R1 ADR-001
  async #ReleaseTargetSetLock() {
    if (!this.LockIsHeld) return;
    try {
      this.LockReleaseCount = await this.Enqueue.release(this.TargetSetLockKey, this.SessionId);
    } catch {
      this.Errors.push({ measureId: '', code: 'lock-not-released', message: 'Your targets are still open for editing here. Cancel or sign out to close them.' });
      return;
    }
    if (this.LockReleaseCount !== 1) {
      this.Errors.push({ measureId: '', code: 'lock-not-released', message: 'Your targets were no longer open for editing here.' });
    }
  }
}
