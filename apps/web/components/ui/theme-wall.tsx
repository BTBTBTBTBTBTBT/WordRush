'use client';

import { useEffect, useMemo, useState } from 'react';
import { useThemeOrDefault } from '@/lib/theme-context';
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
// (Forest) and, while Seasonal is on, bats + a witch fly-by + fog + stars (Halloween) or a slow V of geese
// (Thanksgiving, 10-16). Static under Reduce Motion
// (the in-app toggle, prefers-reduced-motion) and when saving data; trimmed on struggling devices; off with the
// `living_wallpapers` switch. CSS transforms only (compositor), no JS per frame.

export function ThemeWallLayer() {
  const { theme } = useThemeOrDefault();
  const season = useSeason();
  // Default draws its own art wall; a season's wall covers everything beneath it.
  if (theme === 'default' || season) return null;
  return <div className="theme-wall" style={themeWallVars(theme) as React.CSSProperties} data-theme-wall={theme} aria-hidden="true" />;
}

/** True when this device should draw fewer / no moving things. */
function useCalm(): { still: boolean; trim: number } {
  const { reducedMotion } = useThemeOrDefault();
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
  const { theme } = useThemeOrDefault();
  const season = useSeason();
  const { isLive } = useFlags();
  const { still, trim } = useCalm();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const seasonal = season ? seasonalEntry(season) : null;
  if (!mounted || !isLive('living_wallpapers')) return null;
  return (
    <div className="ambient" data-still={still ? 'true' : 'false'} aria-hidden="true">
      {seasonal?.ambient ? <SeasonalAmbient entry={seasonal.ambient} trim={trim} /> : <ThemeAmbient a={themeEntry(theme).ambient} trim={trim} />}
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

/**
 * The witch's moon pass: every Halloween wall paints its moon at the same spot (portrait 1290x2796 at 74% / 7.1%,
 * the wide 2400x1500 twin at 85% / 16.5%), drawn cover-fit and centered. Returns the start / end of a gentle climb
 * whose middle crosses the moon, as CSS vars for the amb-witch keyframes.
 */
function useWitchMoonPath(witchW: number): React.CSSProperties {
  const [vars, setVars] = useState<React.CSSProperties>({});
  useEffect(() => {
    const place = () => {
      const W = window.innerWidth, H = window.innerHeight;
      const wide = W / H >= 1 || W >= 1024;
      const [iw, ih, fx, fy] = wide ? [2400, 1500, 0.85, 0.165] : [1290, 2796, 0.74, 0.071];
      const sc = Math.max(W / iw, H / ih);
      const mx = (W - iw * sc) / 2 + fx * iw * sc, my = (H - ih * sc) / 2 + fy * ih * sc;
      const wh = witchW * 205 / 224;
      const x0 = -0.24 * W, x1 = 1.24 * W;
      const yAt = (x: number) => my + (mx - (x + witchW / 2)) * 0.12 - wh / 2;
      setVars({ ['--ms-x' as string]: `${x0}px`, ['--ms-y' as string]: `${yAt(x0)}px`, ['--me-x' as string]: `${x1}px`, ['--me-y' as string]: `${yAt(x1)}px` });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [witchW]);
  return vars;
}

function SeasonalAmbient({ entry, trim }: { entry: NonNullable<NonNullable<ReturnType<typeof seasonalEntry>>['ambient']>; trim: number }) {
  // Every part is optional (Halloween: stars + fog + bats + witch; Thanksgiving: a flock of geese + a few stars).
  const moonPath = useWitchMoonPath(entry.witch?.size ?? 0);
  const bats = entry.bats ? Math.max(1, Math.round(entry.bats.count * trim)) : 0;
  const stars = entry.stars ? Math.round(entry.stars.count * trim) : 0;
  return (
    <>
      {entry.stars && Array.from({ length: stars }, (_, i) => (
        <span key={`s${i}`} className="amb-star" style={{ left: `${unit(i, 11) * 96}%`, top: `${unit(i, 12) * 55}%`, background: entry.stars!.color, ['--dur' as string]: `${lerp(3, 7, unit(i, 13))}s`, ['--delay' as string]: `${-unit(i, 14) * 6}s` }} />
      ))}
      {entry.fog && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="amb-fog" src={ambientSrc(entry.fog.sprite)} alt="" decoding="async" draggable={false} style={{ opacity: entry.fog.opacity, ['--dur' as string]: `${entry.fog.duration}s` }} />
      )}
      {entry.bats && Array.from({ length: bats }, (_, i) => {
        const b = entry.bats!;
        const size = lerp(b.size[0], b.size[1], unit(i, 21));
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`b${i}`} className="amb-bat" src={ambientSrc(b.sprite)} alt="" width={size} height={size * 0.69} decoding="async" draggable={false}
            style={{ top: `${6 + unit(i, 22) * 40}%`, ['--dur' as string]: `${lerp(b.duration[0], b.duration[1], unit(i, 23))}s`, ['--delay' as string]: `${-unit(i, 24) * 14}s`, ['--flap-delay' as string]: `${-unit(i, 25) * 0.6}s` }} />
        );
      })}
      {entry.witch && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="amb-witch" src={ambientSrc(entry.witch.sprite)} alt="" width={entry.witch.size} decoding="async" draggable={false}
          style={{ ['--every' as string]: `${entry.witch.every}s`, ['--dur' as string]: `${entry.witch.every * 3}s`, ...moonPath }} />
      )}
      {entry.flock && <Flock f={entry.flock} which={0} />}
      {entry.flock && trim >= 1 && <Flock f={entry.flock} which={1} />}
    </>
  );
}

