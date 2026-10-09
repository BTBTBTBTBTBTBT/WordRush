'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Icon3D, WinLossBadge } from '@/components/ui/icon3d';
import { feedback } from '@/lib/sound-events';
import type { DailyCompletion } from '@/lib/daily-service';
import { computeDailyTotals } from '@/lib/daily-service';
import { shareDailySweep, shareMoreSweep } from '@/lib/daily-share';
import { computeMoreTotals, moreSweepTier, MORE_SWEEP_COPY } from '@/lib/more-games';
import type { ShareMode } from '@/lib/share-image';
import { MODE_SHARE_GLYPH } from '@/lib/share-grid';
import { MODE_BY_DBKEY, MORE_GAME_MODES, sweepModesFor } from '@/lib/modes.generated';
import { getTodayLocal } from '@/lib/daily-service';
import { MomentArt } from '@/components/ui/art-title';
import { type CandyColor } from '@/components/ui/candy-button';
import { QuietButton } from '@/components/ui/family-button';
import { CastButton } from '@/components/ui/cast-button';
import { SoftNum } from '@/components/ui/soft-number';
import { Confetti, CANDY_CONFETTI } from '@/components/effects/confetti';
import { ART_SIZE, artSrc } from '@/lib/art';
import { softPill } from '@/lib/soft-surface';
import { useDecodedEntrance } from '@/hooks/use-decoded-entrance';
import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { useHomeHost } from '@/components/avatar/player-avatar';
import { emitMascotMoment } from '@/lib/living-mascot';
import { seasonEntry } from '@/lib/season-kit';
import { useSeason } from '@/lib/season';

// One-time full-screen celebration shown when the player completes every daily
// in the current sweep (docs/FINISH_SPEC.md G3): a full-screen overlay tinted
// in the moment's color, the existing SWEEP! / FLAWLESS! lettering on top, the
// big scene art springing in with a bounce over a soft glow (S racing his
// broom for a Sweep, the pink O on her gem for a Flawless), soft-number stat
// tiles below, candy confetti and candy buttons. Reduce Motion: the art fades
// in, no confetti, no glow pulse.
//   • Daily Sweep        → gold.
//   • More Games Sweep   → indigo.
//   • Flawless (either)  → pink.

interface ModeMeta { dbKey: string; mode: ShareMode; label: string; accent: string }
// The sweep set comes from the catalog's era table for today, so the tile row
// is eight word games from 2026-09-25 (ProperNoundle lives under More Games).
const MODES: ModeMeta[] = sweepModesFor(getTodayLocal())
  .map((k) => MODE_BY_DBKEY[k])
  .filter(Boolean)
  .map((m) => ({ dbKey: m.dbKey as string, mode: m.shareLabel as ShareMode, label: m.shortTitle, accent: m.accentHex }));
// More Games Sweep / Flawless (founder, 2026-09-26): the same celebration over the
// ten More Games dailies, in indigo (sweep) or gold (flawless). Purely visual — it
// never awards anything, and it never uses the Daily Sweep wording.
const MORE_MODES: ModeMeta[] = MORE_GAME_MODES
  .filter((m) => m.dailyEligible && m.dbKey)
  .map((m) => ({ dbKey: m.dbKey as string, mode: m.shareLabel as ShareMode, label: m.shortTitle, accent: m.accentHex }));

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/** 0 -> 1 over `ms` (ease-out) once mounted; 1 immediately under Reduce Motion. */
function useProgress(ms: number, delay = 650): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    const still = typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reducedMotion === 'true');
    if (still) { setP(1); return; }
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / ms));
      setP(1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms, delay]);
  return p;
}

interface Props {
  completions: Map<string, DailyCompletion>;
  onClose: () => void;
  /** 'daily' (default) = the Daily Sweep; 'more' = the More Games Sweep. */
  variant?: 'daily' | 'more';
}

