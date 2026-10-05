'use client';

import { LiveHeadline } from '@/components/ui/live-headline';
import Link from 'next/link';
import { holidayKeyForDay, leaderboardTitle } from '@wordle-duel/core';
import { useCountdown } from '@/hooks/use-countdown';
import { getSecondsUntilMidnightLocal } from '@/lib/daily-service';
import { HOLIDAY_TABLE, holidayTitle } from '@/lib/holidays';
import { PageHeadline } from '@/components/ui/page-headline';
import { DAY_HEADLINE, DAY_PROP_SIZE, PAGE_HEADLINE, dayPropPair, headlineMaxWidth } from '@/lib/headline';
import { GamePicker } from '@/components/ui/game-picker';
import { ART_SIZE, dayArtName, type ArtName } from '@/lib/art';
import { softPill } from '@/lib/soft-surface';
import { LB_GOLD } from './board-rows';
import { useSeason, halloweenPropSrc, HALLOWEEN_PROPS } from '@/lib/season';
import { SeasonArt } from '@/components/ui/season-art';

// The Leaderboard top (docs/FINISH_SPEC.md A6, C2, C2b; mockup
// docs/design/brand/mockups/leaderboard-polish.html `.headline` + `.picker`):
// the day's title art (core leaderboardTitle — "FRIDAY’S FINEST"; on a
// holiday the whole cast around LEADERBOARD with "<HOLIDAY> HEROES" under it)
// as a full-width headline right on the wallpaper, then the ONE game picker
// card in gold, topped by the date · reset clock (BB4: no ALL-TIME link — all-time lives in Stats). The
// WORDOCIOUS row ends with the Sweep broom tile (no separate SWEEP pill). The
// Records page (records-banner.tsx) reuses the clock and the headline rules.

/** The day headline's height cap (FINISH_SPEC N1 + BB3: ≈58% width, ≤ 90 tall). */
export const DAY_HEADLINE_MAX_HEIGHT = DAY_HEADLINE.maxHeight;
const NBSP = ' ';

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

