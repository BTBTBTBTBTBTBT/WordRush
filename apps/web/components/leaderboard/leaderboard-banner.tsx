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

// The Leaderboard banner (founder, 2026-10-01; docs/LEADERBOARD_REDESIGN_SPEC.md §1):
// the home / VS / Friends one-window shape in gold-to-lilac. A frosted strip with
// the day's title (core leaderboardTitle — "FRIDAY’S FINEST", "<HOLIDAY> HEROES")
// and the date · reset clock, then the eight Wordocious games (home WORDOCIOUS
// order, + the SWEEP chip) and the ten Puzzles (home PUZZLES order) as rows of
// icon-only game squares. Exactly one selection across both rows and the chip.

const INK = '#78350f';
const MID = '#92400e';
const GOLD = '#f59e0b';

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

/** `OCT 2 · RESETS IN 02:06:43` — its own component so only this line ticks. */
function ResetLine({ today }: { today: string | null }) {
  const secs = useCountdown(getSecondsUntilMidnightLocal);
  if (!today) return <span>&nbsp;</span>;
  const date = new Date(today + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  if (secs == null) return <span>{date}</span>;
  const clock = `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
  return <span>{date} · RESETS IN <span className="tabular-nums">{clock}</span></span>;
}

interface Props {
  /** The player's local YYYY-MM-DD; null until hydrated (the title waits for it). */
  today: string | null;
  selectedMode: string;
  onSelect: (dbKey: string) => void;
}

export function LeaderboardBanner({ today, selectedMode, onSelect }: Props) {
  const { isOn: flagOn } = useFlags();
  // The home page's two lists, same filters (app/page.tsx).
  const wordCards = MODE_CARDS.filter((c) => flagOn(c.flagKey) && !c.homeWide && c.dbKey);
  const puzzleCards = MORE_CARDS.filter((c) => c.dailyEligible && c.dbKey && flagOn(c.flagKey));
  const title = today ? leaderboardTitle(today, holidayTitle(holidayKeyForDay(today, HOLIDAY_TABLE))) : ' ';
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
    <span className="text-[10px] font-black" style={{ letterSpacing: 1, color: MID }}>{text}</span>
  );

  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), linear-gradient(180deg, #fef3c7, #ede9fe)',
        boxShadow: '0 4px 14px rgba(146,64,14,0.10)',
      }}
    >
      {/* Frosted headline strip. */}
      <div className="relative flex flex-col gap-1" style={{ padding: '12px 12px 10px', background: 'rgba(255,255,255,0.5)' }}>
        <h1 className="font-black" style={{ fontSize: 22, letterSpacing: 0.4, lineHeight: 1.15, color: INK, textShadow: '0 0 8px rgba(245,158,11,0.55)' }}>
          {title}
        </h1>
        <div className="flex items-center gap-2 font-extrabold" style={{ fontSize: 10.5, letterSpacing: 0.4, color: MID }}>
          <span className="flex-1 min-w-0 truncate"><ResetLine today={today} /></span>
          <Link href="/records" className="shrink-0 font-black active:opacity-60" style={{ color: MID }}>ALL-TIME →</Link>
        </div>
      </div>

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
    </div>
  );
}
