'use client';

import { useEffect, useRef } from 'react';
import { AD_CONFIG } from '@/lib/ads/ad-config';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdInterstitialProps {
  onAdLoaded?: () => void;
  onAdFailed?: () => void;
}

/**
 * Renders a Google AdSense in-article / display ad unit inside the interstitial overlay.
 * When AdSense credentials aren't configured yet, renders a branded placeholder.
 */
export function AdInterstitial({ onAdLoaded, onAdFailed }: AdInterstitialProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  const hasCredentials = AD_CONFIG.adSenseClientId && AD_CONFIG.interstitialSlotId;

  useEffect(() => {
    if (!hasCredentials || pushed.current) return;
    pushed.current = true;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      // AdSense doesn't provide a reliable loaded callback for display ads,
      // so we optimistically fire onAdLoaded after a short delay.
      const t = setTimeout(() => onAdLoaded?.(), 800);
      return () => clearTimeout(t);
    } catch {
      onAdFailed?.();
    }
  }, [hasCredentials, onAdLoaded, onAdFailed]);

  if (!hasCredentials) {
    // Placeholder shown while AdSense approval is pending
    return (
      <div
        className="w-full flex items-center justify-center rounded-xl"
        style={{
          background: 'linear-gradient(135deg, #f3f0ff, #ede9f6)',
          border: '1.5px dashed #d8d0f0',
          minHeight: '250px',
          maxWidth: '336px',
          margin: '0 auto',
        }}
      >
        <div className="text-center px-4">
          <div
            className="text-[10px] font-black uppercase tracking-widest mb-1"
            style={{ color: '#b8a9e0' }}
          >
            Advertisement
          </div>
          <div className="text-xs font-bold" style={{ color: '#9ca3af' }}>
            Ad space — coming soon
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center" style={{ maxWidth: '336px', margin: '0 auto' }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '300px', height: '250px' }}
        data-ad-client={AD_CONFIG.adSenseClientId}
        data-ad-slot={AD_CONFIG.interstitialSlotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
