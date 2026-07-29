import http2 from 'node:http2';
import crypto from 'node:crypto';

// APNs provider-token sender. Token-based auth (a .p8 signing key) rather than
// certificates: one key covers every app on the team and never expires, so
// there's no annual cert rotation to forget. Apple requires HTTP/2, which is
// why this uses node:http2 directly instead of fetch.
//
// Env (Vercel):
//   APNS_KEY_ID       — the key's 10-char ID (Wordocious: YMU68Y2US3)
//   APNS_TEAM_ID      — Apple Developer team ID (Q32F6GRDYG)
//   APNS_PRIVATE_KEY  — the .p8 file contents, PEM including BEGIN/END lines
//   APNS_BUNDLE_ID    — optional; defaults to com.wordocious.app
//
// The iOS app registers tokens into `device_tokens` (PushRegistration.swift);
// this module is the only thing that reads them back out to send.

const APNS_HOST = 'https://api.push.apple.com';
const DEFAULT_BUNDLE_ID = 'com.wordocious.app';

/** Apple accepts a provider token for 1h and rejects refreshes faster than
 *  20min — 50min reuse sits safely inside both bounds. */
const TOKEN_TTL_MS = 50 * 60 * 1000;

/** Requests in flight at once on the shared HTTP/2 session. Apple's per-stream
 *  concurrency is far higher, but this keeps memory flat on large batches. */
const CONCURRENCY = 20;

export interface ApnsMessage {
  /** Hex device token from `device_tokens.token`. */
  token: string;
  title: string;
  body: string;
  /** Deep-link path handed to the app in the payload (e.g. "/daily"). */
  url?: string;
}

export interface ApnsResult {
  sent: number;
  failed: number;
  /** Tokens Apple says are dead — the caller should delete these rows. */
  staleTokens: string[];
  /** Distinct failure reasons, for logging. Never contains token values. */
  errors: string[];
}

/**
 * Vercel's env UI stores multi-line values fine, but keys pasted through
 * shells/CI often arrive with literal "\n" instead of real newlines. Node's
 * PEM parser rejects those, so normalize both shapes.
 */
function normalizePrivateKey(raw: string): string {
  const key = raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
  return key.trim() + '\n';
}

export function isApnsConfigured(): boolean {
  return Boolean(
    process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY,
  );
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Build a signed ES256 provider token. Exported for testing — callers should
 * use `sendApns`, which caches it.
 *
 * `dsaEncoding: 'ieee-p1363'` is load-bearing: Node signs ECDSA as DER by
 * default, but JWS requires the raw r||s form. Without it Apple rejects every
 * push with 403 InvalidProviderToken.
 */
export function buildProviderToken(opts: {
  keyId: string;
  teamId: string;
  privateKey: string;
  now?: number;
}): string {
  const issuedAt = Math.floor((opts.now ?? Date.now()) / 1000);
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: opts.keyId }));
  const payload = base64url(JSON.stringify({ iss: opts.teamId, iat: issuedAt }));
  const signingInput = `${header}.${payload}`;

  const signature = crypto.sign(
    'sha256',
    Buffer.from(signingInput),
    { key: normalizePrivateKey(opts.privateKey), dsaEncoding: 'ieee-p1363' },
  );

  return `${signingInput}.${base64url(signature)}`;
}

let cachedToken: { jwt: string; createdAt: number } | null = null;

function providerToken(now = Date.now()): string {
  if (cachedToken && now - cachedToken.createdAt < TOKEN_TTL_MS) {
    return cachedToken.jwt;
  }
  const jwt = buildProviderToken({
    keyId: process.env.APNS_KEY_ID!,
    teamId: process.env.APNS_TEAM_ID!,
    privateKey: process.env.APNS_PRIVATE_KEY!,
    now,
  });
  cachedToken = { jwt, createdAt: now };
  return jwt;
}

/** Test seam — drops the memoized provider token. */
export function resetProviderTokenCache(): void {
  cachedToken = null;
}

/**
 * Decide what a failed send means. Only 'stale' tokens get deleted: a transient
 * 429/500 must never purge a live device, or one bad afternoon at Apple would
 * quietly unsubscribe the whole user base.
 */
