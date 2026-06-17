import { NextResponse } from 'next/server';
import { FAQ_SECTIONS, HELP_MODES, HELP_FAQ, ABOUT_SECTIONS, SUPPORT_SECTIONS } from '@/lib/content/static-content';

// Single-sourced static copy (FAQ / Help / About / Support) for the native apps,
// which fetch + persist this so the prose stays in one place (lib/content/
// static-content.ts). Mirrors /api/guides. Privacy + Terms are intentionally
// excluded — they stay hardcoded per platform for offline / pre-sign-in.
export const runtime = 'edge';
export const revalidate = 86400; // copy changes rarely; cache a day

export function GET() {
  return NextResponse.json(
    {
      faq: FAQ_SECTIONS,
      helpModes: HELP_MODES,
      helpFaq: HELP_FAQ,
      about: ABOUT_SECTIONS,
      support: SUPPORT_SECTIONS,
    },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
