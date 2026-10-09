// FINISH_SPEC BE: the 37 achievements for the new games (Puzzles, the bot
// ladder + cast, friends, the six pocket games, the mascot maker, Halloween
// week, Early Bird / Night Owl) — their catalog entries AND the pure rules that
// decide them, so web (which owns the server), iOS and Android award exactly
// the same way. Pinned by achievement-rules-fixtures.json
// (scripts/gen-parity-fixtures.ts). Each badge's art is art-ach-<key>; until it
// ships, platforms fall back to the category icon (`icon`).

/**
 * The catalog's category ids (the native apps read them from /api/achievements):
 * the original five plus the new-game groups.
 */
export type AchievementCategory =
  | 'beginner' | 'consistency' | 'skill' | 'social' | 'collection'
  | 'puzzles' | 'vs' | 'bots' | 'friends' | 'pocket' | 'mascot' | 'seasonal' | 'streaks';

export const ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = [
  'beginner', 'consistency', 'skill', 'social', 'collection', 'puzzles', 'vs', 'bots', 'friends', 'pocket', 'mascot', 'seasonal', 'streaks',
];

export interface AchievementCatalogEntry {
  key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  /** The category badge icon (fallback until art-ach-<key> ships). */
  icon: string;
  /** XP the unlock pays, when it pays any (none of the BE set do yet). */
  xp?: number;
  /** Defined but not shown or awarded until its tracking ships. */
  hidden?: boolean;
  /** A secret (the musical cast's tunes): awarded normally, but listed only once unlocked (revealed on unlock). */
  secret?: boolean;
}

/** The badge art for an achievement (falls back to the category icon until it ships). */
export function achievementArt(key: string): string {
  return `art-ach-${key}`;
}

const e = (key: string, name: string, description: string, category: AchievementCategory, icon: string, hidden = false): AchievementCatalogEntry =>
  hidden ? { key, name, description, category, icon, hidden: true } : { key, name, description, category, icon };

const secret = (key: string, name: string, description: string): AchievementCatalogEntry =>
  ({ key, name, description, category: 'mascot', icon: 'sparkles', secret: true });

