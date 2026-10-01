/**
 * CPU opponent personas + banter for VS-vs-CPU (Pro-only practice).
 *
 * Personas are cosmetic identities for the bot: a name, its art (the
 * founder-picked GPT designs, VS overhaul §9 — never an emoji), an accent
 * color, and a difficulty. Banter is light, friendly, event-driven
 * flavor surfaced through the existing VS callout channel — always kind, never
 * mean. Copy lives here so it's trivial to tune without touching game logic.
 */

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'adaptive';

/** A concrete (non-adaptive) skill tier a persona is anchored to. */
export type BotTier = 'easy' | 'medium' | 'hard';

export interface BotPersona {
  id: string;
  name: string;
  /** The bot's art (/vs/bots/<id>.png), rendered in a circle where a human avatar would be. */
  avatar: string;
  /** Accent color for the persona chip. */
  color: string;
  tier: BotTier;
  /** One-line flavor shown under the name in the difficulty chooser. */
  tagline: string;
}

export const BOT_PERSONAS: Record<BotTier, BotPersona> = {
  easy: { id: 'rook', name: 'Rook', avatar: botArt('rook'), color: '#22c55e', tier: 'easy', tagline: 'Relaxed — still learning the ropes' },
  medium: { id: 'lexi', name: 'Lexi', avatar: botArt('lexi'), color: '#f59e0b', tier: 'medium', tagline: 'Balanced — a fair fight' },
  hard: { id: 'nova', name: 'Nova', avatar: botArt('nova'), color: '#ef4444', tier: 'hard', tagline: 'Ruthless — solves fast, rarely slips' },
};

/** The art for a bot id (rook, lexi, nova, adapt, ghost). Unknown ids fall back to Lexi. */
export function botArt(id: string): string {
  const known = ['rook', 'lexi', 'nova', 'adapt', 'ghost'];
  return `/vs/bots/${known.includes(id) ? id : 'lexi'}.png`;
}

/**
 * The Bots page roster (VS overhaul §8): name, tier and the "solves in" line,
 * which mirrors the engine's per-tier guess range (bot-engine PARAMS).
 */
export const BOT_ROSTER: Record<string, { id: string; name: string; tier: string; line: string }> = {
  rook: { id: 'rook', name: 'Rook', tier: 'Easy', line: 'Easy · solves in 5–6' },
  lexi: { id: 'lexi', name: 'Lexi', tier: 'Medium', line: 'Medium · solves in 4–5' },
  nova: { id: 'nova', name: 'Nova', tier: 'Hard', line: 'Hard · solves in 2–4' },
  adapt: { id: 'adapt', name: 'Adapt', tier: 'Adaptive', line: 'Adaptive · matches your form' },
  ghost: { id: 'ghost', name: 'Your Ghost', tier: 'Ghost', line: 'Your best run, replayed' },
};

/**
 * The Bot of the Day is always Lexi on the day's shared puzzle (canvas Round 7:
 * "BOT OF THE DAY · LEXI"), so every platform names the same bot.
 */
export const BOT_OF_DAY_ID = 'lexi';

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
