import { NextResponse } from 'next/server';
import { STRATEGY_ARTICLES } from '@/lib/strategy-content';

// Strategy articles for the native Strategy screen (iOS + Android fetch this so
// the prose stays single-sourced in strategy-content.ts). Mirrors /api/guides.
export const runtime = 'edge';
export const revalidate = 86400;

export function GET() {
  const articles = STRATEGY_ARTICLES.map((a) => ({
    slug: a.slug,
    title: a.title,
    dek: a.dek,
    minutes: a.minutes,
    sections: a.sections,
    related: a.related,
  }));
  return NextResponse.json(
    { articles },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