export const NEW_ACHIEVEMENTS: readonly AchievementCatalogEntry[] = [
  // Puzzles
  e('muddle_master', 'Muddle Master', 'Solve 25 Muddles', 'puzzles', 'shuffle'),
  e('punchline_pro', 'Punchline Pro', 'Solve a Muddle without a hint', 'puzzles', 'sparkles'),
  e('hive_mind', 'Hive Mind', 'Reach the top rank in Hubbub', 'puzzles', 'crown'),
  e('pangram_hunter', 'Pangram Hunter', 'Find 10 Hubbub pangrams', 'puzzles', 'sparkles'),
  e('kindred_spirit', 'Kindred Spirit', 'Solve a Kindred with no mistakes', 'puzzles', 'group'),
  e('kindred_regular', 'Kindred Fan', 'Solve 25 Kindreds', 'puzzles', 'group'),
  e('ladder_climber', 'Ladder Climber', 'Solve 25 Letter Ladders', 'puzzles', 'trending-up'),
  // Hidden: a ladder's guess count is clamped at par (moves − par + 1, min 1), so under par isn't recorded.
  e('under_par', 'Under Par', 'Solve a Letter Ladder under par', 'puzzles', 'target', true),
  e('code_cracker', 'Code Cracker', 'Solve 25 Codebreakers', 'puzzles', 'key-round'),
  e('sharp_spotter', 'Sharp Spotter', 'Solve 25 Spyglass word searches', 'puzzles', 'target'),
  e('starstruck', 'Starstruck', 'Solve 25 Starsweeps', 'puzzles', 'star'),
  e('perfect_constellation', 'Perfect Constellation', 'Solve a Starsweep with no wrong stars', 'puzzles', 'star'),
  e('puzzle_sweep', 'Puzzle Sweep', 'Solve all ten Puzzles in one day', 'puzzles', 'sparkles'),
  e('puzzle_week', 'Puzzle Week', 'Sweep the Puzzles 7 days in a row', 'puzzles', 'flame'),
  e('grand_sweep', 'Grand Sweep', 'Sweep every Wordocious daily and every Puzzle in one day', 'puzzles', 'crown'),
  // The bot ladder + cast
  e('wake_up_call', 'Wake-Up Call', 'Beat Rip in a VS battle', 'bots', 'swords'),
  e('halfway_hero', 'Halfway Hero', 'Clear five rungs of the bot ladder', 'bots', 'trending-up'),
  e('boss_battle', 'Boss Battle', 'Beat Webster, the final boss', 'bots', 'crown'),
  e('meet_the_cast', 'Meet the Cast', 'Beat all ten cast bots', 'bots', 'group'),
  e('daily_duelist', 'Daily Duelist', 'Beat the Bot of the Day 7 times', 'bots', 'calendar'),
  // Friends
  e('best_buds', 'Best Buds', 'Add your first friend', 'friends', 'group'),
  e('squad_goals', 'Squad Goals', 'Have 10 friends', 'friends', 'group'),
  e('race_day', 'Race Day', "Win today's friends race", 'friends', 'trophy'),
  e('ride_or_die', 'Ride or Die', 'Keep a 7-day friend streak', 'friends', 'flame'),
  e('cheerleader', 'Cheerleader', 'Send 25 reactions', 'friends', 'sparkles'),
  // Pocket games
  e('rock_solid', 'Rock Solid', 'Win 10 Rock Paper Scissors matches', 'pocket', 'target'),
  e('three_in_a_row', 'Three in a Row', 'Win 10 Tic-Tac-Tile matches', 'pocket', 'grid'),
  e('called_it', 'Called It', 'Win 10 Call It matches', 'pocket', 'star'),
  e('team_player', 'Team Player', 'Finish 10 Pass the Puzzle games', 'pocket', 'group'),
  e('spooky_speller', 'Spooky Speller', 'Win 10 Ghost games', 'pocket', 'quote'),
  e('chain_reaction', 'Chain Reaction', 'Make a 20-word Word Chain', 'pocket', 'shuffle'),
  e('pocket_pro', 'Pocket Pro', 'Win at least one of every pocket game', 'pocket', 'crown'),
  // The mascot maker
  e('self_portrait', 'Self Portrait', 'Make your own mascot', 'mascot', 'star'),
  e('dress_up', 'Dress Up', 'Save a mascot with a hat, an extra and a backdrop', 'mascot', 'sparkles'),
  // Moments
  e('spooky_season', 'Spooky Season', 'Finish a daily during the Halloween season', 'seasonal', 'calendar'),
  e('early_bird', 'Early Bird', 'Finish a daily before 7 AM', 'streaks', 'calendar'),
  e('night_owl', 'Night Owl', 'Finish a daily between midnight and 4 AM', 'streaks', 'calendar'),
  // The musical cast (secret: listed only once unlocked; musical-cast.ts MUSICAL_MELODIES)
  secret('tune_little_lamb', 'Little Lamb', 'Played Mary Had a Little Lamb on the cast'),
  secret('tune_little_star', 'Little Star', 'Played Twinkle, Twinkle, Little Star on the cast'),
  secret('tune_ode_to_joy', 'Ode to Joy', 'Played Ode to Joy on the cast'),
  secret('tune_happy_birthday', 'Happy Birthday', 'Played Happy Birthday on the cast'),
  secret('tune_hot_cross_buns', 'Hot Cross Buns', 'Played Hot Cross Buns on the cast'),
  // Halloween tunes (item 49): playable only in season; the achievements stay forever
  secret('tune_mountain_king', 'Mountain King', 'Played In the Hall of the Mountain King on the cast'),
  secret('tune_toccata', 'Toccata', 'Played the Toccata and Fugue in D minor on the cast'),
  secret('tune_funeral_march', 'Funeral March', 'Played the Funeral March on the cast'),
  secret('tune_marionette', 'Marionette', 'Played the Funeral March of a Marionette on the cast'),
  secret('tune_danse_macabre', 'Danse Macabre', 'Played Danse Macabre on the cast'),
  secret('tune_bald_mountain', 'Bald Mountain', 'Played Night on Bald Mountain on the cast'),
  secret('tune_sorcerers_apprentice', "Sorcerer's Apprentice", "Played The Sorcerer's Apprentice on the cast"),
];

