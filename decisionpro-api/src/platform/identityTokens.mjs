// CodeXen: v1 not-applicable
// ID token verification (adapter, ADR-001 Identity): a cryptographic check, no business decision.
// Google and Apple OpenID Connect ID tokens are verified against each provider's published JWKS
// for signature, issuer, audience and expiry. Tests inject a local key set through `keySets`.

import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from 'jose';

export const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
export const APPLE_ISSUER = 'https://appleid.apple.com';
export const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

// Both providers sign ID tokens with RS256; any other algorithm is refused before key lookup.
export const ALLOWED_ALGORITHMS = Object.freeze(['RS256']);
export const REQUIRED_CLAIMS = Object.freeze(['exp', 'iat', 'sub']);

// reason: missing-token | not-configured | malformed | algorithm | unknown-key | signature |
//         expired | issuer | audience | missing-claim | invalid-claim | key-set-unavailable
export class IdentityTokenError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}

// A failure that is not a JOSE verification error (a network error from fetching the JWKS) or a
// JWKS fetch error means the provider's keys could not be obtained: key-set-unavailable.
function classifyVerificationFailure(error) {
  if (!(error instanceof joseErrors.JOSEError)) return 'key-set-unavailable';
  switch (error.code) {
    case 'ERR_JWT_EXPIRED': return 'expired';
    case 'ERR_JOSE_ALG_NOT_ALLOWED': return 'algorithm';
    case 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED': return 'signature';
    case 'ERR_JWKS_NO_MATCHING_KEY':
    case 'ERR_JWKS_MULTIPLE_MATCHING_KEYS': return 'unknown-key';
    case 'ERR_JWKS_TIMEOUT':
    case 'ERR_JWKS_INVALID':
    case 'ERR_JOSE_GENERIC': return 'key-set-unavailable'; // e.g. a non-200 response from the JWKS endpoint
    case 'ERR_JWT_CLAIM_VALIDATION_FAILED':
      if (error.reason === 'missing') return 'missing-claim';
      if (error.claim === 'iss') return 'issuer';
      if (error.claim === 'aud') return 'audience';
      return 'invalid-claim';
    default: return 'malformed';
  }
}

// Provider key cache (plan, Coordination mechanisms; ADR-001 Identity). jose's remote key set keeps
// the fetched keys in this process's memory for 10 minutes, refetches no sooner than 30 seconds
// after a fetch (cooldown, also when a token names an unknown key), and abandons a fetch after
// 5 seconds (then key-set-unavailable, 503). The values are jose's defaults, stated explicitly.
// architecture-record: T1 ADR-001
export const PROVIDER_KEY_CACHE = Object.freeze({ cacheMaxAge: 10 * 60 * 1000, cooldownDuration: 30 * 1000, timeoutDuration: 5 * 1000 });

export function createIdentityTokenVerifier({ googleClientId, appleServicesId, keySets = {} }) {
  // architecture-record: T1 ADR-001
  const googleKeys = keySets.google ?? createRemoteJWKSet(new URL(GOOGLE_JWKS_URL), PROVIDER_KEY_CACHE);
  const appleKeys = keySets.apple ?? createRemoteJWKSet(new URL(APPLE_JWKS_URL), PROVIDER_KEY_CACHE);

  async function verify(token, keys, options, provider) {
    if (typeof token !== 'string' || token === '') throw new IdentityTokenError('missing-token', 'An ID token is required');
    if (!options.audience) throw new IdentityTokenError('not-configured', `${provider} sign-in is not configured`);
    let payload;
    try {
      ({ payload } = await jwtVerify(token, keys, { ...options, algorithms: [...ALLOWED_ALGORITHMS], requiredClaims: [...REQUIRED_CLAIMS] }));
    } catch (error) {
      const reason = classifyVerificationFailure(error);
      throw new IdentityTokenError(reason, `The ${provider} ID token was rejected (${reason}).`);
    }
    if (typeof payload.sub !== 'string' || payload.sub === '') throw new IdentityTokenError('missing-claim', `The ${provider} ID token has no subject.`);
    return {
      provider,
      providerSubject: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
    };
  }

  return {
    verifyGoogleIdToken(token) {
      return verify(token, googleKeys, { issuer: GOOGLE_ISSUERS, audience: googleClientId }, 'google');
    },
    verifyAppleIdToken(token) {
      return verify(token, appleKeys, { issuer: APPLE_ISSUER, audience: appleServicesId }, 'apple');
    },
  };
}
