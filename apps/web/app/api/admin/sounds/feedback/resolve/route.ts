import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { withAuthors } from '@/lib/admin/art-review-db';
import { parseResolveBody, type ArtFeedback } from '@/lib/admin/art-review';
import { SOUND_FEEDBACK_COLUMNS } from '@/lib/admin/sound-review-db';

export const dynamic = 'force-dynamic';

/** Resolve one sound feedback item: { id, note? } -> { item }. Resolving again just updates the note. */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const parsed = parseResolveBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('sound_feedback')
    .update({ resolved_at: new Date().toISOString(), resolved_by: auth.admin.id, resolved_note: parsed.note })
    .eq('id', parsed.id)
    .select(SOUND_FEEDBACK_COLUMNS)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Unknown feedback item' }, { status: 404 });
  const [item] = await withAuthors(admin, [data as Omit<ArtFeedback, 'author'>]);
  return NextResponse.json({ item });
}
