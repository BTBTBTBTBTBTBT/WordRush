import type { Metadata } from 'next';
import Link from 'next/link';
import { buildCopy, MODE_ROUTE, type SP } from '@/lib/share-page-copy';

// Per-result share landing page. The Share button (lib/share-utils.ts, plus
// the iOS/Android ShareService mirrors) uploads the result PNG to the public
// `share-images` bucket and links here; this page emits Open Graph / Twitter-
// card tags whose og:image IS that exact PNG, so Messages/RCS link bubbles and
// Facebook / X / LinkedIn / Reddit render the finished puzzle (social scrapers
// refuse pre-attached image files and only scrape the shared URL's og:image).
//
// Title/description building lives in lib/share-page-copy.ts (pure, tested).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function imageUrl(key: string[]): string {
  return `${SUPABASE_URL}/storage/v1/object/public/share-images/${key.join('/')}.png`;
}

export async function generateMetadata(
  { params, searchParams }: { params: { key: string[] }; searchParams: SP },
): Promise<Metadata> {
  const key = params.key ?? [];
  const img = imageUrl(key);
  const { title, description } = buildCopy(searchParams, key);
  const w = Number(str(searchParams.w)) || 1080;
  const h = Number(str(searchParams.h)) || 1080;

  return {
    title,
    description,
    // iOS Smart App Banner with a deep link: the root layout sets the plain
    // app-id site-wide, but share pages pass their own URL as app-argument so
    // "Open" routes into the installed app via universal links
    // (wordocious.com paths are registered in the iOS app's entitlements).
    itunes: {
      appId: '6775966055',
      appArgument: `https://wordocious.com/s/${key.join('/')}`,
    },
    // Explicit images here override the root file-convention opengraph-image
    // for this route, so the shared card shows the puzzle, not the brand card.
    openGraph: {
      title,
      description,
      url: `https://wordocious.com/s/${key.join('/')}`,
      siteName: 'Wordocious',
      type: 'website',
      images: [{ url: img, width: w, height: h, alt: title, type: 'image/png' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [img],
    },
  };
}

export default function SharePage(
  { params, searchParams }: { params: { key: string[] }; searchParams: SP },
) {
  const key = params.key ?? [];
  const img = imageUrl(key);
  const { mode, modeDisp, stats, title } = buildCopy(searchParams, key);
  const playHref = MODE_ROUTE[mode] ?? '/';
  // Profile cards and unknown modes aren't playable — send those to the hub.
  const playable = mode in MODE_ROUTE && mode !== 'Profile';
  const ctaLabel = playable ? `Play ${modeDisp}` : 'Play today’s puzzles';

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 24,
        backgroundColor: 'var(--color-bg)',
      }}
    >
      <h1
        className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500"
        style={{ textAlign: 'center' }}
      >
        WORDOCIOUS
      </h1>
      <p className="text-sm font-bold" style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>
        {stats ? `${modeDisp} · ${stats}` : modeDisp}
      </p>

      {/* The result image (same PNG used for the share card). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img}
        alt={title}
        style={{
          maxWidth: 'min(92vw, 480px)',
          width: '100%',
          height: 'auto',
          borderRadius: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
        }}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href={playHref}
          className="px-6 py-3 rounded-xl text-white font-black"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
        >
          {ctaLabel}
        </Link>
        <Link
          href="/"
          className="px-6 py-3 rounded-xl font-black"
          style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)', color: '#7c3aed' }}
        >
          Wordocious Home
        </Link>
      </div>
    </main>
  );
}
