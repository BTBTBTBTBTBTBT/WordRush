// Push + reminder copy in the fun cast voice (docs/FINISH_SPEC.md AE). ONE
// bank shared by the web/API server pushes and the native local reminders
// (pinned by push-copy-fixtures.json). Short, American spelling, no em dashes.

export type PushKind =
  | 'friendBeat' | 'yourTurn' | 'streakReminder' | 'shieldUsed'
  | 'challengeReceived' | 'friendRequest' | 'giftReceived' | 'dailyReady';

/** Each push's body template. {name} = the sender, {game} = the game's display name, {days} = streak days. */
export const PUSH_COPY: Readonly<Record<PushKind, string>> = {
  friendBeat: '{name} just beat your {game} time ⚡ Your move!',
  yourTurn: '{name} played. Your turn! 🎯',
  streakReminder: 'Your 🔥 {days}-day streak misses you! One quick game?',
  shieldUsed: 'A shield saved your streak 🛡️ Phew!',
  challengeReceived: '{name} challenged you to {game} ⚔️',
  friendRequest: '{name} wants to be friends! 🎉',
  giftReceived: '{name} gifted you a week of Pro 🎁',
  dailyReady: "Today's puzzles are fresh 🌅",
};

/** The push's title line (the app name, so the body carries the voice). */
export const PUSH_TITLE = 'Wordocious';

export interface PushVars {
  name?: string;
  game?: string;
  days?: number;
}

/** The body for a push: the template with {name} / {game} / {days} filled ("A friend" when no name). */
export function pushCopy(kind: PushKind, v: PushVars = {}): string {
  return PUSH_COPY[kind]
    .replace(/\{name\}/g, (v.name ?? '').trim() || 'A friend')
    .replace(/\{game\}/g, (v.game ?? '').trim() || 'Wordocious')
    .replace(/\{days\}/g, String(v.days ?? 0));
}
