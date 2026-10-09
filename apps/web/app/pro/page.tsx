'use client';

import { useState, useEffect } from 'react';
import { Icon3D, type Icon3DName } from '@/components/ui/icon3d';
import { GameArt } from '@/components/ui/game-art';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { PRO_PLANS } from '@/lib/payment/types';
import { PageHeader } from '@/components/ui/page-header';
import { PageBackground } from '@/components/ui/page-background';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { SoftNum } from '@/components/ui/soft-number';
import { PopupBar, SoftSectionLabel, softRow } from '@/components/ui/soft-popup';
import { badgeSrc, onPageShadow } from '@/lib/art';
import { GiftProCard } from '@/components/friends/invite-screens';
import { softBackground, softBorder, softIconTile, softShadow, liftedInk } from '@/lib/soft-surface';
import { PoseArt } from '@/components/ui/soft-popup';
import { ProSceneCarousel } from '@/components/pro/pro-scene';
import { ADS_SERVING } from '@wordle-duel/core';
import { AuthModal } from '@/components/auth/auth-modal';
import { ManageSubscriptionRows, useStripePortal } from '@/components/pro/manage-subscription';
import { proRenewalLabel } from '@/lib/pro-crown';
import { memberSince } from '@/lib/pro-identity';
import { CHECKOUT_HANDOFF_LINE, PRO_LAPSED_BODY, proLapsedLine, webRenewalDisclosure } from '@/lib/payment/subscription-copy';

// The Pro page (docs/FINISH_SPEC.md G1): the gold card family — gold-tinted
// cards with the gold top bar, W crowned with the golden star
// (art-scene-pro-crown) large at the top, the plans as tinted option cards
// (selected = a stronger wash + a gold ring), ONE large amber candy CTA for the
// selected plan, and feature rows with 3D icons. No plain white. Checkout is
// unchanged: the CTA calls the same handleSubscribe(plan id).

const GOLD = '#f5a524';
const GOLD_BAR = 'linear-gradient(90deg, #ffd166, #f5a524 55%, #f97316)';

/** A feature row's 3D icon: a 3D UI icon or a game's 3D icon. */
type FeatureIcon = { icon: Icon3DName } | { game: string };

const benefits: { art: FeatureIcon; accent: string; text: string }[] = [
  // Only a selling point while ads actually serve (ADS_SERVING, core ads.ts); otherwise the row is dropped.
  ...(ADS_SERVING ? [{ art: { icon: 'badge-check' } as FeatureIcon, accent: '#10b981', text: 'Ad-free experience — no interruptions, ever' }] : []),
  { art: { game: 'practice' }, accent: '#7c3aed', text: 'Unlimited replays of every game mode, any time' },
  { art: { game: 'vs' }, accent: '#0d9488', text: 'VS mode on every game — challenge friends in every mode' },
  { art: { game: 'gauntlet' }, accent: '#f97316', text: 'Battle all ten of the cast, anytime' },
  { art: { icon: 'add-friend' }, accent: '#ec4899', text: 'Invite friends to private matches by link or username' },
  { art: { icon: 'shield' }, accent: '#7c3aed', text: '4 streak shields credited each billing period' },
  { art: { icon: 'share' }, accent: '#ec4899', text: 'Gift 7 days of Pro to 3 friends — and earn rewards when they join' },
  { art: { icon: 'crown' }, accent: GOLD, text: 'Pro badge on profile & leaderboards' },
  { art: { icon: 'tab-stats' }, accent: '#3b82f6', text: 'Extended stats — win rate trends & avg speed per mode' },
  { art: { icon: 'bell' }, accent: '#f97316', text: 'Early access to new game modes' },
];

function FeatureArt({ art }: { art: FeatureIcon }) {
  return 'icon' in art ? <Icon3D name={art.icon} size={26} /> : <GameArt id={art.game} size={26} />;
}

/** A gold card (A1): the gold wash, its soft border and the gold top bar. */
const goldCard: React.CSSProperties = {
  background: softBackground(GOLD, 0.14),
  border: softBorder(GOLD, 0.14),
  borderRadius: 22,
  overflow: 'hidden',
  boxShadow: onPageShadow(softShadow(GOLD, 0.16)),
};

