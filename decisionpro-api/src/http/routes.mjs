// CodeXen: v1 not-applicable
// Thin route adapters (framework wiring). Each adapter reads the request, stages container inputs,
// invokes one container molecule, and maps the container's answer and counter fields to an HTTP
// status. Business decisions live in the containers (src/domain); sessions, locks and the ledger are
// D2 platform modules (src/platform).

import { AccountOwner } from '../domain/Account.mjs';
import { MeasureTargetOwner } from '../domain/MeasureTarget.mjs';
import { MyTargetsEditing } from '../domain/MyTargetsEditing.mjs';
import { SignIn } from '../domain/SignIn.mjs';
import { SignOut } from '../domain/SignOut.mjs';
import { IdentityTokenError } from '../platform/identityTokens.mjs';
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  readSessionTokenFromCookieHeader,
} from '../platform/sessions.mjs';
import { HttpError, normalizeRequestedTargets, readJsonBody, resolveCors, sendJson } from './boundary.mjs';
import { SIGN_IN_RATE_LIMIT, clientAddress, createRateLimiter } from './rateLimit.mjs';

export function createRequestHandler(services) {
  const { database, sessions, enqueue, ledger, identityTokens, measureCatalog, clock, config } = services;
  // Sign-in attempts per client address: plan, Coordination mechanisms table.
  // architecture-record: T1 ADR-001
  const signInRateLimiter = createRateLimiter({ ...SIGN_IN_RATE_LIMIT, ...(config.signInRateLimit ?? {}), clock });

  // One container instance per request: request isolation (ADR-001 Decision 1).
  // architecture-record: T1 ADR-001
  const newAccountOwner = () => new AccountOwner({ Database: database, Clock: clock });
  const newMeasureTargetOwner = () => new MeasureTargetOwner({ Database: database, MeasureCatalog: measureCatalog, Clock: clock });
  const newMyTargetsEditing = () => new MyTargetsEditing({ Database: database, Enqueue: enqueue, MeasureCatalog: measureCatalog, Clock: clock });
  const newSignIn = () => new SignIn({ Database: database, Clock: clock, Sessions: sessions, Enqueue: enqueue });
  const newSignOut = () => new SignOut({ Sessions: sessions, Enqueue: enqueue });

  async function requireSession(req) {
    const session = await sessions.findActiveSession(readSessionTokenFromCookieHeader(req.headers.cookie));
    if (!session.sessionIsActive) throw new HttpError(401, 'not-signed-in', 'Sign in to continue.');
    return session;
  }

  function stageEditing(session) {
    const editing = newMyTargetsEditing();
    editing.AccountId = session.accountId;
    editing.SessionId = session.sessionId;
    editing.SessionExpiresAt = session.expiresAt;
    return editing;
  }

  async function signIn(req, res, cors, verifiedIdentity) {
    const signing = newSignIn();
    signing.Provider = verifiedIdentity.provider;
    signing.ProviderSubject = verifiedIdentity.providerSubject;
    signing.DisplayEmail = verifiedIdentity.email;
    signing.PreviousSessionToken = readSessionTokenFromCookieHeader(req.headers.cookie);
    await signing.SignInAccount();
    if (!signing.SignInIsComplete) {
      const status = signing.StorageFailureCount > 0 ? 503 : 500;
      sendJson(res, status, { error: signing.Errors[0]?.code ?? 'sign-in-failed', message: signing.Errors[0]?.message ?? 'Sign-in failed.' }, cors);
      return;
    }
    sendJson(res, 200, {
      account: signing.AccountView,
      session: { expiresAt: new Date(signing.StartedSession.expiresAt).toISOString() },
    }, { ...cors, 'Set-Cookie': buildSessionCookie(signing.StartedSession.sessionToken, { cookieDomain: config.cookieDomain }) });
  }

  function limitSignInAttempts(req) {
    if (!signInRateLimiter.allow(clientAddress(req, config.trustProxy === true))) {
      throw new HttpError(429, 'too-many-requests', 'Too many sign-in attempts from this address. Wait a few minutes and try again.');
    }
  }

  const routes = {
    'GET /health': async (req, res, cors) => {
      await database.query('SELECT 1 AS ok');
      sendJson(res, 200, { status: 'ok', service: 'decisionpro-api' }, cors);
    },

    'POST /auth/google': async (req, res, cors) => {
      limitSignInAttempts(req);
      const body = await readJsonBody(req);
      const identity = await identityTokens.verifyGoogleIdToken(typeof body.credential === 'string' ? body.credential : '');
      await signIn(req, res, cors, identity);
    },

    'POST /auth/apple': async (req, res, cors) => {
      limitSignInAttempts(req);
      const body = await readJsonBody(req);
      const identity = await identityTokens.verifyAppleIdToken(typeof body.idToken === 'string' ? body.idToken : '');
      await signIn(req, res, cors, identity);
    },

    // Sign-out is not rate limited. The cookie is cleared only once the session has ended.
    'POST /auth/sign-out': async (req, res, cors) => {
      const signing = newSignOut();
      signing.SessionToken = readSessionTokenFromCookieHeader(req.headers.cookie);
      await signing.SignOutAccount();
      if (!signing.SignOutIsComplete) {
        const status = signing.StorageFailureCount > 0 ? 503 : 500;
        sendJson(res, status, { signedOut: false, error: signing.Errors[0]?.code ?? 'sign-out-failed', message: signing.Errors[0]?.message ?? 'Sign-out failed.' }, cors);
        return;
      }
      sendJson(res, 200, { signedOut: true, releasedLocks: signing.SessionLocksReleased }, {
        ...cors,
        'Set-Cookie': buildClearedSessionCookie({ cookieDomain: config.cookieDomain }),
      });
    },

    'GET /me': async (req, res, cors) => {
      const session = await requireSession(req);
      const account = newAccountOwner();
      account.AccountId = session.accountId;
      await account.ReadAccount();
      if (!account.AccountIsRegistered) throw new HttpError(401, 'not-signed-in', 'Sign in to continue.');
      sendJson(res, 200, {
        account: account.AccountView,
        session: { expiresAt: new Date(session.expiresAt).toISOString() },
        failedOperations: await ledger.listFailedOperations(session.accountId),
      }, cors);
    },

    'GET /targets': async (req, res, cors) => {
      const session = await requireSession(req);
      const owner = newMeasureTargetOwner();
      owner.OwnerScope = session.accountId;
      await owner.ReadActiveMeasureTargets();
      if (owner.Errors.length > 0) throw new HttpError(500, owner.Errors[0].code, owner.Errors[0].message);
      sendJson(res, 200, { targets: owner.ActiveTargets, count: owner.ActiveTargetCount }, cors);
    },

    'POST /targets/edit': async (req, res, cors) => {
      const editing = stageEditing(await requireSession(req));
      await editing.OpenMyTargetsForEditing();
      if (editing.StorageFailureCount > 0) {
        sendJson(res, 503, { error: 'storage-failure', editing: false, errors: editing.Errors }, cors);
      } else if (!editing.LockIsHeld) {
        sendJson(res, 409, { error: 'targets-open-elsewhere', editing: false, holder: editing.LockHolderDescription }, cors);
      } else {
        sendJson(res, 200, { editing: true }, cors);
      }
    },

    'PUT /targets': async (req, res, cors) => {
      const session = await requireSession(req);
      const requestedTargets = normalizeRequestedTargets(await readJsonBody(req));
      const editing = stageEditing(session);
      editing.RequestedTargets = requestedTargets;
      await editing.SaveMyTargets();
      if (!editing.LockIsHeld) {
        sendJson(res, 409, { error: 'lock-not-held', holder: editing.LockHolderDescription, errors: editing.Errors }, cors);
        return;
      }
      const status = editing.SaveIsCommitted ? 200 : editing.StorageFailureCount > 0 ? 503 : 422;
      sendJson(res, status, {
        committed: editing.SaveIsCommitted,
        saved: editing.TargetsSaved,
        retired: editing.TargetsRetired,
        rejected: editing.TargetsRejected,
        committedTargets: editing.TargetsCommitted,
        lockReleased: editing.LockReleaseCount === 1,
        errors: editing.Errors,
      }, cors);
    },

    'DELETE /targets/edit': async (req, res, cors) => {
      const editing = stageEditing(await requireSession(req));
      await editing.CancelMyTargetsEditing();
      sendJson(res, 200, { editing: false, released: editing.LockReleaseCount, errors: editing.Errors }, cors);
    },
  };

  const knownPaths = new Set(Object.keys(routes).map((key) => key.split(' ')[1]));

  return async function handleRequest(req, res) {
    let cors = {};
    try {
      cors = resolveCors(req, config.allowedOrigins);
      const path = new URL(req.url ?? '/', 'http://localhost').pathname.replace(/\/+$/, '') || '/';
      if (req.method === 'OPTIONS') {
        res.writeHead(knownPaths.has(path) ? 204 : 404, cors);
        res.end();
        return;
      }
      const route = routes[`${req.method} ${path}`];
      if (!route) {
        throw knownPaths.has(path)
          ? new HttpError(405, 'method-not-allowed', 'This method is not allowed here.')
          : new HttpError(404, 'not-found', 'Not found.');
      }
      await route(req, res, cors);
    } catch (error) {
      if (res.headersSent) {
        res.destroy(error);
        return;
      }
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: error.code, message: error.message }, cors);
      } else if (error instanceof IdentityTokenError) {
        // A provider key server that cannot be reached is the service's problem, not the token's.
        const status = error.reason === 'key-set-unavailable' ? 503 : 401;
        sendJson(res, status, { error: status === 503 ? 'identity-provider-unavailable' : 'invalid-id-token', reason: error.reason, message: error.message }, cors);
      } else {
        console.error('[decisionpro-api] request failed', req.method, req.url, error);
        sendJson(res, 500, { error: 'internal-error', message: 'Something went wrong. Try again.' }, cors);
      }
    }
  };
}
