'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UserIdentity } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { CandyButton } from '@/components/ui/candy-button';
import { Icon3D } from '@/components/ui/icon3d';
import { SETTINGS_ACCENT, SettingsSection, settingsRowStyle } from './settings-kit';
import {
  LINK_PROVIDERS,
  type LinkProvider,
  canUnlink,
  isHideMyEmail,
  linkErrorMessage,
  linkRedirectTo,
  providerLabel,
  readLinkReturn,
  readRedirectError,
  stripLinkParams,
  unlinkErrorMessage,
} from '@/lib/identity-linking';

// Settings › Linked sign-ins (founder, 2026-09-30). Lists the identities on
// the signed-in account and links Google / Apple onto it, so a later "Sign in
// with Apple" (Hide My Email relay) finds this account instead of creating a
// second one. Round trip documented in lib/identity-linking.ts.

type Notice = { tone: 'ok' | 'error'; text: string } | null;

function identityEmail(identity: UserIdentity): string | null {
  const email = (identity.identity_data as Record<string, unknown> | undefined)?.email;
  return typeof email === 'string' && email ? email : null;
}

export function LinkedSignIns() {
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async (): Promise<UserIdentity[] | null> => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error || !data) {
      setLoadError(true);
      return null;
    }
    setLoadError(false);
    setIdentities(data.identities);
    return data.identities;
  }, []);

  // First open, and the landing after a link round trip (?link=<provider>).
  useEffect(() => {
    let cancelled = false;
    const href = window.location.href;
    const returned = readLinkReturn(href);
    const redirectError = returned ? readRedirectError(href) : null;
    if (returned) {
      try { window.history.replaceState(window.history.state, '', stripLinkParams(href)); } catch {}
    }
    (async () => {
      // On success supabase-js stores the fresh session from the #fragment
      // during its init; let that settle so getUser sees the new identity.
      if (returned && !redirectError) {
        try { await supabase.auth.getSession(); } catch {}
      }
      const list = await load();
      if (cancelled || !returned) return;
      if (redirectError) {
        setNotice({ tone: 'error', text: linkErrorMessage(redirectError.code, redirectError.description, returned) });
      } else if (list?.some((i) => i.provider === returned)) {
        setNotice({ tone: 'ok', text: `${providerLabel(returned)} is now linked. You can sign in with it on any device.` });
      } else {
        setNotice({ tone: 'error', text: `${providerLabel(returned)} wasn’t linked. Please try again.` });
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  const handleLink = async (provider: LinkProvider) => {
    setBusy(provider);
    setNotice(null);
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: linkRedirectTo(window.location.origin, window.location.pathname, provider) },
    });
    // Success navigates away to the provider; only errors come back here.
    if (error) {
      setNotice({ tone: 'error', text: linkErrorMessage((error as { code?: string }).code ?? '', error.message, provider) });
      setBusy(null);
    }
  };

  const handleUnlink = async (identity: UserIdentity) => {
    if (!identities || !canUnlink(identities.length)) return;
    const label = providerLabel(identity.provider);
    const ok = await confirmDialog({
      title: `Unlink ${label}?`,
      message: `You won’t be able to sign in to this account with ${label} anymore. Your stats and Pro stay put.`,
      confirmText: 'Unlink',
      cancelText: 'Keep it',
    });
    if (!ok) return;
    setBusy(identity.identity_id);
    setNotice(null);
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) {
      setNotice({ tone: 'error', text: unlinkErrorMessage((error as { code?: string }).code ?? '', error.message) });
    } else {
      // The access token's identity claims are stale until a refresh.
      try { await supabase.auth.refreshSession(); } catch {}
      await load();
      setNotice({ tone: 'ok', text: `${label} unlinked.` });
    }
    setBusy(null);
  };

  const linked = new Set((identities ?? []).map((i) => i.provider));
  // Apple is set up for native iOS only (no web Services ID on the Supabase provider), so the web
  // links Google and points Apple to the iOS app instead of offering a button that would fail.
  const missing = LINK_PROVIDERS.filter((p) => p !== 'apple' && !linked.has(p));
  const appleMissing = identities !== null && !linked.has('apple');
  const unlinkable = identities ? canUnlink(identities.length) : false;

  return (
    <SettingsSection title="Linked sign-ins" accent={SETTINGS_ACCENT.linked}>
      <p className="text-[10px] font-bold px-1" style={{ color: 'var(--color-text-muted)' }}>
        Link your sign-ins so each one opens this same account, even with Apple’s Hide My Email.
      </p>
      <div className="space-y-1.5">
        {identities === null && !loadError && (
          <div className="p-3 text-[10px] font-bold" style={{ ...settingsRowStyle(SETTINGS_ACCENT.linked), color: 'var(--color-text-muted)' }}>
            Loading…
          </div>
        )}
        {loadError && (
          <p className="text-[10px] font-bold px-1" style={{ color: 'var(--color-loss-text)' }}>Couldn’t load your sign-ins. Close Settings and try again.</p>
        )}
        {(identities ?? []).map((identity) => {
          const email = identityEmail(identity);
          return (
            <div
              key={identity.identity_id}
              className="flex items-center justify-between gap-2 p-3"
              style={settingsRowStyle(SETTINGS_ACCENT.linked)}
            >
              <div className="min-w-0">
                <div className="font-extrabold text-xs" style={{ color: 'var(--color-text)' }}>
                  {providerLabel(identity.provider)} <Icon3D name="badge-check" size={14} inline label="Linked" />
                </div>
                {email && (
                  <div className="text-[10px] font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {isHideMyEmail(email) ? 'Hide My Email' : email}
                  </div>
                )}
              </div>
              {unlinkable && (
                <CandyButton
                  color="peach"
                  size="sm"
                  onClick={() => handleUnlink(identity)}
                  disabled={busy !== null}
                >
                  {busy === identity.identity_id ? 'Unlinking…' : 'Unlink'}
                </CandyButton>
              )}
            </div>
          );
        })}
        {identities !== null && missing.map((provider) => (
          <CandyButton
            key={provider}
            color="purple"
            size="md"
            block
            icon="plus"
            onClick={() => handleLink(provider)}
            disabled={busy !== null}
          >
            {busy === provider ? 'Opening…' : `Link ${providerLabel(provider)}`}
          </CandyButton>
        ))}
        {appleMissing && (
          <p className="text-[10px] font-bold px-1" style={{ color: 'var(--color-text-muted)' }}>
            To add Apple, use Settings → Linked sign-ins in the Wordocious iOS app.
          </p>
        )}
        {notice && (
          <p className="text-[10px] font-bold px-1" style={{ color: notice.tone === 'ok' ? 'var(--color-text)' : 'var(--color-loss-text)' }}>
            {notice.text}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}
