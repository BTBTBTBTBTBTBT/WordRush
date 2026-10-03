import { describe, it, expect, vi, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  classifyAuthError,
  isRefreshTokenRequest,
  isTransientAuthResponse,
  keepsUserSignedIn,
  makeAuthResilientFetch,
  parseStoredSession,
  sessionRetryDelay,
} from './auth-session-policy';

// Outage fix (2026-10-03): the founder beat his last daily during a Supabase
// outage and the app showed the sign-in screen. A failed session refresh from
// a network / server error must never sign the player out; only an explicit
// invalid / revoked refresh token (or signing out) may.

/** auth-js-shaped errors (name/status/code are what the policy reads). */
function authError(name: string, message: string, status?: number, code?: string) {
  const e = new Error(message) as Error & { status?: number; code?: string };
  e.name = name;
  if (status !== undefined) e.status = status;
  if (code !== undefined) e.code = code;
  return e;
}

describe('classifyAuthError + keepsUserSignedIn', () => {
  const transient = [
    ['timeout', authError('TimeoutError', 'The operation timed out.')],
    ['5xx', authError('AuthApiError', 'Internal Server Error', 500)],
    ['Cloudflare 522', authError('AuthApiError', 'Connection timed out', 522)],
    ['429', authError('AuthApiError', 'Too many requests', 429, 'over_request_rate_limit')],
    ['AuthRetryableFetchError', authError('AuthRetryableFetchError', 'Failed to fetch', 0)],
    ['network TypeError', new TypeError('Failed to fetch')],
    ['non-JSON gateway page', authError('AuthUnknownError', 'Unexpected token < in JSON')],
    ['auth unreachable', new Error('Auth server unreachable (HTTP 503)')],
  ] as const;

  for (const [label, err] of transient) {
    it(`a transient refresh error (${label}) keeps the user signed in`, () => {
      expect(classifyAuthError(err)).toBe('transient');
      expect(keepsUserSignedIn(classifyAuthError(err), true)).toBe(true);
    });
  }

  it('a revoked refresh token signs out', () => {
    for (const code of ['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired', 'user_not_found', 'user_banned']) {
      const err = authError('AuthApiError', 'nope', 400, code);
      expect(classifyAuthError(err)).toBe('revoked');
      expect(keepsUserSignedIn(classifyAuthError(err), true)).toBe(false);
    }
    // Legacy body without a code: 400/401 "Invalid Refresh Token".
    expect(classifyAuthError(authError('AuthApiError', 'Invalid Refresh Token: Refresh Token Not Found', 400))).toBe('revoked');
    expect(classifyAuthError(authError('AuthApiError', 'Invalid Refresh Token: Already Used', 401))).toBe('revoked');
  });

  it('no session at all is "no-session" and signs out', () => {
    expect(classifyAuthError(authError('AuthSessionMissingError', 'Auth session missing!', 400))).toBe('no-session');
    expect(classifyAuthError(null)).toBe('no-session');
    expect(keepsUserSignedIn('no-session', true)).toBe(false);
  });

  it('a transient error with nothing stored cannot keep anyone signed in', () => {
    expect(keepsUserSignedIn('transient', false)).toBe(false);
  });

  it('an unrecognized error defaults to transient (a wrong guess costs a retry, not the session)', () => {
    expect(classifyAuthError(authError('AuthApiError', 'something odd', 403, 'bad_jwt'))).toBe('transient');
    expect(classifyAuthError({})).toBe('transient');
  });
});

describe('retry backoff', () => {
  it('is 5 s, 15 s, 30 s, 60 s, then every 60 s', () => {
    expect([0, 1, 2, 3, 4, 9, 50].map(sessionRetryDelay)).toEqual([5000, 15000, 30000, 60000, 60000, 60000, 60000]);
  });
});

