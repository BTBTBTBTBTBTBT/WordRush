import { supabase } from './supabase-client';

// ============================================================
// Achievement Definitions
// ============================================================

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  category: 'beginner' | 'consistency' | 'skill' | 'social' | 'collection';
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Beginner
  { key: 'first_win', name: 'First Win', description: 'Win any game', category: 'beginner', icon: 'trophy' },
  { key: 'all_modes', name: 'All Modes Played', description: 'Play all 9 game modes', category: 'beginner', icon: 'grid' },
  { key: 'daily_debut', name: 'Daily Debut', description: 'Complete your first daily challenge', category: 'beginner', icon: 'calendar' },

  // Consistency
  { key: 'streak_7', name: '7-Day Warrior', description: 'Play 7 consecutive days', category: 'consistency', icon: 'flame' },
  { key: 'streak_30', name: '30-Day Streak', description: 'Play 30 consecutive days', category: 'consistency', icon: 'flame' },

  // Skill
  { key: 'speed_demon', name: 'Speed Demon', description: 'Solve Classic in under 30 seconds', category: 'skill', icon: 'zap' },
  { key: 'perfectionist', name: 'Perfectionist', description: 'Solve in 1 guess', category: 'skill', icon: 'star' },
  { key: 'gauntlet_master', name: 'Gauntlet Master', description: 'Complete the entire Gauntlet', category: 'skill', icon: 'swords' },

  // Social
  { key: 'vs_veteran', name: 'VS Veteran', description: 'Win 10 VS matches', category: 'social', icon: 'swords' },
  { key: 'unstoppable', name: 'Unstoppable', description: 'Achieve a 5-win streak', category: 'social', icon: 'flame' },

  // Collection
  { key: 'medal_10', name: 'Medal Collector', description: 'Earn 10 medals', category: 'collection', icon: 'medal' },
  { key: 'medal_50', name: 'Medal Hoarder', description: 'Earn 50 medals', category: 'collection', icon: 'medal' },
  { key: 'golden_touch', name: 'Golden Touch', description: 'Earn 10 gold medals', category: 'collection', icon: 'crown' },

  // Daily sweep achievements — unlock once the corresponding
  // daily_bonuses flag has ever been set for this user.
  { key: 'daily_sweep', name: 'Daily Sweep', description: 'Complete all 9 dailies in a single day', category: 'skill', icon: 'sparkles' },
  { key: 'flawless_victory', name: 'Flawless Victory', description: 'Win all 9 dailies in a single day', category: 'skill', icon: 'trophy' },

  // Cumulative milestones
  { key: 'century_club', name: 'Century Club', description: 'Win 100 total games', category: 'consistency', icon: 'trophy' },
  { key: 'thousand_words', name: 'Thousand Words', description: 'Win 1,000 total games', category: 'consistency', icon: 'crown' },
  { key: 'sweep_streak_7', name: 'Sweep Streak', description: 'Complete the daily sweep 7 days in a row', category: 'consistency', icon: 'sparkles' },
  { key: 'iron_will', name: 'Iron Will', description: 'Complete the daily sweep 30 days in a row', category: 'consistency', icon: 'flame' },

  // Mode mastery
  { key: 'quad_king', name: 'Quad King', description: 'Win 50 QuadWord games', category: 'skill', icon: 'grid' },
  { key: 'octo_boss', name: 'Octo Boss', description: 'Win 50 OctoWord games', category: 'skill', icon: 'grid' },
  { key: 'sequence_ace', name: 'Sequence Ace', description: 'Win 50 Sequence games', category: 'skill', icon: 'zap' },
  { key: 'rescue_hero', name: 'Rescue Hero', description: 'Win 50 Deliverance games', category: 'skill', icon: 'star' },

  // Skill ceiling
  { key: 'lightning_round', name: 'Lightning Round', description: 'Complete the daily sweep in under 20 minutes', category: 'skill', icon: 'zap' },
  { key: 'no_sweat', name: 'No Sweat', description: 'Win Classic in 2 guesses', category: 'skill', icon: 'star' },
  { key: 'untouchable', name: 'Untouchable', description: 'Achieve a 10-win VS streak', category: 'social', icon: 'swords' },
  { key: 'gauntlet_god', name: 'Gauntlet God', description: 'Complete Gauntlet without failing any board', category: 'skill', icon: 'crown' },

  // Social/competitive
  { key: 'rival', name: 'Rival', description: 'Play 50 VS matches', category: 'social', icon: 'swords' },
  { key: 'dominant', name: 'Dominant', description: 'Win 50 VS matches', category: 'social', icon: 'trophy' },

  // Collection
  { key: 'medal_wall', name: 'Medal Wall', description: 'Earn 100 medals', category: 'collection', icon: 'medal' },
];

// ============================================================
// Achievement Checking
// ============================================================

/**
 * Check and award achievements after a game result.
 * Returns array of newly unlocked achievement keys.
 */
