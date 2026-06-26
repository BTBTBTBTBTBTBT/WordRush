import { NextResponse } from 'next/server';
import { HOW_TO_PLAY } from '@/lib/how-to-play-content';

// The "How to Play" document for the native How to Play screen (iOS + Android),
// single-sourced in lib/how-to-play-content.ts so native matches the web page.
export const runtime = 'edge';
export const revalidate = 86400;

export function GET() {
  return NextResponse.json(
    { sections: HOW_TO_PLAY },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
