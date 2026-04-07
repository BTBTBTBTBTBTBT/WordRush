'use client';

import { useState } from 'react';
import { Check, Crown, Shield, BarChart3, Sparkles, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { PRO_PLANS } from '@/lib/payment/types';

const benefits = [
  { icon: BarChart3, text: 'Extended stats & win rate trends' },
  { icon: Shield, text: '4 streak shields on subscribe' },
  { icon: Sparkles, text: 'Pro badge on profile & leaderboards' },
  { icon: Zap, text: 'Early access to new features' },
];

export default function ProPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const isPro = (profile as any)?.is_pro ?? false;

  const handleSubscribe = async (planId: string) => {
    if (!user) return;
    setLoading(planId);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type: 'subscription',
          itemId: planId,
          returnUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (data.url) {
        await refreshProfile();
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Subscribe error:', err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#0d0a1a' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        <div className="text-center mb-8">
          <Crown className="w-14 h-14 mx-auto mb-3" style={{ color: '#fbbf24' }} />
          <h1 className="text-4xl font-black text-white mb-1">Go Pro</h1>
          <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Unlock the full SpellStrike experience
          </p>
        </div>

        {isPro ? (
          <div
            className="text-center p-8"
            style={{
              background: '#13102a',
              border: '1px solid rgba(251,191,36,0.3)',
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
            <p className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
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
                    background: '#13102a',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                  }}
                >
                  <b.icon className="w-5 h-5 flex-shrink-0" style={{ color: '#fbbf24' }} />
                  <span className="text-white text-xs font-bold">{b.text}</span>
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
                  background: '#13102a',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                }}
              >
                <h3 className="text-sm font-extrabold text-white mb-1">Monthly</h3>
                <div className="text-3xl font-black text-white mb-0.5">
                  ${PRO_PLANS.monthly.price}<span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>/mo</span>
                </div>
                <p className="text-xs font-bold mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>Cancel anytime</p>
                <button
                  onClick={() => handleSubscribe(PRO_PLANS.monthly.id)}
                  disabled={loading !== null}
                  className="w-full py-3 rounded-xl text-white font-black text-sm btn-3d disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    boxShadow: '0 4px 0 #4c1d95',
                  }}
                >
                  {loading === PRO_PLANS.monthly.id ? 'Processing...' : 'Subscribe Monthly'}
                </button>
              </div>

              {/* Yearly */}
              <div
                className="p-5 relative"
                style={{
                  background: '#13102a',
                  border: '1px solid rgba(251,191,36,0.3)',
                  borderRadius: '16px',
                }}
              >
                <div
                  className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  BEST VALUE
                </div>
                <h3 className="text-sm font-extrabold text-white mb-1">Yearly</h3>
                <div className="text-3xl font-black text-white mb-0.5">
                  ${PRO_PLANS.yearly.price}<span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>/yr</span>
                </div>
                <p className="text-xs font-bold mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>$4.99/mo billed annually</p>
                <button
                  onClick={() => handleSubscribe(PRO_PLANS.yearly.id)}
                  disabled={loading !== null}
                  className="w-full py-3 rounded-xl text-white font-black text-sm btn-3d disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    boxShadow: '0 4px 0 #92400e',
                  }}
                >
                  {loading === PRO_PLANS.yearly.id ? 'Processing...' : 'Subscribe Yearly'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
