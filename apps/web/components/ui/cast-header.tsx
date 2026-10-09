'use client';

import Image from 'next/image';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CAST, type MascotId } from '@/lib/mascots';
import { CAST_FIRST_MOVE, CAST_MOVES, nextCastDelay, pickCastMove } from '@/lib/cast-moves';
import { prefersReducedMotion } from '@/lib/motion';
import { badgeSrc } from '@/lib/art';
import { castArt, useSeason } from '@/lib/season';
import { PRO_CROWN, crownTarget } from '@/lib/pro-crown';
import { CROWN_DROP_EVENT } from '@/lib/pro-welcome';
import { CAST_FLOURISH_ATTR, INTRO_RUNNING_ATTR } from '@/lib/intro';
import { ProCrownSheet } from '@/components/pro/pro-crown-sheet';
import { puppetBox, tapKeyframes, useCastPuppets } from '@/components/ui/cast-puppets';
import { MASCOT_MOMENT_EVENT } from '@/lib/living-mascot';
import { haptic } from '@/lib/haptics';
import { castLaugh, castNote } from '@/lib/sounds';
import { MELODY_START, MUSICAL_POP_KEYS, MUSICAL_TIMING, melodyTap, musicalTransformDelays, type MelodyState } from '@wordle-duel/core';
import { MUSICAL_CAST_ON, NOTE_SVG, noteColor, unlockTune } from '@/lib/musical-cast';
import { melodyCell, toggleMusicalOn, useMusical } from '@/lib/musical-store';

// The living cast header (docs/FINISH_SPEC.md A5, option A; mockup
// game-kit.html §5 `.castrow`): the ten cast heroes (/mascots/<id>.png) as
// separate images in a row spelling WORDOCIOUS, edge to edge, each trimmed to
// its art box so all ten stand at one height. Every 2.6–5 s ONE random
// character (never the same twice in a row) plays its personality move
// (lib/cast-moves.ts; keyframes in globals.css `.cm.act-*`). Off with Reduce
// Motion (OS or the in-app toggle) and while the tab is hidden. Decorative:
// aria-hidden, never takes a tap.
// FINISH_SPEC X: during the season (lib/season.ts; `?season=halloween` to
// preview) the Halloween skins stand in, each cut to its own measured box.
// FINISH_SPEC AA1: Pro — W wears the small gold crown sprite, tilted, on his
// head (inside W's element, so it hops with him), with a tiny sparkle every
// ~8 s; a separate small focusable button over the crown opens the
// "You're Pro" sheet.
// The cold-start intro (components/providers/cold-start-intro.tsx) glides into
// the row marked `data-cast-row`.
// 2.7.1 cast puppets (components/ui/cast-puppets.ts): out of season each figure is
// its rig (breathing, blinks, a signature move every 6–10 s, one at a time) and a
// tap makes it hop + laugh; the CSS personality moves stand down. In season the
// costumes stay (the rigs are cut from the plain heroes) with the CSS moves and a
// transform-only tap hop. The figures take taps (the rest of the row doesn't).
// The musical cast (docs/cloud-prompts/10, core musical-cast.ts; behind MUSICAL_CAST_ON — dev builds only): a
// long-press on any figure turns all ten "musical" with a squash-and-pop rippling out from it (a gold glow, a note
// badge); then a tap plays that hero's scale note in its own voice + a floating note (visual even with sound off),
// and playing a known tune unlocks its secret achievement. Long-press again → back. Reduce Motion = instant swap.

/**
 * The calmer top (FINISH_SPEC N3/N4): the row spans ≈90% of the screen,
 * centered, 8–10 px under the status bar, on a soft elliptical ground shadow
 * (the page accent at ~14%, blurred); the controls row sits 6 px below it.
 */
export const CAST_ROW = { widthPct: 90, topMargin: 9, controlsGap: 6, groundAlpha: 14 } as const;

type Box = { left: number; top: number; width: number; height: number };

