'use client';

import { useEffect } from 'react';
import { prefersReducedMotion } from '@/lib/motion';
import { squishKind, squishTargetIsChild, SQUISH_FRAMES, type SquishKind } from '@/lib/squish';
import { feedback, physicalDeleteFeedback } from '@/lib/sound-events';

// Everything tappable squishes (docs/FINISH_SPEC.md A9; A3 header icons, A4 tab
// icons, A8 candy buttons, B2 keys): ONE document-level listener gives every
// button, icon button, link, chip, segmented option, game tile, card and list
// row that responds to a tap the same spongy press — down to ~.92 on
// touch-down (icons .86 / .80, keys sink into their lip), then a bouncy spring
// back past 1 (~1.05) on release, ≈260 ms. It runs on the Web Animations API
// composed over the element's own transform, so centered / translated
// elements keep their place, and nothing needs a class to opt in. Opt out
// with `data-no-squish` on the element or an ancestor. Off with Reduce Motion
// (the OS setting or the in-app toggle).

/** What counts as tappable. */
const TAPPABLE = [
  'button', 'a[href]', 'summary', 'label[for]',
  '[role="button"]', '[role="tab"]', '[role="radio"]', '[role="option"]', '[role="switch"]',
  '[role="menuitem"]', '[role="menuitemradio"]', '[role="checkbox"]', '[role="link"]', '[data-squish]',
].join(',');

interface Press {
  el: HTMLElement;
  kind: SquishKind;
  base: string;
  anim: Animation | null;
}

let press: Press | null = null;
/** FINISH_SPEC U: a press made the `press` sound, so its release makes `release` (keys have their own `tap`). */
let pressSounded = false;

function isDisabled(el: Element): boolean {
  return (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';
}

/** The element to squish for a pointer target, and how (null = nothing tappable / opted out). */
function resolve(target: EventTarget | null): { el: HTMLElement; kind: SquishKind } | null {
  const start = target instanceof Element ? target : null;
  if (!start || start.closest('[data-no-squish]')) return null;
  const hit = start.closest<HTMLElement>(TAPPABLE);
  if (!hit || isDisabled(hit)) return null;
  // A tab: the icon inside squishes (A4), not the whole tab.
  const icon = hit.querySelector<HTMLElement>(':scope .tab-squish');
  if (icon) return { el: icon, kind: 'icon' };
  if (hit.matches('input, select, textarea')) return null;
  // AK: an inline wrapper (a <Link> around a block card) can't be transformed: squish its first child.
  let el: HTMLElement = hit;
  const child = hit.firstElementChild as HTMLElement | null;
  if (squishTargetIsChild(getComputedStyle(hit).display, !!child) && child) el = child;
  const attr = hit.getAttribute('data-squish') ?? el.getAttribute('data-squish');
  const cls = `${typeof hit.className === 'string' ? hit.className : ''} ${typeof el.className === 'string' ? el.className : ''}`;
  return { el, kind: squishKind(cls, hit.tagName, attr) };
}

function baseTransform(el: HTMLElement): string {
  const t = getComputedStyle(el).transform;
  return t && t !== 'none' ? t : '';
}

function down(target: EventTarget | null) {
  release(true);
  const hit = resolve(target);
  if (hit && hit.kind !== 'key') { feedback('press'); pressSounded = true; }
  if (prefersReducedMotion()) return;
  if (!hit || typeof hit.el.animate !== 'function') return;
  const { el, kind } = hit;
  const base = baseTransform(el);
  const f = SQUISH_FRAMES[kind];
  const anim = el.animate(
    [{ transform: `${base} ${f.rest}`.trim() }, { transform: `${base} ${f.down}`.trim() }],
    { duration: f.downMs, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
  );
  if (kind === 'candy') el.classList.add('candy-pressed');
  press = { el, kind, base, anim };
}

/** Spring back; `silent` (a scroll's pointercancel, a stale press) skips the `release` sound. */
function release(silent = false) {
  if (pressSounded) { pressSounded = false; if (!silent) feedback('release'); }
  const p = press;
  press = null;
  if (!p) return;
  const { el, kind, base, anim } = p;
  const f = SQUISH_FRAMES[kind];
  anim?.cancel();
  el.classList.remove('candy-pressed');
  if (prefersReducedMotion() || typeof el.animate !== 'function') return;
  el.animate(
    [
      { transform: `${base} ${f.down}`.trim() },
      { transform: `${base} ${f.over}`.trim(), offset: 0.55 },
      { transform: `${base} ${f.rest}`.trim() },
    ],
    { duration: f.upMs, easing: 'ease-out' },
  );
}

export function SquishHost() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      down(e.target);
    };
    const onUp = () => release();
    // AK: a scroll starting cancels the press silently (never blocks the scroll).
    const onCancel = () => release(true);
    const onKeyDown = (e: KeyboardEvent) => {
      physicalDeleteFeedback(e);
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) down(document.activeElement);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') release();
    };
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('pointercancel', onCancel, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onCancel);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onCancel);
    };
  }, []);
  return null;
}
