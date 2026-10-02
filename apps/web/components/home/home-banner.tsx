'use client';

import { openGoProPopup } from '@/lib/payment/go-pro-popup';
import { ProPill, UNLIMITED_PEACH } from '@/components/game/finished-kit';
import { useLayoutEffect, useRef, useState } from 'react';
import { HALLOWEEN_BANNER_SRC, useSeason } from '@/lib/season';
import { SeasonArt } from '@/components/ui/season-art';
import Image from 'next/image';
import { softBorder, softIconTile } from '@/lib/soft-surface';
import { SoftNum } from '@/components/ui/soft-number';
import { Check } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { ART_SIZE, artSrc, isGameArtIcon, onPageShadow } from '@/lib/art';
import {
  bannerClockLine, bannerHeadline, groupStatus, groupStreak, groupTier, unlimitedGroupStatus,
  type BannerTier, type GroupProgress,
} from '@wordle-duel/core';
import type { DailyCompletion } from '@/lib/daily-service';
import type { HomeCard } from './mode-chrome';
import { BannerHost, BANNER_HOST_CLEARANCE } from '@/components/ui/mascot';
import { PAGE_HOSTS } from '@/lib/mascots';
import { MODE_SWITCH, homeBannerContent, homeBannerSlots, modeSwitchLayout } from '@/lib/stationary-layout';

// The home banner (founder-approved home redesign, 2026-10-01; spec:
// docs/HOME_REDESIGN_SPEC.md). One window: a frosted headline strip over a
// Wordocious row (the eight sweep dailies) and a Puzzles row (the ten More Games
// dailies). Each row glows on its own (purple sweep, gold flawless) through ONE
// blended background and ONE shimmer; Double Flawless turns the whole card gold.
// The words come from the shared core so iOS and Android print the same thing.

const TIER_COLOR: Record<Exclude<BannerTier, 'none'>, string> = { sweep: '#ebd6fd', flawless: '#fde68a' };
const TIER_INK: Record<BannerTier, string> = { none: '#6d28d9', sweep: '#7e22ce', flawless: '#92400e' };

/**
 * FINISH_SPEC G4: once the Wordocious row is swept (or flawless), the banner
 * wears the wide celebration art beside the headline (O1 + S with the broom +
 * W for a Sweep; D + the pink O with her gem + I for a Flawless — the whole
 * group visible, never cropped) and its own top bar color: gold for a Sweep,
 * pink for a Flawless. The art carries the cast then, so the W host steps out.
 */
const TIER_ART: Record<Exclude<BannerTier, 'none'>, { art: 'art-scene-banner-sweep' | 'art-scene-banner-flawless'; accent: string; bar: string }> = {
  sweep: { art: 'art-scene-banner-sweep', accent: '#f5a524', bar: 'linear-gradient(90deg, #ffd166, #f5a524 55%, #f97316)' },
  flawless: { art: 'art-scene-banner-flawless', accent: '#ec4899', bar: 'linear-gradient(90deg, #f9a8d4, #ec4899 55%, #c026d3)' },
};
/** The banner art's height beside the headline (px) — the stationary art slot (lib/stationary-layout.ts). */
const TIER_ART_H = 100;
/** Unlimited on a swept / flawless day keeps the art frame (Z), in Unlimited's colors with U's loop. */
const UNLIMITED_BAR = `linear-gradient(90deg, #fdba74, ${UNLIMITED_PEACH} 55%, #ec4899)`;
const LOOP_ART = 'art-scene-unlimited-loop' as const;

export interface BannerRow {
  cards: HomeCard[];
  progress: GroupProgress;
  streaks: { sweep: number; flawless: number };
  unlimitedPlayed: number;
}

interface Props {
  word: BannerRow;
  puzzles: BannerRow;
  todayDailies: Map<string, DailyCompletion>;
  playMode: 'daily' | 'unlimited';
  /** Pro players get the DAILY | UNLIMITED switch in the strip. */
  isPro: boolean;
  onModeChange: (mode: 'daily' | 'unlimited') => void;
  /** The player's username; empty for a guest. */
  name: string;
  /** Live HH:MM:SS to local midnight. */
  clock: string;
  onOpen: (card: HomeCard) => void;
  onShare: () => void;
}

