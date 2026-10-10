// Friends tab, one card per friend (FRIDAY-QUEUE items 9 + 9e, 2.8 wave 3).
//
// Today's tab stacks one full-width card per pocket game ("vs @name" repeated, a
// PLAY pill each). The 2.8 tab groups by FRIEND: online friends first, one card
// per friend with their living mascot, "N games waiting on you", and a compact
// strip of game tiles (the game's art + a one-word state). "Their turn" games
// collapse into one quiet line. Everyone else lives in an "All friends" list.
//
// Everything here is pure so web, iOS and Android build the SAME cards with the
// SAME words; the Swift and Kotlin ports assert against friend-cards-fixtures.json
// (scripts/gen-parity-fixtures.ts).

import { PASS_MAX_GUESSES, type FriendlyKind, type FriendlyState, type Side } from './friendly-games';

/** The slice of a friend the cards need. */
export interface CardFriend {
  id: string;
  username: string;
  /** Heartbeat under two minutes old (isOnline). */
  online: boolean;
  /** What they are doing now ("Classic", "Muddle"), when online and known. */
  activity?: string | null;
  /** Their last-seen time, ms since epoch, for the order among the quiet ones. */
  lastSeenMs?: number | null;
}

/** The slice of an active pocket game the cards need. */
export interface CardGame {
  id: string;
  kind: FriendlyKind;
  /** The friend this game is with. */
  opponentId: string;
  /** Only used when the opponent is not in the friend list. */
  opponentName: string;
  me: Side;
  state: FriendlyState;
  yourTurn: boolean;
  /** ISO time of the last move. */
  updatedAt: string;
}

export interface GameTile {
  gameId: string;
  kind: FriendlyKind;
  /** What waits, in plain words under the game's name: "Pick rock, paper or scissors", "Your word must start with E". */
  word: string;
  yourTurn: boolean;
}

export interface FriendCard {
  friendId: string;
  name: string;
  online: boolean;
  /** "playing Classic" / "on now" while online, else null (the card shows nothing). */
  presence: string | null;
  /** How many games wait on you. */
  waiting: number;
  /** "6 games waiting on you" / "1 game waiting on you" / "" (no games waiting). */
  headline: string;
  /** Your-turn tiles, newest first. */
  tiles: GameTile[];
  /** Their-turn games, collapsed: ids newest first (expanded on tap). */
  theirTurn: GameTile[];
  /** "3 waiting on Johnny" or "" when none. */
  theirTurnLine: string;
}

export interface FriendsLayout {
  /** Online friends and friends with active games: the cards. */
  cards: FriendCard[];
  /** Everyone else, A to Z: the "All friends" dropdown. */
  rest: string[];
}

const MAX_FRAGMENT = 6;

/**
 * What waits, in plain words (founder 10-09: the old two-word states like "Starts E" / "Your pick" were confusing
 * for anyone new to the pocket games). The tile shows the game's name above this line.
 */
export function tileWord(kind: FriendlyKind, state: FriendlyState, me: Side, yourTurn: boolean): string {
  switch (kind) {
    case 'rps': return yourTurn ? 'Pick rock, paper or scissors' : 'Waiting for their pick';
    case 'ttt': return yourTurn ? 'Your turn to place a tile' : 'Waiting for their move';
    case 'coin': return yourTurn ? 'Call heads or tails' : 'Waiting for their call';
    case 'pass': {
      const used = state.kind === 'pass' ? state.guesses.length : 0;
      return yourTurn ? `Your guess (${Math.min(used + 1, PASS_MAX_GUESSES)} of ${PASS_MAX_GUESSES})` : 'Waiting for their guess';
    }
    case 'ghost': {
      if (!yourTurn) return 'Waiting for their letter';
      const f = state.kind === 'ghost' ? state.fragment.toUpperCase() : '';
      if (!f) return 'Start the word: add a letter';
      return `Add a letter to ${f.length > MAX_FRAGMENT ? `${f.slice(0, MAX_FRAGMENT)}…` : f}`;
    }
    case 'chain': {
      if (!yourTurn) return 'Waiting for their word';
      const last = state.kind === 'chain' ? state.words[state.words.length - 1] : undefined;
      return last ? `Your word must start with ${last.word[last.word.length - 1].toUpperCase()}` : 'Start the chain with any word';
    }
  }
}

