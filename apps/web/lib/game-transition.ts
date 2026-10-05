'use client';

// FINISH_SPEC BJ9 — games "grow + soft rise" from the tapped card and shrink back
// (iOS GameTransition.swift, Android GameMotion.kt; numbers in lib/motion-spec.ts).
//
// With the View Transitions API (Chrome / Edge / Safari 18): the tapped card lifts
// (one WAAPI transform), then ONE view transition runs. Its `game-shell` group
// morphs from the lifted card to the full screen; its NEW image is a solid shell in
// the card's color (a temporary fixed div), its OLD image the card itself. The game
// route is rendered — built — inside the transition's update callback, before any
// of it shows, and fades in over the last 60% of the grow (`::view-transition-new
// (root)`). The browser composites every frame from snapshots: nothing live moves.
// Closing runs the reverse transition back into the SAME card (found by its
// `data-game-source` key on the freshly rendered Home). CSS: globals.css "BJ9".
//
// Fallback (no View Transitions): one fixed shell div animated with WAAPI
// (transform + opacity only) over the navigation. Reduce Motion: a cross-fade.

import { MOTION, openKind, revealTiming, shellTransform, usableSource, liftedFrame, closeDurationMs, riseStartFrame, type Box } from '@/lib/motion-spec';

type Router = { push: (href: string) => void };

interface Source { key: string | null; color: string; radius: number }

let current: Source | null = null;
let running = false;

// ── route-rendered signal (RouteSignal in the root layout calls notifyRoute) ──

let waiters: Array<{ path: string; resolve: () => void; inTransition: boolean }> = [];

export function notifyRoute(pathname: string): void {
  const ready = waiters.filter((w) => w.path === pathname);
  waiters = waiters.filter((w) => w.path !== pathname);
  for (const w of ready) {
    // Inside a view transition's update callback the browser suppresses rendering,
    // so requestAnimationFrame never fires until the callback settles — waiting a
    // frame there deadlocked every open/close until the timeout (a 1.5 s frozen
    // frame, perf tour 10-05). A macrotask lets the commit's other effects run; the
    // browser lays out the new route itself when it captures the new state.
    if (w.inTransition) setTimeout(w.resolve, 0);
    // Fallback path: one frame after the commit, so the new route has laid out
    // (its art requested) before the shell fades off it.
    else requestAnimationFrame(w.resolve);
  }
}

/** Resolves once `href`'s route has committed (exported for tests). */
export function waitForRoute(href: string, opts: { inTransition: boolean }, timeout = 1500): Promise<void> {
  const path = href.split('?')[0].split('#')[0] || '/';
  return new Promise((resolve) => {
    const w = { path, resolve, inTransition: opts.inTransition };
    waiters.push(w);
    setTimeout(() => { waiters = waiters.filter((x) => x !== w); resolve(); }, timeout);
  });
}

const IN_VT = { inTransition: true };
const NO_VT = { inTransition: false };

// ── helpers ──

function reduceMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.dataset.reducedMotion === 'true';
}

type VTDocument = Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void>; ready: Promise<void> } };

