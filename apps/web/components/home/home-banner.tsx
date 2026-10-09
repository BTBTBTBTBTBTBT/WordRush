'use client';

import { HostInviteBubble, finishNudge, nudgeDone, openDressUp, useNudgeVersion } from '@/components/profile/dress-up';
import { openGoProPopup } from '@/lib/payment/go-pro-popup';
import { UNLIMITED_PEACH } from '@/components/game/finished-kit';
import { CANDY_INK, candyPad, threeSlice } from '@/lib/candy-toggle';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BubbleLine } from '@/components/ui/bubble-text';
import { readSurfacesChoice, useSeason } from '@/lib/season';
import { seasonBanner, seasonHeadlineSpec, seasonSurfaces } from '@/lib/season-kit';
import { SeasonArt } from '@/components/ui/season-art';
import Image from 'next/image';
import { alphaHex, softBorder } from '@/lib/soft-surface';
import { SoftNum } from '@/components/ui/soft-number';
import { Check } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { ART_SIZE, artSrc, badgeSrc, isGameArtIcon, onPageShadow } from '@/lib/art';
import {
  bannerClockLine, bannerHeadline, groupStatus, groupTier, unlimitedGroupStatus,
  type BannerTier, type GroupProgress,
} from '@wordle-duel/core';
import type { DailyCompletion } from '@/lib/daily-service';
import type { HomeCard } from './mode-chrome';
import { useHomeHost } from '@/components/avatar/player-avatar';
import { HomeHost } from '@/components/home/home-host';
import { homeHostHidden } from '@/lib/home-host';
import { homeHostInviteAllowed } from '@/lib/home-host-cache';
import { BANNER_SLOT, MODE_SWITCH, homeBannerContent, homeBannerSlots } from '@/lib/stationary-layout';
import { HomeClock } from '@/components/home/home-clock';
import { seasonTrimStops, trimPath } from '@/lib/card-trim';
import { headlineRowHeight, homeHeadlineLayout } from '@/lib/home-headline';

// The home banner (founder-approved home redesign, 2026-10-01; spec:
// docs/HOME_REDESIGN_SPEC.md). One window: a frosted headline strip over a
// Wordocious row (the eight sweep dailies) and a Puzzles row (the ten More Games
// dailies). Each row glows on its own (purple sweep, gold flawless) through ONE
// blended background and ONE shimmer; Double Flawless turns the whole card gold.
// The words come from the shared core so iOS and Android print the same thing.

const TIER_COLOR: Record<Exclude<BannerTier, 'none'>, string> = { sweep: '#ebd6fd', flawless: '#fde68a' };
/** The tier fills as washes over the card base (≈ the colors above on white). */
const TIER_WASH: Record<Exclude<BannerTier, 'none'>, string> = { sweep: alphaHex('#a855f7', 0.24), flawless: alphaHex('#f59e0b', 0.5) };
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
/** The season banner art's row height (iOS HomeBannerView: maxHeight 104). */
const SEASON_ART_H = 104;
/** Unlimited on a swept / flawless day keeps the art frame (Z), in Unlimited's colors with U's loop. */
const UNLIMITED_BAR = `linear-gradient(90deg, #fdba74, ${UNLIMITED_PEACH} 55%, #ec4899)`;
const LOOP_ART = 'art-scene-unlimited-loop' as const;


/** The thumb's inset inside the candy track's rim. */
const SWITCH_PAD = candyPad(BANNER_SLOT.switchRow);
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
  onOpen: (card: HomeCard) => void;
}

/**
 * BI21: one tile size for both rows — at most 32 px, sized so ten fit with 5 px gaps —
 * and each row spreads edge to edge (justify-between), so the 8- and 10-tile rows end flush.
 */
