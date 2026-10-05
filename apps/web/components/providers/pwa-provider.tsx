'use client';

import { useEffect, useState, useCallback } from 'react';
import { CandyButton } from '@/components/ui/candy-button';
import { HeaderCircle } from '@/components/ui/page-header';
import { alphaHex, cardBarStyle, softBackground, softBorder } from '@/lib/soft-surface';
import { FamCloseGlyph } from '@/components/ui/family-button';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaProvider() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem('pwa-banner-dismissed');
      if (!dismissed) setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowBanner(false);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', '1');
  }, []);

  if (!showBanner) return null;

  // K1 / G5: the same tinted notice card as the Play Store banner and
  // AnnouncementsBanner (brand wash, top bar, app icon, candy Install, the bare
  // close X); slides up with a spring. Sits above the bottom nav.
  const accent = '#7c3aed';
  return (
    <div className="fixed bottom-20 inset-x-0 z-50 px-3 pointer-events-none" role="alert">
      <div
        className="relative max-w-md mx-auto flex items-center gap-2.5 p-2.5 pt-3.5 pr-10 pointer-events-auto overflow-hidden notice-in-bottom"
        style={{
          background: softBackground(accent, 0.14),
          border: softBorder(accent, 0.14),
          borderRadius: 20,
          boxShadow: `0 10px 28px ${alphaHex(accent, 0.24)}`,
        }}
      >
        <div aria-hidden="true" className="absolute left-0 right-0 top-0" style={cardBarStyle(accent, 6)} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={36} height={36} style={{ borderRadius: '9px' }} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black leading-tight" style={{ color: 'var(--color-text)' }}>Install Wordocious</p>
          <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Add it to your home screen for the best experience</p>
        </div>
        <CandyButton size="sm" color="purple" onClick={handleInstall} className="shrink-0" aria-label="Install Wordocious app">
          Install
        </CandyButton>
        <HeaderCircle label="Dismiss install prompt" onClick={handleDismiss} size={32} className="absolute top-2 right-1">
          <FamCloseGlyph />
        </HeaderCircle>
      </div>
    </div>
  );
}
