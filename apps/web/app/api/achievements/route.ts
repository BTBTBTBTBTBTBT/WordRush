import { NextResponse } from 'next/server';
import { ACHIEVEMENT_CATALOG } from '@/lib/achievement-service';

// The achievement catalog (display metadata only) for the native apps, which
// fetch + persist it so the list stays single-sourced in lib/achievement-service.ts.
// Each entry: key, name, description, category (beginner, consistency, skill,
// social, collection, puzzles, vs, bots, friends, pocket, mascot, seasonal,
// streaks), icon (the category badge; art-ach-<key> when shipped), optional xp,
// optional hidden (FINISH_SPEC BE: defined, not shown or awarded until its
// tracking ships). The earned list is the RLS-readable `achievements` table
// (achievement_key, unlocked_at) — the apps order unlocks by unlocked_at.
// Unlock DETECTION stays per-platform (it's key-string logic, independent of this
// array). Adding an achievement's display entry = edit ACHIEVEMENTS here.
export const runtime = 'edge';
export const revalidate = 300;

export function GET() {
  // Short client max-age so native apps pick up newly-shipped achievements
  // within minutes; the CDN still revalidates on a 5-min window.
  return NextResponse.json(
    { achievements: ACHIEVEMENT_CATALOG },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } },
  );
}
