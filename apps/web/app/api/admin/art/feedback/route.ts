import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { FEEDBACK_COLUMNS, withAuthors } from '@/lib/admin/art-review-db';
import { parseFeedbackBody, parseFeedbackQuery, type ArtFeedback } from '@/lib/admin/art-review';

export const dynamic = 'force-dynamic';

const OPEN_LIMIT = 500;

/**
 * Art feedback threads.
 * - ?asset_id=<id> or ?scope=<kind:name>: that thread, oldest first, resolved items included -> { feedback }
 * - ?open=1: every unresolved item, newest first, with { asset: { id, path, title, season } } -> { feedback }
 */
export async function GET(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const q = parseFeedbackQuery(request.nextUrl.searchParams);
  if ('error' in q) return NextResponse.json({ error: q.error }, { status: 400 });

  const admin = getAdminSupabase();
  let query = admin.from('art_feedback').select(FEEDBACK_COLUMNS);
  if ('asset_id' in q) query = query.eq('asset_id', q.asset_id).order('created_at', { ascending: true });
  else if ('scope' in q) query = query.eq('scope', q.scope).order('created_at', { ascending: true });
  else query = query.is('resolved_at', null).order('created_at', { ascending: false }).limit(OPEN_LIMIT);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const feedback = await withAuthors(admin, (data ?? []) as Array<Omit<ArtFeedback, 'author'>>);

  if (!('open' in q)) return NextResponse.json({ feedback });

  const assetIds = Array.from(new Set(feedback.map((f) => f.asset_id).filter((x): x is string => !!x)));
  const assets = new Map<string, { id: string; path: string; title: string; season: string | null }>();
  if (assetIds.length) {
    const { data: rows, error: aErr } = await admin.from('art_assets').select('id, path, title, season').in('id', assetIds);
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
    for (const a of (rows ?? []) as Array<{ id: string; path: string; title: string; season: string | null }>) assets.set(a.id, a);
  }
  return NextResponse.json({ feedback: feedback.map((f) => ({ ...f, asset: f.asset_id ? assets.get(f.asset_id) ?? null : null })) });
}

/** Add feedback: { asset_id? | scope?, body } -> { item }. The author is the caller (ART_LIBRARY_DEV_REVIEWER under the dev bypass). */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;
  const me = auth.admin.id;
  if (!me) return NextResponse.json({ error: 'No author identity (set ART_LIBRARY_DEV_REVIEWER for local use)' }, { status: 403 });

  const parsed = parseFeedbackBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('art_feedback')
    .insert({ asset_id: parsed.asset_id, scope: parsed.scope, body: parsed.body, author_id: me })
    .select(FEEDBACK_COLUMNS)
    .single();
  if (error) {
    const unknownAsset = error.code === '23503' && /asset_id/.test(error.message + (error.details ?? ''));
    return NextResponse.json({ error: unknownAsset ? 'Unknown asset' : error.message }, { status: unknownAsset ? 404 : 500 });
  }
  const [item] = await withAuthors(admin, [data as Omit<ArtFeedback, 'author'>]);
  return NextResponse.json({ item });
}