describe('isTransientAuthResponse', () => {
  it('treats 5xx / 429 / 408 and non-JSON bodies as outages', () => {
    expect(isTransientAuthResponse(500, { msg: 'x' }, true)).toBe(true);
    expect(isTransientAuthResponse(520, null, true)).toBe(true);
    expect(isTransientAuthResponse(429, { error_code: 'over_request_rate_limit' }, false)).toBe(true);
    expect(isTransientAuthResponse(401, null, false)).toBe(true); // HTML from a proxy, not GoTrue
  });
  it('on the refresh grant only a revocation passes through', () => {
    expect(isTransientAuthResponse(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }, true)).toBe(false);
    expect(isTransientAuthResponse(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found' }, true)).toBe(false);
    expect(isTransientAuthResponse(403, { code: 403, error_code: 'bad_jwt', msg: 'bad' }, true)).toBe(true);
  });
  it('elsewhere a JSON 4xx is a real answer (e.g. wrong password)', () => {
    expect(isTransientAuthResponse(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, false)).toBe(false);
  });
  it('recognizes the refresh grant URL', () => {
    expect(isRefreshTokenRequest('https://x.supabase.co/auth/v1/token?grant_type=refresh_token')).toBe(true);
    expect(isRefreshTokenRequest('https://x.supabase.co/auth/v1/token?grant_type=password')).toBe(false);
  });
});

describe('parseStoredSession', () => {
  it('reads a stored session with a user, and nothing else', () => {
    const s = { access_token: 'a', refresh_token: 'r', expires_at: 1, user: { id: 'u1' } };
    expect(parseStoredSession(JSON.stringify(s))?.user.id).toBe('u1');
    expect(parseStoredSession(JSON.stringify({ currentSession: s }))?.user.id).toBe('u1');
    expect(parseStoredSession(JSON.stringify({ access_token: 'a', refresh_token: 'r' }))).toBeNull();
    expect(parseStoredSession('not json')).toBeNull();
    expect(parseStoredSession(null)).toBeNull();
  });
});

// End to end against the real supabase-js / auth-js: an expired session, then a
// refresh that fails. Without the wrapper a 500 or an HTML 52x page makes
// auth-js delete the stored session and fire SIGNED_OUT (the web root cause).
describe('supabase-js refresh failure with makeAuthResilientFetch', () => {
  const KEY = 'sb-test-auth-token';
  const START = 1_900_000_000_000;
  let now = START;

  afterEach(() => { vi.restoreAllMocks(); });

  function setup(respond: () => Response, wrap: boolean) {
    now = START;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const store = new Map<string, string>();
    store.set(KEY, JSON.stringify({
      access_token: 'expired-access',
      refresh_token: 'refresh-1',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(START / 1000) - 60, // expired a minute ago
      user: { id: 'user-1', aud: 'authenticated', email: 'p@example.com' },
    }));
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    };
    const fake = vi.fn(async (_input: RequestInfo | URL) => {
      // Jump the clock past auth-js's in-tick retry budget so a retryable
      // failure is reported at once instead of after ~30 s of backoff.
      now += 31_000;
      return respond();
    });
    const client = createClient('https://test.supabase.co', 'anon-key', {
      auth: { storage, storageKey: KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (wrap ? makeAuthResilientFetch(fake as unknown as typeof fetch) : fake) as unknown as typeof fetch },
    });
    const events: string[] = [];
    client.auth.onAuthStateChange((event) => { events.push(event); });
    return { client, store, events, fake };
  }

  const outageResponses: Array<[string, () => Response]> = [
    ['HTTP 500 JSON', () => new Response(JSON.stringify({ code: 500, error_code: 'unexpected_failure', msg: 'boom' }), { status: 500, headers: { 'content-type': 'application/json' } })],
    ['Cloudflare 522 HTML', () => new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } })],
    ['HTTP 429', () => new Response(JSON.stringify({ code: 429, error_code: 'over_request_rate_limit', msg: 'slow down' }), { status: 429, headers: { 'content-type': 'application/json' } })],
  ];

  for (const [label, respond] of outageResponses) {
    it(`keeps the stored session and never fires SIGNED_OUT on ${label}`, async () => {
      const { client, store, events } = setup(respond, true);
      const { data, error } = await client.auth.getSession();
      expect(data.session).toBeNull();
      expect(classifyAuthError(error)).toBe('transient');
      expect(store.has(KEY)).toBe(true);
      expect(events).not.toContain('SIGNED_OUT');
      expect(keepsUserSignedIn(classifyAuthError(error), parseStoredSession(store.get(KEY)) !== null)).toBe(true);
    });
  }

  it('a thrown network error keeps the stored session too', async () => {
    const { client, store, events } = setup(() => { throw new TypeError('Failed to fetch'); }, true);
    const { error } = await client.auth.getSession();
    expect(classifyAuthError(error)).toBe('transient');
    expect(store.has(KEY)).toBe(true);
    expect(events).not.toContain('SIGNED_OUT');
  });

  it('(root cause) without the wrapper a 500 deletes the stored session', async () => {
    const { client, store, events } = setup(outageResponses[0][1], false);
    await client.auth.getSession();
    expect(store.has(KEY)).toBe(false);
    expect(events).toContain('SIGNED_OUT');
  });

  it('a revoked refresh token still signs out', async () => {
    const { client, store, events } = setup(
      () => new Response(JSON.stringify({ code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }), { status: 400, headers: { 'content-type': 'application/json' } }),
      true,
    );
    const { error } = await client.auth.getSession();
    expect(classifyAuthError(error)).toBe('revoked');
    expect(store.has(KEY)).toBe(false);
    expect(events).toContain('SIGNED_OUT');
    expect(keepsUserSignedIn(classifyAuthError(error), store.has(KEY))).toBe(false);
  });
});
