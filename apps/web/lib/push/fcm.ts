import crypto from 'node:crypto';

// FCM HTTP v1 sender — the Android counterpart to apns.ts, same shape so the
// callers can treat the two symmetrically.
//
// v1 rather than the old legacy server key: Google shut the legacy endpoint
// down, and v1 authenticates with a short-lived OAuth2 access token minted from
// a service-account key rather than a static secret sitting in an env var.
//
// Env (Vercel):
//   FCM_SERVICE_ACCOUNT — the service-account JSON, verbatim, from Firebase
//                         Project settings -> Service accounts -> Generate new
//                         private key. Needs client_email, private_key, project_id.
//
// The Android app registers tokens into `device_tokens` with platform='android'
// (PushRegistration.kt); this module is the only thing that reads them back out.

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Google issues 1h access tokens; 50min reuse stays clear of the boundary. */
const TOKEN_TTL_MS = 50 * 60 * 1000;

/** Concurrent sends. FCM allows far more; this keeps memory flat on big batches. */
const CONCURRENCY = 20;

export interface FcmMessage {
  /** Registration token from `device_tokens.token`. */
  token: string;
  title: string;
  body: string;
  /** Deep-link path handed to the app (e.g. "/daily"). */
  url?: string;
}

export interface FcmResult {
  sent: number;
  failed: number;
  /** Tokens FCM says are dead — the caller should delete these rows. */
  staleTokens: string[];
  /** Distinct failure reasons, for logging. Never contains token values. */
  errors: string[];
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!sa.client_email || !sa.private_key || !sa.project_id) return null;
    // Vercel's env UI turns real newlines into the two-character \n sequence;
    // PEM parsing fails silently on that, so normalize before use.
    return {
      client_email: sa.client_email,
      private_key: sa.private_key.replace(/\\n/g, '\n'),
      project_id: sa.project_id,
    };
  } catch {
    return null;
  }
}

export function isFcmConfigured(): boolean {
  return readServiceAccount() !== null;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export function resetAccessTokenCache(): void {
  cachedToken = null;
}

/**
 * Build the signed JWT assertion Google exchanges for an access token.
 *
 * RS256 here, unlike APNs' ES256 — and RSA signatures are DER-encoded by
 * default, which is what JWS expects, so this needs none of the
 * `dsaEncoding: 'ieee-p1363'` handling the APNs path does.
 */
export function buildAssertion(sa: ServiceAccount, nowSec: number): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  const signingInput = `${b64(header)}.${b64(claims)}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .sign(sa.private_key)
    .toString('base64url');
  return `${signingInput}.${signature}`;
}

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  try {
    const assertion = buildAssertion(sa, Math.floor(Date.now() / 1000));
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) return null;
    cachedToken = { value: json.access_token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return json.access_token;
  } catch {
    return null;
  }
}

/**
 * Map an FCM failure to a disposition.
 *
 * Only UNREGISTERED and the malformed-token case mean the row is dead. Quota
 * and 5xx are transient and MUST NOT delete tokens — a bad classification here
 * silently unsubscribes real users during an outage, which is the failure mode
 * that matters most in this file.
 */
export function classifyFcmFailure(
  status: number,
  errorCode?: string,
): 'stale' | 'transient' | 'permanent' {
  if (errorCode === 'UNREGISTERED') return 'stale';
  // A token that no longer parses is dead. INVALID_ARGUMENT can also mean a
  // malformed PAYLOAD, but the payload here is built by us and constant, so in
  // practice it is the token.
  if (status === 404) return 'stale';
  if (status === 429 || status >= 500) return 'transient';
  if (errorCode === 'INVALID_ARGUMENT') return 'stale';
  return 'permanent';
}

/** Send a batch. Never throws — push must not take a cron route down. */
export async function sendFcm(messages: FcmMessage[]): Promise<FcmResult> {
  const result: FcmResult = { sent: 0, failed: 0, staleTokens: [], errors: [] };
  if (messages.length === 0) return result;

  const sa = readServiceAccount();
  if (!sa) {
    result.failed = messages.length;
    result.errors.push('fcm_not_configured');
    return result;
  }
  const accessToken = await getAccessToken(sa);
  if (!accessToken) {
    result.failed = messages.length;
    result.errors.push('fcm_auth_failed');
    return result;
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const noteError = (e: string) => {
    if (!result.errors.includes(e)) result.errors.push(e);
  };

  const sendOne = async (m: FcmMessage) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: m.token,
            notification: { title: m.title, body: m.body },
            // Delivered alongside the notification so a tap can deep-link,
            // matching the `url` the APNs payload carries.
            ...(m.url ? { data: { url: m.url } } : {}),
            android: { priority: 'high' as const },
          },
        }),
      });
      if (res.ok) {
        result.sent += 1;
        return;
      }
      const body = (await res.json().catch(() => null)) as
        | { error?: { status?: string; message?: string } }
        | null;
      const code = body?.error?.status;
      const disposition = classifyFcmFailure(res.status, code);
      result.failed += 1;
      noteError(code || `http_${res.status}`);
      if (disposition === 'stale') result.staleTokens.push(m.token);
    } catch {
      result.failed += 1;
      noteError('network_error');
    }
  };

  for (let i = 0; i < messages.length; i += CONCURRENCY) {
    await Promise.all(messages.slice(i, i + CONCURRENCY).map(sendOne));
  }
  return result;
}
