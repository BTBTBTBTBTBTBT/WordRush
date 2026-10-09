import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { withAuthors } from '@/lib/admin/art-review-db';
import { parseFeedbackBody, parseFeedbackQuery, type ArtFeedback } from '@/lib/admin/art-review';
import { SOUND_FEEDBACK_COLUMNS } from '@/lib/admin/sound-review-db';

export const dynamic = 'force-dynamic';

const OPEN_LIMIT = 500;

/**
 * Sound feedback threads (the notes Claude reads before the next sound pass; also public.sound_open_feedback).
 * - ?asset_id=<id> or ?scope=<game:classic | event:app/intro>: that thread, oldest first -> { feedback }
 * - ?open=1: every unresolved item, newest first -> { feedback }
 */
export async function GET(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const q = parseFeedbackQuery(request.nextUrl.searchParams);
  if ('error' in q) return NextResponse.json({ error: q.error }, { status: 400 });

  const admin = getAdminSupabase();
  let query = admin.from('sound_feedback').select(SOUND_FEEDBACK_COLUMNS);
  if ('asset_id' in q) query = query.eq('asset_id', q.asset_id).order('created_at', { ascending: true });
  else if ('scope' in q) query = query.eq('scope', q.scope).order('created_at', { ascending: true });
  else query = query.is('resolved_at', null).order('created_at', { ascending: false }).limit(OPEN_LIMIT);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: await withAuthors(admin, (data ?? []) as Array<Omit<ArtFeedback, 'author'>>) });
}

/** Add feedback: { asset_id? | scope?, body } -> { item }. The author is the caller. */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;
  const me = auth.admin.id;
  if (!me) return NextResponse.json({ error: 'No author identity (set ART_LIBRARY_DEV_REVIEWER for local use)' }, { status: 403 });

  const parsed = parseFeedbackBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('sound_feedback')
    .insert({ asset_id: parsed.asset_id, scope: parsed.scope, body: parsed.body, author_id: me })
    .select(SOUND_FEEDBACK_COLUMNS)
    .single();
  if (error) {
    const unknownAsset = error.code === '23503' && /asset_id/.test(error.message + (error.details ?? ''));
    return NextResponse.json({ error: unknownAsset ? 'Unknown sound' : error.message }, { status: unknownAsset ? 404 : 500 });
  }
  const [item] = await withAuthors(admin, [data as Omit<ArtFeedback, 'author'>]);
  return NextResponse.json({ item });
}