/** The secret keys: awarded, but a locked one is never listed (it appears once unlocked). */
export const SECRET_ACHIEVEMENT_KEYS: readonly string[] = NEW_ACHIEVEMENTS.filter((a) => a.secret).map((a) => a.key);

/** Should a catalog entry show in a player's list? Hidden never; a secret only once the player has it. */
export function achievementListed(a: { key: string; hidden?: boolean; secret?: boolean }, unlocked: { has(key: string): boolean }): boolean {
  if (a.hidden) return false;
  return !a.secret || unlocked.has(a.key);
}

/** The keys whose tracking isn't recorded yet (defined, not shown, never awarded). */
export const HIDDEN_ACHIEVEMENT_KEYS: readonly string[] = NEW_ACHIEVEMENTS.filter((a) => a.hidden).map((a) => a.key);

const keep = (keys: Array<string | false>): string[] => keys.filter((k): k is string => !!k && !HIDDEN_ACHIEVEMENT_KEYS.includes(k));

// ── Puzzles ────────────────────────────────────────────────────────────────

/** Lifetime solo wins per puzzle mode → the 25-solve badges. */
export function puzzleCountAchievements(winsByMode: Record<string, number>): string[] {
  const w = (m: string) => winsByMode[m] ?? 0;
  return keep([
    w('SCRAMBLE') >= 25 && 'muddle_master',
    w('GROUPS') >= 25 && 'kindred_regular',
    w('LADDER') >= 25 && 'ladder_climber',
    w('CRYPTOGRAM') >= 25 && 'code_cracker',
    w('WORDSEARCH') >= 25 && 'sharp_spotter',
    w('REGIONS') >= 25 && 'starstruck',
  ]);
}

/**
 * One finished puzzle → its one-game badges (from the recorded result row):
 * Muddle with no hint; Hubbub at the top rank (guess_count 1 = every scoring
 * word, Pandemonium); Kindred with no mistakes (4 guesses = four groups, no
 * miss); Starsweep with no wrong stars (guess_count = mistakes + 1).
 */
export function puzzleResultAchievements(r: { gameMode: string; won: boolean; guessCount: number; hintsUsed: number }): string[] {
  if (!r.won) return [];
  return keep([
    r.gameMode === 'SCRAMBLE' && r.hintsUsed === 0 && 'punchline_pro',
    r.gameMode === 'HUB' && r.guessCount === 1 && 'hive_mind',
    r.gameMode === 'GROUPS' && r.guessCount === 4 && 'kindred_spirit',
    r.gameMode === 'REGIONS' && r.guessCount === 1 && 'perfect_constellation',
  ]);
}

/** Pangrams found across Hubbub games: words using all seven of that puzzle's letters. */
export function pangramCount(games: ReadonlyArray<{ letters: string; found: readonly string[] }>): number {
  let n = 0;
  for (const g of games) {
    if (g.letters.length !== 7) continue;
    const L = g.letters.toUpperCase();
    for (const w of g.found) if ([...L].every((ch) => w.toUpperCase().includes(ch))) n += 1;
  }
  return n;
}

export function pangramAchievements(pangrams: number): string[] {
  return keep([pangrams >= 10 && 'pangram_hunter']);
}

/** A day's Puzzles + Wordocious state → the sweep badges. */
export function puzzleDayAchievements(d: { puzzlesDone: number; puzzlesTotal: number; wordSweepDone: boolean; puzzleSweepStreak: number }): string[] {
  const puzzleSweep = d.puzzlesTotal > 0 && d.puzzlesDone >= d.puzzlesTotal;
  return keep([
    puzzleSweep && 'puzzle_sweep',
    d.puzzleSweepStreak >= 7 && 'puzzle_week',
    puzzleSweep && d.wordSweepDone && 'grand_sweep',
  ]);
}

// ── The bot ladder + cast ──────────────────────────────────────────────────

