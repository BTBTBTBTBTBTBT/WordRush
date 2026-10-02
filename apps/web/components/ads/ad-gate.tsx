'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import { CandyButton, CandyLink } from '@/components/ui/candy-button';
import { SoftNum } from '@/components/ui/soft-number';
import { softBackground, softPill } from '@/lib/soft-surface';
import { useAuth } from '@/lib/auth-context';
import { AD_CONFIG } from '@/lib/ads/ad-config';
import { AdInterstitial } from './ad-interstitial';

interface AdGateProps {
  children: React.ReactNode;
}

/**
 * Wraps a game page. For free users it shows a full-screen interstitial ad
 * with a countdown before allowing the game to load. Pro users skip straight through.
 */
export function AdGate({ children }: AdGateProps) {
  const { isProActive } = useAuth();
  const isPro = isProActive;

  // §229: the web interstitial is OFF. A full-screen ad with a forced
  // countdown before the game loads violates AdSense's web placement
  // policies (interstitials on load, ads on a screen with no content) — and
  // with the site never approved, free players have been sitting through a
  // blank countdown wall since June. A reviewer hitting that wall is one
  // credible reason every review came back "low value content". The native
  // apps keep their game-start interstitial (a different policy regime).
  // Web monetization waits on a new provider (both AdSense accounts are closed
  // for good, 2026-09-23); the gate's Pro/ad-free logic is unchanged either way.
  const WEB_INTERSTITIAL_ENABLED = false;
  const shouldShowAd = WEB_INTERSTITIAL_ENABLED && !isPro && AD_CONFIG.enabled;

  const [phase, setPhase] = useState<'ad' | 'done'>(() =>
    shouldShowAd ? 'ad' : 'done',
  );
  const [countdown, setCountdown] = useState(AD_CONFIG.countdownSeconds);
  const [canContinue, setCanContinue] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'ad') return;
    if (countdown <= 0) {
      setCanContinue(true);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Hard timeout — never block the user forever
  useEffect(() => {
    if (phase !== 'ad') return;
    const t = setTimeout(() => setPhase('done'), AD_CONFIG.loadTimeoutMs);
    return () => clearTimeout(t);
  }, [phase]);

  const handleContinue = useCallback(() => setPhase('done'), []);

  // Skip entirely for pro users or when ads are disabled
  if (phase === 'done') {
    return <>{children}</>;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-between animate-fade-in"
      style={{ background: softBackground('#7c3aed', 0.08) }}
    >
          {/* ── Top branding ── */}
          <div className="pt-10 text-center">
            <h1
              className="text-2xl font-black text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}
            >
              WORDOCIOUS
            </h1>
            <p className="text-[10px] font-bold mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Your game is loading&hellip;
            </p>
          </div>

          {/* ── Ad container ── */}
          <div className="flex-1 flex items-center justify-center w-full px-4">
            <AdInterstitial />
          </div>

          {/* ── Bottom: countdown / continue / upsell ── */}
          <div className="pb-10 text-center space-y-3 w-full px-6">
            {canContinue ? (
              <CandyButton color="purple" size="lg" icon="play" onClick={handleContinue}>
                Continue to Game
              </CandyButton>
            ) : (
              <div
                className="inline-flex items-center gap-1.5 px-5 py-2"
                style={softPill('#7c3aed', { bar: false })}
              >
                <span className="text-xs font-extrabold" style={{ color: 'var(--color-text)' }}>
                  Game starts in
                </span>
                <SoftNum size={18} className="soft-num-auto">{countdown}s</SoftNum>
              </div>
            )}

            <div>
              <CandyLink href="/pro" color="amber" size="sm" icon={<Icon3D name="crown" size={16} />}>
                Go Pro for ad-free play
              </CandyLink>
            </div>
      </div>
    </div>
  );
}
