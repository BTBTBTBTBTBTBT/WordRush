'use client';

import { QuietButton } from '@/components/ui/family-button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HeaderBack } from '@/components/ui/page-header';
import { ArtTitle } from '@/components/ui/art-title';
import { useEffect, useRef, useState } from 'react';
import { useTheme, Theme } from '@/lib/theme-context';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sounds';
import { isHapticsOn, setHapticsOn } from '@/lib/haptics';
import { ProMemberCard } from '@/components/pro/pro-member-card';
import { ManageSubscriptionRows } from '@/components/pro/manage-subscription';
import { openGoProPopup } from '@/lib/payment/go-pro-popup';
import { getKeyboardLayout, setKeyboardLayout, type KeyboardLayout } from '@/lib/keyboard-layout';
import { useAuth } from '@/lib/auth-context';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { LinkedSignIns } from '@/components/settings/linked-sign-ins';
import { SeasonPreviewPicker } from '@/components/settings/season-preview-picker';
import { NotificationSettings } from '@/components/settings/notification-settings';
import { KeyRowPreview, SETTINGS_ACCENT, SettingsOption, SettingsSection, SettingsToggle, ThemeTilesPreview, settingsRowStyle } from '@/components/settings/settings-kit';
import { PoseArt } from '@/components/ui/soft-popup';
import { BRAND_ACCENT, cardBarStyle, softBackground } from '@/lib/soft-surface';
import { ART_SIZE } from '@/lib/art';
import { HEADLINE, headlineMaxWidth } from '@/lib/headline';
import { startTour } from '@/lib/onboarding';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme, colorblindMode, setColorblindMode, reducedMotion, setReducedMotion } = useTheme();
  const { user, session, signOut, profile, isProActive } = useAuth();
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  // FINISH_SPEC U: the separate Haptics toggle (default on; lib/haptics.ts 'pref-haptics').
  const [hapticsOn, setHapticsOnState] = useState(() => isHapticsOn());
  const subscriptionRef = useRef<HTMLDivElement>(null);
  const webBilling = process.env.NEXT_PUBLIC_STRIPE_ENABLED === 'true' && !!(profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
  const [kbLayout, setKbLayout] = useState<KeyboardLayout>(() => getKeyboardLayout());
  // BI25: the dialog has landed — heavier, below-the-fold pieces mount now.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!open) { setSettled(false); return; }
    const t = window.setTimeout(() => setSettled(true), 350);
    return () => window.clearTimeout(t);
  }, [open]);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Permanent account deletion — web parity with the native apps' in-app
  // deletion (Apple 5.1.1(v)). Two explicit confirms, then the existing
  // service-role endpoint wipes stats/matches/medals/profile/auth user.
  const handleDeleteAccount = async () => {
    if (!user || !session) return;
    const first = await confirmDialog({
      title: 'Delete your account?',
      message: 'This permanently erases your profile, stats, streaks, medals, and match history on every platform. It cannot be undone.',
      confirmText: 'Continue',
      cancelText: 'Keep my account',
    });
    if (!first) return;
    const second = await confirmDialog({
      title: 'Really delete everything?',
      message: `Last check for @${user.email ?? 'this account'} — active Pro time is forfeited and nothing can be recovered.`,
      confirmText: 'Delete forever',
      cancelText: 'Go back',
    });
    if (!second) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Deletion failed — try again or contact support@wordocious.com');
      }
      await signOut();
      window.location.href = '/';
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Deletion failed');
      setDeleting(false);
    }
  };

  // Open Stripe's Customer Portal for a web-purchased sub (cancel / update card).
  // 404 → no web subscription on file; point them at the store links instead.
  const handleManageWebBilling = async () => {
    if (!user) return;
    setPortalLoading(true);
    setPortalError(null);
    try {
      // The route identifies the user from this token — sending a userId in
      // the body would be an open door (see the comment in the route).
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (res.status === 404) {
        setPortalError('No web subscription found for this account. If you subscribed on a phone, use the store rows.');
      } else {
        setPortalError('Could not open billing right now. Please try again later.');
      }
    } catch {
      setPortalError('Could not open billing.');
    } finally {
      setPortalLoading(false);
    }
  };

  const keyboardLayouts: { value: KeyboardLayout; label: string; description: string }[] = [
    { value: 'standard', label: 'Standard', description: 'Enter left, delete right' },
    { value: 'flipped', label: 'Flipped', description: 'Delete left, enter right' },
    { value: 'michael', label: 'Michael Keyboard', description: '4 rows, delete + enter on both sides' },
  ];

  const themes: { value: Theme; label: string; description: string }[] = [
    { value: 'default', label: 'Default', description: 'Purple & amber tiles' },
    { value: 'dark', label: 'Dark', description: 'Easy on the eyes' },
    { value: 'ocean', label: 'Ocean', description: 'Blue and teal tones' },
    { value: 'forest', label: 'Forest', description: 'Green and earth tones' },
  ];

  // FINISH_SPEC C4b / G5: the dialog is a soft lavender sheet with the brand
  // top bar; every section is a tinted card in its own accent with tinted rows
  // and tinted switches (settings-kit), and the Friends notification toggles
  // live here now under "Notifications". R with his cocoa rests at the foot
  // (A7: a secondary spot, one pose).
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-w-md border rounded-3xl sm:rounded-3xl"
        style={{ background: softBackground(BRAND_ACCENT, 0.07), borderColor: 'rgba(124, 58, 237, 0.25)', paddingTop: 0 }}
      >
        <div aria-hidden="true" style={{ ...cardBarStyle(BRAND_ACCENT), margin: '0 -24px', background: 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)' }} />
        <DialogHeader>
          {/* The SETTINGS lettering as a small centered headline (FINISH_SPEC N1), the bare close X at the corner. */}
          <div className="relative flex items-center justify-center px-10">
            <DialogTitle className="w-full">
              <ArtTitle
                name="art-titlecast-settings"
                label="Settings"
                as="div"
                align="center"
                widthPct={HEADLINE.widthPct}
                maxWidth={headlineMaxWidth(...ART_SIZE['art-titlecast-settings'])}
              />
            </DialogTitle>
            <HeaderBack kind="close" onClick={() => onOpenChange(false)} size={32} className="absolute right-0 top-1/2 -translate-y-1/2" />
          </div>
          <DialogDescription style={{ color: 'var(--color-text-muted)' }} className="text-xs font-bold text-center">
            Customize your Wordocious experience
          </DialogDescription>
        </DialogHeader>

        {/* BJ7: 12 between sections (was 16). */}
        <div className="space-y-3">
          {/* FINISH_SPEC AA3: the Pro member card (free players: the Go Pro upsell in the same slot).
              Manage = the Subscription path below: the Stripe portal for a web purchase, else the store links.
              Go Pro closes this dialog first so the Go Pro popup is on top and clickable. */}
          <ProMemberCard
            webBilling={webBilling}
            manageBusy={portalLoading}
            onManage={() => (webBilling
              ? handleManageWebBilling()
              : subscriptionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))}
            onGoPro={() => {
              onOpenChange(false);
              window.setTimeout(() => openGoProPopup(), 220);
            }}
          />

          <SettingsSection title="Theme" accent={SETTINGS_ACCENT.theme}>
            <div className="space-y-1.5">
              {themes.map((t) => (
                <SettingsOption
                  key={t.value}
                  selected={theme === t.value}
                  accent={SETTINGS_ACCENT.theme}
                  label={t.label}
                  description={t.description}
                  preview={<ThemeTilesPreview theme={t.value} />}
                  onClick={() => setTheme(t.value)}
                />
              ))}
            </div>
          </SettingsSection>

          <SettingsSection title="Keyboard" accent={SETTINGS_ACCENT.keyboard}>
            <div className="space-y-1.5">
              {keyboardLayouts.map((k) => (
                <SettingsOption
                  key={k.value}
                  selected={kbLayout === k.value}
                  accent={SETTINGS_ACCENT.keyboard}
                  label={k.label}
                  description={k.description}
                  preview={<KeyRowPreview layout={k.value} />}
                  onClick={() => { setKbLayout(k.value); setKeyboardLayout(k.value); }}
                />
              ))}
            </div>
          </SettingsSection>

          <SettingsSection title="Sound & Feedback" accent={SETTINGS_ACCENT.sound}>
            <div className="space-y-1.5">
              <SettingsToggle
                label="Sound Effects"
                description="Key taps, win/loss jingles"
                checked={soundOn}
                onCheckedChange={(v) => { setSoundOn(v); setSoundEnabled(v); }}
                accent={SETTINGS_ACCENT.sound}
              />
              <SettingsToggle
                label="Haptics"
                description="Little buzzes on taps, wins and streaks (where your device supports them)"
                checked={hapticsOn}
                onCheckedChange={(v) => { setHapticsOnState(v); setHapticsOn(v); }}
                accent={SETTINGS_ACCENT.sound}
              />
            </div>
          </SettingsSection>

          {/* C4b: the Friends notification toggles (moved here from the Friends bell). */}
          {user && <NotificationSettings />}

          {/* Guests and free players have nothing to manage: the store rows only show
              for a signed-in Pro member or a web (Stripe) purchase on file. */}
          {user && (isProActive || webBilling) && (
          <div ref={subscriptionRef} style={{ scrollMarginTop: 8 }}>
          <SettingsSection title="Subscription" accent={SETTINGS_ACCENT.subscription}>
            {/* The web can't tell which store a Pro sub was bought in, so both
                stores' manage pages are rows; a web (Stripe) purchase on file adds
                the billing-page row first (§255). BJ11: each row says what opens. */}
            <ManageSubscriptionRows
              webBilling={webBilling}
              onPortal={handleManageWebBilling}
              portalBusy={portalLoading}
              note={portalError}
              rowStyle={settingsRowStyle(SETTINGS_ACCENT.subscription)}
            />
          </SettingsSection>
          </div>
          )}

          {/* BI25: mounted after the dialog lands (its identity load stays off the open frame); below the fold. */}
          {user && settled && <LinkedSignIns key={user.id} />}

          {user && (
            <SettingsSection title="Account" accent={SETTINGS_ACCENT.account}>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="block w-full text-left p-3 disabled:opacity-50"
                style={settingsRowStyle(SETTINGS_ACCENT.account)}
              >
                <div className="font-extrabold text-xs" style={{ color: 'var(--color-loss-text)' }}>
                  {deleting ? 'Deleting…' : 'Delete account'}
                </div>
                <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  Permanently erase your profile and all data
                </div>
              </button>
              {deleteError && (
                <p className="text-[10px] font-bold px-1" style={{ color: 'var(--color-loss-text)' }}>{deleteError}</p>
              )}
            </SettingsSection>
          )}

          <SettingsSection title="Accessibility" accent={SETTINGS_ACCENT.accessibility}>
            <div className="space-y-1.5">
              <SettingsToggle
                label="Colorblind Mode"
                description="High contrast colors"
                checked={colorblindMode}
                onCheckedChange={setColorblindMode}
                accent={SETTINGS_ACCENT.accessibility}
              />
              <SettingsToggle
                label="Reduced Motion"
                description="Minimize animations"
                checked={reducedMotion}
                onCheckedChange={setReducedMotion}
                accent={SETTINGS_ACCENT.accessibility}
              />
            </div>
          </SettingsSection>

          {/* Help: the app tour replays only from here (founder 10-07), never from a game's help sheet. */}
          <SettingsSection title="Help" accent={SETTINGS_ACCENT.help}>
            {/* 2.8 item 23: the family QUIET button (was a raw row). */}
            <QuietButton block onClick={() => { onOpenChange(false); window.setTimeout(() => startTour(), 220); }}>
              Replay the app tour
            </QuietButton>
          </SettingsSection>

          {/* Season preview (admins only): Off (by date) or any registry season (lib/season-kit.ts). */}
          {(profile as { is_admin?: boolean | null } | null)?.is_admin === true && <SeasonPreviewPicker />}

          <div className="flex justify-center pt-1">
            <PoseArt pose="art-pose-r-cocoa" size={68} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
