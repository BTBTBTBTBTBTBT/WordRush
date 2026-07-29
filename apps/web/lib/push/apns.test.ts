import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import {
  buildProviderToken,
  classifyApnsFailure,
  isApnsConfigured,
  resetProviderTokenCache,
  sendApns,
} from './apns';

// A throwaway P-256 key — same curve/format as a real Apple .p8, so the
// signing path under test is exercised for real without a live secret.
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function decodeSegment(segment: string): any {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

describe('buildProviderToken', () => {
  it('produces a JWT Apple can verify (ES256, raw r||s signature)', () => {
    const jwt = buildProviderToken({
      keyId: 'YMU68Y2US3',
      teamId: 'Q32F6GRDYG',
      privateKey,
      now: 1_700_000_000_000,
    });

    const [header, payload, signature] = jwt.split('.');
    expect(decodeSegment(header)).toEqual({ alg: 'ES256', kid: 'YMU68Y2US3' });
    expect(decodeSegment(payload)).toEqual({ iss: 'Q32F6GRDYG', iat: 1_700_000_000 });

    // The regression that matters: Node signs DER by default, which Apple
    // rejects with InvalidProviderToken. Verifying with ieee-p1363 proves the
    // signature is in the raw form JWS requires.
    const verified = crypto.verify(
      'sha256',
      Buffer.from(`${header}.${payload}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signature, 'base64url'),
    );
    expect(verified).toBe(true);
  });

  it('accepts a key pasted with escaped newlines', () => {
    const escaped = privateKey.replace(/\n/g, '\\n');
    expect(() =>
      buildProviderToken({ keyId: 'K', teamId: 'T', privateKey: escaped }),
    ).not.toThrow();
  });

  it('has no base64url padding or unsafe characters', () => {
    const jwt = buildProviderToken({ keyId: 'K', teamId: 'T', privateKey });
    expect(jwt).not.toMatch(/[+/=]/);
  });
});

describe('classifyApnsFailure', () => {
  it('treats unregistered devices and bad tokens as stale', () => {
    expect(classifyApnsFailure(410)).toBe('stale');
    expect(classifyApnsFailure(400, 'BadDeviceToken')).toBe('stale');
    expect(classifyApnsFailure(400, 'DeviceTokenNotForTopic')).toBe('stale');
  });

  it('never marks a token stale on Apple-side trouble', () => {
    // A 500 sweep must not silently unsubscribe every device.
    expect(classifyApnsFailure(429)).toBe('transient');
    expect(classifyApnsFailure(500)).toBe('transient');
    expect(classifyApnsFailure(503)).toBe('transient');
  });

  it('flags configuration errors as permanent', () => {
    expect(classifyApnsFailure(403, 'InvalidProviderToken')).toBe('permanent');
    expect(classifyApnsFailure(400, 'TopicDisallowed')).toBe('permanent');
  });
});

describe('sendApns', () => {
  const saved = { ...process.env };
  beforeEach(() => { resetProviderTokenCache(); });
  afterEach(() => { process.env = { ...saved }; resetProviderTokenCache(); });

  it('is a no-op for an empty batch', async () => {
    const result = await sendApns([]);
    expect(result).toEqual({ sent: 0, failed: 0, staleTokens: [], errors: [] });
  });

  it('reports missing config instead of throwing or opening a socket', async () => {
    delete process.env.APNS_KEY_ID;
    delete process.env.APNS_TEAM_ID;
    delete process.env.APNS_PRIVATE_KEY;
    expect(isApnsConfigured()).toBe(false);

    const result = await sendApns([{ token: 'abc', title: 'T', body: 'B' }]);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.staleTokens).toEqual([]);
    expect(result.errors[0]).toContain('not configured');
  });

  it('never reports a token as stale when the key itself is unusable', async () => {
    process.env.APNS_KEY_ID = 'K';
    process.env.APNS_TEAM_ID = 'T';
    process.env.APNS_PRIVATE_KEY = 'not-a-pem';

    const result = await sendApns([{ token: 'abc', title: 'T', body: 'B' }]);
    expect(result.failed).toBe(1);
    expect(result.staleTokens).toEqual([]);
  });
});
