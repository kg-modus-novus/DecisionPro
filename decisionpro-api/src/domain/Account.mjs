// CodeXen-Container: v1 kind=object container=AccountOwner owns=account
/**
 * AccountOwner: object container for the business object Account, the identity of a signed-in
 * Google or Apple user. It is the only writer of the `account` table.
 *
 * Identity: AccountId = `<Provider>:<ProviderSubject>` (ADR-001 Tenancy, P1). Email is stored only
 * for display to its owner.
 *
 * State diagram (docs/planning/measure-targets-codexen-plan.md):
 *   absent ──RegisterAccount──▶ active
 *   active ──RecordAccountSignIn──▶ active
 *
 * A first sign-in that races another first sign-in of the same identity finds the row already
 * written (ON CONFLICT DO NOTHING writes nothing); RegisterAccount reloads and treats the account as
 * registered.
 *
 * Run cycle: the caller (the SignIn program) stages Provider, ProviderSubject and DisplayEmail (verified at the boundary
 * by identityTokens), invokes RegisterAccount and then RecordAccountSignIn, and reads AccountId and
 * Errors. ReadAccount stages AccountId and returns AccountView.
 *
 * Instances: one instance per request, as request isolation (ADR-001 Decision 1; the canon's
 * concurrency exception): molecules await the database, so a shared instance would interleave run state.
 */

const INITIAL_ACCOUNT_VIEW = Object.freeze({
  accountId: '',
  provider: '',
  displayEmail: '',
  registeredAt: '',
  lastSignedInAt: '',
  signInCount: 0,
});

export class AccountOwner {
  constructor({ Database, Clock }) {
    // Dependencies, set at construction.
    this.Database = Database;
    this.Clock = Clock;
    this.InitializeAccount();
  }

  // Initialization molecule: every field to its INITIAL value.
  InitializeAccount() {
    // Inputs staged by the caller.
    this.Provider = '';
    this.ProviderSubject = '';
    this.DisplayEmail = '';
    // Identity and loaded state.
    this.AccountId = '';
    this.AccountRows = [];
    this.AccountRowCount = 0;
    this.AccountStatus = '';
    this.AccountIsRegistered = false;
    this.SignInTime = '';
    this.RecordedDisplayEmail = '';
    this.AccountRowsWritten = 0;
    // Output.
    this.AccountView = { ...INITIAL_ACCOUNT_VIEW };
    this.Errors = [];
  }

  // Business Action. Arrow: absent → active.
  async RegisterAccount() {
    this.#ResetAccountOutcome();
    this.#IdentifyAccount();
    await this.#LoadAccount();
    this.#CountAccountRows();
    this.#IsAccountRegistered();
    if (this.AccountIsRegistered) return;
    this.#StampAccountSignIn();
    await this.#PersistNewAccount();
    await this.#LoadAccount();
    this.#CountAccountRows();
    this.#IsAccountRegistered();
    if (!this.AccountIsRegistered) this.#RejectRegistrationNotRecorded();
  }

  // Business Action. Arrow: active → active.
  async RecordAccountSignIn() {
    this.#ResetAccountOutcome();
    this.#IdentifyAccount();
    await this.#LoadAccount();
    this.#CountAccountRows();
    this.#IsAccountRegistered();
    if (!this.AccountIsRegistered) {
      this.#RejectSignInOfUnregisteredAccount();
      return;
    }
    this.#StampAccountSignIn();
    await this.#PersistAccountSignIn();
  }

  // Read for display to the account's owner. The caller stages AccountId.
  async ReadAccount() {
    this.#ResetAccountOutcome();
    await this.#LoadAccount();
    this.#CountAccountRows();
    this.#IsAccountRegistered();
    this.#ShapeAccountView();
  }

