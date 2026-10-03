// The footer tabs always go home (docs/FINISH_SPEC.md AJ). Pure decisions +
// tiny client plumbing: tapping a tab from ANY depth lands on that tab's root
// (BI11: where the player left it), closing every global overlay on the way;
// tapping the tab you're already on (at its root) scrolls to the top. The one exception: a live VS
// match registers a guard, and leaving asks first (it counts as a forfeit).

export const CLOSE_OVERLAYS_EVENT = 'wordocious:close-overlays';

// ── BI11: tab switches keep each tab's scroll position ─────────────────────
// (founder 10-02: "if you were … mid way down [on Home], and on another tab
// and click right back, the position should persist"). Coming back to a tab —
// from another tab, or out of a game with the top-left Home button — lands on
// its root where the player left it; only a re-tap of the tab you're on, at its
// root, scrolls to the top (`tabTapAction` → 'scrollTop').

/** The four tab roots (the footer's hrefs). */
export const TAB_ROOTS = ['/', '/daily', '/stats', '/friends'] as const;
/** Fired (detail = the tab's href) when a re-tap at the root scrolls it to the top. */
export const TAB_SCROLL_TOP_EVENT = 'wordocious:tab-scroll-top';

const tabScroll = new Map<string, number>();

export function isTabRoot(pathname: string | null | undefined): boolean {
  return !!pathname && (TAB_ROOTS as readonly string[]).includes(pathname);
}

/** Remember where a tab root is scrolled (px from the top). */
export function rememberTabScroll(pathname: string, y: number): void {
  if (isTabRoot(pathname)) tabScroll.set(pathname, Math.max(0, Math.round(y)));
}

/** Where a tab root was left (0 = never visited, or re-tapped to the top). */
export function rememberedTabScroll(pathname: string): number {
  return tabScroll.get(pathname) ?? 0;
}

/** Tests only. */
export function _resetTabScrollForTests(): void {
  tabScroll.clear();
}

export type TabTapAction = 'scrollTop' | 'navigate' | 'confirm';

/**
 * What a tab tap does: `confirm` while a guard is up (a live VS match),
 * `scrollTop` when already on the tab's root (no query), else `navigate` to
 * the tab's root.
 */
export function tabTapAction({ pathname, search = '', href, guarded = false }: { pathname: string; search?: string; href: string; guarded?: boolean }): TabTapAction {
  if (guarded) return 'confirm';
  const atRoot = pathname === href && (search === '' || search === '?');
  return atRoot ? 'scrollTop' : 'navigate';
}

let guardMessage: string | null = null;

/** A live VS match sets this (null clears it): leaving asks first. */
export function setLeaveGuard(message: string | null): void {
  guardMessage = message;
}

/** The current leave guard's message, or null. */
export function leaveGuard(): string | null {
  return guardMessage;
}

/** Close every global overlay (popups, sheets, hosts listen for the event). */
export function closeAllOverlays(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CLOSE_OVERLAYS_EVENT));
}

// ── AY: the top-left Home button ALWAYS lands on the Home root ─────────────
// (founder 10-02: "sometimes the new home buttons open another game"). It
// navigates to the root (never history-back, which could reveal the game this
// one was opened from: Next daily, New puzzle, Gauntlet → results), closes
// every overlay, fires once per tap (double taps are dropped), and for a
// moment after it lands, taps on Home's cards are ignored so the finger that
// pressed Home can't fall through onto the card now under it.

export const HOME_ROOT = '/';
/** Home's cards ignore taps this long after a Home-button navigation (ms). */
export const HOME_TAP_GUARD_MS = 400;
/** A second Home tap inside this window is dropped (ms). */
export const HOME_DEBOUNCE_MS = 600;

let lastHomeNav = -Infinity;

/** The Home button's target: the root, or the root with its own query (`/?more=1`); anything else → the root. */
export function homeTarget(href?: string): string {
  if (!href) return HOME_ROOT;
  return href === HOME_ROOT || href.startsWith('/?') ? href : HOME_ROOT;
}

/** Single-fire: true (and marks the time) for the first Home tap, false for a repeat inside HOME_DEBOUNCE_MS. */
export function claimHomeTap(now: number = Date.now()): boolean {
  if (now - lastHomeNav < HOME_DEBOUNCE_MS) return false;
  lastHomeNav = now;
  return true;
}

/** True while Home's cards should ignore taps (just after a Home-button navigation). */
export function homeCardTapBlocked(now: number = Date.now()): boolean {
  return now - lastHomeNav < HOME_TAP_GUARD_MS;
}

/** Tests only. */
export function _resetHomeTapForTests(): void {
  lastHomeNav = -Infinity;
}
