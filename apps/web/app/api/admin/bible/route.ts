import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

// The engineering bible, served to the admin dashboard so the latest entry
// can be read/copied without a repo checkout (Jasson pastes it into his own
// Claude). The file is copied into the app root at build time
// (scripts/copy-bible.mjs) and force-traced into this function's bundle
// (next.config.js outputFileTracingIncludes); in dev it falls back to the
// repo-root original so the route works without a build step.
function readBible(): string | null {
  for (const p of [
    path.join(process.cwd(), '.bible.md'),          // prod (copied at build)
    path.join(process.cwd(), '../../WORDOCIOUS_BIBLE.md'), // dev (repo checkout)
  ]) {
    try {
      return fs.readFileSync(p, 'utf8');
    } catch {
      /* try next */
    }
  }
  return null;
}

/** First "**(NNN) …" block — entries are newest-first below the header. */
function latestEntry(text: string): { number: number; text: string } | null {
  const start = text.search(/\*\*\(\d+\)/);
  if (start === -1) return null;
  const number = Number(/\*\*\((\d+)\)/.exec(text.slice(start))?.[1] ?? 0);
  const rest = text.slice(start);
  const next = rest.slice(4).search(/\n\*\*\(\d+\)/);
  return { number, text: (next === -1 ? rest : rest.slice(0, next + 4)).trim() };
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const text = readBible();
  if (!text) return NextResponse.json({ error: 'Bible not bundled in this deploy' }, { status: 404 });

  // ?download=1 — the bible as a real .md file. Exists for Jasson's workflow:
  // he feeds the bible to his own Claude, and his phone's share-sheet attach
  // kept uploading zero-byte files; downloading via Safari → Files → attach
  // from Files bypasses that path entirely.
  if (request.nextUrl.searchParams.get('download') === '1') {
    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="WORDOCIOUS_BIBLE.md"',
        'Cache-Control': 'private, no-store',
      },
    });
  }

  if (request.nextUrl.searchParams.get('full') === '1') {
    return NextResponse.json({ full: text, chars: text.length });
  }

  const updated = text.split('\n').find((l) => l.startsWith('*Last updated'))?.slice(0, 300) ?? '';
  const latest = latestEntry(text);
  return NextResponse.json({
    latest,
    updated,
    chars: text.length,
    entries: (text.match(/\*\*\(\d+\)/g) ?? []).length,
  });
}
