'use client';

import { useEffect, useState } from 'react';
import { X as XIcon } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { candyClass } from '@/components/ui/candy-button';
import { HeaderCircle } from '@/components/ui/page-header';
import { alphaHex, cardBarStyle, softBackground, softBorder } from '@/lib/soft-surface';

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

  // K1 / G5: the same tinted notice card as AnnouncementsBanner (brand wash,
  // top bar), the candy GET button and the bare close X; slides up with a spring.
  const accent = '#7c3aed';
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 px-3 pb-2 pointer-events-none">
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
          className={candyClass({ color: 'purple', size: 'sm', extra: 'shrink-0' })}
        >
          Get
        </a>
        <HeaderCircle label="Dismiss app install banner" onClick={dismiss} size={32} className="absolute top-2 right-1">
          <XIcon aria-hidden="true" style={{ width: 18, height: 18, color: 'var(--color-win-text, #7c3aed)' }} strokeWidth={3.2} />
        </HeaderCircle>
      </div>
    </div>
  );
}