type PlanKey = 'yearly' | 'monthly';

export default function ProPage() {
  const { user, session, profile, refreshProfile, isProActive } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  // BJ11: a guest's Subscribe signs in first (it was a dead button), then comes back here.
  const [authOpen, setAuthOpen] = useState(false);
  const portal = useStripePortal();
  const pf = profile as unknown as { created_at?: string | null; pro_expires_at?: string | null; stripe_customer_id?: string | null } | null;
  const webBilling = process.env.NEXT_PUBLIC_STRIPE_ENABLED === 'true' && !!pf?.stripe_customer_id;
  const renewal = isProActive ? proRenewalLabel(pf?.pro_expires_at ?? null) : null;
  const since = isProActive ? memberSince(pf?.created_at) : null;
  // BJ11: a former member (Pro window in the past) is welcomed back above the plans.
  const lapsed = user ? proLapsedLine(pf?.pro_expires_at ?? null, isProActive) : null;
  const [payError, setPayError] = useState<string | null>(null);
  // The plan the big CTA buys (yearly preselected: the best value).
  const [plan, setPlan] = useState<PlanKey>('yearly');
  // Real payments are wired only when Stripe is configured. Until then the buy
  // buttons are disabled with "Coming soon" — NEVER a free grant, and never a
  // dead 503. (Server truth is paymentsConfigured(); this is the UI mirror.)
  const paymentsEnabled = process.env.NEXT_PUBLIC_STRIPE_ENABLED === 'true';

  // Returning from Stripe checkout: fulfillment lands via the webhook, so pull
  // the fresh profile a moment after redirect-back.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('purchase') === 'success') {
      const t = setTimeout(() => { refreshProfile(); }, 1500);
      return () => clearTimeout(t);
    }
  }, [refreshProfile]);
  // A guest who signed in from the Subscribe button lands back on the plans.
  useEffect(() => { if (user && authOpen) setAuthOpen(false); }, [user, authOpen]);

  const handleSubscribe = async (planId: string) => {
    if (!user) { setAuthOpen(true); return; }
    if (!paymentsEnabled) return;
    setLoading(planId);
    setPayError(null);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          type: 'subscription',
          itemId: planId,
          returnUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (data.url) {
        // Redirect to Stripe Checkout. Fulfillment happens server-side via the
        // webhook after payment — NOT here (that was the free-Pro bug).
        window.location.href = data.url;
      } else {
        setPayError(data.error || 'Could not start checkout.');
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      setPayError('Could not start checkout.');
    } finally {
      setLoading(null);
    }
  };

  const plans: { key: PlanKey; title: string; price: string; per: string; note: string; badge?: string }[] = [
    { key: 'yearly', title: 'Yearly', price: `$${PRO_PLANS.yearly.price}`, per: '/yr', note: '$5/mo billed annually', badge: 'BEST VALUE' },
    { key: 'monthly', title: 'Monthly', price: `$${PRO_PLANS.monthly.price}`, per: '/mo', note: 'Cancel anytime' },
  ];
  const selected = PRO_PLANS[plan];

  return (
    <PageBackground tint="home" className="min-h-screen pb-20">
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        {/* The whole-cast GO PRO title art (docs/ART_SPEC.md §2) in the shared page header. */}
        <PageHeader
          className="mb-4"
          title="GO PRO"
          art="art-titlecast-gopro"
          artLabel="Go Pro"
          sub={(
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>
              {ADS_SERVING ? 'Play unlimited & ad-free — every mode, any time' : 'Play unlimited — every mode, any time'}
            </p>
          )}
        />

        {/* Item 20: the free player's own mascot (alive) on the pedestal; the five benefit scenes take turns beside it. */}
        <div className="relative flex justify-center mb-4">
          <div
            aria-hidden="true"
            className="absolute celebrate-glow"
            style={{ width: 230, height: 230, top: '50%', left: '50%', marginTop: -115, marginLeft: -115, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 209, 102, 0.55), rgba(245, 165, 36, 0) 68%)' }}
          />
          <div className="relative"><ProSceneCarousel height={190} /></div>
        </div>

        {isProActive ? (
          <>
          <div className="text-center" style={goldCard}>
            <PopupBar accent={GOLD} gradient={GOLD_BAR} />
            <div className="p-7">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-3"
                style={{ background: 'linear-gradient(#ffc56b, #f97316)', boxShadow: 'inset 0 0 0 1.5px #f5c542, 0 3px 0 #a24b0e' }}
              >
                {/* AA4: Pro members see the crown, never a PRO pill. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={badgeSrc('pro-crown-sprite')} alt="" aria-hidden="true" width={22} height={22} style={{ width: 22, height: 22, transform: 'rotate(-8deg)' }} />
                <span className="text-white font-black text-sm" style={{ textShadow: '0 1px 2px rgba(59, 26, 120, 0.5)' }}>You&apos;re Pro</span>
              </div>
              <p className="m-0 text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>
                You&apos;re enjoying all Pro benefits!
              </p>
              {(since || renewal) && (
                <p className="m-0 mt-1 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  {[since, renewal ? `Renews or ends ${renewal}` : null].filter(Boolean).join(' · ')}
                </p>
              )}
              {/* BJ11: manage right here — each row says what opens (Stripe / Apple / Google Play). */}
              <SoftSectionLabel ink="#b45309" className="mt-5 mb-2 px-1 text-left">Manage subscription</SoftSectionLabel>
              <ManageSubscriptionRows webBilling={webBilling} onPortal={portal.open} portalBusy={portal.busy} note={portal.note} accent={GOLD} />
            </div>
          </div>
          {/* T4 (docs/FINISH_SPEC.md): Pro players gift a week of Pro from the Friends tab (the InvitePanel there). */}
          <GiftProCard className="mt-4" sendHref="/friends">
            <p className="m-0 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
              Each friend gets 7 days of Pro free, and you earn rewards when they join.
            </p>
          </GiftProCard>
          </>
        ) : (
          <>
            {/* BJ11: a former member — W waves them back, with the day their Pro ended. */}
            {lapsed && (
              <div className="mb-4 flex items-center gap-3 p-3.5" style={goldCard} role="status">
                <PoseArt pose="art-pose-w-wave" size={64} priority />
                <div className="min-w-0 text-left">
                  <p className="m-0 text-[15px] font-black" style={{ color: 'var(--color-text)' }}>Welcome back</p>
                  <p className="m-0 text-xs font-extrabold" style={{ color: '#b45309' }}>{lapsed}</p>
                  <p className="m-0 mt-0.5 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{PRO_LAPSED_BODY}</p>
                </div>
              </div>
            )}

            {/* Benefits: feature rows with 3D icons on the gold card. */}
            <div className="mb-6" style={goldCard}>
              <PopupBar accent={GOLD} gradient={GOLD_BAR} />
              <div className="p-3.5">
                <SoftSectionLabel ink="#b45309" className="mb-2.5 px-1">Benefits</SoftSectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {benefits.map((b, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5" style={softRow(b.accent, { radius: 14 })}>
                      <span className="grid place-items-center shrink-0" style={{ width: 38, height: 38, ...softIconTile(b.accent, { radius: 11 }) }}>
                        <FeatureArt art={b.art} />
                      </span>
                      <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>{b.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Plans: tinted option cards (selected = stronger wash + gold ring) and ONE amber CTA. */}
            <div style={goldCard}>
              <PopupBar accent={GOLD} gradient={GOLD_BAR} />
              <div className="p-3.5">
                <SoftSectionLabel ink="#b45309" className="mb-2.5 px-1">Choose your plan</SoftSectionLabel>
                <div role="radiogroup" aria-label="Choose your plan" className="grid grid-cols-2 gap-3 pt-1.5">
                  {plans.map((p) => {
                    const on = plan === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPlan(p.key)}
                        className="relative text-left p-3.5"
                        style={{
                          ...softRow(GOLD, { selected: on, radius: 18 }),
                          ...(on ? { boxShadow: `0 0 0 3px rgba(245, 165, 36, 0.3), ${softShadow(GOLD, 0.2)}` } : null),
                        }}
                      >
                        {p.badge && (
                          <span
                            className="absolute -top-2.5 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-black text-white"
                            style={{ background: 'linear-gradient(#ffc56b, #f97316)', boxShadow: '0 2px 0 #a24b0e', textShadow: '0 1px 1px rgba(59, 26, 120, 0.45)' }}
                          >
                            {p.badge}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="grid place-items-center shrink-0 rounded-full"
                            style={{ width: 18, height: 18, border: `2px solid ${on ? GOLD : 'rgba(245, 165, 36, 0.45)'}`, background: on ? GOLD : 'transparent' }}
                          >
                            {on && <span className="rounded-full" style={{ width: 6, height: 6, background: '#fff' }} />}
                          </span>
                          <span className="text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>{p.title}</span>
                        </span>
                        <span className="block mt-1.5">
                          <SoftNum size={28} className="soft-num-auto">{p.price}</SoftNum>
                          <span className="text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>{p.per}</span>
                        </span>
                        <span className="block text-xs font-bold mt-1" style={{ color: 'var(--color-text-muted)' }}>{p.note}</span>
                      </button>
                    );
                  })}
                </div>

                <CastButton screen="gold"
                  color="amber"
                  size="lg"
                  block
                  className="mt-4"
                  icon={<Icon3D name="crown" size={24} />}
                  onClick={() => handleSubscribe(selected.id)}
                  disabled={loading !== null || !paymentsEnabled}
                >
                  {!user ? 'Sign in to go Pro' : !paymentsEnabled ? 'Coming soon' : loading === selected.id ? 'Opening checkout…' : plan === 'yearly' ? 'Subscribe Yearly' : 'Subscribe Monthly'}
                </CastButton>
                {/* BJ11: say where the purchase happens before it opens. */}
                {user && paymentsEnabled && (
                  <p className="m-0 mt-2 text-center text-[11px] font-extrabold" style={{ color: '#b45309' }}>{CHECKOUT_HANDOFF_LINE}</p>
                )}
              </div>
            </div>

            {/* Day pass — secondary CTA for impulse buyers. Rendered below
                the monthly/yearly plans so it doesn't compete with the main
                plans for attention (and cannibalize monthly conversions). */}
            <div className="mt-6 mb-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px" style={{ background: 'rgba(245, 165, 36, 0.35)' }} />
                <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  or try it first
                </span>
                <div className="flex-1 h-px" style={{ background: 'rgba(245, 165, 36, 0.35)' }} />
              </div>
              <CastButton screen="gold"
                color="peach"
                size="md"
                block
                onClick={() => handleSubscribe(PRO_PLANS.day.id)}
                disabled={loading !== null || (!!user && !paymentsEnabled)}
                style={{ textTransform: 'none' }}
              >
                {!paymentsEnabled
                  ? 'Coming soon'
                  : loading === PRO_PLANS.day.id
                  ? 'Opening checkout…'
                  : `Just today — $${PRO_PLANS.day.price.toFixed(0)} for 24 hours of Pro →`}
              </CastButton>
              <p className="mt-2 text-center text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                {paymentsEnabled
                  ? 'Eight day passes cost more than a month of Pro.'
                  : 'Payments are being set up — Pro will be purchasable here shortly.'}
              </p>
              {payError && (
                <p className="mt-2 text-center text-xs font-bold" style={{ color: 'var(--color-loss-text)' }}>{payError}</p>
              )}
              {/* Price + renewal terms and the legal links on the purchase surface (BJ11). */}
              <p className="m-0 mt-3 text-center text-[10px] font-bold leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                {webRenewalDisclosure(PRO_PLANS.monthly.price, PRO_PLANS.yearly.price)}
              </p>
              <p className="m-0 mt-1 text-center text-[10px] font-extrabold">
                <a href="/terms" className="text-[#7c3aed] [[data-theme=dark]_&]:text-[#c4a5ff]">Terms of Service</a>
                <span aria-hidden="true" style={{ color: 'var(--color-text-muted)' }}> · </span>
                <a href="/privacy" className="text-[#7c3aed] [[data-theme=dark]_&]:text-[#c4a5ff]">Privacy Policy</a>
              </p>
              {/* T4 (docs/FINISH_SPEC.md): the gift area — O3 with the crowned gift box on the gold card. */}
              <GiftProCard className="mt-5">
                <p className="m-0 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  Invited by a friend? Open their invite link to claim 7 free days. Once you&apos;re
                  Pro you can gift 7 days to 3 friends from the{' '}
                  <a href="/friends" style={{ color: '#7c3aed' }}>Friends tab</a>.
                </p>
              </GiftProCard>
            </div>
          </>
        )}

        {/* Static explainer — renders for every visitor (including signed-out
            crawlers), so the pricing page carries real information rather than
            just buttons. */}
        <section className="mt-8 overflow-hidden" style={{ ...goldCard, background: softBackground('#7c3aed', 0.08), border: softBorder('#7c3aed', 0.08) }}>
          <PopupBar accent="#7c3aed" gradient="linear-gradient(90deg, #a78bfa, #ec4899)" />
          <div className="p-5 space-y-5">
          <div>
            <h2 className="text-lg font-black mb-2" style={{ color: 'var(--color-text)' }}>
              What Pro actually changes
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Wordocious is free to play, and it stays that way: every one of the eight daily word puzzles —
              Classic, Six, Seven, QuadWord, OctoWord, Succession, Deliverance, and Gauntlet — and all ten
              Puzzles dailies, from ProperNoundle and Sudocious to Codebreaker and Muddle, are playable
              once a day at no cost, with the full daily leaderboard and your complete stats
              history included. Pro is for players who finish the daily slate and want to keep going.
              It {ADS_SERVING ? 'removes the interstitial ads, unlocks' : 'unlocks'} unlimited replays of every mode, opens VS head-to-head
              on every mode rather than the daily rotation, and lets you battle all ten of the cast as bot
              opponents so you can drill a weak mode without burning your daily attempt.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black mb-2" style={{ color: 'var(--color-text)' }}>
              Does Pro give a competitive advantage?
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              No — and that&apos;s deliberate. Pro buys you <em>more play</em>, not better odds. Daily
              leaderboard entries come from your first attempt at each mode, exactly like a free player&apos;s,
              and unlimited replays never overwrite a daily score. There are no hints, no extra guesses, and
              no scoring bonuses attached to a subscription. A free player and a Pro player who solve the same
              puzzle in the same number of guesses at the same speed post an identical score. The competitive
              ladder stays honest, which matters more to us than squeezing conversions out of it.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black mb-2" style={{ color: 'var(--color-text)' }}>
              Streak shields, explained
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              A streak shield protects your daily-login streak on a day you miss. Monthly and yearly Pro
              credit four shields each billing period, spent automatically the moment a gap would otherwise
              break your run. They cover travel, sick days, and the occasional forgotten evening — the
              things that end long streaks for reasons that have nothing to do with word skill. Shields do
              not stack indefinitely, and a day covered by a shield still counts as unplayed for leaderboards.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black mb-2" style={{ color: 'var(--color-text)' }}>
              Billing, cancellation, and the day pass
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Monthly and yearly plans renew automatically until you cancel, and you can cancel any time
              from Settings — access continues through the period you already paid for, with no cancellation
              fee and no winback friction. The <strong>day pass</strong> is a one-time purchase, not a
              subscription: it grants 24 hours of Pro and then simply expires with nothing to cancel. It
              exists for tournament nights and long flights, and it is deliberately priced so that habitual
              users are better off monthly — eight day passes cost more than a month of Pro.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black mb-2" style={{ color: 'var(--color-text)' }}>
              One subscription, every device
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Pro is tied to your Wordocious account, not to the device or store you bought it from. Purchase
              on the web and your iPhone recognizes it the next time you sign in; the same is true in reverse.
              Your streaks, stats, medals, and leaderboard history sync the same way, so switching between a
              laptop at lunch and a phone on the couch is seamless. New to the game? Start with the{' '}
              <a href="/how-to-play" className="font-bold" style={{ color: liftedInk('#7c3aed') }}>how-to-play guide</a>,
              browse the <a href="/guides" className="font-bold" style={{ color: liftedInk('#7c3aed') }}>mode guides</a>{' '}
              to find your favorite, and try Pro once the daily slate stops being enough.
            </p>
          </div>
          </div>
        </section>
      </div>

      <BottomNav />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </PageBackground>
  );
}
