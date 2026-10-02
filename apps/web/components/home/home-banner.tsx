'use client';

import { useLayoutEffect, useRef } from 'react';
import { softIconTile } from '@/lib/soft-surface';
import { SoftNum } from '@/components/ui/soft-number';
import { Check, Infinity as InfinityIcon } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { isGameArtIcon, onPageShadow } from '@/lib/art';
import {
  bannerClockLine, bannerHeadline, groupStatus, groupStreak, groupTier, unlimitedGroupStatus,
  type BannerTier, type GroupProgress,
} from '@wordle-duel/core';
import type { DailyCompletion } from '@/lib/daily-service';
import type { HomeCard } from './mode-chrome';
import { BannerHost, BANNER_HOST_CLEARANCE } from '@/components/ui/mascot';
import { PAGE_HOSTS } from '@/lib/mascots';

// The home banner (founder-approved home redesign, 2026-10-01; spec:
// docs/HOME_REDESIGN_SPEC.md). One window: a frosted headline strip over a
// Wordocious row (the eight sweep dailies) and a Puzzles row (the ten More Games
// dailies). Each row glows on its own (purple sweep, gold flawless) through ONE
// blended background and ONE shimmer; Double Flawless turns the whole card gold.
// The words come from the shared core so iOS and Android print the same thing.

const TIER_COLOR: Record<Exclude<BannerTier, 'none'>, string> = { sweep: '#ebd6fd', flawless: '#fde68a' };
const TIER_INK: Record<BannerTier, string> = { none: '#6d28d9', sweep: '#7e22ce', flawless: '#92400e' };

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

function RowHeader({ label, status, ink, streak }: { label: string; status: string; ink: string; streak: number | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-black" style={{ letterSpacing: 1, color: ink }}>{label}</span>
      <span className="flex-1 text-[10px] font-black" style={{ letterSpacing: 0.5, color: ink }}>{status}</span>
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
  const wTier = unlimited ? 'none' : groupTier(word.progress);
  const pTier = unlimited ? 'none' : groupTier(puzzles.progress);
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
  }, [headline]);

  const segment = (mode: 'daily' | 'unlimited', label: string) => {
    const on = playMode === mode;
    return (
      <button
        type="button"
        onClick={() => onModeChange(mode)}
        aria-pressed={on}
        className="font-black transition-colors"
        style={{
          height: 26, padding: '0 10px', borderRadius: 999, fontSize: 10.5, letterSpacing: 0.6,
          background: on ? '#f5eeff' : 'transparent',
          boxShadow: on ? '0 1px 3px rgba(76, 29, 149, 0.18)' : undefined,
          color: on ? (mode === 'daily' ? '#4c1d95' : '#6d28d9') : '#7c3aed',
        }}
      >
        {label}
      </button>
    );
  };

  const row = (r: BannerRow, tier: BannerTier, label: string, size: 'lg' | 'sm') => (
    <>
      <RowHeader
        label={label}
        status={unlimited ? unlimitedGroupStatus(r.unlimitedPlayed) : groupStatus(r.progress)}
        ink={TIER_INK[tier]}
        streak={unlimited ? null : groupStreak(tier, r.streaks)}
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

  return (
    // The home host (W) stands at the strip's right end; Flawless crowns him.
    <BannerHost id={PAGE_HOSTS.home} pose="art-pose-w-wave" crown={wTier === 'flawless'}>
    <div
      className="relative shrink-0 overflow-hidden w-full"
      style={{
        // §18.4: radius 22, the full content width.
        borderRadius: 22, background,
        boxShadow: double ? '0 0 26px rgba(245,158,11,0.8)' : onPageShadow('0 4px 14px rgba(76,29,149,0.08)'),
      }}
    >
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
      <div className="banner-frost relative flex flex-col gap-1" style={{ padding: '12px 8px 10px 12px' }}>
        <div className="flex items-start gap-1.5" style={{ paddingRight: BANNER_HOST_CLEARANCE - 8 }}>
          <div className="flex-1 flex items-center gap-1.5" style={{ minHeight: 30 }}>
            {double && <Icon3D name="trophy" size={18} className="shrink-0" />}
            {unlimited && <InfinityIcon className="w-5 h-5 shrink-0" style={{ color: '#7c3aed' }} />}
            {/* The old WORDOCIOUS wordmark style (Nunito Black, violet→pink) with a soft pink glow;
                the double-flawless gold day keeps its tier ink. */}
            <span
              ref={headRef}
              className="font-black"
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
          {/* Nothing to share before the first finished game (iOS/Android parity). */}
          {!unlimited && word.progress.played + puzzles.progress.played > 0 && (
            <button
              type="button"
              onClick={onShare}
              aria-label="Share today's progress"
              className="shrink-0 flex items-center justify-center active:opacity-60"
              style={{ width: 36, height: 36 }}
            >
              <Icon3D name="share" size={24} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2" style={{ paddingRight: 4 }}>
          <div className="flex-1 font-extrabold" style={{ fontSize: 10.5, letterSpacing: 0.4, color: subInk }}>{clockLine}</div>
          {isPro && (
            <div role="group" aria-label="Daily or Unlimited" className="flex" style={{ padding: 2, borderRadius: 999, background: 'rgba(124,58,237,0.12)' }}>
              {segment('daily', 'DAILY')}
              {segment('unlimited', 'UNLIMITED')}
            </div>
          )}
        </div>
      </div>

      <div className="relative flex flex-col gap-2" style={{ padding: '10px 12px 6px' }}>
        {row(word, wTier, 'WORDOCIOUS', 'lg')}
      </div>
      <div className="relative flex flex-col gap-2" style={{ padding: '8px 12px 12px' }}>
        {row(puzzles, pTier, 'PUZZLES', 'sm')}
      </div>
    </div>
    </BannerHost>
  );
}
