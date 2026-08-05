'use client';

import { useEffect, useState } from 'react';
import { X as XIcon } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

/**
 * Android install banner — the Play-side sibling of the iOS Smart App Banner
 * (which Safari renders natively from the `apple-itunes-app` meta tag in
 * app/layout.tsx; Android has no such built-in, so we draw our own).
 *
 * Renders ONLY when all of:
 *  - NEXT_PUBLIC_PLAY_STORE_URL is set and non-empty (it is UNSET until the
 *    Play listing goes public, so today this component renders nothing),
 *  - the user agent is Android,
 *  - we are NOT already inside the native app (Capacitor webview),
 *  - the user hasn't dismissed it (localStorage, remembered forever).
 *
 * LAUNCH DAY: set NEXT_PUBLIC_PLAY_STORE_URL to
 *   https://play.google.com/store/apps/details?id=com.wordocious.app
 * (applicationId from apps/android/app/build.gradle.kts) and redeploy.
 * No code change needed.
 *
 * Styling mirrors AnnouncementsBanner (announcements-banner.tsx) so the two
 * read as one system; this one anchors to the bottom so it can't collide with
 * an active announcement at the top.
 */

const DISMISSED_KEY = 'play-banner-dismissed';

export function PlayStoreBanner() {
  const playUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!playUrl) return;
    // Android browsers only — not iOS, not desktop.
    if (!/Android/i.test(navigator.userAgent)) return;
    // Not inside the native app's webview (Capacitor).
    try {
      if (Capacitor.isNativePlatform()) return;
    } catch {}
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {}
    setVisible(true);
  }, [playUrl]);

  if (!visible || !playUrl) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {}
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 px-3 pb-2 pointer-events-none">
      <div
        className="max-w-md mx-auto flex items-center gap-2.5 p-3 pointer-events-auto"
        style={{
          background: 'var(--color-surface)',
          border: '1.5px solid #c4b5fd',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(124, 58, 237, 0.18)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-192.png"
          alt=""
          width={36}
          height={36}
          style={{ borderRadius: '9px' }}
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-black text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
          >
            Wordocious
          </p>
          <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Get the Android app
          </p>
        </div>
        <a
          href={playUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-1.5 rounded-xl text-white text-sm font-black shrink-0"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
        >
          Get
        </a>
        <button onClick={dismiss} aria-label="Dismiss app install banner" className="p-0.5 shrink-0">
          <XIcon className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
        </button>
      </div>
    </div>
  );
}
