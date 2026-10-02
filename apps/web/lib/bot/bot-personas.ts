/**
 * CPU opponent personas + banter for VS-vs-CPU.
 *
 * FINISH_SPEC D1 (founder, 2026-10-02): the bots ARE the cast. The ten
 * characters climb a ladder (core BOT_CAST in packages/core/src/bot-cast.ts —
 * the one table every platform mirrors): Rip, Ivy, Ollie, Opal, Cosmo, Umi
 * (adaptive), Ozzy, Dewey, Scoot and Webster (the boss). Each draws its own
 * character's pose art (art-pose-<castId>-ready|victory|goodgame|waiting) and
 * talks in its own personality — always kind, never mean. "Your Ghost" stays
 * the player's best run replayed. Old ids (rook / lexi / nova / adapt) map by
 * difficulty (core canonicalBotId) so old progress and stats keep counting.
 */
import { BOT_CAST, botCastMember, botOfTheDay, botSolveLine, canonicalBotId, type BotCastId, type BotCastLetter } from '@wordle-duel/core';
import { poseSrc, type PoseCastId } from '@/lib/art';

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'adaptive';

/** A concrete (non-adaptive) skill tier a persona is anchored to. */
export type BotTier = 'easy' | 'medium' | 'hard';

/** The four VS poses each cast member has (art-pose-<castId>-<pose>). */
export type BotPose = 'ready' | 'victory' | 'goodgame' | 'waiting';

export interface BotPersona {
  id: BotCastId;
  name: string;
  /** The character (mascot / pose art id). */
  castId: BotCastLetter;
  /** Ladder rung 1–10. */
  rung: number;
  /** The bot's art (its character's ready pose). */
  avatar: string;
  /** Accent color for the persona chip. */
  color: string;
  /** The concrete tier its pace + odds come from (adaptive bots report medium). */
  tier: BotTier;
  /** The engine difficulty (adaptive for Umi). */
  difficulty: BotDifficulty;
  /** Its own solve range, or null (adaptive). */
  guesses: readonly [number, number] | null;
  /** "Solves in 5–6" / "Matches your form". */
  line: string;
  /** One-line flavor ("Bold openers"). */
  tagline: string;
}

/** True for a current cast id. */
export function isBotCastId(id: string): id is BotCastId {
  return BOT_CAST.some((b) => b.id === id);
}

function build(id: BotCastId): BotPersona {
  const b = botCastMember(id)!;
  return {
    id: b.id,
    name: b.name,
    castId: b.castId,
    rung: b.rung,
    avatar: poseSrc(b.castId as PoseCastId, 'ready'),
    color: b.color,
    tier: b.tier === 'adaptive' ? 'medium' : b.tier,
    difficulty: b.tier,
    guesses: b.guesses,
    line: botSolveLine(b),
    tagline: b.trait,
  };
}

/** Every cast bot's persona, by id. */
export const BOT_CAST_PERSONAS: Record<BotCastId, BotPersona> = Object.fromEntries(
  BOT_CAST.map((b) => [b.id, build(b.id)]),
) as Record<BotCastId, BotPersona>;

/** The persona for any bot id (old ids map; unknown → Opal). */
export function botPersona(id: string): BotPersona {
  const c = canonicalBotId(id);
  return isBotCastId(c) ? BOT_CAST_PERSONAS[c] : BOT_CAST_PERSONAS.opal;
}

/**
 * One representative per old tier (the old Rook / Lexi / Nova slots): easy →
 * Ivy, medium → Opal, hard → Dewey, the same map as the old ids.
 */
export const BOT_PERSONAS: Record<BotTier, BotPersona> = {
  easy: BOT_CAST_PERSONAS.ivy,
  medium: BOT_CAST_PERSONAS.opal,
  hard: BOT_CAST_PERSONAS.dewey,
};

/** The Ghost's art (a faded version of the player's own letter tile is drawn by the UI; this is the fallback). */
const GHOST_ART = '/vs/bots/ghost.png';

/**
 * The art for a bot id in a pose: the character's pose image (old ids map;
 * `ghost` keeps its art; unknown ids fall back to Opal).
 */
export function botArt(id: string, pose: BotPose = 'ready'): string {
  if (id === 'ghost') return GHOST_ART;
  return poseSrc(botPersona(id).castId as PoseCastId, pose);
}

/** The Bots page roster entry for an id (cast bots + Your Ghost). */
export function botRosterEntry(id: string): { id: string; name: string; tier: string; line: string } {
  if (id === 'ghost') return { id: 'ghost', name: 'Your Ghost', tier: 'Ghost', line: 'Your best run, replayed' };
  const p = botPersona(id);
  return { id: p.id, name: p.name, tier: p.difficulty === 'adaptive' ? 'Adaptive' : tierLabel(p.tier), line: p.line };
}

/** Today's Bot of the Day (D2: rotates with the day host; `day` = the UTC YYYY-MM-DD). */
export function botOfDayPersona(day: string): BotPersona {
  return BOT_CAST_PERSONAS[botOfTheDay(day).id];
}

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

type BanterMap = Record<BotEvent, string[]>;

