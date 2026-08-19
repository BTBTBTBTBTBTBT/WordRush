"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAccessToken = void 0;
const crypto_1 = require("crypto");
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eniiqqsxpmuyrspvepiw.supabase.co';
const JWKS_URL = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
/** Refetch at most this often, so a key rotation heals without a redeploy. */
const JWKS_TTL_MS = 60 * 60 * 1000;
let jwksCache = null;
function b64urlToBuf(s) {
    return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
async function getKeys(force = false) {
    const fresh = jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
    if (fresh && !force)
        return jwksCache.keys;
    try {
        const res = await fetch(JWKS_URL);
        if (!res.ok)
            throw new Error(`jwks ${res.status}`);
        const body = (await res.json());
        jwksCache = { keys: body.keys ?? [], fetchedAt: Date.now() };
        return jwksCache.keys;
    }
    catch {
        // Serve a stale cache rather than locking everyone out on a blip.
        return jwksCache?.keys ?? [];
    }
}
/** Build a verifiable public key from a P-256 JWK. */
function jwkToPem(jwk) {
    return (0, crypto_1.createPublicKey)({
        key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
        format: 'jwk',
    });
}
/**
 * Verify a Supabase access token. Returns the user id on success, null on any
 * failure — callers MUST treat null as "unverified", never as "trusted".
 */
async function verifyAccessToken(token) {
    if (!token || typeof token !== 'string')
        return null;
    const parts = token.split('.');
    if (parts.length !== 3)
        return null;
    const [headerB64, payloadB64, sigB64] = parts;
    let header;
    let payload;
    try {
        header = JSON.parse(b64urlToBuf(headerB64).toString('utf8'));
        payload = JSON.parse(b64urlToBuf(payloadB64).toString('utf8'));
    }
    catch {
        return null;
    }
    if (header.alg !== 'ES256' || !header.kid)
        return null;
    if (!payload.sub || !payload.exp)
        return null;
    if (payload.exp * 1000 <= Date.now())
        return null;
    if (payload.iss && !payload.iss.startsWith(SUPABASE_URL))
        return null;
    // A kid we've never seen may mean the keys rotated — refetch once.
    let keys = await getKeys();
    let jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) {
        keys = await getKeys(true);
        jwk = keys.find((k) => k.kid === header.kid);
    }
    if (!jwk)
        return null;
    try {
        const verifier = (0, crypto_1.createVerify)('SHA256');
        verifier.update(`${headerB64}.${payloadB64}`);
        verifier.end();
        // JWS ES256 signatures are raw r||s, not DER — say so or every check fails.
        const ok = verifier.verify({ key: jwkToPem(jwk), dsaEncoding: 'ieee-p1363' }, b64urlToBuf(sigB64));
        return ok ? { userId: payload.sub, expiresAt: payload.exp * 1000 } : null;
    }
    catch {
        return null;
    }
}
exports.verifyAccessToken = verifyAccessToken;
