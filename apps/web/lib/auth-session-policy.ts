// When may a failed auth call sign the player out? (Outage fix, 2026-10-03.)
//
// During a Supabase outage the founder finished his last daily and the app
// dropped him onto the sign-in screen. Two web paths did it:
//   1. auth-js 2.93 treats only a thrown fetch and HTTP 502/503/504 as
//      "retryable". A 500, a Cloudflare 520–530, a 429 or an HTML error page
//      on the refresh call is a non-retryable AuthApiError / AuthUnknownError,
//      so auth-js deletes the stored session and fires SIGNED_OUT.
//   2. Even a retryable refresh failure makes getSession() / INITIAL_SESSION
//      report `session: null` once the access token has expired, and
//      AuthProvider read that as "signed out".
//
// The rule (iOS + Android + web): a network or server failure NEVER signs the
// player out. Keep the cached session, user and profile and retry later. Only
// an explicit invalid / revoked refresh token, or the player signing out,
// clears the session. Pure + node-safe (no DOM at import time).

export type AuthErrorOutcome = 'transient' | 'revoked' | 'no-session';

/** GoTrue error codes that mean the session is really gone (not an outage). */
export const REVOKED_AUTH_CODES: ReadonlySet<string> = new Set([
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
  'session_expired',
  'user_not_found',
  'user_banned',
]);

/** Backoff between session-recovery attempts: 5 s, 15 s, 30 s, 60 s, then every 60 s. */
export const SESSION_RETRY_DELAYS_MS: readonly number[] = [5_000, 15_000, 30_000, 60_000];

export function sessionRetryDelay(attempt: number): number {
  const i = Math.max(0, Math.min(Math.floor(attempt), SESSION_RETRY_DELAYS_MS.length - 1));
  return SESSION_RETRY_DELAYS_MS[i];
}

const INVALID_REFRESH_RE = /invalid refresh token|refresh token not found|refresh token.*already used/i;
const NETWORK_RE = /failed to fetch|fetch failed|load failed|networkerror|network ?error|network request failed|err_network|econn|etimedout|enotfound|eai_again|timed? ?out|timeout|unreachable|aborted/i;

function errorCode(e: any): string {
  if (typeof e?.code === 'string' && e.code) return e.code;
  if (typeof e?.error_code === 'string' && e.error_code) return e.error_code;
  return '';
}

function errorStatus(e: any): number | undefined {
  if (typeof e?.status === 'number') return e.status;
  if (typeof e?.statusCode === 'number') return e.statusCode;
  if (typeof e?.code === 'number') return e.code; // GoTrue's newer body: { code: 400, error_code, msg }
  return undefined;
}

function errorMessage(e: any): string {
  if (typeof e === 'string') return e;
  return String(e?.message ?? e?.msg ?? e?.error_description ?? e?.error ?? '');
}

/**
 * Sorts an auth failure (an auth-js error, a thrown fetch error, or a GoTrue
 * error body) into:
 *   'revoked'    — GoTrue said the refresh token / session / user is gone
 *                  (the codes above, or a 400/401 "Invalid Refresh Token").
 *   'no-session' — there is no session at all (AuthSessionMissingError, or no
 *                  error and no session).
 *   'transient'  — everything else: timeouts, fetch TypeErrors,
 *                  AuthRetryableFetchError, 5xx, 429, a non-JSON gateway page,
 *                  auth unreachable. Unknown errors default here on purpose —
 *                  a wrong "transient" costs a retry, a wrong "revoked" costs
 *                  the player their session.
 */
export function classifyAuthError(err: unknown): AuthErrorOutcome {
  if (err == null) return 'no-session';
  const e = err as any;
  const code = errorCode(e);
  const status = errorStatus(e);
  const message = errorMessage(e);
  const name = typeof e?.name === 'string' ? e.name : '';

  if (code && REVOKED_AUTH_CODES.has(code)) return 'revoked';
  if ((status === 400 || status === 401) && INVALID_REFRESH_RE.test(message)) return 'revoked';
  if (name === 'AuthSessionMissingError' || code === 'session_missing') return 'no-session';

  // Everything below is an outage-shaped failure; listed for the reader, all
  // of it lands on 'transient' (as does anything unrecognized).
  if (name === 'AuthRetryableFetchError' || name === 'AuthUnknownError') return 'transient';
  if (name === 'TypeError' || name === 'AbortError' || name === 'TimeoutError') return 'transient';
  if (status === 0 || status === 408 || status === 429 || (status !== undefined && status >= 500)) return 'transient';
  if (NETWORK_RE.test(message)) return 'transient';
  return 'transient';
}

