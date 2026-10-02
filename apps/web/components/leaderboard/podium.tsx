import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';
import { BoardAvatar, type BoardAvatarData } from '@/components/leaderboard/board-rows';
import { LevelBadge } from '@/components/badges/badge-art';
import { PODIUM_STEP_HEIGHT, podiumColumn, podiumTone, type PodiumTone } from '@/lib/leaderboard-podium';

// The top-3 podium (docs/FINISH_SPEC.md C2; mockup
// docs/design/brand/mockups/leaderboard-polish.html `.podium`): three columns
// — 2nd, 1st, 3rd — each the player's mascot (or photo; FINISH_SPEC AN5), the name (→
// profile) and the soft-number points on a gold / silver / bronze step with
// the rank on it; the crown sits on 1st. Ties share a metal and a height.
// It heads the board card; ranks 4+ list below it as rows.

export interface PodiumPlace {
  key: string;
  rank: number;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  avatarEmoji?: string | null;
  /** FINISH_SPEC AN3: the row's avatar_config / accent / Pro flag when the data carries them. */
  avatar?: BoardAvatarData;
  isMe: boolean;
  /** FINISH_SPEC V3: the player's level → the small tier badge after the name. */
  level?: number | null;
  points: ReactNode;
  /** The row's result badge (W / L, the Sweep pill), beside the points. */
  badge?: ReactNode;
  /** Extra line under the points (the Sweep dot strip, a stats line). */
  extra?: ReactNode;
  /** After the name (the week leader's crown). */
  nameSuffix?: ReactNode;
  /** An action under the name (the friends board's taunt bell). */
  action?: ReactNode;
}

const STEP: Record<PodiumTone, string> = {
  gold: 'linear-gradient(#ffd66b, #f5a524)',
  silver: 'linear-gradient(#e4e8f0, #aab3c5)',
  bronze: 'linear-gradient(#ffc9a0, #d9844a)',
};
const STEP_LIP: Record<PodiumTone, string> = { gold: '#c9821a', silver: '#8c95a8', bronze: '#b0683a' };

function Column({ place, index }: { place: PodiumPlace; index: number }) {
  const tone = podiumTone(place.rank);
  const first = tone === 'gold';
  return (
    <div className="flex flex-col items-center min-w-0" style={{ gap: 4, gridColumn: podiumColumn(index), gridRow: 1 }}>
      {first && <Icon3D name="crown" size={26} style={{ marginBottom: -8, position: 'relative', zIndex: 2 }} />}
      <span className="sr-only">Rank {place.rank}</span>
      <Link href={`/profile/${place.userId}`} tabIndex={-1} aria-hidden="true" className="block" style={{ lineHeight: 0 }}>
        <BoardAvatar url={place.avatarUrl} name={place.username} userId={place.userId} level={place.level} size={first ? 54 : 44} ring={place.isMe ? '#f59e0b' : undefined} {...place.avatar} />
      </Link>
      <Link
        href={`/profile/${place.userId}`}
        className="max-w-full truncate text-[13px] font-black leading-tight hover:opacity-80 transition-opacity"
        style={{ color: place.isMe ? '#d97706' : 'var(--color-text)' }}
      >
        {place.username}
        {place.level ? <LevelBadge level={place.level} size={16} numberSize={11} className="ml-1 align-middle" /> : null}
        {place.nameSuffix}
      </Link>
      <div className="flex items-center justify-center gap-1 max-w-full">
        <SoftNum size={13}>{place.points}</SoftNum>
        {place.badge}
      </div>
      {place.extra}
      {place.action}
      <div
        className="w-full flex items-center justify-center font-black text-white tabular-nums"
        style={{
          height: PODIUM_STEP_HEIGHT[tone],
          marginTop: 2,
          borderRadius: '12px 12px 0 0',
          background: STEP[tone],
          boxShadow: `inset 0 -4px 0 ${STEP_LIP[tone]}55, inset 0 3px 0 rgba(255,255,255,0.35)`,
          fontSize: 22,
          textShadow: '0 2px 0 rgba(0,0,0,0.15)',
        }}
        aria-hidden="true"
      >
        {place.rank}
      </div>
    </div>
  );
}

/** The podium (the places in board order: 1st, 2nd, 3rd; DOM order = reading order). */
export function Podium({ places, label = 'Top three' }: { places: PodiumPlace[]; label?: string }) {
  if (places.length === 0) return null;
  return (
    <div role="group" aria-label={label} className="grid items-end" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, padding: '14px 12px 0' }}>
      {places.slice(0, 3).map((p, i) => <Column key={p.key} place={p} index={i} />)}
    </div>
  );
}
