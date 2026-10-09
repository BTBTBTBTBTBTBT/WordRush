import { ADS_SERVING } from '@wordle-duel/core';

// "Welcome to Pro" (docs/FINISH_SPEC.md AP): the one-time full-screen moment
// right after a player's FIRST Pro purchase, or the first activation of a
// gifted week. Never again (localStorage flag `pro-welcomed:<user id>`), never
// for restores, never for players who were already Pro.
//
// The trigger is "this session saw a purchase / redeem signal AND the profile
// is Pro now": the Stripe return (?purchase=success, set server-side on every
// checkout success URL) or the referral redeemer's "Pro unlocked" claim. A
// player who is Pro with no signal (already Pro before this shipped, bought on
// another device, a restore) gets the flag set silently instead.
//
// Pure decisions + tiny client plumbing (flag + window events). The screen is
// components/pro/pro-welcome.tsx (ProWelcomeHost, mounted in app/layout.tsx).

export type ProWelcomeKind = 'purchase' | 'gift';

/** localStorage flag prefix; the key is per user: `pro-welcomed:<user id>`. */
export const PRO_WELCOMED_KEY = 'pro-welcomed';
/** A purchase / redeem signal for the host (detail: ProWelcomeSignal). */
export const PRO_WELCOME_EVENT = 'wordocious:pro-welcome';
/** Fired when the welcome closes: the cast header drops the crown onto W (AA1) with a sparkle. */
export const CROWN_DROP_EVENT = 'wordocious:crown-drop';

export interface ProWelcomeSignal {
  kind: ProWelcomeKind;
  /** Pro before the signal? false = known not-Pro, null = unknown (the Stripe return). */
  proBefore: boolean | null;
  /** The Stripe plan id from the success URL (?plan=), when known. */
  plan?: string | null;
}

export interface ProWelcomeState {
  /** The per-user flag is already set. */
  welcomed: boolean;
  /** The profile is Pro right now (expiry-aware). */
  proNow: boolean;
  /** This session's purchase / redeem signal, if any. */
  signal: ProWelcomeSignal | null;
}

/**
 * - show: the not-Pro → Pro transition this session, with a purchase/redeem signal.
 * - mark: Pro with no signal (or Pro before the signal): set the flag silently.
 * - wait: a signal is pending but the entitlement hasn't landed yet (webhook).
 * - none: nothing to do.
 */
export type ProWelcomeDecision = 'show' | 'mark' | 'wait' | 'none';

export function decideProWelcome({ welcomed, proNow, signal }: ProWelcomeState): ProWelcomeDecision {
  if (welcomed) return 'none';
  if (!proNow) return signal ? 'wait' : 'none';
  if (!signal) return 'mark';
  // Pro before the signal (a gift on top of a live plan, ...): not a first purchase.
  if (signal.proBefore === true) return 'mark';
  // proBefore null = the Stripe return: the webhook may have landed before the
  // page loaded, so "Pro on load" is still this purchase. The success URL is
  // only ever produced by a completed checkout.
  return 'show';
}

/**
 * A gifted week's server marker (GET /api/pro/gift → the caller's redeemed referral) still
 * deserves its welcome: redeemed within the gift week (+1 day of slack for a late first open).
 * This is what catches a gift redeemed where no in-session signal fired (another device, the
 * /join Accept path before it signaled, the native apps).
 */
export const GIFT_WELCOME_DAYS = 8;

export function giftWelcomeDue(redeemedAt: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!redeemedAt) return false;
  const t = Date.parse(redeemedAt);
  if (!Number.isFinite(t)) return false;
  return t <= nowMs + 60_000 && nowMs - t < GIFT_WELCOME_DAYS * 86_400_000;
}

/** The Stripe return: ?purchase=success (and the plan id the server adds). */
export function purchaseSignalFromSearch(search: string): ProWelcomeSignal | null {
  let params: URLSearchParams;
  try { params = new URLSearchParams(search); } catch { return null; }
  if (params.get('purchase') !== 'success') return null;
  return { kind: 'purchase', proBefore: null, plan: params.get('plan') };
}

/** Plans whose checkout credits 4 streak shields (lib/payment/stripe-fulfillment.ts; never the day pass). */
const SHIELD_PLANS = new Set(['pro_monthly', 'pro_yearly']);

/**
 * Were streak shields credited by this activation? A rise in the profile's
 * shield count since the session started, or a monthly / yearly checkout
 * (the webhook may have credited them before the page loaded). Gifted weeks
 * credit none.
 */
