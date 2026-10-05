import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';

export const dynamic = 'force-dynamic';

/**
 * Stream one art_assets object from the private bucket, same-origin, so the
 * animation players (iframe sandbox="allow-scripts") and sound clips can load
 * with the admin cookie. HTML is served with a CSP sandbox as well, so even a
 * direct visit cannot run it with this origin's privileges.
 */
export async function GET(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: row, error } = await admin.from('art_assets').select('path, mime').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Unknown asset' }, { status: 404 });

  const { data: blob, error: dlError } = await admin.storage.from('art-library').download(row.path as string);
  if (dlError || !blob) return NextResponse.json({ error: dlError?.message ?? 'Download failed' }, { status: 502 });

  const mime = (row.mime as string) || 'application/octet-stream';
  const headers: Record<string, string> = {
    'Content-Type': mime === 'text/html' ? 'text/html; charset=utf-8' : mime,
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  };
  if (mime === 'text/html') headers['Content-Security-Policy'] = 'sandbox allow-scripts';

  // Safari's <audio> insists on byte ranges; the files are small, so slice in memory.
  const buf = new Uint8Array(await blob.arrayBuffer());
  headers['Accept-Ranges'] = 'bytes';
  const range = parseRange(request.headers.get('range'), buf.length);
  if (range) {
    const [start, end] = range;
    headers['Content-Range'] = `bytes ${start}-${end}/${buf.length}`;
    headers['Content-Length'] = String(end - start + 1);
    return new NextResponse(buf.slice(start, end + 1), { status: 206, headers });
  }
  headers['Content-Length'] = String(buf.length);
  return new NextResponse(buf, { status: 200, headers });
}

/** A single "bytes=a-b" / "bytes=a-" / "bytes=-n" range, clamped; null when absent or unusable. */
function parseRange(header: string | null, size: number): [number, number] | null {
  const m = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!m || size === 0 || (!m[1] && !m[2])) return null;
  let start: number;
  let end: number;
  if (!m[1]) {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  return start <= end && start < size ? [start, end] : null;
}
