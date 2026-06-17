import { NextResponse } from 'next/server';
import { ACHIEVEMENTS } from '@/lib/achievement-service';

// The achievement catalog (display metadata only) for the native apps, which
// fetch + persist it so the list stays single-sourced in lib/achievement-service.ts.
// Unlock DETECTION stays per-platform (it's key-string logic, independent of this
// array). Adding an achievement's display entry = edit ACHIEVEMENTS here.
export const runtime = 'edge';
export const revalidate = 86400;

export function GET() {
  return NextResponse.json(
    { achievements: ACHIEVEMENTS },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
