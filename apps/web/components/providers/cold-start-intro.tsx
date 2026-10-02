'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { CAST } from '@/lib/mascots';
import { activeSeason, castArt, type Season } from '@/lib/season';
import { prefersReducedMotion } from '@/lib/motion';
import { CAST_FLOURISH_ATTR, INTRO, INTRO_DONE_EVENT, INTRO_PRELOAD_MAX_MS, INTRO_RUNNING_ATTR, SPLASH, flourishTotalMs, glideFrame, glideTransform, introShouldPlay } from '@/lib/intro';

// The cold-start launch (docs/FINISH_SPEC.md F2). The static launch screen is
// the inline #app-loader in app/layout.tsx (the Home wallpaper color with the
// app-icon W mascot centered — SPLASH below). On a cold start at Home this
// intro takes over from the very same spot: the W bounces once; the other nine
// cast heroes pop in one after another (60 ms apart, spring) until the row
// spells WORDOCIOUS; then the whole row glides up and shrinks into the Home
// header's cast row (`[data-cast-row]`) while Home fades in underneath —
// ≤ 1.6 s, tap anywhere to skip. Reduce Motion: a 200 ms crossfade. Once per
// browser session (never on a warm start / resume), never on other routes.
// Decorative: hidden from screen readers.
//
// F2 fix (founder 10-02: "there are two of them"): ONE row on screen at a
// time. While the intro runs the real header row is hidden (opacity 0, still
// laid out: <html data-intro-running>, globals.css). At the glide the intro
// measures the real row (getBoundingClientRect) and moves its own row to
// EXACTLY that frame — left / top / width + the same top padding, so the
// per-character spacing and lift match — easing in with no overshoot. On
// landing, in the same frame, the real row turns visible and the intro row is
// removed (flushSync), then every character hops once (W hop, 420 ms, 50 ms
// apart) before the one-at-a-time moves resume. Tap to skip lands at once.
// FINISH_SPEC X: during the season the row assembles from the Halloween
// skins (the same art + framing the header draws, lib/season.ts castArt), so
// it lands on an identical row.
// AU5 ("VERY choppy" cold boot): every intro image is fetched AND decoded
// before the first intro frame (the launch look holds meanwhile, at most
// INTRO_PRELOAD_MAX_MS), the glide animates only transform (translate +
// scale, lib/intro.ts glideTransform) instead of left / top / width, and heavy
// startup work waits for the landing (afterIntro, INTRO_DONE_EVENT).

/** Fetch + decode an image off the main thread; never rejects. */
function decodeImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    if (typeof img.decode === 'function') img.decode().then(() => resolve(), () => resolve());
    else { img.onload = () => resolve(); img.onerror = () => resolve(); }
  });
}

/** The intro is over: the real row shows and deferred startup work may run. */
function endRunning() {
  html().removeAttribute(INTRO_RUNNING_ATTR);
  try { window.dispatchEvent(new Event(INTRO_DONE_EVENT)); } catch {}
}

type Phase = 'off' | 'w' | 'row' | 'glide' | 'out';

const html = () => document.documentElement;

/** Every character on the real row hops once, left to right (F2 fix step 4). */
function flourish(target: HTMLElement | null) {
  if (!target || prefersReducedMotion()) return;
  const cells = Array.from(target.querySelectorAll<HTMLElement>('.cm'));
  if (cells.length === 0) return;
  html().setAttribute(CAST_FLOURISH_ATTR, '');
  cells.forEach((el, i) => {
    el.style.setProperty('--fl-d', `${i * INTRO.flourishStagger}ms`);
    el.classList.add('cast-flourish');
    el.addEventListener('animationend', () => el.classList.remove('cast-flourish'), { once: true });
  });
  setTimeout(() => {
    cells.forEach((el) => el.classList.remove('cast-flourish'));
    html().removeAttribute(CAST_FLOURISH_ATTR);
  }, flourishTotalMs(cells.length) + 60);
}

