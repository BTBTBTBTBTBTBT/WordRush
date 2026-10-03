'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { softRow } from '@/components/ui/soft-popup';
import { SUBSCRIPTION_HANDOFF, type BillingStore } from '@/lib/payment/subscription-copy';

// FINISH_SPEC BJ11: the one "manage your subscription" list on the web — the Pro page's
// member state, the crown's "You're Pro" sheet and Settings › Subscription. Each row
// says exactly what opens (Stripe's billing page, Apple's or Google Play's subscription
// settings) so leaving the app never comes as a surprise. The web can't tell which
// store a phone purchase came from, so both store rows show; the Stripe row only when a
// web purchase is on file (§255).

const GOLD = '#f5a524';

export const STORE_MANAGE_URL: Record<Exclude<BillingStore, 'stripe'>, string> = {
  apple: 'https://apps.apple.com/account/subscriptions',
  google: 'https://play.google.com/store/account/subscriptions?package=com.wordocious.app',
};

/** POST /api/stripe/portal → Stripe's customer portal (the same call Settings makes). */
export function useStripePortal() {
  const { user, session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const open = async () => {
    if (!user) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) { window.location.href = data.url; return; }
      setNote(res.status === 404
        ? 'No web subscription found for this account. If you subscribed on a phone, use the store rows.'
        : 'Could not open billing right now. Please try again later.');
    } catch {
      setNote('Could not open billing right now. Please try again later.');
    } finally {
      setBusy(false);
    }
  };
  return { open, busy, note };
}

function RowText({ title, line }: { title: string; line: string }) {
  return (
    <span className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block font-extrabold text-xs" style={{ color: 'var(--color-text)' }}>{title}</span>
        <span className="block text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{line}</span>
      </span>
      <ArrowUpRight aria-hidden="true" className="shrink-0" size={16} strokeWidth={2.75} style={{ color: '#b45309', opacity: 0.75 }} />
    </span>
  );
}

export function ManageSubscriptionRows({ webBilling, onPortal, portalBusy = false, note, accent = GOLD, rowStyle }: {
  /** A web (Stripe) purchase is on file: the billing-page row leads. */
  webBilling: boolean;
  onPortal: () => void;
  portalBusy?: boolean;
  note?: string | null;
  accent?: string;
  rowStyle?: React.CSSProperties;
}) {
  const style = rowStyle ?? softRow(accent, { radius: 14 });
  const stripe = SUBSCRIPTION_HANDOFF.stripe;
  return (
    <div className="space-y-1.5 text-left">
      {webBilling && (
        <button type="button" onClick={onPortal} disabled={portalBusy} className="block w-full text-left p-3 disabled:opacity-60" style={style}>
          <RowText title={portalBusy ? 'Opening billing…' : stripe.title} line={stripe.line} />
        </button>
      )}
      {(['apple', 'google'] as const).map((s) => (
        <a key={s} href={STORE_MANAGE_URL[s]} target="_blank" rel="noopener noreferrer" className="block w-full p-3" style={style}>
          <RowText title={SUBSCRIPTION_HANDOFF[s].title} line={SUBSCRIPTION_HANDOFF[s].line} />
        </a>
      ))}
      {note && <p className="m-0 px-1 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{note}</p>}
    </div>
  );
}
