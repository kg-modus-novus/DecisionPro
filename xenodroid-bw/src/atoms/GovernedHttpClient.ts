/**
 * Shared governed HTTP client for state-neutral OFR adapters (award grain,
 * IRS extracts, CMS HCRIS/ownership, waiver documents, Grants.gov). Extracted
 * from the throttling/backoff/user-agent controls proven in
 * xenodroid-bw/scripts/refresh-florida-public-sources.mjs so every new OFR
 * source reuses the same publisher-respecting behavior instead of a bespoke
 * fetch per adapter.
 */

const DEFAULT_USER_AGENT =
  'DecisionProOFR-DataRequest/1.0 (+https://decisionpro.io/data-requests)';

export type GovernedHttpClientOptions = {
  userAgent?: string;
  minDelayMs?: number;
  largeResponseDelayMs?: number;
  largeResponseThresholdBytes?: number;
  requestCeiling?: number;
  timeoutMs?: number;
  maxAttempts?: number;
};

function envInt(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

const CREDENTIAL_QUERY_PARAMS = ['api_key', 'apikey', 'key', 'token', 'access_token'];

const CREDENTIAL_QUERY_PATTERN = new RegExp(
  `([?&](?:${CREDENTIAL_QUERY_PARAMS.join('|')})=)[^&\\s'")]+`,
  'gi',
);

/**
 * Strips known credential-bearing query parameters before a URL — or any
 * arbitrary text that might contain one embedded inside it (a nested error
 * message, an AbortError string, etc.) — is ever used in a thrown error, a
 * Gap reason, or any other text that could end up in console output, a log,
 * or an exported artifact. Every error path in this client routes text
 * through this first — a credentialed source (e.g. SAM.gov) must never leak
 * its key via a caught exception. Handles both "the whole string is a URL"
 * and "a URL is embedded somewhere in this text" cases.
 */
export function RedactCredentialedUri(text: string): string {
  if (!text) return text;
  try {
    const url = new URL(text);
    for (const param of CREDENTIAL_QUERY_PARAMS) {
      if (url.searchParams.has(param)) url.searchParams.set(param, 'REDACTED');
    }
    return url.toString();
  } catch {
    return text.replace(CREDENTIAL_QUERY_PATTERN, '$1REDACTED');
  }
}

/**
 * Business Action: GovernedHttpClient
 * Paces, retries, and hard-caps outbound requests to a public source within
 * one adapter run; never bypasses a technical or policy control.
 */
export class GovernedHttpClient {
  requestCount = 0;
  private lastRequestAt = 0;
  private readonly userAgent: string;
  private readonly minDelayMs: number;
  private readonly largeResponseDelayMs: number;
  private readonly largeResponseThresholdBytes: number;
  private readonly requestCeiling: number;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;

  constructor(options: GovernedHttpClientOptions = {}) {
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.minDelayMs = options.minDelayMs ?? envInt('DPRO_OFR_DELAY_MS', 1200);
    this.largeResponseDelayMs = options.largeResponseDelayMs ?? envInt('DPRO_OFR_LARGE_DELAY_MS', 4000);
    this.largeResponseThresholdBytes = options.largeResponseThresholdBytes ?? 262_144;
    this.requestCeiling = options.requestCeiling ?? envInt('DPRO_OFR_REQUEST_CEILING', 400);
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.maxAttempts = options.maxAttempts ?? 3;
  }

  private async pace() {
    const wait = Math.max(0, this.minDelayMs - (Date.now() - this.lastRequestAt));
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  }

  async FetchJson<T = unknown>(uri: string, init: RequestInit = {}): Promise<{ json: T; bytes: Buffer; finalUri: string }> {
    const safeUri = RedactCredentialedUri(uri);
    if (this.requestCount >= this.requestCeiling) {
      throw new Error(`GovernedHttpClient request ceiling (${this.requestCeiling}) reached before fetching ${safeUri}`);
    }
    let lastError = '';
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      await this.pace();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        this.requestCount += 1;
        this.lastRequestAt = Date.now();
        const response = await fetch(uri, {
          ...init,
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': this.userAgent,
            ...(init.headers || {}),
          },
        });
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!response.ok) {
          lastError = `HTTP ${response.status} ${response.statusText}`;
          if (response.status !== 429 && response.status < 500) {
            throw new Error(`Governed fetch failed for ${safeUri}: ${lastError}`);
          }
        } else {
          if (bytes.byteLength > this.largeResponseThresholdBytes) {
            await new Promise((resolve) => setTimeout(resolve, this.largeResponseDelayMs));
          }
          return { json: JSON.parse(bytes.toString('utf8')) as T, bytes, finalUri: RedactCredentialedUri(response.url || uri) };
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        // An error thrown inside this block (e.g. the HTTP-failed branch
        // above) already has the URL redacted; this second pass only
        // matters for network/abort errors whose message Node may have
        // embedded the raw URL into (e.g. AbortError, DNS failures).
        lastError = RedactCredentialedUri(lastError);
      } finally {
        clearTimeout(timer);
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 800));
    }
    throw new Error(`Governed fetch exhausted retries for ${safeUri}: ${lastError}`);
  }
}
