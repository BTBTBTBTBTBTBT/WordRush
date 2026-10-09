import {
  cleanInviteCode, isFriendCode, isVsCode, raceLine, type InviteLinkKind, type InviteVariant,
} from '@wordle-duel/core';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';

/**
 * Branded invites (FRIDAY-QUEUE 9f), server side: turn a code from a shared link into what the
 * preview image and the landing page show. Public by design and deliberately small: the sender's
 * name + mascot, the game and (for a race) the time to beat. Never ids. Uses PostgREST over
 * fetch with the service key so the same code runs in the Node page render and the Edge OG route.
 */

/** The cast ids that have a preview PNG (public/og/invite/cast-<id>.png). */
export const INVITE_CAST_IDS = ['w', 'c', 'i', 'd', 's', 'r', 'u', 'o1', 'o2', 'o3'] as const;

export interface InvitePreview {
  status: 'ok' | 'notfound' | 'expired' | 'closed';
  kind: InviteLinkKind;
  variant: InviteVariant;
  code: string;
  sender: string;
  /** Cast id for the sender's mascot (falls back to W). */
  castId: string;
  gameKey?: string;
  gameTitle?: string;
  raceLine?: string;
}

const MISSING = (kind: InviteLinkKind, code: string): InvitePreview => ({
  status: 'notfound', kind, variant: kind === 'friend' ? 'friend' : 'live', code, sender: 'A friend', castId: 'w',
});

async function rest<T>(table: string, query: string): Promise<T[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      // The OG route is cached at the CDN; the page is dynamic.
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    return (await res.json()) as T[];
  } catch {
    return null;
  }
}

async function senderOf(id: string): Promise<{ username: string; castId: string }> {
  const q = (cols: string) => `select=${cols}&id=eq.${encodeURIComponent(id)}&limit=1`;
  let rows = await rest<{ username: string | null; avatar_cast_id?: string | null }>('profiles', q('username,avatar_cast_id'));
  if (!rows) rows = await rest<{ username: string | null }>('profiles', q('username')); // column missing: name only
  const r = rows?.[0];
  const cast = r && 'avatar_cast_id' in r ? r.avatar_cast_id : null;
  return {
    username: r?.username ?? 'A friend',
    castId: cast && (INVITE_CAST_IDS as readonly string[]).includes(cast) ? cast : 'w',
  };
}

const gameTitle = (mode: string): string => MODE_BY_DBKEY[mode]?.title ?? mode;
const expired = (iso: string): boolean => new Date(iso).getTime() < Date.now();

export async function resolveInvitePreview(kind: InviteLinkKind, rawCode: string): Promise<InvitePreview> {
  const code = cleanInviteCode(rawCode);

  if (kind === 'friend') {
    if (!isFriendCode(code)) return MISSING(kind, code);
    const ref = (await rest<{ inviter_id: string; status: string; expires_at: string }>(
      'referrals', `select=inviter_id,status,expires_at&code=eq.${code}&limit=1`,
    ))?.[0];
    if (!ref) return MISSING(kind, code);
    const s = await senderOf(ref.inviter_id);
    const status = ref.status !== 'pending' ? 'closed' : expired(ref.expires_at) ? 'expired' : 'ok';
    return { status, kind, variant: 'friend', code, sender: s.username, castId: s.castId };
  }

  if (!isVsCode(code)) return MISSING(kind, code);
  // A live VS invite first, then a race-my-run challenge.
  const inv = (await rest<{ inviter_id: string; game_mode: string; status: string; expires_at: string }>(
    'match_invites', `select=inviter_id,game_mode,status,expires_at&invite_code=eq.${code}&limit=1`,
  ))?.[0];
  if (inv) {
    const s = await senderOf(inv.inviter_id);
    const status = inv.status !== 'pending' ? 'closed' : expired(inv.expires_at) ? 'expired' : 'ok';
    return { status, kind, variant: 'live', code, sender: s.username, castId: s.castId, gameKey: inv.game_mode, gameTitle: gameTitle(inv.game_mode) };
  }
  const ch = (await rest<{ challenger_id: string; game_mode: string; solved: boolean; guesses: number; time_ms: number; expires_at: string }>(
    'vs_challenges', `select=challenger_id,game_mode,solved,guesses,time_ms,expires_at&code=eq.${code}&limit=1`,
  ))?.[0];
  if (ch) {
    const s = await senderOf(ch.challenger_id);
    return {
      status: expired(ch.expires_at) ? 'expired' : 'ok', kind, variant: 'race', code, sender: s.username, castId: s.castId,
      gameKey: ch.game_mode, gameTitle: gameTitle(ch.game_mode),
      raceLine: raceLine({ solved: ch.solved, guesses: ch.guesses, timeMs: ch.time_ms }),
    };
  }
  return MISSING(kind, code);
}