export function SweepCelebration({ completions, onClose, variant = 'daily' }: Props) {
  const more = variant === 'more';
  const totals = useMemo(() => {
    if (!more) return computeDailyTotals(completions);
    const t = computeMoreTotals(completions);
    return { ...t, totalGuesses: 0, flawless: moreSweepTier(completions) === 'flawless' };
  }, [completions, more]);
  const flawless = totals.flawless;
  const modes = more ? MORE_MODES : MODES;
  const look = flawless ? LOOKS.flawless : more ? LOOKS.more : LOOKS.sweep;
  const title = flawless
    ? (more ? MORE_SWEEP_COPY.flawless.title : 'FLAWLESS VICTORY!')
    : (more ? MORE_SWEEP_COPY.sweep.title : 'DAILY SWEEP!');
  // 2.8 item 7: current naming ("All 10 Puzzles done today!").
  const noun = more ? 'Puzzles' : 'Dailies';
  const [sharing, setSharing] = useState(false);

  // FINISH_SPEC U: Sweep / Flawless = `celebrate` + success-then-heavy haptics.
  useEffect(() => { feedback('celebrate'); }, []);

  // 2.8 items 7 + 13: YOUR mascot celebrates beside the art — living (cheer + hops) when the living mascot is on,
  // else its static cutout; nothing for a player on the plain cast host. The reaction fires a beat after it mounts.
  const host = useHomeHost();
  // 2.8 item 7 kit (docs/design/brand/2.8/celebrate): a prop's art, the season's swap when the registry has one.
  const season = useSeason();
  const prop = (name: string): string => {
    const swap = seasonEntry(season)?.slots.extras?.[`celebrate-${name}`];
    return `/art/${swap ?? `celebrate-${name}`}.webp`;
  };
  const float1 = seasonEntry(season)?.slots.extras?.['celebrate-float-1'];
  const float2 = seasonEntry(season)?.slots.extras?.['celebrate-float-2'];
  // the stats count up (Reduce Motion: final values at once)
  const prog = useProgress(900);
  useEffect(() => {
    const t = setTimeout(() => emitMascotMoment(flawless ? 'flawless' : 'sweep'), 500);
    return () => clearTimeout(t);
  }, [flawless]);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try { await (more ? shareMoreSweep(completions) : shareDailySweep(completions)); } finally { setSharing(false); }
  };

  const [aw, ah] = ART_SIZE[look.art];
  // AZ: the scene + lettering are decoded before the spring-in starts.
  const { ref: entranceRef, waiting } = useDecodedEntrance<HTMLDivElement>();
  const stats: { value: string; label: string }[] = [
    { value: `${Math.round(totals.won * prog)}/${totals.total}`, label: 'Won' },
    { value: fmtTime(Math.round(totals.totalTimeSeconds * prog)), label: 'Total Time' },
    { value: Math.round(totals.totalScore * prog).toLocaleString(), label: 'Total Pts' },
  ];

  return (
    <div
      ref={entranceRef}
      className={`fixed inset-0 z-[60] overflow-y-auto animate-fade-in${waiting ? ' motion-wait' : ''}`}
      style={{ background: look.overlay }}
      onClick={onClose}
    >
      <Confetti colors={CANDY_CONFETTI[look.confetti]} />

      <div className="min-h-full flex items-center justify-center px-5 py-8">
        <div
          role="dialog"
          aria-label={title}
          className="relative max-w-sm w-full flex flex-col items-center text-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* SWEEP! / FLAWLESS! lettering (docs/ART_SPEC.md §6) under a small DAILY /
              PUZZLES kicker; the full title ("DAILY SWEEP!", "PUZZLES FLAWLESS!") is its name. */}
          <span aria-hidden="true" className="text-[12px] font-black uppercase text-white" style={{ letterSpacing: 1.6, textShadow: INK_SHADOW }}>
            {more ? 'Puzzles' : 'Daily'}
          </span>
          <div className="relative w-full flex justify-center" style={{ overflow: 'visible' }}>
            <MomentArt moment={flawless ? 'flawless' : 'sweep'} label={title} maxHeight={84} widthPct={86} />
            {/* the streamers swing in either side of the lettering; a sparkle trail sweeps across it once */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img aria-hidden="true" alt="" src={prop('streamers-pair')} width={62} className="absolute celebrate-streamer-l pointer-events-none" style={{ left: -6, top: -26 }} draggable={false} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img aria-hidden="true" alt="" src={prop('streamers-pair')} width={62} className="absolute celebrate-streamer-r pointer-events-none" style={{ right: -6, top: -26 }} draggable={false} />
            <span aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src="/art/celebrate-sparkle-sweep.webp" className="absolute celebrate-sweep" style={{ height: '120%', top: '-10%', left: 0, width: 'auto' }} draggable={false} />
            </span>
          </div>

          {/* The big scene art springs in over a soft glow. */}
          <div className="relative flex justify-center mt-1" style={{ height: ART_H }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img aria-hidden="true" alt="" src={prop(flawless ? 'burst-gold' : 'burst-party')} className="absolute celebrate-burst pointer-events-none" style={{ width: ART_H * 1.7, left: '50%', top: '50%', marginLeft: -ART_H * 0.85, marginTop: -ART_H * 0.85 }} draggable={false} />
            {float1 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img aria-hidden="true" alt="" src={`/art/${float1}.webp`} width={78} className="absolute celebrate-float pointer-events-none" style={{ left: -14, top: -8 }} draggable={false} />
            )}
            {float2 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img aria-hidden="true" alt="" src={`/art/${float2}.webp`} width={64} className="absolute celebrate-float pointer-events-none" style={{ right: -10, top: 4 }} draggable={false} />
            )}
            <div
              aria-hidden="true"
              className="absolute celebrate-glow"
              style={{ width: ART_H * 1.35, height: ART_H * 1.35, top: '50%', left: '50%', marginTop: -ART_H * 0.675, marginLeft: -ART_H * 0.675, borderRadius: '50%', background: look.glow }}
            />
            <Image
              src={artSrc(look.art)}
              alt=""
              aria-hidden="true"
              width={aw}
              height={ah}
              priority
              draggable={false}
              sizes={`${Math.round((ART_H * aw) / ah)}px`}
              className="relative select-none pointer-events-none celebrate-spring"
              style={{ height: ART_H, width: 'auto', maxWidth: '86vw', objectFit: 'contain', filter: 'drop-shadow(0 10px 16px rgba(40, 10, 80, 0.35))' }}
            />
            {flawless && (
              // the crown drops onto the star (Halloween: the witch hat)
              // eslint-disable-next-line @next/next/no-img-element
              <img aria-hidden="true" alt="" src={prop('crown-gold')} width={84} className="absolute celebrate-crown pointer-events-none" style={{ left: '50%', top: -22, marginLeft: -42 }} draggable={false} />
            )}
            {host.choice.kind === 'mascot' && (
              <span aria-hidden="true" className="absolute pointer-events-none" style={{ right: -8, bottom: -6, width: 96, height: 96 }}>
                <MascotAvatar config={host.choice.config} initial={host.initial} size={96} cutout living />
              </span>
            )}
          </div>

          <p className="text-sm font-extrabold mt-2 text-white" style={{ textShadow: INK_SHADOW }}>
            {flawless
              ? `All ${totals.total} ${noun} won today!`
              : `All ${totals.total} ${noun} done today!`}
          </p>

          {/* Summary totals: soft-number tiles in the moment's color. */}
          <div className="grid grid-cols-3 gap-2 mt-3 w-full">
            {stats.map((st) => (
              <div key={st.label} className="text-center" style={{ ...softPill(look.accent, { radius: 16 }), padding: '10px 6px 8px' }}>
                <SoftNum size={st.value.length > 6 ? 18 : 22} as="b" className="block soft-num-auto">{st.value}</SoftNum>
                <span className="block mt-1 text-[10px] font-black uppercase" style={{ letterSpacing: 1, color: 'var(--color-text-muted)' }}>{st.label}</span>
              </div>
            ))}
          </div>

          {/* Per-game list: mini game cards in each game's color with the W / L badge. */}
          {/* 2 columns: every name the same size, W/L badges in one aligned column (3 columns orphaned Starsweep). */}
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 w-full">
            {modes.map((m, k) => {
              const c = completions.get(m.dbKey);
              if (!c) return null;
              return (
                <div key={m.dbKey} className="flex items-center gap-1.5 px-1.5 py-1" style={softPill(m.accent, { radius: 10, bar: false })}>
                  <span
                    className="flex items-center justify-center font-black text-white shrink-0"
                    style={{ width: 22, height: 22, borderRadius: 7, background: m.accent, fontSize: MODE_SHARE_GLYPH[m.mode].length >= 3 ? 9 : 12 }}
                  >
                    {MODE_SHARE_GLYPH[m.mode]}
                  </span>
                  <span className="text-[12px] font-bold truncate text-left" style={{ color: 'var(--color-text)' }}>{m.label}</span>
                  {/* each game's W / L badge stamps in one by one */}
                  <WinLossBadge won={c.won} size={16} className="ml-auto celebrate-stamp" style={{ ['--k' as string]: k } as React.CSSProperties} />
                </div>
              );
            })}
          </div>

          {/* Actions: candy buttons. */}
          <div className="flex gap-2 mt-5 w-full">
            <CastButton
              color={look.candy}
              size="md"
              className="flex-1"
              icon={<Icon3D name="share" size={22} />}
              onClick={handleShare}
              disabled={sharing}
            >
              {sharing ? 'Sharing…' : 'Share'}
            </CastButton>
            {/* 2.8 item 23: the family QUIET button, sized to its label. */}
            <QuietButton size="md" onClick={onClose}>
              Close
            </QuietButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The scene art's height (px). */
