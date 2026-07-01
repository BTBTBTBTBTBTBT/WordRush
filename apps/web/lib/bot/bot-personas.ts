/**
 * CPU opponent personas + banter for VS-vs-CPU (Pro-only practice).
 *
 * Personas are cosmetic identities for the bot: a name, a robot avatar emoji,
 * an accent color, and a difficulty. Banter is light, friendly, event-driven
 * flavor surfaced through the existing VS callout channel — always kind, never
 * mean. Copy lives here so it's trivial to tune without touching game logic.
 */

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'adaptive';

/** A concrete (non-adaptive) skill tier a persona is anchored to. */
export type BotTier = 'easy' | 'medium' | 'hard';

export interface BotPersona {
  id: string;
  name: string;
  /** Robot avatar emoji, rendered in the CPU chip / intro where a human avatar would be. */
  avatar: string;
  /** Accent color for the persona chip. */
  color: string;
  tier: BotTier;
  /** One-line flavor shown under the name in the difficulty chooser. */
  tagline: string;
}

export const BOT_PERSONAS: Record<BotTier, BotPersona> = {
  easy: { id: 'rook', name: 'Rook', avatar: '🤖', color: '#22c55e', tier: 'easy', tagline: 'Relaxed — still learning the ropes' },
  medium: { id: 'lexi', name: 'Lexi', avatar: '🧠', color: '#f59e0b', tier: 'medium', tagline: 'Balanced — a fair fight' },
  hard: { id: 'nova', name: 'Nova', avatar: '⚡', color: '#ef4444', tier: 'hard', tagline: 'Ruthless — solves fast, rarely slips' },
};

/** Difficulty label shown on the CPU chip, e.g. "CPU · Hard". */
export function tierLabel(tier: BotTier): string {
  return tier === 'easy' ? 'Easy' : tier === 'medium' ? 'Medium' : 'Hard';
}

/** Events that can trigger a bot callout during a match. */
export type BotEvent =
  | 'match_start'
  | 'bot_solved_board' // bot finished a board (esp. before the player)
  | 'player_overtakes' // player pulled ahead of the bot
  | 'player_near_miss' // player is one letter away
  | 'bot_win'
  | 'bot_loss';

type BanterMap = Partial<Record<BotEvent, string[]>>;

const BANTER: Record<string, BanterMap> = {
  rook: {
    match_start: ['Go easy on me!', "Let's have fun with this one."],
    bot_solved_board: ['Hey, I got one!', 'Did I do that right?'],
    player_overtakes: ['Wow, you’re quick!', 'Teach me your tricks.'],
    player_near_miss: ['So close!', 'You almost had it!'],
    bot_win: ['I actually won one!', 'Beginner’s luck, promise.'],
    bot_loss: ['Good game — you earned it!', 'I’ll get you next time… maybe.'],
  },
  lexi: {
    match_start: ['May the best speller win.', 'Warmed up and ready.'],
    bot_solved_board: ['Locked in.', 'One down.'],
    player_overtakes: ['Nice pace — but I’m right here.', 'Not bad. Keep it up.'],
    player_near_miss: ['Almost. Watch the vowels.', 'One tile off.'],
    bot_win: ['Balanced, as expected.', 'Good match — rematch?'],
    bot_loss: ['Well played, seriously.', 'You out-read me that time.'],
  },
  nova: {
    match_start: ['I don’t lose often.', 'Let’s make this quick.'],
    bot_solved_board: ['Solved. Next.', 'Too easy.'],
    player_overtakes: ['Impressive. Briefly.', 'Enjoy the lead while it lasts.'],
    player_near_miss: ['So close. So slow.', 'Almost isn’t enough.'],
    bot_win: ['As predicted.', 'Better luck next run.'],
    bot_loss: ['…You’re good. Respect.', 'You actually beat me. Again?'],
  },
};

/** Pick a banter line for a persona + event, or null if none defined. */
export function botLine(personaId: string, event: BotEvent): string | null {
  const lines = BANTER[personaId]?.[event];
  if (!lines || lines.length === 0) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}
