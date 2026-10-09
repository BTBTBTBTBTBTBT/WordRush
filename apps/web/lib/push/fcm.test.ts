import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import {
  buildAssertion,
  classifyFcmFailure,
  isFcmConfigured,
  resetAccessTokenCache,
  sendFcm,
  fcmMessageBody,
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

describe('fcmMessageBody (FINISH_SPEC K2)', () => {
  it('carries the W-mascot small icon in the brand purple and the deep link', () => {
    const b = fcmMessageBody({ token: 't', title: 'Oliver beat you', body: '2,005 vs 1,860', url: '/vs' });
    expect(b.android).toEqual({ priority: 'high', notification: { icon: 'ic_stat_wordocious', color: '#7c3aed' } });
    expect(b.data).toEqual({ url: '/vs' });
    expect(b.notification).toEqual({ title: 'Oliver beat you', body: '2,005 vs 1,860' });
  });
  it('attaches a large image only when given', () => {
    expect(fcmMessageBody({ token: 't', title: 'a', body: 'b', image: 'https://wordocious.com/email/pose.png' }).notification?.image).toBe('https://wordocious.com/email/pose.png');
    expect('data' in fcmMessageBody({ token: 't', title: 'a', body: 'b' })).toBe(false);
  });

  const RICH = {
    senderId: 'u1', senderName: 'Ava', senderAvatar: 'https://wordocious.com/api/push/art/avatar/u1',
    gameId: 'hub', gameTitle: 'Hubbub', gameImage: 'https://wordocious.com/api/push/art/game/hub',
    thread: 'friend:u1', accent: '#c026d3', halloween: '0' as const, url: '/friends/games/g1',
  };
  it('rich push: a build that draws its own notification gets a data-only message', () => {
    const b = fcmMessageBody({ token: 't', title: 'Ava played Hubbub', body: 'Your turn', rich: RICH, richCapable: true, collapseKey: 'move:g1' });
    expect(b.notification).toBeUndefined();
    expect(b.data?.rich).toBe('1');
    expect(b.data?.senderAvatar).toBe(RICH.senderAvatar);
    expect(b.data?.gameImage).toBe(RICH.gameImage);
    expect(b.android.collapse_key).toBe('move:g1');
  });
  it('rich push: an older build keeps the system-drawn notification (with the game image)', () => {
    const b = fcmMessageBody({ token: 't', title: 'Ava played Hubbub', body: 'Your turn', rich: RICH, richCapable: false });
    expect(b.notification?.image).toBe(RICH.gameImage);
    expect(b.android.notification?.color).toBe('#c026d3');
    expect(b.android.notification?.tag).toBe('friend:u1');
  });
});
