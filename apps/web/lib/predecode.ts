import { pageWall, artSrc, wideWallSrc } from './art';

// Image pre-decoding (FINISH_SPEC AZ / AQ2, web smoothness pass): decode art
// off the main thread BEFORE the animation that shows it, so no frame of an
// entrance or a tab switch waits on a decode. Used by the popups
// (hooks/use-decoded-entrance.ts), the cold-start intro, and the desktop
// tab wallpapers (warmTabWallpapers). Pure helpers + one small client loader.

/** The longest a popup holds its first frame for its art (ms). */
export const DECODE_WAIT_MS = 180;

/**
 * Does a popup need to wait for its images? 'none' when there are none or
 * every one is already loaded (a loaded image is decoded in a frame);
 * otherwise 'decode'.
 */
export function entranceWait(imgs: ReadonlyArray<{ complete: boolean; naturalWidth: number }>): 'none' | 'decode' {
  return imgs.every((i) => i.complete && i.naturalWidth > 0) ? 'none' : 'decode';
}

/** Fetch + decode one image URL; never rejects. Client only. */
export function decodeImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    if (typeof img.decode === 'function') img.decode().then(() => resolve(), () => resolve());
    else { img.onload = () => resolve(); img.onerror = () => resolve(); }
  });
}

/** Decode a list one after another (never floods the network or the decoder); never rejects. */
export async function decodeInSequence(srcs: readonly string[]): Promise<void> {
  for (const src of srcs) await decodeImage(src);
}


/** The four tab pages' wallpapers, in tab order (the portrait or the wide twin). */
export function tabWallpaperSrcs(wide: boolean): string[] {
  return (['home', 'leaderboard', 'stats', 'friends'] as const).map((t) => (wide ? wideWallSrc(pageWall(t)) : artSrc(pageWall(t))));
}

let wallsWarmed = false;

/**
 * Fetch + decode the tab wallpapers once per page load, one at a time, when
 * the browser is idle — a tab switch then paints its 2400 × 1500 wallpaper
 * without a network wait or a cold decode in the switch's first frames.
 * `wide` = the window uses the wide twins (globals.css .page-bg media query).
 */
export function warmTabWallpapers(wide: boolean): void {
  if (wallsWarmed || typeof window === 'undefined') return;
  wallsWarmed = true;
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  const go = () => { void decodeInSequence(tabWallpaperSrcs(wide)); };
  if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 5000 }); else setTimeout(go, 2500);
}
