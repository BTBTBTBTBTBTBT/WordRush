'use client';

// §219: the share landing is the biggest acquisition surface, and until both
// stores went live there was nowhere to send app-less arrivals. iOS Safari
// already shows the native Smart App Banner (layout.tsx `itunes`), but
// Android has no equivalent — so the landing now renders store badges:
// the visitor's own platform first (the other only on desktop).
import { useEffect, useState } from 'react';

const APP_STORE_URL = 'https://apps.apple.com/app/id6775966055';
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.wordocious.app';

function AppleGlyph() {
  return (
    <svg width="20" height="24" viewBox="0 0 384 512" aria-hidden="true">
      <path
        fill="currentColor"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg width="20" height="22" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="#00d9ff" d="M48 32 288 256 48 480c-9.8-6.7-16-18-16-30.7V62.7C32 50 38.2 38.7 48 32z" />
      <path fill="#ffd400" d="M288 256 48 32c5-3.4 11-5.4 17.5-5.4 5.6 0 11.2 1.5 16.2 4.4l286.4 165.5L288 256z" />
      <path fill="#ff3a44" d="m288 256 80.1 59.5L81.7 481c-5 2.9-10.6 4.4-16.2 4.4-6.5 0-12.5-2-17.5-5.4l240-224z" />
      <path fill="#00f076" d="m368.1 196.5 77.6 44.8c10.3 6 16.3 16.6 16.3 28.7s-6 22.7-16.3 28.7l-77.6 44.8L288 256l80.1-59.5z" />
    </svg>
  );
}

function Badge({ href, glyph, kicker, store }: {
  href: string; glyph: React.ReactNode; kicker: string; store: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-4 py-2 rounded-xl"
      style={{ background: '#111827', color: '#ffffff', border: '1.5px solid #374151' }}
    >
      {glyph}
      <span className="flex flex-col leading-tight text-left">
        <span className="text-[9px] font-bold opacity-80">{kicker}</span>
        <span className="text-sm font-black">{store}</span>
      </span>
    </a>
  );
}

export function GetAppBadges() {
  // null until mounted: user-agent detection is client-only, and rendering
  // nothing at SSR avoids a hydration mismatch.
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other' | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) setPlatform('ios');
    else if (/Android/i.test(ua)) setPlatform('android');
    else setPlatform('other');
  }, []);
  if (!platform) return null;

  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      {platform !== 'android' && (
        <Badge href={APP_STORE_URL} glyph={<AppleGlyph />} kicker="Download on the" store="App Store" />
      )}
      {platform !== 'ios' && (
        <Badge href={PLAY_URL} glyph={<PlayGlyph />} kicker="Get it on" store="Google Play" />
      )}
    </div>
  );
}
