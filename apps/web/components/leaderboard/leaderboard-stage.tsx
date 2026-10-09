'use client';

import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { castPreset, LEDGE_FIGURE_FRACTION, LEDGE_STEPS, STAGE_ART, STAGE_TINT, WIZARD_HAT_PART } from '@wordle-duel/core';
import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { useAuth } from '@/lib/auth-context';
import { artSrc, type ArtName } from '@/lib/art';
import { alphaHex } from '@/lib/soft-surface';
import type { PodiumPlace } from '@/components/leaderboard/podium';

// FRIDAY-QUEUE items 11 + 11b: the Leaderboard is ONE living stage. These are its pieces; the page
// (app/daily/page.tsx) composes them inside <LeaderboardStage>, which owns the continuous backdrop:
// a sky wash in the SELECTED GAME's tint (clouds on top), the sunburst light behind the podium, the
// floor glow under it — all one layer, so a game switch sweeps the tint through title, strip and podium
// together. Shared constants (host table, tint alphas, ledge step positions) live in core leaderboard-stage.ts.

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
          className="absolute select-none" style={{ top: -6, left: 0, width: '100%', height: 'auto', opacity: 0.75 }} />
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

/** The compact "Your board" pill (`art-lb-btn-yourboard`, label drawn live) = today's VIEW BOARD. */
export function YourBoardButton({ onClick, label = 'Your board' }: { onClick: () => void; label?: string }) {
  return (
    <button data-squish
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative shrink-0 border-0 bg-transparent p-0 cursor-pointer active:scale-95 transition-transform"
      style={{ width: 112, height: 36, backgroundImage: `url(${artSrc(STAGE_ART.yourBoard as ArtName)})`, backgroundSize: '100% 100%', color: '#4c1d95' }}
    >
      <span className="absolute font-black uppercase" style={{ left: 40, right: 10, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, letterSpacing: 0.3, lineHeight: 1 }}>
        {label}
      </span>
    </button>
  );
}

function LedgeFigure({ place, size }: { place: PodiumPlace; size: number }) {
  const look = usePlayerAvatar({
    name: place.username, userId: place.userId, url: place.avatarUrl, accent: place.avatar?.accent,
    config: place.avatar?.config, castId: place.avatar?.castId, frame: place.avatar?.frame, level: place.level, pro: place.avatar?.pro,
  });
  return (
    <span className="block" style={{ width: size, height: size, lineHeight: 0 }}>
      <MascotAvatar config={look.config} initial={look.initial} size={size} cutout living />
    </span>
  );
}

/**
 * The stage's BASE: "Yesterday" ledge with yesterday's top three as small mascots standing on mini
 * steps; tap to expand the full list in place (`children`) — same backdrop, no separate island.
 * `places` are yesterday's podium (1st, 2nd, 3rd in board order).
 */
export function YesterdayLedge({ places, open, onToggle, loading, share, children }: {
  places: PodiumPlace[];
  open: boolean;
  onToggle: () => void;
  loading: boolean;
  share?: ReactNode;
  children: ReactNode;
}) {
  const W = 394;
  const H = 160;
  const artW = W;
  const byPlace = new Map(places.map((p) => [p.rank <= 3 ? p.rank : 0, p] as const));
  return (
    <div style={{ padding: '0 12px 8px' }}>
      <div className="flex items-center justify-between" style={{ padding: '2px 4px' }}>
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
        {open && share}
      </div>
      {/* the ledge: the art, with the mini winners standing on its three steps */}
      <button data-squish
        type="button"
        onClick={onToggle}
        aria-label={open ? 'Hide yesterday’s winners' : 'Show yesterday’s winners'}
        className="relative block w-full border-0 bg-transparent p-0 cursor-pointer mx-auto"
        style={{ maxWidth: artW, aspectRatio: `${W} / ${H}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artSrc(STAGE_ART.ledge as ArtName)} alt="" width={W} height={H} decoding="async" draggable={false}
          className="absolute inset-0 w-full h-full select-none pointer-events-none" />
        {!loading && LEDGE_STEPS.map((s) => {
          const p = byPlace.get(s.place);
          if (!p) return null;
          const size = Math.round(artW * LEDGE_FIGURE_FRACTION);
          return (
            <span
              key={s.place}
              className="absolute"
              style={{ left: `${s.x * 100}%`, top: `${s.top * 100}%`, transform: 'translate(-50%, -88%)', width: `${LEDGE_FIGURE_FRACTION * 100}%`, maxWidth: size }}
              title={p.username}
            >
              <LedgeFigure place={p} size={size} />
            </span>
          );
        })}
        {!loading && places.length === 0 && (
          <span className="absolute inset-x-0 text-center font-extrabold" style={{ top: '28%', fontSize: 11.5, color: 'var(--color-text-secondary)' }}>
            No results from yesterday
          </span>
        )}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

