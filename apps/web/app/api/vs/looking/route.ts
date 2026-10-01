import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/friends-server';
import { broadcastPush } from '@/lib/push/broadcast';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { isProActive } from '@/lib/pro';
import { VS_MODES, isPro } from '@/lib/vs-challenges-server';

export const dynamic = 'force-dynamic';

const SEND_GAP_MS = 10 * 60 * 1000;
const RECEIVE_GAP_MS = 30 * 60 * 1000;
const MAX_RECIPIENTS = 50;

/**
 * POST /api/vs/looking { gameMode } — "ping me when someone's looking"
 * (VS overhaul spec §13). A Pro player waiting in the live queue taps KEEP
 * WAITING; every Pro player who switched the ping on
 * (profiles.notification_prefs.vsLooking === true; a missing key means OFF)
 * gets a push that drops them straight into that mode's live queue.
 * Throttled per sender (10 min) and per recipient (30 min) through
 * vs_looking_pings. Returns { pinged, throttled }.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  let body: { gameMode?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const gameMode = body.gameMode ?? '';
  if (!VS_MODES.has(gameMode)) return NextResponse.json({ error: 'A VS gameMode is required' }, { status: 400 });

  const admin = getAdminSupabase();
  if (!(await isPro(admin, me))) return NextResponse.json({ error: 'Live VS is a Pro feature' }, { status: 403 });

  const now = Date.now();
  const { data: mine } = await admin.from('vs_looking_pings').select('last_sent_at').eq('user_id', me).maybeSingle();
  if (mine?.last_sent_at && now - new Date(mine.last_sent_at).getTime() < SEND_GAP_MS) {
    return NextResponse.json({ pinged: 0, throttled: true });
  }

  const { data: subs } = await admin
    .from('profiles')
    .select('id, is_pro, pro_expires_at')
    .eq('notification_prefs->>vsLooking', 'true')
    .neq('id', me)
    .limit(500);
  const candidates = (subs ?? []).filter((p: any) => isProActive(p)).map((p: any) => p.id as string);

  let recipients: string[] = [];
  if (candidates.length > 0) {
    const { data: pings } = await admin.from('vs_looking_pings').select('user_id, last_received_at').in('user_id', candidates);
    const recent = new Set(
      (pings ?? [])
        .filter((p: any) => p.last_received_at && now - new Date(p.last_received_at).getTime() < RECEIVE_GAP_MS)
        .map((p: any) => p.user_id as string),
    );
    recipients = candidates.filter((id) => !recent.has(id)).slice(0, MAX_RECIPIENTS);
  }

  const stamp = new Date(now).toISOString();
  // Two upserts with one column each: a mixed batch would null the other timestamp.
  await admin.from('vs_looking_pings').upsert({ user_id: me, last_sent_at: stamp }, { onConflict: 'user_id' });
  if (recipients.length > 0) {
    await admin.from('vs_looking_pings').upsert(recipients.map((id) => ({ user_id: id, last_received_at: stamp })), { onConflict: 'user_id' });
  }

  if (recipients.length > 0) {
    const { data: meProf } = await admin.from('profiles').select('username').eq('id', me).maybeSingle();
    const title = MODE_BY_DBKEY[gameMode]?.title ?? gameMode;
    void broadcastPush(
      {
        title: `Someone's looking for a ${title} match`,
        body: `${meProf?.username ?? 'A player'} is waiting in VS right now. Tap to race them live.`,
        url: `/vs/live/${gameMode}`,
      },
      new Set(recipients),
    ).catch(() => {});
  }

  return NextResponse.json({ pinged: recipients.length, throttled: false });
}