export async function checkAchievements(
  userId: string,
  gameMode: string,
  playType: 'solo' | 'vs',
  won: boolean,
  guessCount: number,
  timeSeconds: number,
  seed?: string,
): Promise<string[]> {
  const unlocked: string[] = [];

  // Fetch existing achievements
  const { data: existing } = await (supabase as any)
    .from('achievements')
    .select('achievement_key')
    .eq('user_id', userId);

  const alreadyUnlocked = new Set((existing || []).map((a: any) => a.achievement_key));

  const tryUnlock = async (key: string) => {
    if (alreadyUnlocked.has(key)) return;
    const { error } = await (supabase as any)
      .from('achievements')
      .insert({ user_id: userId, achievement_key: key });
    if (!error) unlocked.push(key);
  };

  // First Win
  if (won) {
    await tryUnlock('first_win');
  }

  // Daily Debut
  if (seed?.startsWith('daily-') && (won || true)) {
    await tryUnlock('daily_debut');
  }

  // Speed Demon (Classic under 30s)
  if (gameMode === 'DUEL' && won && timeSeconds < 30) {
    await tryUnlock('speed_demon');
  }

  // Perfectionist (1 guess)
  if (won && guessCount === 1) {
    await tryUnlock('perfectionist');
  }

  // Gauntlet Master
  if (gameMode === 'GAUNTLET' && won) {
    await tryUnlock('gauntlet_master');
  }

  // VS Veteran (10 VS wins)
  if (playType === 'vs' && won) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('total_wins')
      .eq('id', userId)
      .single();
    if (profile && profile.total_wins >= 10) {
      await tryUnlock('vs_veteran');
    }
  }

  // Unstoppable (5-win streak)
  if (won) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('current_streak')
      .eq('id', userId)
      .single();
    if (profile && profile.current_streak >= 5) {
      await tryUnlock('unstoppable');
    }
  }

  // All Modes Played
  if (!alreadyUnlocked.has('all_modes')) {
    const { data: modeStats } = await (supabase as any)
      .from('user_stats')
      .select('game_mode')
      .eq('user_id', userId);
    const modes = new Set((modeStats || []).map((s: any) => s.game_mode));
    if (['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'DUEL_6', 'DUEL_7', 'GAUNTLET', 'PROPERNOUNDLE'].every(m => modes.has(m))) {
      await tryUnlock('all_modes');
    }
  }

  // Streak achievements
  if (!alreadyUnlocked.has('streak_7') || !alreadyUnlocked.has('streak_30')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('daily_login_streak')
      .eq('id', userId)
      .single();
    if (profile) {
      if (profile.daily_login_streak >= 7) await tryUnlock('streak_7');
      if (profile.daily_login_streak >= 30) await tryUnlock('streak_30');
    }
  }

  // Daily Sweep / Flawless Victory. Piggyback on the daily_bonuses
  // table the award helper writes to: if the user has ever had a row
  // with the corresponding flag true, the achievement unlocks.
  if (!alreadyUnlocked.has('daily_sweep') || !alreadyUnlocked.has('flawless_victory')) {
    const { data: bonusRows } = await (supabase as any)
      .from('daily_bonuses')
      .select('sweep_awarded, flawless_awarded')
      .eq('user_id', userId) as { data: Array<{ sweep_awarded: boolean; flawless_awarded: boolean }> | null };
    if (bonusRows) {
      if (bonusRows.some((r) => r.sweep_awarded)) await tryUnlock('daily_sweep');
      if (bonusRows.some((r) => r.flawless_awarded)) await tryUnlock('flawless_victory');
    }
  }

  // Medal collection achievements
  if (!alreadyUnlocked.has('medal_10') || !alreadyUnlocked.has('medal_50') || !alreadyUnlocked.has('golden_touch') || !alreadyUnlocked.has('medal_wall')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('gold_medals, silver_medals, bronze_medals')
      .eq('id', userId)
      .single();
    if (profile) {
      const totalMedals = (profile.gold_medals || 0) + (profile.silver_medals || 0) + (profile.bronze_medals || 0);
      if (totalMedals >= 10) await tryUnlock('medal_10');
      if (totalMedals >= 50) await tryUnlock('medal_50');
      if (totalMedals >= 100) await tryUnlock('medal_wall');
      if ((profile.gold_medals || 0) >= 10) await tryUnlock('golden_touch');
    }
  }

  // Century Club / Thousand Words (cumulative wins)
  if (!alreadyUnlocked.has('century_club') || !alreadyUnlocked.has('thousand_words')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('total_wins')
      .eq('id', userId)
      .single();
    if (profile) {
      if (profile.total_wins >= 100) await tryUnlock('century_club');
      if (profile.total_wins >= 1000) await tryUnlock('thousand_words');
    }
  }

  // Sweep Streak (7 days) / Iron Will (30 days)
  if (!alreadyUnlocked.has('sweep_streak_7') || !alreadyUnlocked.has('iron_will')) {
    const { data: bonusDays } = await (supabase as any)
      .from('daily_bonuses')
      .select('day')
      .eq('user_id', userId)
      .eq('sweep_awarded', true)
      .order('day', { ascending: false })
      .limit(30);
    if (bonusDays && bonusDays.length > 0) {
      // Count consecutive days backwards from the most recent sweep day
      let streak = 1;
      for (let i = 1; i < bonusDays.length; i++) {
        const prev = new Date(bonusDays[i - 1].day);
        const curr = new Date(bonusDays[i].day);
        const diffMs = prev.getTime() - curr.getTime();
        if (diffMs >= 82800000 && diffMs <= 90000000) { // ~23-25h to handle timezone edges
          streak++;
        } else {
          break;
        }
      }
      if (streak >= 7) await tryUnlock('sweep_streak_7');
      if (streak >= 30) await tryUnlock('iron_will');
    }
  }

  // Mode mastery achievements (50 wins in specific modes)
  const modeMasteryChecks: [string, string][] = [
    ['quad_king', 'QUORDLE'],
    ['octo_boss', 'OCTORDLE'],
    ['sequence_ace', 'SEQUENCE'],
    ['rescue_hero', 'RESCUE'],
  ];
  for (const [key, mode] of modeMasteryChecks) {
    if (!alreadyUnlocked.has(key)) {
      const { data: stats } = await (supabase as any)
        .from('user_stats')
        .select('wins')
        .eq('user_id', userId)
        .eq('game_mode', mode)
        .eq('play_type', 'solo');
      const totalWins = (stats || []).reduce((s: number, r: any) => s + (r.wins || 0), 0);
      if (totalWins >= 50) await tryUnlock(key);
    }
  }

  // Lightning Round (daily sweep in under 20 minutes)
  if (!alreadyUnlocked.has('lightning_round') && seed?.startsWith('daily-')) {
    // Check if today's sweep is complete and total time < 1200s
    const today = new Date().toISOString().slice(0, 10);
    const { data: todayResults } = await (supabase as any)
      .from('daily_results')
      .select('game_mode, time_seconds, completed')
      .eq('user_id', userId)
      .eq('day', today)
      .eq('completed', true);
    if (todayResults && todayResults.length >= 9) {
      const modes = new Set(todayResults.map((r: any) => r.game_mode));
      const allModes = ['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'DUEL_6', 'DUEL_7', 'GAUNTLET', 'PROPERNOUNDLE'];
      if (allModes.every(m => modes.has(m))) {
        const totalTime = todayResults.reduce((s: number, r: any) => s + (r.time_seconds || 0), 0);
        if (totalTime < 1200) await tryUnlock('lightning_round');
      }
    }
  }

  // No Sweat (Classic in 2 guesses)
  if (gameMode === 'DUEL' && won && guessCount <= 2) {
    await tryUnlock('no_sweat');
  }

  // Untouchable (10-win VS streak)
  if (playType === 'vs' && won && !alreadyUnlocked.has('untouchable')) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('current_streak')
      .eq('id', userId)
      .single();
    if (profile && profile.current_streak >= 10) {
      await tryUnlock('untouchable');
    }
  }

  // Gauntlet God (complete gauntlet with all boards solved)
  if (gameMode === 'GAUNTLET' && won && !alreadyUnlocked.has('gauntlet_god')) {
    // Check most recent gauntlet daily result for boards_solved === total_boards
    const { data: gauntletResult } = await (supabase as any)
      .from('daily_results')
      .select('boards_solved, total_boards')
      .eq('user_id', userId)
      .eq('game_mode', 'GAUNTLET')
      .eq('completed', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (gauntletResult && gauntletResult.boards_solved === gauntletResult.total_boards) {
      await tryUnlock('gauntlet_god');
    }
  }

  // Rival (50 VS matches played) / Dominant (50 VS wins)
  if (playType === 'vs' && (!alreadyUnlocked.has('rival') || !alreadyUnlocked.has('dominant'))) {
    const { data: vsStats } = await (supabase as any)
      .from('user_stats')
      .select('total_games, wins')
      .eq('user_id', userId)
      .eq('play_type', 'vs');
    if (vsStats) {
      const totalGames = vsStats.reduce((s: number, r: any) => s + (r.total_games || 0), 0);
      const totalWins = vsStats.reduce((s: number, r: any) => s + (r.wins || 0), 0);
      if (totalGames >= 50) await tryUnlock('rival');
      if (totalWins >= 50) await tryUnlock('dominant');
    }
  }

  return unlocked;
}

/**
 * Fetch a user's unlocked achievements.
 */
export async function fetchUserAchievements(userId: string): Promise<{ key: string; unlocked_at: string }[]> {
  const { data } = await (supabase as any)
    .from('achievements')
    .select('achievement_key, unlocked_at')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false });

  return (data || []).map((a: any) => ({ key: a.achievement_key, unlocked_at: a.unlocked_at }));
}
