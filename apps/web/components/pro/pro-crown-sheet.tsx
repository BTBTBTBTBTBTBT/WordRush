'use client';

import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { HeaderBack } from '@/components/ui/page-header';
import { PopupBar, POPUP_ACCENT, popupCard, softRow, SoftSectionLabel } from '@/components/ui/soft-popup';
import { badgeSrc } from '@/lib/art';
import { proRenewalLabel } from '@/lib/pro-crown';
import { ManageSubscriptionRows, useStripePortal } from '@/components/pro/manage-subscription';
import { HeadingArt } from '@/components/ui/heading-art';

// FINISH_SPEC AA1: tapping the crown W wears in the living cast header opens
// this small "You're Pro" sheet — the plan, the renewal date (what the
// profile has: pro_expires_at; nothing is shown when it's missing) and the
// manage rows. BJ11: the rows are always shown and each says what opens —
// Stripe's billing page for a web purchase on file, Apple's / Google Play's
// subscription settings (the web can't tell which store a phone purchase came from).

const GOLD = POPUP_ACCENT.gold;
const GOLD_BAR = 'linear-gradient(90deg, #ffd166, #f5a524 55%, #f97316)';

export function ProCrownSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { profile } = useAuth();
  const portal = useStripePortal();
  const p = profile as unknown as { pro_expires_at?: string | null; stripe_customer_id?: string | null } | null;
  const renewal = proRenewalLabel(p?.pro_expires_at ?? null);
  const webBilling = process.env.NEXT_PUBLIC_STRIPE_ENABLED === 'true' && !!p?.stripe_customer_id;

  const close = () => { onOpenChange(false); };

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
          {/* BJ16: the YOU'RE PRO lettering. */}
          <DialogTitle className="m-0 mt-1">
            <HeadingArt slug="yourepro" bare height={44} />
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

          <SoftSectionLabel ink="#b45309" className="mt-4 mb-1.5 px-1 text-left">Manage subscription</SoftSectionLabel>
          <ManageSubscriptionRows webBilling={webBilling} onPortal={portal.open} portalBusy={portal.busy} note={portal.note} accent={GOLD} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