export function shieldsCredited({ kind, plan, shieldsBefore, shieldsNow }: {
  kind: ProWelcomeKind;
  plan?: string | null;
  shieldsBefore: number | null;
  shieldsNow: number | null;
}): boolean {
  if (shieldsBefore != null && shieldsNow != null && shieldsNow > shieldsBefore) return true;
  return kind === 'purchase' && !!plan && SHIELD_PLANS.has(plan);
}

/** The lettering headline. */
export function proWelcomeHeadline(kind: ProWelcomeKind): string {
  return kind === 'gift' ? 'YOUR FREE WEEK OF PRO!' : 'WELCOME TO PRO!';
}

/** The welcome line under the headline. */
export function proWelcomeLine(name: string | null | undefined): string {
  const who = name?.trim();
  return `Thanks for joining${who ? `, ${who}` : ''}! Here's everything you just unlocked.`;
}

/**
 * Where LET'S PLAY goes: back where they were (the Stripe return already lands
 * on the Unlimited game they reached for), except the Pro page itself, which
 * sends them Home to play. null = just close.
 */
export function letsPlayHref(pathname: string): string | null {
  return pathname === '/pro' || pathname.startsWith('/pro/') ? '/' : null;
}

/** The eight benefit cards, in order. `art` names an art file / 3D icon. */
export type ProBenefitArt =
  | { scene: 'unlimited-loop' | 'ladder-cleared' | 'shield-guard' | 'gift-pro' }
  | { badge: 'swords' | 'level-pro' | 'trending-up' }
  | { icon: 'badge-check' | 'bell' };

export const PRO_WELCOME_BENEFITS: readonly { title: string; line: string; accent: string; art: ProBenefitArt }[] = [
  { title: 'Play unlimited', line: 'Fresh puzzles in every game, no waiting.', accent: '#fb923c', art: { scene: 'unlimited-loop' } },
  // Ads aren't serving, so "No ads, ever" would promise nothing (core ads.ts): the card becomes a real perk, keeping the 2-column grid even.
  ADS_SERVING
    ? { title: 'No ads, ever', line: 'Nothing between you and the next puzzle.', accent: '#10b981', art: { icon: 'badge-check' } }
    : { title: 'First in line', line: 'Early access to new game modes.', accent: '#f97316', art: { icon: 'bell' } },
  { title: 'VS everything', line: 'Live VS in every mode, plus private matches.', accent: '#0d9488', art: { badge: 'swords' } },
  { title: 'Battle the cast', line: 'Take on all ten of the cast, anytime.', accent: '#7c3aed', art: { scene: 'ladder-cleared' } },
  { title: '4 shields a cycle', line: 'Four streak shields every billing period.', accent: '#6366f1', art: { scene: 'shield-guard' } },
  { title: 'Gift Pro', line: 'Give 3 friends a free week of Pro.', accent: '#ec4899', art: { scene: 'gift-pro' } },
  { title: 'The Pro look', line: 'A crown on W, gold frames, Pro hats and backdrops.', accent: '#f5a524', art: { badge: 'level-pro' } },
  { title: 'Deeper stats', line: 'Win rate trends and speed in every mode.', accent: '#3b82f6', art: { badge: 'trending-up' } },
];

/** Stagger between the benefit cards popping in (ms). */
export const BENEFIT_STAGGER_MS = 70;

// ── client plumbing (no-ops on the server) ──

export function proWelcomedKey(userId: string): string {
  return `${PRO_WELCOMED_KEY}:${userId}`;
}

export function readProWelcomed(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(proWelcomedKey(userId)) === '1'; } catch { return false; }
}

export function markProWelcomed(userId: string): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(proWelcomedKey(userId), '1'); } catch { /* private mode */ }
}

/**
 * Hand a purchase / redeem signal to the welcome host. Call it BEFORE
 * refreshing the profile, so the host sees the signal before the Pro
 * transition (otherwise it would mark the flag silently). Returns true when
 * the welcome will take over (not already welcomed, not Pro before), so the
 * caller can skip its own smaller celebration.
 */
export function startProWelcome(userId: string, signal: ProWelcomeSignal): boolean {
  if (typeof window === 'undefined') return false;
  if (readProWelcomed(userId) || signal.proBefore === true) return false;
  window.dispatchEvent(new CustomEvent<ProWelcomeSignal>(PRO_WELCOME_EVENT, { detail: signal }));
  return true;
}