export function ColdStartIntro() {
  const [phase, setPhase] = useState<Phase>('off');
  const [reduced, setReduced] = useState(false);
  const [frame, setFrame] = useState<React.CSSProperties | null>(null);
  /** AU5: the W only starts bouncing once the images are decoded. */
  const [started, setStarted] = useState(false);
  const [season, setSeason] = useState<Season | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const landed = useRef(false);

  /**
   * Step 3: in ONE frame the real row turns visible and the intro (row and
   * all) is removed — flushSync commits the removal before the attribute
   * comes off, so the browser never paints both rows. Then the flourish.
   */
  const land = useCallback(() => {
    if (landed.current) return;
    landed.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    flushSync(() => setPhase('off'));
    endRunning();
    flourish(document.querySelector<HTMLElement>('[data-cast-row]'));
  }, []);

  // Layout effect: decide before the first paint so the hand-off from the
  // static screen has no flash.
  useLayoutEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(INTRO.sessionKey) === '1'; } catch {}
    const loader = document.getElementById('app-loader');
    if (!introShouldPlay({ pathname: window.location.pathname, seenThisSession: seen, hasStaticSplash: !!loader })) return;
    try { sessionStorage.setItem(INTRO.sessionKey, '1'); } catch {}
    const rm = prefersReducedMotion();
    const season0 = activeSeason();
    setReduced(rm);
    setSeason(season0);
    setPhase('w');
    // Step 1: the real header row stays laid out but hidden while the intro runs.
    html().setAttribute(INTRO_RUNNING_ATTR, '');
    let cancelled = false;
    const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
    const cleanup = () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      endRunning();
    };
    const run = () => {
      if (cancelled) return;
      setStarted(true);
      if (rm) {
        // Reduce Motion: hold the launch look, then a 200 ms crossfade into Home
        // (the real row is revealed under the fading backdrop), no flourish.
        at(INTRO.reducedHoldMs, () => { endRunning(); setPhase('out'); });
        at(INTRO.reducedHoldMs + INTRO.reducedFadeMs, () => { landed.current = true; setPhase('off'); });
        return;
      }
      at(INTRO.rowAt, () => setPhase('row'));
      at(INTRO.glideAt, () => {
        // Step 2: measure the real row and glide onto EXACTLY its frame — transform only.
        const row = rowRef.current;
        const target = document.querySelector<HTMLElement>('[data-cast-row]');
        const a = row?.getBoundingClientRect();
        const b = target?.getBoundingClientRect();
        if (!row || !target || !a || !b || a.width <= 0 || b.width <= 0) {
          // No header row on screen: fade the intro out instead (nothing to land on).
          endRunning();
          setPhase('out');
          at(INTRO.outMs, () => { landed.current = true; setPhase('off'); });
          return;
        }
        const fromPad = parseFloat(getComputedStyle(row).paddingTop) || 0;
        const to = glideFrame(b, getComputedStyle(target).paddingTop);
        const t = glideTransform(a, fromPad, to, parseFloat(to.paddingTop) || 0);
        // Pin the row where it is now (no transition), then on the next frame
        // animate ONLY its transform onto the real row.
        flushSync(() => {
          setFrame({ position: 'fixed', left: a.left, top: a.top, width: a.width, transformOrigin: '0 0', transform: 'none', transition: 'none', willChange: 'transform' });
          setPhase('glide');
        });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setFrame({
              position: 'fixed', left: a.left, top: a.top, width: a.width, transformOrigin: '0 0', willChange: 'transform',
              transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale})`,
              transition: `transform ${INTRO.glideMs}ms ${INTRO.glideEase}`,
            });
          });
        });
        at(INTRO.glideMs + 30, land);
      });
    };
    // AU5: fetch + decode the W and every cast image before the first intro
    // frame; the launch look (backdrop + still W) holds until then, ≤ 300 ms.
    const srcs = [SPLASH.icon, ...CAST.map((id) => castArt(id, season0).src)];
    Promise.race([
      Promise.all(srcs.map(decodeImage)),
      new Promise<void>((r) => setTimeout(r, INTRO_PRELOAD_MAX_MS)),
    ]).then(run);
    return cleanup;
  }, [land]);

  if (phase === 'off') return null;

  const showRow = !reduced && (phase === 'row' || phase === 'glide' || phase === 'out');
  const fading = phase === 'out' || phase === 'glide';
  const hideIcon = showRow || phase === 'out';

  return (
    <div
      aria-hidden="true"
      data-no-squish=""
      onClick={() => (reduced ? undefined : land())}
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10000, cursor: 'pointer' }}
    >
      {/* The launch backdrop: Home fades in underneath as the row glides. */}
      <div
        className="absolute inset-0"
        style={{
          background: SPLASH.background,
          opacity: fading ? 0 : 1,
          transition: `opacity ${reduced ? INTRO.reducedFadeMs : phase === 'glide' ? INTRO.glideMs : INTRO.outMs}ms ease-out`,
        }}
      />
      {/* The app-icon W, same spot as the static screen: bounces, then hands over to the row. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SPLASH.icon}
        alt=""
        width={SPLASH.size}
        height={SPLASH.size}
        className={phase === 'w' && !reduced && started ? 'intro-bounce' : ''}
        style={{
          position: 'absolute',
          width: SPLASH.size,
          height: SPLASH.size,
          filter: 'drop-shadow(0 12px 24px rgba(76, 29, 149, 0.25))',
          opacity: hideIcon ? 0 : 1,
          transform: showRow ? 'scale(0.55)' : 'none',
          transition: `opacity ${reduced ? INTRO.reducedFadeMs : 220}ms ease-out, transform 260ms cubic-bezier(0.3, 1.4, 0.5, 1)`,
        }}
      />
      {/* The cast row assembling, then gliding into the header's exact frame. */}
      {showRow && (
        <div
          ref={rowRef}
          className="castrow"
          style={{
            position: 'absolute',
            width: 'min(96vw, 476px)',
            paddingTop: 4,
            opacity: phase === 'out' ? 0 : 1,
            transition: `opacity ${INTRO.outMs}ms ease-out`,
            ...(phase === 'glide' ? frame : null),
          }}
        >
          {CAST.map((id, i) => {
            const art = castArt(id, season);
            return (
              <span
                key={id}
                className="cm intro-pop"
                style={{ flex: `${art.aspect.toFixed(3)} 1 0`, aspectRatio: art.aspect.toFixed(4), animationDelay: `${i * INTRO.popStagger}ms` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={art.src} alt="" width={art.artSize} height={art.artSize} style={{ width: art.layout.width, height: 'auto', left: art.layout.left, top: art.layout.top }} />
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
