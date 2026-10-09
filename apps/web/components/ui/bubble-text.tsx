'use client';

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BUBBLE_ATLAS, BUBBLE_MAX_SIZE, BUBBLE_MIN_SIZE, bubbleAtlasCovers, bubbleFit, bubbleGlyphName, bubbleWidthEm } from '@wordle-duel/core';
import { useFlags } from '@/hooks/use-flags';
import { LiveHeadline, type LiveHeadlineProps } from '@/components/ui/live-headline';
import { HEADLINE_PALETTES, type HeadlinePalette, type HeadlinePaletteSpec } from '@/lib/live-headline';

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
}

/**
 * One fitted line: the atlas when it covers the whole line, else the live font. Words take the
 * palette tint (main gradient; names/numbers keep LiveHeadline's token colors on the fallback).
 */
export const BubbleLine = memo(function BubbleLine(props: BubbleLineProps) {
  const { text, size, palette = 'home', spec, accent } = props;
  const { isLive } = useFlags();
  // `bubble_atlas` off-switch (fail-open): off = the live headline font everywhere.
  if (!isLive('bubble_atlas') || !bubbleAtlasCovers(text)) return <LiveHeadline {...props} size={size} />;
  const p: HeadlinePaletteSpec = accent ? { ...HEADLINE_PALETTES[palette], top: accent, bottom: accent } : spec ?? HEADLINE_PALETTES[palette];
  const chars = Array.from(text.toUpperCase());
  return (
    <span
      role="heading"
      aria-level={props.level ?? 2}
      aria-label={text}
      className={`bt-line ${props.className ?? ''}`}
      style={{ ['--bt-top' as string]: p.top, ['--bt-bottom' as string]: p.bottom, height: `${size * 1.1}px`, ...props.style } as CSSProperties}
    >
      {chars.map((ch, i) => {
        const name = ch === ' ' ? null : bubbleGlyphName(ch);
        const w = bubbleWidthEm(ch) * size;
        if (!name) return <span key={i} className="bt-space" style={{ width: w }} aria-hidden="true" />;
        const url = `/art/bubble/${name}.png?v=${BUBBLE_ATLAS.version}`;
        return <span key={i} className="bt-glyph" aria-hidden="true" style={{ width: w, ['--bt-img' as string]: `url(${url})` } as CSSProperties} />;
      })}
    </span>
  );
});

export interface BubbleTextProps extends Omit<LiveHeadlineProps, 'size' | 'text'> {
  text: string;
  /** Largest size (px). Default 38. */
  maxSize?: number;
  /** One line is kept only while it stays at or above this size. Default 26. */
  minSize?: number;
  /** Fixed slot width in px; omitted = the component measures its own container. */
  slotWidth?: number;
}

/** Any changing headline: measures its slot, fits it (core bubbleFit), draws each line. */
export const BubbleText = memo(function BubbleText({ text, maxSize = BUBBLE_MAX_SIZE, minSize = BUBBLE_MIN_SIZE, slotWidth, ...rest }: BubbleTextProps) {
  const box = useRef<HTMLDivElement>(null);
  const measured = useElementWidth(box);
  const width = slotWidth ?? measured;
  const fit = useMemo(() => (width > 0 ? bubbleFit(text, width, { maxSize, minSize }) : null), [text, width, maxSize, minSize]);
  return (
    <div ref={box} className="bt-box" data-bubble-lines={fit?.lines.length ?? 0}>
      {fit ? (
        fit.lines.map((line, i) => (
          <BubbleLine key={`${i}-${line}`} {...rest} text={line} size={fit.size} calm={rest.calm} style={{ whiteSpace: 'nowrap', ...rest.style }} />
        ))
      ) : (
        <span className="sr-only">{text}</span>
      )}
    </div>
  );
});

export type { HeadlinePalette };
