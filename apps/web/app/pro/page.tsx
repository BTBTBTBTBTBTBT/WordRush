'use client';

import { useState } from 'react';
import { Check, Crown, Shield, BarChart3, Sparkles, Zap, Swords, Grid3x3 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { PRO_PLANS } from '@/lib/payment/types';

const benefits = [
  { icon: Grid3x3, text: 'Unlimited replays of all 8 game modes, any time' },
  { icon: Swords, text: 'Unlimited VS matches per day' },
  { icon: Shield, text: '4 streak shields credited each billing period' },
  { icon: Sparkles, text: 'Pro badge on profile & leaderboards' },
  { icon: BarChart3, text: 'Extended stats — win rate trends & avg speed per mode' },
  { icon: Zap, text: 'Early access to new game modes' },
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
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#f8f7ff' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        <div className="text-center mb-8">
          <Crown className="w-14 h-14 mx-auto mb-3" style={{ color: '#d97706' }} />
          <h1 className="text-4xl font-black mb-1" style={{ color: '#1a1a2e' }}>Go Pro</h1>
          <p className="text-sm font-bold" style={{ color: '#9ca3af' }}>
            Play unlimited — all 8 modes, any time
          </p>
        </div>

        {isPro ? (
          <div
            className="text-center p-8"
            style={{
              background: '#ffffff',
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
            <p className="text-sm font-bold" style={{ color: '#9ca3af' }}>
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
                    background: '#ffffff',
                    border: '1.5px solid #ede9f6',
                    borderRadius: '16px',
                  }}
                >
                  <b.icon className="w-5 h-5 flex-shrink-0" style={{ color: '#d97706' }} />
                  <span className="text-xs font-bold" style={{ color: '#1a1a2e' }}>{b.text}</span>
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
                  background: '#ffffff',
                  border: '1.5px solid #ede9f6',
                  borderRadius: '16px',
                }}
              >
                <h3 className="text-sm font-extrabold mb-1" style={{ color: '#1a1a2e' }}>Monthly</h3>
                <div className="text-3xl font-black mb-0.5" style={{ color: '#1a1a2e' }}>
                  ${PRO_PLANS.monthly.price}<span className="text-sm font-bold" style={{ color: '#9ca3af' }}>/mo</span>
                </div>
                <p className="text-xs font-bold mb-5" style={{ color: '#9ca3af' }}>Cancel anytime</p>
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
                  background: '#ffffff',
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
                <h3 className="text-sm font-extrabold mb-1" style={{ color: '#1a1a2e' }}>Yearly</h3>
                <div className="text-3xl font-black mb-0.5" style={{ color: '#1a1a2e' }}>
                  ${PRO_PLANS.yearly.price}<span className="text-sm font-bold" style={{ color: '#9ca3af' }}>/yr</span>
                </div>
                <p className="text-xs font-bold mb-5" style={{ color: '#9ca3af' }}>$4.99/mo billed annually</p>
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
