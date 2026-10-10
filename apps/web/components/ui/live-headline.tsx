'use client';

import { memo, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import { headlineTokens, type HeadlineToken } from '@wordle-duel/core';
import { badgeSrc } from '@/lib/art';
import { darken, softMix } from '@/lib/soft-surface';
import { HEADLINE_NUMBER, HEADLINE_OUTLINE, HEADLINE_PALETTES, headlineFit, type HeadlinePalette, type HeadlinePaletteSpec } from '@/lib/live-headline';
import { scheduleGlossSweep } from '@/lib/gloss-sweep';

// FINISH_SPEC AR: ANY dynamic headline in the title-art lettering, drawn in
// code (they change all day, so they can't be pre-made art). Nunito Black, all
// caps, tight tracking; per glyph: a gold outline (a text-stroke copy BEHIND
// the clipped fill — text-shadow can't sit under background-clip text), a
// 3D extrusion from stacked drop-shadows in the palette's deep shade, the
// vertical gradient fill, and a white gloss on the top ~40% (also clipped to
// the glyph). Tokens (packages/core headline-tokens.ts): numbers in gold soft
// numbers a touch bigger, names in the palette's accent gradient, "·" as the
// gold star sprite. Letters pop in left → right (25 ms apart) whenever the
// text changes, with a tiny `tick`; idle = a slow gloss sweep (~6 s; one
// short run at a time, scheduled by lib/gloss-sweep.ts, never a loop). Reduce
// Motion / calm: no pop, no sweep. Shrinks to fit on one line before wrapping
// (max 2 balanced lines). Screen readers get the plain text as a heading.

const LH_STAR = badgeSrc('icon-star-sprite');

export interface LiveHeadlineProps {
  text: string;
  palette?: HeadlinePalette;
  /** Names to color with the accent gradient (the player's / a friend's). */
  names?: readonly string[];
  /** Base font size (any CSS length). */
  size?: string | number;
  /** Heading level for assistive tech. */
  level?: 1 | 2 | 3 | 4;
  align?: 'left' | 'center';
  /** No pop / sweep (in addition to Reduce Motion). */
  calm?: boolean;
  className?: string;
  style?: CSSProperties;
  /** BB1: a game's own accent in place of the palette's fill (light → accent, darkened edge). */
  accent?: string;
  /** A season's lettering (registry surfaces `headline`) in place of [palette]'s colors. */
  spec?: HeadlinePaletteSpec | null;
  /** 2.8 item 40: one line of a multi-line headline: hidden from assistive tech (the wrapper speaks the whole sentence once). */
  decorative?: boolean;
}

function Glyphs({ word, start, kind }: { word: string; start: number; kind: HeadlineToken['kind'] }) {
  return (
    <>
      {Array.from(word).map((ch, i) => (
        <span key={i} className="lh-ch" data-k={kind} style={{ ['--i' as string]: start + i } as CSSProperties}>
          <span className="lh-stroke">{ch}</span>
          <span className="lh-fill">{ch}</span>
          <span className="lh-gloss">{ch}</span>
        </span>
      ))}
    </>
  );
}

export const LiveHeadline = memo(function LiveHeadline({
  text, palette = 'home', names, size = '1.5rem', level = 2, align = 'center', calm = false, className = '', style, accent, spec, decorative = false,
}: LiveHeadlineProps) {
  const shown = text.toUpperCase();
  const nameKey = (names ?? []).join('\u0001');
  const tokens = useMemo(() => headlineTokens(shown, names ?? []), [shown, nameKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const rootRef = useRef<HTMLSpanElement>(null);

  // BI7: rotating headlines are silent — they change on their own, not on a tap.

  // The idle gloss sweep: one short run every ~6 s while on screen (lib/gloss-sweep.ts).
  useEffect(() => {
    const root = rootRef.current;
    if (calm || !root) return;
    return scheduleGlossSweep(root);
  }, [calm]);

  // Shrink to fit on one line, else wrap to two balanced lines.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fit = () => {
      root.style.setProperty('--lh-scale', '1');
      root.dataset.wrap = 'false';
      const f = headlineFit(root.scrollWidth, root.clientWidth);
      root.style.setProperty('--lh-scale', String(f.scale));
      root.dataset.wrap = String(f.wrap);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    let last = root.clientWidth;
    const ro = new ResizeObserver(() => { if (root.clientWidth !== last) { last = root.clientWidth; fit(); } });
    ro.observe(root);
    return () => ro.disconnect();
  }, [shown, nameKey]);

  const base = spec ?? HEADLINE_PALETTES[palette];
  const p = accent ? { ...base, top: softMix(accent, 0.55), bottom: accent, deep: darken(accent, 0.45) } : base;
  const vars = {
    '--lh-size': typeof size === 'number' ? `${size}px` : size,
    '--lh-top': p.top, '--lh-bottom': p.bottom, '--lh-deep': p.deep,
    '--lh-name-top': p.nameTop, '--lh-name-bottom': p.nameBottom,
    '--lh-num-top': p.numberTop ?? HEADLINE_NUMBER.top, '--lh-num-bottom': p.numberBottom ?? HEADLINE_NUMBER.bottom, '--lh-num-deep': HEADLINE_NUMBER.deep,
    '--lh-outline': HEADLINE_OUTLINE,
    textAlign: align,
    ...style,
  } as CSSProperties;

  let at = 0;
  return (
    <span
      ref={rootRef}
      role={decorative ? undefined : 'heading'}
      aria-level={decorative ? undefined : level}
      aria-label={decorative ? undefined : text}
      aria-hidden={decorative ? true : undefined}
      className={`lh ${calm ? 'lh-calm' : 'lh-sweep'} ${className}`}
      data-palette={palette}
      style={vars}
    >
      <span key={shown} className="lh-inner" aria-hidden="true">
        {tokens.map((t, ti) => {
          if (t.kind === 'star') {
            at += 1;
            // eslint-disable-next-line @next/next/no-img-element
            return <img key={ti} className="lh-star lh-ch" src={LH_STAR} alt="" width={64} height={64} decoding="async" draggable={false} style={{ ['--i' as string]: at - 1 } as CSSProperties} />;
          }
          // Words stay whole; the spaces between them are where a line may wrap.
          return t.text.split(/( +)/).map((piece, pi) => {
            if (!piece) return null;
            if (piece.trim() === '') return <span key={`${ti}-${pi}`} className="lh-space">{piece}</span>;
            const start = at;
            at += piece.length;
            return (
              <span key={`${ti}-${pi}`} className="lh-w" data-k={t.kind}>
                <Glyphs word={piece} start={start} kind={t.kind} />
              </span>
            );
          });
        })}
      </span>
    </span>
  );
});
