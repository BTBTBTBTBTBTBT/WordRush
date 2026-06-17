import type { Metadata } from 'next';
import Link from 'next/link';

// Per-result share landing page. The Share button (lib/share-utils.ts) uploads
// the result PNG to the public `share-images` bucket and links here; this page
// emits Open Graph / Twitter-card tags whose og:image IS that exact PNG, so
// Facebook / X / LinkedIn / Reddit render the finished puzzle (they refuse
// pre-attached image files and only scrape the shared URL's og:image).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

const MODE_DISPLAY: Record<string, string> = {
  Six: 'Classic Six',
  Seven: 'Classic Seven',
  ProperNoundle: 'ProperNoundle',
  DailySweep: 'Daily Sweep',
};

// Map a share mode back to its play route so the CTA sends visitors to it.
const MODE_ROUTE: Record<string, string> = {
  Classic: '/practice',
  QuadWord: '/quordle',
  OctoWord: '/octordle',
  Succession: '/sequence',
  Deliverance: '/rescue',
  Gauntlet: '/gauntlet',
  ProperNoundle: '/propernoundle',
  Six: '/six',
  Seven: '/seven',
  DailySweep: '/daily',
};

type SP = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function imageUrl(key: string[]): string {
  return `${SUPABASE_URL}/storage/v1/object/public/share-images/${key.join('/')}.png`;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function buildCopy(sp: SP) {
  const mode = str(sp.m) ?? 'Wordocious';
  const modeDisp = MODE_DISPLAY[mode] ?? mode;

  // All-dailies share card has its own copy shape (X/9 won · time · pts).
  if (mode === 'DailySweep') {
    const flawless = str(sp.sweep) === 'flawless';
    const w = Number(str(sp.won)) || 0;
    const tot = Number(str(sp.tot)) || 9;
    const t = Number(str(sp.t)) || 0;
    const pts = Number(str(sp.pts)) || 0;
    const label = flawless ? 'Flawless Victory' : 'Daily Sweep';
    const stats = `${w}/${tot} won · ${fmtTime(t)} · ${pts.toLocaleString()} pts`;
    const title = `Wordocious ${label} — ${stats}`;
    const description = flawless
      ? `I won all ${tot} daily puzzles on Wordocious (${stats}). Can you go flawless?`
      : `I completed all ${tot} daily puzzles on Wordocious (${stats}). Think you can sweep them?`;
    return { mode, modeDisp: label, won: w >= tot, stats, title, description };
  }

  const won = str(sp.won) === '1';
  const g = Number(str(sp.g)) || 0;
  const mg = Number(str(sp.mg)) || 0;
  const t = Number(str(sp.t)) || 0;
  const guessDisp = won ? `${g}/${mg}` : `X/${mg}`;
  const statsBits: string[] = [];
  if (str(sp.bs) && str(sp.tb)) statsBits.push(`${str(sp.bs)}/${str(sp.tb)} boards`);
  if (str(sp.sc) && str(sp.ts)) statsBits.push(`${str(sp.sc)}/${str(sp.ts)} stages`);
  statsBits.push(guessDisp, fmtTime(t));
  const stats = statsBits.join(' · ');

  const title = `Wordocious ${modeDisp} — ${won ? 'Solved' : 'Played'} ${stats}`;
  const description = won
    ? `I solved ${modeDisp} on Wordocious (${stats}). Think you can beat it?`
    : `I played ${modeDisp} on Wordocious. Think you can solve it?`;
  return { mode, modeDisp, won, stats, title, description };
}

export async function generateMetadata(
  { params, searchParams }: { params: { key: string[] }; searchParams: SP },
): Promise<Metadata> {
  const key = params.key ?? [];
  const img = imageUrl(key);
  const { title, description } = buildCopy(searchParams);
  const w = Number(str(searchParams.w)) || 1080;
  const h = Number(str(searchParams.h)) || 1080;

  return {
    title,
    description,
    // Explicit images here override the root file-convention opengraph-image
    // for this route, so the shared card shows the puzzle, not the brand card.
    openGraph: {
      title,
      description,
      url: `https://wordocious.com/s/${key.join('/')}`,
      siteName: 'Wordocious',
      type: 'website',
      images: [{ url: img, width: w, height: h, alt: title }],
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
  const { mode, modeDisp, stats, title } = buildCopy(searchParams);
  const playHref = MODE_ROUTE[mode] ?? '/';

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
        {modeDisp} · {stats}
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
          Play {modeDisp}
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
