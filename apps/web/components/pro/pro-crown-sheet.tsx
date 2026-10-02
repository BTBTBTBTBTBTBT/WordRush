'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { CandyButton } from '@/components/ui/candy-button';
import { HeaderBack } from '@/components/ui/page-header';
import { PopupBar, POPUP_ACCENT, popupCard, softRow } from '@/components/ui/soft-popup';
import { badgeSrc } from '@/lib/art';
import { proRenewalLabel } from '@/lib/pro-crown';

// FINISH_SPEC AA1: tapping the crown W wears in the living cast header opens
// this small "You're Pro 👑" sheet — the plan, the renewal date (what the
// profile has: pro_expires_at; nothing is shown when it's missing) and Manage.
// Manage is the Settings › Subscription path: Stripe's customer portal for a
// web purchase on file, else the App Store / Google Play subscription pages
// (the web can't tell which store a phone purchase came from).

const GOLD = POPUP_ACCENT.gold;
const GOLD_BAR = 'linear-gradient(90deg, #ffd166, #f5a524 55%, #f97316)';

const STORES = [
  { label: 'Manage on App Store', description: 'Subscribed on iPhone or iPad', href: 'https://apps.apple.com/account/subscriptions' },
  { label: 'Manage on Google Play', description: 'Subscribed on Android', href: 'https://play.google.com/store/account/subscriptions?package=com.wordocious.app' },
] as const;

export function ProCrownSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, session, profile } = useAuth();
  const [portalLoading, setPortalLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showStores, setShowStores] = useState(false);
  const p = profile as unknown as { pro_expires_at?: string | null; stripe_customer_id?: string | null } | null;
  const renewal = proRenewalLabel(p?.pro_expires_at ?? null);
  const webBilling = process.env.NEXT_PUBLIC_STRIPE_ENABLED === 'true' && !!p?.stripe_customer_id;

  // Same call as Settings › Manage web subscription (POST /api/stripe/portal).
  const manage = async () => {
    setNote(null);
    if (!webBilling || !user) {
      setShowStores(true);
      return;
    }
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setShowStores(true);
      setNote(res.status === 404
        ? 'No web subscription found for this account. If you subscribed on a phone, use the store links.'
        : 'Could not open billing right now. Please try again later.');
    } catch {
      setNote('Could not open billing.');
    } finally {
      setPortalLoading(false);
    }
  };

  const close = () => { onOpenChange(false); setShowStores(false); setNote(null); };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        hideClose
        className="max-w-xs gap-0 p-0 border-0 rounded-3xl sm:rounded-3xl"
        style={popupCard(GOLD, { radius: 26, share: 0.15 })}
      >
        <PopupBar accent={GOLD} gradient={GOLD_BAR} />
        <HeaderBack kind="close" onClick={close} size={32} label="Close" className="absolute top-3 right-2 z-10" />
        <div className="px-4 pt-3 pb-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={badgeSrc('pro-crown-sprite')}
            alt=""
            aria-hidden="true"
            width={64}
            height={64}
            draggable={false}
            className="mx-auto select-none pointer-events-none art-pop"
            style={{ width: 64, height: 64, transform: 'rotate(-8deg)', filter: 'drop-shadow(0 4px 6px rgba(180, 83, 9, 0.3))' }}
          />
          <DialogTitle className="m-0 mt-1 text-lg font-black" style={{ color: 'var(--color-text)' }}>
            You&apos;re Pro
          </DialogTitle>
          <DialogDescription className="m-0 mt-0.5 text-[12px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            Thanks for supporting Wordocious. Every Pro perk is yours.
          </DialogDescription>

          <dl className="mt-3 space-y-1.5 text-left">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5" style={softRow(GOLD, { radius: 14 })}>
              <dt className="text-[11px] font-black" style={{ color: 'var(--color-text-muted)', letterSpacing: 0.6 }}>PLAN</dt>
              <dd className="m-0 text-xs font-extrabold text-right" style={{ color: 'var(--color-text)' }}>
                Wordocious Pro{webBilling ? ' · billed on wordocious.com' : ''}
              </dd>
            </div>
            {renewal && (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5" style={softRow(GOLD, { radius: 14 })}>
                <dt className="text-[11px] font-black" style={{ color: 'var(--color-text-muted)', letterSpacing: 0.6 }}>RENEWS</dt>
                <dd className="m-0 text-xs font-extrabold text-right" style={{ color: 'var(--color-text)' }}>{renewal}</dd>
              </div>
            )}
          </dl>

          <CandyButton color="amber" size="md" block className="mt-4" onClick={manage} disabled={portalLoading}>
            {portalLoading ? 'Opening…' : 'Manage'}
          </CandyButton>

          {showStores && (
            <div className="mt-2 space-y-1.5 text-left">
              {STORES.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-3 py-2.5"
                  style={softRow(GOLD, { radius: 14 })}
                >
                  <span className="block font-extrabold text-xs" style={{ color: 'var(--color-text)' }}>{s.label}</span>
                  <span className="block text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{s.description}</span>
                </a>
              ))}
            </div>
          )}
          {note && <p className="m-0 mt-2 text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{note}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
