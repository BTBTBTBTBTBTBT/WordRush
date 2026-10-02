// The Go Pro popup trigger (docs/FINISH_SPEC.md R3, G1): any surface that
// offers Unlimited to a free player or a guest opens the redesigned Go Pro
// popup (components/pro/go-pro-popup.tsx, mounted once in app/layout.tsx)
// instead of a plain page. `afterPurchaseHref` = where a successful checkout
// lands: the Unlimited game the player asked for. Pure event plumbing.

export const GO_PRO_EVENT = 'wordocious:go-pro';

export interface GoProRequest {
  /** Where checkout returns on success (the Unlimited game), e.g. /quadword. */
  afterPurchaseHref?: string;
  /** What the player reached for ("Unlimited QuadWord"), for the headline. */
  reason?: string;
}

/** Open the Go Pro popup from anywhere (client only). */
export function openGoProPopup(req: GoProRequest = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<GoProRequest>(GO_PRO_EVENT, { detail: req }));
}

/** The checkout return URL: the Unlimited game (same origin only) with ?purchase=success, else the current page. */
export function checkoutReturnUrl(origin: string, current: string, afterPurchaseHref?: string): string {
  if (afterPurchaseHref && afterPurchaseHref.startsWith('/') && !afterPurchaseHref.startsWith('//')) {
    const sep = afterPurchaseHref.includes('?') ? '&' : '?';
    return `${origin}${afterPurchaseHref}${sep}purchase=success`;
  }
  return current;
}
