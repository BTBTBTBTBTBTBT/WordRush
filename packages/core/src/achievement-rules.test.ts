import { describe, expect, it } from 'vitest';
import {
  HIDDEN_ACHIEVEMENT_KEYS, NEW_ACHIEVEMENTS, achievementArt, avatarAchievements, botAchievements, friendAchievements,
  momentAchievements, pangramAchievements, pangramCount, pocketAchievements, puzzleCountAchievements,
  puzzleDayAchievements, puzzleResultAchievements, wonFriendsRace,
} from './achievement-rules';

describe('BE achievement catalog', () => {
  it('has the 37 new achievements (clean_crack dropped: Clean Crack already exists) + the 5 secret tunes, unique keys, art per key', () => {
    expect(NEW_ACHIEVEMENTS).toHaveLength(42);
    expect(new Set(NEW_ACHIEVEMENTS.map((a) => a.key)).size).toBe(42);
    expect(NEW_ACHIEVEMENTS.filter((a) => a.secret)).toHaveLength(5);
    expect(NEW_ACHIEVEMENTS.find((a) => a.key === 'kindred_regular')?.name).toBe('Kindred Fan');
    expect(achievementArt('night_owl')).toBe('art-ach-night_owl');
  });
  it('hides only what is not tracked yet', () => {
    expect([...HIDDEN_ACHIEVEMENT_KEYS].sort()).toEqual(['under_par']);
  });
});

describe('BE rules', () => {
  it('puzzle counts and one-game feats', () => {
    expect(puzzleCountAchievements({ SCRAMBLE: 25, GROUPS: 24, LADDER: 30, REGIONS: 25 })).toEqual(['muddle_master', 'ladder_climber', 'starstruck']);
    expect(puzzleResultAchievements({ gameMode: 'SCRAMBLE', won: true, guessCount: 7, hintsUsed: 0 })).toEqual(['punchline_pro']);
    expect(puzzleResultAchievements({ gameMode: 'HUB', won: true, guessCount: 1, hintsUsed: 2 })).toEqual(['hive_mind']);
    expect(puzzleResultAchievements({ gameMode: 'GROUPS', won: true, guessCount: 4, hintsUsed: 0 })).toEqual(['kindred_spirit']);
    expect(puzzleResultAchievements({ gameMode: 'REGIONS', won: false, guessCount: 1, hintsUsed: 0 })).toEqual([]);
  });
  it('counts pangrams', () => {
    const n = pangramCount([{ letters: 'PLAYING', found: ['PLAYING', 'PAYING', 'PLAYINGS'] }, { letters: 'ABC', found: ['ABC'] }]);
    expect(n).toBe(2);
    expect(pangramAchievements(9)).toEqual([]);
    expect(pangramAchievements(10)).toEqual(['pangram_hunter']);
  });
  it('puzzle day sweeps', () => {
    expect(puzzleDayAchievements({ puzzlesDone: 10, puzzlesTotal: 10, wordSweepDone: true, puzzleSweepStreak: 7 })).toEqual(['puzzle_sweep', 'puzzle_week', 'grand_sweep']);
    expect(puzzleDayAchievements({ puzzlesDone: 9, puzzlesTotal: 10, wordSweepDone: true, puzzleSweepStreak: 0 })).toEqual([]);
  });
  it('bot ladder + Bot of the Day', () => {
    expect(botAchievements({ ladderCleared: 1, botOfDayWins: 0 })).toEqual(['wake_up_call']);
    expect(botAchievements({ ladderCleared: 10, botOfDayWins: 7 })).toEqual(['wake_up_call', 'halfway_hero', 'boss_battle', 'meet_the_cast', 'daily_duelist']);
  });
  it('friends', () => {
    expect(friendAchievements({ friendCount: 10, reactionsSent: 25, bestFriendStreak: 7, wonRace: true })).toEqual(['best_buds', 'squad_goals', 'race_day', 'ride_or_die', 'cheerleader']);
    expect(wonFriendsRace(500, [300, 0])).toBe(true);
    expect(wonFriendsRace(500, [500])).toBe(false);
    expect(wonFriendsRace(500, [0, 0])).toBe(false);
  });
  it('pocket games', () => {
    const win = (kind: any, n: number) => Array.from({ length: n }, () => ({ kind, finished: true, won: true }));
    expect(pocketAchievements([...win('rps', 10), { kind: 'chain', finished: false, won: false, chainWords: 20 }])).toEqual(['rock_solid', 'chain_reaction']);
    const all = (['rps', 'ttt', 'coin', 'pass', 'ghost', 'chain'] as const).flatMap((k) => win(k, 1));
    expect(pocketAchievements(all)).toEqual(['pocket_pro']);
    expect(pocketAchievements(Array.from({ length: 10 }, () => ({ kind: 'pass' as const, finished: true, won: false })))).toEqual(['team_player']);
  });
  it('mascot maker', () => {
    expect(avatarAchievements(null)).toEqual([]);
    expect(avatarAchievements({ head: 'none', face: 'none', neck: 'none', bg: 'auto' })).toEqual(['self_portrait']);
    expect(avatarAchievements({ head: 'wizard', face: 'none', neck: 'cape', bg: 'galaxy' })).toEqual(['self_portrait', 'dress_up']);
  });
  it('moments', () => {
    expect(momentAchievements({ localHour: 2, season: null })).toEqual(['night_owl']);
    expect(momentAchievements({ localHour: 6, season: 'halloween' })).toEqual(['early_bird', 'spooky_season']);
    expect(momentAchievements({ localHour: 7, season: null })).toEqual([]);
  });
});
