import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { onPageShadow } from '@/lib/art';
import { LetterTileAvatar } from '@/components/ui/letter-tile-avatar';

// The polished board look shared by the Leaderboard (docs/LEADERBOARD_REDESIGN_SPEC.md §2)
// and the Records pages (docs/RECORDS_REDESIGN_SPEC.md §2), so the two can never drift:
// caps section labels, soft borderless cards, medal discs for 1–3, your row in soft gold
// with an amber ring, and the soft pill segmented control.

export const MEDAL = ['#f59e0b', '#9ca3af', '#b45309'];

/** 11 / 900 caps, letter-spacing 1.2 (#6b7280 in light). */
export const SECTION_LABEL: CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: 1.2, color: 'var(--color-text-secondary)' };
/** White card, radius 14, soft shadow, no border. */
export const SOFT_CARD: CSSProperties = { background: 'var(--color-surface)', borderRadius: 14, boxShadow: onPageShadow('0 2px 10px rgba(26,26,46,0.06)') };
/** Your row: soft gold (the token is #fef3c7 in light) with a 1.5 px amber ring. */
export const YOUR_ROW: CSSProperties = { background: 'var(--color-gold-border-light)', boxShadow: 'inset 0 0 0 1.5px #f59e0b', borderRadius: 10 };

/** Medal discs (gold / silver / bronze) for 1–3, the plain number after. */
export function RankIcon({ rank }: { rank: number }) {
  if (rank >= 1 && rank <= 3) {
    return (
      <span
        className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0"
        style={{ background: MEDAL[rank - 1], boxShadow: `0 1px 4px ${MEDAL[rank - 1]}66` }}
      >
        {rank}
      </span>
    );
  }
  return <span className="text-xs font-black w-[22px] text-center shrink-0" style={{ color: 'var(--color-text-muted)' }}>{rank}</span>;
}

/** §212: photo (circle) → emoji / initials letter tile (ART_SPEC §20), left of every username. */
export function BoardAvatar({ url, emoji, name, accent, size = 28 }: { url: string | null | undefined; emoji?: string | null; name: string; accent?: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return <LetterTileAvatar name={name} emoji={emoji} accent={accent} size={size} />;
}

/**
 * One board row: rank disc, avatar, name (→ profile) over a stats line, points
 * right-aligned; `trailing` for extras (a taunt bell).
 */
export function BoardRow({ rank, userId, username, avatarUrl, avatarEmoji, isMe, nameSuffix, stats, score, trailing }: {
  rank: number;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  avatarEmoji?: string | null;
  isMe: boolean;
  nameSuffix?: ReactNode;
  stats?: ReactNode;
  score: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5" style={isMe ? YOUR_ROW : undefined}>
      <RankIcon rank={rank} />
      <BoardAvatar url={avatarUrl} emoji={avatarEmoji} name={username} />
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${userId}`}
          className="text-xs font-extrabold truncate block hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-text)' }}
        >
          {username}
          {nameSuffix}
          {isMe && <span style={{ color: '#d97706' }}> (you)</span>}
        </Link>
        {stats != null && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{stats}</div>
        )}
      </div>
      <div className="font-black text-[13px] text-right shrink-0 tabular-nums" style={{ color: 'var(--color-text)' }}>{score}</div>
      {trailing}
    </div>
  );
}

/** The soft pill segmented control (Everyone | Friends, Solo | VS). */
export function SegmentedPill<T extends string | boolean>({ options, value, onChange, accent, label }: {
  options: readonly (readonly [T, ReactNode])[];
  value: T;
  onChange: (v: T) => void;
  accent: string;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0" style={{ padding: 2, borderRadius: 999, background: `${accent}14` }}>
      {options.map(([v, text]) => {
        const on = value === v;
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={on}
            className="flex items-center gap-1 text-[10.5px] font-black"
            style={{
              height: 24, padding: '0 10px', borderRadius: 999, letterSpacing: 0.3,
              background: on ? 'var(--color-surface)' : 'transparent',
              color: on ? accent : 'var(--color-text-muted)',
              boxShadow: on ? '0 1px 3px rgba(26,26,46,0.12)' : undefined,
            }}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

/** Your rank: a soft gold card — big numerals (medal tint for the top 3), OF N, points. */
export function YourRankCard({ rank, ofLine, points, delta }: {
  rank: number;
  /** e.g. `OF 42 TODAY`. */
  ofLine: string;
  points?: string | null;
  /** The rank-delta badge, when the page shows one. */
  delta?: ReactNode;
}) {
  const medal = rank >= 1 && rank <= 3 ? MEDAL[rank - 1] : null;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 mb-4"
      style={{
        background: 'linear-gradient(135deg, var(--color-gold-border-light), var(--color-highlight-gold))',
        borderRadius: 14,
        boxShadow: '0 2px 10px rgba(146,64,14,0.10)',
      }}
    >
      <span
        className="font-black leading-none tabular-nums"
        style={{ fontSize: 34, color: medal ?? '#d97706', textShadow: medal ? `0 0 10px ${medal}66` : undefined }}
      >
        #{rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center text-[11px] font-black" style={{ color: '#d97706', letterSpacing: 1 }}>
          YOUR RANK
          {delta}
        </div>
        <div className="text-[11px] font-extrabold" style={{ color: 'var(--color-text-secondary)', letterSpacing: 0.6 }}>{ofLine}</div>
      </div>
      {points != null && (
        <div className="text-right shrink-0">
          <div className="font-black tabular-nums" style={{ fontSize: 17, color: 'var(--color-text)' }}>{points}</div>
          <div className="text-[9px] font-black" style={{ color: 'var(--color-text-secondary)', letterSpacing: 1 }}>POINTS</div>
        </div>
      )}
    </div>
  );
}
