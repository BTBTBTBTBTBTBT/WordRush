'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { CAST, mascotSrc } from '@/lib/mascots';
import { castAspect, castTrimLayout } from '@/lib/cast-moves';
import { prefersReducedMotion } from '@/lib/motion';
import { INTRO, SPLASH, introShouldPlay } from '@/lib/intro';

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

type Phase = 'off' | 'w' | 'row' | 'glide' | 'out';

export function ColdStartIntro() {
  const [phase, setPhase] = useState<Phase>('off');
  const [reduced, setReduced] = useState(false);
  const [glide, setGlide] = useState<React.CSSProperties | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const finish = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase('out');
    timers.current.push(setTimeout(() => setPhase('off'), INTRO.outMs));
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
    setReduced(rm);
    setPhase('w');
    const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
    if (rm) {
      // Reduce Motion: hold the launch look, then a 200 ms crossfade into Home.
      at(INTRO.reducedHoldMs, () => setPhase('out'));
      at(INTRO.reducedHoldMs + INTRO.reducedFadeMs, () => setPhase('off'));
      return () => timers.current.forEach(clearTimeout);
    }
    at(INTRO.rowAt, () => setPhase('row'));
    at(INTRO.glideAt, () => {
      // Glide into the Home header's cast row (when Home is on screen).
      const row = rowRef.current;
      const target = document.querySelector<HTMLElement>('[data-cast-row]');
      if (row && target) {
        const a = row.getBoundingClientRect();
        const b = target.getBoundingClientRect();
        if (a.width > 0 && b.width > 0) {
          const scale = b.width / a.width;
          const dx = b.left + b.width / 2 - (a.left + a.width / 2);
          const dy = b.top + b.height / 2 - (a.top + a.height / 2);
          setGlide({ transform: `translate(${dx}px, ${dy}px) scale(${scale})` });
        }
      }
      setPhase('glide');
    });
    at(INTRO.endAt, () => setPhase('out'));
    at(INTRO.endAt + INTRO.outMs, () => setPhase('off'));
    return () => timers.current.forEach(clearTimeout);
  }, []);

  if (phase === 'off') return null;

  const showRow = !reduced && (phase === 'row' || phase === 'glide' || phase === 'out');
  const fading = phase === 'out' || phase === 'glide';
  const hideIcon = showRow || phase === 'out';

  return (
    <div
      aria-hidden="true"
      data-no-squish=""
      onClick={finish}
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10000, cursor: 'pointer' }}
    >
      {/* The launch backdrop: Home fades in underneath as it clears. */}
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
        className={phase === 'w' && !reduced ? 'intro-bounce' : ''}
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
      {/* The cast row assembling, then gliding into the header. */}
      {showRow && (
        <div
          ref={rowRef}
          className="castrow absolute"
          style={{
            width: 'min(92vw, 440px)',
            transform: 'scale(1.08)',
            transformOrigin: 'center',
            transition: `transform ${INTRO.glideMs}ms cubic-bezier(0.45, 0, 0.2, 1), opacity ${INTRO.outMs}ms ease-out`,
            opacity: phase === 'out' && !glide ? 0 : 1,
            ...(phase !== 'row' ? glide : null),
          }}
        >
          {CAST.map((id, i) => {
            const trim = castTrimLayout(id);
            return (
              <span
                key={id}
                className="cm intro-pop"
                style={{ flex: `${castAspect(id).toFixed(3)} 1 0`, aspectRatio: castAspect(id).toFixed(4), animationDelay: `${i * INTRO.popStagger}ms` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mascotSrc(id)} alt="" style={{ width: trim.width, height: 'auto', left: trim.left, top: trim.top }} />
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
