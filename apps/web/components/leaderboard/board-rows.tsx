import Link from 'next/link';
import { openDressUp } from '@/components/profile/dress-up';
import { CandySegment } from '@/components/ui/candy-segment';
import { BubbleText } from '@/components/ui/bubble-text';
import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PlayerAvatar } from '@/components/avatar/player-avatar';
import { Icon3D, WinLossBadge, ROW_BADGE_SIZE } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';
import { SOFT, alphaHex, cardBarStyle, softBackground, softCard, softPill } from '@/lib/soft-surface';
import type { RowBadgeKind } from '@/lib/leaderboard-podium';
import { LevelBadge } from '@/components/badges/badge-art';

// The finished board look shared by the Leaderboard and the Records pages
// (docs/FINISH_SPEC.md C2, C2a, A1, A2; mockup
// docs/design/brand/mockups/leaderboard-polish.html), so the two can never
// drift: caps section labels, tinted cards (no plain white), medal discs for
// 1–3 and soft-number ranks / points after, soft striped rows, your row in
// soft gold with an amber ring, the W / L badge in its own fixed column left
// of the points, the ONE gold result card and the tinted segmented control.

/** The Leaderboard / Records page accent (warm gold). */
export const LB_GOLD = '#f59e0b';

export const MEDAL = ['#f59e0b', '#9ca3af', '#b45309'];

/** 11 / 900 caps, letter-spacing 1.2. */
export const SECTION_LABEL: CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: 1.2, color: 'var(--color-text-secondary)' };
/** A tinted board card (A1): the page's warm-gold wash, its soft border, rounded. */
export const SOFT_CARD: CSSProperties = softCard(LB_GOLD, { radius: 18 });
/** Your row: soft gold (the token is #fef3c7 in light) with a 1.5 px amber ring. */
// BJ7: your row reads by its deeper gold wash — no ring (no outlined boxes).
export const YOUR_ROW: CSSProperties = { background: 'color-mix(in srgb, #f59e0b 26%, var(--color-gold-border-light))', borderRadius: 10 };

/** C2a: the badge column's width on daily rows (the W / L art + air). */
export const BADGE_COL = ROW_BADGE_SIZE + 4;
/** C2a: the badge column's width on Sweep rows (the FLAWLESS / SWEEP pill). */
export const SWEEP_BADGE_COL = 58;

/** Medal discs (gold / silver / bronze) for 1–3, the soft-number rank after; null → "–" (a ghost row). */
export function RankIcon({ rank }: { rank: number | null }) {
  if (rank != null && rank >= 1 && rank <= 3) {
    const c = MEDAL[rank - 1];
    return (
      <span
        className="w-[24px] h-[24px] rounded-full flex items-center justify-center text-[12px] font-black text-white shrink-0 tabular-nums"
        style={{ background: `linear-gradient(${alphaHex(c, 0.75)}, ${c})`, boxShadow: `0 2px 0 ${alphaHex(c, 0.55)}, 0 2px 6px ${c}55`, textShadow: '0 1px 0 rgba(0,0,0,0.18)' }}
      >
        {rank}
      </span>
    );
  }
  return (
    <span className="w-[24px] text-center shrink-0">
      {rank == null
        ? <span className="text-xs font-black" style={{ color: 'var(--color-text-muted)' }}>–</span>
        : <SoftNum size={rank >= 100 ? 12 : 15}>{rank}</SoftNum>}
    </span>
  );
}

/** The avatar fields a board row may carry (FINISH_SPEC AN3; all optional — older API responses lack them). */
/** A board row's avatar data from a leaderboard / friends row (the fields the API now returns; absent → defaults). */
export function boardAvatarFor(row: unknown): BoardAvatarData {
  const r = (row ?? {}) as { avatar_config?: unknown; accent_color?: string | null; is_pro?: boolean | null; avatar_cast_id?: string | null; avatar_frame?: string | null };
  return { config: r.avatar_config ?? null, accent: r.accent_color ?? null, pro: !!r.is_pro, castId: r.avatar_cast_id ?? null, frame: r.avatar_frame ?? null } as BoardAvatarData;
}

