'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BRANDED_INVITES_SWITCH, raceLine } from '@wordle-duel/core';
import { CastButton } from '@/components/ui/cast-button';
import { PlayerAvatar } from '@/components/avatar/player-avatar';
import { GREEN_CANDY } from '@/components/friends/invite-screens';
import { useFlags } from '@/hooks/use-flags';
import { fetchPendingInvitesForUser, lookupUsernames, markInviteDeclined } from '@/lib/invite-service';
import { fetchVsChallenges } from '@/lib/vs-challenges-client';
import { buildInviteRows, loadDismissed, saveDismissed, type InviteRow } from '@/lib/invites-row';
import { modeTitle } from '@/lib/vs-lobby';
import { SOFT_INK, softMix } from '@/lib/soft-surface';

/**
 * The Invites row (FRIDAY-QUEUE 9f): everything waiting on you in one place: live VS invites sent to you
 * and race-my-run challenges, newest first, each with the sender's mascot, "Johnny challenges you to
 * CLASSIC", the run to beat, and family Accept / Decline buttons. Renders nothing when there are none.
 * Self-contained: the VS lobby and the Friends tab each place <InvitesRow userId={...} />.
 * Compact, symmetric, no bordered box (a soft wash only). Hidden when branded_invites is off.
 */
const SHOWN = 3;

export function InvitesRow({ userId, screen = 'blue' }: { userId: string | undefined; screen?: 'blue' | 'pink' }) {
  const router = useRouter();
  const { isLive } = useFlags();
  const [rows, setRows] = useState<InviteRow[]>([]);

  const load = useCallback(async () => {
    if (!userId) { setRows([]); return; }
    const [live, ch] = await Promise.all([fetchPendingInvitesForUser(userId).catch(() => []), fetchVsChallenges()]);
    const names = await lookupUsernames(Array.from(new Set(live.map((i) => i.inviter_id)))).catch(() => ({} as Record<string, string>));
    setRows(buildInviteRows({
      live: live.map((i) => ({ id: i.id, code: i.invite_code, gameMode: i.game_mode, inviterId: i.inviter_id, sender: names[i.inviter_id] ?? 'A friend', createdAt: i.created_at })),
      races: ch.incoming.map((c) => ({
        code: c.code, gameMode: c.gameMode, challengerId: c.challenger.id, sender: c.challenger.username, createdAt: c.createdAt,
        raceLine: raceLine({ solved: c.run.solved, guesses: c.run.guesses, timeMs: c.run.timeMs }),
      })),
      dismissed: loadDismissed(),
    }));
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  if (!isLive(BRANDED_INVITES_SWITCH) || rows.length === 0) return null;

  const accept = (r: InviteRow) => router.push(r.variant === 'race' ? `/vs/challenge/${r.code}` : `/vs/join/${r.code}`);
  const decline = async (r: InviteRow) => {
    if (r.variant === 'live' && r.inviteId) await markInviteDeclined(r.inviteId);
    else saveDismissed([...loadDismissed(), r.code]);
    setRows((prev) => prev.filter((x) => x.key !== r.key));
  };

  return (
    <section aria-label="Invites" className="space-y-1.5">
      <p className="text-[11px] font-black tracking-wider px-1" style={{ color: SOFT_INK.label }}>
        INVITES{rows.length > SHOWN ? ` · ${rows.length}` : ''}
      </p>
      {rows.slice(0, SHOWN).map((r) => (
        <div key={r.key} className="notice-in flex items-center gap-2.5 px-3 py-2" style={{ background: softMix('#8b5cf6', 0.1), borderRadius: 16 }}>
          <PlayerAvatar name={r.sender} userId={r.senderId} size={38} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black leading-snug truncate" style={{ color: SOFT_INK.num }}>
              @{r.sender} challenges you to {modeTitle(r.gameMode)}
            </p>
            <p className="text-[11px] font-extrabold truncate" style={{ color: SOFT_INK.label }}>
              {r.variant === 'race' ? `Beat: ${r.raceLine}` : 'Live match'}
            </p>
          </div>
          <CastButton screen={screen} size="sm" color="peach" onClick={() => void decline(r)} aria-label={`Decline @${r.sender}'s invite`} className="shrink-0">Decline</CastButton>
          <CastButton screen={screen} size="sm" icon="check" onClick={() => accept(r)} aria-label={`Accept @${r.sender}'s invite and play`} className="shrink-0" style={GREEN_CANDY}>Accept</CastButton>
        </div>
      ))}
    </section>
  );
}
