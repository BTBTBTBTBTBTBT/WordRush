import { NextResponse } from 'next/server';
import { HOW_TO_PLAY } from '@/lib/how-to-play-content';

// The "How to Play" document for the native How to Play screen (iOS + Android),
// single-sourced in lib/how-to-play-content.ts so native matches the web page.
// 2.8 item 36: sections carry `games` (one entry per game). Apps from before that decode only `modes`,
// so each games section also ships its entries in that old shape (title + the lines run together).
export const runtime = 'edge';
export const revalidate = 86400;

export function GET() {
  const sections = HOW_TO_PLAY.map((s) => (s.games
    ? { ...s, modes: s.games.map((g) => ({ name: g.title, accent: g.accent, body: g.lines.join(' ') })) }
    : s));
  return NextResponse.json(
    { sections },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