export interface BoardAvatarData {
  /** profiles.avatar_config */
  config?: unknown;
  /** profiles.accent_color (the default mascot's color) */
  accent?: string | null;
  /** is_pro (AA2: the Pro frame + crown) */
  pro?: boolean | null;
  /** Legacy AH columns. */
  castId?: string | null;
  frame?: string | null;
}

/**
 * §212 → FINISH_SPEC AN5 / AN6: left of every username — the player's photo as
 * a rounded square, else their mascot (saved avatar_config, else the
 * deterministic default seeded by the lowercased username), in their frame, crowned when Pro.
 * The signed-in player's own avatar always comes from their profile.
 * AM2: `emoji` is accepted but never drawn.
 */
export function BoardAvatar({ url, name, userId, accent, config, size = 32, ring, pro, castId, frame, level }: {
  url: string | null | undefined;
  /** Retired (AM2): never drawn. */
  emoji?: string | null;
  name: string;
  /** The row's user id (matches the signed-in player). */
  userId?: string | null;
  accent?: string | null;
  /** The row's avatar_config when the data carries it. */
  config?: unknown;
  size?: number;
  ring?: string;
  /** FINISH_SPEC AA2: the row's Pro flag when the data carries one. */
  pro?: boolean | null;
  /** FINISH_SPEC AH (legacy): the row's avatar_cast_id / avatar_frame when the data carries them. */
  castId?: string | null;
  frame?: string | null;
  /** The player's level (tier frames are clamped to it). */
  level?: number | null;
}) {
  return (
    <PlayerAvatar
      name={name}
      userId={userId}
      url={url}
      accent={accent}
      config={config}
      castId={castId}
      frame={frame}
      level={level}
      pro={pro}
      size={size}
      shadow={ring ? `0 0 0 2px ${ring}` : undefined}
    />
  );
}

/** C2a: a row's W / L result badge (or nothing — the column keeps its width). */
export function RowBadge({ kind }: { kind: RowBadgeKind }) {
  if (!kind) return null;
  return <WinLossBadge won={kind === 'won'} />;
}

/**
 * The Sweep board's result badge (C2a): GOLD "FLAWLESS" (won every sweep
 * game) vs VIOLET "SWEEP" (completed them), with a live flawless streak's
 * length under it (§248). Lives in the Sweep rows' badge column.
 */
export function SweepBadge({ flawless, streak = 0 }: { flawless: boolean; streak?: number }) {
  const c = flawless ? '#d97706' : '#8b5cf6';
  return (
    <span
      className="inline-flex flex-col items-center justify-center font-extrabold leading-none"
      style={{ ...softPill(c, { radius: 7, bar: false }), color: c, fontSize: 8.5, letterSpacing: 0.3, padding: '3px 4px', minWidth: 0, maxWidth: SWEEP_BADGE_COL }}
    >
      <span>{flawless ? 'FLAWLESS' : 'SWEEP'}</span>
      {flawless && streak >= 2 && <span className="tabular-nums" style={{ marginTop: 2 }}>×{streak}</span>}
    </span>
  );
}

/**
 * One board row (mockup `.lrow`): rank, avatar, name (→ profile) over a stats
 * line, then the fixed badge column (C2a: the W / L badge, vertically
 * centered, so badges stack in one even column; empty when there is none) and
 * the soft-number points right-aligned; `trailing` for extras (a taunt bell).
 * `stripe` paints the soft stripe on alternate rows; `dim` = a ghost row.
 */
