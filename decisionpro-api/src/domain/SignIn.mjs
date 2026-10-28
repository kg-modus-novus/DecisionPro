// CodeXen-Container: v1 kind=program container=SignIn
/**
 * SignIn: program container for the automated workflow segment "sign in": register the account on
 * first sign-in (through AccountOwner), start the new session, count the sign-in on the account,
 * then release the browser's previous session's locks and end that session.
 *
 * Order (atomic from the browser's point of view): the new session is started before the sign-in is
 * counted, and the previous session is ended last. A failure before the end leaves the browser with
 * its previous cookie and session, still signed in; the response carries no new cookie. A failure
 * after the new session starts leaves an unused session row that is never delivered and ends at its
 * 12-hour lifetime; it holds no lock.
 *
 * It owns no business object. Account changes go through AccountOwner's molecules. Sessions and the
 * enqueue lock table are D2 technical mechanisms (ADR-001 Identity and Decision 3); ending a
 * session releases its locks first (ADR-001 Decision 3: a lock is released when its session ends).
 *
 * Run cycle: the caller stages Provider, ProviderSubject and DisplayEmail (from an ID token verified
 * at the boundary) and PreviousSessionToken (the browser's dp_session cookie, '' when absent), invokes
 * SignInAccount, and reads SignInIsComplete, StartedSession, AccountView, StorageFailureCount and
 * Errors.
 *
 * Instances: one instance per request, as request isolation (ADR-001 Decision 1; the canon's
 * concurrency exception). Each run restores run state to INITIAL itself, keeping the staged inputs.
 */

import { AccountOwner } from './Account.mjs';

const INITIAL_SESSION = Object.freeze({ sessionIsActive: false, sessionToken: '', sessionId: '', accountId: '', createdAt: 0, expiresAt: 0 });

export class SignIn {
  constructor({ Database, Clock, Sessions, Enqueue }) {
    // Dependencies, set at construction.
    this.Database = Database;
    this.Clock = Clock;
    this.Sessions = Sessions;
    this.Enqueue = Enqueue;
    this.AccountOwner = new AccountOwner({ Database, Clock });
    this.InitializeSignIn();
  }

  // Initialization molecule: every field to its INITIAL value.
  InitializeSignIn() {
    // Inputs staged by the caller.
    this.Provider = '';
    this.ProviderSubject = '';
    this.DisplayEmail = '';
    this.PreviousSessionToken = '';
    this.#ResetSignInRunState();
  }

  // Business Action: sign in.
  async SignInAccount() {
    this.#ResetSignInRunState();
    this.#StageAccountIdentity();
    await this.#RegisterAccountOnFirstSignIn();
    this.#CopyAccountIdentity();
    this.#IsAccountReadyForSignIn();
    if (!this.AccountIsReadyForSignIn) {
      this.#RejectSignInForAccount();
      return;
    }
    await this.#StartSession();
    await this.#RecordSignInOnAccount();
    this.#IsAccountReadyForSignIn();
    if (!this.AccountIsReadyForSignIn) {
      this.#RejectSignInForAccount();
      return;
    }
    await this.#ReadSignedInAccount();
    this.#CopySignedInAccountView();
    await this.#LoadPreviousSession();
    this.#IsPreviousSessionActive();
    if (this.PreviousSessionIsActive) {
      await this.#ReleasePreviousSessionLocks();
      await this.#EndPreviousSession();
    }
    this.#IsSignInComplete();
  }

