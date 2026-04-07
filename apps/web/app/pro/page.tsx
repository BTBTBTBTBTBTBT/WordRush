'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, ArrowLeft, Shield, BarChart3, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
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
        // Demo provider redirects with success params
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-yellow-400 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-500 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-12"
        >
          <Crown className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-5xl font-black text-white mb-2">Go Pro</h1>
          <p className="text-white/70 text-lg">Unlock the full SpellStrike experience</p>
        </motion.div>

        {isPro ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border-2 border-yellow-400/30 text-center"
          >
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 rounded-full px-4 py-2 mb-4">
              <Crown className="w-5 h-5 text-white" />
              <span className="text-white font-black">ACTIVE PRO</span>
            </div>
            <p className="text-white/70">You're enjoying all Pro benefits!</p>
          </motion.div>
        ) : (
          <>
            {/* Benefits */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10"
            >
              {benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                  <b.icon className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <span className="text-white text-sm font-medium">{b.text}</span>
                </div>
              ))}
            </motion.div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Monthly */}
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 border-2 border-white/20 hover:border-white/40 transition-colors"
              >
                <h3 className="text-lg font-bold text-white mb-1">Monthly</h3>
                <div className="text-4xl font-black text-white mb-1">
                  ${PRO_PLANS.monthly.price}<span className="text-lg font-medium text-white/50">/mo</span>
                </div>
                <p className="text-white/50 text-sm mb-6">Cancel anytime</p>
                <button
                  onClick={() => handleSubscribe(PRO_PLANS.monthly.id)}
                  disabled={loading !== null}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {loading === PRO_PLANS.monthly.id ? 'Processing...' : 'Subscribe Monthly'}
                </button>
              </motion.div>

              {/* Yearly */}
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="relative bg-white/10 backdrop-blur-sm rounded-3xl p-6 border-2 border-yellow-400/40 hover:border-yellow-400/60 transition-colors"
              >
                <div className="absolute -top-3 right-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full px-3 py-1 text-xs font-black text-white">
                  BEST VALUE
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Yearly</h3>
                <div className="text-4xl font-black text-white mb-1">
                  ${PRO_PLANS.yearly.price}<span className="text-lg font-medium text-white/50">/yr</span>
                </div>
                <p className="text-white/50 text-sm mb-6">$4.99/mo billed annually</p>
                <button
                  onClick={() => handleSubscribe(PRO_PLANS.yearly.id)}
                  disabled={loading !== null}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold transition-colors disabled:opacity-50"
                >
                  {loading === PRO_PLANS.yearly.id ? 'Processing...' : 'Subscribe Yearly'}
                </button>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
