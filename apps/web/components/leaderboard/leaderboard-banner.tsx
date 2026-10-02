'use client';

import Link from 'next/link';
import { holidayKeyForDay, leaderboardTitle } from '@wordle-duel/core';
import { MODE_CARDS, MORE_CARDS, type HomeCard } from '@/components/home/mode-chrome';
import { GameSquare, GameTileGlyph } from '@/components/ui/game-tile';
import { BroomIcon } from '@/components/ui/broom-icon';
import { useFlags } from '@/hooks/use-flags';
import { useCountdown } from '@/hooks/use-countdown';
import { getSecondsUntilMidnightLocal } from '@/lib/daily-service';
import { HOLIDAY_TABLE, holidayTitle } from '@/lib/holidays';
import { ArtTitle } from '@/components/ui/art-title';
import { dayArtName } from '@/lib/art';

// The Leaderboard banner (founder, 2026-10-01; docs/LEADERBOARD_REDESIGN_SPEC.md §1):
// the home / VS / Friends one-window shape in gold-to-lilac. A frosted strip with
// the day's title (core leaderboardTitle — "FRIDAY’S FINEST", "<HOLIDAY> HEROES")
// and the date · reset clock, then the eight Wordocious games (home WORDOCIOUS
// order, + the SWEEP chip) and the ten Puzzles (home PUZZLES order) as rows of
// icon-only game squares. Exactly one selection across both rows and the chip.
// The Records banner (docs/RECORDS_REDESIGN_SPEC.md §1) reuses the rows and clock.

const INK = '#78350f';
const MID = '#92400e';
const GOLD = '#f59e0b';
/** The day title art's height (ART_SPEC §1: ≈96–120 pt, centered). */
const ART_HEIGHT = 108;
const NBSP = ' ';

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

/**
 * The banner's two game rows — WORDOCIOUS (+ the SWEEP chip) over PUZZLES, in
 * the home order — shared by the Leaderboard and Records banners. `ink` colors
 * the row labels.
 */
export function BannerGameRows({ selectedMode, onSelect, ink = MID }: {
  selectedMode: string;
  onSelect: (dbKey: string) => void;
  ink?: string;
}) {
  const { isOn: flagOn } = useFlags();
  // The home page's two lists, same filters (app/page.tsx).
  const wordCards = MODE_CARDS.filter((c) => flagOn(c.flagKey) && !c.homeWide && c.dbKey);
  const puzzleCards = MORE_CARDS.filter((c) => c.dailyEligible && c.dbKey && flagOn(c.flagKey));
  const sweepOn = selectedMode === 'SWEEP';

  const row = (cards: HomeCard[], tile: number, gap: number, glyph: number) => (
    // Tiles shrink toward 28 px on narrow screens and never wrap; past that the
    // row scrolls ('safe center' keeps the first tile reachable). The padding
    // gives the selected glow room inside the scroll box.
    <div
      className="flex overflow-x-auto"
      style={{ gap, justifyContent: 'safe center', padding: '6px', margin: '-6px', scrollbarWidth: 'none' }}
    >
      {cards.map((c) => {
        const key = c.dbKey as string;
        const on = selectedMode === key;
        return (
          <div key={c.id} style={{ flex: `0 1 ${tile}px`, minWidth: 28 }}>
            <GameSquare
              accent={c.accentColor}
              selected={on}
              size={tile}
              tone="light"
              glyph={<GameTileGlyph accent={c.accentColor} icon={c.icon} romanNumeral={c.romanNumeral} size={glyph} />}
              aria-label={c.title}
              aria-pressed={on}
              onClick={() => onSelect(key)}
              style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1' }}
            />
          </div>
        );
      })}
    </div>
  );

  const label = (text: string) => (
    <span className="text-[10px] font-black" style={{ letterSpacing: 1, color: ink }}>{text}</span>
  );

  return (
    <>
      <div className="relative flex flex-col gap-2" style={{ padding: '10px 12px 6px' }}>
        <div className="flex items-center gap-1.5">
          <span className="flex-1">{label('WORDOCIOUS')}</span>
          {/* The cross-mode Sweep board. */}
          <button
            type="button"
            onClick={() => onSelect('SWEEP')}
            aria-pressed={sweepOn}
            aria-label="Sweep leaderboard"
            className="flex items-center gap-1 font-black transition-transform active:scale-95"
            style={{
              height: 22, padding: '0 9px', borderRadius: 999, fontSize: 10, letterSpacing: 0.8,
              background: sweepOn ? GOLD : 'rgba(245,158,11,0.16)',
              color: sweepOn ? '#ffffff' : MID,
              boxShadow: sweepOn ? '0 0 8px rgba(245,158,11,0.5)' : undefined,
            }}
          >
            <BroomIcon size={11} />
            SWEEP
          </button>
        </div>
        {row(wordCards, 38, 7, 16)}
      </div>
      <div className="relative flex flex-col gap-2" style={{ padding: '8px 12px 12px' }}>
        {label('PUZZLES')}
        {row(puzzleCards, 31, 4, 13)}
      </div>
    </>
  );
}

interface Props {
  /** The player's local YYYY-MM-DD; null until hydrated (the title waits for it). */
  today: string | null;
  selectedMode: string;
  onSelect: (dbKey: string) => void;
}

export function LeaderboardBanner({ today, selectedMode, onSelect }: Props) {
  const title = today ? dayTitle(today) : NBSP;
  // The weekday's title art (docs/ART_SPEC.md §1). A holiday shows the whole
  // cast around LEADERBOARD with "<HOLIDAY> HEROES" as a small caps subtitle (§8).
  const holiday = today ? holidayTitle(holidayKeyForDay(today, HOLIDAY_TABLE)) : null;
  const art = today && !holiday ? dayArtName(today) : null;
  const date = today
    ? new Date(today + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
    : null;

  const card = (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), linear-gradient(180deg, #fef3c7, #ede9fe)',
        boxShadow: '0 4px 14px rgba(146,64,14,0.10)',
      }}
    >
      {/* Frosted headline strip. */}
      <div
        className="relative flex flex-col gap-1"
        style={{ padding: '10px 12px 10px', background: 'rgba(255,255,255,0.5)' }}
      >
        {art ? (
          // One designed graphic per weekday, its host drawn in (so no banner host).
          <ArtTitle name={art} label={title} height={ART_HEIGHT} />
        ) : holiday ? (
          // The whole cast carries the holiday too, so no banner host here either.
          <h1 className="flex flex-col items-center gap-1 m-0">
            <ArtTitle name="art-title-leaderboard" label="Leaderboard" as="div" className="w-full" />
            <span className="font-black uppercase text-center" style={{ fontSize: 11, letterSpacing: 1.4, lineHeight: 1.2, color: INK }}>
              {title}
            </span>
          </h1>
        ) : (
          // Until the local day is known, hold the art's slot so it doesn't jump.
          <div aria-hidden="true" style={{ height: ART_HEIGHT }} />
        )}
        <div className="flex items-center gap-2 font-extrabold" style={{ fontSize: 10.5, letterSpacing: 0.4, color: MID }}>
          <span className="flex-1 min-w-0 truncate"><ResetLine lead={date} /></span>
          <Link href="/records" className="shrink-0 font-black active:opacity-60" style={{ color: MID }}>ALL-TIME →</Link>
        </div>
      </div>

      <BannerGameRows selectedMode={selectedMode} onSelect={onSelect} />
    </div>
  );

  // Every title is art with its host(s) drawn in, so the banner host (O2) stays off.
  return card;
}
