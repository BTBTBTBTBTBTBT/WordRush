import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import {
  buildAssertion,
  classifyFcmFailure,
  isFcmConfigured,
  resetAccessTokenCache,
  sendFcm,
} from './fcm';

// A throwaway RSA key so the signature is verified for real rather than mocked.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const SERVICE_ACCOUNT = {
  client_email: 'push@wordocious.iam.gserviceaccount.com',
  private_key: PRIVATE_PEM,
  project_id: 'spellstrike-490819',
};

beforeEach(() => {
  resetAccessTokenCache();
  process.env.FCM_SERVICE_ACCOUNT = JSON.stringify(SERVICE_ACCOUNT);
});

afterEach(() => {
  delete process.env.FCM_SERVICE_ACCOUNT;
  resetAccessTokenCache();
});

describe('isFcmConfigured', () => {
  it('is false when the env var is absent', () => {
    delete process.env.FCM_SERVICE_ACCOUNT;
    expect(isFcmConfigured()).toBe(false);
  });

  it('is false on malformed JSON rather than throwing', () => {
    process.env.FCM_SERVICE_ACCOUNT = '{not json';
    expect(isFcmConfigured()).toBe(false);
  });

  it('is false when a required field is missing', () => {
    process.env.FCM_SERVICE_ACCOUNT = JSON.stringify({ client_email: 'a@b.c' });
    expect(isFcmConfigured()).toBe(false);
  });

  it('is true for a complete service account', () => {
    expect(isFcmConfigured()).toBe(true);
  });
});

describe('buildAssertion', () => {
  it('produces a JWT Google can verify', () => {
    const jwt = buildAssertion(SERVICE_ACCOUNT, 1_700_000_000);
    const [h, p, sig] = jwt.split('.');
    const ok = crypto
      .createVerify('RSA-SHA256')
      .update(`${h}.${p}`)
      .verify(publicKey, Buffer.from(sig, 'base64url'));
    expect(ok).toBe(true);
  });

  it('claims the messaging scope and the token endpoint as audience', () => {
    const jwt = buildAssertion(SERVICE_ACCOUNT, 1_700_000_000);
    const claims = JSON.parse(
      Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'),
    );
    expect(claims.iss).toBe(SERVICE_ACCOUNT.client_email);
    expect(claims.scope).toBe('https://www.googleapis.com/auth/firebase.messaging');
    expect(claims.aud).toBe('https://oauth2.googleapis.com/token');
    expect(claims.exp - claims.iat).toBe(3600);
  });

  it('accepts a key whose newlines were escaped by the env UI', () => {
    process.env.FCM_SERVICE_ACCOUNT = JSON.stringify({
      ...SERVICE_ACCOUNT,
      private_key: PRIVATE_PEM.replace(/\n/g, '\\n'),
    });
    // Would throw on an unparseable PEM if the unescaping regressed.
    expect(isFcmConfigured()).toBe(true);
  });
});

describe('classifyFcmFailure', () => {
  it('treats UNREGISTERED as a dead token', () => {
    expect(classifyFcmFailure(404, 'UNREGISTERED')).toBe('stale');
  });

  it('treats a malformed token as dead', () => {
    expect(classifyFcmFailure(400, 'INVALID_ARGUMENT')).toBe('stale');
  });

  it('NEVER treats quota or 5xx as dead — that would unsubscribe real users', () => {
    expect(classifyFcmFailure(429, 'QUOTA_EXCEEDED')).toBe('transient');
    expect(classifyFcmFailure(500)).toBe('transient');
    expect(classifyFcmFailure(503, 'UNAVAILABLE')).toBe('transient');
  });

  it('treats auth failures as permanent, not stale', () => {
    // A bad service account must not wipe the whole token table.
    expect(classifyFcmFailure(401, 'UNAUTHENTICATED')).toBe('permanent');
    expect(classifyFcmFailure(403, 'PERMISSION_DENIED')).toBe('permanent');
  });
});

describe('sendFcm', () => {
  it('returns an empty result for an empty batch without touching the network', async () => {
    const r = await sendFcm([]);
    expect(r).toEqual({ sent: 0, failed: 0, staleTokens: [], errors: [] });
  });

  it('reports unconfigured instead of throwing', async () => {
    delete process.env.FCM_SERVICE_ACCOUNT;
    const r = await sendFcm([{ token: 't', title: 'a', body: 'b' }]);
    expect(r.sent).toBe(0);
    expect(r.failed).toBe(1);
    expect(r.errors).toContain('fcm_not_configured');
    expect(r.staleTokens).toEqual([]);
  });
});
