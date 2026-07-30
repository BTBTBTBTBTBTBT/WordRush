'use client';

import { useState, useEffect } from 'react';
import { Check, Crown, Shield, BarChart3, Sparkles, Zap, Swords, EyeOff, Mail, Bot, Gift } from 'lucide-react';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { PRO_PLANS } from '@/lib/payment/types';

const benefits = [
  { icon: EyeOff, text: 'Ad-free experience — no interruptions, ever' },
  { icon: WordleGridIcon, text: 'Unlimited replays of all 9 game modes, any time' },
  { icon: Swords, text: 'VS mode on every game — challenge friends in all 9 modes' },
  { icon: Bot, text: 'Practice against the CPU — Easy, Medium & Hard bots, anytime' },
  { icon: Mail, text: 'Invite friends to private matches by link or username' },
  { icon: Shield, text: '4 streak shields credited each billing period' },
  { icon: Gift, text: 'Gift 7 days of Pro to 3 friends — and earn rewards when they join' },
  { icon: Sparkles, text: 'Pro badge on profile & leaderboards' },
  { icon: BarChart3, text: 'Extended stats — win rate trends & avg speed per mode' },
  { icon: Zap, text: 'Early access to new game modes' },
];

export default function ProPage() {
  const { user, session, refreshProfile, isProActive } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
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

  const handleSubscribe = async (planId: string) => {
    if (!user || !paymentsEnabled) return;
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

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--color-bg)' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        <div className="text-center mb-8">
          <Crown className="w-14 h-14 mx-auto mb-3" style={{ color: '#d97706' }} />
          <h1 className="text-4xl font-black mb-1" style={{ color: 'var(--color-text)' }}>Go Pro</h1>
          <p className="text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>
            Play unlimited & ad-free — all 9 modes, any time
          </p>
        </div>

        {isProActive ? (
          <div
            className="text-center p-8"
            style={{
              background: 'var(--color-surface)',
              border: '1.5px solid #fde68a',
              borderRadius: '16px',
            }}
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-3"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              <Crown className="w-4 h-4 text-white" />
              <span className="text-white font-black text-sm">ACTIVE PRO</span>
            </div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>
              You're enjoying all Pro benefits!
            </p>
          </div>
        ) : (
          <>
            {/* Benefits */}
            <div className="section-header mb-3">BENEFITS</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {benefits.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3.5"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1.5px solid var(--color-border)',
                    borderRadius: '16px',
                  }}
                >
                  <b.icon className="w-5 h-5 flex-shrink-0" style={{ color: '#d97706' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>{b.text}</span>
                </div>
              ))}
            </div>

            {/* Pricing Cards */}
            <div className="section-header mb-3">CHOOSE YOUR PLAN</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Monthly */}
              <div
                className="p-5"
                style={{
                  background: 'var(--color-surface)',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: '16px',
                }}
              >
                <h3 className="text-sm font-extrabold mb-1" style={{ color: 'var(--color-text)' }}>Monthly</h3>
                <div className="text-3xl font-black mb-0.5" style={{ color: 'var(--color-text)' }}>
                  ${PRO_PLANS.monthly.price}<span className="text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>/mo</span>
                </div>
                <p className="text-xs font-bold mb-5" style={{ color: 'var(--color-text-muted)' }}>Cancel anytime</p>
                <button
                  onClick={() => handleSubscribe(PRO_PLANS.monthly.id)}
                  disabled={loading !== null || !paymentsEnabled}
                  className="w-full py-3 rounded-xl text-white font-black text-sm btn-3d disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    boxShadow: '0 4px 0 #4c1d95',
                  }}
                >
                  {!paymentsEnabled ? 'Coming soon' : loading === PRO_PLANS.monthly.id ? 'Processing...' : 'Subscribe Monthly'}
                </button>
              </div>

              {/* Yearly */}
              <div
                className="p-5 relative"
                style={{
                  background: 'var(--color-surface)',
                  border: '1.5px solid #fde68a',
                  borderRadius: '16px',
                }}
              >
                <div
                  className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  BEST VALUE
                </div>
                <h3 className="text-sm font-extrabold mb-1" style={{ color: 'var(--color-text)' }}>Yearly</h3>
                <div className="text-3xl font-black mb-0.5" style={{ color: 'var(--color-text)' }}>
                  ${PRO_PLANS.yearly.price}<span className="text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>/yr</span>
                </div>
                <p className="text-xs font-bold mb-5" style={{ color: 'var(--color-text-muted)' }}>$4.99/mo billed annually</p>
                <button
                  onClick={() => handleSubscribe(PRO_PLANS.yearly.id)}
                  disabled={loading !== null || !paymentsEnabled}
                  className="w-full py-3 rounded-xl text-white font-black text-sm btn-3d disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    boxShadow: '0 4px 0 #92400e',
                  }}
                >
                  {!paymentsEnabled ? 'Coming soon' : loading === PRO_PLANS.yearly.id ? 'Processing...' : 'Subscribe Yearly'}
                </button>
              </div>
            </div>

            {/* Day pass — secondary CTA for impulse buyers. Rendered below
                the monthly/yearly grid so it doesn't compete with the main
                plans for attention (and cannibalize monthly conversions). */}
            <div className="mt-6 mb-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  or try it first
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
              </div>
              <button
                onClick={() => handleSubscribe(PRO_PLANS.day.id)}
                disabled={loading !== null || !paymentsEnabled}
                className="w-full py-3 rounded-xl font-black text-sm transition-opacity disabled:opacity-50"
                style={{
                  background: 'var(--color-surface)',
                  border: '1.5px solid var(--color-border)',
                  color: '#7c3aed',
                }}
              >
                {!paymentsEnabled
                  ? 'Coming soon'
                  : loading === PRO_PLANS.day.id
                  ? 'Processing...'
                  : `Just today — $${PRO_PLANS.day.price.toFixed(0)} for 24 hours of Pro →`}
              </button>
              <p className="mt-2 text-center text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                {paymentsEnabled
                  ? 'Eight day passes cost more than a month of Pro.'
                  : 'Payments are being set up — Pro will be purchasable here shortly.'}
              </p>
              {payError && (
                <p className="mt-2 text-center text-xs font-bold" style={{ color: '#dc2626' }}>{payError}</p>
              )}
              <p className="mt-4 text-center text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                Invited by a friend? Open their invite link to claim 7 free days. Once you&apos;re
                Pro you can gift 7 days to 3 friends from your{' '}
                <a href="/profile" style={{ color: '#7c3aed' }}>profile</a>.
              </p>
            </div>
          </>
        )}

        {/* Static explainer — renders for every visitor (including signed-out
            crawlers), so the pricing page carries real information rather than
            just buttons. */}
        <section className="mt-10 space-y-5">
          <div>
            <h2 className="text-lg font-black mb-2" style={{ color: 'var(--color-text)' }}>
              What Pro actually changes
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Wordocious is free to play, and it stays that way: every one of the nine daily puzzles —
              Classic, Six, Seven, QuadWord, OctoWord, Succession, Deliverance, Gauntlet, and ProperNoundle —
              is playable once a day at no cost, with the full daily leaderboard and your complete stats
              history included. Pro is for players who finish the daily slate and want to keep going.
              It removes the interstitial ads, unlocks unlimited replays of every mode, opens VS head-to-head
              on all nine modes rather than the daily rotation, and adds CPU practice opponents at three
              difficulty levels so you can drill a weak mode without burning your daily attempt.
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
              <a href="/how-to-play" className="font-bold" style={{ color: '#7c3aed' }}>how-to-play guide</a>,
              browse the <a href="/guides" className="font-bold" style={{ color: '#7c3aed' }}>mode guides</a>{' '}
              to find your favorite, and try Pro once the daily nine stops being enough.
            </p>
          </div>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}
