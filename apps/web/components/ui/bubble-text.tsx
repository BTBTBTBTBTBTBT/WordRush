'use client';

import { useThemeOrDefault } from '@/lib/theme-context';
import { useSeason } from '@/lib/season';
import { themeHeadlineAccent } from '@/lib/theme-kit';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  BUBBLE_ATLAS_CAP_PX, BUBBLE_ATLAS_METRICS, BUBBLE_ATLAS_RIM_HEX, BUBBLE_CAP_EM, BUBBLE_MAX_SIZE, BUBBLE_MIN_SIZE,
  bubbleAtlasCovers, bubbleAtlasLayout, bubbleFit, headlineLabel, headlineTokens,
} from '@wordle-duel/core';
import { tintedGlyph } from '@/lib/bubble-render';
import { emitMascotMoment } from '@/lib/living-mascot';
import { darken, softMix } from '@/lib/soft-surface';
import { useFlags } from '@/hooks/use-flags';
import { LiveHeadline, type LiveHeadlineProps } from '@/components/ui/live-headline';
import { HEADLINE_NUMBER, HEADLINE_PALETTES, type HeadlinePalette } from '@/lib/live-headline';

// 2.8 item 6: the bubble-lettering renderer. ANY string is drawn from the glyph atlas
// (public/art/bubble/<name>.png — A–Z 0–9 ★ ! ? , ' · - &, a neutral white base with shading)
// tinted per word; until the atlas ships (core BUBBLE_ATLAS.ready) every line is drawn by the
// live headline font through THIS SAME API, so switching is a drop-in of assets + one flag.
// The fit (scale up to fill the slot, down to a min, then a balanced 2-line wrap, never "…")
// is core's `bubbleFit`, identical on iOS and Android.

