import { createPublicKey, createVerify } from 'crypto';

/**
 * Supabase access-token verification for the socket handshake.
 *
 * WHY THIS EXISTS: the handshake used to take `presenceId` ("u:<userId>") as a
 * plain string and trust it. User ids are public — the leaderboard renders
 * /profile/<uuid> links — so anyone could connect claiming to be anybody. That
 * was not theoretical: presenting a victim's presenceId during their 60-second
 * reconnect grace window handed the attacker their live match.
 *
 * The project signs tokens with ES256 and publishes the public key set, so this
 * verifies signatures locally against the JWKS. No shared secret, no API key,
 * and no per-connection round trip once the key set is cached.
 */

// Node 20 ships global fetch, but this package's tsconfig lib doesn't declare
// it. Narrow local declaration beats widening lib for one call.
declare const fetch: (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eniiqqsxpmuyrspvepiw.supabase.co';
const JWKS_URL = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
/** Refetch at most this often, so a key rotation heals without a redeploy. */
const JWKS_TTL_MS = 60 * 60 * 1000;

type Jwk = { kid: string; kty: string; crv: string; x: string; y: string; alg: string };
let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function getKeys(force = false): Promise<Jwk[]> {
  const fresh = jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  if (fresh && !force) return jwksCache!.keys;
  try {
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error(`jwks ${res.status}`);
    const body = (await res.json()) as { keys?: Jwk[] };
    jwksCache = { keys: body.keys ?? [], fetchedAt: Date.now() };
    return jwksCache.keys;
  } catch {
    // Serve a stale cache rather than locking everyone out on a blip.
    return jwksCache?.keys ?? [];
  }
}

/** Build a verifiable public key from a P-256 JWK. */
function jwkToPem(jwk: Jwk) {
  return createPublicKey({
    key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } as any,
    format: 'jwk',
  });
}

export interface VerifiedUser {
  userId: string;
  expiresAt: number;
}

/**
 * Verify a Supabase access token. Returns the user id on success, null on any
 * failure — callers MUST treat null as "unverified", never as "trusted".
 */
export async function verifyAccessToken(token: string | undefined): Promise<VerifiedUser | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: string; kid?: string };
  let payload: { sub?: string; exp?: number; iss?: string };
  try {
    header = JSON.parse(b64urlToBuf(headerB64).toString('utf8'));
    payload = JSON.parse(b64urlToBuf(payloadB64).toString('utf8'));
  } catch {
    return null;
  }
  if (header.alg !== 'ES256' || !header.kid) return null;
  if (!payload.sub || !payload.exp) return null;
  if (payload.exp * 1000 <= Date.now()) return null;
  if (payload.iss && !payload.iss.startsWith(SUPABASE_URL)) return null;

  // A kid we've never seen may mean the keys rotated — refetch once.
  let keys = await getKeys();
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await getKeys(true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) return null;

  try {
    const verifier = createVerify('SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    // JWS ES256 signatures are raw r||s, not DER — say so or every check fails.
    const ok = verifier.verify(
      { key: jwkToPem(jwk), dsaEncoding: 'ieee-p1363' },
      b64urlToBuf(sigB64),
    );
    return ok ? { userId: payload.sub, expiresAt: payload.exp * 1000 } : null;
  } catch {
    return null;
  }
}
