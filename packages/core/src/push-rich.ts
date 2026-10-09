// ============================================================
// Rich push (FRIDAY-QUEUE item 34): copy rules, grouping and the fields the clients build the card from.
// ============================================================
// Titles read complete at ~28 characters (the collapsed lock-screen line never truncates mid-word) and
// the detail lives in the body. Pushes group by friend / game (thread ids on iOS, groups + a summary on
// Android) and rapid-fire moves in one game COLLAPSE into the latest. The sender's mascot is the avatar
// (iOS Communication Notification, Android MessagingStyle Person).
// Gated by the `rich_push` off-switch (feature-switches.ts): off = the plain legacy payload.

export const PUSH_TITLE_MAX = 28;

export type RichTitleKind =
  | 'played' | 'started' | 'challenge' | 'taunt' | 'reaction' | 'rematch' | 'friendRequest' | 'gift' | 'looking'
  | 'beatRun' | 'tiedRun' | 'heldRun' | 'accepted' | 'nudge' | 'shield' | 'passed';

/** Candidate titles from most to least specific; the first that fits PUSH_TITLE_MAX wins. */
function candidates(kind: RichTitleKind, name: string, game?: string): string[] {
  const g = (game ?? '').trim();
  switch (kind) {
    case 'played': return [g ? `${name} played ${g}` : '', `${name} played`, name];
    case 'started': return [g ? `${name} started ${g}` : '', `${name} started a game`, `${name} played`, name];
    case 'challenge': return [g ? `${name} wants ${g}` : '', `${name} challenged you`, name];
    case 'taunt': return [`Taunt from ${name}`, `${name} taunted you`, name];
    case 'reaction': return [`${name} reacted`, name];
    case 'rematch': return [`${name} wants a rematch`, `${name} wants more`, name];
    case 'friendRequest': return [`${name} wants to be friends`, `${name} friend request`, name];
    case 'gift': return [`${name} sent you a gift`, name];
    case 'beatRun': return [g ? `${name} beat your ${g} run` : '', `${name} beat your run`, `${name} beat you`, name];
    case 'tiedRun': return [g ? `${name} tied your ${g} run` : '', `${name} tied your run`, name];
    case 'heldRun': return [g ? `Your ${g} run held up` : '', 'Your run held up'];
    case 'accepted': return [`${name} is now a friend`, `${name} accepted`, name];
    case 'nudge': return [`${name} nudged you`, name];
    case 'shield': return [`${name} sent a shield`, `${name} sent you a gift`, name];
    case 'passed': return [g ? `${name} passed you in ${g}` : '', `${name} passed you`, name];
    case 'looking': return [g ? `${name} is on ${g}` : '', `${name} is online`, name];
  }
}

/** A title that reads complete in <= PUSH_TITLE_MAX characters (a long name alone is cut at a character, never mid-phrase). */
export function richPushTitle(kind: RichTitleKind, name: string | null | undefined, game?: string | null): string {
  const who = (name ?? '').trim() || 'A friend';
  for (const c of candidates(kind, who, game ?? undefined)) {
    if (c && c.length <= PUSH_TITLE_MAX) return c;
  }
  return who.length <= PUSH_TITLE_MAX ? who : `${who.slice(0, PUSH_TITLE_MAX - 1)}…`;
}

/** Grouping ids. A friend's pushes stack together; a pocket game / VS challenge stacks on its own id. */
export function richThread(opts: { senderId?: string | null; gameRowId?: string | null }): string {
  if (opts.gameRowId) return `game:${opts.gameRowId}`;
  if (opts.senderId) return `friend:${opts.senderId}`;
  return 'wordocious';
}

/** Rapid-fire moves in one game collapse into the latest (APNs apns-collapse-id <= 64 bytes, FCM collapse_key). */
export function richCollapseId(opts: { gameRowId?: string | null; senderId?: string | null; kind: string }): string | undefined {
  const base = opts.gameRowId ? `move:${opts.gameRowId}` : opts.senderId ? `${opts.kind}:${opts.senderId}` : undefined;
  return base ? base.slice(0, 64) : undefined;
}

export const PUSH_HALLOWEEN_ACCENT = '#fb923c';
export const PUSH_DEFAULT_ACCENT = '#7c3aed';

/** The notification accent: the game's own color, Halloween orange in season (and the season switch is on). */
export function richAccent(gameAccentHex: string | null | undefined, halloween: boolean): string {
  if (halloween) return PUSH_HALLOWEEN_ACCENT;
  return /^#[0-9a-fA-F]{6}$/.test(gameAccentHex ?? '') ? (gameAccentHex as string) : PUSH_DEFAULT_ACCENT;
}

/** What the clients read to build the card. All strings (FCM data / APNs custom keys). */
export interface RichPushFields {
  senderId: string;
  senderName: string;
  /** Absolute https PNG URL of the sender's mascot / photo (server-rendered). */
  senderAvatar: string;
  gameId: string;
  gameTitle: string;
  /** Absolute https PNG URL of the game's art (thumbnail / BigPicture). */
  gameImage: string;
  thread: string;
  accent: string;
  halloween: '1' | '0';
  /** The RECIPIENT's own avatar PNG (the long-press card's "you"): set per device by broadcastPush. */
  youAvatar?: string;
  /** "2-1" style score for the long-press card (optional). */
  score?: string;
  /** The route a tap opens: always the exact game. */
  url: string;
}
