import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { ASC_ENV_VARS, ASC_JWT_TTL_SECONDS, buildAscJwt, missingAscEnv, normalizePem } from './asc-jwt';

// A throwaway P-256 key generated per run — the same curve/encoding as a real
// App Store Connect .p8, so the signing path is exercised for real without
// ever touching a live key (nothing here reads the filesystem).
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const decode = (segment: string) => JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));

function verify(jwt: string): boolean {
  const [header, payload, signature] = jwt.split('.');
  return crypto.verify(
    'sha256',
    Buffer.from(`${header}.${payload}`),
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(signature, 'base64url'),
  );
}

describe('buildAscJwt', () => {
  it('produces the ES256 JWT App Store Connect expects (header, claims, raw r||s signature)', () => {
    const now = 1_760_000_000_000;
    const jwt = buildAscJwt({ keyId: 'ABC123DEF4', issuerId: '57246542-96fe-1a63-e053-0824d011072a', privateKey, now });
    const [header, payload] = jwt.split('.');
    expect(decode(header)).toEqual({ alg: 'ES256', kid: 'ABC123DEF4', typ: 'JWT' });
    expect(decode(payload)).toEqual({
      iss: '57246542-96fe-1a63-e053-0824d011072a',
      iat: 1_760_000_000,
      exp: 1_760_000_000 + ASC_JWT_TTL_SECONDS,
      aud: 'appstoreconnect-v1',
    });
    expect(ASC_JWT_TTL_SECONDS).toBeLessThanOrEqual(20 * 60); // Apple's ceiling
    expect(verify(jwt)).toBe(true);
  });

  it('accepts a PEM whose newlines arrived \\n-escaped (the Vercel paste case)', () => {
    const escaped = privateKey.replace(/\n/g, '\\n');
    expect(escaped).not.toContain('\n');
    const jwt = buildAscJwt({ keyId: 'K', issuerId: 'I', privateKey: escaped });
    expect(verify(jwt)).toBe(true);
  });

  it('accepts a PEM wrapped in quotes, with CRLF endings, or indented', () => {
    const quoted = `"${privateKey.replace(/\n/g, '\\n')}"`;
    const crlf = privateKey.replace(/\n/g, '\r\n');
    const indented = privateKey.split('\n').map((l) => `    ${l}`).join('\n');
    for (const pem of [quoted, crlf, indented]) {
      expect(verify(buildAscJwt({ keyId: 'K', issuerId: 'I', privateKey: pem }))).toBe(true);
    }
  });

  it('trims whitespace around the key id and issuer id', () => {
    const jwt = buildAscJwt({ keyId: ' K1 ', issuerId: ' I1\n', privateKey });
    const [header, payload] = jwt.split('.');
    expect(decode(header).kid).toBe('K1');
    expect(decode(payload).iss).toBe('I1');
  });

  it('is plain base64url — no padding or URL-unsafe characters', () => {
    const jwt = buildAscJwt({ keyId: 'K', issuerId: 'I', privateKey });
    expect(jwt).not.toMatch(/[+/=]/);
    expect(jwt.split('.')).toHaveLength(3);
  });

  it('throws on a non-PEM value so the route can surface a readable error', () => {
    expect(() => buildAscJwt({ keyId: 'K', issuerId: 'I', privateKey: 'not a key' })).toThrow();
  });

  it('does not verify against a different key', () => {
    const other = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const jwt = buildAscJwt({ keyId: 'K', issuerId: 'I', privateKey: other.privateKey });
    expect(verify(jwt)).toBe(false);
  });
});

describe('normalizePem', () => {
  it('is idempotent on an already-clean PEM', () => {
    expect(normalizePem(privateKey)).toBe(privateKey.trim() + '\n');
    expect(normalizePem(normalizePem(privateKey))).toBe(normalizePem(privateKey));
  });

  it('turns escaped newlines into real ones and keeps the BEGIN/END lines', () => {
    const out = normalizePem(privateKey.replace(/\n/g, '\\n'));
    expect(out.split('\n')[0]).toBe('-----BEGIN PRIVATE KEY-----');
    expect(out.trimEnd().split('\n').at(-1)).toBe('-----END PRIVATE KEY-----');
  });
});

describe('missingAscEnv', () => {
  it('names exactly the four vars the revenue card needs', () => {
    expect([...ASC_ENV_VARS]).toEqual(['ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_PRIVATE_KEY', 'ASC_VENDOR_NUMBER']);
    expect(missingAscEnv({})).toEqual([...ASC_ENV_VARS]);
  });

  it('treats blank values as missing and reports only the gaps', () => {
    expect(missingAscEnv({
      ASC_KEY_ID: 'K', ASC_ISSUER_ID: '  ', ASC_PRIVATE_KEY: 'pem', ASC_VENDOR_NUMBER: '',
    })).toEqual(['ASC_ISSUER_ID', 'ASC_VENDOR_NUMBER']);
    expect(missingAscEnv({
      ASC_KEY_ID: 'K', ASC_ISSUER_ID: 'I', ASC_PRIVATE_KEY: 'pem', ASC_VENDOR_NUMBER: '12345678',
    })).toEqual([]);
  });
});