export const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** The width of an element, kept current (rounded px; 0 before the first measure). */
export function useElementWidth(ref: React.RefObject<HTMLElement>): number {
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

export interface BubbleLineProps extends Omit<LiveHeadlineProps, 'size'> {
  /** The lettering size in px (the fit's output). */
  size: number;
  /** 2.8 item 13: tapping a letter bounces it and your host mascot reacts (Home's headline only). */
  interactive?: boolean;
}

/**
 * One fitted line: the atlas when it covers the whole line, else the live font. Words take the palette
 * tint; numbers wear the gold, names the palette's accent (the same token colors the live font uses).
 */
export const BubbleLine = memo(function BubbleLine(props: BubbleLineProps) {
  const { text, size } = props;
  const { isLive } = useFlags();
  // Item 25: a non-default theme tints page headlines with its accent (a season's spec / an explicit accent still wins).
  const { theme } = useThemeOrDefault();
  const season = useSeason();
  const themeAccent = season || props.spec || props.accent || props.palette === 'celebrate' ? null : themeHeadlineAccent(theme);
  const tinted = themeAccent ? { ...props, accent: themeAccent } : props;
  // `bubble_atlas` off-switch (fail-open): off = the live headline font everywhere.
  if (!isLive('bubble_atlas') || !bubbleAtlasCovers(text)) return <LiveHeadline {...tinted} size={size} />;
  return <BubbleAtlasLine {...tinted} />;
});

type Tint = { top: string; bottom: string };

/** The atlas line: one small tinted canvas per glyph, absolutely placed from core's layout (cap units). */
function BubbleAtlasLine({ text, size, palette = 'home', spec, accent, names, level = 2, className = '', style, align = 'center', interactive = false, decorative = false }: BubbleLineProps) {
  const base = spec ?? HEADLINE_PALETTES[palette];
  const p = accent ? { ...base, top: softMix(accent, 0.55), bottom: accent, deep: darken(accent, 0.45) } : base;
  const layout = useMemo(() => bubbleAtlasLayout(text), [text]);
  const nameKey = (names ?? []).join('\u0001');
  // Per character: 'number' -> gold, 'name' -> the accent gradient, otherwise the palette's.
  const kinds = useMemo(() => {
    const out: string[] = [];
    for (const t of headlineTokens(text.toUpperCase(), names ?? [])) for (let i = 0; i < Array.from(t.text).length; i++) out.push(t.kind);
    return out;
  }, [text, nameKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const cap = size * BUBBLE_CAP_EM;
  const dpr = typeof window === 'undefined' ? 1 : Math.min(3, window.devicePixelRatio || 1);
  const tintFor = (kind: string | undefined): Tint =>
    kind === 'number' ? { top: HEADLINE_NUMBER.top, bottom: HEADLINE_NUMBER.bottom }
      : kind === 'name' ? { top: p.nameTop, bottom: p.nameBottom }
      : { top: p.top, bottom: p.bottom };
  return (
    <span
      role={decorative ? undefined : 'heading'}
      aria-level={decorative ? undefined : level}
      aria-label={decorative ? undefined : headlineLabel(text)}
      aria-hidden={decorative ? true : undefined}
      className={`bt-line ${className}`}
      style={{ width: layout.width * cap, height: (layout.asc + layout.desc) * cap, marginLeft: align === 'left' ? 0 : 'auto', marginRight: 'auto', ...style } as CSSProperties}
    >
      {layout.places.map((g, i) => (
        <BubbleGlyph
          key={`${i}-${g.stem}-${g.ci}`}
          stem={g.stem}
          left={g.x * cap}
          top={g.y * cap}
          w={g.w * cap}
          h={g.h * cap}
          // the tint gradient runs cap line -> baseline over the whole word
          f0={g.y - (layout.asc - 1)}
          f1={g.y + g.h - (layout.asc - 1)}
          tint={tintFor(kinds[g.ci])}
          dpr={dpr}
          index={i}
          interactive={interactive}
        />
      ))}
    </span>
  );
}

function BubbleGlyph({ stem, left, top, w, h, f0, f1, tint, dpr, index, interactive }: {
  stem: string; left: number; top: number; w: number; h: number; f0: number; f1: number; tint: Tint; dpr: number; index: number; interactive: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hop, setHop] = useState(false);
  // Never render more pixels than the source art has (cap 140 px).
  const pxW = Math.max(1, Math.round(Math.min(w * dpr, BUBBLE_ATLAS_METRICS[stem][0] * BUBBLE_ATLAS_CAP_PX)));
  const pxH = Math.max(1, Math.round(Math.min(h * dpr, BUBBLE_ATLAS_METRICS[stem][1] * BUBBLE_ATLAS_CAP_PX)));
  useEffect(() => {
    let dead = false;
    tintedGlyph(stem, pxW, pxH, f0, f1, { top: tint.top, bottom: tint.bottom, rim: BUBBLE_ATLAS_RIM_HEX })
      .then((c) => {
        const el = ref.current;
        if (dead || !el) return;
        el.width = c.width;
        el.height = c.height;
        el.getContext('2d')?.drawImage(c, 0, 0);
      })
      .catch(() => {});
    return () => { dead = true; };
  }, [stem, pxW, pxH, f0, f1, tint.top, tint.bottom]);
  const onTap = () => {
    if (!interactive) return;
    emitMascotMoment('progress');   // your host mascot answers the tap (a no-op while the living mascot is off)
    setHop(true);
    setTimeout(() => setHop(false), 260);
  };
  return (
    <canvas
      ref={ref}
      className={`bt-glyph${hop ? ' bt-hop' : ''}${interactive ? ' bt-tap' : ''}`}
      aria-hidden="true"
      onClick={interactive ? onTap : undefined}
      style={{ left, top, width: w, height: h, ['--i' as string]: index } as CSSProperties}
    />
  );
}

export interface BubbleTextProps extends Omit<LiveHeadlineProps, 'size' | 'text'> {
  text: string;
  /** Largest size (px). Default 38. */
  maxSize?: number;
  /** One line is kept only while it stays at or above this size. Default 26. */
  minSize?: number;
  /** Fixed slot width in px; omitted = the component measures its own container. */
  slotWidth?: number;
  /** 2.8 item 40: a headline whose words change while it is on screen: screen readers announce each new sentence politely. */
  live?: boolean;
}

/** Any changing headline: measures its slot, fits it (core bubbleFit), draws each line. */
export const BubbleText = memo(function BubbleText({ text, maxSize = BUBBLE_MAX_SIZE, minSize = BUBBLE_MIN_SIZE, slotWidth, className = '', live = false, ...rest }: BubbleTextProps) {
  const box = useRef<HTMLDivElement>(null);
  const measured = useElementWidth(box);
  const width = slotWidth ?? measured;
  const fit = useMemo(() => (width > 0 ? bubbleFit(text, width, { maxSize, minSize }) : null), [text, width, maxSize, minSize]);
  // 2.8 item 40: ONE heading speaks the whole sentence (a wrapped headline is not read as two fragments); the lettering
  // is decorative. `live` = a changing headline: a polite status announces each new sentence.
  const spoken = text.trim() ? headlineLabel(text) : '';
  return (
    <div
      ref={box}
      role={spoken ? 'heading' : undefined}
      aria-level={spoken ? rest.level ?? 2 : undefined}
      aria-label={spoken || undefined}
      aria-hidden={spoken ? undefined : true}
      aria-live={live && spoken ? 'polite' : undefined}
      aria-atomic={live ? true : undefined}
      className={`bt-box ${className}`}
      data-bubble-lines={fit?.lines.length ?? 0}
      style={{ alignItems: rest.align === 'left' ? 'flex-start' : 'center' }}
    >
      {fit ? (
        fit.lines.map((line, i) => (
          <BubbleLine key={`${i}-${line}`} {...rest} decorative text={line} size={fit.size} calm={rest.calm} style={{ whiteSpace: 'nowrap', ...rest.style }} />
        ))
      ) : (
        <span className="sr-only">{spoken}</span>
      )}
    </div>
  );
});

export type { HeadlinePalette };
