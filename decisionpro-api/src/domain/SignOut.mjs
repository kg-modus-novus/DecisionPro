// CodeXen-Container: v1 kind=program container=SignOut
/**
 * SignOut: program container for the automated workflow segment "sign out": release every lock the
 * browser's session holds, then end that session.
 *
 * It owns no business object and changes none: sessions and the enqueue lock table are D2 technical
 * mechanisms (ADR-001 Identity and Decision 3: a lock is released on sign-out). The caller clears
 * the cookie only when SignOutIsComplete is true, so a storage failure leaves the browser signed in
 * rather than holding a cookie for a session that is still active.
 *
 * Run cycle: the caller stages SessionToken (the dp_session cookie, '' when absent), invokes
 * SignOutAccount, and reads SignOutIsComplete, SessionLocksReleased, StorageFailureCount and Errors.
 * A browser with no active session is already signed out: SignOutIsComplete is true.
 *
 * Instances: one instance per request, as request isolation (ADR-001 Decision 1; the canon's
 * concurrency exception). Each run restores run state to INITIAL itself, keeping the staged input.
 */

const INITIAL_SESSION = Object.freeze({ sessionIsActive: false, sessionToken: '', sessionId: '', accountId: '', createdAt: 0, expiresAt: 0 });

export class SignOut {
  constructor({ Sessions, Enqueue }) {
    // Dependencies, set at construction.
    this.Sessions = Sessions;
    this.Enqueue = Enqueue;
    this.InitializeSignOut();
  }

  // Initialization molecule: every field to its INITIAL value.
  InitializeSignOut() {
    // Input staged by the caller.
    this.SessionToken = '';
    this.#ResetSignOutRunState();
  }

  // Business Action: sign out.
  async SignOutAccount() {
    this.#ResetSignOutRunState();
    await this.#LoadSession();
    this.#IsSessionActive();
    if (this.SessionIsActive) {
      await this.#ReleaseSessionLocks();
      await this.#EndSession();
    }
    this.#IsSignOutComplete();
  }

  // PASSIVE: run-state and output fields to INITIAL, keeping the staged input.
  #ResetSignOutRunState() {
    this.Session = { ...INITIAL_SESSION };
    this.SessionIsActive = false;
    this.SessionLocksReleased = 0;
    this.SessionsEnded = 0;
    this.SignOutIsComplete = false;
    this.StorageFailureCount = 0;
    this.Errors = [];
  }

  // ACTIVE: look up the browser's session.
  async #LoadSession() {
    if (this.SessionToken === '') return;
    try {
      this.Session = await this.Sessions.findActiveSession(this.SessionToken);
    } catch {
      this.#RecordStorageFailure();
    }
  }

  // Question: does the browser hold an active session?
  #IsSessionActive() {
    this.SessionIsActive = this.Session.sessionIsActive === true;
  }

  // ACTIVE: release every lock the session holds (ADR-001 Decision 3).
  // architecture-record: T1 L1 ADR-001
  async #ReleaseSessionLocks() {
    if (!this.SessionIsActive || this.StorageFailureCount > 0) return;
    try {
      this.SessionLocksReleased = await this.Enqueue.releaseAllForSession(this.Session.sessionId);
    } catch {
      this.#RecordStorageFailure();
    }
  }

  // ACTIVE: end the session, after its locks are released. Zero sessions ended means another request
  // ended it first: the browser is signed out either way.
  async #EndSession() {
    if (!this.SessionIsActive || this.StorageFailureCount > 0) return;
    try {
      this.SessionsEnded = await this.Sessions.endSession(this.Session.sessionId);
    } catch {
      this.#RecordStorageFailure();
    }
  }

  // Question: is the browser signed out (no active session was held, or it was ended without failure)?
  #IsSignOutComplete() {
    this.SignOutIsComplete = this.StorageFailureCount === 0;
  }

  // PASSIVE: an error for a storage failure during sign-out.
  #RecordStorageFailure() {
    this.StorageFailureCount += 1;
    this.Errors.push({ code: 'storage-failure', message: 'Sign-out could not be completed. Try again.' });
  }
}
