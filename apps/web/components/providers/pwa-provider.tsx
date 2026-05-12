'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Download } from 'lucide-react';

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

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg"
      style={{
        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        boxShadow: '0 8px 24px rgba(124,58,237,0.3)',
      }}
      role="alert"
    >
      <Download className="w-5 h-5 text-white shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-white">Install Wordocious</p>
        <p className="text-[10px] font-bold text-white/70">Add to home screen for the best experience</p>
      </div>
      <button
        onClick={handleInstall}
        className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black"
        style={{ background: 'white', color: '#7c3aed' }}
        aria-label="Install Wordocious app"
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded-full"
        style={{ background: 'rgba(255,255,255,0.2)' }}
        aria-label="Dismiss install prompt"
      >
        <X className="w-3.5 h-3.5 text-white" />
      </button>
    </div>
  );
}