function screenBox(): Box {
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

function toBox(r: DOMRect): Box {
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** A solid full-viewport shell (the cheap thing that moves). */
function makeShell(color: string, named: boolean): HTMLDivElement {
  const d = document.createElement('div');
  d.setAttribute('aria-hidden', 'true');
  d.className = 'game-shell';
  d.style.cssText = `position:fixed;inset:0;z-index:2147483000;pointer-events:none;background:${color};`
    + 'transform-origin:0 0;will-change:transform,opacity;contain:strict;';
  if (named) d.style.setProperty('view-transition-name', 'game-shell');
  document.body.appendChild(d);
  return d;
}

function setVars(color: string, radius: number, kind: string) {
  const root = document.documentElement;
  root.style.setProperty('--shell-color', color);
  root.style.setProperty('--shell-radius', `${radius}px`);
  root.classList.add('vt-game', `vt-game-${kind}`);
}

function clearVars() {
  const root = document.documentElement;
  root.classList.remove('vt-game', 'vt-game-open', 'vt-game-rise', 'vt-game-close', 'vt-game-close-rise', 'vt-game-fade');
}

function lift(el: HTMLElement): Promise<void> {
  const a = el.animate(
    [{ transform: 'none' }, { transform: `translateY(-${MOTION.liftRise}px) scale(${MOTION.liftScale})` }],
    { duration: MOTION.liftMs, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'forwards' },
  );
  return a.finished.then(() => undefined, () => undefined);
}

// ── open ──

/**
 * Open the game at `href` from the tapped card `el` (null = no source: the centered
 * soft rise). `color` is the card's shell color, `radius` its corner radius.
 */
export function openGame(router: Router, href: string, el: HTMLElement | null, opts: { key?: string; color: string; radius?: number }): void {
  if (running) { router.push(href); return; }
  const radius = opts.radius ?? 16;
  const frame = el ? usableSource(toBox(el.getBoundingClientRect()), screenBox()) : null;
  const kind = openKind(!!frame, reduceMotion());
  current = { key: frame ? opts.key ?? null : null, color: opts.color, radius };
  const doc = document as VTDocument;

  if (kind === 'crossFade') {
    if (!doc.startViewTransition) { router.push(href); return; }
    running = true;
    setVars(opts.color, radius, 'fade');
    const t = doc.startViewTransition(async () => { router.push(href); await waitForRoute(href, IN_VT); });
    t.finished.finally(() => { clearVars(); running = false; });
    return;
  }

  running = true;
  const start = async () => {
    if (doc.startViewTransition) {
      if (el && frame) el.style.setProperty('view-transition-name', 'game-shell');
      setVars(opts.color, radius, frame ? 'open' : 'rise');
      let shell: HTMLDivElement | null = null;
      const t = doc.startViewTransition(async () => {
        if (el) el.style.removeProperty('view-transition-name');
        router.push(href);
        await waitForRoute(href, IN_VT);
        // The game is rendered (built) under the transition; the shell is its new image.
        shell = makeShell(opts.color, true);
      });
      t.finished.finally(() => {
        shell?.remove();
        if (el) el.getAnimations().forEach((a) => a.cancel());
        clearVars();
        running = false;
      });
      return;
    }
    // Fallback: one shell div, one WAAPI timeline.
    const screen = screenBox();
    const shell = makeShell(opts.color, false);
    const from = frame ? liftedFrame(frame) : riseStartFrame(screen);
    const grow = shell.animate(
      [
        { transform: shellTransform(from, screen), opacity: 0, borderRadius: `${radius}px` },
        { transform: shellTransform(from, screen), opacity: 1, offset: 0.2 },
        { transform: 'none', opacity: 1, borderRadius: '0px' },
      ],
      { duration: frame ? MOTION.growMs : MOTION.riseMs, easing: MOTION.growEase, fill: 'forwards' },
    );
    router.push(href);
    await Promise.all([grow.finished.catch(() => undefined), waitForRoute(href, NO_VT)]);
    if (el) el.getAnimations().forEach((a) => a.cancel());
    const r = revealTiming(kind);
    const fade = shell.animate([{ opacity: 1 }, { opacity: 0 }], { duration: r.duration, easing: 'ease-out', fill: 'forwards' });
    await fade.finished.catch(() => undefined);
    shell.remove();
    running = false;
  };
  if (el && frame) lift(el).then(start); else start();
}

// ── close ──

/** Close the game back to `href` (Home), shrinking into the card it came from. */
export function closeGame(router: Router, href: string): void {
  if (running) { router.push(href); return; }
  const src = current;
  const doc = document as VTDocument;
  if (!src || reduceMotion()) {
    if (doc.startViewTransition && reduceMotion()) {
      running = true;
      setVars(src?.color ?? 'var(--color-bg)', 0, 'fade');
      const t = doc.startViewTransition(async () => { router.push(href); await waitForRoute(href, IN_VT); });
      t.finished.finally(() => { clearVars(); running = false; });
    } else {
      router.push(href);
    }
    return;
  }
  running = true;
  if (doc.startViewTransition) {
    // OLD image: a solid shell at full screen (it fades in over the game: the game
    // "fades out"); NEW image: the card itself, found on the rendered Home.
    const shell = makeShell(src.color, true);
    let target: HTMLElement | null = null;
    setVars(src.color, src.radius, 'close');
    const t = doc.startViewTransition(async () => {
      shell.remove();
      router.push(href);
      await waitForRoute(href, IN_VT);
      target = src.key ? document.querySelector<HTMLElement>(`[data-game-source="${CSS.escape(src.key)}"]`) : null;
      const box = target ? usableSource(toBox(target.getBoundingClientRect()), screenBox()) : null;
      if (target && box) target.style.setProperty('view-transition-name', 'game-shell');
      else document.documentElement.classList.replace('vt-game-close', 'vt-game-close-rise');
    });
    t.finished.finally(() => {
      target?.style.removeProperty('view-transition-name');
      clearVars();
      running = false;
    });
    return;
  }
  // Fallback: fade a shell over the game, navigate, shrink it into the card.
  const screen = screenBox();
  const shell = makeShell(src.color, false);
  shell.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.closeFadeMs, easing: 'ease-out', fill: 'forwards' })
    .finished.catch(() => undefined)
    .then(async () => {
      router.push(href);
      await waitForRoute(href, NO_VT);
      const target = src.key ? document.querySelector<HTMLElement>(`[data-game-source="${CSS.escape(src.key)}"]`) : null;
      const box = target ? usableSource(toBox(target.getBoundingClientRect()), screen) : null;
      const to = box ?? riseStartFrame(screen);
      const a = shell.animate(
        [
          { transform: 'none', opacity: 1, borderRadius: '0px' },
          { transform: shellTransform(to, screen), opacity: 1, offset: 1 - MOTION.shrinkFadeFraction },
          { transform: shellTransform(to, screen), opacity: 0, borderRadius: `${src.radius}px` },
        ],
        { duration: box ? MOTION.shrinkMs : closeDurationMs('rise') - MOTION.closeFadeMs, easing: MOTION.growEase, fill: 'forwards' },
      );
      await a.finished.catch(() => undefined);
      shell.remove();
      running = false;
    });
}

/** The source the visible game came from (tests / debugging). */
export function _currentSource(): Source | null {
  return current;
}
