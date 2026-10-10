'use client';

import { BubbleOneLine } from '@/components/ui/bubble-text';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { dayHost, holidayKeyForDay, leaderboardTitle, MASCOT_LEAN_DEGREES, wearsWizardHat } from '@wordle-duel/core';
import { useCountdown } from '@/hooks/use-countdown';
import { getSecondsUntilMidnightLocal } from '@/lib/daily-service';
import { HOLIDAY_TABLE, holidayTitle } from '@/lib/holidays';
import { PageHeadline } from '@/components/ui/page-headline';
import { DAY_HEADLINE, DAY_PROP_SIZE, PAGE_HEADLINE, dayPropPair, headlineMaxWidth } from '@/lib/headline';
import { GamePicker } from '@/components/ui/game-picker';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { todayBadges } from '@/lib/stats-view';
import { pickerRows } from '@/lib/game-picker';
import { useFlags } from '@/hooks/use-flags';
import { sweepModesFor } from '@/lib/daily-modes';
import { getTodayLocal } from '@/lib/daily-service';
import { ART_SIZE, artSrc, dayArtName, type ArtName } from '@/lib/art';
import { softPill } from '@/lib/soft-surface';
import { LB_GOLD } from './board-rows';
import { useSeason, halloweenPropSrc, HALLOWEEN_PROPS } from '@/lib/season';
import { SeasonArt } from '@/components/ui/season-art';
import { Host, OwnMascot } from './leaderboard-stage';

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

/**
 * Row 1 of the stage. Founder 10-09: the day's name fills the cloud on two big bubble lines (FRIDAY'S over FINEST, split at
 * the LAST space); your mascot and the day's host stand larger at either side of the second line (bottom-aligned), the mascot
 * row pulled up 25 px under line 1; the floating weekday prop is gone. The date + reset clock is ONE small line under it.
 */
export function StageTitle({ today }: { today: string | null }) {
  const host = today ? dayHost(today) : null;
  const hat = today ? wearsWizardHat(today) : false;
  const title = today ? dayTitle(today) : '';
  const cut = title.lastIndexOf(' ');
  const line1 = cut > 0 ? title.slice(0, cut) : title;
  const line2 = cut > 0 ? title.slice(cut + 1) : '';
  const date = today
    ? new Date(today + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
    : null;
  // Tapping your mascot: it hops and the title letters bounce again (the title re-mounts, replaying its pop).
  const [taps, setTaps] = useState(0);
  return (
    // Founder 10-09: the title's cloud bank glows from behind (a warm gold light), so it reads as lit, not pasted.
    <div style={{ padding: '10px 10px 0', backgroundImage: 'radial-gradient(ellipse 62% 58% at 50% 55%, rgba(255,217,120,0.62), rgba(255,176,74,0.22) 55%, rgba(255,176,74,0) 78%)' }}>
      <h1 className="relative m-0" aria-label={title || 'Leaderboard'}>
        <div key={`a${taps}`} style={{ padding: '0 4px' }} aria-hidden="true">
          <BubbleOneLine text={line1 || ' '} palette="leaderboard" size={42} />
        </div>
        <div className="flex items-end justify-between" style={{ gap: 2, minHeight: 70, marginTop: -25 }}>
          {/* your mascot leans toward the title; tap it and the letters bounce */}
          <OwnMascot size={70} wizardHat={hat} lean={MASCOT_LEAN_DEGREES} onTap={() => setTaps((n) => n + 1)} hopKey={taps} />
          <span className="flex-1 min-w-0" key={`b${taps}`} style={{ paddingBottom: 14 }} aria-hidden="true">
            <BubbleOneLine text={line2 || ' '} palette="leaderboard" size={42} />
          </span>
          {host ? <Host castId={host.castId} pose={host.pose} size={72} flip /> : <span style={{ width: 72 }} />}
        </div>
      </h1>
      {/* the cloud fades out above this line, so on a dark theme it takes a warm light ink (globals.css .lb-date-ink) */}
      <div className="lb-date-ink text-center font-extrabold" style={{ fontSize: 10.5, letterSpacing: 0.6, marginTop: 1 }}>
        <ResetLine lead={date} />
      </div>
    </div>
  );
}


interface Props {
  /** The player's local YYYY-MM-DD; null until hydrated (the title waits for it). */
  today: string | null;
  selectedMode: string;
  onSelect: (dbKey: string) => void;
}

export function LeaderboardBanner({ today, selectedMode, onSelect }: Props) {
  // 2.8 item 8: today's W / L on each picker tile — the same badges as Home and the finish screens.
  const { todayDailies } = useDailyCompletions();
  const { isOn: flagOn } = useFlags();
  const badges = useMemo(
    () => todayBadges(pickerRows(flagOn), todayDailies, sweepModesFor(getTodayLocal())),
    [flagOn, todayDailies],
  );
  // 11b: the top of the ONE living stage — the day's bubble title with your mascot and the day's cast host
  // (StageTitle: date · reset is its one small line), then the game picker with no card of its own. The page
  // wraps this, the game strip and the podium in <LeaderboardStage>. (The weekday title art + holiday
  // cast-around-LEADERBOARD art are retired here; the Halloween props return with the season pass.)
  return (
    <>
      <StageTitle today={today} />
      <GamePicker
        bare
        selected={selectedMode}
        onSelect={onSelect}
        accent={LB_GOLD}
        density="compact"
        badges={badges}
        label="Pick a leaderboard"
      />
    </>
  );
}
