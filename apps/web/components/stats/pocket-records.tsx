'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
  CAST_COLORS, FRIENDLY_TITLES, headToHeadLine, pickerSplit,
  type PocketRecord, type PocketRecords,
} from '@wordle-duel/core';
import { PocketArt } from '@/components/ui/game-art';
import { FriendAvatar } from '@/components/friends/friends-ui';
import { RecordBar } from '@/components/stats/stat-hero';
import { SoftNum } from '@/components/ui/soft-number';
import { SectionHeader } from '@/components/profile/stat-kit';
import { GameSquare } from '@/components/ui/game-tile';
import { loadFriends, getFriends, onFriendsChange, type FriendProfile } from '@/lib/friends-service';
import { profileApiHeaders } from '@/lib/profile-social';
import { softCard } from '@/lib/soft-surface';
import { BubbleOneLine } from '@/components/ui/bubble-text';
import { playerNameColor } from '@/lib/player-tint';
import Link from 'next/link';

// FRIDAY-QUEUE item 16 (founder 10-07): pocket games get stats too — a POCKET GAMES section (one tile per game,
// the record vs friends, Word Chain's best run) and per-friend records in HEAD TO HEAD. The numbers come from the
// server's finished friendly_games rows through core pocketRecords (api/friends/pocket-records), the same ones the
// Friends cards and a friend's profile strip show, so the pages agree.

/** The caller's pocket-game records; null while loading or signed out. */
export function usePocketRecords(enabled = true): PocketRecords | null {
  const { data } = useSWR(enabled ? 'pocket-records' : null, async () => {
    const r = await fetch('/api/friends/pocket-records', { headers: await profileApiHeaders() });
    return r.ok ? ((await r.json()) as PocketRecords) : null;
  }, { revalidateOnFocus: true });
  return data ?? null;
}

const EMPTY: PocketRecord = { wins: 0, losses: 0, draws: 0 };
const played = (r: PocketRecord) => r.wins + r.losses + r.draws > 0;

/** The six pocket games with the player's record in each. A fresh player sees the tiles with "No games yet". */
export function PocketGamesSection({ records }: { records: PocketRecords | null }) {
  const kinds = records?.byKind ?? null;
  return (
    <div className="animate-fade-in-up">
      <SectionHeader label="Pocket Games" accent={CAST_COLORS.S} />
      <div className="grid grid-cols-3 gap-2">
        {(kinds ?? Array.from({ length: 6 }, (_, i) => ({ kind: (['rps', 'ttt', 'coin', 'pass', 'ghost', 'chain'] as const)[i], ...EMPTY, bestChain: 0 }))).map((k) => (
          <div key={k.kind} className="flex flex-col items-center text-center px-1 py-2.5 min-w-0" style={softCard(CAST_COLORS.S, { radius: 16 })}>
            <PocketArt kind={k.kind} size={40} />
            <div className="text-[10px] font-black leading-tight mt-1 truncate max-w-full" style={{ color: 'var(--color-text)' }}>{FRIENDLY_TITLES[k.kind]}</div>
            <SoftNum size={14} as="div" className="soft-num-auto leading-tight mt-0.5">{kinds ? (played(k) ? `${k.wins}–${k.losses}` : '—') : '…'}</SoftNum>
            <div className="text-[9px] font-extrabold h-[11px] truncate max-w-full" style={{ color: 'var(--color-text-muted)' }}>
              {kinds && played(k) ? (k.kind === 'chain' && k.bestChain > 0 ? `best ${k.bestChain}` : k.draws > 0 ? `${k.draws} ${k.draws === 1 ? 'draw' : 'draws'}` : '') : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface H2HRow { friend: FriendProfile; vs: PocketRecord; pocket: PocketRecord; wins: number; losses: number }

/** Every friend you have played (VS or a pocket game): their mascot, "VS 1–0 · Pocket 2–1", and a two-color record bar. */
export function HeadToHeadSection({ records }: { records: PocketRecords | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    void loadFriends().then(() => force((v) => v + 1));
    return onFriendsChange(() => force((v) => v + 1));
  }, []);
  const rows: H2HRow[] = getFriends()
    .map((f) => {
      const vs: PocketRecord = { wins: f.h2hW ?? 0, losses: f.h2hL ?? 0, draws: 0 };
      const pocket = records?.byFriend[f.id]?.total ?? EMPTY;
      return { friend: f, vs, pocket, wins: vs.wins + pocket.wins, losses: vs.losses + pocket.losses };
    })
    .filter((r) => played(r.vs) || played(r.pocket))
    .sort((a, b) => (b.wins + b.losses + b.pocket.draws) - (a.wins + a.losses + a.pocket.draws))
    .slice(0, 8);
  if (rows.length === 0) return null;
  return (
    <div className="animate-fade-in-up">
      <SectionHeader label="Head to Head" accent={CAST_COLORS.D} />
      <div className="space-y-2">
        {rows.map((r) => (
          <Link key={r.friend.id} href={`/profile/${r.friend.id}`} className="flex items-center gap-3 px-3 py-2.5 active:scale-[0.99] transition-transform" style={softCard(CAST_COLORS.D, { radius: 16 })}>
            <FriendAvatar name={r.friend.username} url={r.friend.avatar_url} size={40} userId={r.friend.id}
              castId={r.friend.avatar_cast_id ?? null} frame={r.friend.avatar_frame ?? null} config={r.friend.avatar_config ?? null} level={r.friend.level} pro={r.friend.is_pro} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                {/* Founder 10-09: the friend's name in the bubble lettering, in their own color; one line, shrinks to fit. */}
                <div className="flex-1 min-w-0">
                  <BubbleOneLine
                    text={r.friend.username.toUpperCase()}
                    accent={playerNameColor({ username: r.friend.username, avatarUrl: r.friend.avatar_url, config: r.friend.avatar_config, castId: r.friend.avatar_cast_id, frame: r.friend.avatar_frame })}
                    size={16}
                    align="left"
                  />
                </div>
                <SoftNum size={16} className="soft-num-auto shrink-0">{r.wins}–{r.losses}</SoftNum>
              </div>
              <div className="text-[10px] font-extrabold truncate mb-1" style={{ color: 'var(--color-text-muted)' }}>{headToHeadLine(r.vs, r.pocket)}</div>
              <RecordBar wins={r.wins} losses={r.losses} height={8} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** The VS page's game picker: 9 games as 5 on top and 4 centered under, equal tiles, no swipe (core pickerSplit). */
export function VsGamePicker<T extends { id: string; dbKey: string | null; accentHex: string; title: string; shortTitle: string }>({ modes, value, onPick, glyph }: {
  modes: readonly T[];
  value: string;
  onPick: (dbKey: string) => void;
  glyph: (m: T) => React.ReactNode;
}) {
  const { top, bottom } = pickerSplit(modes);
  const row = (items: T[]) => (
    <div className="flex justify-center gap-1.5">
      {items.map((m) => (
        <div key={m.id} style={{ width: 'calc((100% - 6px * 4) / 5)', maxWidth: 64 }}>
          <GameSquare
            accent={m.accentHex}
            selected={value === m.dbKey}
            glyph={glyph(m)}
            label={m.shortTitle}
            aria-label={m.title}
            aria-pressed={value === m.dbKey}
            onClick={() => onPick(m.dbKey as string)}
          />
        </div>
      ))}
    </div>
  );
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label="VS game">
      {row(top)}
      {bottom.length > 0 && row(bottom)}
    </div>
  );
}
