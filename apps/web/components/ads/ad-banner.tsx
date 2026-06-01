'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AD_CONFIG } from '@/lib/ads/ad-config';

/**
 * Fixed bottom banner ad for free users. Dormant unless ads are enabled AND a
 * banner slot is configured — so it renders nothing in production until
 * NEXT_PUBLIC_ADS_ENABLED=true + NEXT_PUBLIC_AD_BANNER_SLOT are set. Pro users
 * never see it.
 *
 * Note: this is a manually-placed banner. The lower-risk alternative is to
 * enable AdSense Auto ads → Anchor in the dashboard (the loader script is
 * already present), which positions/dismisses a bottom banner automatically.
 */
export function AdBanner() {
  const { isProActive } = useAuth();
  const pushed = useRef(false);

  const show =
    !isProActive &&
    AD_CONFIG.enabled &&
    !!AD_CONFIG.adSenseClientId &&
    !!AD_CONFIG.bannerSlotId;

  useEffect(() => {
    if (!show || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ignore */
    }
  }, [show]);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        display: 'flex',
        justifyContent: 'center',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '60px' }}
        data-ad-client={AD_CONFIG.adSenseClientId}
        data-ad-slot={AD_CONFIG.bannerSlotId}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </div>
  );
}