const TILE_SIZE = `min(${BANNER_SLOT.tileLg}px, calc((100% - ${BANNER_SLOT.tileGapMin * (BANNER_SLOT.tileSlots - 1)}px) / ${BANNER_SLOT.tileSlots}))`;
/** BJ6 round 3: the game art inside a tile — drawn from a 26 px slot (crisp), clamped to TILE_ICON_SHARE of the tile. */
const TILE_ICON = 26;
const TILE_ICON_SHARE = '70%';
const GLOSS = 'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 55%)';

function Tile({ card, result, unlimited, onOpen }: {
  card: HomeCard; result?: DailyCompletion; unlimited: boolean; onOpen: () => void;
}) {
  const Icon = card.icon;
  const iconPx = TILE_ICON;
  const accent = card.accentColor;
  let style: React.CSSProperties;
  let ink: string;
  // FINISH_SPEC BI21 (no bordered boxes): not played = a soft pale tile with the icon
  // dimmed; won = a glossy tile in the game's color, full icon, a small white check;
  // lost = a glossy gray tile; Unlimited = a soft tinted tile, full icon.
  const won = !unlimited && !!result?.won;
  if (unlimited) {
    style = { background: `color-mix(in srgb, ${accent} 16%, #ffffff)`, boxShadow: `0 2px 5px ${accent}2e` };
    ink = accent;
  } else if (result) {
    style = result.won
      ? { background: `${GLOSS}, ${accent}`, boxShadow: `0 1.5px 7px ${accent}8c` }
      : { background: `${GLOSS}, #9ca3af` };
    ink = '#ffffff';
  } else {
    // Not played: pale out of season; on a dark season's glass a dim night tile with a hint of
    // the game color (--season-tile-*), so the played tiles' solid color stands out (iOS parity).
    style = { background: `color-mix(in srgb, ${accent} var(--season-tile-idle-pct, 12%), var(--season-tile-base, #ffffff))` };
    ink = accent;
  }
  const dim = !unlimited && !result ? 0.45 : 1;
  return (
    <button
      type="button"
      data-squish="card"
      onClick={onOpen}
      aria-label={`${card.title}${unlimited ? '' : result ? (result.won ? ', won' : ', played') : ', not played yet'}`}
      className="relative flex items-center justify-center shrink-0"
      style={{ width: TILE_SIZE, aspectRatio: '1 / 1', borderRadius: 8, ...style }}
    >
      <span className="flex items-center justify-center" style={{ opacity: dim, width: TILE_ICON_SHARE, height: TILE_ICON_SHARE }}>
      {Icon && isGameArtIcon(Icon)
        // The 3D game art fills the tile (docs/ART_SPEC.md §3); a soft white
        // halo keeps it readable on a won tile's solid accent.
        ? <Icon style={{ width: iconPx, height: iconPx, ...(result?.won && !unlimited ? { filter: 'drop-shadow(0 0 1.5px rgba(255,255,255,0.95))' } : null) }} />
        : card.romanNumeral
        ? <span className="font-black leading-none" style={{ color: ink, fontSize: card.romanNumeral.length > 2 ? 8 : 11 }}>{card.romanNumeral}</span>
        : Icon
        ? <Icon style={{ width: iconPx, height: iconPx, maxWidth: '100%', maxHeight: '100%', color: ink }} />
        : <Check style={{ width: iconPx, height: iconPx, maxWidth: '100%', maxHeight: '100%', color: ink }} />}
      </span>
      {won && (
        <Check
          aria-hidden="true"
          strokeWidth={4}
          className="absolute"
          style={{ right: 2, bottom: 2, width: 8, height: 8, color: '#ffffff', filter: 'drop-shadow(0 0.5px 0.8px rgba(0,0,0,0.3))' }}
        />
      )}
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

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * BJ6 round 4: the headline slot's width, measured before paint and again only when it changes
 * (one ResizeObserver; whole px, so sub-pixel jitter never re-lays the headline out).
 */
function useSlotWidth(ref: React.RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = Math.round(el.clientWidth);
      setWidth((prev) => (prev === w ? prev : w));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export function HomeBanner({ word, puzzles, todayDailies, playMode, isPro, onModeChange, name, onOpen }: Props) {
  const unlimited = playMode === 'unlimited';
  // FINISH_SPEC Z: the slots (frame, headline box, share box, art box, rows)
  // come from today's DAILY state only, so the switch never moves the tiles or
  // the grids below; the content filling them follows the mode.
  const dailyTier = groupTier(word.progress);
  // BJ6 round 4: the personal greeting laid out for the slot — one size for the device, the
  // name on its own gold line(s) when it doesn't fit on one (never shrunk, scrolled or clipped).
  // Laid out once per width / text change; the row is as tall as the taller mode's headline.
  const hour = new Date().getHours();
  const dailyHeadline = bannerHeadline(word.progress, puzzles.progress, { hour, name, unlimited: false });
  const unlimitedHeadline = bannerHeadline(word.progress, puzzles.progress, { hour, name, unlimited: true });
  const headSlot = useRef<HTMLDivElement>(null);
  const slotWidth = useSlotWidth(headSlot);
  const headLayouts = useMemo(
    () => ({ daily: homeHeadlineLayout(slotWidth, dailyHeadline, name), unlimited: homeHeadlineLayout(slotWidth, unlimitedHeadline, name) }),
    [slotWidth, dailyHeadline, unlimitedHeadline, name],
  );
  const headLayout = unlimited ? headLayouts.unlimited : headLayouts.daily;
  const layoutInput = {
    dailyTier, puzzleTier: groupTier(puzzles.progress), playedAny: word.progress.played + puzzles.progress.played > 0,
    headlineHeight: headlineRowHeight([headLayouts.daily, headLayouts.unlimited]),
  };
  const slots = homeBannerSlots(playMode, layoutInput);
  const content = homeBannerContent(playMode, layoutInput);
  const wTier = content.wordTier;
  const pTier = content.puzzleTier;
  const double = wTier === 'flawless' && pTier === 'flawless';
  // Washes OVER the theme's card base (the other Home cards' rule, modeCardSurface): the
  // same pastels on light, the dark surface under them in dark mode (it used to stay light).
  const topColor = wTier === 'none' ? alphaHex('#7c3aed', 0.12) : TIER_WASH[wTier];
  const bottomColor = pTier === 'none' ? alphaHex('#4f46e5', 0.15) : TIER_WASH[pTier];
  // BJ6 round 3 flair: a very soft diagonal sheen over the fill (static).
  const normalBackground = unlimited
    ? `${CARD_SHEEN}, linear-gradient(135deg, ${alphaHex('#ec4899', 0.14)}, ${alphaHex('#8b5cf6', 0.14)}), var(--color-card-base, #ffffff)`
    : `${CARD_SHEEN}, linear-gradient(135deg, rgba(255,255,255,var(--banner-gloss, 0.35)), rgba(255,255,255,0) 55%), linear-gradient(180deg, ${topColor} 0%, ${topColor} 52%, ${bottomColor} 72%, ${bottomColor} 100%), var(--color-card-base, #ffffff)`;
  const subInk = double ? 'var(--banner-ink-gold, #92400e)' : 'var(--banner-ink, #6d28d9)';
  // Season surfaces (iOS SeasonHeroBackdrop): the hero's own translucent fill (the wall glows
  // through), a soft glow behind the banner art, the season's drip cap and a corner cobweb; no
  // tier washes, frost, sheen, confetti or shimmer. Static gradients only (no blur).
  const season = useSeason();
  const look = useMemo(() => {
    const s = seasonSurfaces(season, readSurfacesChoice());
    return s && (s.hero || s.card) ? s : null;
  }, [season]);
  const headSpec = useMemo(() => seasonHeadlineSpec(look), [look]);
  const background = look
    ? `${look.bannerGlow ? (look.tone === 'dark'
        ? 'radial-gradient(circle 190px at 50% 46%, var(--season-banner-glow), transparent)'
        : 'radial-gradient(ellipse at center, transparent 42%, var(--season-banner-glow) 78%)') + ', ' : ''}var(--season-hero-fill)`
    : normalBackground;
  const shimmer = !look && !unlimited && (wTier !== 'none' || pTier !== 'none');
  // The art frame belongs to the day (a swept / flawless Daily), not to the mode.
  const tierArt = slots.frame === 'art' && dailyTier !== 'none' ? TIER_ART[dailyTier] : null;
  const frameAccent = tierArt ? (unlimited ? UNLIMITED_PEACH : tierArt.accent) : null;
  // FINISH_SPEC X: during Halloween the banner wears its Halloween art in a
  // centered row under the headline strip (art-scene-banner-halloween; the row
  // collapses if the file is missing). Same in both modes, so the
  // Daily/Unlimited switch never moves anything; a tier's art wins.
  const host = useHomeHost();
  useNudgeVersion();
  const invite = host.choice.kind === 'w' && host.seeded && host.userId && !nudgeDone('host', host.userId) ? host.seeded : null;
  // 2.7.1: the cached plain mascot paints at once, but its "Make me yours!" bubble waits for the live profile.
  const inviteLive = !!invite && homeHostInviteAllowed(host.phase);
  const [seasonArtOk, setSeasonArtOk] = useState(false);
  /** A season banner file that failed to load (its row collapses; another season's file still gets a try). */
  const [missingSeasonArt, setMissingSeasonArt] = useState<string | null>(null);
  // Season preview: the registry's Home banner for the active season (lib/season-kit.ts).
  const seasonBannerArt = seasonBanner(season);
  const seasonSlot = !!seasonBannerArt && !tierArt;
  const seasonArt = seasonSlot && seasonArtOk;


  // Z: fixed-width segments, one font weight in both states; only the thumb slides.
  // BI21: two EQUAL halves; the PRO chip sits inside the UNLIMITED half beside its label.
  const segment = (mode: 'daily' | 'unlimited', label: string) => {
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
        className="relative font-black flex items-center justify-center whitespace-nowrap"
        style={{
          flex: '1 1 0', minWidth: 0, height: MODE_SWITCH.height, padding: 0, borderRadius: 999, fontSize: 11, letterSpacing: 0.6,
          background: 'transparent',
          color: on ? CANDY_INK.on : CANDY_INK.off,
          textShadow: on ? '0 1px 0 rgba(76, 29, 149, 0.45)' : undefined,
          transition: 'color 160ms ease-out',
        }}
      >
        {/* Proposal 1 (night art 10-03): the gold PRO crown rides inside the Unlimited half — no pill.
            AA4: only for players without Pro (it marks the perk, never Pro's own switch). */}
        <span className="inline-flex items-center gap-1">
          {label}
          {locked && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={badgeSrc('pro-crown-sprite')} alt="" aria-hidden="true" width={15} height={15} decoding="async" draggable={false} className="select-none pointer-events-none" style={{ width: 15, height: 15, marginTop: -2 }} />
          )}
        </span>
      </button>
    );
  };

  const row = (r: BannerRow, tier: BannerTier, label: string) => (
    <>
      <RowHeader
        label={label}
        status={unlimited ? unlimitedGroupStatus(r.unlimitedPlayed) : groupStatus(r.progress)}
        // Theme-aware: the light inks on the light card, pastels on the dark card (globals.css --banner-ink*).
        ink={tier === 'flawless' ? `var(--banner-ink-gold, ${TIER_INK[tier]})` : `var(--banner-ink, ${TIER_INK[tier]})`}
        // AS7: no row flames — every streak lives in the streak-flame popup.
        streak={null}
        height={slots.rowHeader}
      />
      <div className="flex justify-between w-full">
        {r.cards.map((c) => (
          <Tile
            key={c.id}
            card={c}
            result={!unlimited && c.dbKey ? todayDailies.get(c.dbKey) : undefined}
            unlimited={unlimited}
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
        boxShadow: double ? '0 0 26px rgba(245,158,11,0.8)' : look?.glow ? '0 0 12px var(--season-glow)' : onPageShadow('0 4px 14px rgba(76,29,149,0.08)'),
      }}
    >
      {look?.cobweb && <SeasonCobweb />}
      {/* G4: the swept / flawless banner's own top bar (gold / pink). BJ6 round 3: a host day
          wears the brand candy frosting cap instead (the game cards' trim, purple → pink). */}
      {tierArt
        ? <div aria-hidden="true" className="relative" style={{ height: slots.topBar, background: unlimited ? UNLIMITED_BAR : tierArt.bar, transition: 'background 160ms ease-out' }} />
        : <BrandCap height={slots.topBar} season={!!look?.cap} />}
      {/* BJ6 round 3 flair: a few tiny cast-color confetti dots in the empty top corners, mirrored. */}
      {!look && <CornerConfetti top={slots.topBar} />}
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
      {/* FINISH_SPEC BI21 (founder 10-03: "fill that space better … it doesn't look even"):
          the headline centered on the card's center line, then a centered wide
          DAILY | UNLIMITED switch, then the centered meta line. */}
      {/* BJ6 symmetric hero (founder 10-03): the host stands centered on the card's top edge
          (drawn beside the card, below); its lower 44 px sit in the strip's top padding, and
          the headline / switch / meta line center under it — the card mirrors on its center line. */}
      <div className={`${look ? '' : 'banner-frost '}relative flex flex-col`} style={{ gap: BANNER_SLOT.stripGap, padding: `${slots.stripTop}px 12px ${BANNER_SLOT.stripBottom}px` }}>
      <div className="flex items-center gap-1">
      <div className="flex-1 min-w-0">
        <div className="relative flex items-start">
          {/* Z + BJ6 round 4: the headline box is as tall as the taller mode's laid-out lines. */}
          <div ref={headSlot} className="flex-1 min-w-0 flex flex-col justify-center" style={{ height: slots.headline }}>
            <span className="sr-only" role="heading" aria-level={2}>{headLayout.lines.join(' ')}</span>
            {/* FINISH_SPEC AR: the live lettering (purple → magenta, gold numbers; the double-flawless
                gold day celebrates). BJ6 round 4: every line at the device's ONE size; a stacked name
                is the gold hero line(s); line 1 wears the gold sparkles. FitOneLine is only a
                safety net (it shrinks a line that truly doesn't fit, e.g. a nameless long status). */}
            <div key={playMode} className="mode-xfade flex flex-col items-stretch" aria-hidden="true">
              {headLayout.lines.map((line, i) => {
                const gold = headLayout.nameLines.includes(i);
                return (
                  <div key={`${i}-${line}`} className="flex items-center justify-center" style={{ height: headLayout.lineHeight }}>
                    <FitOneLine>
                      <span className="inline-flex items-center" style={{ gap: 6 }}>
                        {i === 0 && content.showTrophy && <Icon3D name="trophy" size={18} className="shrink-0" />}
                        {i === 0 && <GoldSparkle />}
                        <BubbleLine
                          text={line}
                          names={headLayout.lines.length === 1 && name ? [name] : undefined}
                          palette={gold ? 'leaderboard' : double ? 'celebrate' : 'home'}
                          spec={double ? null : headSpec}
                          size={headLayout.size}
                          level={2}
                          style={{ whiteSpace: 'nowrap', display: 'inline-block', width: 'auto' }}
                        />
                        {i === 0 && <GoldSparkle mirror />}
                      </span>
                    </FitOneLine>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
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
        {/* Z: a fixed-height controls block in both modes. BI21: the switch centered at
            ~76% of the card (at most 280 px) in two equal halves, then the meta line. */}
        <div className="flex flex-col items-center" style={{ height: slots.controls, gap: BANNER_SLOT.controls - BANNER_SLOT.switchRow - BANNER_SLOT.metaLine }}>
          <div
            role="group"
            aria-label="Daily or Unlimited"
            className="relative flex"
            style={{ padding: MODE_SWITCH.pad, width: '100%', maxWidth: 260, height: BANNER_SLOT.switchRow }}
          >
            {/* The candy toggle sprites (night art 10-03): the glossy track + a sliding glossy thumb, three-sliced. */}
            <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={threeSlice('track', BANNER_SLOT.switchRow, '--candy-track')} />
            <span
              aria-hidden="true"
              className="mode-switch-thumb absolute"
              style={{
                top: SWITCH_PAD, left: SWITCH_PAD, height: BANNER_SLOT.switchRow - SWITCH_PAD * 2, width: `calc(50% - ${SWITCH_PAD}px)`,
                transform: unlimited ? 'translateX(100%)' : 'translateX(0)',
                ...threeSlice('thumb-on', BANNER_SLOT.switchRow - SWITCH_PAD * 2, '--candy-thumb'),
              }}
            />
            {segment('daily', 'DAILY')}
            {segment('unlimited', 'UNLIMITED')}
          </div>
          <div
            key={playMode}
            className="mode-xfade w-full text-center font-extrabold truncate"
            style={{ fontSize: 11, fontVariant: 'small-caps', letterSpacing: 0.4, lineHeight: `${BANNER_SLOT.metaLine}px`, height: BANNER_SLOT.metaLine, color: subInk, fontVariantNumeric: 'tabular-nums' }}
          >
            {/* The live clock is a leaf (components/home/home-clock.tsx): only this line re-renders each second. */}
            <HomeClock render={(clock) => bannerClockLine(word.progress, puzzles.progress, clock, unlimited)} />
          </div>
        </div>
      </div>

      {/* Season art (iOS parity, HomeBannerView momentArt): its own centered row under the strip
          (at most 104 tall, 6 above, 10 at the sides), so the greeting keeps the full width and its
          one size. The row's height is held while the file loads and only drops if it's missing. */}
      {seasonSlot && missingSeasonArt !== seasonBannerArt && (
        <div className="relative flex justify-center" style={{ height: SEASON_ART_H + 6, padding: '6px 10px 0' }}>
          <SeasonArt
            src={`/art/${seasonBannerArt}.webp`}
            onReady={(ok) => { setSeasonArtOk(ok); if (!ok) setMissingSeasonArt(seasonBannerArt); }}
            className="relative art-pop"
            style={{ height: SEASON_ART_H, width: 'auto', maxWidth: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(76, 29, 149, 0.18))' }}
          />
        </div>
      )}
      {/* BJ6 round 3 flair: the two progress rows sit in one soft lavender band — the card reads as two zones. */}
      <div className="relative" style={{ background: look?.raised ? 'color-mix(in srgb, var(--color-surface-alt) 45%, transparent)' : ROWS_BAND }}>
      <div className="relative flex flex-col" style={{ gap: BANNER_SLOT.rowGap, padding: `${BANNER_SLOT.wordPadTop}px ${BANNER_SLOT.rowPadX}px ${BANNER_SLOT.wordPadBottom}px` }}>
        {row(word, wTier, 'WORDOCIOUS')}
      </div>
      <div className="relative flex flex-col" style={{ gap: BANNER_SLOT.rowGap, padding: `${BANNER_SLOT.puzzlePadTop}px ${BANNER_SLOT.rowPadX}px ${BANNER_SLOT.puzzlePadBottom}px` }}>
        {row(puzzles, pTier, 'PUZZLES')}
      </div>
      </div>
    </div>
  );

  // BJ6 symmetric hero: the host centered on the card's top edge — its top 28 above the card
  // (22 of headroom + 6 over the header's empty edge), 60 inside (over the strip's top padding).
  // The share button is in the app header.
  return (
    <div className="relative shrink-0" style={{ paddingTop: slots.headroom }}>
      {card}
      <span
        className="absolute"
        style={{ top: slots.headroom - BANNER_SLOT.hostRise, left: `calc(50% - ${BANNER_SLOT.hostSize / 2}px)`, width: BANNER_SLOT.hostSize, height: BANNER_SLOT.hostSize, zIndex: 2 }}
      >
        <HomeHost
          choice={invite ? { kind: 'mascot', config: invite } : host.choice}
          initial={host.initial}
          level={host.level}
          pro={host.pro}
          size={BANNER_SLOT.hostSize}
          // The celebration art carries the cast: W steps out (keeps his slot); your own host stays.
          // 2.7.1: a session is expected but its look isn't known yet → invisible (slot kept), never W.
          hidden={host.phase === 'unknown' || (!invite && homeHostHidden(host.choice, !!(tierArt || seasonArt)))}
        />
        {inviteLive && host.userId && (
          <>
            {/* Door 2 (founder 10-05): the plain host is a button into the Dressing Room, with its bubble. */}
            <button type="button" aria-label="Your mascot. Make it yours" className="absolute inset-0 border-0 bg-transparent p-0 cursor-pointer"
              onClick={() => { finishNudge('host', host.userId); openDressUp({ kind: 'room', tab: 'body' }); }} />
            <span className="absolute" style={{ left: BANNER_SLOT.hostSize * 0.82, top: 4 }}><HostInviteBubble uid={host.userId} /></span>
          </>
        )}
      </span>
    </div>
  );
}

// ── BJ6 round 3 flair (founder 10-03: "that window needs flair … it looks unfinished") ──
// Static and cheap: no animation, no blur, no outline; symmetric about the card's center line.

/** A very soft diagonal sheen over the card fill. */
const CARD_SHEEN = 'linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.22) 46%, rgba(255,255,255,0) 62%)';
/** The progress rows' band (lavender ~10%). */
const ROWS_BAND = 'rgba(167, 139, 250, 0.10)';
const BRAND_FROM = '#7C3AED';
const BRAND_TO = '#EC4899';
const BRAND_MID = '#A855F7';

/** Season surfaces: a small cobweb in the hero's top-trailing corner (iOS CobwebShape): five
 *  threads fanning down and left, joined by three sagging rings. Static SVG, one stroke. */
const COBWEB_PATH = (() => {
  const len = 58;
  const a = [90, 112, 135, 158, 180].map((d) => (d * Math.PI) / 180);
  const pt = (t: number, d: number) => `${(len + Math.cos(t) * d).toFixed(2)} ${(Math.sin(t) * d).toFixed(2)}`;
  let p = a.map((t) => `M${len} 0L${pt(t, len)}`).join('');
  for (const f of [0.32, 0.58, 0.84]) {
    const d = len * f;
    p += `M${pt(a[0], d)}`;
    for (let i = 1; i < a.length; i++) p += `Q${pt((a[i - 1] + a[i]) / 2, d * 0.8)} ${pt(a[i], d)}`;
  }
  return p;
})();

function SeasonCobweb() {
  return (
    <svg aria-hidden="true" className="absolute pointer-events-none" style={{ top: 0, right: 0, zIndex: 0 }} width={58} height={58} viewBox="0 0 58 58">
      <path d={COBWEB_PATH} fill="none" stroke="var(--season-cobweb)" strokeWidth={0.9} strokeLinecap="round" />
    </svg>
  );
}
const CAP_TRIM = { viewW: 360, drip: 4, bumps: 16 } as const;

/** The brand candy frosting cap (the game cards' trim shape, purple → pink, with a glossy lip). */
function BrandCap({ height, season = false }: { height: number; season?: boolean }) {
  const gid = `bcap${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (season) {
    // Season surfaces: the season's drip stops top → bottom (lip, body with the brand pink mixed in, base).
    return (
      <div aria-hidden="true" className="relative pointer-events-none" style={{ height, zIndex: 1 }}>
        <svg className="absolute inset-x-0 top-0 block" width="100%" height={height + CAP_TRIM.drip} viewBox={`0 0 ${CAP_TRIM.viewW} ${height + CAP_TRIM.drip}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={`${gid}s`} x1="0" y1="0" x2="0" y2="1">
              {seasonTrimStops(BRAND_MID).map(([o, c]) => <stop key={o} offset={o} style={{ stopColor: c }} />)}
            </linearGradient>
          </defs>
          <path d={trimPath(CAP_TRIM.viewW, height, CAP_TRIM.drip, CAP_TRIM.bumps)} fill={`url(#${gid}s)`} />
        </svg>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="relative pointer-events-none" style={{ height, zIndex: 1 }}>
      <svg className="absolute inset-x-0 top-0 block" width="100%" height={height + CAP_TRIM.drip} viewBox={`0 0 ${CAP_TRIM.viewW} ${height + CAP_TRIM.drip}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`${gid}h`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={BRAND_FROM} />
            <stop offset="1" stopColor={BRAND_TO} />
          </linearGradient>
          <linearGradient id={`${gid}g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity={0.4} />
            <stop offset="0.45" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={trimPath(CAP_TRIM.viewW, height, CAP_TRIM.drip, CAP_TRIM.bumps)} fill={`url(#${gid}h)`} />
        <path d={trimPath(CAP_TRIM.viewW, height, CAP_TRIM.drip, CAP_TRIM.bumps)} fill={`url(#${gid}g)`} />
      </svg>
    </div>
  );
}

/** Tiny cast-color dots (2–4 px, ~30%) in the top corners — the right side mirrors the left. */
const CONFETTI_DOTS: ReadonlyArray<{ x: number; y: number; d: number; c: string }> = [
  { x: 14, y: 14, d: 4, c: '#7c3aed' },
  { x: 34, y: 30, d: 3, c: '#ec4899' },
  { x: 22, y: 46, d: 2, c: '#f5a524' },
  { x: 54, y: 18, d: 2, c: '#14b8a6' },
  { x: 70, y: 40, d: 3, c: '#3b82f6' },
];

function CornerConfetti({ top }: { top: number }) {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 pointer-events-none" style={{ top, height: 60, zIndex: 1 }}>
      {CONFETTI_DOTS.flatMap((p, i) => [
        <span key={`l${i}`} className="absolute rounded-full" style={{ left: p.x, top: p.y, width: p.d, height: p.d, background: p.c, opacity: 0.3 }} />,
        <span key={`r${i}`} className="absolute rounded-full" style={{ right: p.x, top: p.y, width: p.d, height: p.d, background: p.c, opacity: 0.3 }} />,
      ])}
    </div>
  );
}

/** A small gold four-point star (SVG), mirrored on the right of the headline. */
function GoldSparkle({ mirror = false }: { mirror?: boolean }) {
  return (
    <svg aria-hidden="true" width={14} height={14} viewBox="0 0 20 20" className="shrink-0" style={mirror ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M10 0 C11 6 14 9 20 10 C14 11 11 14 10 20 C9 14 6 11 0 10 C6 9 9 6 10 0 Z" fill="#f5a524" />
      <path d="M10 4 C10.6 7.4 12.6 9.4 16 10 C12.6 10.6 10.6 12.6 10 16 C9.4 12.6 7.4 10.6 4 10 C7.4 9.4 9.4 7.4 10 4 Z" fill="#ffe7a3" />
      <circle cx={15.5} cy={4.5} r={1.4} fill="#fcd34d" />
    </svg>
  );
}

/**
 * BH3: fits one line of lettering to its row — measured once per size change and scaled down
 * (transform only) so it never wraps; centered. Cheap: one ResizeObserver, no per-frame work.
 */
function FitOneLine({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    const fit = () => {
      const need = i.scrollWidth;
      const have = b.clientWidth;
      setScale(need > have && need > 0 ? Math.max(0.55, have / need) : 1);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="min-w-0 flex-1 flex justify-center" style={{ overflow: 'visible' }}>
      <div ref={inner} style={{ whiteSpace: 'nowrap', transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: 'center' }}>
        {children}
      </div>
    </div>
  );
}