/**
 * The V of geese (10-16, founder: "animate that V of ducks like the bats"): the same formation the Thanksgiving wall
 * engine baked (geese_v: lead + two trailing arms, 0.92 L step, 0.30 spread, the upper arm a little tighter), built
 * from one goose sprite so each bird beats its wings with the bats' scaleY squash, out of step. The whole V crosses
 * the top band in one slow linear pass (40-70 s) with a gentle rise and fall. `which` 0 = the flock that is always
 * on its way; 1 = a smaller flock that passes once every third cycle (hidden the rest of the time, like the witch).
 */
export function flockGeese(count: number, size: number, direction: 1 | -1, salt: number) {
  const L = size * 0.56;                       // the sprite is 1.78 L wide (goose() spans -0.70 L .. 1.00 L + padding)
  const perArm = Math.floor((count - 1) / 2);
  const geese: { x: number; y: number; w: number; k: number }[] = [{ x: 0, y: 0, w: size, k: 0 }];
  let k = 1;
  for (const [dy, tight, extra] of [[-1, 0.78, 0], [1, 1.0, (count - 1) % 2]] as const) {
    for (let i = 1; i <= perArm + extra; i++, k++) {
      geese.push({
        x: -direction * (i * L * 0.92 + lerp(-0.05, 0.05, unit(k, salt + 1)) * L),
        y: dy * i * L * 0.30 * tight + lerp(-0.06, 0.06, unit(k, salt + 2)) * L,
        w: size * lerp(0.86, 1.0, unit(k, salt + 3)),
        k,
      });
    }
  }
  const trail = perArm * L * 0.92 + size;     // how far the last goose trails the lead (+ its own width)
  return { geese, trail };
}

function Flock({ f, which }: { f: NonNullable<NonNullable<NonNullable<ReturnType<typeof seasonalEntry>>['ambient']>['flock']>; which: 0 | 1 }) {
  const count = which ? Math.max(3, f.count - 2) : f.count;
  const size = lerp(f.size[0], f.size[1], unit(which, 31)) * (which ? 0.8 : 1);
  const dur = lerp(f.duration[0], f.duration[1], unit(which, 32)) * (which ? 1.15 : 1);
  const { geese, trail } = useMemo(() => flockGeese(count, size, f.direction, 40 + which * 10), [count, size, f.direction, which]);
  const top = lerp(f.band[0], f.band[1], unit(which, 33));
  // Heading right: the lead enters at -10vw and leaves at 110vw + trail (so the last goose is off screen both ends).
  const [x0, x1] = f.direction === 1 ? ['-10vw', `calc(110vw + ${trail}px)`] : [`calc(110vw + ${trail}px)`, '-10vw'];
  return (
    <span className={`amb-flock ${which ? 'amb-flock-rare' : ''}`} style={{ top: `${top}%`, ['--dur' as string]: `${which ? dur * 3 : dur}s`, ['--delay' as string]: `${-unit(which, 34) * dur}s`, ['--x0' as string]: x0, ['--x1' as string]: x1, ['--xmid' as string]: `calc(50vw + ${trail / 2}px)` }}>
      {geese.map((g) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={g.k} className="amb-goose" src={ambientSrc(f.sprite)} alt="" width={g.w} height={g.w / 2} decoding="async" draggable={false}
          style={{ left: g.x - g.w / 2, top: g.y - g.w / 2 * 0.85, ['--dx' as string]: f.direction, ['--flap-delay' as string]: `${-unit(g.k, 35 + which) * 1.1}s` }} />
      ))}
    </span>
  );
}