function Tile({ card, result, unlimited, size, onOpen }: {
  card: HomeCard; result?: DailyCompletion; unlimited: boolean; size: 'lg' | 'sm'; onOpen: () => void;
}) {
  const Icon = card.icon;
  const px = size === 'lg' ? 32 : 28;
  const iconPx = size === 'lg' ? 16 : 14;
  const accent = card.accentColor;
  let style: React.CSSProperties;
  let ink: string;
  // FINISH_SPEC A1: an unplayed (or Unlimited) tile is a mini game card — the
  // accent's wash, its border and a thin accent top bar — never plain white.
  const mini = { ...softIconTile(accent, { radius: size === 'lg' ? 9 : 8 }), boxShadow: `inset 0 3px 0 ${accent}, 0 2px 5px ${accent}33` };
  if (unlimited) {
    style = mini;
    ink = accent;
  } else if (result) {
    style = result.won
      ? { background: accent, boxShadow: `0 0 9px ${accent}b3` }
      : { background: '#9ca3af' };
    ink = '#ffffff';
  } else {
    style = mini;
    ink = accent;
  }
  return (
    <button
      type="button"
      data-squish="card"
      onClick={onOpen}
      aria-label={`${card.title}${unlimited ? '' : result ? (result.won ? ', won' : ', played') : ', not played yet'}`}
      className="flex items-center justify-center shrink-0"
      style={{ width: px, height: px, borderRadius: size === 'lg' ? 9 : 8, ...style }}
    >
      {Icon && isGameArtIcon(Icon)
        // The 3D game art fills the tile (docs/ART_SPEC.md §3); a soft white
        // halo keeps it readable on a won tile's solid accent.
        ? <Icon style={{ width: iconPx, height: iconPx, ...(result?.won && !unlimited ? { filter: 'drop-shadow(0 0 1.5px rgba(255,255,255,0.95))' } : null) }} />
        : card.romanNumeral
        ? <span className="font-black leading-none" style={{ color: ink, fontSize: card.romanNumeral.length > 2 ? 8 : 11 }}>{card.romanNumeral}</span>
        : Icon
        ? <Icon style={{ width: iconPx, height: iconPx, color: ink }} />
        : <Check style={{ width: iconPx, height: iconPx, color: ink }} />}
    </button>
  );
}

function RowHeader({ label, status, ink, streak, height }: { label: string; status: string; ink: string; streak: number | null; height: number }) {
  // Z: a fixed-height, one-line slot in both modes; the status crossfades.
  return (
    <div className="flex items-center gap-1.5" style={{ height }}>
      <span className="text-[10px] font-black shrink-0" style={{ letterSpacing: 1, color: ink }}>{label}</span>
      <span key={status} className="mode-xfade flex-1 min-w-0 truncate text-[10px] font-black" style={{ letterSpacing: 0.5, color: ink }}>{status}</span>
      {streak != null && streak > 0 && (
        <span className="flex items-center gap-0.5" aria-label={`${streak}-day streak`}>
          <Icon3D name="flame" size={14} />
          <SoftNum size={12}>{streak}</SoftNum>
        </span>
      )}
    </div>
  );
}

const HEAD_SIZE = 22;
const HEAD_LINE = 1.15;