const ART_H = 200;

/** White lettering's soft dark edge on the colored overlay. */
const INK_SHADOW = '0 1px 0 rgba(59, 26, 120, 0.55), 0 2px 6px rgba(59, 26, 120, 0.35)';

interface Look {
  accent: string;
  overlay: string;
  glow: string;
  art: 'art-scene-sweep-broom' | 'art-scene-flawless-star';
  candy: CandyColor;
  confetti: keyof typeof CANDY_CONFETTI;
}

/** Each moment's color: the full-screen tint, the glow behind the art, its art, button and confetti. */
const LOOKS: Record<'sweep' | 'more' | 'flawless', Look> = {
  sweep: {
    accent: '#f5a524',
    overlay: 'radial-gradient(circle at 50% 38%, rgba(255, 214, 120, 0.96), rgba(245, 165, 36, 0.95) 48%, rgba(194, 94, 12, 0.97))',
    glow: 'radial-gradient(circle, rgba(255, 255, 255, 0.8), rgba(255, 236, 170, 0.45) 42%, rgba(255, 214, 120, 0) 70%)',
    art: 'art-scene-sweep-broom',
    candy: 'amber',
    confetti: 'gold',
  },
  more: {
    accent: '#6366f1',
    overlay: 'radial-gradient(circle at 50% 38%, rgba(165, 180, 252, 0.96), rgba(99, 102, 241, 0.95) 48%, rgba(55, 48, 163, 0.97))',
    glow: 'radial-gradient(circle, rgba(255, 255, 255, 0.75), rgba(199, 210, 254, 0.45) 42%, rgba(165, 180, 252, 0) 70%)',
    art: 'art-scene-sweep-broom',
    candy: 'purple',
    confetti: 'indigo',
  },
  flawless: {
    accent: '#ec4899',
    overlay: 'radial-gradient(circle at 50% 38%, rgba(251, 182, 216, 0.96), rgba(236, 72, 153, 0.95) 48%, rgba(134, 25, 143, 0.97))',
    glow: 'radial-gradient(circle, rgba(255, 255, 255, 0.85), rgba(253, 230, 138, 0.5) 40%, rgba(251, 182, 216, 0) 70%)',
    art: 'art-scene-flawless-star',
    candy: 'pink',
    confetti: 'pink',
  },
};