/** `<lead> · RESETS IN 02:06:43` — its own component so only this line ticks. */
export function ResetLine({ lead }: { lead: string | null }) {
  const secs = useCountdown(getSecondsUntilMidnightLocal);
  if (!lead) return <span>{NBSP}</span>;
  if (secs == null) return <span>{lead}</span>;
  const clock = `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
  return <span>{lead} · RESETS IN <span className="tabular-nums">{clock}</span></span>;
}

/** The day's title (core leaderboardTitle; "<HOLIDAY> HEROES" on a holiday). */
export function dayTitle(today: string): string {
  return leaderboardTitle(today, holidayTitle(holidayKeyForDay(today, HOLIDAY_TABLE)));
}

/** The picker card's header row text style (the gold ink, legible in dark mode). */
export const PICKER_HEADER_CLASS = 'flex items-center gap-2 font-extrabold lb-gold-ink';
export const PICKER_HEADER_STYLE: React.CSSProperties = { fontSize: 11, letterSpacing: 0.5 };

/** A small tinted chip link in a picker header (the Records page's ← TODAY). */
export function HeaderChipLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 inline-flex items-center font-black lb-gold-ink"
      style={{ ...softPill(LB_GOLD, { bar: false }), height: 'max(24px, 2.2em)', padding: '0 10px', fontSize: 10.5, letterSpacing: 0.8 }}
    >
      {children}
    </Link>
  );
}

/**
 * FINISH_SPEC X + founder 10-05: during Halloween the day title wears ONE prop on
 * EACH side (two different props, by the day of the year — never a lone prop on one
 * side), level with the lettering, just outside the art (`artW` = the art's drawn width).
 */
function HalloweenDayProps({ today, artW }: { today: string; artW: number }) {
  const d = new Date(today + 'T00:00:00');
  const doy = Math.round((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
  const pair = dayPropPair(HALLOWEEN_PROPS, doy);
  if (!pair) return null;
  const off = `calc(50% + ${artW / 2 + 6}px)`;
  const base: React.CSSProperties = {
    top: '62%', width: DAY_PROP_SIZE, height: DAY_PROP_SIZE, objectFit: 'contain',
    filter: 'drop-shadow(0 3px 4px rgba(76, 29, 149, 0.2))',
  };
  return (
    <>
      <SeasonArt src={halloweenPropSrc(pair[0])} className="absolute pointer-events-none"
        style={{ ...base, right: off, transform: 'translateY(-50%) rotate(-10deg)' }} />
      <SeasonArt src={halloweenPropSrc(pair[1])} className="absolute pointer-events-none"
        style={{ ...base, left: off, transform: 'translateY(-50%) rotate(10deg)' }} />
    </>
  );
}

/** The day art's drawn width under DAY_HEADLINE on a ~370 px phone column, leaving a prop + gap per side. */
const PROP_ROOM = 2 * (DAY_PROP_SIZE + 6);
function dayArtW(art: ArtName): number {
  const [w, h] = ART_SIZE[art];
  return Math.min(headlineMaxWidth(w, h, DAY_HEADLINE), 370 - PROP_ROOM);
}
function dayArtH(art: ArtName): number {
  const [w, h] = ART_SIZE[art];
  return Math.round((dayArtW(art) * h) / w);
}

interface Props {
  /** The player's local YYYY-MM-DD; null until hydrated (the title waits for it). */
  today: string | null;
  selectedMode: string;
  onSelect: (dbKey: string) => void;
}

export function LeaderboardBanner({ today, selectedMode, onSelect }: Props) {
  const season = useSeason();
  const title = today ? dayTitle(today) : NBSP;
  // The weekday's title art (docs/ART_SPEC.md §1). A holiday shows the whole
  // cast around LEADERBOARD with "<HOLIDAY> HEROES" as a small caps subtitle (§8).
  const holiday = today ? holidayTitle(holidayKeyForDay(today, HOLIDAY_TABLE)) : null;
  const art = today && !holiday ? dayArtName(today) : null;
  const date = today
    ? new Date(today + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
    : null;

  return (
    <>
      {art ? (
        // One designed graphic per weekday, its host drawn in.
        season === 'halloween' && today ? (
          <div className="relative mb-2">
            {/* Room for a prop + gap on each side: the art narrows (never shrinks the props). */}
            <PageHeadline name={art} label={title} rule={DAY_HEADLINE} maxHeight={dayArtH(art)} />
            <HalloweenDayProps today={today} artW={dayArtW(art)} />
          </div>
        ) : (
          <PageHeadline name={art} label={title} rule={DAY_HEADLINE} className="mb-2" />
        )
      ) : holiday ? (
        <h1 className="relative m-0 mb-3 flex flex-col items-center gap-1">
          <PageHeadline name="art-titlecast-leaderboard" label="Leaderboard" as="div" />
          {/* FINISH_SPEC AR: the holiday title in live lettering (gold → amber). */}
          <LiveHeadline text={title} palette="leaderboard" size={18} level={2} />
          {season === 'halloween' && today && <HalloweenDayProps today={today} artW={headlineMaxWidth(...ART_SIZE['art-titlecast-leaderboard'], PAGE_HEADLINE)} />}
        </h1>
      ) : (
        // Until the local day is known, hold the headline's slot so it doesn't jump.
        <div aria-hidden="true" className="mb-3" style={{ height: DAY_HEADLINE.maxHeight }} />
      )}

      <GamePicker
        selected={selectedMode}
        onSelect={onSelect}
        accent={LB_GOLD}
        // BB3: the same two-row grid as Stats (every game visible, no sideways
        // scroll) at compact ≤ 32 px tiles; BB4: no all-time button (it lives in Stats).
        density="compact"
        label="Pick a leaderboard"
        header={
          <div className={PICKER_HEADER_CLASS} style={PICKER_HEADER_STYLE}>
            <span className="flex-1 min-w-0 truncate text-center"><ResetLine lead={date} /></span>
          </div>
        }
      />
    </>
  );
}
