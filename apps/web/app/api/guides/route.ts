import { NextResponse } from 'next/server';
import { MODE_GUIDES } from '@/lib/guide-content';

// Per-mode guide content for the native in-game "?" help sheet (iOS + Android
// fetch this so the prose stays single-sourced in guide-content.ts). Only the
// fields the sheet renders — facts/rules/scoring/tips — plus title/tagline/
// accent/slug; `related` ("Keep reading") and metaDescription are dropped.
export const runtime = 'edge';
export const revalidate = 86400; // content changes rarely; cache a day

export function GET() {
  const guides = MODE_GUIDES.map((g) => ({
    slug: g.slug,
    title: g.title,
    accent: g.accent,
    tagline: g.tagline,
    facts: g.facts,
    rules: g.rules,
    scoring: g.scoring,
    tips: g.tips,
  }));
  return NextResponse.json(
    { guides },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