export function HomeBanner({ word, puzzles, todayDailies, playMode, isPro, onModeChange, name, clock, onOpen, onShare }: Props) {
  const unlimited = playMode === 'unlimited';
  // FINISH_SPEC Z: the slots (frame, headline box, share box, art box, rows)
  // come from today's DAILY state only, so the switch never moves the tiles or
  // the grids below; the content filling them follows the mode.
  const dailyTier = groupTier(word.progress);
  const layoutInput = { dailyTier, puzzleTier: groupTier(puzzles.progress), playedAny: word.progress.played + puzzles.progress.played > 0 };
  const slots = homeBannerSlots(playMode, layoutInput);
  const content = homeBannerContent(playMode, layoutInput);
  const wTier = content.wordTier;
  const pTier = content.puzzleTier;
  const double = wTier === 'flawless' && pTier === 'flawless';
  const headline = bannerHeadline(word.progress, puzzles.progress, { hour: new Date().getHours(), name, unlimited });
  const clockLine = bannerClockLine(word.progress, puzzles.progress, clock, unlimited);
  const topColor = wTier === 'none' ? '#ece8ff' : TIER_COLOR[wTier];
  const bottomColor = pTier === 'none' ? '#e2e6ff' : TIER_COLOR[pTier];
  const background = unlimited
    ? 'linear-gradient(135deg, #fce7f3, #ede9fe)'
    : `linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), linear-gradient(180deg, ${topColor} 0%, ${topColor} 52%, ${bottomColor} 72%, ${bottomColor} 100%)`;
  const headInk = double ? '#78350f' : '#4c1d95';
  const subInk = double ? '#92400e' : '#6d28d9';
  const shimmer = !unlimited && (wTier !== 'none' || pTier !== 'none');
  // The art frame belongs to the day (a swept / flawless Daily), not to the mode.
  const tierArt = slots.frame === 'art' && dailyTier !== 'none' ? TIER_ART[dailyTier] : null;
  const frameAccent = tierArt ? (unlimited ? UNLIMITED_PEACH : tierArt.accent) : null;
  const switchBox = modeSwitchLayout(playMode, { locked: !isPro });
  // FINISH_SPEC X: during Halloween the banner wears its Halloween art beside
  // the headline (art-scene-banner-halloween; not shipped yet — the slot
  // renders nothing until the file exists). Same in both modes, so the
  // Daily/Unlimited switch never moves anything; a tier's art wins.
  const season = useSeason();
  const [seasonArtOk, setSeasonArtOk] = useState(false);
  const seasonSlot = season === 'halloween' && !tierArt;
  const seasonArt = seasonSlot && seasonArtOk;

  // The headline runs two lines at most at 22px, then steps down (to 70%) rather than
  // truncating: the web side of iOS minimumScaleFactor / Android's onTextLayout fit.
  const headRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const fit = () => {
      let size = HEAD_SIZE;
      el.style.fontSize = `${size}px`;
      while (el.offsetHeight > 2 * size * HEAD_LINE + 1 && size > HEAD_SIZE * 0.7) {
        size = Math.max(HEAD_SIZE * 0.7, size - 1);
        el.style.fontSize = `${size}px`;
      }
      // ART_SPEC §18.4: a one-line headline sits centered in the strip; two lines stay left.
      const oneLine = el.offsetHeight <= size * HEAD_LINE * 1.5;
      el.style.textAlign = oneLine ? 'center' : 'left';
      if (el.parentElement) el.parentElement.style.justifyContent = oneLine ? 'center' : 'flex-start';
    };
    fit();
    if (typeof ResizeObserver === 'undefined' || !el.parentElement) return;
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [headline, playMode]);

  // Z: fixed-width segments, one font weight in both states; only the thumb slides.
  const segment = (mode: 'daily' | 'unlimited', label: string, width: number) => {
    const on = playMode === mode;
    // R3 (founder 10-02): free players and guests see UNLIMITED too, with the
    // gold PRO pill; tapping it opens the Go Pro popup instead of switching.
    const locked = mode === 'unlimited' && !isPro;
    return (
      <button
        type="button"
        onClick={() => (locked ? openGoProPopup({ reason: 'Unlimited play' }) : onModeChange(mode))}
        aria-pressed={on}
        aria-label={locked ? 'Unlimited, a Pro perk' : undefined}
        className="relative font-black flex items-center justify-center shrink-0 whitespace-nowrap"
        style={{
          width, height: MODE_SWITCH.height, padding: 0, borderRadius: 999, fontSize: 10.5, letterSpacing: 0.6,
          background: 'transparent',
          color: on ? (mode === 'daily' ? '#4c1d95' : '#6d28d9') : '#7c3aed',
        }}
      >
        <span className="inline-flex items-center gap-1">{label}{locked && <ProPill />}</span>
      </button>
    );
  };

  const row = (r: BannerRow, tier: BannerTier, label: string, size: 'lg' | 'sm') => (
    <>
      <RowHeader
        label={label}
        status={unlimited ? unlimitedGroupStatus(r.unlimitedPlayed) : groupStatus(r.progress)}
        ink={TIER_INK[tier]}
        streak={content.showStreaks ? groupStreak(tier, r.streaks) : null}
        height={slots.rowHeader}
      />
      <div className="flex" style={{ gap: size === 'lg' ? 7 : 4 }}>
        {r.cards.map((c) => (
          <Tile
            key={c.id}
            card={c}
            result={!unlimited && c.dbKey ? todayDailies.get(c.dbKey) : undefined}
            unlimited={unlimited}
            size={size}
            onOpen={() => onOpen(c)}
          />
        ))}
      </div>
    </>
  );

  const card = (
    <div
      className="relative shrink-0 overflow-hidden w-full"
      style={{
        // §18.4: radius 22, the full content width.
        borderRadius: 22, background,
        ...(frameAccent ? { border: softBorder(frameAccent, 0.2) } : null),
        boxShadow: double ? '0 0 26px rgba(245,158,11,0.8)' : onPageShadow('0 4px 14px rgba(76,29,149,0.08)'),
      }}
    >
      {/* G4: the swept / flawless banner's own top bar (gold / pink). */}
      {tierArt && <div aria-hidden="true" className="relative" style={{ height: slots.topBar, background: unlimited ? UNLIMITED_BAR : tierArt.bar, transition: 'background 160ms ease-out' }} />}
      {shimmer && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div
            className="animate-banner-shimmer absolute"
            style={{ top: '-20%', left: 0, width: '38%', height: '140%', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0))' }}
          />
        </div>
      )}

      {/* Frosted headline strip: it titles the whole card, so it sits apart from the Wordocious row's glow.
          §18.4: white at 72% with a background blur (globals.css .banner-frost). */}
      <div className="banner-frost relative flex flex-col gap-1" style={{ padding: `${slots.stripTop}px 8px 10px 12px` }}>
      <div className="flex items-center gap-1">
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5" style={{ paddingRight: tierArt || seasonArt ? 0 : BANNER_HOST_CLEARANCE - 8 }}>
          {/* Z: the headline box is always two lines tall (one-line headlines center in it). */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5" style={{ height: slots.headline }}>
            {content.showTrophy && <Icon3D name="trophy" size={18} className="shrink-0" />}
            {/* The old WORDOCIOUS wordmark style (Nunito Black, violet→pink) with a soft pink glow;
                the double-flawless gold day keeps its tier ink. */}
            <span
              key={playMode}
              ref={headRef}
              className="font-black mode-xfade"
              style={{
                fontSize: HEAD_SIZE, letterSpacing: 0.4, lineHeight: HEAD_LINE,
                ...(double
                  ? { color: headInk }
                  : {
                      backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
                      WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent',
                      filter: 'drop-shadow(0 0 3px rgba(236,72,153,0.25))',
                    }),
              }}
            >
              {headline}
            </span>
          </div>
          {/* Nothing to share before the first finished game (iOS/Android parity).
              Z: the share box stays reserved (empty) when there is nothing to share. */}
          {content.showShare ? (
            <button
              type="button"
              onClick={onShare}
              aria-label="Share today's progress"
              className="mode-xfade shrink-0 flex items-center justify-center active:opacity-60"
              style={{ width: slots.shareWidth, height: slots.shareWidth }}
            >
              <Icon3D name="share" size={24} />
            </button>
          ) : (
            <span aria-hidden="true" className="shrink-0" style={{ width: slots.shareWidth, height: slots.shareWidth }} />
          )}
        </div>
      </div>
      {seasonSlot && (
        <SeasonArt
          src={HALLOWEEN_BANNER_SRC}
          onReady={setSeasonArtOk}
          className="relative shrink-0 art-pop"
          style={{ height: TIER_ART_H, width: 'auto', maxWidth: '46%', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(76, 29, 149, 0.18))' }}
        />
      )}
      {tierArt && (
        // Z: one art box in both modes — today's celebration art sizes it; in
        // Unlimited U's loop crossfades in over the same box.
        <div className="relative shrink-0" style={{ width: Math.round((TIER_ART_H * ART_SIZE[tierArt.art][0]) / ART_SIZE[tierArt.art][1]), maxWidth: '46%', height: slots.artHeight }}>
          <Image
            src={artSrc(tierArt.art)}
            alt=""
            aria-hidden="true"
            width={ART_SIZE[tierArt.art][0]}
            height={ART_SIZE[tierArt.art][1]}
            priority
            draggable={false}
            sizes={`${Math.round((TIER_ART_H * ART_SIZE[tierArt.art][0]) / ART_SIZE[tierArt.art][1])}px`}
            className="relative select-none pointer-events-none art-pop"
            style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(76, 29, 149, 0.18))', opacity: content.art === 'tier' ? 1 : 0, transition: 'opacity 160ms ease-out' }}
          />
          <Image
            src={artSrc(LOOP_ART)}
            alt=""
            aria-hidden="true"
            width={ART_SIZE[LOOP_ART][0]}
            height={ART_SIZE[LOOP_ART][1]}
            draggable={false}
            sizes={`${Math.round((TIER_ART_H * ART_SIZE[LOOP_ART][0]) / ART_SIZE[LOOP_ART][1])}px`}
            className="absolute inset-0 select-none pointer-events-none"
            style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(194, 65, 12, 0.22))', opacity: content.art === 'loop' ? 1 : 0, transition: 'opacity 160ms ease-out' }}
          />
        </div>
      )}
      </div>
        {/* Z: a fixed-height controls row; the clock line is clamped to its three lines and crossfades. */}
        <div className="flex items-center gap-2" style={{ paddingRight: 4, height: slots.controls }}>
          <div
            key={playMode}
            className="mode-xfade flex-1 min-w-0 font-extrabold"
            style={{ fontSize: 10.5, letterSpacing: 0.4, lineHeight: '12px', maxHeight: slots.controls, color: subInk,
                     overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
          >
            {clockLine}
          </div>
          <div
            role="group"
            aria-label="Daily or Unlimited"
            className="relative flex shrink-0"
            style={{ padding: MODE_SWITCH.pad, borderRadius: 999, background: 'rgba(124,58,237,0.12)', width: switchBox.width, height: switchBox.height }}
          >
            <span
              aria-hidden="true"
              className="mode-switch-thumb absolute"
              style={{
                top: MODE_SWITCH.pad, left: MODE_SWITCH.pad, height: MODE_SWITCH.height, width: switchBox.thumb.width,
                transform: `translateX(${switchBox.thumb.x}px)`, borderRadius: 999,
                background: '#f5eeff', boxShadow: '0 1px 3px rgba(76, 29, 149, 0.18)',
              }}
            />
            {segment('daily', 'DAILY', switchBox.daily.width)}
            {segment('unlimited', 'UNLIMITED', switchBox.unlimited.width)}
          </div>
        </div>
      </div>

      <div className="relative flex flex-col gap-2" style={{ padding: '10px 12px 6px' }}>
        {row(word, wTier, 'WORDOCIOUS', 'lg')}
      </div>
      <div className="relative flex flex-col gap-2" style={{ padding: '8px 12px 12px' }}>
        {row(puzzles, pTier, 'PUZZLES', 'sm')}
      </div>
    </div>
  );

  // The home host (W) stands at the strip's right end; Flawless crowns him.
  // G4: a swept / flawless banner carries the cast in its art instead.
  if (tierArt || seasonArt) return <div className="relative shrink-0" style={{ paddingTop: 16 }}>{card}</div>;
  return (
    <BannerHost id={PAGE_HOSTS.home} pose="art-pose-w-wave" crown={wTier === 'flawless'}>
      {card}
    </BannerHost>
  );
}