/**
 * The ten-bot ladder (Rip rung 1 … Webster rung 10): rungs cleared, and Bot of
 * the Day wins (lifetime). Clearing a rung = beating that bot.
 */
export function botAchievements(p: { ladderCleared: number; botOfDayWins: number }): string[] {
  return keep([
    p.ladderCleared >= 1 && 'wake_up_call',
    p.ladderCleared >= 5 && 'halfway_hero',
    p.ladderCleared >= 10 && 'boss_battle',
    p.ladderCleared >= 10 && 'meet_the_cast',
    p.botOfDayWins >= 7 && 'daily_duelist',
  ]);
}

// ── Friends ────────────────────────────────────────────────────────────────

export function friendAchievements(f: { friendCount: number; reactionsSent: number; bestFriendStreak: number; wonRace: boolean }): string[] {
  return keep([
    f.friendCount >= 1 && 'best_buds',
    f.friendCount >= 10 && 'squad_goals',
    f.wonRace && 'race_day',
    f.bestFriendStreak >= 7 && 'ride_or_die',
    f.reactionsSent >= 25 && 'cheerleader',
  ]);
}

/**
 * A friends race is won by the most points that day among you and your
 * friends, with at least one friend who played; a tie for first doesn't count.
 */
export function wonFriendsRace(mine: number, friends: readonly number[]): boolean {
  const played = friends.filter((p) => p > 0);
  if (mine <= 0 || played.length === 0) return false;
  return played.every((p) => mine > p);
}

// ── Pocket games ───────────────────────────────────────────────────────────

export type PocketKind = 'rps' | 'ttt' | 'coin' | 'pass' | 'ghost' | 'chain';
export const POCKET_KINDS: readonly PocketKind[] = ['rps', 'ttt', 'coin', 'pass', 'ghost', 'chain'];

/** One of the player's pocket games: finished or not, won by them, and (Word Chain) how many words the chain reached. */
export interface PocketGameResult { kind: PocketKind; finished: boolean; won: boolean; chainWords?: number }

export function pocketAchievements(games: ReadonlyArray<PocketGameResult>): string[] {
  const wins = (k: PocketKind) => games.filter((g) => g.kind === k && g.finished && g.won).length;
  const finished = (k: PocketKind) => games.filter((g) => g.kind === k && g.finished).length;
  return keep([
    wins('rps') >= 10 && 'rock_solid',
    wins('ttt') >= 10 && 'three_in_a_row',
    wins('coin') >= 10 && 'called_it',
    finished('pass') >= 10 && 'team_player',
    wins('ghost') >= 10 && 'spooky_speller',
    games.some((g) => g.kind === 'chain' && (g.chainWords ?? 0) >= 20) && 'chain_reaction',
    POCKET_KINDS.every((k) => wins(k) >= 1) && 'pocket_pro',
  ]);
}

// ── The mascot maker ───────────────────────────────────────────────────────

/** A saved mascot (avatar_config) → Self Portrait; with a hat, a face or neck extra and a chosen backdrop → Dress Up. */
export function avatarAchievements(config: { head?: string; face?: string; neck?: string; bg?: string } | null | undefined): string[] {
  if (!config) return [];
  const hat = !!config.head && config.head !== 'none';
  const extra = (!!config.face && config.face !== 'none') || (!!config.neck && config.neck !== 'none');
  const backdrop = !!config.bg && config.bg !== 'auto' && config.bg !== 'none';
  return keep(['self_portrait', hat && extra && backdrop && 'dress_up']);
}

// ── Moments ────────────────────────────────────────────────────────────────

/**
 * A daily finished at the player's LOCAL hour (0–23) in `season`: Night Owl
 * from midnight to 4 AM, Early Bird from 4 to 7 AM (so one finish never earns
 * both), Spooky Season during the Halloween season.
 */
export function momentAchievements(m: { localHour: number; season: string | null }): string[] {
  return keep([
    m.localHour >= 0 && m.localHour < 4 && 'night_owl',
    m.localHour >= 4 && m.localHour < 7 && 'early_bird',
    m.season === 'halloween' && 'spooky_season',
  ]);
}