/** A four-point sparkle (the crown's twinkle). */
function Sparkle() {
  return (
    <svg viewBox="0 0 20 20" width="100%" height="100%" aria-hidden="true">
      <path d="M10 0 C11 6 14 9 20 10 C14 11 11 14 10 20 C9 14 6 11 0 10 C6 9 9 6 10 0 Z" fill="#fffbe6" stroke="#fbbf24" strokeWidth="1" />
    </svg>
  );
}

export function CastHeader({ crown = false, ground = false, className = '', style }: { crown?: boolean; ground?: boolean; className?: string; style?: React.CSSProperties }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const crownRef = useRef<HTMLSpanElement>(null);
  const sparkleRef = useRef<HTMLSpanElement>(null);
  const season = useSeason();
  const [crownBox, setCrownBox] = useState<Box | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const puppets = useCastPuppets(rowRef, season === null);
  const puppetsOn = puppets.ready && season === null;
  const puppetsOnRef = useRef(puppetsOn);
  puppetsOnRef.current = puppetsOn;
  // 2.8 item 13: when your mascot celebrates a Sweep / Flawless the whole cast hops with it (the living mascot switch gates
  // the event itself; Reduce Motion: nothing).
  useEffect(() => {
    const onMoment = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind !== 'sweep' && kind !== 'flawless') return;
      const row = rowRef.current;
      if (!row || prefersReducedMotion() || document.visibilityState !== 'visible') return;
      if (puppetsOnRef.current) { puppets.cheer(CAST); return; }
      // out of season / no puppets: a light WAAPI hop on each figure (transform only), rippling out
      if (!puppets.bundle) return;
      const keys = tapKeyframes(puppets.bundle.tap, 12 * (puppets.bundle.tap.hop / 110));
      CAST.forEach((id, i) => {
        const el = row.querySelector<HTMLElement>(`[data-cast="${id}"]`);
        if (el && typeof el.animate === 'function') el.animate(keys, { duration: puppets.bundle!.tap.dur * 1000, delay: i * 70, easing: 'linear' });
      });
    };
    window.addEventListener(MASCOT_MOMENT_EVENT, onMoment);
    return () => window.removeEventListener(MASCOT_MOMENT_EVENT, onMoment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puppets.cheer, puppets.bundle]);
  // The musical cast (see above).
  // Item 4b: the shared app-wide store, so the cast stays musical across pages until a long-press (reload = normal).
  const musical = useMusical();
  const [rippleFrom, setRippleFrom] = useState<string>('w');
  const musicalRef = useRef(false);
  musicalRef.current = musical;
  const melody = melodyCell;
  const press = useRef<{ id: string; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const floats = useRef(0);
  const cancelPress = () => { if (press.current) { clearTimeout(press.current.timer); press.current = null; } };
  useEffect(() => () => cancelPress(), []);

  /** Long-press: all ten change over, rippling out from the pressed hero (instant under Reduce Motion). */
  const toggleMusical = (from: string) => {
    const row = rowRef.current;
    const reduce = prefersReducedMotion();
    const delays = musicalTransformDelays(from, reduce);
    melody.current = MELODY_START;
    setRippleFrom(from);
    toggleMusicalOn();
    haptic('medium');
    if (!row || reduce) return;
    CAST.forEach((id, i) => {
      const el = row.querySelector<HTMLElement>(`[data-cast="${id}"]`);
      if (!el || typeof el.animate !== 'function') return;
      el.animate(
        MUSICAL_POP_KEYS.map((k) => ({ offset: k.t, transform: `translateY(${-k.lift}%) scale(${k.sx}, ${k.sy})` })),
        { duration: MUSICAL_TIMING.popMs, delay: delays[i], easing: 'ease-out' },
      );
    });
  };

  /** One note: the voice (silent with sound off), a selection haptic, the hop, a floating note, the melody matcher. */
  const playNote = (id: MascotId, el: HTMLElement) => {
    castNote(id, season);
    haptic('selection');
    const reduce = prefersReducedMotion();
    if (puppetsOnRef.current) puppets.tap(id, { silent: true });
    else if (!reduce && typeof el.animate === 'function') {
      el.animate(MUSICAL_POP_KEYS.map((k) => ({ offset: k.t, transform: `translateY(${-k.lift / 2}%) scale(${1 + (k.sx - 1) / 2}, ${1 + (k.sy - 1) / 2})` })), { duration: 300, easing: 'ease-out' });
    }
    // the floating note (capped, transform / opacity only; under Reduce Motion it fades in place)
    if (floats.current < 12) {
      const n = document.createElement('span');
      n.className = 'cm-float';
      n.setAttribute('aria-hidden', 'true');
      n.style.color = noteColor(floats.current + Math.floor(performance.now() / 97));
      n.innerHTML = NOTE_SVG;
      el.appendChild(n);
      floats.current += 1;
      const done = () => { n.remove(); floats.current -= 1; };
      if (typeof n.animate === 'function') {
        const drift = (Math.random() * 2 - 1) * 40;
        const a = n.animate(reduce
          ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }]
          : [{ opacity: 0, transform: 'translate(0, 0) scale(0.5)' }, { opacity: 1, transform: `translate(${drift / 3}%, -60%) scale(1)`, offset: 0.25 }, { opacity: 0, transform: `translate(${drift}%, -220%) scale(0.9) rotate(${drift / 3}deg)` }],
        { duration: reduce ? 600 : 1100, easing: 'ease-out' });
        a.onfinish = done; a.oncancel = done;
      } else setTimeout(done, 600);
    }
    const r = melodyTap(melody.current, id, performance.now(), season);
    melody.current = r.state;
    if (r.matched) void unlockTune(r.matched.achievement);
  };

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let last: MascotId | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const row = rowRef.current;
      // F2 fix: wait while the cold-start intro runs or the landing flourish plays.
      const busy = document.documentElement.hasAttribute(INTRO_RUNNING_ATTR) || document.documentElement.hasAttribute(CAST_FLOURISH_ATTR);
      // 2.7.1: the puppets play their own signature moves.
      if (row && !busy && !puppetsOnRef.current && document.visibilityState === 'visible' && !prefersReducedMotion()) {
        const id = pickCastMove(last);
        last = id;
        const el = row.querySelector<HTMLElement>(`[data-cast="${id}"]`);
        const cls = CAST_MOVES[id].cls;
        // Smoothness pass: no forced reflow to restart a move. Every move is
        // shorter than the shortest gap (and never the same character twice in
        // a row), so its class is always gone by the time it is picked again;
        // a still-running move is simply left alone.
        if (el && !el.classList.contains(cls)) {
          el.classList.add(cls);
          const done = () => { el.classList.remove(cls); el.removeEventListener('animationend', done); el.removeEventListener('animationcancel', done); };
          el.addEventListener('animationend', done);
          el.addEventListener('animationcancel', done);
        }
      }
      timer = setTimeout(tick, nextCastDelay());
    };
    timer = setTimeout(tick, CAST_FIRST_MOVE);
    return () => clearTimeout(timer);
  }, []);

  // AA1: the crown's tiny sparkle twinkle, about every 8 s (never with Reduce Motion or a hidden tab).
  useEffect(() => {
    if (!crown) return;
    let timer: ReturnType<typeof setTimeout>;
    const twinkle = () => {
      const el = sparkleRef.current;
      if (el && typeof el.animate === 'function' && document.visibilityState === 'visible' && !prefersReducedMotion()) {
        el.animate(
          [
            { opacity: 0, transform: 'scale(0.3) rotate(0deg)' },
            { opacity: 1, transform: 'scale(1.1) rotate(45deg)', offset: 0.45 },
            { opacity: 0, transform: 'scale(0.4) rotate(90deg)' },
          ],
          { duration: PRO_CROWN.sparkleMs, easing: 'ease-in-out' },
        );
      }
      timer = setTimeout(twinkle, PRO_CROWN.sparkleEveryMs);
    };
    timer = setTimeout(twinkle, PRO_CROWN.sparkleFirstMs);
    return () => clearTimeout(timer);
  }, [crown]);

  // AP: after the Welcome to Pro screen, the crown drops onto W with a sparkle.
  useEffect(() => {
    if (!crown) return;
    const onDrop = () => {
      const c = crownRef.current;
      const sp = sparkleRef.current;
      if (prefersReducedMotion() || !c || typeof c.animate !== 'function') return;
      c.animate(
        [
          { transform: 'translate(-50%, -160%) rotate(-30deg)', opacity: 0 },
          { transform: 'translate(-50%, 8%) rotate(-4deg)', opacity: 1, offset: 0.7 },
          { transform: 'translate(-50%, 0) rotate(-8deg)', opacity: 1 },
        ],
        { duration: 620, easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)' },
      );
      sp?.animate?.(
        [{ opacity: 0, transform: 'scale(0.3)' }, { opacity: 1, transform: 'scale(1.2) rotate(45deg)', offset: 0.5 }, { opacity: 0, transform: 'scale(0.4) rotate(90deg)' }],
        { duration: PRO_CROWN.sparkleMs, delay: 520, easing: 'ease-in-out' },
      );
    };
    window.addEventListener(CROWN_DROP_EVENT, onDrop);
    return () => window.removeEventListener(CROWN_DROP_EVENT, onDrop);
  }, [crown]);

  // The crown button's frame: the crown's laid-out box (offsets ignore W's
  // hop transforms) in the wrapper's coordinates, re-measured on resize.
  const measureCrown = useCallback(() => {
    const row = rowRef.current;
    const c = crownRef.current;
    const cell = c?.offsetParent as HTMLElement | null;
    if (!row || !c || !cell) { setCrownBox(null); return; }
    const box = {
      // (the crown's own translateX(-50%) isn't in offsetLeft either)
      left: row.offsetLeft + cell.offsetLeft + c.offsetLeft - c.offsetWidth / 2,
      top: row.offsetTop + cell.offsetTop + c.offsetTop,
      width: c.offsetWidth,
      height: c.offsetHeight,
    };
    if (box.width <= 0) { setCrownBox(null); return; }
    setCrownBox((prev) => (prev && prev.left === box.left && prev.top === box.top && prev.width === box.width && prev.height === box.height ? prev : box));
  }, []);

  useLayoutEffect(() => {
    if (!crown) { setCrownBox(null); return; }
    measureCrown();
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measureCrown);
    ro.observe(row);
    return () => ro.disconnect();
  }, [crown, season, measureCrown]);

  const target = crownBox ? crownTarget(crownBox) : null;

  return (
    <div className="relative">
      <div
        ref={rowRef}
        aria-hidden="true"
        data-cast-row=""
        data-season={season ?? undefined}
        data-puppet-ready={puppetsOn ? '' : undefined}
        data-musical={musical ? '' : undefined}
        className={`castrow relative pointer-events-none select-none ${className}`}
        style={{ paddingTop: crown ? '5%' : 4, ...style }}
      >
        {ground && (
          <span
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{
              left: '6%', right: '6%', bottom: -5, height: 14, borderRadius: '50%',
              background: `radial-gradient(ellipse at center, color-mix(in srgb, var(--page-accent, #7c3aed) ${CAST_ROW.groundAlpha}%, transparent) 0%, transparent 72%)`,
              filter: 'blur(3px)',
            }}
          />
        )}
        {CAST.map((id, i) => {
          const art = castArt(id, season);
          // each hero's musical touches switch on partway through its own pop (the ripple)
          const md = MUSICAL_CAST_ON ? musicalTransformDelays(rippleFrom, false)[i] + Math.round(MUSICAL_TIMING.popMs * 0.4) : 0;
          return (
            <span
              key={id}
              data-cast={id}
              className="cm"
              style={{ flex: `${art.aspect.toFixed(3)} 1 0`, aspectRatio: `${art.aspect.toFixed(4)}`, pointerEvents: 'auto', ['--md' as string]: `${md}ms` }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                if (MUSICAL_CAST_ON) {
                  cancelPress();
                  press.current = { id, x: e.clientX, y: e.clientY, timer: setTimeout(() => { press.current = null; toggleMusical(id); }, MUSICAL_TIMING.longPressMs) };
                  if (musicalRef.current) { playNote(id, e.currentTarget); return; }
                }
                if (season === null) { puppets.tap(id); return; }
                // In season: the costume hops (squash + stretch, no face swap).
                haptic('light');
                castLaugh(id);
                const el = e.currentTarget;
                if (puppets.bundle && !prefersReducedMotion() && typeof el.animate === 'function') {
                  el.animate(tapKeyframes(puppets.bundle.tap, 12 * (puppets.bundle.tap.hop / 110)), { duration: puppets.bundle.tap.dur * 1000, easing: 'linear' });
                }
              }}
              onPointerMove={(e) => {
                const p = press.current;
                if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MUSICAL_TIMING.moveSlop) cancelPress();
              }}
              onPointerUp={cancelPress}
              onPointerCancel={cancelPress}
              onPointerLeave={cancelPress}
              onContextMenu={MUSICAL_CAST_ON ? (e) => e.preventDefault() : undefined}
              // The header sits inside the home link: a tap on a character is just for fun.
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              {MUSICAL_CAST_ON && <span className="cm-glow" aria-hidden="true" />}
              <Image
                key={art.src}
                src={art.src}
                alt=""
                width={art.artSize}
                height={art.artSize}
                priority
                draggable={false}
                sizes="(min-width: 900px) 112px, 20vw"
                style={{ width: art.layout.width, height: 'auto', left: art.layout.left, top: art.layout.top }}
              />
              {season === null && <canvas data-puppet="" aria-hidden="true" style={puppetBox(art.trim)} />}
              {/* TODO(art): the hero's ChatGPT musical costume (art-cast-musical-<id>) replaces this code-drawn badge. */}
              {MUSICAL_CAST_ON && <span className="cm-note" aria-hidden="true" data-art-slot={`art-cast-musical-${id}`} dangerouslySetInnerHTML={{ __html: NOTE_SVG }} />}
              {crown && id === 'w' && (
                <span
                  ref={crownRef}
                  data-crown=""
                  className="absolute left-1/2"
                  style={{
                    width: `${PRO_CROWN.widthPct}%`, aspectRatio: '1 / 1', top: `${PRO_CROWN.topPct}%`,
                    transform: `translateX(-50%) rotate(${PRO_CROWN.tilt}deg)`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badgeSrc('pro-crown-sprite')}
                    alt=""
                    width={256}
                    height={256}
                    draggable={false}
                    onLoad={measureCrown}
                    style={{ position: 'static', display: 'block', width: '100%', height: '100%', filter: 'drop-shadow(0 1px 1px rgba(146, 64, 14, 0.3))' }}
                  />
                  <span
                    ref={sparkleRef}
                    className="absolute"
                    style={{ width: '38%', height: '38%', top: '-6%', right: '-4%', opacity: 0 }}
                  >
                    <Sparkle />
                  </span>
                </span>
              )}
            </span>
          );
        })}
      </div>
      {crown && target && (
        // The row is aria-hidden and takes no taps, so the crown gets its own
        // small focusable button laid over it. The header sits inside the
        // home link: the tap must not follow it.
        <button
          type="button"
          aria-label="Your Pro membership"
          aria-haspopup="dialog"
          data-no-squish=""
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSheetOpen(true); }}
          className="absolute rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500"
          style={{ left: target.left, top: target.top, width: target.width, height: target.height, background: 'transparent', zIndex: 1 }}
        />
      )}
      {crown && (
        // React events from the sheet's portal bubble up the React tree into
        // the home link around the header; stop them here.
        <span style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
          <ProCrownSheet open={sheetOpen} onOpenChange={setSheetOpen} />
        </span>
      )}
    </div>
  );
}