/** "6 games waiting on you" / "1 game waiting on you" / "". */
export function waitingHeadline(n: number): string {
  if (n <= 0) return '';
  return n === 1 ? '1 game waiting on you' : `${n} games waiting on you`;
}

/** The quiet collapsed line: "3 waiting on Johnny". */
export function theirTurnLine(n: number, name: string): string {
  return n <= 0 ? '' : `${n} waiting on ${name}`;
}

/** "playing Classic" while they are in a game, "on now" otherwise; null when offline. */
export function cardPresence(online: boolean, activity: string | null | undefined): string | null {
  if (!online) return null;
  return activity ? `playing ${activity}` : 'on now';
}

const byUpdatedDesc = (a: CardGame, b: CardGame) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0);

/**
 * The Friends tab layout. Cards: online friends first, then friends with games
 * waiting on you, then friends with only their-turn games. Within a group: more
 * games waiting on you first, then the newest move, then A to Z. Friends with no
 * active game who are offline go to `rest`.
 */
export function friendsLayout(friends: CardFriend[], games: CardGame[]): FriendsLayout {
  const byFriend = new Map<string, CardGame[]>();
  for (const g of games) {
    const list = byFriend.get(g.opponentId);
    if (list) list.push(g);
    else byFriend.set(g.opponentId, [g]);
  }
  // A game with someone no longer in the list still deserves its card.
  const known = new Map(friends.map((f) => [f.id, f]));
  const all: CardFriend[] = [...friends];
  for (const [id, list] of byFriend) {
    if (!known.has(id)) all.push({ id, username: list[0].opponentName, online: false });
  }

  const cards: Array<{ card: FriendCard; newest: string; rank: number }> = [];
  const rest: string[] = [];
  for (const f of all) {
    const mine = (byFriend.get(f.id) ?? []).slice().sort(byUpdatedDesc);
    if (!f.online && mine.length === 0) { rest.push(f.username); continue; }
    const toTile = (g: CardGame): GameTile => ({ gameId: g.id, kind: g.kind, word: tileWord(g.kind, g.state, g.me, g.yourTurn), yourTurn: g.yourTurn });
    const tiles = mine.filter((g) => g.yourTurn).map(toTile);
    const theirTurn = mine.filter((g) => !g.yourTurn).map(toTile);
    const card: FriendCard = {
      friendId: f.id, name: f.username, online: f.online, presence: cardPresence(f.online, f.activity),
      waiting: tiles.length, headline: waitingHeadline(tiles.length), tiles, theirTurn,
      theirTurnLine: theirTurnLine(theirTurn.length, f.username),
    };
    cards.push({ card, newest: mine[0]?.updatedAt ?? '', rank: f.online ? 0 : tiles.length > 0 ? 1 : 2 });
  }
  cards.sort((a, b) =>
    a.rank - b.rank
    || b.card.waiting - a.card.waiting
    || (a.newest < b.newest ? 1 : a.newest > b.newest ? -1 : 0)
    || a.card.name.toLowerCase().localeCompare(b.card.name.toLowerCase()));
  rest.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  return { cards: cards.map((c) => c.card), rest };
}

/** The label on the collapsed list: "All friends · 12". */
export function allFriendsLabel(count: number): string {
  return `All friends · ${count}`;
}

/** Whether a card or tile order should read "your turn" at all: any waiting game. */
export function hasYourTurn(layout: FriendsLayout): boolean {
  return layout.cards.some((c) => c.waiting > 0);
}
