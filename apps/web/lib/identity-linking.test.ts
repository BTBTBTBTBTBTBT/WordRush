import { describe, expect, it } from 'vitest';
import {
  canUnlink,
  isHideMyEmail,
  linkErrorMessage,
  linkRedirectTo,
  providerLabel,
  readLinkReturn,
  readRedirectError,
  stripLinkParams,
  unlinkErrorMessage,
} from './identity-linking';

describe('identity linking (Settings › Linked sign-ins)', () => {
  it('builds a same-origin callback redirect that returns to the page with ?link=', () => {
    const r = linkRedirectTo('https://wordocious.com', '/stats', 'apple');
    expect(r).toBe('https://wordocious.com/auth/callback?next=%2Fstats%3Flink%3Dapple');
    const next = new URL(r).searchParams.get('next');
    expect(next).toBe('/stats?link=apple');
    // never a protocol-relative / absolute next
    expect(new URL(linkRedirectTo('https://wordocious.com', '//evil.com', 'google')).searchParams.get('next')).toBe('/?link=google');
  });

  it('reads the provider a round trip returned for', () => {
    expect(readLinkReturn('https://wordocious.com/?link=apple')).toBe('apple');
    expect(readLinkReturn('https://wordocious.com/?link=google#access_token=x')).toBe('google');
    expect(readLinkReturn('https://wordocious.com/?link=facebook')).toBeNull();
    expect(readLinkReturn('https://wordocious.com/')).toBeNull();
  });

  it('reads GoTrue errors from the query (forwarded) or the fragment', () => {
    expect(readRedirectError('https://wordocious.com/?link=apple&error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user'))
      .toEqual({ code: 'identity_already_exists', description: 'Identity is already linked to another user' });
    expect(readRedirectError('https://wordocious.com/?link=apple#error=access_denied&error_description=user+cancelled'))
      .toEqual({ code: 'access_denied', description: 'user cancelled' });
    expect(readRedirectError('https://wordocious.com/?link=apple#access_token=abc')).toBeNull();
  });

  it('strips the marker and error params but keeps a success fragment', () => {
    expect(stripLinkParams('https://wordocious.com/stats?view=vs&link=apple&error_code=x&error_description=y#error=x')).toBe('/stats?view=vs');
    expect(stripLinkParams('https://wordocious.com/?link=google#access_token=abc')).toBe('/#access_token=abc');
  });

  it('explains an identity that belongs to another account', () => {
    expect(linkErrorMessage('identity_already_exists', 'Identity is already linked to another user', 'apple'))
      .toMatch(/^That Apple ID is already used by another Wordocious account\./);
    expect(linkErrorMessage('', 'Identity is already linked to another user', 'google'))
      .toMatch(/^That Google account is already used by another Wordocious account\./);
    expect(linkErrorMessage('manual_linking_disabled', 'Manual linking is disabled', 'apple')).toMatch(/isn’t available yet/);
    expect(linkErrorMessage('access_denied', '', 'apple')).toBe('Apple linking was canceled.');
  });

  it('never unlinks the last identity', () => {
    expect(canUnlink(1)).toBe(false);
    expect(canUnlink(0)).toBe(false);
    expect(canUnlink(2)).toBe(true);
    expect(unlinkErrorMessage('single_identity_not_deletable', '')).toMatch(/only way to sign in/);
  });

  it('labels providers and Hide My Email', () => {
    expect(providerLabel('apple')).toBe('Apple');
    expect(providerLabel('email')).toBe('Email');
    expect(isHideMyEmail('abc123@privaterelay.appleid.com')).toBe(true);
    expect(isHideMyEmail('dave@gmail.com')).toBe(false);
  });
});