export function BoardRow({ rank, userId, username, avatarUrl, avatar, isMe, level, nameSuffix, stats, below, badge, badgeWidth = BADGE_COL, score, trailing, stripe = false, divider = true, dim = false }: {
  rank: number | null;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  avatarEmoji?: string | null;
  /** FINISH_SPEC AN3: the row's avatar_config / accent / Pro flag when the data carries them. */
  avatar?: BoardAvatarData;
  isMe: boolean;
  /** FINISH_SPEC V3: the player's level → the small tier badge after the name. */
  level?: number | null;
  nameSuffix?: ReactNode;
  stats?: ReactNode;
  /** A second line under the stats (the Sweep dot strip). */
  below?: ReactNode;
  /** C2a: the result badge for the badge column. */
  badge?: ReactNode;
  badgeWidth?: number;
  score?: ReactNode;
  trailing?: ReactNode;
  stripe?: boolean;
  /** Draw the soft line above the row. */
  divider?: boolean;
  dim?: boolean;
}) {
  const style: CSSProperties = isMe
    ? YOUR_ROW
    : {
        background: stripe ? alphaHex(LB_GOLD, 0.07) : undefined,
        borderTop: divider ? `1px solid ${alphaHex(LB_GOLD, 0.16)}` : undefined,
        opacity: dim ? 0.55 : undefined,
      };
  return (
    <div className="cv-row flex items-center gap-2.5 px-3 py-2" style={style}>
      <RankIcon rank={rank} />
      {isMe ? (
        // Founder 10-05 (door 1): your own row's avatar opens your Stage.
        <button type="button" onClick={() => openDressUp()} aria-label="Dress up your mascot" className="shrink-0 border-0 bg-transparent p-0 cursor-pointer" style={{ lineHeight: 0 }}>
          <BoardAvatar url={avatarUrl} name={username} userId={userId} level={level} {...avatar} />
        </button>
      ) : <BoardAvatar url={avatarUrl} name={username} userId={userId} level={level} {...avatar} />}
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${userId}`}
          className="text-[14px] font-black truncate block hover:opacity-80 transition-opacity leading-tight"
          style={{ color: 'var(--color-text)' }}
        >
          {username}
          {level ? <LevelBadge level={level} size={16} numberSize={11} className="ml-1 align-middle" /> : null}
          {nameSuffix}
          {isMe && <span style={{ color: '#d97706' }}> (you)</span>}
        </Link>
        {stats != null && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold leading-snug mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{stats}</div>
        )}
        {below}
      </div>
      {/* C2a: the badge column — same width on every row of the list. */}
      <span className="flex items-center justify-center shrink-0 self-center" style={{ width: badgeWidth }}>{badge}</span>
      {score != null && (
        <span className="text-right shrink-0" style={{ minWidth: 40 }}>
          <SoftNum size={16}>{score}</SoftNum>
        </span>
      )}
      {trailing}
    </div>
  );
}

/** The tinted board card (the podium and the rows live in one). */
export function BoardCard({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`overflow-hidden ${className}`} style={{ ...SOFT_CARD, ...style }}>{children}</div>;
}

/**
 * The two-way switch (Everyone | Friends, Solo | VS, Daily | All-time): the candy segmented (family rule —
 * frosted track + the glossy purple thumb, components/ui/candy-segment.tsx), hugging its labels.
 */
export function SegmentedPill<T extends string | boolean>({ options, value, onChange, accent, label }: {
  options: readonly (readonly [T, ReactNode])[];
  value: T;
  onChange: (v: T) => void;
  /** Kept for callers; the candy sprites are the app's purple in every context. */
  accent: string;
  label: string;
}) {
  const keyed = options.map(([v, text]) => ({ key: String(v), label: text }));
  return (
    <CandySegment
      options={keyed}
      value={String(value)}
      onChange={(k) => { const hit = options.find(([v]) => String(v) === k); if (hit) onChange(hit[0]); }}
      accent={accent}
      label={label}
      height={32}
      className="shrink-0"
      itemPad={12}
    />
  );
}

/**
 * The ONE result card on gold (C2; mockup `.result`): the crown over your
 * rank, "OF N TODAY" over how you solved it, and your points — all soft
 * numbers. `rank` null = played but not ranked yet (the crown waits).
 */
export function ResultCard({ rank, ofLine, solved, points, delta }: {
  rank: number | null;
  /** e.g. `OF 42 TODAY`. */
  ofLine: string | null;
  /** "Solved in 4 guesses · 48s". */
  solved?: string | null;
  points?: string | null;
  /** The rank-delta badge, when the page shows one. */
  delta?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden mb-3" style={softCard(LB_GOLD, { radius: 18 })}>
      <div aria-hidden="true" style={{ ...cardBarStyle(LB_GOLD, SOFT.bar), background: 'linear-gradient(90deg, #f5a524, #ffd166)' }} />
      {/* BJ7: one top line — crown + rank, the rank line and the points top-aligned;
          the solve line ONE line 4 under it. */}
      <div className="flex items-start gap-2.5" style={{ padding: '10px 12px' }}>
        <div className="flex flex-col items-center shrink-0" style={{ minWidth: 40 }}>
          <Icon3D name="crown" size={24} />
          {rank != null && <SoftNum size={22} style={{ marginTop: -2 }}>#{rank}</SoftNum>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {/* FINISH_SPEC AR: the dynamic rank line in live lettering (gold → amber). */}
            <BubbleText text={rank != null ? ofLine ?? '' : 'YOUR RESULT'} palette="leaderboard" maxSize={15} minSize={11} align="left" level={3} className="flex-1 min-w-0" />
            {delta}
          </div>
          {solved && (
            <div className="text-[13px] font-extrabold leading-snug truncate mt-1" style={{ color: 'var(--color-text-secondary)' }}>{solved}</div>
          )}
        </div>
        {points != null && (
          <div className="text-right shrink-0">
            <SoftNum size={22} as="div">{points}</SoftNum>
            <div className="text-[11px] font-black lb-gold-ink" style={{ letterSpacing: 1.4, marginTop: 3 }}>POINTS</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * FINISH_SPEC AU2: the rank card collapsed to ONE compact row on gold — the
 * crown, the whole result as one live-lettering line (lib/leaderboard-podium
 * compactRankLine), the rank delta, and the completed check (W / L).
 */
export function CompactResultRow({ line, won, delta }: { line: string; won: boolean | null; delta?: ReactNode }) {
  return (
    <div className="relative overflow-hidden mb-3" style={softCard(LB_GOLD, { radius: 14 })}>
      <div className="flex items-center gap-2" style={{ padding: '6px 10px' }}>
        <Icon3D name="crown" size={22} className="shrink-0" />
        <BubbleText text={line} palette="leaderboard" maxSize={14} minSize={10} align="left" level={3} calm className="flex-1 min-w-0" />
        {delta}
        {won != null && <Icon3D name={won ? 'badge-check' : 'badge-l'} size={20} label={won ? 'Completed' : 'Not solved'} className="shrink-0" />}
      </div>
    </div>
  );
}

/**
 * A collapsible section header (YESTERDAY'S WINNERS): a tinted tappable bar
 * with the caps label and a chevron; `right` for its share icon.
 */
export function DisclosureHeader({ label, open, onToggle, right }: { label: ReactNode; open: boolean; onToggle: () => void; right?: ReactNode }) {
  return (
    // Founder 10-02: the bar is ALWAYS full width (collapsed and open), like the
    // cards around it — the share icon sits inside it, left of the chevron.
    <div className="relative w-full mt-5 mb-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-1.5 text-left"
        style={{ ...softPill(LB_GOLD, { radius: 14, bar: false }), ...SECTION_LABEL, padding: '9px 14px', minHeight: 44 }}
      >
        {label}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {right && <div className="absolute top-1/2 -translate-y-1/2 flex items-center" style={{ right: 36 }}>{right}</div>}
    </div>
  );
}
