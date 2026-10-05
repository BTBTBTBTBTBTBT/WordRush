import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { isProvider, PROVIDERS } from '@/lib/admin/studio';

export const dynamic = 'force-dynamic';

/** Forget a provider's stored tokens: { provider } -> { ok }. (Revoke the app on the platform side too.) */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { provider?: unknown } | null;
  if (!isProvider(body?.provider)) return NextResponse.json({ error: 'provider must be meta, threads, pinterest, x or tiktok' }, { status: 400 });

  const { error } = await getAdminSupabase().from('social_accounts').delete().in('platform', PROVIDERS[body!.provider as keyof typeof PROVIDERS].platforms);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