export function classifyApnsFailure(status: number, reason?: string): 'stale' | 'transient' | 'permanent' {
  if (status === 410) return 'stale';                       // device unregistered
  if (status === 400 && reason === 'BadDeviceToken') return 'stale';
  if (status === 400 && reason === 'DeviceTokenNotForTopic') return 'stale';
  if (status === 429 || status >= 500) return 'transient';  // back off, keep token
  return 'permanent';                                        // config/payload bug
}

function buildPayload(msg: ApnsMessage): string {
  return JSON.stringify({
    aps: {
      alert: { title: msg.title, body: msg.body },
      sound: 'default',
      badge: 1,
    },
    // Consumed by the app's notification handler to route the tap.
    url: msg.url ?? '/daily',
  });
}

function sendOne(
  session: http2.ClientHttp2Session,
  jwt: string,
  bundleId: string,
  msg: ApnsMessage,
): Promise<{ ok: boolean; status: number; reason?: string }> {
  return new Promise((resolve) => {
    const payload = buildPayload(msg);
    const req = session.request({
      ':method': 'POST',
      ':path': `/3/device/${msg.token}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    });

    let status = 0;
    let body = '';
    req.setEncoding('utf8');
    req.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0);
    });
    req.on('data', (chunk) => { body += chunk; });
    req.on('error', () => resolve({ ok: false, status: 0, reason: 'StreamError' }));
    req.on('end', () => {
      if (status === 200) return resolve({ ok: true, status });
      let reason: string | undefined;
      try { reason = JSON.parse(body)?.reason; } catch { /* non-JSON error body */ }
      resolve({ ok: false, status, reason });
    });

    req.end(payload);
  });
}

/**
 * Deliver a batch of notifications over one HTTP/2 session.
 *
 * Never throws: push is best-effort and must not fail the cron run that calls
 * it. Failures come back in the result for logging, and dead tokens come back
 * in `staleTokens` for the caller to delete.
 */
export async function sendApns(messages: ApnsMessage[]): Promise<ApnsResult> {
  const result: ApnsResult = { sent: 0, failed: 0, staleTokens: [], errors: [] };
  if (messages.length === 0) return result;

  if (!isApnsConfigured()) {
    result.failed = messages.length;
    result.errors.push('APNs not configured (APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY)');
    return result;
  }

  const bundleId = process.env.APNS_BUNDLE_ID || DEFAULT_BUNDLE_ID;
  let jwt: string;
  try {
    jwt = providerToken();
  } catch (err: any) {
    result.failed = messages.length;
    result.errors.push(`provider token signing failed: ${err?.message ?? 'unknown'}`);
    return result;
  }

  let session: http2.ClientHttp2Session;
  try {
    session = http2.connect(APNS_HOST);
  } catch (err: any) {
    result.failed = messages.length;
    result.errors.push(`connect failed: ${err?.message ?? 'unknown'}`);
    return result;
  }

  const seen = new Set<string>();
  try {
    await new Promise<void>((resolve, reject) => {
      session.once('connect', () => resolve());
      session.once('error', reject);
    });

    for (let i = 0; i < messages.length; i += CONCURRENCY) {
      const slice = messages.slice(i, i + CONCURRENCY);
      const outcomes = await Promise.all(
        slice.map((msg) => sendOne(session, jwt, bundleId, msg)),
      );
      outcomes.forEach((outcome, idx) => {
        if (outcome.ok) { result.sent++; return; }
        result.failed++;
        const kind = classifyApnsFailure(outcome.status, outcome.reason);
        if (kind === 'stale') result.staleTokens.push(slice[idx].token);
        const label = `${outcome.status}${outcome.reason ? ` ${outcome.reason}` : ''}`;
        if (!seen.has(label)) { seen.add(label); result.errors.push(label); }
      });
    }
  } catch (err: any) {
    const remaining = messages.length - result.sent - result.failed;
    result.failed += remaining;
    result.errors.push(`session error: ${err?.message ?? 'unknown'}`);
  } finally {
    session.close();
  }

  return result;
}