  // PASSIVE: restore run-state and output fields to INITIAL, keeping the staged inputs.
  #ResetAccountOutcome() {
    this.AccountRows = [];
    this.AccountRowCount = 0;
    this.AccountStatus = '';
    this.AccountIsRegistered = false;
    this.SignInTime = '';
    this.RecordedDisplayEmail = '';
    this.AccountRowsWritten = 0;
    this.AccountView = { ...INITIAL_ACCOUNT_VIEW };
    this.Errors = [];
  }

  // PASSIVE: the account identity is the provider and its subject.
  #IdentifyAccount() {
    if (this.Provider === '' || this.ProviderSubject === '') return;
    this.AccountId = `${this.Provider}:${this.ProviderSubject}`;
  }

  // ACTIVE: read the account row.
  async #LoadAccount() {
    if (this.AccountId === '') return;
    this.AccountRows = (await this.Database.query(
      `SELECT account_id, provider, provider_subject, display_email, account_status, registered_at, last_signed_in_at, sign_in_count
         FROM account WHERE account_id = $1`,
      [this.AccountId],
    )).rows;
    if (this.AccountRows.length > 1) {
      this.Errors.push({ code: 'account-identity-duplicated', message: 'More than one account carries this identity.' });
    }
  }

  // PASSIVE: how many account rows were loaded (zero or one).
  #CountAccountRows() {
    this.AccountRowCount = this.AccountRows.length;
    this.AccountStatus = this.AccountRowCount > 0 ? this.AccountRows[0].account_status : 'absent';
  }

  // Question: is this account registered?
  #IsAccountRegistered() {
    this.AccountIsRegistered = this.AccountStatus === 'active';
  }

  // PASSIVE: the time of this sign-in, and the display email to keep (a provider may omit it on later sign-ins).
  #StampAccountSignIn() {
    this.SignInTime = new Date(this.Clock.now()).toISOString();
    this.RecordedDisplayEmail = this.DisplayEmail !== '' || this.AccountRowCount === 0 ? this.DisplayEmail : this.AccountRows[0].display_email;
  }

  // ACTIVE: insert the new account row (arrow absent → active). Zero rows written means another
  // request registered it first; the reload that follows decides.
  async #PersistNewAccount() {
    if (this.AccountIsRegistered || this.AccountId === '' || this.SignInTime === '') return;
    this.AccountRowsWritten = (await this.Database.query(
      `INSERT INTO account (account_id, provider, provider_subject, display_email, account_status, registered_at, last_signed_in_at, sign_in_count)
       VALUES ($1, $2, $3, $4, 'active', $5, $5, 0)
       ON CONFLICT (account_id) DO NOTHING`,
      [this.AccountId, this.Provider, this.ProviderSubject, this.DisplayEmail, this.SignInTime],
    )).rowCount;
    if (this.AccountRowsWritten > 1) {
      this.Errors.push({ code: 'account-identity-duplicated', message: 'More than one account row was written for this identity.' });
    }
  }

  // ACTIVE: record the sign-in on the registered account (arrow active → active).
  async #PersistAccountSignIn() {
    if (!this.AccountIsRegistered || this.SignInTime === '') return;
    this.AccountRowsWritten = (await this.Database.query(
      `UPDATE account SET last_signed_in_at = $2, sign_in_count = sign_in_count + 1,
              display_email = $3
        WHERE account_id = $1 AND account_status = 'active'`,
      [this.AccountId, this.SignInTime, this.RecordedDisplayEmail],
    )).rowCount;
    if (this.AccountRowsWritten !== 1) {
      this.Errors.push({ code: 'account-sign-in-not-recorded', message: 'The sign-in could not be recorded. Try signing in again.' });
    }
  }

  // PASSIVE: an error for a registration that left no account row.
  #RejectRegistrationNotRecorded() {
    this.Errors.push({ code: 'account-not-registered', message: 'The account could not be registered. Try signing in again.' });
  }

  // PASSIVE: an error for a sign-in on an account that was never registered.
  #RejectSignInOfUnregisteredAccount() {
    this.Errors.push({ code: 'account-not-registered', message: 'This account is not registered.' });
  }

  // PASSIVE: the owner's view of the account.
  #ShapeAccountView() {
    if (!this.AccountIsRegistered) return;
    this.AccountView = {
      accountId: this.AccountRows[0].account_id,
      provider: this.AccountRows[0].provider,
      displayEmail: this.AccountRows[0].display_email,
      registeredAt: new Date(this.AccountRows[0].registered_at).toISOString(),
      lastSignedInAt: new Date(this.AccountRows[0].last_signed_in_at).toISOString(),
      signInCount: Number(this.AccountRows[0].sign_in_count),
    };
  }
}
