'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { useTheme, Theme } from '@/lib/theme-context';
import { isSoundEnabled, setSoundEnabled } from '@/lib/sounds';
import { useAuth } from '@/lib/auth-context';
import { confirmDialog } from '@/components/ui/confirm-dialog';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme, colorblindMode, setColorblindMode, reducedMotion, setReducedMotion } = useTheme();
  const { user, session, signOut } = useAuth();
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
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
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, returnUrl: window.location.href }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (res.status === 404) {
        setPortalError('No web subscription found — if you subscribed on a phone, use the store links below.');
      } else {
        setPortalError(data.error || 'Could not open billing.');
      }
    } catch {
      setPortalError('Could not open billing.');
    } finally {
      setPortalLoading(false);
    }
  };

  const themes: { value: Theme; label: string; description: string }[] = [
    { value: 'default', label: 'Default', description: 'Classic Wordle colors' },
    { value: 'dark', label: 'Dark', description: 'Easy on the eyes' },
    { value: 'ocean', label: 'Ocean', description: 'Blue and teal tones' },
    { value: 'forest', label: 'Forest', description: 'Green and earth tones' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <DialogHeader>
          <DialogTitle className="font-black text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>Settings</DialogTitle>
          <DialogDescription style={{ color: 'var(--color-text-muted)' }} className="text-xs font-bold">
            Customize your Wordocious experience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="section-header">THEME</div>
            <div className="space-y-1.5">
              {themes.map((t) => (
                <button
                  key={t.value}
                  className="w-full text-left p-3 rounded-xl transition-all"
                  onClick={() => setTheme(t.value)}
                  style={{
                    background: theme === t.value ? 'var(--color-surface-hover)' : 'var(--color-bg)',
                    border: theme === t.value ? '1.5px solid #c4b5fd' : '1.5px solid var(--color-border)',
                  }}
                >
                  <div className="font-extrabold text-xs" style={{ color: 'var(--color-text)' }}>{t.label}</div>
                  <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="section-header">SOUND & FEEDBACK</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold" style={{ color: 'var(--color-text)' }}>Sound Effects</div>
                <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Key taps, win/loss jingles</div>
              </div>
              <Switch checked={soundOn} onCheckedChange={(v) => { setSoundOn(v); setSoundEnabled(v); }} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="section-header">SUBSCRIPTION</div>
            {/* The web can't tell which store a Pro sub was bought in, so link
                both stores' manage pages. Bought on the web (Stripe)? The
                portal row below appears once web billing is live and opens
                Stripe's self-serve manage/cancel. */}
            <div className="space-y-1.5">
              {process.env.NEXT_PUBLIC_STRIPE_ENABLED === 'true' && (
                <button
                  onClick={handleManageWebBilling}
                  disabled={portalLoading}
                  className="block w-full text-left p-3 rounded-xl transition-all disabled:opacity-50"
                  style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-xs" style={{ color: 'var(--color-text)' }}>
                        {portalLoading ? 'Opening…' : 'Manage web subscription'}
                      </div>
                      <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Bought on wordocious.com — cancel or update card</div>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>›</span>
                  </div>
                </button>
              )}
              {[
                { label: 'Manage on App Store', description: 'Subscribed on iPhone or iPad', href: 'https://apps.apple.com/account/subscriptions' },
                { label: 'Manage on Google Play', description: 'Subscribed on Android', href: 'https://play.google.com/store/account/subscriptions?package=com.wordocious.app' },
              ].map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-left p-3 rounded-xl transition-all"
                  style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-xs" style={{ color: 'var(--color-text)' }}>{s.label}</div>
                      <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{s.description}</div>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>›</span>
                  </div>
                </a>
              ))}
              {portalError && (
                <p className="text-[10px] font-bold px-1" style={{ color: 'var(--color-text-muted)' }}>{portalError}</p>
              )}
            </div>
          </div>

          {user && (
            <div className="space-y-2">
              <div className="section-header">ACCOUNT</div>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="block w-full text-left p-3 rounded-xl transition-all disabled:opacity-50"
                style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}
              >
                <div className="font-extrabold text-xs" style={{ color: '#dc2626' }}>
                  {deleting ? 'Deleting…' : 'Delete account'}
                </div>
                <div className="text-[10px] font-bold" style={{ color: '#b91c1c' }}>
                  Permanently erase your profile and all data
                </div>
              </button>
              {deleteError && (
                <p className="text-[10px] font-bold px-1" style={{ color: '#dc2626' }}>{deleteError}</p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="section-header">ACCESSIBILITY</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold" style={{ color: 'var(--color-text)' }}>Colorblind Mode</div>
                <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>High contrast colors</div>
              </div>
              <Switch checked={colorblindMode} onCheckedChange={setColorblindMode} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold" style={{ color: 'var(--color-text)' }}>Reduced Motion</div>
                <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Minimize animations</div>
              </div>
              <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
