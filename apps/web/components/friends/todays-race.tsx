'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Swords, Flag } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { SWEEP_MODES } from '@/lib/modes.generated';
import { challengeFriend, type FriendProfile } from '@/lib/friends-service';
import { vsHrefForMode } from '@/lib/invite-service';
import { rankToday, raceStatusLine } from '@/lib/todays-race';
import { Avatar } from './friends-panel';

// TODAY'S RACE — the top of the Friends tab (Stats + Friends redesign D3,
// founder 2026-09-26: "real ideas … real reasons to tap"). You and every
// friend ranked by today's daily points, live as results land (the digest
// refreshes the moment you finish a daily — beatCheck). Every row has a
// reason to tap: Challenge (a private Classic VS Battle, pushed to the friend,
// free for friends) and the bell for a friend who hasn't played yet. Tapping
// the row opens their profile. iOS TodaysRaceCard / Android TodaysRaceCard
// are the twins; `lib/todays-race.ts` holds the shared ranking.

interface Props {
  friends: FriendProfile[];
  me: { id: string; username: string; avatar_url: string | null; avatar_emoji: string | null; level: number; todayPoints: number; playedToday: number } | null;
  onTaunt: (f: FriendProfile) => void;
  onNote: (text: string) => void;
}

export function TodaysRace({ friends, me, onTaunt, onNote }: Props) {
  const router = useRouter();
  const [challenging, setChallenging] = useState<string | null>(null);
  if (!me || friends.length === 0) return null;

  const rows = rankToday([
    ...friends.map((f) => ({ id: f.id, username: f.username, points: f.todayPoints ?? 0, played: f.playedToday ?? 0, me: false })),
    { id: me.id, username: me.username, points: me.todayPoints, played: me.playedToday, me: true },
  ]);
  const byId = new Map(friends.map((f) => [f.id, f]));
  const status = raceStatusLine(rows);
  const anyPoints = rows.some((r) => r.points > 0);

  const challenge = async (f: FriendProfile) => {
    if (challenging) return;
    setChallenging(f.id);
    try {
      const r = await challengeFriend(f.id, 'DUEL');
      if ('error' in r) { onNote(r.error); return; }
      onNote(`Challenge sent to ${f.username} ⚔️`);
      // Into the private lobby with the code — the friend's push lands on /vs/join/<code>.
      router.push(`${vsHrefForMode('DUEL')}?inviteCode=${r.code}`);
    } finally {
      setChallenging(null);
    }
  };

  return (
    <div className="overflow-hidden" style={{ background: '#ffffff', borderRadius: 14, boxShadow: '0 2px 10px rgba(76,29,149,0.07)' }}>
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Flag className="w-4 h-4" style={{ color: '#db2777' }} />
            <span className="text-[11px] font-black uppercase" style={{ color: '#6b7280', letterSpacing: 1.2 }}>Today&apos;s Race</span>
          </div>
          <span className="text-[10px] font-black" style={{ color: anyPoints ? '#9d174d' : '#6b7280' }}>{status}</span>
        </div>
        <div className="space-y-1.5">
          {rows.map((r) => {
            const f = r.me ? null : byId.get(r.id);
            const rowHref = r.me ? '/stats' : `/profile/${r.id}`;
            const medal = anyPoints && r.points > 0 ? ['🥇', '🥈', '🥉'][r.rank - 1] : undefined;
            return (
              <div
                key={r.id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl"
                style={{ background: r.me ? '#fce7f3' : 'transparent', boxShadow: r.me ? '0 0 0 2px #db2777' : undefined }}
              >
                <span className="w-6 shrink-0 text-center text-[11px] font-black" style={{ color: '#6b7280' }}>
                  {medal ?? `${r.rank}`}
                </span>
                <Link href={rowHref} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                  {f
                    ? <Avatar f={f} />
                    : <Avatar f={{ id: me.id, username: me.username, avatar_url: me.avatar_url, avatar_emoji: me.avatar_emoji, level: me.level }} />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-extrabold truncate" style={{ color: r.me ? '#831843' : '#1f2937' }}>
                      {r.me ? 'You' : r.username}
                    </span>
                    <span className="block text-[10px] font-bold truncate" style={{ color: '#6b7280' }}>
                      {r.points > 0
                        ? `${r.points.toLocaleString()} pts · ${r.played}/${SWEEP_MODES.length} dailies`
                        : "hasn't played today"}
                    </span>
                  </span>
                </Link>
                {f && (
                  <>
                    {r.points === 0 && (
                      <button
                        onClick={() => onTaunt(f)}
                        aria-label={`Nudge ${f.username}`}
                        className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-transform shrink-0"
                        style={{ background: '#fce7f3' }}
                      >
                        <Icon3D name="bell" size={17} />
                      </button>
                    )}
                    <button
                      onClick={() => challenge(f)}
                      disabled={challenging !== null}
                      aria-label={`Challenge ${f.username} to a VS Battle`}
                      className="flex items-center gap-1 px-2.5 rounded-full text-[10.5px] font-black shrink-0 active:scale-95 transition-transform"
                      style={{ height: 28, background: '#fce7f3', color: '#9d174d', opacity: challenging && challenging !== f.id ? 0.5 : 1 }}
                    >
                      <Swords className="w-3 h-3" /> {challenging === f.id ? 'Sending…' : 'Challenge'}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[9px] font-bold mt-2 text-center" style={{ color: '#6b7280' }}>
          Today&apos;s points across every daily · Challenge = a private Classic battle, free for friends
        </p>
      </div>
    </div>
  );
}
