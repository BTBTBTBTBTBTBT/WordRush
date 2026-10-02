import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/friends-server';
import { toView } from '@/lib/vs-challenges-server';
import { selectWithAvatarColumns } from '@/lib/avatar-fields-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vs/challenges/<code> — one challenge to race: the mode, seed and
 * the challenger's run (the ghost replays its pace). Open to the challenger,
 * the listed friends, and anyone signed in when it was sent as a link.
 * `entry` is the caller's own result if they already raced it; `expired`
 * when the 24 hours are up.
 */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;
  const { code } = params;
  const admin = getAdminSupabase();

  const { data: row } = await admin.from('vs_challenges').select('*').eq('code', (code ?? '').toUpperCase()).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
  const allowed = row.challenger_id === me || row.is_link || (row.invitee_ids ?? []).includes(me);
  if (!allowed) return NextResponse.json({ error: 'This challenge was sent to someone else' }, { status: 403 });

  const [{ data: prof }, { data: entry }] = await Promise.all([
    // + is_pro / avatar columns for FINISH_SPEC AH/AN3 (tolerant while the avatar columns are missing).
    selectWithAvatarColumns((extra) => admin.from('profiles').select(`username, avatar_url${extra}`).eq('id', row.challenger_id).maybeSingle()),
    admin.from('vs_challenge_entries').select('*').eq('challenge_id', row.id).eq('user_id', me).maybeSingle(),
  ]);

  return NextResponse.json({
    challenge: toView(row, prof),
    isMine: row.challenger_id === me,
    expired: new Date(row.expires_at).getTime() <= Date.now(),
    entry: entry
      ? { outcome: entry.outcome, solved: entry.solved, boardsSolved: entry.boards_solved, guesses: entry.guesses, timeMs: entry.time_ms, guessLog: entry.guess_log ?? [] }
      : null,
  });
}
