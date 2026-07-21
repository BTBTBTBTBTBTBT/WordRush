'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AD_CONFIG } from '@/lib/ads/ad-config';

/**
 * Injects the AdSense loader script ONLY for signed-in FREE users (and only
 * when ads are enabled at all). Previously the script lived as an
 * unconditional <Script> in layout.tsx — which loaded Google ads for
 * EVERYONE, including Pro. Two problems with that:
 *
 * 1. Pro promises "ad-free — no interruptions, ever"; loading the ad script
 *    for Pro users breaks the spirit of that (and Google may auto-inject).
 * 2. LIVE BUG (found 2026-07-21): with Auto ads enabled in the AdSense
 *    dashboard, adsbygoogle.js injects anchor/overlay ads that set an inline
 *    `transform` on <html>. A transformed ancestor becomes the containing
 *    block for position:fixed descendants — so the fixed BottomNav (and any
 *    fixed UI) silently detached from the viewport and scrolled with the
 *    page until refresh. Observed live on iOS Safari by a Pro user.
 *
 * Gating: wait for auth to resolve (`loading`), then load once for non-Pro.
 * The script is never removed once injected (Google doesn't support clean
 * unload) — flipping to Pro mid-session stops new pushes via AdBanner/AdGate,
 * and the next page load skips the script entirely.
 *
 * NOTE for free users: anchor/overlay Auto ads can still transform <html>.
 * If the detached-footer bug shows up for free users, disable "Overlay
 * formats" for the site in the AdSense dashboard (Ads → By site) and keep
 * manual slots + in-page formats only.
 */
export function AdSenseLoader() {
  const { user, loading, isProActive } = useAuth();
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current) return;
    if (loading) return; // don't decide until we know Pro status
    if (!user) return; // login screen — no ads
    if (isProActive) return; // Pro = ad-free, no Google script at all
    if (!AD_CONFIG.enabled || !AD_CONFIG.adSenseClientId) return; // ads not wired yet

    injected.current = true;
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CONFIG.adSenseClientId}`;
    document.head.appendChild(s);
  }, [user, loading, isProActive]);

  return null;
}
