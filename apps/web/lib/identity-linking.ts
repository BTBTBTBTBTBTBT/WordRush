// Linked sign-ins (founder, 2026-09-30): a tester who signed up with Google
// later used Sign in with Apple, and Apple's Hide My Email relay address made
// Supabase create a second account. Settings now lists the sign-ins attached
// to the account and links Google / Apple onto it with supabase-js manual
// linking (auth.linkIdentity → /user/identities/authorize, OAuth round trip).
//
// Round trip: linkIdentity redirects to the provider, which returns through
// Supabase to /auth/callback?next=<page>?link=<provider>. The callback route
// forwards any error_code / error_description onto that page (the implicit
// flow also carries them, or the fresh tokens, in the #fragment, which the
// browser keeps across the 302). The header sees ?link= and reopens Settings;
// the Linked sign-ins section reads the outcome and cleans the URL.
//
// Pure helpers only — node-tested in identity-linking.test.ts.

export type LinkProvider = 'google' | 'apple';

export const LINK_PROVIDERS: LinkProvider[] = ['google', 'apple'];

/** Query param the link round trip lands with (`?link=apple`). */
export const LINK_RETURN_PARAM = 'link';

export function providerLabel(provider: string): string {
  switch (provider) {
    case 'google': return 'Google';
    case 'apple': return 'Apple';
    case 'email': return 'Email';
    case 'facebook': return 'Facebook';
    default: return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Unknown';
  }
}

/** Apple's Hide My Email relay (the address that caused the duplicate). */
export function isHideMyEmail(email: string | null | undefined): boolean {
  return !!email && /@privaterelay\.appleid\.com$/i.test(email.trim());
}

/** Never offer Unlink on the account's last way in. */
export function canUnlink(identityCount: number): boolean {
  return identityCount > 1;
}

/** The redirectTo for a link round trip: back to this page with ?link=. */
export function linkRedirectTo(origin: string, pathname: string, provider: LinkProvider): string {
  const safePath = pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/';
  const next = `${safePath}?${LINK_RETURN_PARAM}=${provider}`;
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export interface RedirectError {
  code: string;
  description: string;
}

/**
 * Error params from an OAuth return — GoTrue puts them in the query and the
 * #fragment; the callback route forwards the query copy. Query wins.
 */
export function readRedirectError(href: string): RedirectError | null {
  let url: URL;
  try { url = new URL(href); } catch { return null; }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const pick = (k: string) => url.searchParams.get(k) ?? hash.get(k) ?? '';
  const code = pick('error_code') || pick('error');
  const description = pick('error_description');
  if (!code && !description) return null;
  return { code: code || 'unspecified_error', description };
}

/** The provider a link round trip returned for, or null. */
export function readLinkReturn(href: string): LinkProvider | null {
  try {
    const p = new URL(href).searchParams.get(LINK_RETURN_PARAM);
    return p === 'google' || p === 'apple' ? p : null;
  } catch {
    return null;
  }
}

/** The URL with the link marker and any auth error params removed. */
export function stripLinkParams(href: string): string {
  let url: URL;
  try { url = new URL(href); } catch { return href; }
  for (const k of [LINK_RETURN_PARAM, 'error', 'error_code', 'error_description']) url.searchParams.delete(k);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  if (hash.has('error') || hash.has('error_code') || hash.has('error_description')) url.hash = '';
  return url.pathname + (url.search || '') + (url.hash || '');
}

function accountNoun(provider: string | null | undefined): string {
  if (provider === 'apple') return 'That Apple ID';
  if (provider === 'google') return 'That Google account';
  return 'That sign-in';
}

export function linkErrorMessage(code: string, description: string, provider?: string | null): string {
  const c = code.toLowerCase();
  const d = description.toLowerCase();
  if (c === 'identity_already_exists' || d.includes('already linked') || d.includes('already exists')) {
    return `${accountNoun(provider)} is already used by another Wordocious account. Sign in with it and delete that account in Settings, then link it here.`;
  }
  if (c === 'manual_linking_disabled' || d.includes('manual linking')) {
    return 'Linking sign-ins isn’t available yet. Please try again later.';
  }
  if (c === 'access_denied' || d.includes('cancel') || d.includes('denied')) {
    return `${provider ? providerLabel(provider) : 'Sign-in'} linking was canceled.`;
  }
  if (c === 'provider_disabled' || d.includes('provider is not enabled')) {
    return `${provider ? providerLabel(provider) : 'That provider'} sign-in isn’t available on the web right now.`;
  }
  return description || `Couldn’t link ${provider ? providerLabel(provider) : 'that sign-in'}. Please try again.`;
}

export function unlinkErrorMessage(code: string, description: string): string {
  const c = code.toLowerCase();
  if (c === 'single_identity_not_deletable') return 'This is your only way to sign in, so it can’t be removed.';
  if (c === 'identity_not_found') return 'That sign-in was already removed.';
  if (c === 'email_conflict_identity_not_deletable') {
    return 'This sign-in carries your account email, so it can’t be removed right now.';
  }
  return description || 'Couldn’t remove that sign-in. Please try again.';
}
