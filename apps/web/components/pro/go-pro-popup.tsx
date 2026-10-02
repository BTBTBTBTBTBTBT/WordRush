'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { PRO_PLANS } from '@/lib/payment/types';
import { GO_PRO_EVENT, checkoutReturnUrl, type GoProRequest } from '@/lib/payment/go-pro-popup';
import { CLOSE_OVERLAYS_EVENT } from '@/lib/nav-home';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { Icon3D } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';
import { CandyButton } from '@/components/ui/candy-button';
import { HeaderBack } from '@/components/ui/page-header';
import { PopupBar, POPUP_ACCENT, popupCard, softRow } from '@/components/ui/soft-popup';
import { AuthModal } from '@/components/auth/auth-modal';
import { ART_SIZE, artSrc } from '@/lib/art';
import { softShadow } from '@/lib/soft-surface';
import { feedback } from '@/lib/sound-events';

// The redesigned Go Pro popup (docs/FINISH_SPEC.md G1, R3): W crowned with
// the golden star, the plan picker (Yearly preselected, Monthly), and one
// large amber candy button. Opened from every surface that offers Unlimited
// to a free player or a guest (openGoProPopup); never the old modal, never a
// plain page. A guest's button goes through sign-in first and comes back to
// the popup. Checkout is the Pro page's (POST /api/purchase → Stripe); on
// success it returns to the Unlimited game the player reached for, which
// starts once the entitlement lands (components/game/unlimited-gate.tsx).
// Mounted once in app/layout.tsx.

const GOLD = POPUP_ACCENT.gold;
const GOLD_BAR = 'linear-gradient(90deg, #ffd166, #f5a524 55%, #f97316)';
const CROWN = 'art-scene-pro-crown' as const;
type PlanKey = 'yearly' | 'monthly';

export function GoProPopupHost() {
  const { user, session, isProActive } = useAuth();
  const [req, setReq] = useState<GoProRequest | null>(null);
  const [plan, setPlan] = useState<PlanKey>('yearly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, !!req && !authOpen);
  const paymentsEnabled = process.env.NEXT_PUBLIC_STRIPE_ENABLED === 'true';

  useEffect(() => {
    const onOpen = (e: Event) => { setError(null); setReq((e as CustomEvent<GoProRequest>).detail ?? {}); feedback('whoosh'); };
    window.addEventListener(GO_PRO_EVENT, onOpen);
    return () => window.removeEventListener(GO_PRO_EVENT, onOpen);
  }, []);

  const close = useCallback(() => { setReq(null); setAuthOpen(false); }, []);
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !authOpen) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [req, authOpen, close]);
  // A guest who just signed in comes back to the popup (the auth modal closes).
  useEffect(() => { if (user && authOpen) setAuthOpen(false); }, [user, authOpen]);
  // Already Pro (bought elsewhere, or a profile refresh): go straight to the game.
  useEffect(() => {
    if (req && isProActive && req.afterPurchaseHref) window.location.href = req.afterPurchaseHref;
  }, [req, isProActive]);

  if (!req) return null;

  const subscribe = async () => {
    if (!user) { setAuthOpen(true); return; }
    if (!paymentsEnabled) return;
    const planId = PRO_PLANS[plan].id;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({
          type: 'subscription',
          itemId: planId,
          returnUrl: checkoutReturnUrl(window.location.origin, window.location.href, req.afterPurchaseHref),
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || 'Could not start checkout.');
    } catch {
      setError('Could not start checkout.');
    } finally {
      setLoading(false);
    }
  };

  const plans: { key: PlanKey; title: string; price: string; per: string; note: string; badge?: string }[] = [
    { key: 'yearly', title: 'Yearly', price: `$${PRO_PLANS.yearly.price}`, per: '/yr', note: '$5/mo billed annually', badge: 'BEST VALUE' },
    { key: 'monthly', title: 'Monthly', price: `$${PRO_PLANS.monthly.price}`, per: '/mo', note: 'Cancel anytime' },
  ];
  const [cw, ch] = ART_SIZE[CROWN];

  return (
    <>
      <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 animate-fade-in" style={{ background: 'rgba(30, 15, 60, 0.5)' }} onClick={close}>
        <div
          ref={focusRef}
          role="dialog"
          aria-modal="true"
          aria-label="Go Pro"
          className="relative w-full max-w-sm animate-fade-in-scale"
          style={popupCard(GOLD, { radius: 26, share: 0.15 })}
          onClick={(e) => e.stopPropagation()}
        >
          <PopupBar accent={GOLD} gradient={GOLD_BAR} />
          <HeaderBack kind="close" onClick={close} size={32} label="Close" className="absolute top-3 right-2 z-10" />
          <div className="px-4 pt-2 pb-4 text-center">
            <Image src={artSrc(CROWN)} alt="" aria-hidden width={cw} height={ch} sizes="120px" draggable={false} className="mx-auto select-none pointer-events-none art-pop" style={{ height: 118, width: 'auto', filter: 'drop-shadow(0 6px 10px rgba(180, 83, 9, 0.25))' }} />
            <h2 className="m-0 mt-1 text-lg font-black" style={{ color: 'var(--color-text)' }}>
              {req.reason ? `${req.reason} is a Pro perk` : 'Go Pro'}
            </h2>
            <p className="m-0 mt-0.5 text-[12px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
              Fresh puzzles in every game, no waiting, no ads.
            </p>
            <div role="radiogroup" aria-label="Choose your plan" className="grid grid-cols-2 gap-2.5 mt-3 pt-1.5">
              {plans.map((p) => {
                const on = plan === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPlan(p.key)}
                    className="relative text-left p-3"
                    style={{ ...softRow(GOLD, { selected: on, radius: 16 }), ...(on ? { boxShadow: `0 0 0 3px rgba(245, 165, 36, 0.3), ${softShadow(GOLD, 0.2)}` } : null) }}
                  >
                    {p.badge && (
                      <span className="absolute -top-2.5 right-2 px-2 py-0.5 rounded-full text-[9px] font-black text-white" style={{ background: 'linear-gradient(#ffc56b, #f97316)', boxShadow: '0 2px 0 #a24b0e' }}>{p.badge}</span>
                    )}
                    <span className="block text-[13px] font-extrabold" style={{ color: 'var(--color-text)' }}>{p.title}</span>
                    <span className="block mt-1">
                      <SoftNum size={22} className="soft-num-auto">{p.price}</SoftNum>
                      <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{p.per}</span>
                    </span>
                    <span className="block text-[11px] font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{p.note}</span>
                  </button>
                );
              })}
            </div>
            <CandyButton
              color="amber"
              size="lg"
              block
              className="mt-4"
              icon={<Icon3D name="crown" size={24} />}
              onClick={subscribe}
              disabled={loading || (!!user && !paymentsEnabled)}
            >
              {!user ? 'Sign in to go Pro' : !paymentsEnabled ? 'Coming soon' : loading ? 'Processing...' : plan === 'yearly' ? 'Subscribe Yearly' : 'Subscribe Monthly'}
            </CandyButton>
            {error && <p className="mt-2 text-xs font-bold" style={{ color: 'var(--color-loss-text)' }}>{error}</p>}
          </div>
        </div>
      </div>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
