'use client';

import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { castPreset, STAGE_ART, STAGE_TINT, WIZARD_HAT_PART } from '@wordle-duel/core';
import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { useAuth } from '@/lib/auth-context';
import { artSrc, type ArtName } from '@/lib/art';
import { alphaHex } from '@/lib/soft-surface';
import { CastButton } from '@/components/ui/cast-button';
import { castColorForAccent } from '@/lib/cast-accent';
import { Podium, type PodiumPlace } from '@/components/leaderboard/podium';

// FRIDAY-QUEUE items 11 + 11b: the Leaderboard is ONE living stage. These are its pieces; the page
// (app/daily/page.tsx) composes them inside <LeaderboardStage>, which owns the continuous backdrop:
// a sky wash in the SELECTED GAME's tint (clouds on top), the sunburst light behind the podium, the
// floor glow under it — all one layer, so a game switch sweeps the tint through title, strip and podium
// together. Shared constants (host table, tint alphas, ledge step positions) live in core leaderboard-stage.ts.

const LB_CLOUD_FADE = 'linear-gradient(to bottom, #000 0%, #000 62%, transparent 92%)';
const WHITE_FALLBACK = { ...castPreset('w'), display: 'mascot' as const };

/** The one stage container + its continuous backdrop. Children stack above it. */
export function LeaderboardStage({ accent, children, className = '' }: { accent: string; children: ReactNode; className?: string }) {
  return (
    <section className={`lb-stage relative overflow-hidden ${className}`} style={{ borderRadius: 24, ['--lb-accent' as string]: accent } as CSSProperties}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ zIndex: 0, transition: 'background 380ms ease' }}>
        {/* the sky: the game's tint, strongest at the top, gone by the bottom */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${alphaHex(accent, STAGE_TINT.skyTop)} 0%, ${alphaHex(accent, STAGE_TINT.skyMid)} 52%, ${alphaHex(accent, STAGE_TINT.skyBottom)} 100%)`,
            transition: 'background 380ms ease',
          }}
        />
        {/* clouds drifting across the very top */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artSrc(STAGE_ART.clouds as ArtName)} alt="" width={420} height={149} decoding="async" draggable={false}
          className="absolute select-none"
          // The cloud bank ends ABOVE the WORDOCIOUS row (founder 10-09): lifted, and its lower edge fades out instead of stopping under the text.
          style={{ top: -26, left: 0, width: '100%', height: 'auto', opacity: 0.75, WebkitMaskImage: LB_CLOUD_FADE, maskImage: LB_CLOUD_FADE }} />
        {/* the sunburst: white light fanning from behind the podium's first place */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artSrc(STAGE_ART.sunburst as ArtName)} alt="" width={1200} height={600} decoding="async" draggable={false}
          className="absolute select-none" style={{ left: '-15%', width: '130%', bottom: 0, opacity: STAGE_TINT.rays, mixBlendMode: 'soft-light' }} />
        {/* the floor glow under the steps */}
        <div className="absolute left-0 right-0" style={{ bottom: 0, height: 60, background: `radial-gradient(ellipse at 50% 100%, ${alphaHex(accent, STAGE_TINT.floorGlow)}, ${alphaHex(accent, 0)} 70%)`, transition: 'background 380ms ease' }} />
      </div>
      <div className="relative" style={{ zIndex: 1 }}>{children}</div>
    </section>
  );
}

/** A cast host standing at the title's edge (`art-pose-<id>-<pose>`, 320 px square art). */
export function Host({ castId, pose, size, flip = false }: { castId: string; pose: string; size: number; flip?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={artSrc(`art-pose-${castId}-${pose}` as ArtName)}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      className="select-none pointer-events-none shrink-0"
      style={{ width: size, height: size, objectFit: 'contain', transform: flip ? 'scaleX(-1)' : undefined, filter: 'drop-shadow(0 4px 5px rgba(60,20,120,0.22))' }}
    />
  );
}

/** The player's own mascot, full body, alive when the living switch is on (their look; W for a guest). */
export function OwnMascot({ size, wizardHat = false, lean = 0, onTap, hopKey = 0 }: {
  size: number;
  /** Wizard Wednesday: the wizard hat for the day (display-only, never saved). */
  wizardHat?: boolean;
  /** Lean toward the title, degrees (base fixed). */
  lean?: number;
  /** Tapping the mascot (the Leaderboard title: the letters bounce). */
  onTap?: () => void;
  /** Bumped on each tap: replays the hop. */
  hopKey?: number;
}) {
  const { profile } = useAuth();
  const look = usePlayerAvatar({
    name: profile?.username, userId: profile?.id, url: profile?.avatar_url,
    level: profile?.level, pro: profile?.is_pro,
  });
  const base = profile ? look.config : WHITE_FALLBACK;
  const cfg = wizardHat ? { ...base, head: WIZARD_HAT_PART as typeof base.head } : base;
  const figure = (
    <span
      key={hopKey}
      className={`block ${hopKey > 0 ? 'lb-hop' : ''}`}
      style={{ width: size, height: size, lineHeight: 0, transformOrigin: '50% 100%', transform: lean ? `rotate(${lean}deg)` : undefined }}
    >
      <span className={lean ? 'lb-lean block' : 'block'} style={{ transformOrigin: '50% 100%', ['--lean' as string]: `${lean}deg` }}>
        <MascotAvatar config={cfg} initial={profile ? look.initial : 'W'} size={size} cutout living />
      </span>
    </span>
  );
  if (!onTap) return <span className="shrink-0 block" style={{ width: size, height: size, lineHeight: 0 }} aria-hidden="true">{figure}</span>;
  return (
    <button
      data-squish
      type="button"
      onClick={onTap}
      aria-label="Your mascot"
      className="shrink-0 block border-0 bg-transparent p-0 cursor-pointer"
      style={{ width: size, height: size, lineHeight: 0 }}
    >
      {figure}
    </button>
  );
}

/**
 * The compact "Your board" button = today's VIEW BOARD: the family cast button, small, in the board's game color
 * (founder 10-09: the art pill read as ugly; the button wears the game's own color). Default gold.
 */
export function YourBoardButton({ onClick, label = 'View board', accent }: { onClick: () => void; label?: string; accent?: string }) {
  // Founder 10-09: reads "View board" and sits smaller (the small cast pill at 80%, like iOS / Android).
  return (
    <span className="inline-flex shrink-0" style={{ width: 84, height: 26, alignItems: 'center', justifyContent: 'center' }}>
      <CastButton color={accent ? castColorForAccent(accent) : 'gold'} size="sm" onClick={onClick} aria-label={label}
        className="shrink-0" style={{ width: 104, transform: 'scale(0.8)', flex: 'none' }}>
        {label}
      </CastButton>
    </span>
  );
}

/** The main stage podium's one fixed min height (px) across games, incl. the empty state (founder 10-09; iOS stagePodiumHeight 300). */
export const STAGE_PODIUM_HEIGHT = 300;

/** Yesterday's small podium keeps one fixed height (founder 10-09) so the page never jumps while it loads. */
export const YESTERDAY_PODIUM_HEIGHT = 210;

/**
 * Yesterday (founder 10-09): it sits UNDER today's last player and the Completed Today line (not inside the stage),
 * and its collapsed state is a SMALLER COPY of the main podium (gold / silver / bronze steps, the top three's points +
 * detail lines, the same glows); tap to open everyone else (`children`, rows only).
 * `places` are yesterday's podium (1st, 2nd, 3rd in board order).
 */
export function YesterdayLedge({ places, open, onToggle, loading, share, accent, children }: {
  places: PodiumPlace[];
  open: boolean;
  onToggle: () => void;
  loading: boolean;
  share?: ReactNode;
  accent?: string;
  children: ReactNode;
}) {
  // Known and empty: no podium (a blank podium reads unfinished), just one calm line in the header.
  const empty = !loading && places.length === 0;
  return (
    <div className="mb-3" style={{ padding: '0 4px 8px' }}>
      <div className="flex items-center justify-between" style={{ padding: '2px 4px' }}>
        {empty ? (
          <div className="flex items-baseline gap-2 min-w-0" style={{ padding: '4px 2px' }}>
            <span className="font-black lb-gold-ink" style={{ fontSize: 11, letterSpacing: 1.2 }}>YESTERDAY</span>
            <span className="truncate font-bold" style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>No results from yesterday</span>
          </div>
        ) : (
          <button data-squish
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="inline-flex items-center gap-1 border-0 bg-transparent cursor-pointer font-black lb-gold-ink"
            style={{ fontSize: 11, letterSpacing: 1.2, padding: '4px 2px' }}
          >
            YESTERDAY
            {open ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>
        )}
        {open && !empty && share}
      </div>
      {/* the small podium: a fixed height; tapping the stage toggles the list (the header button is the keyboard path) */}
      {!empty && (
        <div
          onClick={onToggle}
          className="mx-auto cursor-pointer"
          style={{ height: YESTERDAY_PODIUM_HEIGHT, maxWidth: 360, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
        >
          {!loading && <Podium places={places} label="Yesterday's top three" accent={accent} compact bare />}
        </div>
      )}
      {open && !empty && <div className="mt-1">{children}</div>}
    </div>
  );
}

