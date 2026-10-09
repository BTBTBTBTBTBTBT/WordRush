'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/lib/theme-context';
import { useSeason } from '@/lib/season';
import { useFlags } from '@/hooks/use-flags';
import { ambientSrc, seasonalEntry, themeEntry, themeWallVars, type ThemeAmbient } from '@/lib/theme-kit';

// Theme walls + living wallpapers (FRIDAY-QUEUE items 25 + 15 + 45), inside PageBackground's fixed layer
// (menus and tab pages only: never a game board, never a VS board).
//
// ThemeWallLayer: Ocean / Forest / Dark are full skins through the same slot the season wall uses. The wall is
// drawn in CODE at full resolution from the registry (3 gradient stops + a soft radial glow near the top), no
// upscaled image. Default keeps its art walls. Season skins layer on top (SeasonWallLayer renders after this).
//
// LivingWallpaper: slow drifting particles on the wall: letter tiles (Default / Dark), bubbles (Ocean), leaves
// (Forest) and, while Seasonal is on, bats + a witch fly-by + fog + stars. Static under Reduce Motion
// (the in-app toggle, prefers-reduced-motion) and when saving data; trimmed on struggling devices; off with the
// `living_wallpapers` switch. CSS transforms only (compositor), no JS per frame.

export function ThemeWallLayer() {
  const { theme } = useTheme();
  const season = useSeason();
  // Default draws its own art wall; a season's wall covers everything beneath it.
  if (theme === 'default' || season) return null;
  return <div className="theme-wall" style={themeWallVars(theme) as React.CSSProperties} data-theme-wall={theme} aria-hidden="true" />;
}

/** True when this device should draw fewer / no moving things. */
function useCalm(): { still: boolean; trim: number } {
  const { reducedMotion } = useTheme();
  const [sys, setSys] = useState({ still: false, trim: 1 });
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    const read = () => {
      const weak = (nav.deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency ?? 8) <= 2;
      setSys({ still: !!mq?.matches || !!nav.connection?.saveData, trim: weak ? 0.5 : 1 });
    };
    read();
    mq?.addEventListener?.('change', read);
    return () => mq?.removeEventListener?.('change', read);
  }, []);
  return { still: reducedMotion || sys.still, trim: sys.trim };
}

/** A deterministic 0..1 sequence so the layout never changes between renders (no random on the client). */
const unit = (i: number, salt: number) => {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function LivingWallpaper() {
  const { theme } = useTheme();
  const season = useSeason();
  const { isLive } = useFlags();
  const { still, trim } = useCalm();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const seasonal = season ? seasonalEntry(season) : null;
  if (!mounted || !isLive('living_wallpapers')) return null;
  return (
    <div className="ambient" data-still={still ? 'true' : 'false'} aria-hidden="true">
      {seasonal ? <SeasonalAmbient entry={seasonal.ambient} trim={trim} /> : <ThemeAmbient a={themeEntry(theme).ambient} trim={trim} />}
    </div>
  );
}

function ThemeAmbient({ a, trim }: { a: ThemeAmbient; trim: number }) {
  const n = Math.max(2, Math.round(a.count * trim));
  const items = useMemo(() => Array.from({ length: n }, (_, i) => {
    const size = lerp(a.size[0], a.size[1], unit(i, 1));
    return {
      i, size,
      left: unit(i, 2) * 92,
      top: unit(i, 3) * 100,
      dur: lerp(a.duration[0], a.duration[1], unit(i, 4)),
      delay: -unit(i, 5) * a.duration[1],
      sway: lerp(-18, 18, unit(i, 6)),
      rot: lerp(-25, 25, unit(i, 7)),
      sprite: a.sprites.length ? a.sprites[i % a.sprites.length] : null,
      letter: 'WORDCISU'[i % 8],
      hue: ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'][i % 5],
    };
  }), [a, n]);
  const cls = a.kind === 'bubbles' ? 'amb-rise' : a.kind === 'leaves' ? 'amb-fall' : 'amb-drift';
  return (
    <>
      {items.map((p) => (
        <span
          key={p.i}
          className={`amb-item ${cls}`}
          style={{
            left: `${p.left}%`, width: p.size, height: p.size, opacity: a.opacity,
            ['--y' as string]: `${p.top}%`, ['--dur' as string]: `${p.dur}s`, ['--delay' as string]: `${p.delay}s`, ['--sway' as string]: `${p.sway}vw`, ['--rot' as string]: `${p.rot}deg`,
          }}
        >
          {p.sprite ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ambientSrc(p.sprite)} alt="" width={p.size} height={p.size} decoding="async" draggable={false} />
          ) : (
            <span className="amb-tile" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${p.hue} 70%, #fff), ${p.hue})`, fontSize: p.size * 0.55, borderRadius: p.size * 0.24 }}>{p.letter}</span>
          )}
        </span>
      ))}
    </>
  );
}

function SeasonalAmbient({ entry, trim }: { entry: NonNullable<ReturnType<typeof seasonalEntry>>['ambient']; trim: number }) {
  const bats = Math.max(1, Math.round(entry.bats.count * trim));
  const stars = Math.round(entry.stars.count * trim);
  return (
    <>
      {Array.from({ length: stars }, (_, i) => (
        <span key={`s${i}`} className="amb-star" style={{ left: `${unit(i, 11) * 96}%`, top: `${unit(i, 12) * 55}%`, background: entry.stars.color, ['--dur' as string]: `${lerp(3, 7, unit(i, 13))}s`, ['--delay' as string]: `${-unit(i, 14) * 6}s` }} />
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="amb-fog" src={ambientSrc(entry.fog.sprite)} alt="" decoding="async" draggable={false} style={{ opacity: entry.fog.opacity, ['--dur' as string]: `${entry.fog.duration}s` }} />
      {Array.from({ length: bats }, (_, i) => {
        const size = lerp(entry.bats.size[0], entry.bats.size[1], unit(i, 21));
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`b${i}`} className="amb-bat" src={ambientSrc(entry.bats.sprite)} alt="" width={size} height={size * 0.69} decoding="async" draggable={false}
            style={{ top: `${6 + unit(i, 22) * 40}%`, ['--dur' as string]: `${lerp(entry.bats.duration[0], entry.bats.duration[1], unit(i, 23))}s`, ['--delay' as string]: `${-unit(i, 24) * 14}s` }} />
        );
      })}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="amb-witch" src={ambientSrc(entry.witch.sprite)} alt="" width={entry.witch.size} decoding="async" draggable={false}
        style={{ ['--every' as string]: `${entry.witch.every}s`, ['--dur' as string]: `${entry.witch.every}s` }} />
    </>
  );
}