// Per-character banter (D3): each line in that character's voice, kind, never mean.
const BANTER: Record<BotCastId, BanterMap> = {
  rip: {
    match_start: ['*yawn* Okay, I’m awake. Mostly.', 'Let’s take it nice and slow.'],
    bot_solved_board: ['Oh! I got one. Before my nap, too.', 'Huh, that worked.'],
    player_overtakes: ['You’re zooming. I’m cruising.', 'Wow, you’re wide awake.'],
    player_near_miss: ['Ooh, so close!', 'One more letter. You’ve got it.'],
    bot_win: ['I won? Best nap-time ever.', 'Lucky me! Good game.'],
    bot_loss: ['Great game! Time for cocoa.', 'You earned that one. Nicely done.'],
  },
  ivy: {
    match_start: ['Um, hi! Good luck!', 'Let’s grow some words.'],
    bot_solved_board: ['Oh! I got it… I think?', 'Hee, that one bloomed.'],
    player_overtakes: ['You’re so quick!', 'Wow, you’re really good at this.'],
    player_near_miss: ['Almost! You’re so close.', 'One tiny letter left!'],
    bot_win: ['I won? Oh my. Good game!', 'Hee. That was fun.'],
    bot_loss: ['You did it! That was lovely.', 'Good game. You’re amazing!'],
  },
  ollie: {
    match_start: ['Gimme a W! Let’s go!', 'Ready, set, spell!'],
    bot_solved_board: ['Woo! One down!', 'Cartwheel time!'],
    player_overtakes: ['Go, go, go! You’re on fire!', 'Look at you go!'],
    player_near_miss: ['So close! You’ve got this!', 'One more! Cheering for you!'],
    bot_win: ['Woohoo! Rematch? Rematch!', 'What a game! High five!'],
    bot_loss: ['Yay, you won! Three cheers!', 'Amazing game! You’re a star!'],
  },
  opal: {
    match_start: ['The spotlight is ready, darling.', 'Let’s make this a show.'],
    bot_solved_board: ['And… scene! Solved.', 'A dazzling guess, if I say so.'],
    player_overtakes: ['Ooh, a plot twist!', 'You’re stealing the show!'],
    player_near_miss: ['Gasp! So close!', 'The suspense! One letter left!'],
    bot_win: ['Take a bow with me. Good game!', 'What a finale! Encore?'],
    bot_loss: ['Bravo, bravo! You were brilliant.', 'A standing ovation for you!'],
  },
  cosmo: {
    match_start: ['Let’s explore some words!', 'Bold opener coming up!'],
    bot_solved_board: ['Discovered it!', 'Mapped that one out.'],
    player_overtakes: ['You found a shortcut!', 'Whoa, great route!'],
    player_near_miss: ['Nearly there, explorer!', 'You’re one step from the summit!'],
    bot_win: ['What an adventure! Good game.', 'Another trail conquered. Again?'],
    bot_loss: ['You found it first! Well played.', 'Great expedition! You led the way.'],
  },
  umi: {
    match_start: ['Breathe in. Let’s play.', 'Calm mind, clear words.'],
    bot_solved_board: ['Found it, peacefully.', 'The word appeared.'],
    player_overtakes: ['You are flowing nicely.', 'Lovely rhythm you have.'],
    player_near_miss: ['So close. Stay calm.', 'One letter. Breathe.'],
    bot_win: ['A balanced game. Thank you.', 'Good game. Tea?'],
    bot_loss: ['Beautifully played.', 'You found your flow. Well done.'],
  },
  ozzy: {
    match_start: ['Heh. Watch my sneaky guesses.', 'Got a trick or two ready.'],
    bot_solved_board: ['Ta-da! Didn’t see that coming, huh?', 'Sneaked that one in.'],
    player_overtakes: ['Hey, no fair being that clever!', 'Ha! Nice moves.'],
    player_near_miss: ['Ooh, so close! Heh.', 'One letter off! Almost got me.'],
    bot_win: ['Gotcha! Good game, friend.', 'Hehe, rematch? I’ve got more tricks.'],
    bot_loss: ['You saw through my tricks! Nice.', 'Ha! You got me. Good game.'],
  },
  dewey: {
    match_start: ['I’ve studied for this one.', 'Notes ready. Let’s begin.'],
    bot_solved_board: ['Eureka!', 'Just as my notes predicted.'],
    player_overtakes: ['Fascinating. You’re very quick.', 'Impressive reasoning!'],
    player_near_miss: ['Hmm, nearly correct!', 'One letter from the answer.'],
    bot_win: ['A well-researched win. Good game!', 'The data was on my side today.'],
    bot_loss: ['Remarkable! I’ll study your moves.', 'Well reasoned. You earned it.'],
  },
  scoot: {
    match_start: ['On your marks… go!', 'Ready to race? Let’s zoom!'],
    bot_solved_board: ['Zoom! Done!', 'Personal best!'],
    player_overtakes: ['Whoa, you’re fast!', 'Catch me if you can! Oh, you did.'],
    player_near_miss: ['Almost at the finish line!', 'So close! Sprint!'],
    bot_win: ['Photo finish! Good race!', 'What a sprint! Again?'],
    bot_loss: ['You beat me to the line! Wow!', 'Fastest speller around. Good race!'],
  },
  webster: {
    match_start: ['Welcome to the top rung.', 'Let’s see what you’ve got, friend.'],
    bot_solved_board: ['Solved. Your move.', 'That’s one.'],
    player_overtakes: ['Impressive. Truly.', 'You’re playing at the top level!'],
    player_near_miss: ['So close! Keep going.', 'One letter away. Finish it!'],
    bot_win: ['Good game. Come back anytime.', 'Well fought! The rung waits for you.'],
    bot_loss: ['You beat the boss! Bravo!', 'A true champion. Well played!'],
  },
};

/** Pick a banter line for a bot + event (old ids map), or null if none defined. */
export function botLine(botId: string, event: BotEvent): string | null {
  const c = canonicalBotId(botId);
  const lines = isBotCastId(c) ? BANTER[c][event] : null;
  if (!lines || lines.length === 0) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}
