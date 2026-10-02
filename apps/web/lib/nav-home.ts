// The footer tabs always go home (docs/FINISH_SPEC.md AJ). Pure decisions +
// tiny client plumbing: tapping a tab from ANY depth lands on that tab's root
// at the top, closing every global overlay on the way; tapping the tab you're
// already on (at its root) scrolls to the top. The one exception: a live VS
// match registers a guard, and leaving asks first (it counts as a forfeit).

export const CLOSE_OVERLAYS_EVENT = 'wordocious:close-overlays';

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
