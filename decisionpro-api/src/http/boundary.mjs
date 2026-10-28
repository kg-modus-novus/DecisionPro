// CodeXen: v1 not-applicable
// HTTP boundary adapters (framework wiring): JSON responses, JSON bodies, CORS allowlist, and the
// normalization of requested targets before they are staged into a container. External null and
// undefined end here; containers only ever see INITIAL-valued, typed fields.

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_TARGETS_PER_REQUEST = 100;
export const MAX_NOTE_LENGTH = 500;
export const MAX_MEASURE_ID_LENGTH = 200;

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

export async function readJsonBody(req) {
  const contentType = String(req.headers['content-type'] ?? '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    throw new HttpError(415, 'unsupported-media-type', 'Send the request body as application/json.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'body-too-large', 'The request body is too large.');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim() === '') throw new HttpError(400, 'invalid-json', 'The request body is empty.');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid-json', 'The request body is not valid JSON.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'invalid-json', 'The request body must be a JSON object.');
  }
  return parsed;
}

export function parseAllowedOrigins(value) {
  return String(value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin !== '');
}

const CORS_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
const CORS_HEADERS = 'Content-Type';

// Returns the CORS headers for an allowed origin, or throws 403 for an origin outside the allowlist.
// Requests without an Origin header (same-origin navigations, health checks, curl) carry no CORS headers.
export function resolveCors(req, allowedOrigins) {
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || origin === '') return {};
  if (!allowedOrigins.includes(origin)) {
    throw new HttpError(403, 'origin-not-allowed', 'This origin may not call the DecisionPro API.');
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': CORS_METHODS,
    'Access-Control-Allow-Headers': CORS_HEADERS,
    Vary: 'Origin',
  };
}

// Normalizes PUT /targets: { targets: [{ measureId, value, note, retire }] }.
// measureId: string; value: finite number (may be omitted only when retiring; then 0, unused);
// note: string of at most 500 characters, or omitted to keep the stored note (noteChange 'keep',
// note ''); retire: boolean (false when omitted). At most 100 targets. Anything else is a 400.
export function normalizeRequestedTargets(body) {
  if (!Array.isArray(body.targets)) throw new HttpError(400, 'invalid-targets', 'targets must be an array.');
  if (body.targets.length > MAX_TARGETS_PER_REQUEST) {
    throw new HttpError(400, 'too-many-targets', `At most ${MAX_TARGETS_PER_REQUEST} targets can be saved at once.`);
  }
  return body.targets.map((target, index) => {
    const where = `targets[${index}]`;
    if (target === null || typeof target !== 'object' || Array.isArray(target)) {
      throw new HttpError(400, 'invalid-target', `${where} must be an object.`);
    }
    if (typeof target.measureId !== 'string' || target.measureId.trim() === '' || target.measureId.length > MAX_MEASURE_ID_LENGTH) {
      throw new HttpError(400, 'invalid-target', `${where}.measureId must be a non-empty string.`);
    }
    const retire = target.retire === undefined || target.retire === null ? false : target.retire;
    if (typeof retire !== 'boolean') throw new HttpError(400, 'invalid-target', `${where}.retire must be true or false.`);
    const valueIsAbsent = target.value === undefined || target.value === null;
    if (valueIsAbsent && !retire) throw new HttpError(400, 'invalid-target', `${where}.value must be a number.`);
    if (!valueIsAbsent && (typeof target.value !== 'number' || !Number.isFinite(target.value))) {
      throw new HttpError(400, 'invalid-target', `${where}.value must be a finite number.`);
    }
    const noteIsAbsent = target.note === undefined || target.note === null;
    const note = noteIsAbsent ? '' : target.note;
    if (typeof note !== 'string') throw new HttpError(400, 'invalid-target', `${where}.note must be a string.`);
    if ([...note].length > MAX_NOTE_LENGTH) {
      throw new HttpError(400, 'invalid-target', `${where}.note must be at most ${MAX_NOTE_LENGTH} characters.`);
    }
    return {
      measureId: target.measureId.trim(),
      value: valueIsAbsent ? 0 : target.value,
      note,
      noteChange: noteIsAbsent ? 'keep' : 'replace',
      retire,
    };
  });
}