  // PASSIVE: run-state and output fields to INITIAL, keeping the staged inputs.
  #ResetSignInRunState() {
    this.AccountId = '';
    this.AccountIsReadyForSignIn = false;
    this.PreviousSession = { ...INITIAL_SESSION };
    this.PreviousSessionIsActive = false;
    this.PreviousSessionLocksReleased = 0;
    this.PreviousSessionsEnded = 0;
    this.StartedSession = { ...INITIAL_SESSION };
    this.AccountView = { ...this.AccountOwner.AccountView };
    this.SignInIsComplete = false;
    this.StorageFailureCount = 0;
    this.Errors = [];
  }

  // PASSIVE: stage the verified identity into the account owner's inputs, from INITIAL.
  #StageAccountIdentity() {
    this.AccountOwner.InitializeAccount();
    this.AccountOwner.Provider = this.Provider;
    this.AccountOwner.ProviderSubject = this.ProviderSubject;
    this.AccountOwner.DisplayEmail = this.DisplayEmail;
  }

  // ACTIVE: invoke the owner's RegisterAccount (writes only when the account is absent).
  async #RegisterAccountOnFirstSignIn() {
    if (this.Provider === '' || this.ProviderSubject === '') return;
    try {
      await this.AccountOwner.RegisterAccount();
    } catch {
      this.#RecordStorageFailure();
    }
  }

  // PASSIVE: read copy of the account identity the owner derived.
  #CopyAccountIdentity() {
    this.AccountId = this.AccountOwner.AccountId;
  }

  // Question: is the account registered, with no error from its owner (read copies)?
  #IsAccountReadyForSignIn() {
    this.AccountIsReadyForSignIn = this.StorageFailureCount === 0 && this.AccountOwner.Errors.length === 0 && this.AccountOwner.AccountIsRegistered;
  }

  // PASSIVE: keep the owner's errors as the reason the sign-in stopped.
  #RejectSignInForAccount() {
    this.Errors.push(...this.AccountOwner.Errors);
    if (this.Errors.length === 0) this.Errors.push({ code: 'account-not-registered', message: 'The account could not be registered. Try signing in again.' });
  }

  // ACTIVE: invoke the owner's RecordAccountSignIn, once the new session exists.
  async #RecordSignInOnAccount() {
    if (!this.AccountIsReadyForSignIn || this.StartedSession.sessionId === '' || this.StorageFailureCount > 0) return;
    try {
      await this.AccountOwner.RecordAccountSignIn();
    } catch {
      this.#RecordStorageFailure();
    }
  }

  // ACTIVE: look up the browser's previous session.
  async #LoadPreviousSession() {
    if (this.PreviousSessionToken === '' || this.StorageFailureCount > 0) return;
    try {
      this.PreviousSession = await this.Sessions.findActiveSession(this.PreviousSessionToken);
    } catch {
      this.#RecordStorageFailure();
    }
  }

  // Question: does the browser still hold an active session?
  #IsPreviousSessionActive() {
    this.PreviousSessionIsActive = this.PreviousSession.sessionIsActive === true;
  }

  // ACTIVE: release every lock the previous session holds (ADR-001 Decision 3).
  // architecture-record: T1 L1 ADR-001
  async #ReleasePreviousSessionLocks() {
    if (!this.PreviousSessionIsActive || this.StorageFailureCount > 0) return;
    try {
      this.PreviousSessionLocksReleased = await this.Enqueue.releaseAllForSession(this.PreviousSession.sessionId);
    } catch {
      this.#RecordStorageFailure();
    }
  }

  // ACTIVE: end the previous session.
  async #EndPreviousSession() {
    if (!this.PreviousSessionIsActive || this.StorageFailureCount > 0) return;
    try {
      this.PreviousSessionsEnded = await this.Sessions.endSession(this.PreviousSession.sessionId);
    } catch {
      this.#RecordStorageFailure();
    }
  }

  // ACTIVE: start the new 12-hour session (ADR-001 Identity and Decision 3).
  // architecture-record: L1 ADR-001
  async #StartSession() {
    if (!this.AccountIsReadyForSignIn || this.StorageFailureCount > 0) return;
    try {
      this.StartedSession = await this.Sessions.startSession(this.AccountId);
    } catch {
      this.#RecordStorageFailure();
      return;
    }
    if (this.StartedSession.sessionId === '') {
      this.Errors.push({ code: 'session-not-started', message: 'The session could not be started. Try signing in again.' });
    }
  }

  // ACTIVE: invoke the owner's ReadAccount for the signed-in view.
  async #ReadSignedInAccount() {
    if (this.StartedSession.sessionId === '' || this.StorageFailureCount > 0) return;
    try {
      await this.AccountOwner.ReadAccount();
    } catch {
      this.#RecordStorageFailure();
    }
  }

  // PASSIVE: read copy of the owner's account view.
  #CopySignedInAccountView() {
    if (!this.AccountOwner.AccountIsRegistered) return;
    this.AccountView = { ...this.AccountOwner.AccountView };
  }

  // Question: is the sign-in complete (a session started, the sign-in counted, the previous session
  // ended, no failure)?
  #IsSignInComplete() {
    this.SignInIsComplete = this.StartedSession.sessionId !== '' && this.StorageFailureCount === 0 && this.Errors.length === 0;
  }

  // PASSIVE: an error for a storage failure during sign-in.
  #RecordStorageFailure() {
    this.StorageFailureCount += 1;
    this.Errors.push({ code: 'storage-failure', message: 'Sign-in could not be completed. Try again.' });
  }
}
