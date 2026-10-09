// ============================================================
// "What's new in 2.8" tour (FRIDAY-QUEUE item 41)
// ============================================================
// One-time, skippable, after updating — never for brand-new players. The pages and the decision are shared so
// web, iOS and Android say the same words and decide the same way (pinned by whats-new tests ×3).
//
// Who sees it: a signed-in player who finished onboarding BEFORE 2.8 (their account is older than the cutoff).
// A brand-new account (created on/after the cutoff, or not yet onboarded) never sees it, and the key is
// recorded quietly so it never shows later. "Seen" lives in the synced tutorials_seen list (key `whats-new-28`),
// so closing or skipping it on one device keeps it away on the others. Gate: the `whats_new_28` off-switch.

export const WHATS_NEW_KEY = 'whats-new-28';
export const WHATS_NEW_FLAG = 'whats_new_28';

/** Accounts created on or after this local date (YYYY-MM-DD) are 2.8-era players: no tour. Set to the 2.8 go-live date. */
export const WHATS_NEW_CUTOFF = '2026-10-11';

export type WhatsNewPlatform = 'web' | 'ios' | 'android';

/** What a page draws: a shipped art name, the player's own living mascot, or a row of game icons. */
export type WhatsNewArt =
  | { kind: 'art'; name: string }
  | { kind: 'mascot' }
  | { kind: 'icons'; names: string[] };

export interface WhatsNewPage {
  id: string;
  /** Bubble-lettered title (caps). */
  title: string;
  lines: string[];
  art: WhatsNewArt;
  /** Platforms that show it (a page about a feature a platform lacks is left out there). */
  platforms: readonly WhatsNewPlatform[];
}

const ALL: readonly WhatsNewPlatform[] = ['web', 'ios', 'android'];
const APPS: readonly WhatsNewPlatform[] = ['ios', 'android'];

export const WHATS_NEW_PAGES: readonly WhatsNewPage[] = [
  {
    id: 'season', title: 'HALLOWEEN IS HERE',
    lines: ['The whole cast is in costume, with spooky screens and tunes.', 'Pick a seasonal theme in Settings, or switch it off any time.'],
    art: { kind: 'art', name: 'art-halloween-prop-pumpkin' }, platforms: ALL,
  },
  {
    id: 'alive', title: 'YOUR MASCOT IS ALIVE',
    lines: ['Your mascot breathes, blinks and reacts as you play.', 'Tap it to say hi.'],
    art: { kind: 'mascot' }, platforms: ALL,
  },
  {
    id: 'order', title: 'PUT GAMES IN YOUR ORDER',
    lines: ['Tap the pencil by Dailies or Puzzles, or press and hold a game, then drag it.', 'Classic always stays first.'],
    art: { kind: 'icons', names: ['game-practice', 'game-quordle', 'game-octordle'] }, platforms: ALL,
  },
  {
    id: 'invites', title: 'INVITES AND POCKET GAMES',
    lines: ['One link per invite, straight to the right screen.', 'Pocket games play live now: watch your friend move as it happens.'],
    art: { kind: 'icons', names: ['game-pocket-rps', 'game-pocket-ttt', 'game-pocket-coin'] }, platforms: ALL,
  },
  {
    id: 'widgets', title: 'NEW WIDGETS',
    lines: ['Widgets with your mascot show today’s games, your streak and a live countdown.', 'Add one from your home screen.'],
    art: { kind: 'icons', names: ['game-sweep'] }, platforms: APPS,
  },
  {
    id: 'packs', title: 'MASCOT PACKS',
    lines: ['New bodies, costumes and parts in the Dressing Room.', 'Make your mascot truly yours.'],
    art: { kind: 'art', name: 'art-pose-o1-cheer' }, platforms: ALL,
  },
];

/** The pages this platform shows, in order. */
export function whatsNewPages(platform: WhatsNewPlatform): WhatsNewPage[] {
  return WHATS_NEW_PAGES.filter((p) => p.platforms.includes(platform));
}

export type WhatsNewDecision = 'show' | 'record' | 'wait' | 'none';

/**
 * show   — open the tour.
 * record — a brand-new player: write the key quietly (nothing shown), so it never appears later.
 * wait   — not decidable yet (flags or the seen list still loading).
 * none   — nothing to do (already seen, switched off, guest).
 */
export function whatsNewDecision(i: {
  live: boolean;
  /** The player's seen list; null while it is still loading. */
  seen: readonly string[] | null;
  signedIn: boolean;
  /** profile.has_onboarded; null while unknown. */
  hasOnboarded: boolean | null;
  /** profile.created_at (ISO) when known. */
  createdAt: string | null | undefined;
  cutoff?: string;
}): WhatsNewDecision {
  if (!i.live || !i.signedIn) return 'none';
  if (i.seen === null || i.hasOnboarded === null) return 'wait';
  if (i.seen.includes(WHATS_NEW_KEY)) return 'none';
  const cutoff = i.cutoff ?? WHATS_NEW_CUTOFF;
  const created = (i.createdAt ?? '').slice(0, 10);
  const brandNew = !i.hasOnboarded || (created !== '' && created >= cutoff);
  return brandNew ? 'record' : 'show';
}