/**
 * Whether the player stays signed in after a failed session load / refresh.
 * Only a transient failure with a session still stored on the device keeps
 * them in; a revoked token or no session at all signs them out.
 */
export function keepsUserSignedIn(outcome: AuthErrorOutcome, hasStoredSession: boolean): boolean {
  return outcome === 'transient' && hasStoredSession;
}

/** The refresh-token grant (the call whose failure used to delete the session). */
export function isRefreshTokenRequest(url: string): boolean {
  return /\/auth\/v1\/token\?(?:[^#]*&)?grant_type=refresh_token(?:&|$|#)/.test(url);
}

/**
 * Whether a non-OK response from an /auth/v1/ endpoint is an outage rather
 * than a GoTrue verdict. `body` is the parsed JSON body, or null when the body
 * wasn't JSON (a gateway / Cloudflare page — GoTrue itself always answers
 * JSON). On the refresh grant, anything short of an explicit revocation is
 * transient; elsewhere (sign-in, sign-up…) a JSON 4xx is a real answer
 * ("Invalid login credentials") and passes through.
 */
export function isTransientAuthResponse(status: number, body: unknown, isRefresh: boolean): boolean {
  if (status === 0 || status === 408 || status === 429 || status >= 500) return true;
  if (body == null || typeof body !== 'object') return true;
  if (!isRefresh) return false;
  const b = body as any;
  return classifyAuthError({
    status,
    code: errorCode(b) || undefined,
    message: errorMessage(b),
  }) !== 'revoked';
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (typeof URL !== 'undefined' && input instanceof URL) return input.href;
  return (input as Request).url ?? String(input);
}

/**
 * Wraps the fetch handed to supabase-js so auth-js can never mistake an outage
 * for a revoked session: a transient non-OK /auth/v1/ response is rethrown as a
 * network TypeError, which auth-js turns into AuthRetryableFetchError — the one
 * error class it never deletes the stored session for. Every other request
 * (PostgREST, storage, functions) passes straight through.
 */
export function makeAuthResilientFetch(base: typeof fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (!url.includes('/auth/v1/')) return base(input as any, init);
    const res = await base(input as any, init);
    if (res.ok) return res;
    let body: unknown = null;
    const type = res.headers?.get?.('content-type') ?? '';
    if (/json/i.test(type)) {
      try { body = await res.clone().json(); } catch { body = null; }
    }
    if (isTransientAuthResponse(res.status, body, isRefreshTokenRequest(url))) {
      throw new TypeError(`Auth server unreachable (HTTP ${res.status})`);
    }
    return res;
  }) as typeof fetch;
}

/** The minimal shape of the session supabase-js keeps in localStorage. */
export interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: { id: string } & Record<string, unknown>;
  [k: string]: unknown;
}

/** Parses a stored `sb-<ref>-auth-token` value; null unless it holds a usable session with a user. */
export function parseStoredSession(raw: string | null | undefined): StoredSession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const s = v && typeof v === 'object' && v.currentSession && typeof v.currentSession === 'object' ? v.currentSession : v;
    if (!s || typeof s !== 'object') return null;
    if (typeof s.access_token !== 'string' || typeof s.refresh_token !== 'string' || !s.refresh_token) return null;
    if (!s.user || typeof s.user !== 'object' || typeof s.user.id !== 'string') return null;
    return s as StoredSession;
  } catch {
    return null;
  }
}

/** True for supabase-js's persisted-session key (`sb-<project-ref>-auth-token`). */
export function isSupabaseSessionKey(key: string): boolean {
  return /^sb-.+-auth-token$/.test(key);
}
