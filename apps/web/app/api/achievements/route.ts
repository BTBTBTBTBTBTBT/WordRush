import { NextResponse } from 'next/server';
import { ACHIEVEMENTS } from '@/lib/achievement-service';

// The achievement catalog (display metadata only) for the native apps, which
// fetch + persist it so the list stays single-sourced in lib/achievement-service.ts.
// Unlock DETECTION stays per-platform (it's key-string logic, independent of this
// array). Adding an achievement's display entry = edit ACHIEVEMENTS here.
export const runtime = 'edge';
export const revalidate = 300;

export function GET() {
  // Short client max-age so native apps pick up newly-shipped achievements
  // within minutes; the CDN still revalidates on a 5-min window.
  return NextResponse.json(
    { achievements: ACHIEVEMENTS },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } },
  );
}
